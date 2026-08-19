import PDFDocument from 'pdfkit';
import { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../models/LeaveEntry.js';

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const buildLeaveBalanceFilename = (staffName, asOf) => {
  const name = String(staffName || 'Staff')
    .replace(/[^\w\s'-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  const date = String(asOf || '').slice(0, 10);
  return `Leave_${name}_${date}.pdf`;
};

/**
 * Stream a leave balance PDF for one employee.
 */
export const streamLeaveBalancePdf = (res, { companyName, row, asOf, labels = LEAVE_TYPE_LABELS }) => {
  const filename = buildLeaveBalanceFilename(row.staffName, asOf);
  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const asOfLabel = fmtDate(asOf);

  doc.fontSize(18).font('Helvetica-Bold').text('Leave Balance Sheet', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor('#64748B').text(companyName || 'Payroll', { align: 'center' });
  doc.moveDown(1.5);

  doc.fillColor('#0F172A').fontSize(12).font('Helvetica-Bold').text(row.staffName || '—');
  doc.fontSize(10).font('Helvetica').fillColor('#475569');
  doc.text(`As of: ${asOfLabel}`);
  if (row.hireDate) doc.text(`Hire date: ${fmtDate(row.hireDate)}`);
  if (row.currentLeaveCycle) doc.text(`Current leave cycle: ${fmtDate(row.currentLeaveCycle)}`);
  if (row.nextAnniversary) doc.text(`Next anniversary: ${fmtDate(row.nextAnniversary)}`);
  if (row.status) doc.text(`Status: ${row.status}`);
  doc.moveDown(1);

  const tableTop = doc.y;
  const colX = [50, 230, 320, 390, 460];
  const headers = ['Leave Type', 'Entitlement', 'Used', 'Remaining', 'Notes'];

  doc.rect(50, tableTop, 495, 22).fill('#F1F5F9');
  doc.fillColor('#334155').fontSize(9).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, colX[i] + 4, tableTop + 7, { width: (colX[i + 1] || 545) - colX[i] - 8 }));

  let y = tableTop + 22;
  doc.font('Helvetica').fontSize(9);

  for (const type of LEAVE_TYPES) {
    const x = row.types?.[type] || {};
    const label = labels[type] || type;
    const notes =
      type === 'annual' || type === 'sick'
        ? 'Renews on hire anniversary'
        : 'Subject to eligibility';

    if (y > 700) {
      doc.addPage();
      y = 50;
    }

    doc.rect(50, y, 495, 20).stroke('#E2E8F0');
    doc.fillColor('#0F172A').text(label, colX[0] + 4, y + 6, { width: colX[1] - colX[0] - 8 });
    doc.text(String(x.entitlement ?? 0), colX[1] + 4, y + 6, { width: colX[2] - colX[1] - 8, align: 'right' });
    doc.text(String(x.used ?? 0), colX[2] + 4, y + 6, { width: colX[3] - colX[2] - 8, align: 'right' });
    doc.font('Helvetica-Bold').text(String(x.left ?? 0), colX[3] + 4, y + 6, { width: colX[4] - colX[3] - 8, align: 'right' });
    doc.font('Helvetica').fillColor('#64748B').fontSize(8).text(notes, colX[4] + 4, y + 7, { width: 85 });
    doc.fillColor('#0F172A').fontSize(9);
    y += 20;
  }

  y += 12;
  doc.rect(50, y, 495, 28).fill('#ECFDF5');
  doc.fillColor('#065F46').fontSize(11).font('Helvetica-Bold');
  doc.text(`Total leave remaining: ${row.totalLeaveLeft ?? 0} day(s)`, 60, y + 9);

  doc.end();
};
