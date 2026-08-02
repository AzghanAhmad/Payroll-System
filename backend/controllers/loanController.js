import Loan from '../models/Loan.js';
import Payslip from '../models/Payslip.js';
import Payroll from '../models/Payroll.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';

const recalcFromWeekPayments = (loan) => {
  const weekSum = (loan.weekPayments || []).reduce((s, w) => s + Number(w.amount || 0), 0);
  const manualSum = (loan.history || [])
    .filter((h) => h.method === 'manual' || h.method === 'cash')
    .reduce((s, h) => s + Number(h.amount || 0), 0);
  // Payroll history only when tracker weekPayments not yet used (legacy loans)
  const payrollSum =
    (loan.weekPayments || []).length === 0
      ? (loan.history || [])
          .filter((h) => h.method === 'payroll')
          .reduce((s, h) => s + Number(h.amount || 0), 0)
      : 0;

  loan.amountPaid = round2(weekSum + manualSum + payrollSum);
  loan.remainingBalance = round2(Math.max(0, Number(loan.amount) - loan.amountPaid));
  if (loan.status === 'cancelled') return;
  loan.status = loan.amount > 0 && loan.remainingBalance <= 0 ? 'paid' : 'active';
};

const syncPayrollIou = async (employeeId, year, month, week, amount) => {
  const payroll = await Payroll.findOne({ type: 'weekly', year, month, week });
  if (payroll) {
    const line = (payroll.lines || []).find((l) => String(l.employee) === String(employeeId));
    if (line) {
      const prev = Number(line.iouDeduction || 0);
      line.iouDeduction = round2(amount);
      if (payroll.totals) {
        payroll.totals.iou = round2((payroll.totals.iou || 0) - prev + amount);
        payroll.totals.netPay = round2((payroll.totals.netPay || 0) + prev - amount);
      }
      line.netPay = round2((line.netPay || 0) + prev - amount);
      payroll.markModified('lines');
      payroll.markModified('totals');
      await payroll.save();
    }
  }

  const payslip = await Payslip.findOne({ type: 'weekly', year, month, week, employee: employeeId });
  if (payslip) {
    const prev = Number(payslip.iouDeduction || 0);
    payslip.iouDeduction = round2(amount);
    payslip.netPay = round2((payslip.netPay || 0) + prev - amount);
    payslip.loanBalance = round2(Math.max(0, (payslip.loanBalance || 0) + prev - amount));
    await payslip.save();
  }
};

export const listLoans = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.employee) filter.employee = req.query.employee;
  if (req.query.status) filter.status = req.query.status;
  const items = await Loan.find(filter)
    .populate('employee', 'employeeId fullName')
    .sort({ date: -1 });
  res.json(items);
});

export const getLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id).populate('employee', 'employeeId fullName');
  if (!loan) throw new AppError('Loan not found', 404);
  res.json(loan);
});

export const createLoan = asyncHandler(async (req, res) => {
  const { employee, amount, date, reason } = req.body;
  if (!employee || amount == null || amount === '') {
    throw new AppError('employee and amount are required');
  }
  const amt = Number(amount);
  if (!amt || amt <= 0) throw new AppError('Valid IOU amount required');

  const installment = Number(req.body.installment) > 0 ? Number(req.body.installment) : amt;

  const loan = await Loan.create({
    employee,
    amount: amt,
    date: date || new Date(),
    reason: reason || '',
    installment,
    startWeek: Number(req.body.startWeek) || 1,
    amountPaid: 0,
    remainingBalance: amt,
    status: 'active',
    history: [],
    weekPayments: [],
  });
  await loan.populate('employee', 'employeeId fullName');
  res.status(201).json(loan);
});

export const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError('Loan not found', 404);

  const { amount, installment, reason, status, date, startWeek } = req.body;
  if (amount != null) {
    loan.amount = Number(amount);
  }
  if (installment != null) loan.installment = Number(installment);
  if (reason != null) loan.reason = reason;
  if (status != null) loan.status = status;
  if (date != null) loan.date = date;
  if (startWeek != null) loan.startWeek = Number(startWeek);

  recalcFromWeekPayments(loan);
  await loan.save();
  await loan.populate('employee', 'employeeId fullName');
  res.json(loan);
});

/** Set / update a weekly repayment on the IOU Tracker (syncs payroll & payslips when present) */
export const setWeekPayment = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError('Loan not found', 404);

  const year = Number(req.body.year);
  const month = Number(req.body.month);
  const week = Number(req.body.week);
  const amount = round2(Math.max(0, Number(req.body.amount) || 0));

  if (!year || !month || week < 1 || week > 5) {
    throw new AppError('year, month and week (1–5) are required');
  }

  // Seed other weeks from payslips so balance math stays consistent on first edit
  const payslips = await Payslip.find({
    type: 'weekly',
    year,
    month,
    employee: loan.employee,
  }).select('week iouDeduction');

  if (!loan.weekPayments) loan.weekPayments = [];

  for (const ps of payslips) {
    const w = Number(ps.week);
    if (w < 1 || w > 5) continue;
    const exists = loan.weekPayments.some(
      (p) => p.year === year && p.month === month && p.week === w
    );
    if (!exists && (ps.iouDeduction || 0) > 0) {
      loan.weekPayments.push({
        year,
        month,
        week: w,
        amount: round2(ps.iouDeduction || 0),
      });
    }
  }

  const idx = loan.weekPayments.findIndex(
    (p) => p.year === year && p.month === month && p.week === week
  );
  if (idx >= 0) loan.weekPayments[idx].amount = amount;
  else loan.weekPayments.push({ year, month, week, amount });

  loan.markModified('weekPayments');
  recalcFromWeekPayments(loan);
  await loan.save();

  await syncPayrollIou(loan.employee, year, month, week, amount);

  await loan.populate('employee', 'employeeId fullName');
  res.json(loan);
});

export const addPayment = asyncHandler(async (req, res) => {
  const loan = await Loan.findById(req.params.id);
  if (!loan) throw new AppError('Loan not found', 404);
  const { amount, note, method } = req.body;
  const pay = Number(amount);
  if (!pay || pay <= 0) throw new AppError('Valid amount required');

  const applied = Math.min(pay, loan.remainingBalance);
  loan.history.push({
    amount: applied,
    date: new Date(),
    method: method || 'manual',
    note: note || '',
  });
  recalcFromWeekPayments(loan);
  await loan.save();
  await loan.populate('employee', 'employeeId fullName');
  res.json(loan);
});

export const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findByIdAndDelete(req.params.id);
  if (!loan) throw new AppError('Loan not found', 404);
  res.json({ message: 'Loan deleted' });
});

export const loanSummary = asyncHandler(async (req, res) => {
  const loans = await Loan.find();
  const totalIOU = loans.reduce((s, l) => s + l.amount, 0);
  const pending = loans
    .filter((l) => l.status === 'active')
    .reduce((s, l) => s + l.remainingBalance, 0);
  const paid = loans.reduce((s, l) => s + l.amountPaid, 0);
  res.json({
    totalIOU: round2(totalIOU),
    pendingIOU: round2(pending),
    paidIOU: round2(paid),
    count: loans.length,
  });
});
