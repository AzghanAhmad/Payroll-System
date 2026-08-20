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

/** Map department names to Cafe / Chemist buckets for ACC filing */
const normalizeAccDept = (name) => {
  const n = String(name || '').toLowerCase();
  if (/caf[eé]/.test(n)) return 'Cafe';
  if (/chemist/.test(n)) return 'Chemist';
  return String(name || 'Other');
};

const recalcPayeStatutory = (row, syncBaseFromGross = true) => {
  row.payPeriod1 = round2(Number(row.payPeriod1) || 0);
  row.payPeriod2 = round2(Number(row.payPeriod2) || 0);
  row.payPeriod3 = round2(Number(row.payPeriod3) || 0);
  row.taxPeriod1 = round2(Number(row.taxPeriod1) || 0);
  row.taxPeriod2 = round2(Number(row.taxPeriod2) || 0);
  row.taxPeriod3 = round2(Number(row.taxPeriod3) || 0);
  row.grossTotal = round2(row.payPeriod1 + row.payPeriod2 + row.payPeriod3);
  row.totalTax = round2(row.taxPeriod1 + row.taxPeriod2 + row.taxPeriod3);
  if (syncBaseFromGross) {
    row.baseAmount = row.grossTotal;
  } else {
    row.baseAmount = round2(Number(row.baseAmount) || row.grossTotal);
  }
  row.npfTotal = round2(row.baseAmount * 0.09);
  row.accTotal = round2(row.baseAmount * 0.01);
  return row;
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
    const payPeriod1 = round2(w[1].gross + w[2].gross);
    const payPeriod2 = round2(w[3].gross + w[4].gross);
    const payPeriod3 = round2(w[5].gross);
    const taxPeriod1 = round2(w[1].tax + w[2].tax);
    const taxPeriod2 = round2(w[3].tax + w[4].tax);
    const taxPeriod3 = round2(w[5].tax);
    const totalTax = round2(taxPeriod1 + taxPeriod2 + taxPeriod3);
    const grossTotal = round2(payPeriod1 + payPeriod2 + payPeriod3);
    const baseAmount = grossTotal;
    const npfTotal = round2(baseAmount * 0.09);
    const accTotal = round2(baseAmount * 0.01);
    return {
      row: idx + 1,
      employeeId: r.employeeId,
      name: r.fullName || '0',
      npfNumber: r.npfNumber || '',
      payPeriod: 'Fortnightly',
      payPeriod1,
      payPeriod2,
      payPeriod3,
      grossTotal,
      baseAmount,
      taxPeriod1,
      taxPeriod2,
      taxPeriod3,
      totalTax,
      npfTotal,
      accTotal,
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

  const payeTotal = sumField(paye, (r) => r.grossTotal);
  const payeTaxTotal = sumField(paye, (r) => r.totalTax);
  const npfTotal = sumField(npf, (r) => r.total);
  const accTotal = sumField(acc, (r) => r.total);

  const periodStart = getWeekPeriod(year, month, 1).start;
  const lastWeek = Math.max(1, ...payrolls.map((p) => p.week || 1), 4);
  const periodEnd = getWeekPeriod(year, month, Math.min(5, lastWeek)).end;

  // Apply saved cell overrides
  const StatutoryOverride = (await import('../models/StatutoryOverride.js')).default;
  const overrides = await StatutoryOverride.find({ year, month });
  const applyOverride = (sheet, rows, keyFn) => {
    for (const o of overrides.filter((x) => x.sheet === sheet)) {
      const row = rows.find((r) => keyFn(r) === o.rowKey);
      if (!row) continue;
      if (o.week && Array.isArray(row.weeks)) {
        const wi = Number(o.week) - 1;
        if (row.weeks[wi] && o.field in row.weeks[wi]) {
          row.weeks[wi][o.field] = Number(o.value) || 0;
        }
      } else if (o.field in row) {
        row[o.field] = typeof row[o.field] === 'number' ? Number(o.value) || 0 : o.value;
      }
    }
  };
  applyOverride('paye', paye, (r) => String(r.employeeId || r.row));
  applyOverride('npf', npf, (r) => String(r.npfNumber || r.name));
  applyOverride('acc', acc, (r) => String(r.row || r.name));

  for (const r of paye) {
    const empKey = String(r.employeeId || r.row);
    const hasBaseOverride = overrides.some(
      (o) => o.sheet === 'paye' && o.rowKey === empKey && o.field === 'baseAmount'
    );
    recalcPayeStatutory(r, !hasBaseOverride);
  }
  for (const r of npf) {
    r.total = round2((r.weeks || []).reduce((s, x) => s + (Number(x.employee) || 0) + (Number(x.employer) || 0), 0));
  }
  for (const r of acc) {
    r.total = round2((r.weeks || []).reduce((s, x) => s + (Number(x.employee) || 0) + (Number(x.employer) || 0), 0));
  }

  const accByDept = {};
  for (const r of acc) {
    const dept = normalizeAccDept(r.departmentName);
    accByDept[dept] = round2((accByDept[dept] || 0) + r.total);
  }
  const accCafeTotal = accByDept.Cafe || 0;
  const accChemistTotal = accByDept.Chemist || 0;

  // Recompute totals after overrides
  const sumField2 = (list, pick) => round2(list.reduce((s, r) => s + pick(r), 0));
  const payeTotal2 = sumField2(paye, (r) => Number(r.grossTotal) || 0);
  const payeTaxTotal2 = sumField2(paye, (r) => Number(r.totalTax) || 0);
  const payeNpfTotal2 = sumField2(paye, (r) => Number(r.npfTotal) || 0);
  const payeAccTotal2 = sumField2(paye, (r) => Number(r.accTotal) || 0);
  const npfTotal2 = sumField2(npf, (r) => Number(r.total) || 0);
  const accTotal2 = sumField2(acc, (r) => Number(r.total) || 0);

  const ytdPayslips = await Payslip.find({
    type: 'weekly',
    year,
    month: { $lte: month },
  }).select('grossPay tax');
  const ytdGross = round2(ytdPayslips.reduce((s, p) => s + Number(p.grossPay || 0), 0));
  const ytdTax = round2(ytdPayslips.reduce((s, p) => s + Number(p.tax || 0), 0));
  const previousGross = round2(ytdGross - payeTotal2);

  const employer = {
    companyName: settings.companyName || '',
    companyAddress: settings.companyAddress || '',
    companyPhone: settings.companyPhone || '',
    companyEmail: settings.companyEmail || '',
    taxIdentificationNumber: settings.taxIdentificationNumber || '',
    digitalSignature: settings.digitalSignature || '',
    npfEmployerNumber: settings.npfEmployerNumber || '',
    npfZone: settings.npfZone || '',
    accEmpNumber1: settings.accEmpNumber1 || '',
    accEmpNumber2: settings.accEmpNumber2 || '',
  };

  const payeSummary = {
    previousGross,
    thisMonthGross: payeTotal2,
    yearToDateGross: ytdGross,
    taxPaidThisMonth: payeTaxTotal2,
    totalTaxToPay: payeTaxTotal2,
    yearToDateTax: ytdTax,
    designation: settings.companyEmail || settings.companyPhone || '',
  };

  const statutoryTotals = {
    paye: payeTaxTotal2,
    npf: npfTotal2,
    acc: accTotal2,
    total: round2(payeTaxTotal2 + npfTotal2 + accTotal2),
    payeGross: payeTotal2,
    payeNpf: payeNpfTotal2,
    payeAcc: payeAccTotal2,
  };

  const applyMetaOverride = (target, o) => {
    if (!(o.field in target)) return;
    const val = o.value;
    target[o.field] =
      typeof target[o.field] === 'number' ? Number(val) || 0 : val;
  };

  for (const o of overrides.filter((x) => x.sheet === 'meta')) {
    if (o.rowKey === '_employer') applyMetaOverride(employer, o);
    else if (o.rowKey === '_paye_summary') applyMetaOverride(payeSummary, o);
    else if (o.rowKey === '_statutory_totals') applyMetaOverride(statutoryTotals, o);
  }

  res.json({
    year,
    month,
    employer,
    period: {
      start: periodStart,
      end: periodEnd,
      label: formatPeriodLabel(periodStart, periodEnd),
      frequency: 'Monthly',
    },
    paye: {
      rows: paye,
      totals: { gross: payeTotal2, tax: payeTaxTotal2, npf: payeNpfTotal2, acc: payeAccTotal2 },
      summary: payeSummary,
    },
    npf: {
      rows: npf,
      paymentsTotal: npfTotal2,
      loanRepayments: [],
      voluntary: [],
    },
    acc: {
      rows: acc,
      total: accTotal2,
      byDepartment: accByDept,
      cafeTotal: accCafeTotal,
      chemistTotal: accChemistTotal,
    },
    statutoryTotals,
  });
});

