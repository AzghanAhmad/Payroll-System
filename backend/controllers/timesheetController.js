import Timesheet from '../models/Timesheet.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import { asyncHandler, WEEK_DAYS, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import {
  recalculateEntry,
  emptyDays,
  ensureTimesheetWeeks,
} from '../services/timesheetService.js';

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

/** Autosave / concurrent edits often hit VersionError — retry last-write-wins */
const saveTimesheetRetry = async (loadFn, applyFn, maxAttempts = 5) => {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ts = await loadFn();
    if (!ts) throw new AppError('Timesheet not found', 404);
    await applyFn(ts);
    try {
      await ts.save();
      return ts;
    } catch (err) {
      lastErr = err;
      if (err.name !== 'VersionError') throw err;
    }
  }
  throw lastErr;
};

export const listTimesheets = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.year) filter.year = Number(req.query.year);
  if (req.query.month) filter.month = Number(req.query.month);
  const items = await Timesheet.find(filter)
    .populate('weeks.entries.employee', 'employeeId fullName hourlyRate department')
    .sort({ year: -1, month: -1 });
  res.json(items);
});

const syncActiveEmployees = async (ts, settings) => {
  const active = await Employee.find({ status: 'active' });
  const activeIds = new Set(active.map((e) => String(e._id)));
  let changed = false;

  ensureTimesheetWeeks(ts);

  for (const week of ts.weeks) {
    const before = week.entries.length;
    week.entries = week.entries.filter((e) =>
      activeIds.has(String(e.employee?._id || e.employee))
    );
    if (week.entries.length !== before) changed = true;

    for (const emp of active) {
      const exists = week.entries.some(
        (e) => String(e.employee?._id || e.employee) === String(emp._id)
      );
      if (!exists) {
        const entry = {
          employee: emp._id,
          days: emptyDays(),
          weeklyHours: 0,
          weeklyCost: 0,
        };
        week.entries.push(recalculateEntry(entry, emp.hourlyRate, settings));
        changed = true;
      }
    }
  }

  return changed;
};

export const getOrCreateTimesheet = asyncHandler(async (req, res) => {
  const year = Number(req.params.year);
  const month = Number(req.params.month);
  const settings = await getSettings();
  let ts = await Timesheet.findOne({ year, month });

  if (!ts) {
    ts = await Timesheet.create({
      year,
      month,
      weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({ weekNumber, entries: [] })),
      createdBy: req.user._id,
    });
  }

  const rateCache = new Map();
  const getRate = async (empId) => {
    const key = String(empId);
    if (rateCache.has(key)) return rateCache.get(key);
    const emp = await Employee.findById(empId).select('hourlyRate');
    const rate = emp?.hourlyRate || 0;
    rateCache.set(key, rate);
    return rate;
  };

  // Sync / recompute with version-conflict retry (only saves when something changed)
  for (let attempt = 0; attempt < 5; attempt++) {
    const doc = await Timesheet.findOne({ year, month });
    if (!doc) break;
    const changed = await syncActiveEmployees(doc, settings);
    let hoursChanged = false;
    for (const week of doc.weeks || []) {
      for (const entry of week.entries || []) {
        const beforeHrs = entry.weeklyHours;
        const beforeBreak = JSON.stringify(
          WEEK_DAYS.map((d) => entry.days?.[d]?.breakHours ?? 0)
        );
        const empId = entry.employee?._id || entry.employee;
        recalculateEntry(entry, await getRate(empId), settings);
        const afterBreak = JSON.stringify(
          WEEK_DAYS.map((d) => entry.days?.[d]?.breakHours ?? 0)
        );
        if (Number(beforeHrs) !== Number(entry.weeklyHours) || beforeBreak !== afterBreak) {
          hoursChanged = true;
        }
      }
    }
    if (!changed && !hoursChanged) break;
    doc.markModified('weeks');
    try {
      await doc.save();
      break;
    } catch (err) {
      if (err.name !== 'VersionError' || attempt === 4) throw err;
    }
  }

  ts = await Timesheet.findOne({ year, month }).populate(
    'weeks.entries.employee',
    'employeeId fullName hourlyRate department photo status'
  );

  res.json(ts);
});

