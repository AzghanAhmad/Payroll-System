import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { getCurrencySymbol } from './currencies';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const formatMoney = (n, currencyCode) => {
  const code =
    currencyCode ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('currency')) ||
    'USD';
  const symbol = getCurrencySymbol(code);
  const amount = Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${symbol}${amount}`;
};

export const formatNumber = (n, digits = 2) =>
  Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const WEEK_DAYS = [
  { key: 'friday', label: 'Fri' },
  { key: 'saturday', label: 'Sat' },
  { key: 'sunday', label: 'Sun' },
  { key: 'monday', label: 'Mon' },
  { key: 'tuesday', label: 'Tue' },
  { key: 'wednesday', label: 'Wed' },
  { key: 'thursday', label: 'Thu' },
];

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Download filename: StaffName_July_2026_Week1_Payslip.pdf */
export const buildPayslipFilename = (payslip, ctx = {}) => {
  const emp = payslip?.employee;
  const staffName =
    (typeof emp === 'object' && emp?.fullName) ||
    payslip?.employeeName ||
    ctx?.employeeName ||
    'Employee';
  const name = String(staffName)
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const y = payslip?.year ?? ctx?.year ?? '';
  const m = Number(payslip?.month ?? ctx?.month ?? 1);
  const monthLabel = MONTH_SHORT[m - 1] || String(m).padStart(2, '0');
  const type = payslip?.type ?? ctx?.periodType ?? 'weekly';
  const w = payslip?.week ?? ctx?.week;
  const period = type === 'weekly' && w ? `Week${w}` : 'Monthly';
  return `${name}_${monthLabel}_${y}_${period}_Payslip.pdf`;
};

/** Same as filename without .pdf — for list display */
export const payslipFileLabel = (payslip, ctx = {}) =>
  buildPayslipFilename(payslip, ctx).replace(/\.pdf$/i, '');

/** Year dropdown options: 10 years back + current + 10 years forward (21 total). */
export const yearOptions = (extraYear) => {
  const current = new Date().getFullYear();
  const years = [];
  for (let y = current - 10; y <= current + 10; y++) years.push(y);
  if (extraYear != null && !years.includes(Number(extraYear))) {
    years.push(Number(extraYear));
    years.sort((a, b) => a - b);
  }
  return years;
};
