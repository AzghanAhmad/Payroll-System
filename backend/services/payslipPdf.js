import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { uploadRoot } from '../middleware/upload.js';
import { getCurrencySymbol } from '../utils/currencies.js';

const money = (n, symbol) => `${symbol}${Number(n || 0).toFixed(2)}`;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

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

  // Remove stale file (old QR / wrong name) before regenerating
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

export const generatePayslipPdf = async (payslipId) => {
  const payslip = await Payslip.findById(payslipId).populate(
    'employee',
    'employeeId fullName email position bank accountNumber npfNumber department'
  );
  if (!payslip) throw new Error('Payslip not found');

  const settings = (await Settings.findOne()) || {};
  const symbol = getCurrencySymbol(settings.currency);
  const dir = path.join(uploadRoot, 'exports');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const filename = buildPayslipFilename(payslip);
  const filePath = path.join(dir, filename);

  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const emp = payslip.employee || {};
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-US') : '—');

  doc.fillColor('#2563EB').fontSize(20).text(settings.companyName || 'Payroll Company');
  doc.fillColor('#64748B').fontSize(9).text(settings.companyAddress || '');
  doc.moveDown(0.5);
  doc.fillColor('#0F172A').fontSize(16).text('PAYSLIP', { align: 'right' });
  doc.fontSize(9).fillColor('#64748B').text(`Week ${payslip.week || '—'} · ${payslip.periodLabel || ''}`, { align: 'right' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').stroke();
  doc.moveDown();

  doc.fillColor('#0F172A').fontSize(12).text(`Employee: ${emp.fullName || ''}`);
  doc.fontSize(9).fillColor('#475569');
  doc.text(`Position: ${payslip.position || emp.position || '—'}   |   Department: ${payslip.departmentName || '—'}`);
  doc.text(`Period Start: ${fmtDate(payslip.periodStart)}   |   Period End: ${fmtDate(payslip.periodEnd)}`);
  doc.text(`Pay Day: ${fmtDate(payslip.payDay)}   |   Hourly Rate: ${money(payslip.hourlyRate, symbol)}`);
  doc.text(`Bank: ${payslip.bank || emp.bank || '—'}   |   Account: ${payslip.accountNumber || emp.accountNumber || '—'}   |   NPF: ${payslip.npfNumber || emp.npfNumber || '—'}`);
  doc.moveDown();

  // Payments
  doc.fontSize(11).fillColor('#2563EB').text('Payments');
  doc.moveDown(0.3);
  const payY = doc.y;
  doc.fontSize(9).fillColor('#64748B');
  doc.text('Description', 50, payY);
  doc.text('Hours', 220, payY);
  doc.text('Rate', 300, payY);
  doc.text('Value', 400, payY, { width: 100, align: 'right' });
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E2E8F0').stroke();
  doc.moveDown(0.3);

  const payRow = (label, hours, rate, value) => {
    const y = doc.y;
    doc.fillColor('#334155').text(label, 50, y);
    doc.text(Number(hours || 0).toFixed(2), 220, y);
    doc.text(rate != null ? money(rate, symbol) : '—', 300, y);
    doc.text(money(value, symbol), 400, y, { width: 100, align: 'right' });
    doc.moveDown(0.35);
  };

  payRow('Normal Time', payslip.normalHours, payslip.hourlyRate, payslip.normalPay);
  payRow('Overtime (T 1/2)', payslip.otHours, payslip.otRate || payslip.hourlyRate * 1.5, payslip.otPay);
  payRow('Double Time (T2)', payslip.doubleHours, payslip.doubleRate || payslip.hourlyRate * 2, payslip.doublePay);
  doc.font('Helvetica-Bold');
  payRow('Gross Pay', '', null, payslip.grossPay);
  doc.font('Helvetica');
  doc.moveDown(0.5);

  // Deductions
  doc.fontSize(11).fillColor('#2563EB').text('Deductions');
  doc.moveDown(0.3);
  const dedRow = (label, value) => {
    const y = doc.y;
    doc.fontSize(9).fillColor('#334155').text(label, 50, y);
    doc.text(money(value, symbol), 400, y, { width: 100, align: 'right' });
    doc.moveDown(0.35);
  };
  dedRow('NPF / SNPF (10%)', payslip.employeeNpf);
  dedRow('ACC (1%)', payslip.employeeAcc);
  dedRow('Tax / PAYE', payslip.tax);
  dedRow('IOU', payslip.iouDeduction);
  dedRow('Tea Fund', payslip.teaFund);
  doc.font('Helvetica-Bold');
  dedRow('Total Deductions', payslip.totalDeductions);
  doc.moveDown(0.3);
  doc.fillColor('#2563EB').fontSize(12).text(`NET PAY  ${money(payslip.netPay, symbol)}`, { align: 'right' });
  doc.font('Helvetica');
  doc.moveDown();

  // IOU note
  doc.fontSize(11).fillColor('#2563EB').text('IOU Note');
  doc.fontSize(9).fillColor('#475569');
  doc.text(
    `Amount: ${money(payslip.iouAmount, symbol)}   |   Paid: ${money(payslip.iouPaid, symbol)}   |   Balance: ${money(payslip.loanBalance, symbol)}   |   Payments: ${payslip.iouPaymentsCount || 0}`
  );
  if (payslip.comments) {
    doc.moveDown(0.3);
    doc.text(`Comments: ${payslip.comments}`);
  }

  try {
    const company = settings.companyName || 'Payroll';
    const period =
      payslip.periodLabel ||
      (payslip.type === 'weekly' && payslip.week
        ? `Week ${payslip.week}`
        : `${payslip.month}/${payslip.year}`);
    // Plain text so phone scanners show a readable summary (not raw JSON / id)
    const qrText = [
      `${company} — Official Payslip`,
      `Employee: ${emp.fullName || emp.employeeId || '—'}`,
      emp.employeeId ? `Staff ID: ${emp.employeeId}` : null,
      `Period: ${period}`,
      `Pay Day: ${fmtDate(payslip.payDay)}`,
      `Gross: ${money(payslip.grossPay, symbol)}`,
      `Net Pay: ${money(payslip.netPay, symbol)}`,
      'Digitally generated & verified',
    ]
      .filter(Boolean)
      .join('\n');

    const qrData = await QRCode.toDataURL(qrText, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 200,
    });
    const qrBuf = Buffer.from(qrData.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(qrBuf, 50, 700, { width: 70 });
  } catch {
    // optional
  }

  doc.fontSize(8).fillColor('#94A3B8').text('Scan for payslip summary', 140, 720);
  doc.text('Digitally generated payslip', 140, 732);
  if (settings.digitalSignature) {
    doc.text(`Authorized: ${settings.digitalSignature}`, 140, 744);
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/uploads/exports/${filename}`;
};
