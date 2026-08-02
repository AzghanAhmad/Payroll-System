import { getMonthWeek1Start, getWeekPeriod, formatPeriodLabel } from '../utils/weekPeriod.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const pad2 = (n) => String(n).padStart(2, '0');

const fmtShort = (d) => {
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yy = String(d.getFullYear()).slice(-2);
  return `${dd}/${mm}/${yy}`;
};

/**
 * Generate Friday–Thursday pay periods for a calendar year.
 * Payday = Friday after the Thursday period end.
 * Assigned payroll month = month of the payday.
 */
export const generatePayrollSchedule = (year) => {
  const y = Number(year);
  const rows = [];
  // Start from week containing Jan 1 (Friday on/before Jan 1)
  let weekStart = getMonthWeek1Start(y, 1);
  const yearEnd = new Date(y, 11, 31, 23, 59, 59, 999);

  // Also include late Dec of previous year if week spans into Jan
  // Walk weeks until payday is past year end + one week buffer for Jan next year
  const limit = new Date(y + 1, 0, 7);

  while (weekStart <= limit) {
    const periodStart = new Date(weekStart);
    const periodEnd = new Date(weekStart);
    periodEnd.setDate(periodStart.getDate() + 6);
    periodEnd.setHours(23, 59, 59, 999);

    const payday = new Date(periodEnd);
    payday.setDate(periodEnd.getDate() + 1);
    payday.setHours(0, 0, 0, 0);

    // Include rows whose payday falls in this year, or period overlaps year
    if (payday.getFullYear() === y || (periodStart.getFullYear() === y || periodEnd.getFullYear() === y)) {
      if (payday.getFullYear() === y || payday.getFullYear() === y + 1 && periodStart.getFullYear() === y) {
        const assignMonth = payday.getMonth();
        const assignYear = payday.getFullYear();
        rows.push({
          payday,
          periodStart,
          periodEnd,
          payCycle: `${fmtShort(periodStart)} to ${fmtShort(periodEnd)}`,
          periodLabel: formatPeriodLabel(periodStart, periodEnd),
          assignedPayrollMonth: `${MONTH_NAMES[assignMonth]} ${assignYear}`,
          assignedYear: assignYear,
          assignedMonth: assignMonth + 1,
        });
      }
    }

    weekStart = new Date(weekStart);
    weekStart.setDate(weekStart.getDate() + 7);
    if (rows.length > 60) break;
  }

  // Deduplicate by payday ISO date and filter to paydays in year (plus last Dec→Jan if needed matching Excel)
  const seen = new Set();
  return rows.filter((r) => {
    const key = r.payday.toISOString().slice(0, 10);
    if (seen.has(key)) return false;
    seen.add(key);
    // Match Excel: include all paydays whose assigned year is `year`, plus Jan next year if period started in Dec of year
    return r.assignedYear === y || (r.assignedYear === y + 1 && r.periodStart.getFullYear() === y);
  });
};

export const countPayrollWeeksInMonth = (year, month) => {
  const schedule = generatePayrollSchedule(year);
  return schedule.filter((r) => r.assignedYear === year && r.assignedMonth === month).length;
};

export const nextMonthFileName = (year, month, companyName = 'Payroll') => {
  const names = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const safe = String(companyName || 'Payroll').replace(/[^\w-]+/g, '');
  return `${pad2(month)}${names[month - 1]}${year}_PAYROLL-${safe}`;
};

export { MONTH_NAMES, getWeekPeriod };
