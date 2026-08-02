import Payroll from '../models/Payroll.js';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import Loan from '../models/Loan.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import { getWeekPeriod, formatPeriodLabel } from '../utils/weekPeriod.js';

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

const buildEmployeeWeekMap = async (year, month) => {
  const payrolls = await Payroll.find({ type: 'weekly', year, month }).sort({ week: 1 });
  const byEmp = new Map();

  const ensure = (empId, meta = {}) => {
    if (!byEmp.has(empId)) {
      byEmp.set(empId, {
        employeeId: empId,
        fullName: meta.fullName || '',
        npfNumber: meta.npfNumber || '',
        departmentName: meta.departmentName || '',
        weeks: {
          1: { gross: 0, tax: 0, empNpf: 0, erNpf: 0, empAcc: 0, erAcc: 0, iou: 0 },
          2: { gross: 0, tax: 0, empNpf: 0, erNpf: 0, empAcc: 0, erAcc: 0, iou: 0 },
          3: { gross: 0, tax: 0, empNpf: 0, erNpf: 0, empAcc: 0, erAcc: 0, iou: 0 },
          4: { gross: 0, tax: 0, empNpf: 0, erNpf: 0, empAcc: 0, erAcc: 0, iou: 0 },
          5: { gross: 0, tax: 0, empNpf: 0, erNpf: 0, empAcc: 0, erAcc: 0, iou: 0 },
        },
      });
    }
    return byEmp.get(empId);
  };

  for (const p of payrolls) {
    const w = Number(p.week) || 0;
    if (w < 1 || w > 5) continue;
    for (const line of p.lines || []) {
      const empId = String(line.employee?._id || line.employee);
      const row = ensure(empId);
      row.weeks[w].gross = round2(line.grossPay || 0);
      row.weeks[w].tax = round2(line.tax || 0);
      row.weeks[w].empNpf = round2(line.employeeNpf || 0);
      row.weeks[w].erNpf = round2(line.employerNpf || 0);
      row.weeks[w].empAcc = round2(line.employeeAcc || 0);
      row.weeks[w].erAcc = round2(line.employerAcc || 0);
      row.weeks[w].iou = round2(line.iouDeduction || 0);
    }
  }

  // Fill names from employees / payslips
  const employees = await Employee.find({ status: { $in: ['active', 'inactive'] } })
    .populate('department', 'name')
    .sort({ fullName: 1 });

  for (const emp of employees) {
    const row = ensure(String(emp._id), {
      fullName: emp.fullName,
      npfNumber: emp.npfNumber || '',
      departmentName: emp.department?.name || '',
    });
    row.fullName = emp.fullName;
    row.npfNumber = emp.npfNumber || '';
    row.departmentName = emp.department?.name || '';
    row.employeeCode = emp.employeeId || '';
  }

  // Also include anyone on payroll who isn't in employee list meta
  const payslips = await Payslip.find({ type: 'weekly', year, month }).populate(
    'employee',
    'fullName npfNumber employeeId department'
  );
  for (const ps of payslips) {
    if (!ps.employee) continue;
    const empId = String(ps.employee._id);
    const row = ensure(empId);
    if (!row.fullName) row.fullName = ps.employee.fullName;
    if (!row.npfNumber) row.npfNumber = ps.employee.npfNumber || ps.npfNumber || '';
    if (!row.departmentName) row.departmentName = ps.departmentName || '';
  }

  return { byEmp, payrolls, employees };
};

