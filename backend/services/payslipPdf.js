import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { uploadRoot } from '../middleware/upload.js';
import { getCurrencySymbol } from '../utils/currencies.js';
import { getWeekPeriod } from '../utils/weekPeriod.js';

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n, symbol) => `${symbol}${Number(n || 0).toFixed(2)}`;
const hrs = (n) => Number(n || 0).toFixed(2);

/** Calendar date matching payroll week math (no TZ shift on end-of-day timestamps). */
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
};

const fmtRange = (start, end) => `${fmtDate(start)} – ${fmtDate(end)}`;

/** Prefer recomputed Fri–Thu week bounds so Period / Pay Day stay correct. */
const resolvePeriodDates = (payslip) => {
  if (payslip.type === 'weekly' && payslip.year && payslip.month && payslip.week) {
    const { start, end } = getWeekPeriod(payslip.year, payslip.month, payslip.week);
    return { start, end, payDay: end };
  }
  return {
    start: payslip.periodStart,
    end: payslip.periodEnd,
    payDay: payslip.payDay || payslip.periodEnd,
  };
};
export const buildPayslipFilename = (payslip, ctx = {}) => {
  const emp = payslip.employee || {};
  const staffName =
    emp.fullName ||
    payslip.employeeName ||
    ctx.employeeName ||
    'Employee';
  const name = String(staffName)
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const y = payslip.year ?? ctx.year ?? '';
  const m = Number(payslip.month ?? ctx.month ?? 1);
  const monthLabel = MONTH_SHORT[m - 1] || String(m).padStart(2, '0');
  const type = payslip.type ?? ctx.periodType ?? 'weekly';
  const w = payslip.week ?? ctx.week;
  const period = type === 'weekly' && w ? `Week${w}` : 'Monthly';
  return `${name}_${monthLabel}_${y}_${period}_Payslip.pdf`;
};

export const buildPayslipExcelFilename = (payslip, ctx = {}) =>
  buildPayslipFilename(payslip, ctx).replace(/\.pdf$/i, '.xlsx');

