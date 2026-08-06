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

/** Normalize biometric / Excel clock time → HH:MM (24h) */
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
  let str = String(value).trim();
  // Biometric machines / fonts often render am→an, pm→pn
  str = str
    .replace(/\bans?\b/gi, 'am')
    .replace(/\bpns?\b/gi, 'pm')
    .replace(/\ba\.?m\.?\b/gi, 'am')
    .replace(/\bp\.?m\.?\b/gi, 'pm');

  // 7:26:33 am / 4:13:45 pm / 7:26:33 an / 4:13:45 pn
  const ampm = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm|an|pn)$/i);
  if (ampm) {
    let h = Number(ampm[1]);
    const m = Number(ampm[2]);
    let ap = ampm[3].toLowerCase();
    if (ap === 'an') ap = 'am';
    if (ap === 'pn') ap = 'pm';
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

/** Local calendar YYYY-MM-DD (avoid toISOString UTC day-shift) */
const formatLocalDate = (date) => {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const parseBiometricDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    // Time-only Excel cells decode as 1899-12-30 — not a real attendance date
    if (value.getUTCFullYear() < 1901 && value.getFullYear() < 1901) return null;
    // SheetJS date cells often land ~18:59 UTC for an intended next calendar day
    // (e.g. Fri 26-Jun displays as 2026-06-25T18:59Z). Snap with +12h then UTC Y-M-D.
    const snapped = new Date(value.getTime() + 12 * 60 * 60 * 1000);
    if (snapped.getUTCFullYear() < 1901) return null;
    return new Date(snapped.getUTCFullYear(), snapped.getUTCMonth(), snapped.getUTCDate());
  }
  if (typeof value === 'number') {
    // Excel serial date (days since 1899-12-30); round to nearest day
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + Math.round(value) * 86400000);
    if (d.getUTCFullYear() < 1901) return null;
    return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  const str = String(value || '').trim();
  // DD/MM/YYYY or D/M/YYYY
  const m1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) {
    return new Date(Number(m1[3]), Number(m1[2]) - 1, Number(m1[1]));
  }
  // 26-Jun / 26-Jun-26 / 26-Jun-2026
  const m2 = str.match(/^(\d{1,2})[-\s]([A-Za-z]{3})(?:[-\s](\d{2,4}))?$/);
  if (m2) {
    const months = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    const mon = months[m2[2].toLowerCase()];
    if (mon != null) {
      let y = m2[3] != null ? Number(m2[3]) : new Date().getFullYear();
      if (y < 100) y += 2000;
      return new Date(y, mon, Number(m2[1]));
    }
  }
  const d = new Date(str);
  if (!Number.isNaN(d.getTime()) && d.getFullYear() >= 1901) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
};

const dayKeyForDate = (date) => {
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

/**
 * Map a calendar date to payroll year/month/week.
 * When preferredWeekNumber is set (payroll workbook week block), prefer the
 * month whose week N contains that date (e.g. 25 Jun → July week 1, not June week 5).
 */
const resolvePayrollPlacement = (date, preferredWeekNumber = null) => {
  let year = date.getFullYear();
  let month = date.getMonth() + 1;
  const candidates = [
    { year, month },
    month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 },
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 },
  ];

  if (preferredWeekNumber != null) {
    for (const cand of candidates) {
      const w = findWeekNumber(cand.year, cand.month, date);
      if (w === preferredWeekNumber) {
        return { year: cand.year, month: cand.month, weekNumber: w };
      }
    }
  }

  let weekNumber = findWeekNumber(year, month, date);
  if (!weekNumber) {
    for (const cand of candidates.slice(1)) {
      const w = findWeekNumber(cand.year, cand.month, date);
      if (w) {
        year = cand.year;
        month = cand.month;
        weekNumber = w;
        break;
      }
    }
  }
  return weekNumber ? { year, month, weekNumber } : null;
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

const PAYROLL_DAY_KEYS = [
  'friday',
  'saturday',
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
];
/** Payroll Timesheets sheet: each day uses 6 columns starting at col 4 */
const PAYROLL_DAY_START_COL = 4;
const PAYROLL_DAY_STRIDE = 6;

