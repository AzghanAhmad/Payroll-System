import ExcelJS from 'exceljs';
import Payslip from '../models/Payslip.js';
import Settings from '../models/Settings.js';
import { getCurrencySymbol } from '../utils/currencies.js';
import { buildPayslipExcelFilename } from './payslipPdf.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const fmtUsDate = (d) => (d ? new Date(d).toLocaleDateString('en-US') : '—');
const fmtPayDay = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—';
const money = (n, symbol) => `${symbol} ${Number(n || 0).toFixed(2)}`;

/**
 * Build one Alpha Group–style payslip worksheet (ss2).
 */
export async function buildPayslipWorksheet(workbook, payslip, settings) {
  const emp = payslip.employee || {};
  const symbol = getCurrencySymbol(settings.currency) || '$';
  const name = String(emp.fullName || 'Payslip')
    .replace(/[\\/*?:\[\]]/g, '')
    .slice(0, 28);
  const sheet = workbook.addWorksheet(name || 'Payslip');

  sheet.getColumn(1).width = 14;
  sheet.getColumn(2).width = 14;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 3;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 14;

  const company = settings.companyName || 'ALPHA GROUP';
  sheet.getCell('A1').value = company;
  sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF1D4ED8' } };
  sheet.mergeCells('C1:G1');
  sheet.getCell('C1').value = settings.companyAddress || '';
  sheet.getCell('C2').value = [
    settings.companyPhone ? `T: ${settings.companyPhone}` : null,
    settings.companyEmail ? `E: ${settings.companyEmail}` : null,
  ]
    .filter(Boolean)
    .join('  |  ');

  sheet.getCell('A4').value = 'PAYSLIP';
  sheet.getCell('A4').font = { bold: true, size: 18 };

  const now = new Date();
  sheet.getCell('A6').value = 'Employee:';
  sheet.getCell('B6').value = emp.fullName || '';
  sheet.getCell('F6').value = 'Period:';
  sheet.getCell('G6').value = `${fmtUsDate(payslip.periodStart)} to ${fmtUsDate(payslip.periodEnd)}`;

  sheet.getCell('A7').value = 'Position:';
  sheet.getCell('B7').value = payslip.position || emp.position || '';
  sheet.getCell('F7').value = 'Month:';
  sheet.getCell('G7').value = MONTH_NAMES[(payslip.month || 1) - 1] || '';

  sheet.getCell('A8').value = 'Department:';
  sheet.getCell('B8').value = payslip.departmentName || '';
  sheet.getCell('F8').value = 'Pay Day:';
  sheet.getCell('G8').value = fmtPayDay(payslip.payDay);

  sheet.getCell('F9').value = 'Week:';
  sheet.getCell('G9').value = payslip.type === 'weekly' ? payslip.week || '' : '';
  sheet.getCell('F10').value = 'Date:';
  sheet.getCell('G10').value = fmtUsDate(now);
  sheet.getCell('F11').value = 'Time:';
  sheet.getCell('G11').value = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });

  // Payments / Deductions headers
  const headers = ['Payments', 'Hours', 'Rate', 'Value', '', 'Deductions', 'Value'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(13, i + 1);
    cell.value = h;
    cell.font = { bold: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  const payRows = [
    ['Normal Time', Number(payslip.normalHours || 0).toFixed(2), money(payslip.hourlyRate, symbol), money(payslip.normalPay, symbol)],
    [
      'Overtime',
      Number(payslip.otHours || 0).toFixed(2),
      money(payslip.otRate || (payslip.hourlyRate || 0) * 1.5, symbol),
      money(payslip.otPay, symbol),
    ],
    [
      'Double Time',
      Number(payslip.doubleHours || 0).toFixed(2),
      Number(payslip.doubleHours) ? money(payslip.doubleRate || (payslip.hourlyRate || 0) * 2, symbol) : '$ -',
      Number(payslip.doublePay) ? money(payslip.doublePay, symbol) : '$ -',
    ],
    ['IOU', '', '', ''],
    ['Tea Fund', '', '', ''],
  ];
  const dedRows = [
    ['SNPF', money(payslip.employeeNpf, symbol)],
    ['ACC', money(payslip.employeeAcc, symbol)],
    ['PAYE', money(payslip.tax, symbol)],
    ['IOU', money(payslip.iouDeduction, symbol)],
    ['TEA FUND', money(payslip.teaFund, symbol)],
  ];

  payRows.forEach((row, i) => {
    const r = 14 + i;
    sheet.getCell(r, 1).value = row[0];
    sheet.getCell(r, 2).value = row[1];
    sheet.getCell(r, 3).value = row[2];
    sheet.getCell(r, 4).value = row[3];
    sheet.getCell(r, 6).value = dedRows[i][0];
    sheet.getCell(r, 7).value = dedRows[i][1];
    for (const c of [1, 2, 3, 4, 6, 7]) {
      sheet.getCell(r, c).border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    }
  });

  // Gross / Total deductions
  const gr = 19;
  sheet.getCell(gr, 1).value = 'Gross Pay';
  sheet.getCell(gr, 4).value = money(payslip.grossPay, symbol);
  sheet.getCell(gr, 6).value = 'Total Deductions';
  sheet.getCell(gr, 7).value = money(payslip.totalDeductions, symbol);
  for (const c of [1, 2, 3, 4, 6, 7]) {
    sheet.getCell(gr, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEDD5' } };
    sheet.getCell(gr, c).font = { bold: true };
    sheet.getCell(gr, c).border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  // NET PAY
  sheet.mergeCells('A21:G21');
  const net = sheet.getCell('A21');
  net.value = `NET PAY                                                          ${money(payslip.netPay, symbol)}`;
  net.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
  net.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  net.alignment = { vertical: 'middle' };
  sheet.getRow(21).height = 28;

  // IOU + Note
  sheet.getCell('A23').value = 'IOU';
  sheet.getCell('A23').font = { bold: true };
  sheet.getCell('A24').value = 'Amount';
  sheet.getCell('B24').value = money(payslip.iouAmount, symbol);
  sheet.getCell('A25').value = 'Paid';
  sheet.getCell('B25').value = money(payslip.iouPaid, symbol);
  sheet.getCell('A26').value = 'Balance';
  sheet.getCell('B26').value = money(payslip.loanBalance, symbol);

  sheet.getCell('D23').value = 'Note:';
  sheet.getCell('D23').font = { bold: true };
  sheet.mergeCells('D24:G26');
  sheet.getCell('D24').value = payslip.comments || '';
  sheet.getCell('D24').alignment = { wrapText: true, vertical: 'top' };

  sheet.getCell('A28').value = `No. of payments: ${payslip.iouPaymentsCount || 0}`;
  sheet.getCell('A29').value = 'For:';

  return sheet;
}

export async function writePayslipExcel(res, payslipId) {
  const payslip = await Payslip.findById(payslipId).populate(
    'employee',
    'employeeId fullName position'
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
  if (!payslips.length) {
    workbook.addWorksheet('Empty');
  } else {
    for (const p of payslips) {
      await buildPayslipWorksheet(workbook, p, settings);
    }
  }
  const first = payslips[0];
  const months = MONTH_NAMES;
  const label =
    first?.type === 'weekly'
      ? `Payslips_${months[(first.month || 1) - 1]}_${first.year}_Week${first.week}.xlsx`
      : `Payslips_${months[(first?.month || 1) - 1]}_${first?.year || ''}_Monthly.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${label}"`);
  await workbook.xlsx.write(res);
  res.end();
}
