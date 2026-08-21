import Employee from '../models/Employee.js';
import Department from '../models/Department.js';
import Timesheet from '../models/Timesheet.js';
import { asyncHandler } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { uploadRoot } from '../middleware/upload.js';

const nextEmployeeId = async () => {
  const rows = await Employee.find({ employeeId: /^EMP-\d+$/i })
    .select('employeeId')
    .lean();
  let max = 0;
  for (const row of rows) {
    const num = parseInt(String(row.employeeId).replace(/\D/g, ''), 10) || 0;
    if (num > max) max = num;
  }
  return `EMP-${String(max + 1).padStart(4, '0')}`;
};

const allocateEmployeeId = async (preferred) => {
  const cleaned = String(preferred || '').trim();
  if (cleaned) {
    const exists = await Employee.exists({ employeeId: cleaned });
    if (exists) throw new AppError(`Employee ID "${cleaned}" is already in use`);
    return cleaned;
  }

  // Retry in case of a race between two simultaneous creates
  for (let attempt = 0; attempt < 8; attempt++) {
    const id = await nextEmployeeId();
    const exists = await Employee.exists({ employeeId: id });
    if (!exists) return id;
  }
  throw new AppError('Could not allocate a unique employee ID — try again');
};

export const listEmployees = asyncHandler(async (req, res) => {
  const {
    search = '',
    status,
    department,
    sort = 'fullName',
    order = 'asc',
    page = 1,
    limit = 50,
  } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (department) filter.department = department;
  if (search) {
    filter.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { employeeId: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
    ];
  }

  const sortObj = { [sort]: order === 'desc' ? -1 : 1 };
  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    Employee.find(filter)
      .populate('department', 'name code')
      .sort(sortObj)
      .skip(skip)
      .limit(Number(limit)),
    Employee.countDocuments(filter),
  ]);

  res.json({ items, total, page: Number(page), limit: Number(limit) });
});

export const getEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findById(req.params.id).populate('department');
  if (!employee) throw new AppError('Employee not found', 404);
  res.json(employee);
});

const attachPhotoFromUpload = (data, file) => {
  if (!file) return;
  data.photo = `/uploads/photos/${file.filename}`;
  try {
    const buf = fs.readFileSync(file.path);
    const mime = file.mimetype || 'image/jpeg';
    // Cap stored size (~1.5MB binary) to stay within Mongo doc limits
    if (buf.length <= 1.5 * 1024 * 1024) {
      data.photoData = `data:${mime};base64,${buf.toString('base64')}`;
    }
  } catch {
    /* disk read failed — path still saved */
  }
};

export const createEmployee = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  data.employeeId = await allocateEmployeeId(data.employeeId);
  attachPhotoFromUpload(data, req.file);
  if (data.hourlyRate != null && data.hourlyRate !== '') data.hourlyRate = Number(data.hourlyRate);
  if (data.teaFundAmount === '' || data.teaFundAmount == null) delete data.teaFundAmount;
  else data.teaFundAmount = Number(data.teaFundAmount);
  if (!data.department) delete data.department;
  if (data.dob === '') delete data.dob;
  if (data.hireDate === '') delete data.hireDate;

  const missing = [];
  if (!data.fullName?.trim()) missing.push('fullName');
  if (!data.hireDate) missing.push('hireDate');
  if (data.hourlyRate == null || Number(data.hourlyRate) <= 0) missing.push('hourlyRate');
  if (!data.department) missing.push('department');
  if (!data.bank?.trim()) missing.push('bank');
  if (!data.accountNumber?.trim()) missing.push('accountNumber');
  if (!data.npfNumber?.trim()) missing.push('npfNumber');
  if (!data.position?.trim()) missing.push('position');
  if (!data.gender || !['male', 'female'].includes(String(data.gender).toLowerCase())) {
    missing.push('gender');
  }
  if (missing.length) {
    throw new AppError(
      `Cannot add employee — required for payroll/leave/payslips: ${missing.join(', ')}`,
      400
    );
  }

  try {
    const employee = await Employee.create(data);
    await employee.populate('department', 'name code');

    // Ensure current (and nearby) timesheet months include this employee
    const Settings = (await import('../models/Settings.js')).default;
    const Timesheet = (await import('../models/Timesheet.js')).default;
    const { ensureTimesheetWeeks, emptyDays } = await import('../services/timesheetService.js');
    let settings = await Settings.findOne();
    const now = new Date();
    const targetYear = settings?.currentPayrollYear || now.getFullYear();
    const targetMonth = settings?.currentPayrollMonth || now.getMonth() + 1;

    const ensureEmpOnSheet = async (year, month) => {
      let ts = await Timesheet.findOne({ year, month });
      if (!ts) {
        ts = await Timesheet.create({
          year,
          month,
          weeks: [1, 2, 3, 4, 5].map((weekNumber) => ({ weekNumber, entries: [] })),
          createdBy: req.user?._id,
        });
      }
      ensureTimesheetWeeks(ts);
      let changed = false;
      for (const week of ts.weeks) {
        const exists = week.entries.some(
          (e) => String(e.employee?._id || e.employee) === String(employee._id)
        );
        if (!exists) {
          week.entries.push({
            employee: employee._id,
            days: emptyDays(),
            weeklyHours: 0,
            weeklyCost: 0,
          });
          changed = true;
        }
      }
      if (changed) await ts.save();
      return ts;
    };

    if (employee.status === 'active') {
      await ensureEmpOnSheet(targetYear, targetMonth);
      // Also attach to any other timesheets already open this year
      const otherSheets = await Timesheet.find({
        year: targetYear,
        month: { $ne: targetMonth },
      }).select('_id year month');
      for (const s of otherSheets) {
        await ensureEmpOnSheet(s.year, s.month);
      }
    }

    res.status(201).json(employee);
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.employeeId) {
      throw new AppError('Employee ID already exists — leave ID blank to auto-generate', 400);
    }
    throw err;
  }
});