export const getStatutorySheets = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');

  const settings = await getSettings();
  const { byEmp, payrolls } = await buildEmployeeWeekMap(year, month);

  const rows = [...byEmp.values()].sort((a, b) =>
    String(a.fullName || '').localeCompare(String(b.fullName || ''))
  );

  const paye = rows.map((r, idx) => {
    const w = r.weeks;
    const total12 = round2(w[1].gross + w[2].gross);
    const total34 = round2(w[3].gross + w[4].gross);
    const total5 = round2(w[5].gross);
    const totalTax = round2(
      w[1].tax + w[2].tax + w[3].tax + w[4].tax + w[5].tax
    );
    const grandTotal = round2(total12 + total34 + total5);
    return {
      row: idx + 1,
      employeeId: r.employeeId,
      name: r.fullName || '0',
      week1: w[1].gross,
      week2: w[2].gross,
      total12,
      week3: w[3].gross,
      week4: w[4].gross,
      total34,
      week5: w[5].gross,
      total5,
      totalTax,
      grandTotal,
    };
  });

  const npf = rows.map((r) => {
    const weeks = [1, 2, 3, 4, 5].map((n) => ({
      employee: r.weeks[n].empNpf,
      employer: r.weeks[n].erNpf,
    }));
    const total = round2(
      weeks.reduce((s, x) => s + x.employee + x.employer, 0)
    );
    return {
      npfNumber: r.npfNumber || '0',
      name: r.fullName || '0',
      transactionType: 'Compulsory',
      weeks,
      total,
    };
  });

  const acc = rows.map((r, idx) => {
    const weeks = [1, 2, 3, 4, 5].map((n) => ({
      employee: r.weeks[n].empAcc,
      employer: r.weeks[n].erAcc,
    }));
    const total = round2(
      weeks.reduce((s, x) => s + x.employee + x.employer, 0)
    );
    return {
      row: idx + 1,
      name: r.fullName || '0',
      departmentName: r.departmentName || '',
      weeks,
      total,
    };
  });

  const sumField = (list, pick) => round2(list.reduce((s, r) => s + pick(r), 0));

  const payeTotal = sumField(paye, (r) => r.grandTotal);
  const payeTaxTotal = sumField(paye, (r) => r.totalTax);
  const npfTotal = sumField(npf, (r) => r.total);
  const accTotal = sumField(acc, (r) => r.total);

  // Department ACC split (Café / Chemist style)
  const accByDept = {};
  for (const r of acc) {
    const dept = r.departmentName || 'Other';
    accByDept[dept] = round2((accByDept[dept] || 0) + r.total);
  }

  const periodStart = getWeekPeriod(year, month, 1).start;
  const lastWeek = Math.max(1, ...payrolls.map((p) => p.week || 1), 4);
  const periodEnd = getWeekPeriod(year, month, Math.min(5, lastWeek)).end;

  res.json({
    year,
    month,
    employer: {
      companyName: settings.companyName || '',
      companyAddress: settings.companyAddress || '',
      companyPhone: settings.companyPhone || '',
      companyEmail: settings.companyEmail || '',
      npfEmployerNumber: settings.npfEmployerNumber || '',
      npfZone: settings.npfZone || '',
      accEmpNumber1: settings.accEmpNumber1 || '',
      accEmpNumber2: settings.accEmpNumber2 || '',
    },
    period: {
      start: periodStart,
      end: periodEnd,
      label: formatPeriodLabel(periodStart, periodEnd),
      frequency: 'Monthly',
    },
    paye: {
      rows: paye,
      totals: { gross: payeTotal, tax: payeTaxTotal },
    },
    npf: {
      rows: npf,
      paymentsTotal: npfTotal,
      loanRepayments: [],
      voluntary: [],
    },
    acc: {
      rows: acc,
      total: accTotal,
      byDepartment: accByDept,
    },
    statutoryTotals: {
      paye: payeTaxTotal,
      npf: npfTotal,
      acc: accTotal,
      total: round2(payeTaxTotal + npfTotal + accTotal),
      // Also expose gross-based PAYE sheet total for reference
      payeGross: payeTotal,
    },
  });
});

/**
 * Staff IOU Tracker for a payroll month — week-by-week payments & balances.
 */
