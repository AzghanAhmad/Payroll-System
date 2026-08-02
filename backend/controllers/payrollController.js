import Payroll from '../models/Payroll.js';
import Payslip from '../models/Payslip.js';
import Timesheet from '../models/Timesheet.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import Loan from '../models/Loan.js';
import TeaFund from '../models/TeaFund.js';
import Department from '../models/Department.js';
import { asyncHandler, WEEK_DAYS, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import {
  calculatePayrollLine,
  sumPayrollTotals,
} from '../services/payrollCalculator.js';
import { generatePayslipPdf } from '../services/payslipPdf.js';
import { getWeekPeriod, formatPeriodLabel } from '../utils/weekPeriod.js';

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

const getIouDeduction = async (employeeId, { year, month, week } = {}) => {
  const loans = await Loan.find({ employee: employeeId, status: 'active' });
  return loans.reduce((sum, l) => {
    if (week != null && l.startWeek && week < l.startWeek) return sum;
    if (year && month && week) {
      const wp = (l.weekPayments || []).find(
        (p) => p.year === year && p.month === month && p.week === week
      );
      if (wp) return sum + Math.min(Number(wp.amount || 0), l.remainingBalance);
    }
    return sum + Math.min(l.installment, l.remainingBalance);
  }, 0);
};

const getLoanSnapshot = async (employeeId) => {
  const loans = await Loan.find({ employee: employeeId, status: { $in: ['active', 'paid'] } });
  const active = loans.filter((l) => l.status === 'active');
  const iouAmount = round2(active.reduce((s, l) => s + l.amount, 0) || loans.reduce((s, l) => s + l.amount, 0));
  const iouPaid = round2(loans.reduce((s, l) => s + (l.amountPaid || 0), 0));
  const loanBalance = round2(active.reduce((s, l) => s + l.remainingBalance, 0));
  const iouPaymentsCount = loans.reduce((s, l) => s + (l.history?.length || 0), 0);
  return { iouAmount, iouPaid, loanBalance, iouPaymentsCount };
};

const applyIouPayments = async (employeeId, amount, payrollId, { year, month, week } = {}) => {
  let remaining = amount;
  const loans = await Loan.find({ employee: employeeId, status: 'active' }).sort({ date: 1 });
  for (const loan of loans) {
    if (remaining <= 0) break;
    if (week != null && loan.startWeek && week < loan.startWeek) continue;

    // Already recorded via IOU Tracker for this week — skip double application
    if (year && month && week) {
      const existing = (loan.weekPayments || []).find(
        (p) => p.year === year && p.month === month && p.week === week
      );
      if (existing) {
        remaining = round2(remaining - Math.min(remaining, existing.amount || 0));
        continue;
      }
    }

    const pay = Math.min(remaining, loan.remainingBalance, loan.installment);
    if (pay <= 0) continue;

    loan.history.push({
      amount: pay,
      date: new Date(),
      method: 'payroll',
      note: 'Auto payroll deduction',
      payroll: payrollId,
    });

    if (year && month && week) {
      if (!loan.weekPayments) loan.weekPayments = [];
      loan.weekPayments.push({ year, month, week, amount: pay });
      loan.markModified('weekPayments');
      const weekSum = loan.weekPayments.reduce((s, w) => s + Number(w.amount || 0), 0);
      const manualSum = (loan.history || [])
        .filter((h) => h.method === 'manual' || h.method === 'cash')
        .reduce((s, h) => s + Number(h.amount || 0), 0);
      loan.amountPaid = round2(weekSum + manualSum);
      loan.remainingBalance = round2(Math.max(0, loan.amount - loan.amountPaid));
    } else {
      loan.amountPaid = round2(loan.amountPaid + pay);
      loan.remainingBalance = round2(loan.remainingBalance - pay);
    }

    if (loan.remainingBalance <= 0) {
      loan.remainingBalance = 0;
      loan.status = 'paid';
    }
    await loan.save();
    remaining = round2(remaining - pay);
  }
};

const collectWeekHours = (week, settings) => {
  const map = new Map();
  for (const entry of week.entries || []) {
    const empId = String(entry.employee._id || entry.employee);
    let total = 0;
    let doubleHours = 0;
    const notes = entry.weeklyNotes || '';
    for (const day of WEEK_DAYS) {
      const d = entry.days?.[day];
      if (!d) continue;
      total += d.workingHours || 0;
      const rule = settings.doubleTimeRule || 'sunday';
      const isDouble =
        rule === 'none'
          ? false
          : rule === 'sunday'
            ? day === 'sunday'
            : Boolean(d.isDoubleTime);
      if (isDouble) doubleHours += d.workingHours || 0;
    }
    map.set(empId, {
      totalHours: round2(total),
      doubleHours: round2(doubleHours),
      notes,
    });
  }
  return map;
};

const buildPayslipPayload = async ({
  line,
  employee,
  settings,
  payrollId,
  type,
  year,
  month,
  week,
  periodStart,
  periodEnd,
  periodLabel,
  comments = '',
}) => {
  const loanSnap = await getLoanSnapshot(employee._id);
  let departmentName = '';
  if (employee.department) {
    const dept =
      typeof employee.department === 'object' && employee.department.name
        ? employee.department
        : await Department.findById(employee.department);
    departmentName = dept?.name || '';
  }

  const otRate = round2((line.hourlyRate || 0) * (settings.otMultiplier ?? 1.5));
  const doubleRate = round2((line.hourlyRate || 0) * (settings.doubleMultiplier ?? 2));
  const totalDeductions = round2(
    (line.employeeNpf || 0) +
      (line.employeeAcc || 0) +
      (line.tax || 0) +
      (line.teaFund || 0) +
      (line.iouDeduction || 0)
  );

  return {
    payroll: payrollId,
    employee: employee._id,
    type,
    year,
    month,
    week: week ?? null,
    periodLabel,
    periodStart,
    periodEnd,
    payDay: periodEnd,
    position: employee.position || '',
    departmentName,
    ...line,
    otRate,
    doubleRate,
    totalDeductions,
    iouAmount: loanSnap.iouAmount,
    iouPaid: loanSnap.iouPaid,
    loanBalance: loanSnap.loanBalance,
    iouPaymentsCount: loanSnap.iouPaymentsCount,
    bank: employee.bank || line.bank || '',
    accountNumber: employee.accountNumber || line.accountNumber || '',
    npfNumber: employee.npfNumber || line.npfNumber || '',
    comments,
  };
};

export const generateWeekly = asyncHandler(async (req, res) => {
  const { year, month, week } = req.body;
  if (!year || !month || !week) throw new AppError('year, month, week required');

  const settings = await getSettings();
  const ts = await Timesheet.findOne({ year, month }).populate({
    path: 'weeks.entries.employee',
    populate: { path: 'department', select: 'name' },
  });
  if (!ts) throw new AppError('Timesheet not found for period', 404);

  const weekData = ts.weeks.find((w) => w.weekNumber === Number(week));
  if (!weekData) throw new AppError('Week not found', 404);

  const { start: periodStart, end: periodEnd } = getWeekPeriod(year, month, week);
  weekData.startDate = periodStart;
  weekData.endDate = periodEnd;
  await ts.save();

  const hoursMap = collectWeekHours(weekData, settings);
  const lines = [];
  const notesMap = new Map();

  // Include ALL active employees (even with 0 hours), like the Excel workbook
  const activeEmployees = await Employee.find({ status: 'active' })
    .populate('department', 'name')
    .sort({ employeeId: 1 });

  for (const employee of activeEmployees) {
    const empId = String(employee._id);
    const hours = hoursMap.get(empId) || { totalHours: 0, doubleHours: 0, notes: '' };
    const iou = hours.totalHours > 0 ? await getIouDeduction(empId, { year, month, week }) : 0;
    const line = calculatePayrollLine({
      employee,
      totalHours: hours.totalHours,
      doubleHours: hours.doubleHours,
      settings,
      iouDeduction: iou,
      periodsPerYear: 52,
    });
    lines.push(line);
    notesMap.set(empId, hours.notes || '');
  }

  const totals = sumPayrollTotals(lines);
  const periodLabel = formatPeriodLabel(periodStart, periodEnd);

  const payroll = await Payroll.findOneAndUpdate(
    { type: 'weekly', year, month, week },
    {
      type: 'weekly',
      year,
      month,
      week,
      periodLabel: `Week ${week} — ${periodLabel}`,
      lines,
      totals,
      status: 'finalized',
      generatedBy: req.user._id,
    },
    { upsert: true, new: true }
  );

  for (const line of lines) {
    if (line.iouDeduction > 0) {
      await applyIouPayments(line.employee, line.iouDeduction, payroll._id, { year, month, week });
    }
  }

  // Replace tea-fund ledger for this week (avoid duplicates on regenerate)
  await TeaFund.deleteMany({ year, month, week });
  for (const line of lines) {
    if (line.teaFund > 0) {
      await TeaFund.create({
        employee: line.employee,
        amount: line.teaFund,
        year,
        month,
        week,
        payroll: payroll._id,
      });
    }

    const employee = await Employee.findById(line.employee).populate('department', 'name');
    const payload = await buildPayslipPayload({
      line,
      employee,
      settings,
      payrollId: payroll._id,
      type: 'weekly',
      year,
      month,
      week,
      periodStart,
      periodEnd,
      periodLabel,
      comments: notesMap.get(String(line.employee)) || '',
    });

    const payslip = await Payslip.findOneAndUpdate(
      { employee: line.employee, type: 'weekly', year, month, week },
      payload,
      { upsert: true, new: true }
    );
    // Only generate PDF when there is pay (keeps zero rows in list without cluttering exports)
    if (line.grossPay > 0 || line.totalHours > 0) {
      const pdfPath = await generatePayslipPdf(payslip._id);
      payslip.pdfPath = pdfPath;
      await payslip.save();
    } else {
      await payslip.save();
    }
  }

  const populated = await Payroll.findById(payroll._id)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');
  res.status(201).json(populated);
});

export const generateMonthly = asyncHandler(async (req, res) => {
  const { year, month } = req.body;
  if (!year || !month) throw new AppError('year and month required');

  const settings = await getSettings();
  const ts = await Timesheet.findOne({ year, month }).populate('weeks.entries.employee');
  if (!ts) throw new AppError('Timesheet not found for period', 404);

  const byEmployee = new Map();
  for (const week of ts.weeks) {
    const hoursMap = collectWeekHours(week, settings);
    for (const [empId, hours] of hoursMap.entries()) {
      const prev = byEmployee.get(empId) || { totalHours: 0, doubleHours: 0, weeks: [] };
      prev.weeks = prev.weeks || [];
      prev.weeks.push(hours);
      byEmployee.set(empId, prev);
    }
  }

  const activeEmployees = await Employee.find({ status: 'active' })
    .populate('department', 'name')
    .sort({ employeeId: 1 });

  const lines = [];
  const { start: periodStart, end: periodEnd } = getWeekPeriod(year, month, 1);
  const monthEnd = new Date(year, month, 0);

  for (const employee of activeEmployees) {
    const empId = String(employee._id);
    const data = byEmployee.get(empId) || { weeks: [{ totalHours: 0, doubleHours: 0 }] };

    let merged = null;
    for (const wh of data.weeks || [{ totalHours: 0, doubleHours: 0 }]) {
      const line = calculatePayrollLine({
        employee,
        totalHours: wh.totalHours || 0,
        doubleHours: wh.doubleHours || 0,
        settings,
        iouDeduction: 0,
        periodsPerYear: 52,
      });
      if (!merged) {
        merged = { ...line };
      } else {
        for (const key of [
          'totalHours', 'normalHours', 'otHours', 'doubleHours',
          'normalPay', 'otPay', 'doublePay', 'grossPay',
          'employeeNpf', 'employerNpf', 'employeeAcc', 'employerAcc',
          'tax', 'teaFund', 'employerCost',
        ]) {
          merged[key] = round2((merged[key] || 0) + (line[key] || 0));
        }
      }
    }

    if (!merged) continue;

    if (merged.grossPay > 0) {
      const iou = await getIouDeduction(empId);
      const weeksWithPay = (data.weeks || []).filter((w) => (w.totalHours || 0) > 0).length || 1;
      const teaFund = round2((settings.teaFundAmount || 0) * weeksWithPay);
      merged.teaFund = teaFund;
      merged.iouDeduction = round2(
        Math.min(
          iou,
          Math.max(0, merged.grossPay - merged.employeeNpf - merged.employeeAcc - merged.tax - teaFund)
        )
      );
      merged.netPay = round2(
        merged.grossPay - merged.employeeNpf - merged.employeeAcc - merged.tax - teaFund - merged.iouDeduction
      );
      merged.employerCost = round2(merged.grossPay + merged.employerNpf + merged.employerAcc);
    } else {
      merged.teaFund = 0;
      merged.iouDeduction = 0;
      merged.netPay = 0;
      merged.employerCost = 0;
    }
    lines.push(merged);
  }

  const totals = sumPayrollTotals(lines);
  const periodLabel = `${month}/${year}`;

  const payroll = await Payroll.findOneAndUpdate(
    { type: 'monthly', year, month, week: null },
    {
      type: 'monthly',
      year,
      month,
      week: null,
      periodLabel,
      lines,
      totals,
      status: 'finalized',
      generatedBy: req.user._id,
    },
    { upsert: true, new: true }
  );

  for (const line of lines) {
    if (line.iouDeduction > 0) {
      await applyIouPayments(line.employee, line.iouDeduction, payroll._id);
    }
    const employee = await Employee.findById(line.employee).populate('department', 'name');
    const payload = await buildPayslipPayload({
      line,
      employee,
      settings,
      payrollId: payroll._id,
      type: 'monthly',
      year,
      month,
      week: null,
      periodStart,
      periodEnd: monthEnd,
      periodLabel,
      comments: '',
    });
    const payslip = await Payslip.findOneAndUpdate(
      { employee: line.employee, type: 'monthly', year, month, week: null },
      payload,
      { upsert: true, new: true }
    );
    if (line.grossPay > 0 || line.totalHours > 0) {
      const pdfPath = await generatePayslipPdf(payslip._id);
      payslip.pdfPath = pdfPath;
      await payslip.save();
    } else {
      await payslip.save();
    }
  }

  const populated = await Payroll.findById(payroll._id)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');
  res.status(201).json(populated);
});

export const getPayrollByEmployee = asyncHandler(async (req, res) => {
  const items = await Payroll.find({ 'lines.employee': req.params.employee })
    .sort({ year: -1, month: -1, week: -1 })
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name');
  res.json(items);
});

export const getPayrollByWeek = asyncHandler(async (req, res) => {
  const week = Number(req.params.week);
  const { year, month } = req.query;
  const filter = { type: 'weekly', week };
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);
  const items = await Payroll.find(filter)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name')
    .sort({ year: -1, month: -1 });
  res.json(items);
});

