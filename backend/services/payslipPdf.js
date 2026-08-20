import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { uploadRoot } from '../middleware/upload.js';
import { getCurrencySymbol } from '../utils/currencies.js';

const money = (n, symbol) => `${symbol} ${Number(n || 0).toFixed(2)}`;
const moneyOrDash = (n, symbol) =>
  n == null || Number(n) === 0 ? '$ -' : money(n, symbol);

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
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

const resolveLogoPath = (settings) => {
  if (!settings?.logo) return null;
  const base = path.basename(String(settings.logo));
  const candidates = [
    path.join(uploadRoot, 'logos', base),
    path.join(uploadRoot, base),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
};

const fmtUsDate = (d) => (d ? new Date(d).toLocaleDateString('en-US') : '—');
const fmtPayDay = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';

/**
 * Alpha Group payslip layout (ss2).
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

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const emp = payslip.employee || {};
  const left = 40;
  const pageW = 515;
  const now = new Date();

  // —— Header: logo + company contact ——
  const logoPath = resolveLogoPath(settings);
  let headerY = 40;
  if (logoPath) {
    try {
      doc.image(logoPath, left, headerY, { fit: [120, 48] });
    } catch {
      doc.fillColor('#1D4ED8').fontSize(16).font('Helvetica-Bold').text(settings.companyName || 'ALPHA GROUP', left, headerY);
    }
  } else {
    doc.fillColor('#1D4ED8').fontSize(16).font('Helvetica-Bold').text(settings.companyName || 'ALPHA GROUP', left, headerY);
  }

  doc.fillColor('#334155').fontSize(9).font('Helvetica');
  const contactX = 200;
  const address = settings.companyAddress || '';
  const phone = settings.companyPhone || '';
  const email = settings.companyEmail || '';
  doc.text(address, contactX, headerY + 4, { width: 340 });
  const contactLine = [
    phone ? `T: ${phone}` : null,
    email ? `E: ${email}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  if (contactLine) doc.text(contactLine, contactX, headerY + 18, { width: 340 });

  // PAYSLIP title
  doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold').text('PAYSLIP', left, 100);

  // —— Employee / period grid ——
  const metaY = 132;
  doc.fontSize(10).font('Helvetica');
  const label = (t, x, y) => {
    doc.fillColor('#64748B').font('Helvetica').text(t, x, y);
  };
  const value = (t, x, y, opts = {}) => {
    doc.fillColor('#0F172A').font('Helvetica-Bold').text(t || '—', x, y, opts);
  };

  label('Employee:', left, metaY);
  value(emp.fullName || '', left + 70, metaY);
  label('Period:', 320, metaY);
  value(`${fmtUsDate(payslip.periodStart)} to ${fmtUsDate(payslip.periodEnd)}`, 365, metaY, { width: 190 });

  label('Position:', left, metaY + 16);
  value(payslip.position || emp.position || '', left + 70, metaY + 16);
  label('Month:', 320, metaY + 16);
  value(MONTH_NAMES[(payslip.month || 1) - 1] || '', 365, metaY + 16);
  label('Date:', 430, metaY + 16);
  value(fmtUsDate(now), 460, metaY + 16, { width: 90 });

  label('Department:', left, metaY + 32);
  value(payslip.departmentName || '', left + 70, metaY + 32);
  label('Pay Day:', 320, metaY + 32);
  value(fmtPayDay(payslip.payDay), 365, metaY + 32, { width: 100 });
  label('Week:', 430, metaY + 32);
  value(payslip.type === 'weekly' ? String(payslip.week || '—') : '—', 460, metaY + 32);
  label('Time:', 430, metaY + 48);
  value(
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
    460,
    metaY + 48,
    { width: 90 }
  );

  // —— Payments | Deductions table ——
  const tableTop = metaY + 72;
  const midX = 300;
  const rightEdge = left + pageW;

  // Header bar
  doc.rect(left, tableTop, midX - left - 8, 18).stroke('#CBD5E1');
  doc.rect(midX, tableTop, rightEdge - midX, 18).stroke('#CBD5E1');
  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');
  doc.text('Payments', left + 4, tableTop + 5);
  doc.text('Hours', left + 100, tableTop + 5, { width: 50, align: 'right' });
  doc.text('Rate', left + 155, tableTop + 5, { width: 55, align: 'right' });
  doc.text('Value', left + 215, tableTop + 5, { width: 70, align: 'right' });
  doc.text('Deductions', midX + 4, tableTop + 5);
  doc.text('Value', midX + 120, tableTop + 5, { width: 90, align: 'right' });

  const payRows = [
    ['Normal Time', payslip.normalHours, payslip.hourlyRate, payslip.normalPay],
    ['Overtime', payslip.otHours, payslip.otRate || (payslip.hourlyRate || 0) * 1.5, payslip.otPay],
    ['Double Time', payslip.doubleHours, payslip.doubleRate || (payslip.hourlyRate || 0) * 2, payslip.doublePay],
    ['IOU', null, null, null],
    ['Tea Fund', null, null, null],
  ];
  const dedRows = [
    ['SNPF', payslip.employeeNpf],
    ['ACC', payslip.employeeAcc],
    ['PAYE', payslip.tax],
    ['IOU', payslip.iouDeduction],
    ['TEA FUND', payslip.teaFund],
  ];

  let y = tableTop + 18;
  doc.font('Helvetica').fontSize(9);
  for (let i = 0; i < 5; i++) {
    doc.rect(left, y, midX - left - 8, 18).stroke('#E2E8F0');
    doc.rect(midX, y, rightEdge - midX, 18).stroke('#E2E8F0');
    const [pLabel, hours, rate, val] = payRows[i];
    const [dLabel, dVal] = dedRows[i];
    doc.fillColor('#334155');
    doc.text(pLabel, left + 4, y + 5);
    doc.text(hours != null ? Number(hours).toFixed(2) : '', left + 100, y + 5, { width: 50, align: 'right' });
    doc.text(rate != null && Number(rate) ? money(rate, symbol) : rate === 0 || hours != null ? moneyOrDash(rate, symbol) : '', left + 155, y + 5, {
      width: 55,
      align: 'right',
    });
    doc.text(val != null && pLabel !== 'IOU' && pLabel !== 'Tea Fund' ? money(val, symbol) : val ? money(val, symbol) : '', left + 215, y + 5, {
      width: 70,
      align: 'right',
    });
    doc.text(dLabel, midX + 4, y + 5);
    doc.text(money(dVal, symbol), midX + 120, y + 5, { width: 90, align: 'right' });
    y += 18;
  }

  // Gross / Total deductions
  doc.rect(left, y, midX - left - 8, 20).fillAndStroke('#FFEDD5', '#FDBA74');
  doc.rect(midX, y, rightEdge - midX, 20).fillAndStroke('#FFEDD5', '#FDBA74');
  doc.fillColor('#9A3412').font('Helvetica-Bold').fontSize(9);
  doc.text('Gross Pay', left + 4, y + 6);
  doc.text(money(payslip.grossPay, symbol), left + 215, y + 6, { width: 70, align: 'right' });
  doc.text('Total Deductions', midX + 4, y + 6);
  doc.text(money(payslip.totalDeductions, symbol), midX + 120, y + 6, { width: 90, align: 'right' });
  y += 28;

  // NET PAY banner
  doc.rect(left, y, pageW, 28).fill('#1E40AF');
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold');
  doc.text('NET PAY', left + 12, y + 8);
  doc.text(money(payslip.netPay, symbol), left + 300, y + 8, { width: 200, align: 'right' });
  y += 40;

  // IOU box + Note
  doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold').text('IOU', left, y);
  y += 14;
  doc.fontSize(9).font('Helvetica');
  const iouBoxW = 200;
  const iouRows = [
    ['Amount', money(payslip.iouAmount, symbol)],
    ['Paid', money(payslip.iouPaid, symbol)],
    ['Balance', money(payslip.loanBalance, symbol)],
  ];
  iouRows.forEach(([lab, val], i) => {
    const iy = y + i * 16;
    doc.rect(left, iy, iouBoxW, 16).stroke('#CBD5E1');
    doc.fillColor('#64748B').text(lab, left + 4, iy + 4);
    doc.fillColor('#0F172A').text(val, left + 90, iy + 4, { width: 100, align: 'right' });
  });

  doc.fillColor('#0F172A').font('Helvetica-Bold').text('Note:', midX, y);
  doc.font('Helvetica').fillColor('#475569').text(payslip.comments || '', midX, y + 14, {
    width: rightEdge - midX,
    height: 48,
  });

  y += 58;
  doc.fillColor('#334155').fontSize(9).font('Helvetica');
  doc.text(`No. of payments: ${payslip.iouPaymentsCount || 0}`, left, y);
  doc.text('For:', left, y + 14);

  // QR footer
  try {
    const company = settings.companyName || 'Payroll';
    const period =
      payslip.periodLabel ||
      (payslip.type === 'weekly' && payslip.week
        ? `Week ${payslip.week}`
        : `${payslip.month}/${payslip.year}`);
    const qrText = [
      `${company} — Official Payslip`,
      `Employee: ${emp.fullName || emp.employeeId || '—'}`,
      `Period: ${period}`,
      `Net Pay: ${money(payslip.netPay, symbol)}`,
    ].join('\n');
    const qrData = await QRCode.toDataURL(qrText, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    const qrBuf = Buffer.from(qrData.replace(/^data:image\/png;base64,/, ''), 'base64');
    doc.image(qrBuf, left, 720, { width: 56 });
    doc.fontSize(8).fillColor('#94A3B8').text('Digitally generated payslip', left + 66, 740);
    if (settings.digitalSignature) {
      doc.text(`Authorized: ${settings.digitalSignature}`, left + 66, 752);
    }
  } catch {
    /* optional */
  }

  doc.end();
  await new Promise((resolve, reject) => {
    stream.on('finish', resolve);
    stream.on('error', reject);
  });

  return `/uploads/exports/${filename}`;
};