export const updateTimesheet = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  const { weeks, status } = req.body;
  const { getWeekPeriod } = await import('../utils/weekPeriod.js');
  const { isHolidayDate } = await import('../services/calendarService.js');

  const ts = await saveTimesheetRetry(
    () => Timesheet.findById(req.params.id),
    async (doc) => {
      if (status) doc.status = status;

      if (weeks) {
        for (const weekPayload of weeks) {
          let week = doc.weeks.find((w) => w.weekNumber === weekPayload.weekNumber);
          if (!week) {
            week = { weekNumber: weekPayload.weekNumber, entries: [] };
            doc.weeks.push(week);
          }
          if (weekPayload.entries) {
            const { start } = getWeekPeriod(doc.year, doc.month, week.weekNumber);
            for (const entryPayload of weekPayload.entries) {
              const empId = entryPayload.employee?._id || entryPayload.employee;
              let entry = week.entries.find(
                (e) => String(e.employee) === String(empId)
              );
              if (!entry) {
                entry = { employee: empId, days: emptyDays() };
                week.entries.push(entry);
              }
              if (entryPayload.days) {
                for (const day of WEEK_DAYS) {
                  if (entryPayload.days[day]) {
                    const dayIndex = WEEK_DAYS.indexOf(day);
                    const dayDate = new Date(start);
                    dayDate.setDate(start.getDate() + dayIndex);
                    if (await isHolidayDate(dayDate)) {
                      entry.days[day] = {
                        clockIn: '',
                        clockOut: '',
                        breakHours: 0,
                        workingHours: 0,
                        dailyCost: 0,
                      };
                      continue;
                    }
                    entry.days[day] = {
                      ...(entry.days[day]?.toObject?.() || entry.days[day] || {}),
                      ...entryPayload.days[day],
                    };
                  }
                }
              }
              if (entryPayload.weeklyNotes !== undefined) {
                entry.weeklyNotes = entryPayload.weeklyNotes;
              }
              const emp = await Employee.findById(empId);
              recalculateEntry(entry, emp?.hourlyRate || 0, settings);
            }
          }
        }
      }

      let monthlyHours = 0;
      for (const week of doc.weeks) {
        for (const entry of week.entries) {
          monthlyHours += entry.weeklyHours || 0;
        }
      }
      doc.monthlyHours = round2(monthlyHours);
      ensureTimesheetWeeks(doc);
      doc.markModified('weeks');
    }
  );

  const populated = await Timesheet.findById(ts._id).populate(
    'weeks.entries.employee',
    'employeeId fullName hourlyRate department photo status'
  );
  res.json(populated);
});

export const deleteTimesheet = asyncHandler(async (req, res) => {
  const ts = await Timesheet.findByIdAndDelete(req.params.id);
  if (!ts) throw new AppError('Timesheet not found', 404);
  res.json({ message: 'Timesheet deleted' });
});

export const updateDay = asyncHandler(async (req, res) => {
  const { year, month, weekNumber, employeeId } = req.params;
  const { day, data } = req.body;
  if (!WEEK_DAYS.includes(day)) throw new AppError('Invalid day');

  const settings = await getSettings();
  const { getWeekPeriod } = await import('../utils/weekPeriod.js');
  const { isHolidayDate } = await import('../services/calendarService.js');
  const { start } = getWeekPeriod(Number(year), Number(month), Number(weekNumber));
  const dayIndex = WEEK_DAYS.indexOf(day);
  const dayDate = new Date(start);
  dayDate.setDate(start.getDate() + dayIndex);
  if (await isHolidayDate(dayDate)) {
    throw new AppError(
      `Cannot enter hours — ${dayDate.toLocaleDateString('en-GB')} is a public holiday`,
      400
    );
  }

  const ts = await saveTimesheetRetry(
    () => Timesheet.findOne({ year: Number(year), month: Number(month) }),
    async (doc) => {
      const week = doc.weeks.find((w) => w.weekNumber === Number(weekNumber));
      if (!week) throw new AppError('Week not found', 404);

      let entry = week.entries.find((e) => String(e.employee) === String(employeeId));
      if (!entry) {
        entry = { employee: employeeId, days: emptyDays() };
        week.entries.push(entry);
      }

      entry.days[day] = {
        ...(entry.days[day]?.toObject?.() || entry.days[day] || {}),
        ...data,
      };
      const emp = await Employee.findById(employeeId);
      recalculateEntry(entry, emp?.hourlyRate || 0, settings);

      let monthlyHours = 0;
      for (const w of doc.weeks) {
        for (const e of w.entries) monthlyHours += e.weeklyHours || 0;
      }
      doc.monthlyHours = round2(monthlyHours);
      doc.markModified('weeks');
    }
  );

  const populated = await Timesheet.findById(ts._id).populate(
    'weeks.entries.employee',
    'employeeId fullName hourlyRate department photo status'
  );
  res.json(populated);
});

const loadTimesheetForExport = async (year, month) => {
  const settings = await getSettings();
  const ts = await Timesheet.findOne({ year, month }).populate({
    path: 'weeks.entries.employee',
    select: 'employeeId fullName hourlyRate department teaFundAmount status',
    populate: { path: 'department', select: 'name' },
  });
  if (!ts) throw new AppError('Timesheet not found for period', 404);
  return { ts, settings };
};

export const exportTimesheetExcel = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const { writeTimesheetWorkbookExcel } = await import('../services/timesheetExport.js');
  const { ts, settings } = await loadTimesheetForExport(year, month);
  await writeTimesheetWorkbookExcel(res, { timesheet: ts, settings, year, month });
});

export const exportTimesheetPdf = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const { streamTimesheetWorkbookPdf } = await import('../services/timesheetExport.js');
  const { ts, settings } = await loadTimesheetForExport(year, month);
  streamTimesheetWorkbookPdf(res, { timesheet: ts, settings, year, month });
});
