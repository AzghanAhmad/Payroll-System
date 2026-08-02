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

  const changed = await syncActiveEmployees(ts, settings);
  if (changed) await ts.save();

  ts = await Timesheet.findById(ts._id).populate(
    'weeks.entries.employee',
    'employeeId fullName hourlyRate department photo status'
  );

  res.json(ts);
});

export const updateTimesheet = asyncHandler(async (req, res) => {
  const ts = await Timesheet.findById(req.params.id);
  if (!ts) throw new AppError('Timesheet not found', 404);

  const settings = await getSettings();
  const { weeks, status } = req.body;

  if (status) ts.status = status;

  if (weeks) {
    for (const weekPayload of weeks) {
      let week = ts.weeks.find((w) => w.weekNumber === weekPayload.weekNumber);
      if (!week) {
        week = { weekNumber: weekPayload.weekNumber, entries: [] };
        ts.weeks.push(week);
      }
      if (weekPayload.entries) {
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
                entry.days[day] = { ...entry.days[day]?.toObject?.() || entry.days[day], ...entryPayload.days[day] };
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
  for (const week of ts.weeks) {
    for (const entry of week.entries) {
      monthlyHours += entry.weeklyHours || 0;
    }
  }
  ts.monthlyHours = round2(monthlyHours);
  ensureTimesheetWeeks(ts);
  await ts.save();

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

  let ts = await Timesheet.findOne({ year: Number(year), month: Number(month) });
  if (!ts) throw new AppError('Timesheet not found', 404);

  const settings = await getSettings();
  const week = ts.weeks.find((w) => w.weekNumber === Number(weekNumber));
  if (!week) throw new AppError('Week not found', 404);

  let entry = week.entries.find((e) => String(e.employee) === String(employeeId));
  if (!entry) {
    entry = { employee: employeeId, days: emptyDays() };
    week.entries.push(entry);
  }

  entry.days[day] = { ...entry.days[day]?.toObject?.() || entry.days[day], ...data };
  const emp = await Employee.findById(employeeId);
  recalculateEntry(entry, emp?.hourlyRate || 0, settings);

  let monthlyHours = 0;
  for (const w of ts.weeks) {
    for (const e of w.entries) monthlyHours += e.weeklyHours || 0;
  }
  ts.monthlyHours = round2(monthlyHours);
  await ts.save();

  const populated = await Timesheet.findById(ts._id).populate(
    'weeks.entries.employee',
    'employeeId fullName hourlyRate department photo status'
  );
  res.json(populated);
});
