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
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 24 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const left = 24;
  const pageW = doc.page.width - 48;
  const rows = npf?.rows || [];
  const loans = npf?.loanRepayments?.length
    ? npf.loanRepayments
    : [{ accountNumber: '—', name: '—', weeks: [0, 0, 0, 0, 0], total: 0 }];
  const vols = npf?.voluntary?.length
    ? npf.voluntary
    : [{ npfNumber: '—', name: '—', transactionType: 'Voluntary-Self', weeks: [0, 0, 0, 0, 0], total: 0 }];

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

  const ensureWeeks = (r) => {
    const weeks = [...(r.weeks || [])];
    while (weeks.length < 5) weeks.push({ employee: 0, employer: 0 });
    return weeks.slice(0, 5).map((w) =>
      typeof w === 'object' && w !== null && ('employee' in w || 'employer' in w)
        ? { employee: Number(w.employee) || 0, employer: Number(w.employer) || 0 }
        : { employee: Number(w) || 0, employer: 0 }
    );
  };

  // Title
  let y = 22;
  doc
    .font('Helvetica-Bold')
    .fontSize(16)
    .fillColor('#0F172A')
    .text('SAMOA NATIONAL PROVIDENT FUND', left, y, {
      width: pageW,
      align: 'center',
      lineBreak: false,
    });
  y += 22;

  // Employer header block (two columns)
  const info = [
    ['EMPLOYER NO:', employer?.npfEmployerNumber || '—'],
    ['EMPLOYER NAME:', employer?.companyName || '—'],
    ['EMAIL/ADDRESS:', employer?.companyAddress || employer?.companyEmail || '—'],
    ['TELEPHONE:', employer?.companyPhone || '—'],
    ['ZONE:', employer?.npfZone || '—'],
  ];
  const periodInfo = [
    ['Period Start:', fmtDate(period?.start)],
    ['Period End:', fmtDate(period?.end)],
    ['Schedule Freq:', period?.frequency || 'Monthly'],
    ['Payments Tot:', round2(npf?.paymentsTotal || 0)],
  ];
  const infoStart = y;
  info.forEach(([lab, val], i) => {
    const iy = infoStart + i * 12;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(lab, left, iy, { lineBreak: false });
    doc.font('Helvetica').text(String(val), left + 100, iy, { width: 280, lineBreak: false, ellipsis: true });
  });
  periodInfo.forEach(([lab, val], i) => {
    const iy = infoStart + i * 12;
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#0F172A').text(lab, left + pageW * 0.55, iy, {
      lineBreak: false,
    });
    doc.font('Helvetica').text(String(val), left + pageW * 0.55 + 90, iy, { lineBreak: false });
  });
  y = infoStart + 5 * 12 + 10;

  // Main contribution table columns
  // NPF# | Name | Type | Code | 5×(Emp,Er) | TOTAL  = 15 cols
  const base = [pageW * 0.07, pageW * 0.14, pageW * 0.1, pageW * 0.07];
  const weekW = (pageW - base.reduce((s, n) => s + n, 0)) / 11;
  const widths = [...base, ...Array.from({ length: 10 }, () => weekW), weekW];
  const xAt = (i) => left + widths.slice(0, i).reduce((s, w) => s + w, 0);

  const h1 = 14;
  const h2 = 12;

  // Header row 1
  ['NPF #', 'EMPLOYEE NAME', 'TRANSACTION TYPE', 'Transaction Code'].forEach((h, i) => {
    cell(h, xAt(i), y, widths[i], h1 + h2, {
      fill: `#${HEADER_BLUE}`,
      stroke: `#${HEADER_BLUE}`,
      color: '#FFFFFF',
      bold: true,
      align: 'center',
      fontSize: 7,
    });
  });
  for (let w = 0; w < 5; w++) {
    const cx = xAt(4 + w * 2);
    const ww = widths[4 + w * 2] + widths[5 + w * 2];
    cell(String(w + 1), cx, y, ww, h1, {
      fill: `#${HEADER_BLUE}`,
      stroke: `#${HEADER_BLUE}`,
      color: '#FFFFFF',
      bold: true,
      align: 'center',
      fontSize: 8,
    });
  }
  cell('TOTAL', xAt(14), y, widths[14], h1 + h2, {
    fill: `#${HEADER_BLUE}`,
    stroke: `#${HEADER_BLUE}`,
    color: '#FFFFFF',
    bold: true,
    align: 'center',
    fontSize: 8,
  });
  y += h1;

  // Header row 2 — Employee / Employer
  for (let w = 0; w < 5; w++) {
    cell('Employee', xAt(4 + w * 2), y, widths[4 + w * 2], h2, {
      fill: '#DBEAFE',
      bold: true,
      align: 'center',
      fontSize: 6.5,
    });
    cell('Employer', xAt(5 + w * 2), y, widths[5 + w * 2], h2, {
      fill: '#DBEAFE',
      bold: true,
      align: 'center',
      fontSize: 6.5,
    });
  }
  y += h2;

  const rowH = 12;
  const weekTotals = Array.from({ length: 10 }, () => 0);
  let grand = 0;

  const drawMainHeader = () => {
    ['NPF #', 'EMPLOYEE NAME', 'TYPE', 'Code'].forEach((h, i) => {
      cell(h, xAt(i), y, widths[i], 12, {
        fill: `#${HEADER_BLUE}`,
        stroke: `#${HEADER_BLUE}`,
        color: '#FFFFFF',
        bold: true,
        align: 'center',
        fontSize: 6.5,
      });
    });
    for (let i = 4; i < 14; i++) {
      cell(i % 2 === 0 ? 'Emp' : 'Er', xAt(i), y, widths[i], 12, {
        fill: `#${HEADER_BLUE}`,
        stroke: `#${HEADER_BLUE}`,
        color: '#FFFFFF',
        bold: true,
        align: 'center',
        fontSize: 6,
      });
    }
    cell('TOTAL', xAt(14), y, widths[14], 12, {
      fill: `#${HEADER_BLUE}`,
      stroke: `#${HEADER_BLUE}`,
      color: '#FFFFFF',
      bold: true,
      align: 'center',
      fontSize: 6.5,
    });
    y += 12;
  };

  for (const r of rows) {
    if (y > doc.page.height - 160) {
      doc.addPage();
      y = 28;
      drawMainHeader();
    }
    const weeks = ensureWeeks(r);
    const vals = [
      r.npfNumber || '',
      r.name || '',
      r.transactionType || 'Compulsory',
      r.transactionCode || '',
      ...weeks.flatMap((w) => [money(w.employee), money(w.employer)]),
      money(r.total),
    ];
    vals.forEach((v, i) => {
      cell(v, xAt(i), y, widths[i], rowH, {
        align: i < 4 ? (i === 0 || i === 1 ? 'left' : 'center') : 'right',
        fontSize: 7,
      });
    });
    weeks.forEach((w, wi) => {
      weekTotals[wi * 2] += Number(w.employee) || 0;
      weekTotals[wi * 2 + 1] += Number(w.employer) || 0;
    });
    grand += Number(r.total) || 0;
    y += rowH;
  }

  // TOTAL CONTRIBUTIONS
  cell('TOTAL CONTRIBUTIONS', xAt(0), y, widths[0] + widths[1] + widths[2] + widths[3], rowH + 2, {
    fill: '#E0E7FF',
    bold: true,
    fontSize: 8,
  });
  weekTotals.forEach((v, i) => {
    cell(round2(v), xAt(4 + i), y, widths[4 + i], rowH + 2, {
      fill: '#E0E7FF',
      bold: true,
      align: 'right',
      fontSize: 7,
    });
  });
  cell(round2(grand || npf?.paymentsTotal || 0), xAt(14), y, widths[14], rowH + 2, {
    fill: '#E0E7FF',
    bold: true,
    align: 'right',
    fontSize: 8,
  });
  y += rowH + 16;

  // Loan Repayments
  if (y > doc.page.height - 100) {
    doc.addPage();
    y = 28;
  }
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('Loan Repayments', left, y, {
    lineBreak: false,
  });
  y += 16;

  // Loan cols: Account | Name | 1 2 3 4 5 (each can be single amount) | TOTAL
  // Match Excel: Account, Name, weeks 1-5 (merged emp/er style as single week cols), TOTAL
  const loanW = [
    pageW * 0.12,
    pageW * 0.18,
    pageW * 0.12,
    pageW * 0.12,
    pageW * 0.12,
    pageW * 0.12,
    pageW * 0.12,
    pageW * 0.1,
  ];
  const lx = (i) => left + loanW.slice(0, i).reduce((s, w) => s + w, 0);
  ['Account Number', 'Employee Name', '1', '2', '3', '4', '5', 'TOTAL'].forEach((h, i) => {
    cell(h, lx(i), y, loanW[i], 14, {
      fill: '#DBEAFE',
      bold: true,
      align: 'center',
      fontSize: 7,
    });
  });
  y += 14;
  for (const loan of loans) {
    const weekVals = Array.isArray(loan.weeks)
      ? loan.weeks.map((w) => (typeof w === 'object' ? Number(w.employee || w.amount || 0) : Number(w) || 0))
      : [0, 0, 0, 0, 0];
    while (weekVals.length < 5) weekVals.push(0);
    const loanTotal =
      loan.total != null
        ? Number(loan.total) || 0
        : weekVals.reduce((s, n) => s + n, 0);
    const vals = [
      loan.accountNumber || '—',
      loan.name || '—',
      ...weekVals.map((n) => (n ? round2(n) : '—')),
      loanTotal ? round2(loanTotal) : '—',
    ];
    vals.forEach((v, i) => {
      cell(v, lx(i), y, loanW[i], rowH, {
        align: i < 2 ? 'left' : 'right',
        fontSize: 7,
      });
    });
    y += rowH;
  }

  y += 14;

  // Voluntary payments
  if (y > doc.page.height - 90) {
    doc.addPage();
    y = 28;
  }
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#0F172A').text('Voluntary payments', left, y, {
    lineBreak: false,
  });
  y += 16;

  const volW = [
    pageW * 0.1,
    pageW * 0.16,
    pageW * 0.12,
    pageW * 0.1,
    pageW * 0.1,
    pageW * 0.1,
    pageW * 0.1,
    pageW * 0.1,
    pageW * 0.12,
  ];
  const vx = (i) => left + volW.slice(0, i).reduce((s, w) => s + w, 0);
  ['NPF NUMBER', 'Employee Name', 'Transaction Type', '1', '2', '3', '4', '5', 'TOTAL'].forEach(
    (h, i) => {
      cell(h, vx(i), y, volW[i], 14, {
        fill: '#DBEAFE',
        bold: true,
        align: 'center',
        fontSize: 7,
      });
    }
  );
  y += 14;
  for (const v of vols) {
    const weekVals = Array.isArray(v.weeks)
      ? v.weeks.map((w) => (typeof w === 'object' ? Number(w.employee || w.amount || 0) : Number(w) || 0))
      : [0, 0, 0, 0, 0];
    while (weekVals.length < 5) weekVals.push(0);
    const volTotal =
      v.total != null ? Number(v.total) || 0 : weekVals.reduce((s, n) => s + n, 0);
    const vals = [
      v.npfNumber || '—',
      v.name || '—',
      v.transactionType || 'Voluntary-Self',
      ...weekVals.map((n) => (n ? round2(n) : '—')),
      volTotal ? round2(volTotal) : '—',
    ];
    vals.forEach((val, i) => {
      cell(val, vx(i), y, volW[i], rowH, {
        align: i < 3 ? 'left' : 'right',
        fontSize: 7,
      });
    });
    y += rowH;
  }

  doc.end();
}
