import fs from 'fs';
import XLSX from 'xlsx';
import { asyncHandler, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import Employee from '../models/Employee.js';
import Timesheet from '../models/Timesheet.js';
import Settings from '../models/Settings.js';
import { getWeekPeriod } from '../utils/weekPeriod.js';
import {
  ensureTimesheetWeeks,
  emptyDays,
  recalculateEntry,
} from '../services/timesheetService.js';

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

/** Normalize biometric clock time → HH:MM (24h) */
export const parseBiometricTime = (value) => {
  if (value == null || value === '') return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
  }
  if (typeof value === 'number' && value >= 0 && value < 1) {
    // Excel fraction of day
    const totalMins = Math.round(value * 24 * 60);
    const h = Math.floor(totalMins / 60) % 24;
    const m = totalMins % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  // Excel date-serial that includes time (e.g. 45800.3125)
  if (typeof value === 'number' && value >= 1) {
    const frac = value % 1;
    if (frac > 0) {
      const totalMins = Math.round(frac * 24 * 60);
      const h = Math.floor(totalMins / 60) % 24;
      const m = totalMins % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  const str = String(value).trim();
  // 7:26:33 am / 4:13:45 pm
  const ampm = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    const ap = ampm[3].toLowerCase();
    if (ap === 'pm' && h < 12) h += 12;
    if (ap === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  const h24 = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (h24) {
    return `${String(Number(h24[1])).padStart(2, '0')}:${h24[2]}`;
  }
  return '';
};

export const parseBiometricDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  if (typeof value === 'number') {
    // Excel serial date
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + value * 86400000);
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const str = String(value || '').trim();
  // DD/MM/YYYY or D/M/YYYY
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    return new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime())) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
};

const dayKeyForDate = (date) => {
  // Friday-start week: map JS day to timesheet key
  const map = {
    5: 'friday',
    6: 'saturday',
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
  };
  return map[date.getDay()];
};

const findWeekNumber = (year, month, date) => {
  for (let w = 1; w <= 5; w++) {
    const { start, end } = getWeekPeriod(year, month, w);
    const t = date.getTime();
    if (t >= start.getTime() && t <= end.getTime()) return w;
  }
  return null;
};

const normalizeHeader = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const pick = (map, ...names) => {
  for (const n of names) {
    const k = n.toLowerCase();
    if (map[k] != null) return map[k];
  }
  return null;
};

/** Read .xlsx / .xls / .csv into array-of-arrays (supports biometric .xls exports) */
const loadWorkbookRows = (filePath) => {
  let buf;
  try {
    buf = fs.readFileSync(filePath);
  } catch {
    throw new AppError('Could not read uploaded file');
  }
  if (!buf?.length) throw new AppError('Uploaded file is empty');

  let workbook;
  try {
    workbook = XLSX.read(buf, { type: 'buffer', cellDates: true });
  } catch (err) {
    throw new AppError(
      `Could not parse attendance file. Use Excel (.xlsx / .xls) or CSV. ${err.message || ''}`.trim()
    );
  }

  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) throw new AppError('Empty workbook — no sheets found');

  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true, blankrows: false });
};

/** Biometric exports sometimes put a title above the real header row */
const findHeader = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const map = {};
    (rows[i] || []).forEach((v, col) => {
      const key = normalizeHeader(v);
      if (key) map[key] = col;
    });
    const colAc = pick(map, 'ac-no.', 'ac-no', 'ac no', 'ac_no', 'acno', 'employee id', 'employeeid', 'emp id', 'emp no', 'id');
    const colName = pick(map, 'name', 'staff name', 'employee', 'employee name');
    const colDate = pick(map, 'date', 'att date', 'attendance date');
    const colIn = pick(map, 'clock in', 'clockin', 'clock-in', 'on duty', 'time in', 'check in', 'check-in', 'in');
    const colOut = pick(map, 'clock out', 'clockout', 'clock-out', 'off duty', 'time out', 'check out', 'check-out', 'out');

    if (colDate != null && colIn != null && (colAc != null || colName != null)) {
      return { headerRow: i, colAc, colName, colDate, colIn, colOut };
    }
  }
  return null;
};

