import PDFDocument from 'pdfkit';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../models/LeaveEntry.js';

const HEADER_BLUE = '#1E3A5F';
const LABEL_BLUE = '#DBEAFE';
const ROW_YELLOW = '#FEF08A';
const STATUS_GREEN = '#BBF7D0';
const NOTE_CREAM = '#FEF3C7';
const GRAY_BAR = '#E2E8F0';

const LEAVE_NOTES = {
  annual: 'Renews on hire anniversary',
  sick: 'Renews on hire anniversary',
  maternity: 'Subject to eligibility',
  paternity: 'Subject to eligibility',
  bereavement: 'Subject to approved event',
};

const TYPE_STYLE = {
  annual: { fill: ROW_YELLOW, text: '#0F172A' },
  sick: { fill: null, text: '#DC2626' },
  maternity: { fill: null, text: '#7C3AED' },
  paternity: { fill: null, text: '#1D4ED8' },
  bereavement: { fill: null, text: '#C2410C' },
};

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const fmtNum = (n) => Number(n ?? 0).toFixed(2);

export const buildLeaveBalanceFilename = (staffName, asOf) => {
  const name = String(staffName || 'Staff')
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const date = String(asOf || '').slice(0, 10);
  return `Leave_${name}_${date}.pdf`;
};

/** Draw a filled rect + bordered cell, then text at absolute position (no flow drift). */
const cellText = (doc, text, x, y, w, h, opts = {}) => {
  const {
    fill = null,
    stroke = '#94A3B8',
    font = 'Helvetica',
    fontSize = 9,
    color = '#0F172A',
    align = 'left',
    bold = false,
  } = opts;

  if (fill) {
    doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
  } else {
    doc.rect(x, y, w, h).stroke(stroke);
  }

  doc
    .fillColor(color)
    .font(bold ? 'Helvetica-Bold' : font)
    .fontSize(fontSize)
    .text(String(text ?? ''), x + 4, y + Math.max(3, (h - fontSize) / 2 - 1), {
      width: w - 8,
      align,
      lineBreak: false,
      ellipsis: true,
    });
};

/**
 * Stream a leave balance PDF for one employee — matches Excel staff leave sheet (ss2).
 */