/** Read workbook; prefer the "Timesheets" sheet used by the client payroll .xlsm */
const loadWorkbook = (filePath) => {
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
      `Could not parse attendance file. Use Excel (.xlsx / .xls / .xlsm) or CSV. ${err.message || ''}`.trim()
    );
  }

  const names = workbook.SheetNames || [];
  if (!names.length) throw new AppError('Empty workbook — no sheets found');

  const preferred =
    names.find((n) => String(n).trim().toLowerCase() === 'timesheets') || names[0];
  const sheet = workbook.Sheets[preferred];
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: true,
    blankrows: false,
  });
  return { workbook, sheetName: preferred, rows };
};

const isPayrollTimesheetsLayout = (rows) =>
  (rows || []).some((r) => /WEEK\s*\d+\s*WORKLOG/i.test(String(r?.[0] ?? '')));

/** Biometric exports sometimes put a title above the real header row */
const findHeader = (rows) => {
  for (let i = 0; i < Math.min(rows.length, 25); i++) {
    const map = {};
    (rows[i] || []).forEach((v, col) => {
      const key = normalizeHeader(v);
      if (key) map[key] = col;
    });
    const colAc = pick(
      map,
      'ac-no.',
      'ac-no',
      'ac no',
      'ac_no',
      'acno',
      'employee id',
      'employeeid',
      'emp id',
      'emp no',
      'id'
    );
    const colName = pick(map, 'name', 'staff name', 'employee', 'employee name');
    const colDate = pick(map, 'date', 'att date', 'attendance date');
    const colIn = pick(
      map,
      'clock in',
      'clockin',
      'clock-in',
      'on duty',
      'time in',
      'check in',
      'check-in',
      'in'
    );
    const colOut = pick(
      map,
      'clock out',
      'clockout',
      'clock-out',
      'off duty',
      'time out',
      'check out',
      'check-out',
      'out'
    );

    if (colDate != null && colIn != null && (colAc != null || colName != null)) {
      return { headerRow: i, colAc, colName, colDate, colIn, colOut };
    }
  }
  return null;
};

const buildEmployeeMatchers = (employees) => {
  const normalizeName = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  const byId = new Map(employees.map((e) => [String(e.employeeId).toLowerCase(), e]));
  const byName = new Map(employees.map((e) => [normalizeName(e.fullName), e]));
  const byFirst = new Map();
  for (const e of employees) {
    const first = normalizeName(e.fullName).split(' ')[0];
    if (!first) continue;
    if (!byFirst.has(first)) byFirst.set(first, []);
    byFirst.get(first).push(e);
  }

  const namesCompatible = (sheetName, emp) => {
    if (!sheetName) return true;
    const n = normalizeName(sheetName);
    const full = normalizeName(emp.fullName);
    if (!n) return true;
    if (full === n) return true;
    if (full.startsWith(n) || n.startsWith(full)) return true;
    const first = full.split(' ')[0];
    if (first && (first === n || n.startsWith(first))) return true;
    const words = n.split(' ').filter(Boolean);
    if (words.length >= 2 && words.every((w) => full.includes(w))) return true;
    return false;
  };

  const matchByName = (name) => {
    if (!name) return null;
    const n = normalizeName(name);
    if (!n) return null;
    if (byName.has(n)) return byName.get(n);
    const firstHits = byFirst.get(n) || byFirst.get(n.split(' ')[0]);
    if (firstHits?.length === 1) return firstHits[0];
    for (const [k, e] of byName) {
      if (k.startsWith(n) || n.startsWith(k.split(' ')[0])) return e;
      const words = n.split(' ').filter(Boolean);
      if (words.length >= 2 && words.every((w) => k.includes(w))) return e;
    }
    if (firstHits?.length > 1) return null;
    return null;
  };

  const matchByAc = (acNo, name) => {
    if (acNo == null || String(acNo).trim() === '') return null;
    const id = String(acNo).trim().toLowerCase();
    let emp = byId.get(id) || null;
    if (!emp) {
      for (const [k, e] of byId) {
        if (Number(k) === Number(id) && !Number.isNaN(Number(id))) {
          emp = e;
          break;
        }
      }
    }
    if (emp && name && !namesCompatible(name, emp)) return null;
    return emp;
  };

  const matchEmployee = (acNo, name) => matchByName(name) || matchByAc(acNo, name);
  return { matchEmployee, normalizeName };
};

const makeTimesheetCache = (userId) => {
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
        createdBy: userId,
      });
    }
    ensureTimesheetWeeks(ts);
    touchedMonths.set(key, ts);
    return ts;
  };
  return { touchedMonths, getTs };
};

