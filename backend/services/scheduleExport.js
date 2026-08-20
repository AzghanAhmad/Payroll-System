import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

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
  top: { style: 'thin', color: { argb: 'CBD5E1' } },
  left: { style: 'thin', color: { argb: 'CBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
  right: { style: 'thin', color: { argb: 'CBD5E1' } },
};

/**
 * Payroll schedule Excel (ss2).
 */
export async function writeScheduleExcel(res, { year, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Schedule ${year}`);

  const headers = ['Payday', 'Pay Period Start', 'Pay Period End', 'Pay Cycle', 'Assigned Payroll Month'];
  headers.forEach((h, i) => {
    const cell = sheet.getCell(1, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = border;
  });
  sheet.getRow(1).height = 22;

  (rows || []).forEach((r, idx) => {
    const row = idx + 2;
    const values = [
      fmtDate(r.payday),
      fmtDate(r.periodStart),
      fmtDate(r.periodEnd),
      r.payCycle || '',
      r.assignedPayrollMonth || '',
    ];
    values.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = border;
      cell.font = { size: 10 };
      if (idx % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } };
      }
    });
  });

  headers.forEach((_, i) => {
    sheet.getColumn(i + 1).width = i === 3 || i === 4 ? 24 : 18;
  });

  const filename = `Payroll_Schedule_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamSchedulePdf(res, { year, rows }) {
  const filename = `Payroll_Schedule_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  doc.fillColor(`#${HEADER_BLUE}`).fontSize(16).font('Helvetica-Bold')
    .text(`Payroll Schedule — ${year}`, { align: 'center' });
  doc.moveDown(0.8);

  const colX = [40, 130, 230, 330, 430];
  const widths = [90, 100, 100, 100, 120];
  const headers = ['Payday', 'Pay Period Start', 'Pay Period End', 'Pay Cycle', 'Assigned Payroll Month'];

  let y = doc.y;
  doc.rect(40, y, 515, 20).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, colX[i], y + 6, { width: widths[i], align: 'center' }));
  y += 20;

  (rows || []).forEach((r, idx) => {
    if (y > 760) {
      doc.addPage();
      y = 40;
      doc.rect(40, y, 515, 20).fill(`#${HEADER_BLUE}`);
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold');
      headers.forEach((h, i) => doc.text(h, colX[i], y + 6, { width: widths[i], align: 'center' }));
      y += 20;
    }
    if (idx % 2 === 1) doc.rect(40, y, 515, 16).fill('#F1F5F9');
    doc.fillColor('#334155').fontSize(8).font('Helvetica');
    const vals = [
      fmtDate(r.payday),
      fmtDate(r.periodStart),
      fmtDate(r.periodEnd),
      r.payCycle || '',
      r.assignedPayrollMonth || '',
    ];
    vals.forEach((v, i) => doc.text(v, colX[i], y + 4, { width: widths[i], align: 'center' }));
    y += 16;
  });

  doc.end();
}
