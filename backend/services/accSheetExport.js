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

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const normalizeAccDept = (name) => {
  const n = String(name || '').toLowerCase();
  if (/caf[eé]/.test(n)) return 'Cafe';
  if (/chemist/.test(n)) return 'Chemist';
  return String(name || 'Other');
};

const computeDeptTotals = (rows = []) => {
  let cafe = 0;
  let chemist = 0;
  let all = 0;
  for (const r of rows) {
    const t = Number(r.total) || 0;
    all += t;
    const dept = normalizeAccDept(r.departmentName);
    if (dept === 'Cafe') cafe += t;
    else if (dept === 'Chemist') chemist += t;
  }
  return { all: round2(all), cafe: round2(cafe), chemist: round2(chemist) };
};

/**
 * ACC Schedule Excel matching authority form.
 */
export async function writeAccSheetExcel(res, { year, month, employer, acc }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ACC Schedule');
  const rows = acc?.rows || [];
  const totals = computeDeptTotals(rows);
  const grand = totals.all || acc?.total || 0;
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;

  sheet.mergeCells('A1:M1');
  sheet.getCell('A1').value = 'ACC SCHEDULE';
  sheet.getCell('A1').font = { bold: true, size: 16 };
  sheet.getCell('A1').alignment = { horizontal: 'center' };

  sheet.getCell('A3').value = 'Employer name';
  sheet.getCell('A3').font = { bold: true };
  sheet.getCell('B3').value = employer?.companyName || '';
  sheet.mergeCells('B3:D3');

  sheet.getCell('A4').value = 'Month of';
  sheet.getCell('A4').font = { bold: true };
  sheet.getCell('B4').value = monthLabel;

  sheet.getCell('A5').value = 'Emp. Numbers';
  sheet.getCell('A5').font = { bold: true };
  sheet.getCell('B5').value = employer?.accEmpNumber1 || '';
  sheet.getCell('C5').value = employer?.accEmpNumber2 || '';

  // Headers row 7-8
  const base = ['#', 'Employees name'];
  base.forEach((h, i) => {
    sheet.mergeCells(7, i + 1, 8, i + 1);
    const cell = sheet.getCell(7, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  });

  let col = 3;
  for (let w = 1; w <= 5; w++) {
    sheet.mergeCells(7, col, 7, col + 1);
    const cell = sheet.getCell(7, col);
    cell.value = `Week ${w}`;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center' };
    cell.border = border;
    sheet.getCell(7, col + 1).border = border;
    sheet.getCell(7, col + 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };

    ['Employee', 'Employer'].forEach((sub, si) => {
      const c = sheet.getCell(8, col + si);
      c.value = sub;
      c.font = { bold: true, size: 8 };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } };
      c.alignment = { horizontal: 'center' };
      c.border = border;
    });
    col += 2;
  }
  sheet.mergeCells(7, col, 8, col);
  const totH = sheet.getCell(7, col);
  totH.value = 'TOTAL';
  totH.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
  totH.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  totH.alignment = { horizontal: 'center', vertical: 'middle' };
  totH.border = border;

  let row = 9;
  for (const r of rows) {
    const vals = [
      r.row || '',
      r.name || '',
      ...(r.weeks || []).flatMap((w) => [money(w.employee), money(w.employer)]),
      money(r.total),
    ];
    while (vals.length < 13) vals.splice(vals.length - 1, 0, money(0));
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.border = border;
      cell.font = { size: 9 };
      if (i >= 2) cell.alignment = { horizontal: 'right' };
    });
    row += 1;
  }

  // Footer totals
  row += 1;
  sheet.getCell(row, 11).value = 'Total ACC Cafe & Chemist';
  sheet.getCell(row, 11).font = { bold: true };
  sheet.getCell(row, 13).value = money(grand);
  sheet.getCell(row, 13).font = { bold: true, underline: true };
  row += 1;
  sheet.getCell(row, 12).value = 'Cafe';
  sheet.getCell(row, 12).font = { bold: true };
  sheet.getCell(row, 13).value = money(acc?.cafeTotal ?? totals.cafe);
  row += 1;
  sheet.getCell(row, 12).value = 'Chemist';
  sheet.getCell(row, 12).font = { bold: true };
  sheet.getCell(row, 13).value = money(acc?.chemistTotal ?? totals.chemist);

  sheet.getColumn(1).width = 5;
  sheet.getColumn(2).width = 22;
  for (let i = 3; i <= 13; i++) sheet.getColumn(i).width = 10;

  const filename = `ACC_${MONTH_SHORT[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamAccSheetPdf(res, { year, month, employer, acc }) {
  const filename = `ACC_${MONTH_SHORT[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const rows = acc?.rows || [];
  const totals = computeDeptTotals(rows);
  const grand = totals.all || acc?.total || 0;
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text('ACC SCHEDULE', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica');
  doc.text(`Employer name: ${employer?.companyName || '—'}`);
  doc.text(`Month of: ${monthLabel}`);
  doc.text(`Emp. Numbers: ${employer?.accEmpNumber1 || '—'}   ${employer?.accEmpNumber2 || '—'}`);
  doc.moveDown(0.5);

  const headers = ['#', 'Employees name', 'W1 Emp', 'W1 Er', 'W2 Emp', 'W2 Er', 'W3 Emp', 'W3 Er', 'W4 Emp', 'W4 Er', 'W5 Emp', 'W5 Er', 'TOTAL'];
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
      String(r.row || ''),
      r.name || '',
      ...(r.weeks || []).flatMap((w) => [money(w.employee), money(w.employer)]),
      money(r.total),
    ];
    while (vals.length < 13) vals.splice(vals.length - 1, 0, money(0));
    vals.forEach((v, i) =>
      doc.text(v, 30 + i * colW, y, { width: colW - 2, align: i < 2 ? 'left' : 'right', ellipsis: true })
    );
    y += 11;
  }

  y += 12;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A');
  doc.text(`Total ACC Cafe & Chemist: ${money(grand)}`, 30, y);
  y += 14;
  doc.text(`Cafe: ${money(acc?.cafeTotal ?? totals.cafe)}`, 30, y);
  y += 14;
  doc.text(`Chemist: ${money(acc?.chemistTotal ?? totals.chemist)}`, 30, y);

  doc.end();
}
