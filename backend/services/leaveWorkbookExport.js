import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { LEAVE_TYPE_LABELS } from '../models/LeaveEntry.js';

const TYPE_ORDER = ['annual', 'sick', 'maternity', 'paternity', 'bereavement'];
const TYPE_COLORS = {
  annual: 'BBF7D0',
  sick: 'FECACA',
  maternity: 'E9D5FF',
  paternity: 'BFDBFE',
  bereavement: 'FED7AA',
};
const HEADER_BLUE = '1E3A5F';

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const border = {
  top: { style: 'thin', color: { argb: '94A3B8' } },
  left: { style: 'thin', color: { argb: '94A3B8' } },
  bottom: { style: 'thin', color: { argb: '94A3B8' } },
  right: { style: 'thin', color: { argb: '94A3B8' } },
};

const fillCell = (cell, argb) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
  cell.border = border;
};

/**
 * Full leave workbook (ss1): Staff Leave Balance Dashboard + Usage Log.
 */
export async function writeLeaveWorkbookExcel(res, { dash, entries, asOf }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Leave Balance');
  const labels = dash.labels || LEAVE_TYPE_LABELS;
  const entitlements = dash.entitlements || {};
  const staff = dash.staff || [];
  const totals = dash.totals || {};

  // Title
  sheet.mergeCells(1, 1, 1, 22);
  const title = sheet.getCell(1, 1);
  title.value = 'STAFF LEAVE BALANCE DASHBOARD';
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, 22);
  sheet.getCell(2, 1).value =
    "Leave balances reset automatically on each employee's hire-date anniversary. Enter leave once in the log below; individual staff leave tabs update automatically.";
  sheet.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF64748B' } };

  // Entitlement chips row
  let col = 1;
  for (const t of TYPE_ORDER) {
    const h = sheet.getCell(4, col);
    h.value = labels[t] || t;
    h.font = { bold: true, size: 9 };
    fillCell(h, 'DBEAFE');
    const v = sheet.getCell(5, col);
    v.value = Number(entitlements[t] ?? 0);
    fillCell(v, 'FEF9C3');
    v.alignment = { horizontal: 'center' };
    col += 1;
  }
  sheet.getCell(4, col).value = 'As of Date';
  fillCell(sheet.getCell(4, col), 'DBEAFE');
  sheet.getCell(4, col).font = { bold: true, size: 9 };
  sheet.getCell(5, col).value = fmtDate(asOf);
  fillCell(sheet.getCell(5, col), 'FEF9C3');

  // Column headers
  const headerRow = 7;
  const baseHeaders = ['Staff Name', 'Hire Date', 'Current Leave Cycle', 'Next Anniversary', 'Days to Reset'];
  baseHeaders.forEach((h, i) => {
    const cell = sheet.getCell(headerRow, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
    fillCell(cell, HEADER_BLUE);
    cell.alignment = { horizontal: 'center', wrapText: true };
  });

  let c = 6;
  for (const t of TYPE_ORDER) {
    const color = TYPE_COLORS[t];
    for (const suffix of ['Ent.', 'Used', 'Left']) {
      const cell = sheet.getCell(headerRow, c);
      const short = (labels[t] || t).replace(' Leave', '');
      cell.value = `${short} ${suffix}`;
      cell.font = { bold: true, size: 8 };
      fillCell(cell, color);
      cell.alignment = { horizontal: 'center', wrapText: true };
      c += 1;
    }
  }
  for (const h of ['Status', 'Total Leave Left']) {
    const cell = sheet.getCell(headerRow, c);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
    fillCell(cell, HEADER_BLUE);
    cell.alignment = { horizontal: 'center', wrapText: true };
    c += 1;
  }

  let row = headerRow + 1;
  for (const s of staff) {
    const values = [
      s.staffName,
      fmtDate(s.hireDate),
      fmtDate(s.currentLeaveCycle),
      fmtDate(s.nextAnniversary),
      s.daysToReset ?? '',
    ];
    for (const t of TYPE_ORDER) {
      const x = s.types?.[t];
      if (!x || x.balanceStatus === 'Unavailable' || x.available === false) {
        values.push('—', '—', 'Unavailable');
      } else {
        values.push(x.entitlement ?? 0, x.used ?? 0, x.left ?? 0);
      }
    }
    values.push(s.status || '', s.totalLeaveLeft ?? 0);
    values.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 8 };
      cell.border = border;
      if (i === 20 && String(v).toLowerCase().includes('hire')) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FECACA' } };
      } else if (i === 20) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BBF7D0' } };
      }
    });
    row += 1;
  }

  // Summary boxes
  row += 1;
  const familyLeft = (totals.maternity || 0) + (totals.paternity || 0);
  const summary = [
    ['Annual Leave Left', totals.annual || 0],
    ['Sick Leave Left', totals.sick || 0],
    ['Family Leave Left', familyLeft],
    ['Bereavement', totals.bereavement || 0],
    ['Missing Hire Date', dash.missingHireDates || 0],
  ];
  summary.forEach(([lab, val], i) => {
    const lc = 1 + i * 2;
    sheet.getCell(row, lc).value = lab;
    sheet.getCell(row, lc).font = { bold: true, size: 9 };
    fillCell(sheet.getCell(row, lc), 'E0F2FE');
    sheet.getCell(row, lc + 1).value = val;
    fillCell(sheet.getCell(row, lc + 1), 'FEF9C3');
  });

  // Usage log
  row += 3;
  sheet.mergeCells(row, 1, row, 11);
  const logTitle = sheet.getCell(row, 1);
  logTitle.value = 'LEAVE REQUEST / USAGE LOG';
  logTitle.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  logTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  logTitle.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(row).height = 24;
  row += 1;

  const logHeaders = [
    'Entry #',
    'Staff Name',
    'Leave Type',
    'Start Date',
    'End Date',
    'Calculated Workdays',
    'Override Days',
    'Days Counted',
    'Status',
    'Approved By',
    'Notes',
  ];
  logHeaders.forEach((h, i) => {
    const cell = sheet.getCell(row, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
    fillCell(cell, HEADER_BLUE);
    cell.alignment = { horizontal: 'center', wrapText: true };
  });
  row += 1;

  const sorted = [...(entries || [])].sort(
    (a, b) => new Date(b.startDate) - new Date(a.startDate)
  );
  sorted.forEach((e, idx) => {
    const vals = [
      sorted.length - idx,
      e.employee?.fullName || '',
      labels[e.leaveType] || e.leaveType,
      fmtDate(e.startDate),
      fmtDate(e.endDate),
      e.calculatedWorkdays ?? '',
      e.overrideDays != null ? e.overrideDays : '',
      e.daysCounted ?? '',
      e.status || '',
      e.approvedBy || '',
      e.notes || '',
    ];
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.font = { size: 8 };
      cell.border = border;
      if (i === 8 && String(v) === 'Approved') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'BBF7D0' } };
      }
      if (i === 10) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF9C3' } };
      }
    });
    row += 1;
  });

  sheet.getColumn(1).width = 18;
  for (let i = 2; i <= 22; i++) sheet.getColumn(i).width = 11;
  sheet.getColumn(11).width = 22;

  const filename = `Leave_Balance_${String(asOf).slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamLeaveWorkbookPdf(res, { dash, entries, asOf }) {
  const filename = `Leave_Balance_${String(asOf).slice(0, 10)}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 28 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const labels = dash.labels || LEAVE_TYPE_LABELS;
  const entitlements = dash.entitlements || {};
  const staff = dash.staff || [];
  const totals = dash.totals || {};
  const pageW = doc.page.width - 56;

  doc.rect(28, 28, pageW, 22).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
    .text('STAFF LEAVE BALANCE DASHBOARD', 28, 33, { width: pageW, align: 'center' });

  doc.fillColor('#64748B').fontSize(8).font('Helvetica-Oblique')
    .text("Leave balances reset automatically on each employee's hire-date anniversary.", 28, 56, { width: pageW });

  let y = 72;
  doc.font('Helvetica').fontSize(8).fillColor('#0F172A');
  const entParts = TYPE_ORDER.map((t) => `${labels[t]}: ${entitlements[t] ?? 0}`).join('   |   ');
  doc.text(`${entParts}   |   As of: ${fmtDate(asOf)}`, 28, y);
  y += 16;

  const headers = [
    'Staff', 'Hire', 'Cycle', 'Next', 'Days',
    ...TYPE_ORDER.flatMap((t) => {
      const s = (labels[t] || t).slice(0, 3);
      return [`${s} E`, `${s} U`, `${s} L`];
    }),
    'Status', 'Total',
  ];
  const colW = pageW / headers.length;
  doc.font('Helvetica-Bold').fontSize(6);
  headers.forEach((h, i) => {
    doc.fillColor('#1E3A5F').text(h, 28 + i * colW, y, { width: colW - 2, align: 'center' });
  });
  y += 10;
  doc.moveTo(28, y).lineTo(28 + pageW, y).strokeColor('#94A3B8').stroke();
  y += 3;

  doc.font('Helvetica').fontSize(6.5).fillColor('#334155');
  for (const s of staff) {
    if (y > doc.page.height - 120) {
      doc.addPage();
      y = 40;
    }
    const cells = [
      s.staffName || '',
      fmtDate(s.hireDate),
      fmtDate(s.currentLeaveCycle),
      fmtDate(s.nextAnniversary),
      String(s.daysToReset ?? ''),
      ...TYPE_ORDER.flatMap((t) => {
        const x = s.types?.[t];
        if (!x || x.balanceStatus === 'Unavailable' || x.available === false) {
          return ['—', '—', 'Unavail.'];
        }
        return [String(x.entitlement ?? 0), String(x.used ?? 0), String(x.left ?? 0)];
      }),
      s.status || '',
      String(s.totalLeaveLeft ?? 0),
    ];
    cells.forEach((c, i) => {
      doc.text(c, 28 + i * colW, y, { width: colW - 2, align: i === 0 ? 'left' : 'center', ellipsis: true });
    });
    y += 10;
  }

  y += 8;
  const familyLeft = (totals.maternity || 0) + (totals.paternity || 0);
  doc.fontSize(8).font('Helvetica-Bold').fillColor('#0F172A')
    .text(
      `Annual Left: ${totals.annual || 0}   Sick Left: ${totals.sick || 0}   Family Left: ${familyLeft}   Bereavement: ${totals.bereavement || 0}   Missing Hire Date: ${dash.missingHireDates || 0}`,
      28,
      y
    );

  y += 24;
  if (y > doc.page.height - 200) {
    doc.addPage();
    y = 40;
  }
  doc.rect(28, y, pageW, 20).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(12).font('Helvetica-Bold')
    .text('LEAVE REQUEST / USAGE LOG', 28, y + 5, { width: pageW, align: 'center' });
  y += 28;

  const logHeaders = ['#', 'Staff', 'Type', 'Start', 'End', 'Workdays', 'Override', 'Counted', 'Status', 'Approved By', 'Notes'];
  const logW = [28, 90, 70, 70, 70, 50, 50, 50, 55, 70, pageW - 603];
  doc.fontSize(7).font('Helvetica-Bold').fillColor('#1E3A5F');
  let x = 28;
  logHeaders.forEach((h, i) => {
    doc.text(h, x, y, { width: logW[i] });
    x += logW[i];
  });
  y += 12;

  const sorted = [...(entries || [])].sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
  doc.font('Helvetica').fontSize(7).fillColor('#334155');
  sorted.forEach((e, idx) => {
    if (y > doc.page.height - 40) {
      doc.addPage();
      y = 40;
    }
    const cells = [
      String(sorted.length - idx),
      e.employee?.fullName || '',
      labels[e.leaveType] || e.leaveType,
      fmtDate(e.startDate),
      fmtDate(e.endDate),
      String(e.calculatedWorkdays ?? ''),
      e.overrideDays != null ? String(e.overrideDays) : '',
      String(e.daysCounted ?? ''),
      e.status || '',
      e.approvedBy || '',
      e.notes || '',
    ];
    x = 28;
    cells.forEach((c, i) => {
      doc.text(c, x, y, { width: logW[i], ellipsis: true });
      x += logW[i];
    });
    y += 10;
  });

  doc.end();
}
