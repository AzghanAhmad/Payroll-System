import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { WEEK_DAYS, round2 } from '../utils/helpers.js';
import { getWeekPeriod } from '../utils/weekPeriod.js';
import { calculatePayrollLine } from './payrollCalculator.js';

const DAY_LABELS = {
  friday: 'FRI',
  saturday: 'SAT',
  sunday: 'SUN',
  monday: 'MON',
  tuesday: 'TUE',
  wednesday: 'WED',
  thursday: 'THU',
};

const fmtWeekEnding = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${x.getDate()}-${months[x.getMonth()]}`;
};

const fmtRange = (start, end) => `${fmtWeekEnding(start)} - ${fmtWeekEnding(end)}`;

const fmtMoney = (n) => round2(n || 0);

/** Build costing row for one timesheet entry */
export const buildTimesheetCostRow = (entry, settings) => {
  const emp = entry.employee || {};
  let totalHours = 0;
  let doubleHours = 0;
  const rule = settings.doubleTimeRule || 'sunday';
  for (const day of WEEK_DAYS) {
    const d = entry.days?.[day];
    if (!d) continue;
    const hrs = Number(d.workingHours) || 0;
    totalHours += hrs;
    const isDouble =
      rule === 'none' ? false : rule === 'sunday' ? day === 'sunday' : Boolean(d.isDoubleTime);
    if (isDouble) doubleHours += hrs;
  }
  totalHours = round2(totalHours);
  doubleHours = round2(doubleHours);

  const line = calculatePayrollLine({
    employee: emp,
    totalHours,
    doubleHours,
    settings,
    iouDeduction: 0,
    periodsPerYear: 52,
  });

  return {
    name: emp.fullName || '',
    dept: emp.department?.name || '',
    days: WEEK_DAYS.map((day) => {
      const d = entry.days?.[day] || {};
      return {
        start: d.clockIn || '',
        finish: d.clockOut || '',
        breakHours: d.breakHours != null && d.breakHours !== '' ? Number(d.breakHours) : '',
        total: Number(d.workingHours) || 0,
      };
    }),
    totalHours: line.totalHours,
    subTotal1: line.normalHours,
    totalPh: 0,
    totalSick: 0,
    totalLeave: 0,
    totalSt: line.normalHours,
    totalDt: line.doubleHours,
    totalOt: line.otHours,
    total: line.totalHours,
    rate: line.hourlyRate,
    earnings: line.normalPay,
    otPay: line.otPay,
    doublePay: line.doublePay,
    totalPay: line.grossPay,
    employerNpf: line.employerNpf,
    employerAcc: line.employerAcc,
    employerCost: line.employerCost,
    notes: entry.weeklyNotes || '',
  };
};

const HEADER_BLUE = '1E3A5F';
const COL_DAY = 'DBEAFE';
const COL_HOURS = 'A7F3D0';
const COL_PAY = 'E9D5FF';
const COL_NOTES = 'FED7AA';

/**
 * Write timesheet workbook Excel matching ss1 (all weeks stacked).
 */
export async function writeTimesheetWorkbookExcel(res, { timesheet, settings, year, month }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Timesheets', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 0 }],
  });

  const company = settings.companyName || 'Payroll';
  let rowNum = 1;

  const weeks = [...(timesheet.weeks || [])].sort((a, b) => a.weekNumber - b.weekNumber);

  for (const week of weeks) {
    const { start, end } = getWeekPeriod(year, month, week.weekNumber);
    const title = `${company.toUpperCase()}   |   WEEK ENDING ${fmtWeekEnding(end)}   (${fmtRange(start, end)})`;

    // Build column headers: # Name + 7 days × 4 + totals + pay + notes
    const dayHeaders = [];
    const daySub = [];
    for (const day of WEEK_DAYS) {
      dayHeaders.push(DAY_LABELS[day], '', '', '');
      daySub.push('Start', 'Finish', 'Break', 'Total');
    }

    const topHeaders = [
      '#',
      'Name',
      ...dayHeaders,
      'Total Hours',
      'Sub-total 1',
      'Total PH',
      'Total Sick',
      'Total Leave',
      'Total ST',
      'Total DT',
      'Total OT',
      'Total',
      'Rate',
      'Earnings',
      'OT Pay',
      'Double Pay',
      'Total Pay',
      'Employer NPF',
      'Employer ACC',
      'Total Employer Cost',
      'NOTES',
    ];

    const subHeaders = [
      '',
      '',
      ...daySub,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
    ];

    const colCount = topHeaders.length;

    // Title row
    sheet.mergeCells(rowNum, 1, rowNum, colCount);
    const titleCell = sheet.getCell(rowNum, 1);
    titleCell.value = title;
    titleCell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(rowNum).height = 22;
    rowNum += 1;

    // Header row 1 (day names)
    const h1 = sheet.getRow(rowNum);
    topHeaders.forEach((h, i) => {
      const cell = h1.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 8 };
      cell.alignment = { horizontal: 'center', wrapText: true };
      let fill = 'E2E8F0';
      if (i >= 2 && i < 2 + 28) fill = COL_DAY;
      else if (i >= 2 + 28 && i < 2 + 28 + 9) fill = COL_HOURS;
      else if (i >= 2 + 28 + 9 && i < 2 + 28 + 9 + 8) fill = COL_PAY;
      else if (i === colCount - 1) fill = COL_NOTES;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.border = {
        top: { style: 'thin', color: { argb: '94A3B8' } },
        left: { style: 'thin', color: { argb: '94A3B8' } },
        bottom: { style: 'thin', color: { argb: '94A3B8' } },
        right: { style: 'thin', color: { argb: '94A3B8' } },
      };
    });
    // Merge day label groups
    let c = 3;
    for (let d = 0; d < 7; d++) {
      sheet.mergeCells(rowNum, c, rowNum, c + 3);
      c += 4;
    }
    rowNum += 1;

    // Header row 2 (Start/Finish/Break/Total)
    const h2 = sheet.getRow(rowNum);
    subHeaders.forEach((h, i) => {
      const cell = h2.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, size: 7 };
      cell.alignment = { horizontal: 'center' };
      let fill = 'F1F5F9';
      if (i >= 2 && i < 2 + 28) fill = COL_DAY;
      else if (i >= 2 + 28 && i < 2 + 28 + 9) fill = COL_HOURS;
      else if (i >= 2 + 28 + 9 && i < 2 + 28 + 9 + 8) fill = COL_PAY;
      else if (i === colCount - 1) fill = COL_NOTES;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      cell.border = {
        top: { style: 'thin', color: { argb: '94A3B8' } },
        left: { style: 'thin', color: { argb: '94A3B8' } },
        bottom: { style: 'thin', color: { argb: '94A3B8' } },
        right: { style: 'thin', color: { argb: '94A3B8' } },
      };
    });
    rowNum += 1;

    const entries = [...(week.entries || [])].sort((a, b) =>
      String(a.employee?.fullName || '').localeCompare(String(b.employee?.fullName || ''))
    );

    const totals = {
      totalHours: 0,
      subTotal1: 0,
      totalPh: 0,
      totalSick: 0,
      totalLeave: 0,
      totalSt: 0,
      totalDt: 0,
      totalOt: 0,
      total: 0,
      earnings: 0,
      otPay: 0,
      doublePay: 0,
      totalPay: 0,
      employerNpf: 0,
      employerAcc: 0,
      employerCost: 0,
    };

    entries.forEach((entry, idx) => {
      const r = buildTimesheetCostRow(entry, settings);
      const values = [
        idx + 1,
        r.name,
        ...r.days.flatMap((d) => [d.start, d.finish, d.breakHours === '' ? '' : d.breakHours, d.total || '']),
        r.totalHours || '',
        r.subTotal1 || '',
        r.totalPh || '',
        r.totalSick || '',
        r.totalLeave || '',
        r.totalSt || '',
        r.totalDt || '',
        r.totalOt || '',
        r.total || '',
        r.rate || '',
        fmtMoney(r.earnings),
        fmtMoney(r.otPay),
        fmtMoney(r.doublePay),
        fmtMoney(r.totalPay),
        fmtMoney(r.employerNpf),
        fmtMoney(r.employerAcc),
        fmtMoney(r.employerCost),
        r.notes,
      ];
      const dataRow = sheet.getRow(rowNum);
      values.forEach((v, i) => {
        const cell = dataRow.getCell(i + 1);
        cell.value = v;
        cell.font = { size: 8 };
        cell.border = {
          top: { style: 'thin', color: { argb: 'CBD5E1' } },
          left: { style: 'thin', color: { argb: 'CBD5E1' } },
          bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
          right: { style: 'thin', color: { argb: 'CBD5E1' } },
        };
        if (i >= 2) cell.alignment = { horizontal: 'center' };
      });
      rowNum += 1;

      totals.totalHours += r.totalHours;
      totals.subTotal1 += r.subTotal1;
      totals.totalSt += r.totalSt;
      totals.totalDt += r.totalDt;
      totals.totalOt += r.totalOt;
      totals.total += r.total;
      totals.earnings += r.earnings;
      totals.otPay += r.otPay;
      totals.doublePay += r.doublePay;
      totals.totalPay += r.totalPay;
      totals.employerNpf += r.employerNpf;
      totals.employerAcc += r.employerAcc;
      totals.employerCost += r.employerCost;
    });

    // Totals row
    const tValues = [
      '',
      'TOTAL',
      ...Array(28).fill(''),
      round2(totals.totalHours),
      round2(totals.subTotal1),
      '',
      '',
      '',
      round2(totals.totalSt),
      round2(totals.totalDt),
      round2(totals.totalOt),
      round2(totals.total),
      '',
      fmtMoney(totals.earnings),
      fmtMoney(totals.otPay),
      fmtMoney(totals.doublePay),
      fmtMoney(totals.totalPay),
      fmtMoney(totals.employerNpf),
      fmtMoney(totals.employerAcc),
      fmtMoney(totals.employerCost),
      '',
    ];
    const tRow = sheet.getRow(rowNum);
    tValues.forEach((v, i) => {
      const cell = tRow.getCell(i + 1);
      cell.value = v;
      cell.font = { bold: true, size: 8 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
    });
    rowNum += 2; // blank spacer between weeks
  }

  // Column widths
  sheet.getColumn(1).width = 4;
  sheet.getColumn(2).width = 18;
  for (let i = 3; i <= 30; i++) sheet.getColumn(i).width = 6;
  for (let i = 31; i <= 47; i++) sheet.getColumn(i).width = 9;
  sheet.getColumn(48).width = 24;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `Timesheets_${months[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

/**
 * Stream timesheet workbook PDF (one week per page, landscape).
 */
export function streamTimesheetWorkbookPdf(res, { timesheet, settings, year, month }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `Timesheets_${months[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 24 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const company = settings.companyName || 'Payroll';
  const weeks = [...(timesheet.weeks || [])].sort((a, b) => a.weekNumber - b.weekNumber);

  weeks.forEach((week, wi) => {
    if (wi > 0) doc.addPage();
    const { start, end } = getWeekPeriod(year, month, week.weekNumber);
    doc.rect(24, 24, doc.page.width - 48, 22).fill(`#${HEADER_BLUE}`);
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica-Bold')
      .text(`${company.toUpperCase()}  |  WEEK ENDING ${fmtWeekEnding(end)}  (${fmtRange(start, end)})`, 30, 30, {
        width: doc.page.width - 60,
      });

    const entries = [...(week.entries || [])].sort((a, b) =>
      String(a.employee?.fullName || '').localeCompare(String(b.employee?.fullName || ''))
    );

    let y = 56;
    doc.fillColor('#0F172A').fontSize(7).font('Helvetica-Bold');
    const headers = ['#', 'Name', ...WEEK_DAYS.map((d) => DAY_LABELS[d]), 'Hrs', 'ST', 'DT', 'OT', 'Rate', 'Gross', 'Er.NPF', 'Er.ACC', 'Er.Cost', 'Notes'];
    const widths = [18, 90, 48, 48, 48, 48, 48, 48, 48, 32, 28, 28, 28, 32, 40, 36, 36, 42, 80];
    let x = 24;
    headers.forEach((h, i) => {
      doc.text(h, x, y, { width: widths[i], align: i < 2 ? 'left' : 'center' });
      x += widths[i];
    });
    y += 12;
    doc.moveTo(24, y).lineTo(doc.page.width - 24, y).strokeColor('#94A3B8').stroke();
    y += 4;

    doc.font('Helvetica').fontSize(6.5);
    entries.forEach((entry, idx) => {
      if (y > doc.page.height - 40) {
        doc.addPage();
        y = 40;
      }
      const r = buildTimesheetCostRow(entry, settings);
      const dayStrs = r.days.map((d) => {
        if (!d.start && !d.finish && !d.total) return '';
        return `${d.start || '—'}-${d.finish || '—'} (${d.total || 0})`;
      });
      const cells = [
        String(idx + 1),
        r.name,
        ...dayStrs,
        String(r.totalHours || ''),
        String(r.totalSt || ''),
        String(r.totalDt || ''),
        String(r.totalOt || ''),
        String(r.rate || ''),
        String(fmtMoney(r.totalPay)),
        String(fmtMoney(r.employerNpf)),
        String(fmtMoney(r.employerAcc)),
        String(fmtMoney(r.employerCost)),
        r.notes || '',
      ];
      x = 24;
      doc.fillColor('#334155');
      cells.forEach((c, i) => {
        doc.text(c, x, y, { width: widths[i], align: i < 2 ? 'left' : 'center', ellipsis: true });
        x += widths[i];
      });
      y += 11;
    });
  });

  doc.end();
}
