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
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 24 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const rows = paye?.rows || [];
  const summary = paye?.summary || {};
  const totals = paye?.totals || {};
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;
  const left = 24;
  const pageW = doc.page.width - 48;

  const cell = (text, x, y, w, h, opts = {}) => {
    const {
      fill = null,
      stroke = '#94A3B8',
      color = '#0F172A',
      fontSize = 7,
      bold = false,
      align = 'left',
    } = opts;
    if (fill) doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
    else doc.rect(x, y, w, h).stroke(stroke);
    doc
      .fillColor(color)
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(fontSize)
      .text(String(text ?? ''), x + 2, y + Math.max(2, (h - fontSize) / 2 - 1), {
        width: w - 4,
        align,
        lineBreak: false,
        ellipsis: true,
      });
  };

  // Title
  let y = 22;
  doc
    .font('Helvetica-Bold')
    .fontSize(11)
    .fillColor('#1E3A5F')
    .text('MINISTRY OF CUSTOMS AND REVENUE — SAMOA', left, y, {
      width: pageW - 50,
      align: 'center',
      lineBreak: false,
    });
  doc
    .fontSize(22)
    .text('P4', left + pageW - 42, y - 2, { width: 42, align: 'center', lineBreak: false });
  y += 16;
  doc
    .fontSize(13)
    .text('SALARY & WAGE TAX AND SOURCE DEDUCTION PAYMENT RECORDS', left, y, {
      width: pageW - 50,
      align: 'center',
      lineBreak: false,
    });
  y += 16;
  doc
    .font('Helvetica-Oblique')
    .fontSize(9)
    .fillColor('#64748B')
    .text('Tax Administration Act 2012', left, y, {
      width: pageW - 50,
      align: 'center',
      lineBreak: false,
    });
  y += 14;
  doc
    .font('Helvetica-Bold')
    .fontSize(7)
    .fillColor('#0F172A')
    .text(
      'FILL IN THIS FORM MONTHLY AND SUBMIT TOGETHER WITH PAYMENT TO THE INLAND REVENUE SERVICES WITHIN 15 DAYS FROM THE END OF EACH MONTH.',
      left,
      y,
      { width: pageW, align: 'center', lineBreak: false }
    );
  y += 14;

  // Employer meta row
  const metaH = 18;
  const metaParts = [
    { label: 'Payer / Employer Name', value: employer?.companyName || '—', w: pageW * 0.34 },
    { label: 'Tax ID', value: employer?.taxIdentificationNumber || '—', w: pageW * 0.16 },
    { label: 'Month', value: monthLabel, w: pageW * 0.12 },
    { label: 'Address', value: employer?.companyAddress || '—', w: pageW * 0.38 },
  ];
  let mx = left;
  metaParts.forEach((p) => {
    const lw = Math.min(110, p.w * 0.45);
    cell(p.label, mx, y, lw, metaH, { fill: '#DBEAFE', bold: true, fontSize: 7 });
    cell(p.value, mx + lw, y, p.w - lw, metaH, { fill: '#DCFCE7', fontSize: 8, bold: true });
    mx += p.w;
  });
  y += metaH + 8;

  // Column widths matching P4
  // Name | NPF | Period | Sal1 Sal2 Sal3 TOTAL | Tax1 Tax2 Tax3 TOTAL TAX | NPF | ACC
  const cols = [
    { w: pageW * 0.14, align: 'left' },
    { w: pageW * 0.07, align: 'center' },
    { w: pageW * 0.07, align: 'center' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.07, align: 'right' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.06, align: 'right' },
    { w: pageW * 0.075, align: 'right' },
    { w: pageW * 0.065, align: 'right' },
    { w: pageW * 0.065, align: 'right' },
  ];
  // normalize widths to pageW
  const colSum = cols.reduce((s, c) => s + c.w, 0);
  cols.forEach((c) => {
    c.w = (c.w / colSum) * pageW;
  });
  const colX = (i) => left + cols.slice(0, i).reduce((s, c) => s + c.w, 0);

  const h1 = 14;
  const h2 = 12;
  const h3 = 12;

  // Header row 1
  cell('NAME OF EMPLOYEES', colX(0), y, cols[0].w, h1 + h2 + h3, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('NPF Number', colX(1), y, cols[1].w, h1 + h2 + h3, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('PAY PERIOD', colX(2), y, cols[2].w, h1 + h2 + h3, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('SALARY & WAGE / SOURCE DEDUCTION PAYMENTS', colX(3), y, cols[3].w + cols[4].w + cols[5].w + cols[6].w, h1, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('TAX DEDUCTIONS', colX(7), y, cols[7].w + cols[8].w + cols[9].w + cols[10].w, h1, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('NPF (9%)', colX(11), y, cols[11].w, h1 + h2 + h3, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  cell('ACC (1%)', colX(12), y, cols[12].w, h1 + h2 + h3, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 7,
  });
  y += h1;

  // Header row 2
  cell('PAY PERIODS OF THE MONTH', colX(3), y, cols[3].w + cols[4].w + cols[5].w + cols[6].w, h2, {
    fill: '#166534',
    stroke: '#166534',
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 6.5,
  });
  cell('PAY PERIODS OF THE MONTH', colX(7), y, cols[7].w + cols[8].w + cols[9].w + cols[10].w, h2, {
    fill: '#9F1239',
    stroke: '#9F1239',
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 6.5,
  });
  y += h2;

  // Header row 3
  ['1', '2', '3', 'TOTAL'].forEach((h, i) => {
    cell(h, colX(3 + i), y, cols[3 + i].w, h3, {
      fill: `#${GREEN}`,
      bold: true,
      align: 'center',
      fontSize: 7,
    });
  });
  ['1', '2', '3', 'TOTAL TAX'].forEach((h, i) => {
    cell(h, colX(7 + i), y, cols[7 + i].w, h3, {
      fill: `#${PINK}`,
      bold: true,
      align: 'center',
      fontSize: 7,
    });
  });
  y += h3;

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
  const rowH = 13;

  const drawHeaderOnPage = () => {
    // compact header repeat on new pages
    const labels = [
      'Employee',
      'NPF #',
      'Period',
      'Sal 1',
      'Sal 2',
      'Sal 3',
      'TOTAL',
      'Tax 1',
      'Tax 2',
      'Tax 3',
      'TOTAL TAX',
      'NPF',
      'ACC',
    ];
    labels.forEach((h, i) => {
      cell(h, colX(i), y, cols[i].w, 14, {
        fill: `#${HEADER_BLUE}`,
        stroke: `#${HEADER_BLUE}`,
        color: '#FFFFFF',
        bold: true,
        align: 'center',
        fontSize: 6.5,
      });
    });
    y += 14;
  };

  for (const r of rows) {
    if (y > doc.page.height - 110) {
      doc.addPage();
      y = 28;
      drawHeaderOnPage();
    }
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
      let fill = '#FFFFFF';
      if (i >= 3 && i <= 6) fill = `#${GREEN}`;
      else if (i >= 7 && i <= 10) fill = `#${PINK}`;
      cell(v, colX(i), y, cols[i].w, rowH, {
        fill,
        align: cols[i].align,
        fontSize: 7,
        bold: i === 6 || i === 10,
      });
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
    y += rowH;
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
    cell(v, colX(i), y, cols[i].w, rowH + 2, {
      fill: '#E2E8F0',
      bold: true,
      align: cols[i].align,
      fontSize: 7,
    });
  });
  y += rowH + 10;

  if (y > doc.page.height - 100) {
    doc.addPage();
    y = 28;
  }

  // Summary block
  const summaryW = pageW * 0.55;
  const boxW = pageW * 0.28;
  const lines = [
    ['PREVIOUS PERIODS', money(summary.previousGross)],
    ['THIS MONTH', money(summary.thisMonthGross ?? sumGross)],
    ['TOTAL YEAR TO DATE', money(summary.yearToDateGross)],
    ['TAX PAID THIS MONTH', money(summary.taxPaidThisMonth ?? sumTax)],
  ];
  doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text('TOTAL GROSS PAY FROM', left, y, {
    lineBreak: false,
  });
  y += 12;
  lines.forEach(([lab, val]) => {
    cell(lab, left, y, summaryW * 0.45, 16, { fill: '#F1F5F9', bold: true, fontSize: 8 });
    cell(val, left + summaryW * 0.45, y, summaryW * 0.25, 16, {
      fill: '#FFFFFF',
      align: 'right',
      bold: true,
      fontSize: 8,
    });
    y += 16;
  });

  const taxY = y - 64;
  doc
    .rect(left + pageW - boxW, taxY, boxW, 56)
    .fillAndStroke('#DCFCE7', '#86EFAC');
  doc
    .fillColor('#14532D')
    .font('Helvetica-Bold')
    .fontSize(10)
    .text('Total Tax to Pay $', left + pageW - boxW + 8, taxY + 10, {
      width: boxW - 16,
      align: 'center',
      lineBreak: false,
    });
  doc
    .fontSize(16)
    .text(String(money(summary.totalTaxToPay ?? sumTax)), left + pageW - boxW + 8, taxY + 28, {
      width: boxW - 16,
      align: 'center',
      lineBreak: false,
    });

  y += 10;
  doc
    .fillColor('#475569')
    .font('Helvetica-Oblique')
    .fontSize(7)
    .text(
      'I solemnly declare that the information provided in this form are true and correct; and I understand that any misleading or false information is an offence under the Tax Administration Act 2012.',
      left,
      y,
      { width: pageW }
    );
  y += 18;
  cell('SIGNATURE OF EMPLOYER', left, y, 130, 18, { fill: '#DBEAFE', bold: true, fontSize: 8 });
  cell(employer?.digitalSignature || employer?.companyName || '—', left + 130, y, 220, 18, {
    fill: '#DCFCE7',
    fontSize: 8,
  });
  cell('DESIGNATION', left + 360, y, 90, 18, { fill: '#DBEAFE', bold: true, fontSize: 8 });
  cell(summary.designation || employer?.companyEmail || '—', left + 450, y, 200, 18, {
    fill: '#DCFCE7',
    fontSize: 8,
  });
  y += 24;
  doc
    .fillColor('#94A3B8')
    .font('Helvetica')
    .fontSize(7)
    .text(
      'You can now file your PAYE, VAGST and Income Tax Returns Online. Register for Samoa eTax at set.revenue.gov.ws',
      left,
      y,
      { width: pageW, lineBreak: false }
    );

  doc.end();
}