export const importAttendanceExcel = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Excel file required');

  const filePath = req.file.path;
  try {
    const rows = loadWorkbookRows(filePath);
    if (!rows.length) throw new AppError('Empty workbook');

    const header = findHeader(rows);
    if (!header) {
      throw new AppError(
        'Expected columns: AC-No. (or Name), Date, Clock In, Clock Out. Check the first sheet has a header row.'
      );
    }

    const { headerRow, colAc, colName, colDate, colIn, colOut } = header;

    const employees = await Employee.find({ status: 'active' });
    const byId = new Map(employees.map((e) => [String(e.employeeId).toLowerCase(), e]));
    const byName = new Map(employees.map((e) => [String(e.fullName).toLowerCase(), e]));

    const matchEmployee = (acNo, name) => {
      if (acNo != null && String(acNo).trim() !== '') {
        const id = String(acNo).trim().toLowerCase();
        if (byId.has(id)) return byId.get(id);
        for (const [k, e] of byId) {
          if (Number(k) === Number(id) && !Number.isNaN(Number(id))) return e;
        }
      }
      if (name) {
        const n = String(name).trim().toLowerCase();
        if (byName.has(n)) return byName.get(n);
        for (const [k, e] of byName) {
          if (k.startsWith(n) || n.startsWith(k.split(' ')[0])) return e;
        }
      }
      return null;
    };

    const settings = await getSettings();
    const updates = [];
    const errors = [];
    const touchedMonths = new Map();

    const getTs = async (year, month) => {
      const key = `${year}-${month}`;
      if (touchedMonths.has(key)) return touchedMonths.get(key);
      let ts = await Timesheet.findOne({ year, month });
      if (!ts) {
        ts = await Timesheet.create({
          year,
          month,
          weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({
            weekNumber,
            entries: [],
          })),
          createdBy: req.user._id,
        });
      }
      ensureTimesheetWeeks(ts);
      touchedMonths.set(key, ts);
      return ts;
    };

    for (let i = headerRow + 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const acNo = colAc != null ? row[colAc] : null;
      const name = colName != null ? row[colName] : null;
      const dateRaw = row[colDate];
      const inRaw = row[colIn];
      const outRaw = colOut != null ? row[colOut] : null;

      if (dateRaw == null || dateRaw === '') continue;
      // Skip leftover title/total rows
      if (typeof dateRaw === 'string' && /total|summary|report/i.test(dateRaw)) continue;

      const date = parseBiometricDate(dateRaw);
      if (!date) {
        errors.push({ row: i + 1, message: `Invalid date: ${dateRaw}` });
        continue;
      }

      const emp = matchEmployee(acNo, name);
      if (!emp) {
        errors.push({ row: i + 1, message: `No employee for AC-No ${acNo} / ${name}` });
        continue;
      }

      const clockIn = parseBiometricTime(inRaw);
      const clockOut = parseBiometricTime(outRaw);
      if (!clockIn) {
        errors.push({ row: i + 1, message: `Missing clock in for ${emp.fullName}` });
        continue;
      }

      let year = date.getFullYear();
      let month = date.getMonth() + 1;
      let weekNumber = findWeekNumber(year, month, date);

      if (!weekNumber) {
        const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
        const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
        for (const cand of [prev, next]) {
          const w = findWeekNumber(cand.year, cand.month, date);
          if (w) {
            year = cand.year;
            month = cand.month;
            weekNumber = w;
            break;
          }
        }
      }

      if (!weekNumber) {
        errors.push({
          row: i + 1,
          message: `Could not map date ${date.toDateString()} to a payroll week`,
        });
        continue;
      }

      const dayKey = dayKeyForDate(date);
      const ts = await getTs(year, month);
      const week = ts.weeks.find((w) => w.weekNumber === weekNumber);
      let entry = week.entries.find((e) => String(e.employee) === String(emp._id));
      if (!entry) {
        entry = { employee: emp._id, days: emptyDays(), weeklyHours: 0, weeklyCost: 0 };
        week.entries.push(entry);
      }
      if (!entry.days[dayKey]) entry.days[dayKey] = {};
      entry.days[dayKey].clockIn = clockIn;
      if (clockOut) entry.days[dayKey].clockOut = clockOut;
      recalculateEntry(entry, emp.hourlyRate || 0, settings);

      updates.push({
        employee: emp.fullName,
        date: date.toISOString().slice(0, 10),
        clockIn,
        clockOut,
        year,
        month,
        week: weekNumber,
        day: dayKey,
      });
    }

    for (const ts of touchedMonths.values()) {
      let monthlyHours = 0;
      for (const week of ts.weeks) {
        for (const entry of week.entries) {
          monthlyHours += entry.weeklyHours || 0;
        }
      }
      ts.monthlyHours = round2(monthlyHours);
      await ts.save();
    }

    res.json({
      message: `Imported ${updates.length} attendance row(s)`,
      updated: updates.length,
      monthsTouched: [...touchedMonths.keys()],
      errors,
      sample: updates.slice(0, 10),
    });
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
});
