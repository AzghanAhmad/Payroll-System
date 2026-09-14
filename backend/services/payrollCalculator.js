import { round2 } from '../utils/helpers.js';

/**
 * Samoa P4 PAYE (matches Ministry filing sheets):
 * tax-free $576 per fortnight, then flat 20% on the remainder.
 * Verified against authority samples (e.g. $640 → $12.80).
 */
export const FORTNIGHTLY_TAX_FREE = 576;
export const PAYE_RATE = 0.2;

/** PAYE on a fortnightly (P4 period) gross amount */
export const calcFortnightlyPaye = (fortnightGross) => {
  const gross = Number(fortnightGross) || 0;
  if (gross <= 0) return 0;
  return round2(Math.max(0, gross - FORTNIGHTLY_TAX_FREE) * PAYE_RATE);
};

export const calcTax = (annualizedGross, brackets = []) => {
  let tax = 0;
  const sorted = [...brackets].sort((a, b) => a.min - b.min);

  for (const bracket of sorted) {
    const upper = bracket.max == null ? Infinity : bracket.max;
    if (annualizedGross > bracket.min) {
      const amount = Math.min(annualizedGross, upper) - bracket.min;
      if (amount > 0) tax += amount * bracket.rate;
    }
  }
  return round2(tax);
};

/**
 * Period PAYE scaled from the fortnightly P4 rule.
 * Weekly (52): free allowance $288. Fortnightly (26): $576.
 */
export const calcPeriodTax = (periodGross, _brackets, periodsPerYear = 52) => {
  const periods = Number(periodsPerYear) > 0 ? Number(periodsPerYear) : 52;
  const freeAllowance = (FORTNIGHTLY_TAX_FREE * 26) / periods;
  const gross = Number(periodGross) || 0;
  if (gross <= 0) return 0;
  return round2(Math.max(0, gross - freeAllowance) * PAYE_RATE);
};

/**
 * Split hours into normal / OT / double based on settings and day flags.
 * @param {object} opts
 * @param {number} opts.totalHours
 * @param {number} opts.doubleHours - hours already flagged as double-time
 * @param {number} opts.normalHoursCap
 */
export const splitHours = ({ totalHours, doubleHours = 0, normalHoursCap = 40 }) => {
  const dbl = round2(Math.min(totalHours, Math.max(0, doubleHours)));
  const remaining = round2(Math.max(0, totalHours - dbl));
  const normal = round2(Math.min(remaining, normalHoursCap));
  const ot = round2(Math.max(0, remaining - normalHoursCap));
  return { normalHours: normal, otHours: ot, doubleHours: dbl };
};

export const calculatePayrollLine = ({
  employee,
  totalHours,
  doubleHours = 0,
  settings,
  iouDeduction = 0,
  periodsPerYear = 52,
}) => {
  const rate = Number(employee.hourlyRate) || 0;
  const { normalHours, otHours, doubleHours: dbl } = splitHours({
    totalHours,
    doubleHours,
    normalHoursCap: settings.normalHoursCap ?? 40,
  });

  const normalPay = round2(normalHours * rate);
  const otPay = round2(otHours * rate * (settings.otMultiplier ?? 1.5));
  const doublePay = round2(dbl * rate * (settings.doubleMultiplier ?? 2));
  const grossPay = round2(normalPay + otPay + doublePay);

  // No earnings → no deductions (matches Excel zero rows)
  if (grossPay <= 0 || totalHours <= 0) {
    return {
      employee: employee._id,
      department: employee.department,
      hourlyRate: rate,
      totalHours: round2(totalHours),
      normalHours,
      otHours,
      doubleHours: dbl,
      normalPay: 0,
      otPay: 0,
      doublePay: 0,
      grossPay: 0,
      employeeNpf: 0,
      employerNpf: 0,
      employeeAcc: 0,
      employerAcc: 0,
      tax: 0,
      teaFund: 0,
      iouDeduction: 0,
      netPay: 0,
      employerCost: 0,
      bank: employee.bank || '',
      accountNumber: employee.accountNumber || '',
      npfNumber: employee.npfNumber || '',
      comments: '',
    };
  }

  const employeeNpf = round2(grossPay * (settings.employeeNpfRate ?? 0.1));
  const employerNpf = round2(grossPay * (settings.employerNpfRate ?? 0.1));
  const employeeAcc = round2(grossPay * (settings.employeeAccRate ?? 0.01));
  const employerAcc = round2(grossPay * (settings.employerAccRate ?? 0.01));
  const teaFund = round2(
    employee.teaFundAmount != null && employee.teaFundAmount !== ''
      ? Number(employee.teaFundAmount)
      : settings.teaFundAmount ?? 0
  );
  const tax = calcPeriodTax(grossPay, settings.taxBrackets || [], periodsPerYear);
  const iou = round2(Math.min(iouDeduction, Math.max(0, grossPay - employeeNpf - employeeAcc - tax - teaFund)));
  const netPay = round2(grossPay - employeeNpf - employeeAcc - tax - teaFund - iou);
  const employerCost = round2(grossPay + employerNpf + employerAcc);

  return {
    employee: employee._id,
    department: employee.department,
    hourlyRate: rate,
    totalHours: round2(totalHours),
    normalHours,
    otHours,
    doubleHours: dbl,
    normalPay,
    otPay,
    doublePay,
    grossPay,
    employeeNpf,
    employerNpf,
    employeeAcc,
    employerAcc,
    tax,
    teaFund,
    iouDeduction: iou,
    netPay,
    employerCost,
    bank: employee.bank || '',
    accountNumber: employee.accountNumber || '',
    npfNumber: employee.npfNumber || '',
    comments: '',
  };
};

export const sumPayrollTotals = (lines) => {
  const totals = {
    normalHours: 0,
    otHours: 0,
    doubleHours: 0,
    grossPay: 0,
    netPay: 0,
    employerCost: 0,
    tax: 0,
    iou: 0,
    teaFund: 0,
  };
  for (const line of lines) {
    totals.normalHours += line.normalHours || 0;
    totals.otHours += line.otHours || 0;
    totals.doubleHours += line.doubleHours || 0;
    totals.grossPay += line.grossPay || 0;
    totals.netPay += line.netPay || 0;
    totals.employerCost += line.employerCost || 0;
    totals.tax += line.tax || 0;
    totals.iou += line.iouDeduction || 0;
    totals.teaFund += line.teaFund || 0;
  }
  Object.keys(totals).forEach((k) => {
    totals[k] = round2(totals[k]);
  });
  return totals;
};
