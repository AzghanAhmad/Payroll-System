import Settings from '../models/Settings.js';
import Timesheet from '../models/Timesheet.js';
import Payroll from '../models/Payroll.js';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import LeaveEntry from '../models/LeaveEntry.js';
import Loan from '../models/Loan.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import {
  generatePayrollSchedule,
  countPayrollWeeksInMonth,
  nextMonthFileName,
  MONTH_NAMES,
} from '../services/payrollSchedule.js';
import { ensureTimesheetWeeks, emptyDays, recalculateEntry } from '../services/timesheetService.js';
import { getWeekPeriod } from '../utils/weekPeriod.js';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { uploadRoot } from '../middleware/upload.js';
import PDFDocument from 'pdfkit';

const require = createRequire(import.meta.url);
const archiver = require('archiver');

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

const ensureCurrentMonth = (settings) => {
  if (!settings.currentPayrollYear || !settings.currentPayrollMonth) {
    const now = new Date();
    settings.currentPayrollYear = now.getFullYear();
    settings.currentPayrollMonth = now.getMonth() + 1;
  }
  return settings;
};

export const getSchedule = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const rows = generatePayrollSchedule(year);
  res.json({ year, rows });
});

export const getMonthControl = asyncHandler(async (req, res) => {
  const settings = ensureCurrentMonth(await getSettings());
  await settings.save();

  const year = settings.currentPayrollYear;
  const month = settings.currentPayrollMonth;
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  const currentDate = new Date(year, month - 1, 1);
  const nextDate = new Date(nextYear, nextMonth - 1, 1);
  const weeks = countPayrollWeeksInMonth(nextYear, nextMonth);
  const fileName = nextMonthFileName(nextYear, nextMonth, settings.companyName);
  const saveFolder = `${nextYear} Payroll`;

  const tsExists = !!(await Timesheet.findOne({ year: nextYear, month: nextMonth }));

  res.json({
    currentPayrollMonth: currentDate,
    currentYear: year,
    currentMonth: month,
    nextPayrollMonth: nextDate,
    nextYear,
    nextMonth,
    nextFileName: fileName,
    payrollWeeks: weeks,
    saveFolder,
    nextMonthExists: tsExists,
    companyName: settings.companyName,
  });
});

export const createNextMonth = asyncHandler(async (req, res) => {
  const settings = ensureCurrentMonth(await getSettings());
  let year = settings.currentPayrollYear;
  let month = settings.currentPayrollMonth;
  let nextYear = year;
  let nextMonth = month + 1;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }

  let ts = await Timesheet.findOne({ year: nextYear, month: nextMonth });
  if (!ts) {
    const active = await Employee.find({ status: 'active' });
    const weeks = [1, 2, 3, 4, 5].map((weekNumber) => {
      const { start, end } = getWeekPeriod(nextYear, nextMonth, weekNumber);
      return {
        weekNumber,
        startDate: start,
        endDate: end,
        entries: active.map((emp) =>
          recalculateEntry(
            {
              employee: emp._id,
              days: emptyDays(),
              weeklyHours: 0,
              weeklyCost: 0,
            },
            emp.hourlyRate || 0,
            settings
          )
        ),
      };
    });

    ts = await Timesheet.create({
      year: nextYear,
      month: nextMonth,
      weeks,
      monthlyHours: 0,
      status: 'draft',
      createdBy: req.user._id,
    });
  } else {
    ensureTimesheetWeeks(ts);
    await ts.save();
  }

  settings.currentPayrollYear = nextYear;
  settings.currentPayrollMonth = nextMonth;
  await settings.save();

  res.status(201).json({
    message: `Created payroll month ${MONTH_NAMES[nextMonth - 1]} ${nextYear}`,
    year: nextYear,
    month: nextMonth,
    timesheetId: ts._id,
    fileName: nextMonthFileName(nextYear, nextMonth, settings.companyName),
    saveFolder: `${nextYear} Payroll`,
  });
});

export const setCurrentMonth = asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) throw new AppError('year and month required');
  const settings = await getSettings();
  settings.currentPayrollYear = Number(year);
  settings.currentPayrollMonth = Number(month);
  await settings.save();
  res.json({
    currentYear: settings.currentPayrollYear,
    currentMonth: settings.currentPayrollMonth,
  });
});