export const saveStatutoryOverrides = asyncHandler(async (req, res) => {
  const { year, month, overrides } = req.body;
  if (!year || !month || !Array.isArray(overrides)) {
    throw new AppError('year, month and overrides[] required');
  }
  const StatutoryOverride = (await import('../models/StatutoryOverride.js')).default;
  const results = [];
  for (const o of overrides) {
    if (!o.sheet || !o.rowKey || !o.field) continue;
    const doc = await StatutoryOverride.findOneAndUpdate(
      {
        year: Number(year),
        month: Number(month),
        sheet: o.sheet,
        rowKey: String(o.rowKey),
        week: o.week != null ? Number(o.week) : 0,
        field: o.field,
      },
      {
        value: o.value,
        updatedBy: req.user?._id,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    results.push(doc);
  }
  res.json({ saved: results.length, overrides: results });
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
    // Prefer active loan with positive amount (avoids $0 shell loans hiding real IOUs)
    const activePositive = empLoans
      .filter((l) => l.status === 'active' && Number(l.amount) > 0)
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    const primary =
      activePositive[0] ||
      empLoans.find((l) => l.status === 'active') ||
      empLoans.sort((a, b) => new Date(b.date) - new Date(a.date))[0] ||
      null;

    const amount = round2(empLoans.reduce((s, l) => s + (l.amount || 0), 0));
    const repaidLifetime = round2(
      empLoans.reduce((s, l) => s + (l.amountPaid || 0), 0)
    );
    const balance = round2(
      empLoans.reduce((s, l) => s + (l.remainingBalance || 0), 0)
    );

    const weekPays = iouByEmpWeek.get(empId) || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    // Payments recorded before this month (carry-forward)
    let priorPaid = 0;
    for (const loan of empLoans) {
      for (const wp of loan.weekPayments || []) {
        const before =
          wp.year < year || (wp.year === year && wp.month < month);
        if (before) priorPaid = round2(priorPaid + Number(wp.amount || 0));
      }
      for (const h of loan.history || []) {
        if (h.method !== 'manual' && h.method !== 'cash') continue;
        const hd = h.date ? new Date(h.date) : null;
        if (!hd) continue;
        if (
          hd.getFullYear() < year ||
          (hd.getFullYear() === year && hd.getMonth() + 1 < month)
        ) {
          priorPaid = round2(priorPaid + Number(h.amount || 0));
        }
      }
    }

    // Opening = total issued − paid before this month (carries outstanding across months)
    let running = round2(Math.max(0, amount - priorPaid));
    const openingBalance = running;
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
        : balance <= 0 && running <= 0
          ? 'Paid'
          : 'Outstanding';

    totalIssued = round2(totalIssued + amount);
    totalRepaid = round2(totalRepaid + repaidLifetime);

    return {
      employeeId: emp._id,
      loanId: primary?._id || null,
      staffName: emp.fullName,
      startWeek: primary?.startWeek || (amount > 0 ? 1 : null),
      iouAmount: amount,
      openingBalance,
      weeks,
      totalRepaid: repaidLifetime,
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

const captureStatutorySheets = (year, month) =>
  new Promise((resolve, reject) => {
    const fakeReq = { query: { year, month } };
    const fakeRes = {
      json(data) {
        resolve(data);
      },
      status() {
        return this;
      },
    };
    getStatutorySheets(fakeReq, fakeRes, reject);
  });

export const exportNpfExcel = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const data = await captureStatutorySheets(year, month);
  const { writeNpfSheetExcel } = await import('../services/npfSheetExport.js');
  await writeNpfSheetExcel(res, {
    year,
    month,
    employer: data.employer,
    period: data.period,
    npf: data.npf,
  });
});

export const exportNpfPdf = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const data = await captureStatutorySheets(year, month);
  const { streamNpfSheetPdf } = await import('../services/npfSheetExport.js');
  streamNpfSheetPdf(res, {
    year,
    month,
    employer: data.employer,
    period: data.period,
    npf: data.npf,
  });
});

export const exportAccExcel = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const data = await captureStatutorySheets(year, month);
  const { writeAccSheetExcel } = await import('../services/accSheetExport.js');
  await writeAccSheetExcel(res, {
    year,
    month,
    employer: data.employer,
    acc: data.acc,
  });
});

