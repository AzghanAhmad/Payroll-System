/** Friday-start week periods for a calendar month (matches Excel payroll workbook). */

export function getMonthWeek1Start(year, month) {
  const first = new Date(year, month - 1, 1);
  const day = first.getDay(); // 0 Sun .. 5 Fri
  const offset = (day - 5 + 7) % 7; // back to Friday on/before the 1st
  const start = new Date(year, month - 1, 1 - offset);
  start.setHours(0, 0, 0, 0);
  return start;
}

export function getWeekPeriod(year, month, weekNumber) {
  const week1 = getMonthWeek1Start(year, month);
  const start = new Date(week1);
  start.setDate(week1.getDate() + (Number(weekNumber) - 1) * 7);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export function formatShortDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatFullDate(d) {
  if (!d) return '';
  const dt = d instanceof Date ? d : new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

export function getDayDate(year, month, weekNumber, dayIndex) {
  const { start } = getWeekPeriod(year, month, weekNumber);
  const d = new Date(start);
  d.setDate(start.getDate() + dayIndex);
  return d;
}

/** Split weekly hours into Normal / OT (T½) / Double (T2) */
export function splitWeekHours(totalHours, doubleHours = 0, cap = 40) {
  const dbl = Math.min(Math.max(0, Number(doubleHours) || 0), Number(totalHours) || 0);
  const remaining = Math.max(0, (Number(totalHours) || 0) - dbl);
  const normal = Math.min(remaining, cap);
  const ot = Math.max(0, remaining - cap);
  const r2 = (n) => Math.round(n * 100) / 100;
  return { normalHours: r2(normal), otHours: r2(ot), doubleHours: r2(dbl), totalHours: r2(totalHours) };
}

export function calcWeekCosting(entry, settings = {}) {
  const rate = Number(entry.employee?.hourlyRate ?? entry.hourlyRate ?? 0);
  const cap = settings.normalHoursCap ?? 40;
  const otMult = settings.otMultiplier ?? 1.5;
  const dblMult = settings.doubleMultiplier ?? 2;
  const npfRate = settings.employerNpfRate ?? 0.1;
  const accRate = settings.employerAccRate ?? 0.01;

  let doubleHours = 0;
  const days = entry.days || {};
  const rule = settings.doubleTimeRule || 'sunday';
  for (const key of Object.keys(days)) {
    const d = days[key];
    const isDouble =
      rule === 'none'
        ? false
        : rule === 'sunday'
          ? key === 'sunday'
          : Boolean(d?.isDoubleTime);
    if (isDouble) doubleHours += Number(d.workingHours) || 0;
  }

  const totalHours = Number(entry.weeklyHours) || 0;
  const split = splitWeekHours(totalHours, doubleHours, cap);
  const r2 = (n) => Math.round(n * 100) / 100;

  const normalPay = r2(split.normalHours * rate);
  const otPay = r2(split.otHours * rate * otMult);
  const doublePay = r2(split.doubleHours * rate * dblMult);
  const grossPay = r2(normalPay + otPay + doublePay);
  const employerNpf = r2(grossPay * npfRate);
  const employerAcc = r2(grossPay * accRate);
  const employerCost = r2(grossPay + employerNpf + employerAcc);

  return {
    ...split,
    hourlyRate: rate,
    normalPay,
    otPay,
    doublePay,
    grossPay,
    employerNpf,
    employerAcc,
    employerCost,
    notes: entry.weeklyNotes || entry.notes || '',
  };
}
