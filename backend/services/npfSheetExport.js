import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { round2 } from '../utils/helpers.js';

const HEADER_BLUE = '1E3A5F';
const border = {
  top: { style: 'thin', color: { argb: '94A3B8' } },
  left: { style: 'thin', color: { argb: '94A3B8' } },
  bottom: { style: 'thin', color: { argb: '94A3B8' } },
  right: { style: 'thin', color: { argb: '94A3B8' } },
};

const fmtDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  const dd = String(x.getDate()).padStart(2, '0');
  const mm = String(x.getMonth() + 1).padStart(2, '0');
  const yyyy = x.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const money = (n) => (Number(n) ? round2(n) : Number(n) === 0 ? 0 : '-');

/**
 * Samoa NPF contribution schedule Excel (ss3).
 */
export async function writeNpfSheetExcel(res, { year, month, employer, period, npf }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('NPF Schedule');

  sheet.mergeCells('A1:N1');
  sheet.getCell('A1').value = 'SAMOA NATIONAL PROVIDENT FUND';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.getCell('A3').value = 'EMPLOYER NUMBER:';
  sheet.getCell('A3').font = { bold: true };
  sheet.getCell('B3').value = employer?.npfEmployerNumber || '';
  sheet.getCell('A4').value = 'EMPLOYER NAME:';
  sheet.getCell('A4').font = { bold: true };
  sheet.getCell('B4').value = employer?.companyName || '';
  sheet.getCell('A5').value = 'EMAIL/ADDRESS:';
  sheet.getCell('A5').font = { bold: true };
  sheet.getCell('B5').value = employer?.companyAddress || employer?.companyEmail || '';
  sheet.getCell('A6').value = 'TELEPHONE:';
  sheet.getCell('A6').font = { bold: true };
  sheet.getCell('B6').value = employer?.companyPhone || '';
  sheet.getCell('A7').value = 'ZONE:';
  sheet.getCell('A7').font = { bold: true };
  sheet.getCell('B7').value = employer?.npfZone || '';

  sheet.getCell('A9').value = 'Period Start:';
  sheet.getCell('A9').font = { bold: true };
  sheet.getCell('B9').value = fmtDate(period?.start);
  sheet.getCell('A10').value = 'Period End:';
  sheet.getCell('A10').font = { bold: true };
  sheet.getCell('B10').value = fmtDate(period?.end);
  sheet.getCell('A11').value = 'Schedule Frequency:';
  sheet.getCell('A11').font = { bold: true };
  sheet.getCell('B11').value = period?.frequency || 'Monthly';
  sheet.getCell('A12').value = 'Payments Total:';
  sheet.getCell('A12').font = { bold: true };
  sheet.getCell('B12').value = round2(npf?.paymentsTotal || 0);

  // Table headers row 14-15
  const topHeaders = ['NPF #', 'EMPLOYEE NAME', 'TRANSACTION TYPE', 'Transaction Code'];
  topHeaders.forEach((h, i) => {
    const cell = sheet.getCell(14, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', wrapText: true, vertical: 'middle' };
    cell.border = border;
    sheet.mergeCells(14, i + 1, 15, i + 1);
  });

  let col = 5;
  for (let w = 1; w <= 5; w++) {
    sheet.mergeCells(14, col, 14, col + 1);
    const cell = sheet.getCell(14, col);
    cell.value = String(w);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center' };
    cell.border = border;
    sheet.getCell(14, col + 1).border = border;
    sheet.getCell(14, col + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };

    ['Employee', 'Employer'].forEach((sub, si) => {
      const c = sheet.getCell(15, col + si);
      c.value = sub;
      c.font = { bold: true, size: 8 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
      c.alignment = { horizontal: 'center' };
      c.border = border;
    });
    col += 2;
  }
  sheet.mergeCells(14, col, 15, col);
  const totH = sheet.getCell(14, col);
  totH.value = 'TOTAL';
  totH.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  totH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  totH.alignment = { horizontal: 'center', vertical: 'middle' };
  totH.border = border;

  let row = 16;
  const rows = npf?.rows || [];
  for (const r of rows) {
    const vals = [
      r.npfNumber || '',
      r.name || '',
      r.transactionType || 'Compulsory',
      r.transactionCode || '',
      ...(r.weeks || []).flatMap((w) => [money(w.employee), money(w.employer)]),
      money(r.total),
    ];
    // pad weeks to 5
    while (vals.length < 15) vals.splice(vals.length - 1, 0, '-');
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.border = border;
      cell.font = { size: 9 };
      if (i >= 4) cell.alignment = { horizontal: 'right' };
    });
    row += 1;
  }

  // TOTAL CONTRIBUTIONS
  sheet.mergeCells(row, 1, row, 4);
  const totLabel = sheet.getCell(row, 1);
  totLabel.value = 'TOTAL CONTRIBUTIONS';
  totLabel.font = { bold: true, size: 10 };
  totLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E7FF' } };
  totLabel.border = border;
  for (let i = 2; i <= 4; i++) {
    sheet.getCell(row, i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E7FF' } };
    sheet.getCell(row, i).border = border;
  }

  const weekTotals = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  let grand = 0;
  for (const r of rows) {
    (r.weeks || []).forEach((w, wi) => {
      weekTotals[wi * 2] += Number(w.employee) || 0;
      weekTotals[wi * 2 + 1] += Number(w.employer) || 0;
    });
    grand += Number(r.total) || 0;
  }
  weekTotals.forEach((v, i) => {
    const cell = sheet.getCell(row, 5 + i);
    cell.value = round2(v);
    cell.font = { bold: true };
    cell.border = border;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E7FF' } };
  });
  const gCell = sheet.getCell(row, 15);
  gCell.value = round2(grand || npf?.paymentsTotal || 0);
  gCell.font = { bold: true };
  gCell.border = border;
  gCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E7FF' } };

  // Loan repayments
  row += 3;
  sheet.mergeCells(row, 1, row, 15);
  sheet.getCell(row, 1).value = 'Loan Repayments';
  sheet.getCell(row, 1).font = { bold: true, size: 11 };
  row += 1;
  ['Account Number', 'Employee Name'].forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    cell.border = border;
  });
  let lc = 3;
  for (let w = 1; w <= 5; w++) {
    sheet.mergeCells(row, lc, row, lc + 1);
    sheet.getCell(row, lc).value = String(w);
    sheet.getCell(row, lc).font = { bold: true, size: 8 };
    sheet.getCell(row, lc).alignment = { horizontal: 'center' };
    sheet.getCell(row, lc).border = border;
    sheet.getCell(row, lc + 1).border = border;
    lc += 2;
  }
  sheet.getCell(row, 13).value = 'TOTAL';
  sheet.getCell(row, 13).font = { bold: true, size: 8 };
  sheet.getCell(row, 13).border = border;
  row += 1;
  const loans = npf?.loanRepayments?.length ? npf.loanRepayments : [{ accountNumber: '-', name: '-' }];
  for (const loan of loans) {
    sheet.getCell(row, 1).value = loan.accountNumber || '-';
    sheet.getCell(row, 2).value = loan.name || '-';
    for (let i = 1; i <= 13; i++) sheet.getCell(row, i).border = border;
    for (let i = 3; i <= 12; i++) sheet.getCell(row, i).value = '-';
    row += 1;
  }

  // Voluntary
  row += 2;
  sheet.mergeCells(row, 1, row, 15);
  sheet.getCell(row, 1).value = 'Voluntary payments';
  sheet.getCell(row, 1).font = { bold: true, size: 11 };
  row += 1;
  ['NPF NUMBER', 'Employee Name', 'Transaction Type'].forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
    cell.border = border;
  });
  row += 1;
  const vols = npf?.voluntary?.length ? npf.voluntary : [{ npfNumber: '-', name: '-', transactionType: 'Voluntary-Self' }];
  for (const v of vols) {
    sheet.getCell(row, 1).value = v.npfNumber || '-';
    sheet.getCell(row, 2).value = v.name || '-';
    sheet.getCell(row, 3).value = v.transactionType || 'Voluntary-Self';
    for (let i = 1; i <= 13; i++) sheet.getCell(row, i).border = border;
    for (let i = 4; i <= 13; i++) sheet.getCell(row, i).value = '-';
    row += 1;
  }

  sheet.getColumn(1).width = 12;
  sheet.getColumn(2).width = 20;
  sheet.getColumn(3).width = 16;
  sheet.getColumn(4).width = 12;
  for (let i = 5; i <= 15; i++) sheet.getColumn(i).width = 9;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `NPF_${months[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamNpfSheetPdf(res, { year, month, employer, period, npf }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `NPF_${months[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A')
    .text('SAMOA NATIONAL PROVIDENT FUND', { align: 'center' });
  doc.moveDown(0.6);

  doc.fontSize(9).font('Helvetica');
  doc.text(`EMPLOYER NUMBER: ${employer?.npfEmployerNumber || '—'}`);
  doc.text(`EMPLOYER NAME: ${employer?.companyName || '—'}`);
  doc.text(`EMAIL/ADDRESS: ${employer?.companyAddress || employer?.companyEmail || '—'}`);
  doc.text(`TELEPHONE: ${employer?.companyPhone || '—'}    ZONE: ${employer?.npfZone || '—'}`);
  doc.moveDown(0.3);
  doc.text(`Period Start: ${fmtDate(period?.start)}    Period End: ${fmtDate(period?.end)}`);
  doc.text(`Schedule Frequency: ${period?.frequency || 'Monthly'}    Payments Total: ${round2(npf?.paymentsTotal || 0)}`);
  doc.moveDown(0.5);

  const rows = npf?.rows || [];
  const headers = ['NPF #', 'Employee', 'Type', 'Code', '1 Emp', '1 Er', '2 Emp', '2 Er', '3 Emp', '3 Er', '4 Emp', '4 Er', '5 Emp', '5 Er', 'TOTAL'];
  const pageW = doc.page.width - 60;
  const colW = pageW / headers.length;
  let y = doc.y;
  doc.rect(30, y, pageW, 16).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(7).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, 30 + i * colW, y + 4, { width: colW - 2, align: 'center' }));
  y += 18;

  doc.font('Helvetica').fontSize(7).fillColor('#334155');
  for (const r of rows) {
    if (y > doc.page.height - 80) {
      doc.addPage();
      y = 40;
    }
    const vals = [
      r.npfNumber || '',
      r.name || '',
      r.transactionType || 'Compulsory',
      r.transactionCode || '',
      ...(r.weeks || []).flatMap((w) => [String(money(w.employee)), String(money(w.employer))]),
      String(money(r.total)),
    ];
    while (vals.length < 15) vals.splice(vals.length - 1, 0, '-');
    vals.forEach((v, i) => doc.text(v, 30 + i * colW, y, { width: colW - 2, align: i < 3 ? 'left' : 'right', ellipsis: true }));
    y += 11;
  }

  y += 4;
  doc.font('Helvetica-Bold').fillColor('#0F172A')
    .text(`TOTAL CONTRIBUTIONS: ${round2(npf?.paymentsTotal || 0)}`, 30, y);
  y += 20;
  doc.fontSize(10).text('Loan Repayments', 30, y);
  y += 12;
  doc.fontSize(8).font('Helvetica').fillColor('#64748B').text('(none recorded)', 30, y);
  y += 16;
  doc.fontSize(10).font('Helvetica-Bold').fillColor('#0F172A').text('Voluntary payments', 30, y);
  y += 12;
  doc.fontSize(8).font('Helvetica').fillColor('#64748B').text('(none recorded)', 30, y);

  doc.end();
}
