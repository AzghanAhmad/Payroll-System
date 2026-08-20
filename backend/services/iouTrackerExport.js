import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

const HEADER_BLUE = '1E3A5F';
const YELLOW = 'FEF9C3';
const GREY = 'E2E8F0';
const LIGHT_BLUE = 'DBEAFE';

const border = {
  top: { style: 'thin', color: { argb: '94A3B8' } },
  left: { style: 'thin', color: { argb: '94A3B8' } },
  bottom: { style: 'thin', color: { argb: '94A3B8' } },
  right: { style: 'thin', color: { argb: '94A3B8' } },
};

const fmtDate = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const money = (n) => Number(n || 0);

/**
 * Staff IOU Tracker Excel (ss2).
 */
export async function writeIouTrackerExcel(res, { year, month, viewWeek, totals, staff }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('IOU Tracker');

  const colCount = 16;
  sheet.mergeCells(1, 1, 1, colCount);
  const title = sheet.getCell(1, 1);
  title.value = 'STAFF IOU TRACKER';
  title.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 14 };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 24;

  sheet.mergeCells(2, 1, 2, colCount);
  sheet.getCell(2, 1).value =
    'Enter data only in the yellow cells. Weekly payments automatically update the weekly payroll sheets and PAYSLIPS-STAFF.';
  sheet.getCell(2, 1).font = { italic: true, size: 9, color: { argb: 'FF475569' } };
  sheet.getCell(2, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };

  // Summary row
  const summary = [
    ['Total IOU Issued', money(totals?.totalIssued)],
    ['Total Repaid', money(totals?.totalRepaid)],
    ['Outstanding Balance', money(totals?.outstanding)],
    ['Payslip Week View', String(viewWeek || 1).padStart(2, '0')],
  ];
  summary.forEach(([lab, val], i) => {
    const c = 1 + i * 2;
    sheet.getCell(4, c).value = lab;
    sheet.getCell(4, c).font = { bold: true, size: 9 };
    sheet.getCell(4, c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BLUE } };
    sheet.getCell(4, c).border = border;
    sheet.getCell(4, c + 1).value = val;
    sheet.getCell(4, c + 1).border = border;
  });

  const headers = [
    'Staff Name',
    'Start Week',
    'IOU Amount',
    'Week 01 Payment',
    'Week 01 Balance',
    'Week 02 Payment',
    'Week 02 Balance',
    'Week 03 Payment',
    'Week 03 Balance',
    'Week 04 Payment',
    'Week 04 Balance',
    'Week 05 Payment',
    'Week 05 Balance',
    'Total Repaid',
    'Date Loaned',
    'Purpose / Notes',
    'Status',
  ];

  // yellow input cols: 2,3,4,6,8,10,12,15,16 (1-based) — Start Week, IOU Amount, payments, Date, Purpose
  // grey calc: balances, total repaid, status
  const yellowCols = new Set([2, 3, 4, 6, 8, 10, 12, 15, 16]);
  const greyCols = new Set([5, 7, 9, 11, 13, 14, 17]);

  headers.forEach((h, i) => {
    const cell = sheet.getCell(6, i + 1);
    cell.value = h;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 8 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_BLUE } };
    cell.alignment = { horizontal: 'center', wrapText: true, vertical: 'middle' };
    cell.border = border;
  });
  sheet.getRow(6).height = 28;

  (staff || []).forEach((s, idx) => {
    const row = 7 + idx;
    const weeks = s.weeks || [];
    const vals = [
      s.staffName || '',
      s.startWeek ?? '',
      money(s.iouAmount),
      money(weeks[0]?.payment),
      money(weeks[0]?.balance),
      money(weeks[1]?.payment),
      money(weeks[1]?.balance),
      money(weeks[2]?.payment),
      money(weeks[2]?.balance),
      money(weeks[3]?.payment),
      money(weeks[3]?.balance),
      money(weeks[4]?.payment),
      money(weeks[4]?.balance),
      money(s.totalRepaid),
      fmtDate(s.dateLoaned),
      s.purpose || '',
      s.status || '',
    ];
    vals.forEach((v, i) => {
      const cell = sheet.getCell(row, i + 1);
      cell.value = v;
      cell.border = border;
      cell.font = { size: 8 };
      const col = i + 1;
      if (yellowCols.has(col)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: YELLOW } };
      } else if (greyCols.has(col)) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREY } };
      }
      if (col === 17) {
        if (v === 'Outstanding') cell.font = { size: 8, color: { argb: 'FFEA580C' }, bold: true };
        else if (v === 'Paid') cell.font = { size: 8, color: { argb: 'FF16A34A' }, bold: true };
      }
    });
  });

  sheet.getColumn(1).width = 18;
  for (let i = 2; i <= 14; i++) sheet.getColumn(i).width = 11;
  sheet.getColumn(15).width = 12;
  sheet.getColumn(16).width = 20;
  sheet.getColumn(17).width = 12;

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `IOU_Tracker_${months[month - 1]}_${year}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
}

export function streamIouTrackerPdf(res, { year, month, viewWeek, totals, staff }) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const filename = `IOU_Tracker_${months[month - 1]}_${year}.pdf`;
  const doc = new PDFDocument({ size: 'A3', layout: 'landscape', margin: 24 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const pageW = doc.page.width - 48;
  doc.rect(24, 24, pageW, 22).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(14).font('Helvetica-Bold')
    .text('STAFF IOU TRACKER', 24, 29, { width: pageW, align: 'center' });

  doc.fillColor('#475569').fontSize(8).font('Helvetica-Oblique')
    .text(
      'Enter data only in the yellow cells. Weekly payments automatically update the weekly payroll sheets and PAYSLIPS-STAFF.',
      24,
      52,
      { width: pageW }
    );

  doc.font('Helvetica').fontSize(9).fillColor('#0F172A')
    .text(
      `Total IOU Issued: ${money(totals?.totalIssued)}   |   Total Repaid: ${money(totals?.totalRepaid)}   |   Outstanding: ${money(totals?.outstanding)}   |   Payslip Week View: ${String(viewWeek || 1).padStart(2, '0')}   |   ${months[month - 1]} ${year}`,
      24,
      68,
      { width: pageW }
    );

  const headers = [
    'Staff', 'Start', 'IOU', 'W1 Pay', 'W1 Bal', 'W2 Pay', 'W2 Bal', 'W3 Pay', 'W3 Bal',
    'W4 Pay', 'W4 Bal', 'W5 Pay', 'W5 Bal', 'Repaid', 'Date', 'Notes', 'Status',
  ];
  const colW = pageW / headers.length;
  let y = 88;
  doc.rect(24, y, pageW, 16).fill(`#${HEADER_BLUE}`);
  doc.fillColor('#FFFFFF').fontSize(6.5).font('Helvetica-Bold');
  headers.forEach((h, i) => doc.text(h, 24 + i * colW, y + 4, { width: colW - 2, align: 'center' }));
  y += 18;

  doc.font('Helvetica').fontSize(6.5);
  for (const s of staff || []) {
    if (y > doc.page.height - 36) {
      doc.addPage();
      y = 40;
    }
    const weeks = s.weeks || [];
    const vals = [
      s.staffName || '',
      String(s.startWeek ?? ''),
      String(money(s.iouAmount)),
      String(money(weeks[0]?.payment)),
      String(money(weeks[0]?.balance)),
      String(money(weeks[1]?.payment)),
      String(money(weeks[1]?.balance)),
      String(money(weeks[2]?.payment)),
      String(money(weeks[2]?.balance)),
      String(money(weeks[3]?.payment)),
      String(money(weeks[3]?.balance)),
      String(money(weeks[4]?.payment)),
      String(money(weeks[4]?.balance)),
      String(money(s.totalRepaid)),
      fmtDate(s.dateLoaned),
      s.purpose || '',
      s.status || '',
    ];
    vals.forEach((v, i) => {
      if (i === 16 && v === 'Outstanding') doc.fillColor('#EA580C');
      else if (i === 16 && v === 'Paid') doc.fillColor('#16A34A');
      else doc.fillColor('#334155');
      doc.text(v, 24 + i * colW, y, { width: colW - 2, align: i === 0 || i === 15 ? 'left' : 'center', ellipsis: true });
    });
    y += 10;
  }

  doc.end();
}