/** Ensure PDF exists on disk with current naming + content (always regenerates). */
export const resolvePayslipPdfPath = async (payslipIdOrDoc) => {
  let payslip =
    typeof payslipIdOrDoc === 'object' && payslipIdOrDoc?._id
      ? payslipIdOrDoc
      : await Payslip.findById(payslipIdOrDoc).populate('employee', 'employeeId fullName');

  if (!payslip) throw new Error('Payslip not found');

  if (!payslip.employee?.fullName) {
    payslip = await Payslip.findById(payslip._id).populate('employee', 'employeeId fullName');
  }

  const dir = path.join(uploadRoot, 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const expected = buildPayslipFilename(payslip);
  const currentBase = payslip.pdfPath ? path.basename(payslip.pdfPath) : '';
  const currentPath = currentBase ? path.join(dir, currentBase) : '';

  if (currentPath && fs.existsSync(currentPath)) {
    try {
      fs.unlinkSync(currentPath);
    } catch {
      /* ignore */
    }
  }
  const expectedPath = path.join(dir, expected);
  if (currentBase !== expected && fs.existsSync(expectedPath)) {
    try {
      fs.unlinkSync(expectedPath);
    } catch {
      /* ignore */
    }
  }

  const rel = await generatePayslipPdf(payslip._id);
  payslip.pdfPath = rel;
  await payslip.save();
  return path.join(dir, path.basename(rel));
};

const at = (doc, str, x, y) => {
  doc.text(String(str ?? ''), x, y, { lineBreak: false });
};

const rightAt = (doc, str, rightEdge, y) => {
  const s = String(str ?? '');
  doc.text(s, rightEdge - doc.widthOfString(s), y, { lineBreak: false });
};

const hline = (doc, x1, x2, y, color = '#CBD5E1') => {
  doc
    .strokeColor(color)
    .lineWidth(0.8)
    .moveTo(x1, y)
    .lineTo(x2, y)
    .stroke();
};

/**
 * Client-preferred payslip look: clean header, pipe meta rows,
 * Payments table + Deductions list, blue NET PAY, IOU note.
 */
export const generatePayslipPdf = async (payslipId) => {
  const payslip = await Payslip.findById(payslipId).populate(
    'employee',
    'employeeId fullName email position bank accountNumber npfNumber department'
  );
  if (!payslip) throw new Error('Payslip not found');

  const settings = (await Settings.findOne()) || {};
  const symbol = getCurrencySymbol(settings.currency) || '$';
  const dir = path.join(uploadRoot, 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = buildPayslipFilename(payslip);
  const filePath = path.join(dir, filename);

  const doc = new PDFDocument({ size: 'A4', margin: 48, autoFirstPage: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const emp = payslip.employee || {};
  const left = 48;
  const right = 547;

  const company = settings.companyName || 'Alpha Cafe and Chemist';
  const location = (settings.companyAddress || '').split(/[\n,]/)[0]?.trim() || '';

  const npfPct = Math.round((Number(settings.employeeNpfRate ?? 0.1) || 0.1) * 100);
  const accPct = Math.round((Number(settings.employeeAccRate ?? 0.01) || 0.01) * 100);
  const otRate = payslip.otRate || (payslip.hourlyRate || 0) * (settings.otMultiplier || 1.5);
  const dblRate = payslip.doubleRate || (payslip.hourlyRate || 0) * (settings.doubleMultiplier || 2);

  const { start: periodStart, end: periodEnd, payDay } = resolvePeriodDates(payslip);
  const weekLine =
    payslip.type === 'weekly' && payslip.week
      ? `Week ${payslip.week} · ${fmtRange(periodStart, periodEnd)}`
      : fmtRange(periodStart, periodEnd);

  // —— Header ——
  doc.fillColor('#2563EB').fontSize(20).font('Helvetica-Bold');
  at(doc, company, left, 48);

  doc.fillColor('#64748B').fontSize(10).font('Helvetica');
  if (location) at(doc, location, left, 72);

  doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold');
  rightAt(doc, 'PAYSLIP', right, 48);

  doc.fillColor('#64748B').fontSize(9).font('Helvetica');
  rightAt(doc, weekLine, right, 74);

  hline(doc, left, right, 96, '#E2E8F0');

  // —— Employee block ——
  let y = 112;
  doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold');
  at(doc, `Employee: ${emp.fullName || '—'}`, left, y);
  y += 22;

  const metaLine = (txt) => {
    doc.fillColor('#475569').fontSize(9).font('Helvetica');
    at(doc, txt, left, y);
    y += 14;
  };

  metaLine(
    `Position: ${payslip.position || emp.position || '—'} | Department: ${payslip.departmentName || '—'}`
  );
  metaLine(`Period Start: ${fmtDate(periodStart)} | Period End: ${fmtDate(periodEnd)}`);
  metaLine(
    `Pay Day: ${fmtDate(payDay)} | Hourly Rate: ${money(payslip.hourlyRate, symbol)}`
  );
  metaLine(
    `Bank: ${payslip.bank || emp.bank || '—'} | Account: ${payslip.accountNumber || emp.accountNumber || '—'} | NPF: ${payslip.npfNumber || emp.npfNumber || '—'}`
  );
  y += 10;

  // —— Payments, then Deductions on the next section below ——
  const payL = left;
  const hoursR = left + 220;
  const rateR = left + 320;
  const valueR = right;
  const rowH = 16;

  const payRows = [
    ['Normal Time', payslip.normalHours, payslip.hourlyRate, payslip.normalPay],
    ['Overtime (T 1/2)', payslip.otHours, otRate, payslip.otPay],
    ['Double Time (T2)', payslip.doubleHours, dblRate, payslip.doublePay],
  ];

  const dedRows = [
    [`NPF / SNPF (${npfPct}%)`, payslip.employeeNpf],
    [`ACC (${accPct}%)`, payslip.employeeAcc],
    ['Tax / PAYE', payslip.tax],
    ['IOU', payslip.iouDeduction],
    ['Tea Fund', payslip.teaFund],
  ];

  doc.fillColor('#2563EB').fontSize(12).font('Helvetica-Bold');
  at(doc, 'Payments', payL, y);
  y += 18;

  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica');
  at(doc, 'Description', payL, y);
  rightAt(doc, 'Hours', hoursR, y);
  rightAt(doc, 'Rate', rateR, y);
  rightAt(doc, 'Value', valueR, y);
  y += 12;
  hline(doc, payL, valueR, y, '#E2E8F0');
  y += 8;

  doc.fillColor('#0F172A').fontSize(9).font('Helvetica');
  payRows.forEach(([label, hours, rate, val]) => {
    at(doc, label, payL, y);
    rightAt(doc, hrs(hours), hoursR, y);
    rightAt(doc, money(rate, symbol), rateR, y);
    rightAt(doc, money(val, symbol), valueR, y);
    y += rowH;
  });

  y += 4;
  hline(doc, payL, valueR, y, '#E2E8F0');
  y += 8;
  doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold');
  at(doc, 'Gross Pay', payL, y);
  rightAt(doc, money(payslip.grossPay, symbol), valueR, y);
  y += 28;

  doc.fillColor('#2563EB').fontSize(12).font('Helvetica-Bold');
  at(doc, 'Deductions', payL, y);
  y += 18;

  doc.fillColor('#94A3B8').fontSize(8).font('Helvetica');
  at(doc, 'Description', payL, y);
  rightAt(doc, 'Value', valueR, y);
  y += 12;
  hline(doc, payL, valueR, y, '#E2E8F0');
  y += 8;

  doc.fillColor('#0F172A').fontSize(9).font('Helvetica');
  dedRows.forEach(([label, val]) => {
    at(doc, label, payL, y);
    rightAt(doc, money(val, symbol), valueR, y);
    y += rowH;
  });

  y += 4;
  hline(doc, payL, valueR, y, '#E2E8F0');
  y += 8;
  doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold');
  at(doc, 'Total Deductions', payL, y);
  rightAt(doc, money(payslip.totalDeductions, symbol), valueR, y);
  y += 32;

  // —— NET PAY ——
  doc.fillColor('#2563EB').fontSize(16).font('Helvetica-Bold');
  rightAt(doc, `NET PAY ${money(payslip.netPay, symbol)}`, right, y);
  y += 36;

  // —— IOU Note (bottom-right) ——
  doc.fillColor('#2563EB').fontSize(10).font('Helvetica-Bold');
  rightAt(doc, 'IOU Note', right, y);
  y += 16;
  doc.fillColor('#64748B').fontSize(8).font('Helvetica');
  const iou1 = `Amount: ${money(payslip.iouAmount, symbol)} | Paid: ${money(payslip.iouPaid, symbol)} |`;
  const iou2 = `Balance: ${money(payslip.loanBalance, symbol)} | Payments: ${payslip.iouPaymentsCount || 0}`;
  rightAt(doc, iou1, right, y);
  rightAt(doc, iou2, right, y + 12);

  if (payslip.comments) {
    doc.fillColor('#475569').fontSize(8).font('Helvetica');
    at(doc, `Note: ${payslip.comments}`, left, y);
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/uploads/exports/${filename}`;
};
