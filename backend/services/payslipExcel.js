import ExcelJS from 'exceljs';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { getCurrencySymbol } from '../utils/currencies.js';
import { buildPayslipExcelFilename } from './payslipPdf.js';
import { getWeekPeriod } from '../utils/weekPeriod.js';

const money = (n, symbol) => `${symbol}${Number(n || 0).toFixed(2)}`;
const hrs = (n) => Number(n || 0).toFixed(2);

const fmtDate = (d) => {
  if (!d) return '—';
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return '—';
  return `${dt.getMonth() + 1}/${dt.getDate()}/${dt.getFullYear()}`;
};

const fmtRange = (start, end) => `${fmtDate(start)} – ${fmtDate(end)}`;

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

/**
 * Client-preferred payslip look (matches PDF download).
 */
export async function buildPayslipWorksheet(workbook, payslip, settings) {
  const emp = payslip.employee || {};
  const symbol = getCurrencySymbol(settings.currency) || '$';
  const name = String(emp.fullName || 'Payslip')
    .replace(/[\\/*?:\[\]]/g, '')
    .slice(0, 28);
  const sheet = workbook.addWorksheet(name || 'Payslip');

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 10;
  sheet.getColumn(3).width = 10;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 3;
  sheet.getColumn(6).width = 20;
  sheet.getColumn(7).width = 12;

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

  sheet.getCell('A1').value = company;
  sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FF2563EB' } };
  sheet.getCell('A2').value = location;
  sheet.getCell('A2').font = { size: 10, color: { argb: 'FF64748B' } };

  sheet.mergeCells('F1:G1');
  sheet.getCell('F1').value = 'PAYSLIP';
  sheet.getCell('F1').font = { bold: true, size: 18, color: { argb: 'FF0F172A' } };
  sheet.getCell('F1').alignment = { horizontal: 'right' };
  sheet.mergeCells('F2:G2');
  sheet.getCell('F2').value = weekLine;
  sheet.getCell('F2').font = { size: 9, color: { argb: 'FF64748B' } };
  sheet.getCell('F2').alignment = { horizontal: 'right' };

  sheet.getCell('A4').value = `Employee: ${emp.fullName || '—'}`;
  sheet.getCell('A4').font = { bold: true, size: 11 };

  sheet.getCell('A5').value =
    `Position: ${payslip.position || emp.position || '—'} | Department: ${payslip.departmentName || '—'}`;
  sheet.getCell('A6').value =
    `Period Start: ${fmtDate(periodStart)} | Period End: ${fmtDate(periodEnd)}`;
  sheet.getCell('A7').value =
    `Pay Day: ${fmtDate(payDay)} | Hourly Rate: ${money(payslip.hourlyRate, symbol)}`;
  sheet.getCell('A8').value =
    `Bank: ${payslip.bank || emp.bank || '—'} | Account: ${payslip.accountNumber || emp.accountNumber || '—'} | NPF: ${payslip.npfNumber || emp.npfNumber || '—'}`;
  for (const r of [5, 6, 7, 8]) {
    sheet.getCell(`A${r}`).font = { size: 9, color: { argb: 'FF475569' } };
  }

  sheet.getCell('A10').value = 'Payments';
  sheet.getCell('A10').font = { bold: true, size: 12, color: { argb: 'FF2563EB' } };

  ['Description', 'Hours', 'Rate', 'Value'].forEach((h, i) => {
    const cell = sheet.getCell(11, i + 1);
    cell.value = h;
    cell.font = { size: 8, color: { argb: 'FF94A3B8' } };
    if (i > 0) cell.alignment = { horizontal: 'right' };
  });

  const payRows = [
    ['Normal Time', hrs(payslip.normalHours), money(payslip.hourlyRate, symbol), money(payslip.normalPay, symbol)],
    ['Overtime (T 1/2)', hrs(payslip.otHours), money(otRate, symbol), money(payslip.otPay, symbol)],
    ['Double Time (T2)', hrs(payslip.doubleHours), money(dblRate, symbol), money(payslip.doublePay, symbol)],
  ];
  const dedRows = [
    [`NPF / SNPF (${npfPct}%)`, money(payslip.employeeNpf, symbol)],
    [`ACC (${accPct}%)`, money(payslip.employeeAcc, symbol)],
    ['Tax / PAYE', money(payslip.tax, symbol)],
    ['IOU', money(payslip.iouDeduction, symbol)],
    ['Tea Fund', money(payslip.teaFund, symbol)],
  ];

  payRows.forEach((row, i) => {
    const r = 12 + i;
    sheet.getCell(r, 1).value = row[0];
    sheet.getCell(r, 2).value = row[1];
    sheet.getCell(r, 3).value = row[2];
    sheet.getCell(r, 4).value = row[3];
    sheet.getCell(r, 2).alignment = { horizontal: 'right' };
    sheet.getCell(r, 3).alignment = { horizontal: 'right' };
    sheet.getCell(r, 4).alignment = { horizontal: 'right' };
  });

  sheet.getCell('A15').value = 'Gross Pay';
  sheet.getCell('A15').font = { bold: true };
  sheet.getCell('D15').value = money(payslip.grossPay, symbol);
  sheet.getCell('D15').font = { bold: true };
  sheet.getCell('D15').alignment = { horizontal: 'right' };

  sheet.getCell('A17').value = 'Deductions';
  sheet.getCell('A17').font = { bold: true, size: 12, color: { argb: 'FF2563EB' } };
  sheet.getCell('A18').value = 'Description';
  sheet.getCell('A18').font = { size: 8, color: { argb: 'FF94A3B8' } };
  sheet.getCell('D18').value = 'Value';
  sheet.getCell('D18').font = { size: 8, color: { argb: 'FF94A3B8' } };
  sheet.getCell('D18').alignment = { horizontal: 'right' };

  dedRows.forEach((row, i) => {
    const r = 19 + i;
    sheet.getCell(r, 1).value = row[0];
    sheet.getCell(r, 4).value = row[1];
    sheet.getCell(r, 4).alignment = { horizontal: 'right' };
  });

  sheet.getCell('A24').value = 'Total Deductions';
  sheet.getCell('A24').font = { bold: true };
  sheet.getCell('D24').value = money(payslip.totalDeductions, symbol);
  sheet.getCell('D24').font = { bold: true };
  sheet.getCell('D24').alignment = { horizontal: 'right' };

  sheet.mergeCells('A26:D26');
  sheet.getCell('A26').value = `NET PAY ${money(payslip.netPay, symbol)}`;
  sheet.getCell('A26').font = { bold: true, size: 14, color: { argb: 'FF2563EB' } };
  sheet.getCell('A26').alignment = { horizontal: 'right' };

  sheet.getCell('A28').value = 'IOU Note';
  sheet.getCell('A28').font = { bold: true, size: 10, color: { argb: 'FF2563EB' } };
  sheet.getCell('A28').alignment = { horizontal: 'right' };
  sheet.mergeCells('A29:D29');
  sheet.getCell('A29').value =
    `Amount: ${money(payslip.iouAmount, symbol)} | Paid: ${money(payslip.iouPaid, symbol)} |`;
  sheet.getCell('A29').font = { size: 8, color: { argb: 'FF64748B' } };
  sheet.getCell('A29').alignment = { horizontal: 'right' };
  sheet.mergeCells('A30:D30');
  sheet.getCell('A30').value =
    `Balance: ${money(payslip.loanBalance, symbol)} | Payments: ${payslip.iouPaymentsCount || 0}`;
  sheet.getCell('A30').font = { size: 8, color: { argb: 'FF64748B' } };
  sheet.getCell('A30').alignment = { horizontal: 'right' };

  if (payslip.comments) {
    sheet.getCell('A32').value = `Note: ${payslip.comments}`;
    sheet.getCell('A32').font = { size: 8, color: { argb: 'FF475569' } };
  }

  return sheet;
}

export async function writePayslipExcel(res, payslipId) {
  const payslip = await Payslip.findById(payslipId).populate(
    'employee',
    'employeeId fullName position bank accountNumber npfNumber'
  );
  if (!payslip) throw new Error('Payslip not found');
  const settings = (await Settings.findOne()) || {};
  const workbook = new ExcelJS.Workbook();
  await buildPayslipWorksheet(workbook, payslip, settings);
  const filename = buildPayslipExcelFilename(payslip);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export async function writePayslipPackExcel(res, payslips) {
  const settings = (await Settings.findOne()) || {};
  const workbook = new ExcelJS.Workbook();
  for (const p of payslips) {
    try {
      await buildPayslipWorksheet(workbook, p, settings);
    } catch {
      /* skip broken row */
    }
  }
  const first = payslips[0];
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const filename =
    first?.type === 'weekly' && first?.week
      ? `Payslips_${months[(first.month || 1) - 1]}_${first.year}_Week${first.week}.xlsx`
      : `Payslips_${months[(first?.month || 1) - 1]}_${first?.year || ''}_Monthly.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}
