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
import { ZipArchive } from 'archiver';
import { uploadRoot } from '../middleware/upload.js';
import PDFDocument from 'pdfkit';
import { generatePayslipPdf, buildPayslipFilename, resolvePayslipPdfPath } from '../services/payslipPdf.js';
import { getCurrencySymbol } from '../utils/currencies.js';

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

/** Bundle month PDFs: all staff payslips + clear summary reports into a zip */
export const saveFullPayrollPdfs = asyncHandler(async (req, res) => {
  const settings = ensureCurrentMonth(await getSettings());
  const year = Number(req.query.year) || settings.currentPayrollYear;
  const month = Number(req.query.month) || settings.currentPayrollMonth;
  const symbol = getCurrencySymbol(settings.currency);
  const money = (n) => `${symbol}${Number(n || 0).toFixed(2)}`;

  const folder = path.join(
    uploadRoot,
    'exports',
    `${year}-Payroll`,
    `${String(month).padStart(2, '0')}-${MONTH_NAMES[month - 1]}`
  );
  // Fresh pack each time
  fs.rmSync(folder, { recursive: true, force: true });
  fs.mkdirSync(path.join(folder, 'payslips'), { recursive: true });

  const payrolls = await Payroll.find({ year, month, type: 'weekly' })
    .populate('lines.employee', 'employeeId fullName')
    .sort({ week: 1 });
  const payslips = await Payslip.find({ year, month, type: 'weekly' })
    .populate('employee', 'employeeId fullName')
    .sort({ week: 1 });

  // Ensure every payslip has a PDF with the staff/month/week filename, then copy into the pack
  let payslipCount = 0;
  const payslipBatchSize = 4;
  for (let i = 0; i < payslips.length; i += payslipBatchSize) {
    const batch = payslips.slice(i, i + payslipBatchSize);
    await Promise.all(
      batch.map(async (p) => {
        if (!p.employee) return;
        try {
          const src = await resolvePayslipPdfPath(p);
          const destName = buildPayslipFilename(p);
          fs.copyFileSync(src, path.join(folder, 'payslips', destName));
          payslipCount += 1;
        } catch (err) {
          console.error('Payslip PDF failed', p._id, err.message);
        }
      })
    );
  }

  // Build per-employee rows from payroll lines (covers all staff on payroll)
  const byEmp = new Map();
  for (const p of payrolls) {
    for (const line of p.lines || []) {
      const empDoc = line.employee;
      const empId = String(empDoc?._id || empDoc || '');
      if (!empId || empId === 'undefined') continue;
      if (!byEmp.has(empId)) {
        byEmp.set(empId, {
          employeeId: empDoc?.employeeId || '',
          fullName: empDoc?.fullName || 'Staff',
          weeks: {},
          gross: 0,
          tax: 0,
          empNpf: 0,
          erNpf: 0,
          empAcc: 0,
          erAcc: 0,
          tea: 0,
          iou: 0,
          net: 0,
          hours: 0,
        });
      }
      const row = byEmp.get(empId);
      if (empDoc?.fullName) row.fullName = empDoc.fullName;
      if (empDoc?.employeeId) row.employeeId = empDoc.employeeId;
      const w = Number(p.week) || 0;
      row.weeks[w] = {
        gross: round2(line.grossPay || 0),
        net: round2(line.netPay || 0),
        tax: round2(line.tax || 0),
        hours: round2(line.totalHours || 0),
      };
      row.gross = round2(row.gross + (line.grossPay || 0));
      row.tax = round2(row.tax + (line.tax || 0));
      row.empNpf = round2(row.empNpf + (line.employeeNpf || 0));
      row.erNpf = round2(row.erNpf + (line.employerNpf || 0));
      row.empAcc = round2(row.empAcc + (line.employeeAcc || 0));
      row.erAcc = round2(row.erAcc + (line.employerAcc || 0));
      row.tea = round2(row.tea + (line.teaFund || 0));
      row.iou = round2(row.iou + (line.iouDeduction || 0));
      row.net = round2(row.net + (line.netPay || 0));
      row.hours = round2(row.hours + (line.totalHours || 0));
    }
  }

  // Also include any active employee missing from payroll (so the pack lists everyone)
  const active = await Employee.find({ status: 'active' })
    .select('employeeId fullName')
    .sort({ fullName: 1 });
  for (const emp of active) {
    const id = String(emp._id);
    if (!byEmp.has(id)) {
      byEmp.set(id, {
        employeeId: emp.employeeId || '',
        fullName: emp.fullName,
        weeks: {},
        gross: 0,
        tax: 0,
        empNpf: 0,
        erNpf: 0,
        empAcc: 0,
        erAcc: 0,
        tea: 0,
        iou: 0,
        net: 0,
        hours: 0,
      });
    }
  }

  const staffRows = [...byEmp.values()].sort((a, b) =>
    String(a.fullName).localeCompare(String(b.fullName))
  );

  await writeCoverPdf(path.join(folder, '00-README.pdf'), {
    settings,
    year,
    month,
    staffCount: staffRows.length,
    payslipCount,
    weekCount: payrolls.length,
  });

  await writeWeeklyRegisterPdf(path.join(folder, '01-Weekly-Payroll-Register.pdf'), {
    settings,
    year,
    month,
    payrolls,
    money,
  });

  await writeStaffMonthSummaryPdf(path.join(folder, '02-Staff-Month-Summary.pdf'), {
    settings,
    year,
    month,
    staffRows,
    money,
  });

  await writeStatutoryStaffPdf(path.join(folder, '03-PAYE-NPF-ACC-by-Staff.pdf'), {
    settings,
    year,
    month,
    staffRows,
    money,
  });

  const leaveEntries = await LeaveEntry.find({
    startDate: { $lte: new Date(year, month, 0, 23, 59, 59) },
    endDate: { $gte: new Date(year, month - 1, 1) },
  }).populate('employee', 'fullName employeeId');

  await writeTablePdf(path.join(folder, '04-Leave-Records.pdf'), {
    title: `Leave Records — ${MONTH_NAMES[month - 1]} ${year}`,
    subtitle: settings.companyName || 'Payroll',
    headers: ['Staff', 'ID', 'Type', 'Start', 'End', 'Days', 'Status'],
    rows: leaveEntries.map((e) => [
      e.employee?.fullName || '—',
      e.employee?.employeeId || '—',
      e.leaveType || '',
      e.startDate ? new Date(e.startDate).toLocaleDateString('en-GB') : '—',
      e.endDate ? new Date(e.endDate).toLocaleDateString('en-GB') : '—',
      String(e.daysCounted ?? ''),
      e.status || '',
    ]),
    emptyText: 'No leave recorded for this month.',
  });

  const loans = await Loan.find({ status: { $in: ['active', 'paid'] } }).populate(
    'employee',
    'fullName employeeId'
  );
  await writeTablePdf(path.join(folder, '05-IOU-Loans.pdf'), {
    title: `IOU / Loans — as of ${MONTH_NAMES[month - 1]} ${year}`,
    subtitle: settings.companyName || 'Payroll',
    headers: ['Staff', 'ID', 'Amount', 'Paid', 'Balance', 'Status'],
    rows: loans.map((l) => [
      l.employee?.fullName || '(unassigned)',
      l.employee?.employeeId || '—',
      money(l.amount),
      money(l.amountPaid),
      money(l.remainingBalance),
      l.status || '',
    ]),
    emptyText: 'No IOU / loans on record.',
  });

  const zipName = `${nextMonthFileName(year, month, settings.companyName)}_PDFs.zip`;
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

  await new Promise((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.on('error', reject);
    res.on('error', reject);
    archive.on('end', resolve);
    archive.pipe(res);
    archive.directory(folder, false);
    archive.finalize().catch(reject);
  });
});