/** Bundle month PDFs: payslips + summary reports into a zip */
export const saveFullPayrollPdfs = asyncHandler(async (req, res) => {
  const settings = ensureCurrentMonth(await getSettings());
  const year = Number(req.query.year) || settings.currentPayrollYear;
  const month = Number(req.query.month) || settings.currentPayrollMonth;

  const folder = path.join(uploadRoot, 'exports', `${year}-Payroll`, `${String(month).padStart(2, '0')}-${MONTH_NAMES[month - 1]}`);
  fs.mkdirSync(folder, { recursive: true });

  const payslips = await Payslip.find({ year, month, type: 'weekly' }).populate(
    'employee',
    'employeeId fullName'
  );

  for (const p of payslips) {
    if (p.pdfPath) {
      const abs = path.isAbsolute(p.pdfPath)
        ? p.pdfPath
        : path.join(uploadRoot, '..', p.pdfPath.replace(/^\//, ''));
      // pdfPath stored like /uploads/exports/...
      const fromUploads = path.join(process.cwd(), p.pdfPath.replace(/^\//, ''));
      const candidates = [abs, fromUploads, path.join(uploadRoot, 'exports', path.basename(p.pdfPath || ''))];
      for (const src of candidates) {
        if (src && fs.existsSync(src)) {
          const dest = path.join(
            folder,
            'payslips',
            path.basename(src)
          );
          fs.mkdirSync(path.dirname(dest), { recursive: true });
          fs.copyFileSync(src, dest);
          break;
        }
      }
    }
  }

  // Summary PDF
  const payrolls = await Payroll.find({ year, month, type: 'weekly' }).sort({ week: 1 });
  const summaryPath = path.join(folder, 'weekly-summary.pdf');
  await writeSummaryPdf(summaryPath, { year, month, payrolls, settings });

  const leaveEntries = await LeaveEntry.find({
    startDate: { $lte: new Date(year, month, 0, 23, 59, 59) },
    endDate: { $gte: new Date(year, month - 1, 1) },
  }).populate('employee', 'fullName employeeId');
  await writeSimpleTablePdf(path.join(folder, 'leave-records.pdf'), 'Leave Records', leaveEntries.map((e) => [
    e.employee?.fullName || '',
    e.leaveType,
    e.startDate?.toISOString().slice(0, 10),
    e.endDate?.toISOString().slice(0, 10),
    String(e.daysCounted),
    e.status,
  ]), ['Staff', 'Type', 'Start', 'End', 'Days', 'Status']);

  const loans = await Loan.find({ status: { $in: ['active', 'paid'] } }).populate('employee', 'fullName');
  await writeSimpleTablePdf(path.join(folder, 'iou-loans.pdf'), 'IOU / Loans', loans.map((l) => [
    l.employee?.fullName || '',
    String(l.amount),
    String(l.amountPaid),
    String(l.remainingBalance),
    l.status,
  ]), ['Staff', 'Amount', 'Paid', 'Balance', 'Status']);

  // Totals / PAYE / NPF / ACC from payroll lines
  const totalsRows = [];
  for (const p of payrolls) {
    for (const line of p.lines || []) {
      totalsRows.push({
        week: p.week,
        tax: line.tax || 0,
        npf: (line.employeeNpf || 0) + (line.employerNpf || 0),
        acc: (line.employeeAcc || 0) + (line.employerAcc || 0),
        gross: line.grossPay || 0,
        net: line.netPay || 0,
      });
    }
  }
  const sum = (key) => round2(totalsRows.reduce((s, r) => s + (r[key] || 0), 0));
  await writeSimpleTablePdf(
    path.join(folder, 'TOTAL-PAYE-NPF-ACC.pdf'),
    `Month Totals — ${MONTH_NAMES[month - 1]} ${year}`,
    [[String(sum('gross')), String(sum('tax')), String(sum('npf')), String(sum('acc')), String(sum('net'))]],
    ['Gross', 'PAYE/Tax', 'NPF', 'ACC', 'Net']
  );

  const zipName = `${nextMonthFileName(year, month, settings.companyName)}_PDFs.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename=${zipName}`);

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    throw err;
  });
  archive.pipe(res);
  archive.directory(folder, false);
  await archive.finalize();
});

function writeSummaryPdf(filePath, { year, month, payrolls, settings }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40 });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(16).text(`${settings.companyName || 'Payroll'} — Weekly Summary`);
    doc.fontSize(11).text(`${MONTH_NAMES[month - 1]} ${year}`);
    doc.moveDown();
    for (const p of payrolls) {
      doc.fontSize(12).text(`Week ${p.week} — Gross ${p.totals?.grossPay ?? 0} · Net ${p.totals?.netPay ?? 0}`);
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function writeSimpleTablePdf(filePath, title, rows, headers) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    doc.fontSize(14).text(title);
    doc.moveDown(0.5);
    doc.fontSize(9).text(headers.join(' | '));
    doc.moveDown(0.3);
    for (const row of rows.slice(0, 200)) {
      doc.text(row.join(' | '));
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