export const streamLeaveBalancePdf = (res, { companyName, row, asOf, labels = LEAVE_TYPE_LABELS }) => {
  const filename = buildLeaveBalanceFilename(row.staffName, asOf);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const left = 40;
  const pageW = doc.page.width - 80;
  const name = String(row.staffName || 'Staff').toUpperCase();

  // Title bar
  let y = 40;
  doc.rect(left, y, pageW, 28).fill(HEADER_BLUE);
  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(14)
    .text(`${name} — LEAVE BALANCE`, left, y + 8, {
      width: pageW,
      align: 'center',
      lineBreak: false,
    });
  y += 28;

  // Subtitle bar
  doc.rect(left, y, pageW, 20).fill(GRAY_BAR);
  doc
    .fillColor('#334155')
    .font('Helvetica-Oblique')
    .fontSize(9)
    .text('This sheet is read-only. Record leave on the LeaveTracker tab.', left + 8, y + 6, {
      width: pageW - 16,
      lineBreak: false,
    });
  y += 28;

  // Optional company line
  if (companyName) {
    doc
      .fillColor('#64748B')
      .font('Helvetica')
      .fontSize(8)
      .text(companyName, left, y, { width: pageW, align: 'center', lineBreak: false });
    y += 14;
  }

  // Info grid — row 1: Employee | name | Department | dept
  const infoH = 22;
  const c1 = 90;
  const c2 = 170;
  const c3 = 90;
  const c4 = pageW - c1 - c2 - c3;

  cellText(doc, 'Employee', left, y, c1, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 9 });
  cellText(doc, row.staffName || '—', left + c1, y, c2, infoH, { fontSize: 9 });
  cellText(doc, 'Department', left + c1 + c2, y, c3, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 9 });
  cellText(doc, row.department || '—', left + c1 + c2 + c3, y, c4, infoH, { fontSize: 9 });
  y += infoH;

  // Info grid — row 2: Hire Date | Cycle Start | Next Reset
  const h1 = 80;
  const h2 = 90;
  const h3 = 80;
  const h4 = 90;
  const h5 = 80;
  const h6 = pageW - h1 - h2 - h3 - h4 - h5;

  cellText(doc, 'Hire Date', left, y, h1, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 8 });
  cellText(doc, fmtDate(row.hireDate), left + h1, y, h2, infoH, { fontSize: 8 });
  cellText(doc, 'Cycle Start', left + h1 + h2, y, h3, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 8 });
  cellText(doc, fmtDate(row.currentLeaveCycle), left + h1 + h2 + h3, y, h4, infoH, { fontSize: 8 });
  cellText(doc, 'Next Reset', left + h1 + h2 + h3 + h4, y, h5, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 8 });
  cellText(doc, fmtDate(row.nextAnniversary), left + h1 + h2 + h3 + h4 + h5, y, h6, infoH, { fontSize: 8 });
  y += infoH + 14;

  // Table columns — fixed widths so headers and values share the same x
  // Leave Type | Entitlement | Approved Used | Remaining | Balance Status | Notes
  const cols = [
    { key: 'type', w: 110, align: 'left' },
    { key: 'ent', w: 70, align: 'right' },
    { key: 'used', w: 75, align: 'right' },
    { key: 'left', w: 70, align: 'right' },
    { key: 'status', w: 85, align: 'center' },
    { key: 'notes', w: pageW - 110 - 70 - 75 - 70 - 85, align: 'left' },
  ];
  const headers = ['Leave Type', 'Entitlement', 'Approved Used', 'Remaining', 'Balance Status', 'Notes'];
  const rowH = 22;

  let x = left;
  headers.forEach((h, i) => {
    cellText(doc, h, x, y, cols[i].w, rowH, {
      fill: HEADER_BLUE,
      stroke: HEADER_BLUE,
      color: '#FFFFFF',
      bold: true,
      fontSize: 8,
      align: 'center',
    });
    x += cols[i].w;
  });
  y += rowH;

  for (const type of LEAVE_TYPES) {
    const t = row.types?.[type] || {};
    const style = TYPE_STYLE[type] || {};
    const entitlement = t.entitlement ?? 0;
    const used = t.used ?? t.approvedUsed ?? 0;
    const remaining = t.left ?? t.remaining ?? 0;
    const balanceStatus =
      t.balanceStatus || (remaining <= 0 && entitlement > 0 ? 'Used' : 'Available');
    const notes = LEAVE_NOTES[type] || '';
    const label = labels[type] || type;

    const values = [
      label,
      fmtNum(entitlement),
      fmtNum(used),
      fmtNum(remaining),
      balanceStatus,
      notes,
    ];

    x = left;
    values.forEach((v, i) => {
      const isType = i === 0;
      const isStatus = i === 4;
      cellText(doc, v, x, y, cols[i].w, rowH, {
        fill: isType ? style.fill : isStatus ? STATUS_GREEN : '#F8FAFC',
        color: isType ? style.text || '#0F172A' : '#0F172A',
        bold: i === 3 || isType,
        fontSize: i === 5 ? 7 : 9,
        align: cols[i].align,
      });
      x += cols[i].w;
    });
    y += rowH;
  }

  y += 16;

  // Summary row
  const s1 = 130;
  const s2 = 70;
  const s3 = 100;
  const s4 = 60;
  cellText(doc, 'Total Leave Remaining', left, y, s1, infoH, { fill: LABEL_BLUE, bold: true, fontSize: 9 });
  cellText(doc, fmtNum(row.totalLeaveLeft ?? row.totalLeaveRemaining ?? 0), left + s1, y, s2, infoH, {
    fontSize: 9,
    align: 'right',
    bold: true,
  });
  cellText(doc, 'Days to Reset', left + s1 + s2 + 20, y, s3, infoH, {
    fill: LABEL_BLUE,
    bold: true,
    fontSize: 9,
  });
  cellText(doc, String(row.daysToReset ?? '—'), left + s1 + s2 + 20 + s3, y, s4, infoH, {
    fill: LABEL_BLUE,
    fontSize: 9,
    align: 'center',
    bold: true,
  });
  y += infoH + 10;

  // Leave status
  cellText(doc, 'Leave Status', left, y, s1, infoH, { fill: STATUS_GREEN, bold: true, fontSize: 9 });
  cellText(doc, row.status || row.leaveStatus || '—', left + s1, y, 200, infoH, {
    fill: STATUS_GREEN,
    fontSize: 9,
  });
  y += infoH + 14;

  // Footer note
  doc.rect(left, y, pageW, 28).fillAndStroke(NOTE_CREAM, '#F59E0B');
  doc
    .fillColor('#78350F')
    .font('Helvetica-Oblique')
    .fontSize(8)
    .text(
      'Approved leave entered on LeaveTracker automatically reduces the matching balance above.',
      left + 8,
      y + 10,
      { width: pageW - 16, lineBreak: false }
    );

  // As-of note (small)
  doc
    .fillColor('#94A3B8')
    .font('Helvetica')
    .fontSize(7)
    .text(`As of: ${fmtDate(asOf)}`, left, y + 36, { width: pageW, align: 'right', lineBreak: false });

  doc.end();
};

