import { WEEK_DAYS, calcDailyHours, round2 } from '../utils/helpers.js';

/** Apply current double-time rule to a day (clears sticky flags when rule changes). */
export const resolveDoubleTime = (dayKey, currentFlag, settings = {}) => {
  const rule = settings.doubleTimeRule || 'sunday';
  if (rule === 'none') return false;
  if (rule === 'sunday') return dayKey === 'sunday';
  // manual / public_holiday: keep explicit day flags
  return Boolean(currentFlag);
};

export const DEFAULT_BREAK_HOURS = 0.5;

export const recalculateEntry = (entry, hourlyRate = 0, settings = {}) => {
  let weeklyHours = 0;
  let weeklyCost = 0;
  let doubleHours = 0;

  for (const day of WEEK_DAYS) {
    const d = entry.days[day] || {};
    // Auto-deduct 30 min break when both clocks are set, unless manually overridden
    if (d.clockIn && d.clockOut && !d.breakManual) {
      d.breakHours = DEFAULT_BREAK_HOURS;
    }
    const hours = calcDailyHours(d.clockIn, d.clockOut, d.breakHours);
    d.workingHours = hours;
    d.dailyCost = round2(hours * hourlyRate);
    const isDouble = resolveDoubleTime(day, d.isDoubleTime, settings);
    d.isDoubleTime = isDouble;
    if (isDouble) doubleHours += hours;
    weeklyHours += hours;
    weeklyCost += d.dailyCost;
    entry.days[day] = d;
  }

  entry.weeklyHours = round2(weeklyHours);
  entry.weeklyCost = round2(weeklyCost);
  entry._doubleHours = round2(doubleHours);
  return entry;
};

export const emptyDay = () => ({
  clockIn: '',
  clockOut: '',
  breakHours: 0,
  breakManual: false,
  workingHours: 0,
  dailyCost: 0,
  remarks: '',
  isDoubleTime: false,
});

export const emptyDays = () =>
  Object.fromEntries(WEEK_DAYS.map((d) => [d, emptyDay()]));

export const ensureTimesheetWeeks = (timesheet) => {
  if (!timesheet.weeks || timesheet.weeks.length === 0) {
    timesheet.weeks = [1, 2, 3, 4, 5].map((weekNumber) => ({
      weekNumber,
      entries: [],
    }));
  }
  return timesheet;
};