const applyClockToEntry = ({
  entry,
  dayKey,
  clockIn,
  clockOut,
  breakHours,
  breakFromSheet,
  emp,
  settings,
}) => {
  if (!entry.days[dayKey]) entry.days[dayKey] = {};
  entry.days[dayKey].clockIn = clockIn;
  if (clockOut) entry.days[dayKey].clockOut = clockOut;
  if (breakFromSheet && Number.isFinite(breakHours)) {
    entry.days[dayKey].breakHours = breakHours;
    entry.days[dayKey].breakManual = true;
  } else if (clockIn && clockOut && !entry.days[dayKey].breakManual) {
    // No auto break on Saturday
    entry.days[dayKey].breakHours = dayKey === 'saturday' ? 0 : 0.5;
  }
  recalculateEntry(entry, emp.hourlyRate || 0, settings);
};

const saveTouchedTimesheets = async (touchedMonths) => {
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
};

/**
 * Client payroll workbook → sheet "Timesheets":
 * WEEK N blocks with per-day columns In / Out / In / Out / Break / Total (Fri–Thu).
 */
const importPayrollTimesheets = async ({ rows, matchEmployee, getTs, settings, errors, updates }) => {
  let sheetWeek = null;
  let dayDates = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const c0 = String(row[0] ?? '').trim();
    const weekTitle = c0.match(/WEEK\s*(\d+)\s*WORKLOG/i);
    if (weekTitle) {
      sheetWeek = Number(weekTitle[1]);
      dayDates = [];
      continue;
    }

    // Date row: "", "Week", N, "Date", dFri, …, dThu
    if (
      String(row[1] ?? '').trim().toLowerCase() === 'week' &&
      String(row[3] ?? '').trim().toLowerCase() === 'date'
    ) {
      const wn = Number(row[2]);
      if (Number.isFinite(wn) && wn >= 1 && wn <= 5) sheetWeek = wn;
      dayDates = PAYROLL_DAY_KEYS.map((_, di) => {
        const col = PAYROLL_DAY_START_COL + di * PAYROLL_DAY_STRIDE;
        return parseBiometricDate(row[col]);
      });
      continue;
    }

    // Header row under each week
    if (String(row[1] ?? '').trim().toLowerCase() === 'name') continue;
    // Day banner row: "I.D" | "Month" | ...
    if (String(row[1] ?? '').trim().toLowerCase() === 'month') continue;
    if (/^i\.?d\.?$/i.test(c0)) continue;

    const nameRaw = row[1];
    if (typeof nameRaw !== 'string' || !nameRaw.trim()) continue;
    if (/^(name|total|summary)$/i.test(nameRaw.trim())) continue;

    const emp = matchEmployee(row[0], nameRaw);
    if (!emp) {
      errors.push({ row: i + 1, message: `No employee match for "${nameRaw}"` });
      continue;
    }

    if (sheetWeek == null || !dayDates.some(Boolean)) {
      errors.push({
        row: i + 1,
        message: `Could not find week/date headers above ${nameRaw}`,
      });
      continue;
    }

    for (let di = 0; di < PAYROLL_DAY_KEYS.length; di++) {
      const date = dayDates[di];
      if (!date) continue;

      const base = PAYROLL_DAY_START_COL + di * PAYROLL_DAY_STRIDE;
      const in1 = parseBiometricTime(row[base]);
      const out1 = parseBiometricTime(row[base + 1]);
      const in2 = parseBiometricTime(row[base + 2]);
      const out2 = parseBiometricTime(row[base + 3]);
      // Prefer first In/Out pair; fall back to second (split shift)
      const clockIn = in1 || in2;
      const clockOut = out1 || out2;
      if (!clockIn && !clockOut) continue;

      if (!clockIn) {
        errors.push({
          row: i + 1,
          message: `Missing In for ${emp.fullName} on ${date.toISOString().slice(0, 10)}`,
        });
        continue;
      }

      const breakRaw = row[base + 4];
      let breakHours = null;
      let breakFromSheet = false;
      if (breakRaw !== '' && breakRaw != null && Number.isFinite(Number(breakRaw))) {
        breakHours = Number(breakRaw);
        breakFromSheet = true;
      }

      const placement =
        resolvePayrollPlacement(date, sheetWeek) || resolvePayrollPlacement(date, null);
      if (!placement) {
        errors.push({
          row: i + 1,
          message: `Could not map ${formatLocalDate(date)} to payroll week ${sheetWeek}`,
        });
        continue;
      }

      const { year, month, weekNumber } = placement;
      const dayKey = dayKeyForDate(date) || PAYROLL_DAY_KEYS[di];
      const ts = await getTs(year, month);
      const week = ts.weeks.find((w) => w.weekNumber === weekNumber);
      let entry = week.entries.find((e) => String(e.employee) === String(emp._id));
      if (!entry) {
        entry = { employee: emp._id, days: emptyDays(), weeklyHours: 0, weeklyCost: 0 };
        week.entries.push(entry);
      }

      applyClockToEntry({
        entry,
        dayKey,
        clockIn,
        clockOut,
        breakHours,
        breakFromSheet,
        emp,
        settings,
      });

      updates.push({
        employee: emp.fullName,
        date: formatLocalDate(date),
        clockIn,
        clockOut,
        breakHours: breakFromSheet ? breakHours : undefined,
        year,
        month,
        week: weekNumber,
        day: dayKey,
      });
    }
  }
};

