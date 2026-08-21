/** Leave cycle helpers — balances reset on hire-date anniversary. */

export const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const addYears = (d, years) => {
  const x = new Date(d);
  x.setFullYear(x.getFullYear() + years);
  return x;
};

export const daysBetween = (a, b) => {
  const ms = startOfDay(b) - startOfDay(a);
  return Math.round(ms / (1000 * 60 * 60 * 24));
};

/** Most recent hire-anniversary on or before asOf */
export const getLeaveCycle = (hireDate, asOf = new Date()) => {
  if (!hireDate) {
    return {
      hireDate: null,
      currentCycleStart: null,
      nextAnniversary: null,
      daysToReset: 0,
      status: 'Hire date required',
    };
  }

  const hire = startOfDay(hireDate);
  const asOfDay = startOfDay(asOf);
  let anniversary = new Date(asOfDay.getFullYear(), hire.getMonth(), hire.getDate());
  anniversary = startOfDay(anniversary);

  if (anniversary > asOfDay) {
    anniversary = addYears(anniversary, -1);
  }
  // If hire is after computed anniversary year edge cases
  if (anniversary < hire) anniversary = hire;

  const next = addYears(anniversary, 1);
  return {
    hireDate: hire,
    currentCycleStart: anniversary,
    nextAnniversary: next,
    daysToReset: Math.max(0, daysBetween(asOfDay, next)),
    status: 'Active leave cycle',
  };
};

/** Count Mon–Fri workdays inclusive between two dates (optional holiday Set of YYYY-MM-DD). */
export const countWorkdays = (startDate, endDate, holidaySet = new Set()) => {
  const start = startOfDay(startDate);
  const end = startOfDay(endDate);
  if (end < start) return 0;

  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getDay(); // 0 Sun .. 6 Sat
    const key = cur.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(key)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

export const DEFAULT_LEAVE_ENTITLEMENTS = {
  annual: 10,
  sick: 10,
  maternity: 20,
  paternity: 3,
  bereavement: 3,
};

/** Maternity = female only; paternity = male only. Unknown gender blocks both. */
export const isLeaveTypeAllowedForGender = (leaveType, gender) => {
  const g = String(gender || '').toLowerCase();
  if (leaveType === 'maternity') return g === 'female';
  if (leaveType === 'paternity') return g === 'male';
  return true;
};

export const assertLeaveTypeForGender = (leaveType, gender) => {
  if (isLeaveTypeAllowedForGender(leaveType, gender)) return;
  const g = String(gender || '').toLowerCase();
  if (leaveType === 'maternity') {
    throw new Error(
      g === 'male'
        ? 'Maternity leave is only available to female employees'
        : 'Set the employee gender to Female before recording maternity leave'
    );
  }
  if (leaveType === 'paternity') {
    throw new Error(
      g === 'female'
        ? 'Paternity leave is only available to male employees'
        : 'Set the employee gender to Male before recording paternity leave'
    );
  }
};
