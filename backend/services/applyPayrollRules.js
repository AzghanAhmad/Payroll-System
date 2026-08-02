import Timesheet from '../models/Timesheet.js';
import Payroll from '../models/Payroll.js';
import Payslip from '../models/Payslip.js';
import Employee from '../models/Employee.js';
import TeaFund from '../models/TeaFund.js';
import { WEEK_DAYS, round2 } from '../utils/helpers.js';
import { recalculateEntry, resolveDoubleTime } from './timesheetService.js';
import { calculatePayrollLine, sumPayrollTotals } from './payrollCalculator.js';
import { generatePayslipPdf } from './payslipPdf.js';
import { getWeekPeriod, formatPeriodLabel } from '../utils/weekPeriod.js';

const PAYROLL_RULE_FIELDS = [
  'weekStart',
  'normalHoursCap',
  'otMultiplier',
  'doubleMultiplier',
  'doubleTimeRule',
  'teaFundAmount',
  'employerNpfRate',
  'employeeNpfRate',
  'employerAccRate',
  'employeeAccRate',
  'taxBrackets',
];

export const payrollRulesChanged = (before, after) => {
  if (!before) return true;
  return PAYROLL_RULE_FIELDS.some((f) => {
    const a = before[f];
    const b = after[f];
    if (typeof a === 'object' || typeof b === 'object') {
      return JSON.stringify(a ?? null) !== JSON.stringify(b ?? null);
    }
    return String(a ?? '') !== String(b ?? '');
  });
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
      if (resolveDoubleTime(day, d.isDoubleTime, settings)) {
        doubleHours += d.workingHours || 0;
      }
    }
    map.set(empId, {
      totalHours: round2(total),
      doubleHours: round2(doubleHours),
      notes,
    });
  }
  return map;
};

/** Recalculate every timesheet entry with the latest payroll rules. */
export const recalculateAllTimesheets = async (settings) => {
  const timesheets = await Timesheet.find();
  let updated = 0;

  for (const ts of timesheets) {
    let changed = false;
    for (const week of ts.weeks || []) {
      for (const entry of week.entries || []) {
        const empId = entry.employee?._id || entry.employee;
        const emp = await Employee.findById(empId).select('hourlyRate');
        recalculateEntry(entry, emp?.hourlyRate || 0, settings);
        changed = true;
      }
    }
    if (changed) {
      let monthlyHours = 0;
      for (const week of ts.weeks || []) {
        for (const entry of week.entries || []) {
          monthlyHours += entry.weeklyHours || 0;
        }
      }
      ts.monthlyHours = round2(monthlyHours);
      await ts.save();
      updated += 1;
    }
  }

  return updated;
};

const rebuildPayslipFields = (line, settings, existing = {}) => {
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
    ...existing,
    hourlyRate: line.hourlyRate,
    normalHours: line.normalHours,
    otHours: line.otHours,
    doubleHours: line.doubleHours,
    normalPay: line.normalPay,
    otPay: line.otPay,
    doublePay: line.doublePay,
    otRate,
    doubleRate,
    grossPay: line.grossPay,
    employeeNpf: line.employeeNpf,
    employerNpf: line.employerNpf,
    employeeAcc: line.employeeAcc,
    employerAcc: line.employerAcc,
    tax: line.tax,
    teaFund: line.teaFund,
    iouDeduction: line.iouDeduction,
    totalDeductions,
    netPay: line.netPay,
    employerCost: line.employerCost,
    bank: line.bank || existing.bank || '',
    accountNumber: line.accountNumber || existing.accountNumber || '',
    npfNumber: line.npfNumber || existing.npfNumber || '',
  };
};

/**
 * Soft-refresh existing payroll + payslips using new rules.
 * Does NOT re-apply IOU payments or create new TeaFund rows.
 */