export const updateEmployee = asyncHandler(async (req, res) => {
  const data = { ...req.body };
  attachPhotoFromUpload(data, req.file);
  if (data.hourlyRate != null && data.hourlyRate !== '') data.hourlyRate = Number(data.hourlyRate);
  if (data.teaFundAmount === '') data.teaFundAmount = null;
  else if (data.teaFundAmount != null) data.teaFundAmount = Number(data.teaFundAmount);
  if (data.dob === '') data.dob = undefined;
  if (data.hireDate === '') data.hireDate = undefined;
  if (data.department === '') data.department = undefined;

  const employee = await Employee.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  }).populate('department', 'name code');
  if (!employee) throw new AppError('Employee not found', 404);
  res.json(employee);
});

export const deleteEmployee = asyncHandler(async (req, res) => {
  const employee = await Employee.findByIdAndDelete(req.params.id);
  if (!employee) throw new AppError('Employee not found', 404);

  const sheets = await Timesheet.find({ 'weeks.entries.employee': employee._id });
  for (const ts of sheets) {
    for (const week of ts.weeks) {
      week.entries = week.entries.filter(
        (e) => String(e.employee) !== String(employee._id)
      );
    }
    await ts.save();
  }

  res.json({ message: 'Employee deleted' });
});

export const exportExcel = asyncHandler(async (req, res) => {
  const employees = await Employee.find().populate('department', 'name');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Employees');
  sheet.columns = [
    { header: 'Employee ID', key: 'employeeId', width: 14 },
    { header: 'Full Name', key: 'fullName', width: 24 },
    { header: 'Email', key: 'email', width: 24 },
    { header: 'Phone', key: 'phone', width: 16 },
    { header: 'Department', key: 'department', width: 18 },
    { header: 'Position', key: 'position', width: 16 },
    { header: 'Hourly Rate', key: 'hourlyRate', width: 12 },
    { header: 'Bank', key: 'bank', width: 16 },
    { header: 'Account', key: 'accountNumber', width: 18 },
    { header: 'NPF', key: 'npfNumber', width: 14 },
    { header: 'Status', key: 'status', width: 12 },
  ];
  employees.forEach((e) => {
    sheet.addRow({
      employeeId: e.employeeId,
      fullName: e.fullName,
      email: e.email,
      phone: e.phone,
      department: e.department?.name || '',
      position: e.position,
      hourlyRate: e.hourlyRate,
      bank: e.bank,
      accountNumber: e.accountNumber,
      npfNumber: e.npfNumber,
      status: e.status,
    });
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=employees.xlsx');
  await workbook.xlsx.write(res);
  res.end();
});

export const importExcel = asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('Excel file required');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(req.file.path);
  const sheet = workbook.worksheets[0];
  const created = [];
  const errors = [];

  for (let i = 2; i <= sheet.rowCount; i++) {
    const row = sheet.getRow(i);
    const fullName = row.getCell(2).value?.toString()?.trim();
    if (!fullName) continue;
    try {
      let department = null;
      const deptName = row.getCell(5).value?.toString()?.trim();
      if (deptName) {
        department = await Department.findOneAndUpdate(
          { name: deptName },
          { name: deptName },
          { upsert: true, new: true }
        );
      }
      const employeeId = row.getCell(1).value?.toString()?.trim() || (await nextEmployeeId());
      const emp = await Employee.findOneAndUpdate(
        { employeeId },
        {
          employeeId,
          fullName,
          email: row.getCell(3).value?.toString() || '',
          phone: row.getCell(4).value?.toString() || '',
          department: department?._id,
          position: row.getCell(6).value?.toString() || '',
          hourlyRate: Number(row.getCell(7).value) || 0,
          bank: row.getCell(8).value?.toString() || '',
          accountNumber: row.getCell(9).value?.toString() || '',
          npfNumber: row.getCell(10).value?.toString() || '',
          status: row.getCell(11).value?.toString()?.toLowerCase() || 'active',
        },
        { upsert: true, new: true }
      );
      created.push(emp);
    } catch (err) {
      errors.push({ row: i, message: err.message });
    }
  }

  fs.unlinkSync(req.file.path);
  res.json({ imported: created.length, errors });
});

export const exportPdf = asyncHandler(async (req, res) => {
  const employees = await Employee.find().populate('department', 'name');
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename=employees.pdf');
  doc.pipe(res);

  doc.fontSize(18).text('Employee Directory', { align: 'center' });
  doc.moveDown();
  employees.forEach((e, idx) => {
    doc
      .fontSize(10)
      .text(
        `${idx + 1}. ${e.employeeId} — ${e.fullName} | ${e.department?.name || '-'} | ${e.position || '-'} | ${e.status}`
      );
  });
  doc.end();
});
