import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { round2 } from '../utils/helpers.js';

const HEADER_BLUE = '1E3A5F';
const GREEN = 'BBF7D0';
const PINK = 'FECDD3';
const LIGHT_GREEN = 'DCFCE7';

const border = {
  top: { style: 'thin', color: { argb: '94A3B8' } },
  left: { style: 'thin', color: { argb: '94A3B8' } },
  bottom: { style: 'thin', color: { argb: '94A3B8' } },
  right: { style: 'thin', color: { argb: '94A3B8' } },
};

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const money = (n) => round2(Number(n) || 0);

const applyBorder = (cell) => {
  cell.border = border;
};

/**
 * Samoa Form P4 PAYE Excel export.
 */
export async function writePayeSheetExcel(res, { year, month, employer, paye }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('PAYE P4');
  const rows = paye?.rows || [];
  const summary = paye?.summary || {};
  const totals = paye?.totals || {};
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;

  // Title block
  sheet.mergeCells('A1:M1');
  sheet.getCell('A1').value = 'MINISTRY OF CUSTOMS AND REVENUE — SAMOA';
  sheet.getCell('A1').font = { bold: true, size: 12 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.mergeCells('A2:M2');
  sheet.getCell('A2').value = 'SALARY & WAGE TAX AND SOURCE DEDUCTION PAYMENT RECORDS';
  sheet.getCell('A2').font = { bold: true, size: 14 };
  sheet.getCell('A2').alignment = { horizontal: 'center' };

  sheet.mergeCells('A3:M3');
  sheet.getCell('A3').value = 'Tax Administration Act 2012';
  sheet.getCell('A3').alignment = { horizontal: 'center' };
  sheet.getCell('A3').font = { size: 10, italic: true };

  sheet.getCell('N1').value = 'P4';
  sheet.getCell('N1').font = { bold: true, size: 20, color: { argb: 'FF1E3A5F' } };
  sheet.getCell('N1').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A5:N5');
  sheet.getCell('A5').value =
    'FILL IN THIS FORM MONTHLY AND SUBMIT TOGETHER WITH PAYMENT TO THE INLAND REVENUE SERVICES WITHIN 15 DAYS FROM THE END OF EACH MONTH.';
  sheet.getCell('A5').font = { size: 8, bold: true };
  sheet.getCell('A5').alignment = { wrapText: true, horizontal: 'center' };
  sheet.getRow(5).height = 28;

  // Employer block
  sheet.getCell('A7').value = 'Payer / Employer Name:';
  sheet.getCell('A7').font = { bold: true };
  sheet.mergeCells('B7:E7');
  sheet.getCell('B7').value = employer?.companyName || '';
  sheet.getCell('B7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  applyBorder(sheet.getCell('B7'));

  sheet.getCell('F7').value = 'Payment for the month of:';
  sheet.getCell('F7').font = { bold: true };
  sheet.mergeCells('G7:H7');
  sheet.getCell('G7').value = monthLabel;
  sheet.getCell('G7').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  sheet.getCell('G7').font = { bold: true };
  sheet.getCell('G7').alignment = { horizontal: 'center' };
  applyBorder(sheet.getCell('G7'));

  sheet.getCell('A8').value = 'Tax Identification Number:';
  sheet.getCell('A8').font = { bold: true };
  sheet.mergeCells('B8:C8');
  sheet.getCell('B8').value = employer?.taxIdentificationNumber || '';
  sheet.getCell('B8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  applyBorder(sheet.getCell('B8'));

  sheet.getCell('D8').value = 'Address:';
  sheet.getCell('D8').font = { bold: true };
  sheet.mergeCells('E8:H8');
  sheet.getCell('E8').value = employer?.companyAddress || '';
  sheet.getCell('E8').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  applyBorder(sheet.getCell('E8'));

  // Table headers rows 10-12
  const headerFill = (cell, argb = HEADER_BLUE, white = true) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    cell.font = { bold: true, size: 8, color: white ? { argb: 'FFFFFFFF' } : { argb: 'FF0F172A' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    applyBorder(cell);
  };

  // Row 10 group headers
  sheet.mergeCells(10, 1, 12, 1);
  headerFill(sheet.getCell(10, 1));
  sheet.getCell(10, 1).value = 'NAME OF EMPLOYEES';

  sheet.mergeCells(10, 2, 12, 2);
  headerFill(sheet.getCell(10, 2));
  sheet.getCell(10, 2).value = 'NPF Number';

  sheet.mergeCells(10, 3, 12, 3);
  headerFill(sheet.getCell(10, 3));
  sheet.getCell(10, 3).value = 'PAY PERIOD';

  sheet.mergeCells(10, 4, 10, 7);
  headerFill(sheet.getCell(10, 4));
  sheet.getCell(10, 4).value = 'SALARY & WAGE / SOURCE DEDUCTION PAYMENTS';
  for (let c = 5; c <= 7; c++) {
    headerFill(sheet.getCell(10, c));
  }

  sheet.mergeCells(10, 8, 10, 11);
  headerFill(sheet.getCell(10, 8));
  sheet.getCell(10, 8).value = 'TAX DEDUCTIONS';
  for (let c = 9; c <= 11; c++) headerFill(sheet.getCell(10, c));

  sheet.mergeCells(10, 12, 12, 12);
  headerFill(sheet.getCell(10, 12));
  sheet.getCell(10, 12).value = 'NPF (9%)';

  sheet.mergeCells(10, 13, 12, 13);
  headerFill(sheet.getCell(10, 13));
  sheet.getCell(10, 13).value = 'ACC (1%)';

  // Row 11 sub group
  sheet.mergeCells(11, 4, 11, 7);
  headerFill(sheet.getCell(11, 4), '166534', true);
  sheet.getCell(11, 4).value = 'PAY PERIODS OF THE MONTH';
  for (let c = 5; c <= 7; c++) headerFill(sheet.getCell(11, c), '166534', true);

  sheet.mergeCells(11, 8, 11, 11);
  headerFill(sheet.getCell(11, 8), '9F1239', true);
  sheet.getCell(11, 8).value = 'PAY PERIODS OF THE MONTH';
  for (let c = 9; c <= 11; c++) headerFill(sheet.getCell(11, c), '9F1239', true);

  // Row 12 period numbers
  ['1', '2', '3', 'TOTAL'].forEach((h, i) => {
    const cell = sheet.getCell(12, 4 + i);
    cell.value = h;
    headerFill(cell, GREEN, false);
  });
  ['1', '2', '3', 'TOTAL TAX'].forEach((h, i) => {
    const cell = sheet.getCell(12, 8 + i);
    cell.value = h;
    headerFill(cell, PINK, false);
  });

  let row = 13;
  let sumGross = 0;
  let sumTax = 0;
  let sumNpf = 0;
  let sumAcc = 0;
  let sumP1 = 0;
  let sumP2 = 0;
  let sumP3 = 0;
  let sumT1 = 0;
  let sumT2 = 0;
  let sumT3 = 0;

  for (const r of rows) {
    const vals = [
      r.name || '',
      r.npfNumber || '',
      r.payPeriod || 'Fortnightly',
      money(r.payPeriod1),
      money(r.payPeriod2),
      money(r.payPeriod3),
      money(r.grossTotal),
      money(r.taxPeriod1),
      money(r.taxPeriod2),
      money(r.taxPeriod3),
      money(r.totalTax),
      money(r.npfTotal),
      money(r.accTotal),
    ];
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 8 };
      applyBorder(cell);
      if (i >= 3 && i <= 6) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN } };
        cell.alignment = { horizontal: 'right' };
      } else if (i >= 7 && i <= 10) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PINK } };
        cell.alignment = { horizontal: 'right' };
      } else if (i >= 11) {
        cell.alignment = { horizontal: 'right' };
      }
    });
    sumP1 += Number(r.payPeriod1) || 0;
    sumP2 += Number(r.payPeriod2) || 0;
    sumP3 += Number(r.payPeriod3) || 0;
    sumGross += Number(r.grossTotal) || 0;
    sumT1 += Number(r.taxPeriod1) || 0;
    sumT2 += Number(r.taxPeriod2) || 0;
    sumT3 += Number(r.taxPeriod3) || 0;
    sumTax += Number(r.totalTax) || 0;
    sumNpf += Number(r.npfTotal) || 0;
    sumAcc += Number(r.accTotal) || 0;
    row += 1;
  }

  // Totals row
  const totVals = [
    'TOTAL',
    '',
    '',
    money(sumP1),
    money(sumP2),
    money(sumP3),
    money(totals.gross ?? sumGross),
    money(sumT1),
    money(sumT2),
    money(sumT3),
    money(totals.tax ?? sumTax),
    money(totals.npf ?? sumNpf),
    money(totals.acc ?? sumAcc),
  ];
  totVals.forEach((v, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = v;
    cell.font = { bold: true, size: 8 };
    applyBorder(cell);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  });
  row += 2;

  // Summary footer
  sheet.getCell(row, 1).value = 'TOTAL GROSS PAY FROM';
  sheet.getCell(row, 1).font = { bold: true, size: 9 };
  row += 1;
  sheet.getCell(row, 1).value = 'PREVIOUS PERIODS';
  sheet.getCell(row, 3).value = money(summary.previousGross);
  applyBorder(sheet.getCell(row, 3));
  row += 1;
  sheet.getCell(row, 1).value = 'THIS MONTH';
  sheet.getCell(row, 3).value = money(summary.thisMonthGross ?? sumGross);
  applyBorder(sheet.getCell(row, 3));
  row += 1;
  sheet.getCell(row, 1).value = 'TOTAL YEAR TO DATE';
  sheet.getCell(row, 3).value = money(summary.yearToDateGross);
  applyBorder(sheet.getCell(row, 3));
  row += 1;
  sheet.getCell(row, 1).value = 'TAX PAID THIS MONTH';
  sheet.getCell(row, 3).value = money(summary.taxPaidThisMonth ?? sumTax);
  applyBorder(sheet.getCell(row, 3));

  sheet.getCell(row - 3, 6).value = 'Total Tax to Pay $';
  sheet.getCell(row - 3, 6).font = { bold: true, size: 11 };
  sheet.mergeCells(row - 3, 8, row - 1, 9);
  const taxBox = sheet.getCell(row - 3, 8);
  taxBox.value = money(summary.totalTaxToPay ?? sumTax);
  taxBox.font = { bold: true, size: 14 };
  taxBox.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  taxBox.alignment = { horizontal: 'center', vertical: 'middle' };
  applyBorder(taxBox);

  row += 2;
  sheet.mergeCells(row, 1, row, 13);
  sheet.getCell(row, 1).value =
    'I solemnly declare that the information provided in this form are true and correct; and I understand that any misleading or false information is an offence under the Tax Administration Act 2012.';
  sheet.getCell(row, 1).font = { italic: true, size: 8 };
  sheet.getCell(row, 1).alignment = { wrapText: true };
  sheet.getRow(row).height = 32;
  row += 2;

  sheet.getCell(row, 1).value = 'SIGNATURE OF EMPLOYER:';
  sheet.getCell(row, 1).font = { bold: true };
  sheet.mergeCells(row, 3, row, 5);
  sheet.getCell(row, 3).value = employer?.digitalSignature || employer?.companyName || '';
  sheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  applyBorder(sheet.getCell(row, 3));
  row += 1;
  sheet.getCell(row, 1).value = 'DESIGNATION:';
  sheet.getCell(row, 1).font = { bold: true };
  sheet.mergeCells(row, 3, row, 5);
  sheet.getCell(row, 3).value = summary.designation || employer?.companyEmail || '';
  sheet.getCell(row, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_GREEN } };
  applyBorder(sheet.getCell(row, 3));

  row += 2;
  sheet.mergeCells(row, 1, row, 13);
  sheet.getCell(row, 1).value =
    'You can now file your PAYE, VAGST and Income Tax Returns Online. Register for Samoa eTax at set.revenue.gov.ws';
  sheet.getCell(row, 1).font = { size: 8, color: { argb: 'FF64748B' } };

  sheet.getColumn(1).width = 22;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 12;
  for (let i = 4; i <= 13; i++) sheet.getColumn(i).width = 10;

  const filename = `PAYE_P4_${MONTH_SHORT[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamPayeSheetPdf(res, { year, month, employer, paye }) {
  const filename = `PAYE_P4_${MONTH_SHORT[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const rows = paye?.rows || [];
  const summary = paye?.summary || {};
  const totals = paye?.totals || {};
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;
  const pageW = doc.page.width - 56;

  doc.fontSize(10).font('Helvetica-Bold').fillColor('#1E3A5F')
    .text('MINISTRY OF CUSTOMS AND REVENUE — SAMOA', 28, 28, { width: pageW - 60, align: 'center' });
  doc.fontSize(14).text('SALARY & WAGE TAX AND SOURCE DEDUCTION PAYMENT RECORDS', { align: 'center' });
  doc.fontSize(9).font('Helvetica-Oblique').fillColor('#64748B').text('Tax Administration Act 2012', { align: 'center' });
  doc.fontSize(18).font('Helvetica-Bold').fillColor('#1E3A5F').text('P4', doc.page.width - 70, 28, { width: 40 });

  doc.moveDown(0.4);
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#0F172A')
    .text(
      'FILL IN THIS FORM MONTHLY AND SUBMIT TOGETHER WITH PAYMENT TO THE INLAND REVENUE SERVICES WITHIN 15 DAYS FROM THE END OF EACH MONTH.',
      { align: 'center' }
    );
  doc.moveDown(0.4);
  doc.fontSize(8).font('Helvetica');
  doc.text(`Payer / Employer Name: ${employer?.companyName || '—'}     Tax ID: ${employer?.taxIdentificationNumber || '—'}     Month: ${monthLabel}`);
  doc.text(`Address: ${employer?.companyAddress || '—'}`);
  doc.moveDown(0.3);

  const headers = [
    'Employee', 'NPF #', 'Period', 'Sal 1', 'Sal 2', 'Sal 3', 'TOTAL',
    'Tax 1', 'Tax 2', 'Tax 3', 'TOTAL TAX', 'NPF', 'ACC',
  ];
  const colW = pageW / headers.length;
  let y = doc.y;
  doc.rect(28, y, pageW, 16).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, 28 + i * colW, y + 4, { width: colW - 2, align: 'center' }));
  y += 18;

  let sumGross = 0;
  let sumTax = 0;
  doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
  for (const r of rows) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 40;
    }
    const vals = [
      r.name || '',
      r.npfNumber || '',
      r.payPeriod || 'Fortnightly',
      String(money(r.payPeriod1)),
      String(money(r.payPeriod2)),
      String(money(r.payPeriod3)),
      String(money(r.grossTotal)),
      String(money(r.taxPeriod1)),
      String(money(r.taxPeriod2)),
      String(money(r.taxPeriod3)),
      String(money(r.totalTax)),
      String(money(r.npfTotal)),
      String(money(r.accTotal)),
    ];
    vals.forEach((v, i) =>
      doc.text(v, 28 + i * colW, y, { width: colW - 2, align: i < 3 ? 'left' : 'right', ellipsis: true })
    );
    sumGross += Number(r.grossTotal) || 0;
    sumTax += Number(r.totalTax) || 0;
    y += 10;
  }

  y += 4;
  doc.font('Helvetica-Bold').fillColor('#0F172A')
    .text(
      `TOTAL Gross: ${money(totals.gross ?? sumGross)}    TOTAL Tax: ${money(totals.tax ?? sumTax)}    NPF: ${money(totals.npf || 0)}    ACC: ${money(totals.acc || 0)}`,
      28,
      y,
      { width: pageW }
    );
  y += 16;
  doc.font('Helvetica').fontSize(8)
    .text(
      `Previous periods: ${money(summary.previousGross)}   This month: ${money(summary.thisMonthGross ?? sumGross)}   YTD: ${money(summary.yearToDateGross)}   Tax paid: ${money(summary.taxPaidThisMonth ?? sumTax)}`,
      28,
      y,
      { width: pageW * 0.65 }
    );
  doc.rect(28 + pageW * 0.68, y - 2, pageW * 0.3, 22).fillAndStroke('#DCFCE7', '#86EFAC');
  doc.fillColor('#14532D').font('Helvetica-Bold').fontSize(10)
    .text(`Total Tax to Pay $ ${money(summary.totalTaxToPay ?? sumTax)}`, 28 + pageW * 0.68 + 6, y + 4, {
      width: pageW * 0.3 - 12,
    });

  y += 30;
  doc.fillColor('#475569').fontSize(7).font('Helvetica-Oblique')
    .text(
      'I solemnly declare that the information provided in this form are true and correct; and I understand that any misleading or false information is an offence under the Tax Administration Act 2012.',
      28,
      y,
      { width: pageW }
    );
  y += 18;
  doc.font('Helvetica').fontSize(8).fillColor('#0F172A')
    .text(
      `Signature of Employer: ${employer?.digitalSignature || employer?.companyName || '—'}     Designation: ${summary.designation || employer?.companyEmail || '—'}`,
      28,
      y,
      { width: pageW }
    );
  y += 14;
  doc.fillColor('#94A3B8').fontSize(7)
    .text('You can now file your PAYE, VAGST and Income Tax Returns Online. Register for Samoa eTax at set.revenue.gov.ws', 28, y);

  doc.end();
}