export const exportAccPdf = asyncHandler(async (req, res) => {
  const year = Number(req.query.year);
  const month = Number(req.query.month);
  if (!year || !month) throw new AppError('year and month required');
  const data = await captureStatutorySheets(year, month);
  const { streamAccSheetPdf } = await import('../services/accSheetExport.js');
  streamAccSheetPdf(res, {
    year,
    month,
    employer: data.employer,
    acc: data.acc,
  });
});

const captureIouTracker = (year, month, week) =>
  new Promise((resolve, reject) => {
    const fakeReq = { query: { year, month, week } };
    const fakeRes = {
      json(data) {
        resolve(data);
      },
      status() {
        return this;
      },
    };
    getIouTracker(fakeReq, fakeRes, reject);
  });

export const exportIouTrackerExcel = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const week = Number(req.query.week) || 1;
  const data = await captureIouTracker(year, month, week);
  const { writeIouTrackerExcel } = await import('../services/iouTrackerExport.js');
  await writeIouTrackerExcel(res, {
    year: data.year,
    month: data.month,
    viewWeek: data.viewWeek,
    totals: data.totals,
    staff: data.staff,
  });
});

export const exportIouTrackerPdf = asyncHandler(async (req, res) => {
  const year = Number(req.query.year) || new Date().getFullYear();
  const month = Number(req.query.month) || new Date().getMonth() + 1;
  const week = Number(req.query.week) || 1;
  const data = await captureIouTracker(year, month, week);
  const { streamIouTrackerPdf } = await import('../services/iouTrackerExport.js');
  streamIouTrackerPdf(res, {
    year: data.year,
    month: data.month,
    viewWeek: data.viewWeek,
    totals: data.totals,
    staff: data.staff,
  });
});
