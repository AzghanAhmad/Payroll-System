import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { uploadRoot } from '../middleware/upload.js';
import { getCurrencySymbol } from '../utils/currencies.js';

const money = (n, symbol) => `${symbol}${Number(n || 0).toFixed(2)}`;
const moneyOrDash = (n, symbol) =>
  n == null || Number(n) === 0 ? `${symbol}-` : money(n, symbol);

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
 * Absolute text helpers — never use PDFKit width+align (it overflows into neighbors).
 * Right-align by measuring the string and placing its left edge.
 */
const at = (doc, str, x, y) => {
  doc.text(String(str ?? ''), x, y, { lineBreak: false });
};

const rightAt = (doc, str, rightEdge, y) => {
  const s = String(str ?? '');
  const w = doc.widthOfString(s);
  doc.text(s, rightEdge - w, y, { lineBreak: false });
};

const fitAt = (doc, str, x, y, maxW) => {
  let s = String(str ?? '');
  if (!maxW || maxW <= 0) {
    at(doc, s, x, y);
    return;
  }
  while (s.length > 1 && doc.widthOfString(s) > maxW) {
    s = `${s.slice(0, -2)}…`;
  }
  at(doc, s, x, y);
};

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

  const doc = new PDFDocument({ size: 'A4', margin: 40, autoFirstPage: true });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const emp = payslip.employee || {};
  const left = 40;
  const right = 555;
  const pageW = right - left;
  const now = new Date();

  // —— Header ——
  const logoPath = resolveLogoPath(settings);
  const headerY = 40;
  if (logoPath) {
    try {
      doc.image(logoPath, left, headerY, { fit: [120, 48] });
    } catch {
      doc.fillColor('#1D4ED8').fontSize(16).font('Helvetica-Bold');
      at(doc, settings.companyName || 'ALPHA GROUP', left, headerY);
    }
  } else {
    doc.fillColor('#1D4ED8').fontSize(16).font('Helvetica-Bold');
    at(doc, settings.companyName || 'ALPHA GROUP', left, headerY);
  }

  doc.fillColor('#334155').fontSize(9).font('Helvetica');
  const contactX = 200;
  fitAt(doc, settings.companyAddress || '', contactX, headerY + 4, 340);
  const contactLine = [
    settings.companyPhone ? `T: ${settings.companyPhone}` : null,
    settings.companyEmail ? `E: ${settings.companyEmail}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');
  if (contactLine) fitAt(doc, contactLine, contactX, headerY + 18, 340);

  doc.fillColor('#0F172A').fontSize(22).font('Helvetica-Bold');
  at(doc, 'PAYSLIP', left, 98);

  // —— Meta: left employee block | right period block (no shared rows) ——
  const metaY = 130;
  const leftColR = 290;
  const rightColL = 310;
  const rowH = 16;

  const L = (txt, x, y) => {
    doc.fillColor('#64748B').font('Helvetica').fontSize(9);
    at(doc, txt, x, y);
  };
  const V = (txt, x, y, maxW) => {
    doc.fillColor('#0F172A').font('Helvetica-Bold').fontSize(9);
    fitAt(doc, txt || '—', x, y, maxW);
  };

  L('Employee:', left, metaY);
  V(emp.fullName || '', left + 62, metaY, leftColR - left - 62);
  L('Period:', rightColL, metaY);
  V(
    `${fmtUsDate(payslip.periodStart)} to ${fmtUsDate(payslip.periodEnd)}`,
    rightColL + 50,
    metaY,
    right - rightColL - 50
  );

  L('Position:', left, metaY + rowH);
  V(payslip.position || emp.position || '', left + 62, metaY + rowH, leftColR - left - 62);
  L('Month:', rightColL, metaY + rowH);
  V(MONTH_NAMES[(payslip.month || 1) - 1] || '', rightColL + 50, metaY + rowH, 100);
  L('Date:', rightColL + 155, metaY + rowH);
  V(fmtUsDate(now), rightColL + 185, metaY + rowH, right - rightColL - 185);

  L('Department:', left, metaY + rowH * 2);
  V(payslip.departmentName || '', left + 70, metaY + rowH * 2, leftColR - left - 70);
  L('Pay Day:', rightColL, metaY + rowH * 2);
  V(fmtPayDay(payslip.payDay), rightColL + 55, metaY + rowH * 2, right - rightColL - 55);

  L('Week:', rightColL, metaY + rowH * 3);
  V(
    payslip.type === 'weekly' ? String(payslip.week ?? '—') : '—',
    rightColL + 40,
    metaY + rowH * 3,
    36
  );
  L('Time:', rightColL + 90, metaY + rowH * 3);
  V(
    now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }),
    rightColL + 120,
    metaY + rowH * 3,
    right - rightColL - 120
  );

  // —— Two panels with a hard gap ——
  // A4 content: 40 … 555. Split ~55% / 45% with 16pt gutter.
  const tableTop = metaY + rowH * 4 + 12;
  const gutter = 16;
  const payL = left;           // 40
  const payR = 300;            // exclusive edge of payments box
  const dedL = payR + gutter;  // 316
  const dedR = right;          // 555
  const payW = payR - payL;    // 260
  const dedW = dedR - dedL;    // 239
  const headerH = 18;
  const rowH2 = 18;

  // Payments columns (all x coords strictly < payR)
  const cName = payL + 6;
  const cHoursR = payL + 130; // right edge of Hours
  const cRateR = payL + 188;  // right edge of Rate
  const cValueR = payR - 6;   // right edge of Value

  // Deductions columns
  const dName = dedL + 6;
  const dValueR = dedR - 6;

  const strokeBox = (x, y, w, h, stroke = '#E2E8F0') => {
    doc.rect(x, y, w, h).stroke(stroke);
  };

  strokeBox(payL, tableTop, payW, headerH, '#CBD5E1');
  strokeBox(dedL, tableTop, dedW, headerH, '#CBD5E1');

  doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold');
  at(doc, 'Payments', cName, tableTop + 5);
  rightAt(doc, 'Hours', cHoursR, tableTop + 5);
  rightAt(doc, 'Rate', cRateR, tableTop + 5);
  rightAt(doc, 'Value', cValueR, tableTop + 5);
  at(doc, 'Deductions', dName, tableTop + 5);
  rightAt(doc, 'Value', dValueR, tableTop + 5);

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

  let y = tableTop + headerH;
  for (let i = 0; i < 5; i++) {
    strokeBox(payL, y, payW, rowH2);
    strokeBox(dedL, y, dedW, rowH2);

    const [pLabel, hours, rate, val] = payRows[i];
    const [dLabel, dVal] = dedRows[i];
    const ty = y + 5;

    doc.fillColor('#334155').font('Helvetica').fontSize(9);
    fitAt(doc, pLabel, cName, ty, cHoursR - cName - 40);

    if (hours != null) {
      rightAt(doc, Number(hours).toFixed(2), cHoursR, ty);
    }

    if (rate != null && Number(rate)) {
      rightAt(doc, money(rate, symbol), cRateR, ty);
    } else if (hours != null) {
      rightAt(doc, moneyOrDash(rate, symbol), cRateR, ty);
    }

    const blankPay = pLabel === 'IOU' || pLabel === 'Tea Fund';
    if (!blankPay && val != null) {
      rightAt(doc, money(val, symbol), cValueR, ty);
    } else if (blankPay && val) {
      rightAt(doc, money(val, symbol), cValueR, ty);
    }

    at(doc, dLabel, dName, ty);
    rightAt(doc, money(dVal, symbol), dValueR, ty);
    y += rowH2;
  }

  // Gross / Total deductions
  const sumH = 20;
  doc.rect(payL, y, payW, sumH).fillAndStroke('#FFEDD5', '#FDBA74');
  doc.rect(dedL, y, dedW, sumH).fillAndStroke('#FFEDD5', '#FDBA74');
  doc.fillColor('#9A3412').font('Helvetica-Bold').fontSize(9);
  at(doc, 'Gross Pay', cName, y + 6);
  rightAt(doc, money(payslip.grossPay, symbol), cValueR, y + 6);
  at(doc, 'Total Deductions', dName, y + 6);
  rightAt(doc, money(payslip.totalDeductions, symbol), dValueR, y + 6);
  y += sumH + 10;

  // NET PAY
  doc.rect(left, y, pageW, 28).fill('#1E40AF');
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold');
  at(doc, 'NET PAY', left + 12, y + 8);
  rightAt(doc, money(payslip.netPay, symbol), right - 12, y + 8);
  y += 40;

  // IOU + Note
  doc.fillColor('#0F172A').fontSize(10).font('Helvetica-Bold');
  at(doc, 'IOU', left, y);
  y += 14;
  doc.fontSize(9).font('Helvetica');
  const iouBoxW = 220;
  [
    ['Amount', money(payslip.iouAmount, symbol)],
    ['Paid', money(payslip.iouPaid, symbol)],
    ['Balance', money(payslip.loanBalance, symbol)],
  ].forEach(([lab, val], i) => {
    const iy = y + i * 16;
    strokeBox(left, iy, iouBoxW, 16, '#CBD5E1');
    doc.fillColor('#64748B');
    at(doc, lab, left + 6, iy + 4);
    doc.fillColor('#0F172A');
    rightAt(doc, val, left + iouBoxW - 6, iy + 4);
  });

  doc.fillColor('#0F172A').font('Helvetica-Bold');
  at(doc, 'Note:', dedL, y);
  doc.font('Helvetica').fillColor('#475569');
  doc.text(payslip.comments || '', dedL, y + 14, { width: dedW, height: 48 });

  y += 58;
  doc.fillColor('#334155').fontSize(9).font('Helvetica');
  at(doc, `No. of payments: ${payslip.iouPaymentsCount || 0}`, left, y);
  at(doc, 'For:', left, y + 14);

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
    doc.fontSize(8).fillColor('#94A3B8');
    at(doc, 'Digitally generated payslip', left + 66, 740);
    if (settings.digitalSignature) {
      at(doc, `Authorized: ${settings.digitalSignature}`, left + 66, 752);
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