const importBiometricRows = async ({
  rows,
  header,
  matchEmployee,
  getTs,
  settings,
  errors,
  updates,
}) => {
  const { headerRow, colAc, colName, colDate, colIn, colOut } = header;

  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const acNo = colAc != null ? row[colAc] : null;
    const name = colName != null ? row[colName] : null;
    const dateRaw = row[colDate];
    const inRaw = row[colIn];
    const outRaw = colOut != null ? row[colOut] : null;

    if (dateRaw == null || dateRaw === '') continue;
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
      errors.push({
        row: i + 1,
        message: `Could not read Clock In for ${emp.fullName}: "${inRaw}"`,
      });
      continue;
    }
    if (outRaw && !clockOut) {
      errors.push({
        row: i + 1,
        message: `Could not read Clock Out for ${emp.fullName}: "${outRaw}" (In ${clockIn} was saved)`,
      });
    }

    const placement = resolvePayrollPlacement(date, null);
    if (!placement) {
      errors.push({
        row: i + 1,
        message: `Could not map date ${date.toDateString()} to a payroll week`,
      });
      continue;
    }

    const { year, month, weekNumber } = placement;
    const dayKey = dayKeyForDate(date);
    const ts = await getTs(year, month);
    const week = ts.weeks.find((w) => w.weekNumber === weekNumber);
    let entry = week.entries.find((e) => String(e.employee) === String(emp._id));
    if (!entry) {
      entry = { employee: emp._id, days: emptyDays(), weeklyHours: 0, weeklyCost: 0 };
      week.entries.push(entry);
    }

    applyClockToEntry({
      entry,
      dayKey,
      clockIn,
      clockOut,
      breakHours: 0.5,
      breakFromSheet: false,
      emp,
      settings,
    });

    updates.push({
      employee: emp.fullName,
      date: formatLocalDate(date),
      clockIn,
      clockOut,
      year,
      month,
      week: weekNumber,
      day: dayKey,
    });
  }
};

export const importAttendanceExcel = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Excel file required');

  const filePath = req.file.path;
  try {
    const { sheetName, rows } = loadWorkbook(filePath);
    if (!rows.length) throw new AppError('Empty workbook');

    const employees = await Employee.find({ status: 'active' });
    const { matchEmployee } = buildEmployeeMatchers(employees);
    const settings = await getSettings();
    const { touchedMonths, getTs } = makeTimesheetCache(req.user._id);
    const updates = [];
    const errors = [];

    const payrollLayout = isPayrollTimesheetsLayout(rows);
    if (payrollLayout) {
      await importPayrollTimesheets({
        rows,
        matchEmployee,
        getTs,
        settings,
        errors,
        updates,
      });
    } else {
      const header = findHeader(rows);
      if (!header) {
        throw new AppError(
          'Expected either a payroll "Timesheets" sheet (WEEK WORKLOG with In/Out/Break) or biometric columns: AC-No. (or Name), Date, Clock In, Clock Out.'
        );
      }
      await importBiometricRows({
        rows,
        header,
        matchEmployee,
        getTs,
        settings,
        errors,
        updates,
      });
    }

    await saveTouchedTimesheets(touchedMonths);

    res.json({
      message: `Imported ${updates.length} attendance row(s) from sheet "${sheetName}"`,
      source: payrollLayout ? 'payroll-timesheets' : 'biometric',
      sheet: sheetName,
      updated: updates.length,
      monthsTouched: [...touchedMonths.keys()],
      errors,
      sample: updates.slice(0, 10),
    });
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
});