export const refreshGeneratedPayrolls = async (settings) => {
  const payrolls = await Payroll.find();
  let payrollCount = 0;
  let payslipCount = 0;

  for (const payroll of payrolls) {
    const { type, year, month, week } = payroll;
    const existingIou = new Map(
      (payroll.lines || []).map((l) => [String(l.employee), Number(l.iouDeduction) || 0])
    );

    let lines = [];

    if (type === 'weekly') {
      const ts = await Timesheet.findOne({ year, month }).populate('weeks.entries.employee');
      const weekData = ts?.weeks?.find((w) => w.weekNumber === Number(week));
      const hoursMap = weekData ? collectWeekHours(weekData, settings) : new Map();

      const activeEmployees = await Employee.find({ status: 'active' })
        .populate('department', 'name')
        .sort({ employeeId: 1 });

      // Keep any employees already on the payroll even if inactive now
      const empIds = new Set([
        ...activeEmployees.map((e) => String(e._id)),
        ...[...existingIou.keys()],
      ]);

      for (const empId of empIds) {
        let employee = activeEmployees.find((e) => String(e._id) === empId);
        if (!employee) {
          employee = await Employee.findById(empId).populate('department', 'name');
        }
        if (!employee) continue;

        const hours = hoursMap.get(empId) || { totalHours: 0, doubleHours: 0, notes: '' };
        const line = calculatePayrollLine({
          employee,
          totalHours: hours.totalHours,
          doubleHours: hours.doubleHours,
          settings,
          iouDeduction: 0,
          periodsPerYear: 52,
        });

        // Preserve prior IOU deduction amount; recompute net with new tea/NPF/tax
        const priorIou = existingIou.get(empId) || 0;
        if (line.grossPay > 0) {
          line.teaFund = round2(settings.teaFundAmount ?? 0);
          line.iouDeduction = round2(
            Math.min(
              priorIou,
              Math.max(
                0,
                line.grossPay - line.employeeNpf - line.employeeAcc - line.tax - line.teaFund
              )
            )
          );
          line.netPay = round2(
            line.grossPay -
              line.employeeNpf -
              line.employeeAcc -
              line.tax -
              line.teaFund -
              line.iouDeduction
          );
        } else {
          line.teaFund = 0;
          line.iouDeduction = 0;
          line.netPay = 0;
        }

        lines.push(line);
      }

      const { start: periodStart, end: periodEnd } = getWeekPeriod(year, month, week);
      payroll.periodLabel = `Week ${week} — ${formatPeriodLabel(periodStart, periodEnd)}`;
    } else {
      // Monthly: recompute from timesheet weeks with new rules; preserve prior IOU
      const ts = await Timesheet.findOne({ year, month }).populate('weeks.entries.employee');
      const byEmployee = new Map();
      if (ts) {
        for (const w of ts.weeks || []) {
          const hoursMap = collectWeekHours(w, settings);
          for (const [empId, hours] of hoursMap.entries()) {
            const prev = byEmployee.get(empId) || { weeks: [] };
            prev.weeks.push(hours);
            byEmployee.set(empId, prev);
          }
        }
      }

      const activeEmployees = await Employee.find({ status: 'active' })
        .populate('department', 'name')
        .sort({ employeeId: 1 });
      const empIds = new Set([
        ...activeEmployees.map((e) => String(e._id)),
        ...[...existingIou.keys()],
      ]);

      for (const empId of empIds) {
        let employee = activeEmployees.find((e) => String(e._id) === empId);
        if (!employee) {
          employee = await Employee.findById(empId).populate('department', 'name');
        }
        if (!employee) continue;

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
          if (!merged) merged = { ...line };
          else {
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
          const weeksWithPay = (data.weeks || []).filter((w) => (w.totalHours || 0) > 0).length || 1;
          merged.teaFund = round2((settings.teaFundAmount || 0) * weeksWithPay);
          const priorIou = existingIou.get(empId) || 0;
          merged.iouDeduction = round2(
            Math.min(
              priorIou,
              Math.max(
                0,
                merged.grossPay - merged.employeeNpf - merged.employeeAcc - merged.tax - merged.teaFund
              )
            )
          );
          merged.netPay = round2(
            merged.grossPay -
              merged.employeeNpf -
              merged.employeeAcc -
              merged.tax -
              merged.teaFund -
              merged.iouDeduction
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
    }

    payroll.lines = lines;
    payroll.totals = sumPayrollTotals(lines);
    await payroll.save();
    payrollCount += 1;

    // Update matching payslips + PDFs (no new TeaFund / IOU side effects)
    for (const line of lines) {
      const filter = {
        employee: line.employee,
        type,
        year,
        month,
        week: type === 'weekly' ? week : null,
      };
      const payslip = await Payslip.findOne(filter);
      if (!payslip) continue;

      const fields = rebuildPayslipFields(line, settings, {
        bank: payslip.bank,
        accountNumber: payslip.accountNumber,
        npfNumber: payslip.npfNumber,
      });
      Object.assign(payslip, fields);
      await payslip.save();
      if (line.grossPay > 0 || line.totalHours > 0) {
        try {
          payslip.pdfPath = await generatePayslipPdf(payslip._id);
          await payslip.save();
        } catch {
          // keep existing pdf if regenerate fails
        }
      }
      payslipCount += 1;

      // Sync TeaFund row amounts for this payroll (no duplicates)
      if (line.teaFund > 0) {
        await TeaFund.updateMany(
          { payroll: payroll._id, employee: line.employee },
          { $set: { amount: line.teaFund } }
        );
      }
    }
  }

  return { payrollCount, payslipCount };
};

export const applyPayrollRulesEverywhere = async (settings) => {
  const timesheets = await recalculateAllTimesheets(settings);
  const { payrollCount, payslipCount } = await refreshGeneratedPayrolls(settings);
  return { timesheets, payrollCount, payslipCount };
};