export const buildLeaveUsageFilename = (staffName) => {
  const name = String(staffName || 'Staff')
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const date = new Date().toISOString().slice(0, 10);
  return `Leave_Usage_${name}_${date}.pdf`;
};

/**
 * Stream a leave request / usage log PDF for one employee.
 */
export const streamLeaveUsageLogPdf = (res, { companyName, staffName, entries, labels = LEAVE_TYPE_LABELS }) => {
  const filename = buildLeaveUsageFilename(staffName);
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0F172A').text('Leave Request / Usage Log', { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B').text(companyName || 'Payroll', { align: 'center' });
  doc.moveDown(0.8);
  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(staffName || '—');
  doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`Entries: ${entries.length}`);
  doc.moveDown(0.8);

  const colX = [40, 55, 175, 250, 320, 390, 450, 510, 575, 650];
  const headers = ['#', 'Leave Type', 'Start', 'End', 'Workdays', 'Override', 'Counted', 'Status', 'Approved By', 'Notes'];
  const widths = [15, 120, 75, 70, 60, 60, 60, 65, 75, 112];

  let y = doc.y;
  doc.rect(40, y, 762, 20).fill('#F1F5F9');
  doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, colX[i], y + 6, { width: widths[i], lineBreak: false }));
  y += 20;

  doc.font('Helvetica').fontSize(8);
  if (!entries.length) {
    doc.fillColor('#64748B').text('No leave entries for this staff member.', 40, y + 8);
  } else {
    entries.forEach((e, idx) => {
      if (y > 520) {
        doc.addPage();
        y = 40;
        doc.rect(40, y, 762, 20).fill('#F1F5F9');
        doc.fillColor('#334155').fontSize(8).font('Helvetica-Bold');
        headers.forEach((h, i) => doc.text(h, colX[i], y + 6, { width: widths[i], lineBreak: false }));
        y += 20;
        doc.font('Helvetica').fontSize(8);
      }

      doc.rect(40, y, 762, 18).stroke('#E2E8F0');
      doc.fillColor('#0F172A');
      const cells = [
        String(entries.length - idx),
        labels[e.leaveType] || e.leaveType || '—',
        fmtDate(e.startDate),
        fmtDate(e.endDate),
        String(e.calculatedWorkdays ?? ''),
        e.overrideDays != null ? String(e.overrideDays) : '',
        String(e.daysCounted ?? ''),
        e.status || '',
        e.approvedBy || '',
        e.notes || '',
      ];
      cells.forEach((c, i) =>
        doc.text(c, colX[i], y + 5, { width: widths[i], ellipsis: true, lineBreak: false })
      );
      y += 18;
    });
  }

  doc.end();
};