function pdfHeader(doc, title, subtitle) {
  doc.fillColor('#2563EB').fontSize(16).font('Helvetica-Bold').text(title);
  doc.moveDown(0.2);
  doc.fillColor('#64748B').fontSize(10).font('Helvetica').text(subtitle || '');
  doc.moveDown(0.4);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor('#E2E8F0').stroke();
  doc.moveDown(0.6);
}

function drawTable(doc, { headers, rows, colWidths, startY }) {
  const margin = 40;
  const pageWidth = doc.page.width - margin * 2;
  const widths =
    colWidths ||
    headers.map(() => pageWidth / headers.length);
  let y = startY || doc.y;
  const rowH = 18;

  const ensureSpace = (need = rowH + 10) => {
    if (y + need > doc.page.height - 40) {
      doc.addPage();
      y = 40;
      // reprint header row on new page
      let x = margin;
      doc.rect(margin, y, pageWidth, rowH).fill('#1E293B');
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => {
        doc.text(h, x + 3, y + 5, { width: widths[i] - 6, ellipsis: true });
        x += widths[i];
      });
      y += rowH;
      doc.font('Helvetica');
    }
  };

  // Header
  ensureSpace();
  let x = margin;
  doc.rect(margin, y, pageWidth, rowH).fill('#1E293B');
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => {
    doc.text(String(h), x + 3, y + 5, { width: widths[i] - 6, ellipsis: true });
    x += widths[i];
  });
  y += rowH;
  doc.font('Helvetica');

  rows.forEach((row, idx) => {
    ensureSpace();
    if (idx % 2 === 0) {
      doc.rect(margin, y, pageWidth, rowH).fill('#F8FAFC');
    }
    x = margin;
    doc.fillColor('#0F172A').fontSize(8);
    row.forEach((cell, i) => {
      const align = i === 0 || i === 1 ? 'left' : 'right';
      doc.text(String(cell ?? ''), x + 3, y + 5, {
        width: widths[i] - 6,
        align: i < 2 ? 'left' : align,
        ellipsis: true,
      });
      x += widths[i];
    });
    y += rowH;
  });

  doc.y = y + 8;
  return y;
}

