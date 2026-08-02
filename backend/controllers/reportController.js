import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import Payroll from '../models/Payroll.js';
import Employee from '../models/Employee.js';
import Loan from '../models/Loan.js';
import Timesheet from '../models/Timesheet.js';
import Department from '../models/Department.js';
import Report from '../models/Report.js';
import { asyncHandler, round2 } from '../utils/helpers.js';

export const weeklyReport = asyncHandler(async (req, res) => {
  const { year, month, week } = req.query;
  const filter = { type: 'weekly' };
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  if (week) filter.week = Number(week);
  const items = await Payroll.find(filter)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');
  res.json(items);
});

export const monthlyReport = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  const items = await Payroll.find(filter)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');
  res.json(items);
});

export const yearlyReport = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const items = await Payroll.find({ year })
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');

  const byMonth = {};
  for (const p of items) {
    if (!byMonth[p.month]) {
      byMonth[p.month] = { month: p.month, grossPay: 0, netPay: 0, employerCost: 0 };
    }
    byMonth[p.month].grossPay += p.totals?.grossPay || 0;
    byMonth[p.month].netPay += p.totals?.netPay || 0;
    byMonth[p.month].employerCost += p.totals?.employerCost || 0;
  }
  res.json({
    year,
    months: Object.values(byMonth).map((m) => ({
      ...m,
      grossPay: round2(m.grossPay),
      netPay: round2(m.netPay),
      employerCost: round2(m.employerCost),
    })),
    payrolls: items,
  });
});

export const departmentReport = asyncHandler(async (req, res) => {
  const departments = await Department.find();
  const payrolls = await Payroll.find(req.query.year ? { year: Number(req.query.year) } : {})
    .populate('lines.department', 'name')
    .populate('lines.employee', 'employeeId fullName');

  const map = {};
  for (const d of departments) {
    map[d._id] = { department: d.name, employees: 0, grossPay: 0, employerCost: 0 };
  }
  const empCount = await Employee.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  empCount.forEach((e) => {
    if (map[e._id]) map[e._id].employees = e.count;
  });

  for (const p of payrolls) {
    for (const line of p.lines) {
      const id = String(line.department?._id || line.department || '');
      if (!map[id]) continue;
      map[id].grossPay += line.grossPay || 0;
      map[id].employerCost += line.employerCost || 0;
    }
  }

  res.json(
    Object.values(map).map((m) => ({
      ...m,
      grossPay: round2(m.grossPay),
      employerCost: round2(m.employerCost),
    }))
  );
});

export const attendanceReport = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  const sheets = await Timesheet.find(filter).populate(
    'weeks.entries.employee',
    'employeeId fullName'
  );
  res.json(sheets);
});

export const iouReport = asyncHandler(async (req, res) => {
  const loans = await Loan.find()
    .populate('employee', 'employeeId fullName')
    .sort({ date: -1 });
  res.json(loans);
});

export const exportReportExcel = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  const payrolls = await Payroll.find(filter).populate('lines.employee', 'employeeId fullName');

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Payroll Report');
  sheet.columns = [
    { header: 'Period', key: 'period', width: 18 },
    { header: 'Employee', key: 'employee', width: 22 },
    { header: 'Normal Hrs', key: 'normalHours', width: 12 },
    { header: 'OT Hrs', key: 'otHours', width: 10 },
    { header: 'Double Hrs', key: 'doubleHours', width: 12 },
    { header: 'Gross', key: 'grossPay', width: 12 },
    { header: 'Net', key: 'netPay', width: 12 },
    { header: 'Employer Cost', key: 'employerCost', width: 14 },
  ];

  for (const p of payrolls) {
    for (const line of p.lines) {
      sheet.addRow({
        period: p.periodLabel,
        employee: line.employee?.fullName || '',
        normalHours: line.normalHours,
        otHours: line.otHours,
        doubleHours: line.doubleHours,
        grossPay: line.grossPay,
        netPay: line.netPay,
        employerCost: line.employerCost,
      });
    }
  }

  await Report.create({
    name: `Payroll Report ${year || ''}-${month || ''}`,
    type: month ? 'monthly' : 'yearly',
    params: { year, month },
    generatedBy: req.user._id,
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=payroll-report.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

export const exportReportPdf = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  const payrolls = await Payroll.find(filter);

  const doc = new PDFDocument({ margin: 40 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=payroll-report.pdf');
  doc.pipe(res);
  doc.fontSize(16).text('Payroll Report', { align: 'center' });
  doc.moveDown();
  payrolls.forEach((p) => {
    doc.fontSize(11).text(
      `${p.periodLabel}: Gross ${p.totals?.grossPay?.toFixed(2)} | Net ${p.totals?.netPay?.toFixed(2)} | Employer ${p.totals?.employerCost?.toFixed(2)}`
    );
  });
  doc.end();
});
