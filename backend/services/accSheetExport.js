import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { round2 } from '../utils/helpers.js';

const border = {
  top: { style: 'thin', color: { argb: '000000' } },
  left: { style: 'thin', color: { argb: '000000' } },
  bottom: { style: 'thin', color: { argb: '000000' } },
  right: { style: 'thin', color: { argb: '000000' } },
};

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const normalizeAccDept = (name) => {
  const n = String(name || '').toLowerCase();
  if (/caf[eé]/.test(n)) return 'Cafe';
  if (/chemist/.test(n)) return 'Chemist';
  return 'Other';
};

export const splitAccRowsByDept = (rows = []) => {
  const cafe = [];
  const chemist = [];
  const other = [];
  for (const r of rows) {
    const dept = normalizeAccDept(r.departmentName);
    if (dept === 'Cafe') cafe.push(r);
    else if (dept === 'Chemist') chemist.push(r);
    else other.push(r);
  }
  return { cafe, chemist, other };
};

const sumRows = (rows) => round2(rows.reduce((s, r) => s + (Number(r.total) || 0), 0));

const ensureWeeks = (r) => {
  const weeks = [...(r.weeks || [])];
  while (weeks.length < 5) weeks.push({ employee: 0, employer: 0 });
  return weeks.slice(0, 5);
};

/**
 * Write one ACC SCHEDULE block (screenshot format) onto an Excel sheet.
 * Returns next free row index.
 */
const writeAccBlockExcel = (sheet, startRow, { employerName, monthLabel, empNumber, label, rows }) => {
  let row = startRow;

  sheet.mergeCells(row, 1, row, 13);
  const title = sheet.getCell(row, 1);
  title.value = 'ACC SCHEDULE';
  title.font = { bold: true, size: 16 };
  title.alignment = { horizontal: 'center' };
  row += 2;

  // Header box (matches screenshot top-left block)
  sheet.getCell(row, 1).value = 'Employer name';
  sheet.getCell(row, 1).font = { bold: true, size: 10 };
  sheet.getCell(row, 1).border = border;
  sheet.mergeCells(row, 2, row, 4);
  sheet.getCell(row, 2).value = employerName || '';
  sheet.getCell(row, 2).border = border;
  sheet.getCell(row, 3).border = border;
  sheet.getCell(row, 4).border = border;
  row += 1;

  sheet.getCell(row, 1).value = 'Month of';
  sheet.getCell(row, 1).font = { bold: true, size: 10 };
  sheet.getCell(row, 1).border = border;
  sheet.getCell(row, 2).value = monthLabel;
  sheet.getCell(row, 2).border = border;
  row += 1;

  sheet.getCell(row, 1).value = 'Emp. Numbers';
  sheet.getCell(row, 1).font = { bold: true, size: 10 };
  sheet.getCell(row, 1).border = border;
  sheet.getCell(row, 2).value = empNumber || '';
  sheet.getCell(row, 2).border = border;
  sheet.getCell(row, 2).alignment = { horizontal: 'center' };
  if (label) {
    sheet.getCell(row, 3).value = label;
    sheet.getCell(row, 3).font = { bold: true, size: 10 };
  }
  row += 2;

  // Column headers — row 1: #, Name, Week 1..5, TOTAL
  const headerRow1 = row;
  const headerRow2 = row + 1;

  const styleHeader = (cell) => {
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border;
  };

  sheet.mergeCells(headerRow1, 1, headerRow2, 1);
  sheet.getCell(headerRow1, 1).value = '#';
  styleHeader(sheet.getCell(headerRow1, 1));

  sheet.mergeCells(headerRow1, 2, headerRow2, 2);
  sheet.getCell(headerRow1, 2).value = 'Employees name';
  styleHeader(sheet.getCell(headerRow1, 2));

  let col = 3;
  for (let w = 1; w <= 5; w++) {
    sheet.mergeCells(headerRow1, col, headerRow1, col + 1);
    sheet.getCell(headerRow1, col).value = `Week ${w}`;
    styleHeader(sheet.getCell(headerRow1, col));
    sheet.getCell(headerRow1, col + 1).border = border;

    sheet.getCell(headerRow2, col).value = 'Employee';
    styleHeader(sheet.getCell(headerRow2, col));
    sheet.getCell(headerRow2, col + 1).value = 'Employer';
    styleHeader(sheet.getCell(headerRow2, col + 1));
    col += 2;
  }

  sheet.mergeCells(headerRow1, col, headerRow2, col);
  sheet.getCell(headerRow1, col).value = 'TOTAL';
  styleHeader(sheet.getCell(headerRow1, col));

  row = headerRow2 + 1;

  const list = rows.length
    ? rows
    : [{ row: 1, name: '', weeks: Array.from({ length: 5 }, () => ({ employee: 0, employer: 0 })), total: 0 }];

  list.forEach((r, idx) => {
    const weeks = ensureWeeks(r);
    const vals = [
      idx + 1,
      r.name || '',
      ...weeks.flatMap((w) => [money(w.employee), money(w.employer)]),
      money(r.total),
    ];
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.border = border;
      cell.font = { size: 9 };
      if (i === 0) cell.alignment = { horizontal: 'center' };
      else if (i >= 2) cell.alignment = { horizontal: 'center' };
    });
    row += 1;
  });

  // Footer total for this table only
  row += 1;
  sheet.mergeCells(row, 10, row, 12);
  sheet.getCell(row, 10).value = `Total ACC ${label || ''}`.trim();
  sheet.getCell(row, 10).font = { bold: true, size: 10 };
  sheet.getCell(row, 10).alignment = { horizontal: 'right' };
  sheet.getCell(row, 13).value = money(sumRows(rows));
  sheet.getCell(row, 13).font = { bold: true, underline: true, size: 10 };
  sheet.getCell(row, 13).alignment = { horizontal: 'center' };
  sheet.getCell(row, 13).border = border;

  return row + 3;
};