export const getPayrollByMonth = asyncHandler(async (req, res) => {
  const month = Number(req.params.month);
  const { year, type } = req.query;
  const filter = { month };
  if (year) filter.year = Number(year);
  if (type) filter.type = type;
  const items = await Payroll.find(filter)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name')
    .sort({ year: -1, week: 1 });
  res.json(items);
});

export const listPayrolls = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.type) filter.type = req.query.type;
  if (req.query.year) filter.year = Number(req.query.year);
  if (req.query.month) filter.month = Number(req.query.month);
  const items = await Payroll.find(filter)
    .populate('lines.employee', 'employeeId fullName')
    .populate('lines.department', 'name')
    .sort({ year: -1, month: -1, week: -1 });
  res.json(items);
});

export const getPayrollSummary = asyncHandler(async (req, res) => {
  const { year, month } = req.query;
  const filter = {};
  if (year) filter.year = Number(year);
  if (month) filter.month = Number(month);

  const weekly = await Payroll.find({ ...filter, type: 'weekly' }).sort({ week: 1 });
  const monthly = await Payroll.findOne({ ...filter, type: 'monthly' });

  const weekTotals = weekly.map((p) => ({
    week: p.week,
    periodLabel: p.periodLabel,
    ...p.totals,
  }));

  const grand = sumPayrollTotals(
    weekly.flatMap((p) => p.lines).concat(monthly?.lines || [])
  );

  res.json({
    weeks: weekTotals,
    month: monthly?.totals || null,
    grandTotal: grand,
  });
});