function writeCoverPdf(filePath, { settings, year, month, staffCount, payslipCount, weekCount }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    pdfHeader(
      doc,
      `${settings.companyName || 'Payroll'} — Full Payroll Pack`,
      `${MONTH_NAMES[month - 1]} ${year}`
    );
    doc.fillColor('#0F172A').fontSize(11).text('This ZIP contains:');
    doc.moveDown(0.5);
    const items = [
      `payslips/ — Individual payslip PDF for each staff member (${payslipCount} file(s))`,
      '00-README.pdf — This overview',
      '01-Weekly-Payroll-Register.pdf — All staff by week (hours, gross, net, deductions)',
      '02-Staff-Month-Summary.pdf — One row per employee for the whole month',
      '03-PAYE-NPF-ACC-by-Staff.pdf — Statutory totals per employee',
      '04-Leave-Records.pdf — Leave taken in this month',
      '05-IOU-Loans.pdf — Outstanding / paid IOUs',
    ];
    items.forEach((t) => {
      doc.fontSize(10).fillColor('#334155').text(`•  ${t}`, { indent: 10 });
      doc.moveDown(0.25);
    });
    doc.moveDown();
    doc.fontSize(10).fillColor('#64748B').text(`Staff listed: ${staffCount}`);
    doc.text(`Payroll weeks in pack: ${weekCount}`);
    doc.text(`Generated: ${new Date().toLocaleString('en-GB')}`);
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function writeWeeklyRegisterPdf(filePath, { settings, year, month, payrolls, money }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    pdfHeader(
      doc,
      'Weekly Payroll Register',
      `${settings.companyName || 'Payroll'} · ${MONTH_NAMES[month - 1]} ${year}`
    );

    if (!payrolls.length) {
      doc.fillColor('#64748B').text('No weekly payroll has been generated for this month yet.');
      doc.text('Open Payroll → Generate Weekly for each week, then export again.');
    }

    for (const p of payrolls) {
      if (doc.y > 480) doc.addPage();
      doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(`Week ${p.week} — ${p.periodLabel || ''}`);
      doc.font('Helvetica').fontSize(9).fillColor('#64748B');
      doc.text(
        `Totals — Gross ${money(p.totals?.grossPay)} · Net ${money(p.totals?.netPay)} · Tax ${money(p.totals?.tax)} · Staff ${p.lines?.length || 0}`
      );
      doc.moveDown(0.3);

      const rows = (p.lines || [])
        .slice()
        .sort((a, b) =>
          String(a.employee?.fullName || '').localeCompare(String(b.employee?.fullName || ''))
        )
        .map((l) => [
          l.employee?.fullName || '—',
          l.employee?.employeeId || '—',
          Number(l.totalHours || 0).toFixed(2),
          money(l.grossPay),
          money(l.employeeNpf),
          money(l.employeeAcc),
          money(l.tax),
          money(l.teaFund),
          money(l.iouDeduction),
          money(l.netPay),
        ]);

      drawTable(doc, {
        headers: ['Employee', 'ID', 'Hours', 'Gross', 'NPF', 'ACC', 'Tax', 'Tea', 'IOU', 'Net'],
        rows,
        colWidths: [150, 50, 45, 65, 55, 50, 55, 50, 50, 65],
      });
      doc.moveDown(0.8);
    }

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function writeStaffMonthSummaryPdf(filePath, { settings, year, month, staffRows, money }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    pdfHeader(
      doc,
      'Staff Month Summary (All Employees)',
      `${settings.companyName || 'Payroll'} · ${MONTH_NAMES[month - 1]} ${year}`
    );

    const rows = staffRows.map((r) => [
      r.fullName,
      r.employeeId || '—',
      Number(r.hours || 0).toFixed(2),
      money(r.gross),
      money(r.tax),
      money(r.empNpf + r.erNpf),
      money(r.empAcc + r.erAcc),
      money(r.tea),
      money(r.iou),
      money(r.net),
    ]);

    const totals = staffRows.reduce(
      (a, r) => ({
        hours: a.hours + (r.hours || 0),
        gross: a.gross + (r.gross || 0),
        tax: a.tax + (r.tax || 0),
        npf: a.npf + (r.empNpf || 0) + (r.erNpf || 0),
        acc: a.acc + (r.empAcc || 0) + (r.erAcc || 0),
        tea: a.tea + (r.tea || 0),
        iou: a.iou + (r.iou || 0),
        net: a.net + (r.net || 0),
      }),
      { hours: 0, gross: 0, tax: 0, npf: 0, acc: 0, tea: 0, iou: 0, net: 0 }
    );

    rows.push([
      'TOTAL',
      '',
      round2(totals.hours).toFixed(2),
      money(totals.gross),
      money(totals.tax),
      money(totals.npf),
      money(totals.acc),
      money(totals.tea),
      money(totals.iou),
      money(totals.net),
    ]);

    drawTable(doc, {
      headers: ['Employee', 'ID', 'Hours', 'Gross', 'Tax', 'NPF', 'ACC', 'Tea', 'IOU', 'Net'],
      rows,
      colWidths: [150, 50, 50, 65, 55, 60, 55, 50, 55, 65],
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function writeStatutoryStaffPdf(filePath, { settings, year, month, staffRows, money }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    pdfHeader(
      doc,
      'PAYE / NPF / ACC by Staff',
      `${settings.companyName || 'Payroll'} · ${MONTH_NAMES[month - 1]} ${year}`
    );

    const rows = staffRows.map((r) => [
      r.fullName,
      r.employeeId || '—',
      money(r.gross),
      money(r.tax),
      money(r.empNpf),
      money(r.erNpf),
      money(r.empAcc),
      money(r.erAcc),
      money(r.tax + r.empNpf + r.erNpf + r.empAcc + r.erAcc),
    ]);

    drawTable(doc, {
      headers: [
        'Employee',
        'ID',
        'Gross',
        'PAYE',
        'Emp NPF',
        'Er NPF',
        'Emp ACC',
        'Er ACC',
        'Statutory Total',
      ],
      rows,
      colWidths: [140, 50, 60, 55, 55, 55, 55, 55, 70],
    });

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}

function writeTablePdf(filePath, { title, subtitle, headers, rows, emptyText }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);
    pdfHeader(doc, title, subtitle);
    if (!rows.length) {
      doc.fillColor('#64748B').fontSize(11).text(emptyText || 'No records.');
    } else {
      const pageWidth = doc.page.width - 80;
      const colWidths = headers.map((_, i) =>
        i === 0 ? pageWidth * 0.28 : pageWidth * (0.72 / (headers.length - 1))
      );
      drawTable(doc, { headers, rows, colWidths });
    }
    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  });
}