/**
 * ACC Schedule Excel — two tables (Cafe + Chemist), screenshot format.
 */
export async function writeAccSheetExcel(res, { year, month, employer, acc }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('ACC Schedule');
  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;
  const { cafe, chemist } = splitAccRowsByDept(acc?.rows || []);
  const company = employer?.companyName || '';

  let next = writeAccBlockExcel(sheet, 1, {
    employerName: company,
    monthLabel,
    empNumber: employer?.accEmpNumber1 || '',
    label: 'Cafe',
    rows: cafe,
  });

  next = writeAccBlockExcel(sheet, next, {
    employerName: company,
    monthLabel,
    empNumber: employer?.accEmpNumber2 || '',
    label: 'Chemist',
    rows: chemist,
  });

  // Combined total block (matches screenshot footer)
  const cafeTot = sumRows(cafe);
  const chemistTot = sumRows(chemist);
  const grand = round2(cafeTot + chemistTot);

  sheet.mergeCells(next, 10, next, 12);
  sheet.getCell(next, 10).value = 'Total ACC Cafe & Chemist';
  sheet.getCell(next, 10).font = { bold: true, size: 10 };
  sheet.getCell(next, 10).alignment = { horizontal: 'right' };
  sheet.getCell(next, 13).value = money(grand);
  sheet.getCell(next, 13).font = { bold: true, underline: true, size: 10 };
  sheet.getCell(next, 13).border = border;
  next += 1;

  sheet.mergeCells(next, 10, next, 12);
  sheet.getCell(next, 10).value = 'Cafe';
  sheet.getCell(next, 10).font = { bold: true, size: 10 };
  sheet.getCell(next, 10).alignment = { horizontal: 'right' };
  sheet.getCell(next, 13).value = money(cafeTot);
  sheet.getCell(next, 13).font = { bold: true, underline: true, size: 10 };
  sheet.getCell(next, 13).border = border;
  next += 1;

  sheet.mergeCells(next, 10, next, 12);
  sheet.getCell(next, 10).value = 'Chemist';
  sheet.getCell(next, 10).font = { bold: true, size: 10 };
  sheet.getCell(next, 10).alignment = { horizontal: 'right' };
  sheet.getCell(next, 13).value = money(chemistTot);
  sheet.getCell(next, 13).font = { bold: true, underline: true, size: 10 };
  sheet.getCell(next, 13).border = border;

  sheet.getColumn(1).width = 6;
  sheet.getColumn(2).width = 22;
  for (let i = 3; i <= 13; i++) sheet.getColumn(i).width = 10;

  const filename = `ACC_${MONTH_SHORT[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

const drawAccBlockPdf = (doc, { employerName, monthLabel, empNumber, label, rows, startY }) => {
  const left = 30;
  const pageW = doc.page.width - 60;
  let y = startY;

  if (y > doc.page.height - 220) {
    doc.addPage();
    y = 40;
  }

  doc
    .fontSize(14)
    .font('Helvetica-Bold')
    .fillColor('#0F172A')
    .text('ACC SCHEDULE', left, y, { width: pageW, align: 'center', lineBreak: false });
  y += 22;

  // Header box — screenshot top-left block
  doc.fontSize(9).font('Helvetica').fillColor('#0F172A');
  doc.rect(left, y, 300, 48).stroke('#000000');
  doc.text('Employer name', left + 4, y + 4, { lineBreak: false });
  doc.font('Helvetica-Bold').text(employerName || '—', left + 100, y + 4, {
    width: 190,
    lineBreak: false,
    ellipsis: true,
  });
  doc.font('Helvetica').text('Month of', left + 4, y + 18, { lineBreak: false });
  doc.font('Helvetica-Bold').text(monthLabel, left + 100, y + 18, { lineBreak: false });
  doc.font('Helvetica').text('Emp. Numbers', left + 4, y + 32, { lineBreak: false });
  doc.font('Helvetica-Bold').text(String(empNumber || '—'), left + 100, y + 32, { lineBreak: false });
  doc.font('Helvetica-Bold').text(label, left + 200, y + 32, { lineBreak: false });
  y += 58;

  // Column widths: # | name | 5 weeks × (emp+er) | TOTAL
  const wNum = 28;
  const wName = 120;
  const wMoney = (pageW - wNum - wName) / 11;
  const colWidths = [wNum, wName, ...Array.from({ length: 10 }, () => wMoney), wMoney];

  const colX = (i) => left + colWidths.slice(0, i).reduce((s, w) => s + w, 0);

  // Header row 1: #, name, Week 1..5 (merged), TOTAL
  const h1 = 14;
  const h2 = 14;
  doc.font('Helvetica-Bold').fontSize(7).fillColor('#0F172A');

  doc.rect(colX(0), y, colWidths[0], h1 + h2).stroke('#000000');
  doc.text('#', colX(0), y + 8, { width: colWidths[0], align: 'center', lineBreak: false });

  doc.rect(colX(1), y, colWidths[1], h1 + h2).stroke('#000000');
  doc.text('Employees name', colX(1) + 2, y + 8, {
    width: colWidths[1] - 4,
    align: 'center',
    lineBreak: false,
  });

  for (let w = 0; w < 5; w++) {
    const cx = colX(2 + w * 2);
    const ww = colWidths[2 + w * 2] + colWidths[3 + w * 2];
    doc.rect(cx, y, ww, h1).stroke('#000000');
    doc.text(`Week ${w + 1}`, cx, y + 3, { width: ww, align: 'center', lineBreak: false });
  }

  doc.rect(colX(12), y, colWidths[12], h1 + h2).stroke('#000000');
  doc.text('TOTAL', colX(12), y + 8, { width: colWidths[12], align: 'center', lineBreak: false });
  y += h1;

  // Header row 2: Employee / Employer under each week
  for (let w = 0; w < 5; w++) {
    const iEmp = 2 + w * 2;
    const iEr = 3 + w * 2;
    doc.rect(colX(iEmp), y, colWidths[iEmp], h2).stroke('#000000');
    doc.text('Employee', colX(iEmp), y + 3, {
      width: colWidths[iEmp],
      align: 'center',
      lineBreak: false,
    });
    doc.rect(colX(iEr), y, colWidths[iEr], h2).stroke('#000000');
    doc.text('Employer', colX(iEr), y + 3, {
      width: colWidths[iEr],
      align: 'center',
      lineBreak: false,
    });
  }
  y += h2;

  const list = rows.length
    ? rows
    : [{ name: '', weeks: Array.from({ length: 5 }, () => ({ employee: 0, employer: 0 })), total: 0 }];

  doc.font('Helvetica').fontSize(7).fillColor('#0F172A');
  list.forEach((r, idx) => {
    if (y > doc.page.height - 50) {
      doc.addPage();
      y = 40;
    }
    const weeks = ensureWeeks(r);
    const vals = [
      String(idx + 1),
      r.name || '',
      ...weeks.flatMap((wk) => [money(wk.employee), money(wk.employer)]),
      money(r.total),
    ];
    vals.forEach((v, i) => {
      doc.rect(colX(i), y, colWidths[i], 12).stroke('#000000');
      doc.text(v, colX(i) + 1, y + 2, {
        width: colWidths[i] - 2,
        align: i === 1 ? 'left' : 'center',
        ellipsis: true,
        lineBreak: false,
      });
    });
    y += 12;
  });

  y += 8;
  doc.font('Helvetica-Bold').fontSize(9);
  doc.text(`Total ACC ${label}: ${money(sumRows(rows))}`, left, y, {
    width: pageW,
    align: 'right',
    lineBreak: false,
  });
  return y + 28;
};

export function streamAccSheetPdf(res, { year, month, employer, acc }) {
  const filename = `ACC_${MONTH_SHORT[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 30 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const monthLabel = `${MONTH_SHORT[month - 1]}-${String(year).slice(-2)}`;
  const { cafe, chemist } = splitAccRowsByDept(acc?.rows || []);
  const company = employer?.companyName || '';

  let y = drawAccBlockPdf(doc, {
    employerName: company,
    monthLabel,
    empNumber: employer?.accEmpNumber1 || '',
    label: 'Cafe',
    rows: cafe,
    startY: 30,
  });

  y = drawAccBlockPdf(doc, {
    employerName: company,
    monthLabel,
    empNumber: employer?.accEmpNumber2 || '',
    label: 'Chemist',
    rows: chemist,
    startY: y,
  });

  const cafeTot = sumRows(cafe);
  const chemistTot = sumRows(chemist);
  const grand = round2(cafeTot + chemistTot);
  if (y > doc.page.height - 70) {
    doc.addPage();
    y = 40;
  }
  const pageW = doc.page.width - 60;
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#0F172A');
  doc.text(`Total ACC Cafe & Chemist: ${money(grand)}`, 30, y, {
    width: pageW,
    align: 'right',
    lineBreak: false,
  });
  y += 14;
  doc.text(`Cafe: ${money(cafeTot)}`, 30, y, { width: pageW, align: 'right', lineBreak: false });
  y += 14;
  doc.text(`Chemist: ${money(chemistTot)}`, 30, y, { width: pageW, align: 'right', lineBreak: false });

  doc.end();
}