export const getIouTracker = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const viewWeek = Number(req.query.week) || 1;

  const employees = await Employee.find({ status: 'active' })
    .select('fullName employeeId')
    .sort({ fullName: 1 });

  const loans = await Loan.find({
    status: { $in: ['active', 'paid'] },
  }).populate('employee', 'fullName');

  const payslips = await Payslip.find({ type: 'weekly', year, month }).select(
    'employee week iouDeduction'
  );

  const iouByEmpWeek = new Map(); // empId -> {1: amt, ...}
  for (const ps of payslips) {
    const empId = String(ps.employee);
    const w = Number(ps.week);
    if (!iouByEmpWeek.has(empId)) {
      iouByEmpWeek.set(empId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
    if (w >= 1 && w <= 5) {
      iouByEmpWeek.get(empId)[w] = round2(
        (iouByEmpWeek.get(empId)[w] || 0) + (ps.iouDeduction || 0)
      );
    }
  }

  // Tracker weekPayments override payslip values
  for (const loan of loans) {
    const empId = String(loan.employee?._id || loan.employee);
    if (!iouByEmpWeek.has(empId)) {
      iouByEmpWeek.set(empId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
    for (const wp of loan.weekPayments || []) {
      if (wp.year === year && wp.month === month && wp.week >= 1 && wp.week <= 5) {
        iouByEmpWeek.get(empId)[wp.week] = round2(Number(wp.amount || 0));
      }
    }
  }

  // Also pull payroll-method history into weeks when payslip + weekPayment missing
  const payrolls = await Payroll.find({ type: 'weekly', year, month }).select('_id week');
  const payrollWeek = new Map(payrolls.map((p) => [String(p._id), p.week]));

  for (const loan of loans) {
    const empId = String(loan.employee?._id || loan.employee);
    if (!iouByEmpWeek.has(empId)) {
      iouByEmpWeek.set(empId, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    }
    const hasTrackerWeeks = (loan.weekPayments || []).some(
      (p) => p.year === year && p.month === month
    );
    if (hasTrackerWeeks) continue;
    for (const h of loan.history || []) {
      if (h.method !== 'payroll' || !h.payroll) continue;
      const w = payrollWeek.get(String(h.payroll));
      if (w >= 1 && w <= 5 && !iouByEmpWeek.get(empId)[w]) {
        iouByEmpWeek.get(empId)[w] = round2(h.amount || 0);
      }
    }
  }

  let totalIssued = 0;
  let totalRepaid = 0;

  const staff = employees.map((emp) => {
    const empId = String(emp._id);
    const empLoans = loans.filter(
      (l) => String(l.employee?._id || l.employee) === empId
    );
    // Prefer active loan, else most recent
    const primary =
      empLoans.find((l) => l.status === 'active') ||
      empLoans.sort((a, b) => new Date(b.date) - new Date(a.date))[0] ||
      null;

    const amount = round2(primary?.amount || 0);
    const repaidLifetime = round2(
      empLoans.reduce((s, l) => s + (l.amountPaid || 0), 0)
    );
    const balance = round2(
      empLoans.reduce((s, l) => s + (l.remainingBalance || 0), 0)
    );

    const weekPays = iouByEmpWeek.get(empId) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // Excel style: start from IOU amount, subtract each week payment
    let running = amount;
    const weeks = [];
    let monthRepaid = 0;
    for (let w = 1; w <= 5; w++) {
      const pay = round2(weekPays[w] || 0);
      monthRepaid = round2(monthRepaid + pay);
      running = round2(Math.max(0, running - pay));
      weeks.push({ week: w, payment: pay, balance: running });
    }

    const status =
      amount <= 0
        ? 'No IOU'
        : running <= 0
          ? 'Paid'
          : 'Outstanding';

    totalIssued = round2(totalIssued + amount);
    totalRepaid = round2(totalRepaid + monthRepaid);

    return {
      employeeId: emp._id,
      loanId: primary?._id || null,
      staffName: emp.fullName,
      startWeek: primary?.startWeek || (amount > 0 ? 1 : null),
      iouAmount: amount,
      weeks,
      totalRepaid: monthRepaid,
      dateLoaned: primary?.date || null,
      purpose: primary?.reason || '',
      status,
      remainingBalance: balance,
    };
  });

  res.json({
    year,
    month,
    viewWeek,
    totals: {
      totalIssued,
      totalRepaid,
      outstanding: round2(Math.max(0, totalIssued - totalRepaid)),
    },
    staff,
  });
});
