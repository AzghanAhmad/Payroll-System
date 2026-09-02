/**
 * One-shot: clear leftover IOU for named staff (loans + payslip/payroll snapshots).
 * Usage: node scripts/resetIouForStaff.js
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import connectDB from '../config/db.js';
import Employee from '../models/Employee.js';
import Loan from '../models/Loan.js';
import Payslip from '../models/Payslip.js';
import Payroll from '../models/Payroll.js';
import { round2 } from '../utils/helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const NAMES = ['Amanono', 'Atapana'];

const clearEmployeeIouEverywhere = async (employeeId) => {
  const payslips = await Payslip.find({ employee: employeeId });
  for (const p of payslips) {
    const prev = Number(p.iouDeduction || 0);
    p.iouDeduction = 0;
    p.iouAmount = 0;
    p.iouPaid = 0;
    p.loanBalance = 0;
    p.iouPaymentsCount = 0;
    if (prev) {
      p.totalDeductions = round2(Math.max(0, (p.totalDeductions || 0) - prev));
      p.netPay = round2((p.netPay || 0) + prev);
    }
    if (p.pdfPath) p.pdfPath = '';
    await p.save();
  }

  const payrolls = await Payroll.find({ 'lines.employee': employeeId });
  for (const payroll of payrolls) {
    let changed = false;
    for (const line of payroll.lines || []) {
      if (String(line.employee) !== String(employeeId)) continue;
      const prev = Number(line.iouDeduction || 0);
      if (!prev) continue;
      line.iouDeduction = 0;
      line.netPay = round2((line.netPay || 0) + prev);
      if (payroll.totals) {
        payroll.totals.iou = round2(Math.max(0, (payroll.totals.iou || 0) - prev));
        payroll.totals.netPay = round2((payroll.totals.netPay || 0) + prev);
      }
      changed = true;
    }
    if (changed) {
      payroll.markModified('lines');
      payroll.markModified('totals');
      await payroll.save();
    }
  }
};

const syncPayrollIouZero = async (employeeId, year, month, week) => {
  const payroll = await Payroll.findOne({ type: 'weekly', year, month, week });
  if (payroll) {
    const line = (payroll.lines || []).find((l) => String(l.employee) === String(employeeId));
    if (line) {
      const prev = Number(line.iouDeduction || 0);
      line.iouDeduction = 0;
      if (payroll.totals) {
        payroll.totals.iou = round2(Math.max(0, (payroll.totals.iou || 0) - prev));
        payroll.totals.netPay = round2((payroll.totals.netPay || 0) + prev);
      }
      line.netPay = round2((line.netPay || 0) + prev);
      payroll.markModified('lines');
      payroll.markModified('totals');
      await payroll.save();
    }
  }
  const payslip = await Payslip.findOne({ type: 'weekly', year, month, week, employee: employeeId });
  if (payslip) {
    const prev = Number(payslip.iouDeduction || 0);
    payslip.iouDeduction = 0;
    payslip.totalDeductions = round2(Math.max(0, (payslip.totalDeductions || 0) - prev));
    payslip.netPay = round2((payslip.netPay || 0) + prev);
    payslip.iouAmount = 0;
    payslip.iouPaid = 0;
    payslip.loanBalance = 0;
    payslip.iouPaymentsCount = 0;
    payslip.pdfPath = '';
    await payslip.save();
  }
};

async function main() {
  await connectDB();
  const escaped = NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const emps = await Employee.find({
    $or: escaped.map((n) => ({ fullName: new RegExp(n, 'i') })),
  }).select('_id fullName');

  if (!emps.length) {
    console.log('No matching employees for', NAMES);
    process.exit(1);
  }

  console.log(
    'Clearing IOU for:',
    emps.map((e) => e.fullName).join(', ')
  );

  let loansDeleted = 0;
  for (const emp of emps) {
    const loans = await Loan.find({ employee: emp._id });
    for (const loan of loans) {
      for (const wp of loan.weekPayments || []) {
        if (wp.year && wp.month && wp.week != null) {
          await syncPayrollIouZero(emp._id, wp.year, wp.month, wp.week);
        }
      }
      await loan.deleteOne();
      loansDeleted += 1;
    }
    await clearEmployeeIouEverywhere(emp._id);
  }

  console.log(`Done. Deleted ${loansDeleted} loan(s); cleared payslip/payroll IOU for ${emps.length} staff.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
