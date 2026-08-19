import LeaveEntry, { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../models/LeaveEntry.js';
import Employee from '../models/Employee.js';
import Settings from '../models/Settings.js';
import CalendarEvent from '../models/CalendarEvent.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
import { AppError } from '../middleware/errorMiddleware.js';
import {
  getLeaveCycle,
  countWorkdays,
  DEFAULT_LEAVE_ENTITLEMENTS,
  startOfDay,
} from '../services/leaveService.js';
import { streamLeaveBalancePdf } from '../services/leaveBalancePdf.js';

const getSettings = async () => {
  let s = await Settings.findOne();
  if (!s) s = await Settings.create({});
  return s;
};

const getEntitlements = (settings) => ({
  annual: settings.leaveAnnual ?? DEFAULT_LEAVE_ENTITLEMENTS.annual,
  sick: settings.leaveSick ?? DEFAULT_LEAVE_ENTITLEMENTS.sick,
  maternity: settings.leaveMaternity ?? DEFAULT_LEAVE_ENTITLEMENTS.maternity,
  paternity: settings.leavePaternity ?? DEFAULT_LEAVE_ENTITLEMENTS.paternity,
  bereavement: settings.leaveBereavement ?? DEFAULT_LEAVE_ENTITLEMENTS.bereavement,
});

const holidaySetForRange = async (start, end) => {
  const events = await CalendarEvent.find({
    type: 'holiday',
    date: { $gte: startOfDay(start), $lte: startOfDay(end) },
  });
  return new Set(events.map((e) => startOfDay(e.date).toISOString().slice(0, 10)));
};

const computeDays = async (startDate, endDate, overrideDays) => {
  const holidays = await holidaySetForRange(startDate, endDate);
  const calculated = countWorkdays(startDate, endDate, holidays);
  const daysCounted =
    overrideDays != null && overrideDays !== ''
      ? Number(overrideDays)
      : calculated;
  return { calculatedWorkdays: calculated, daysCounted: round2(daysCounted) };
};

const buildStaffBalanceRow = (emp, entries, entitlements, asOf) => {
  const cycle = getLeaveCycle(emp.hireDate, asOf);
  const row = {
    employeeId: emp._id,
    staffName: emp.fullName,
    email: emp.email || '',
    hireDate: emp.hireDate || null,
    currentLeaveCycle: cycle.currentCycleStart,
    nextAnniversary: cycle.nextAnniversary,
    daysToReset: cycle.daysToReset,
    status: cycle.status,
    types: {},
    totalLeaveLeft: 0,
  };

  for (const type of LEAVE_TYPES) {
    const ent = entitlements[type] || 0;
    let used = 0;
    if (cycle.currentCycleStart) {
      for (const e of entries) {
        if (String(e.employee) !== String(emp._id)) continue;
        if (e.leaveType !== type) continue;
        const start = startOfDay(e.startDate);
        if (start >= cycle.currentCycleStart && start < cycle.nextAnniversary) {
          used += Number(e.daysCounted) || 0;
        }
      }
    }
    used = round2(used);
    const left = cycle.hireDate ? round2(Math.max(0, ent - used)) : 0;
    row.types[type] = {
      entitlement: cycle.hireDate ? ent : 0,
      used: cycle.hireDate ? used : 0,
      left,
    };
    row.totalLeaveLeft = round2(row.totalLeaveLeft + left);
  }
  return row;
};

export const getLeaveEntitlements = asyncHandler(async (req, res) => {
  const settings = await getSettings();
  res.json({
    entitlements: getEntitlements(settings),
    labels: LEAVE_TYPE_LABELS,
    types: LEAVE_TYPES,
  });
});

export const getLeaveDashboard = asyncHandler(async (req, res) => {
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
  const settings = await getSettings();
  const entitlements = getEntitlements(settings);

  const employees = await Employee.find({ status: { $in: ['active', 'inactive'] } })
    .select('fullName employeeId hireDate status email')
    .sort({ fullName: 1 });

  const entries = await LeaveEntry.find({ status: 'Approved' }).select(
    'employee leaveType startDate endDate daysCounted'
  );

  const staff = employees.map((emp) => buildStaffBalanceRow(emp, entries, entitlements, asOf));

  const totals = {};
  for (const type of LEAVE_TYPES) {
    totals[type] = round2(staff.reduce((s, r) => s + (r.types[type]?.left || 0), 0));
  }
  const missingHireDates = staff.filter((s) => s.status === 'Hire date required').length;

  res.json({
    asOf,
    entitlements,
    labels: LEAVE_TYPE_LABELS,
    staff,
    totals,
    missingHireDates,
  });
});

const LEAVE_NOTES = {
  annual: 'Renews on hire anniversary',
  sick: 'Renews on hire anniversary',
  maternity: 'Subject to eligibility',
  paternity: 'Subject to eligibility',
  bereavement: 'Subject to approved event',
};

/** Individual read-only leave balance sheets for each staff member */
export const getStaffLeaveSheets = asyncHandler(async (req, res) => {
  const asOf = req.query.asOf ? new Date(req.query.asOf) : new Date();
  const settings = await getSettings();
  const entitlements = getEntitlements(settings);

  const employees = await Employee.find({ status: { $in: ['active', 'inactive'] } })
    .populate('department', 'name')
    .sort({ fullName: 1 });

  const entries = await LeaveEntry.find({ status: 'Approved' }).select(
    'employee leaveType startDate endDate daysCounted'
  );

  const sheets = employees.map((emp) => {
    const cycle = getLeaveCycle(emp.hireDate, asOf);
    const types = LEAVE_TYPES.map((type) => {
      const ent = cycle.hireDate ? entitlements[type] || 0 : 0;
      let used = 0;
      if (cycle.currentCycleStart) {
        for (const e of entries) {
          if (String(e.employee) !== String(emp._id)) continue;
          if (e.leaveType !== type) continue;
          const start = startOfDay(e.startDate);
          if (start >= cycle.currentCycleStart && start < cycle.nextAnniversary) {
            used += Number(e.daysCounted) || 0;
          }
        }
      }
      used = round2(used);
      const remaining = cycle.hireDate ? round2(Math.max(0, ent - used)) : 0;
      return {
        leaveType: type,
        label: LEAVE_TYPE_LABELS[type],
        entitlement: ent,
        approvedUsed: cycle.hireDate ? used : 0,
        remaining,
        balanceStatus: remaining <= 0 && ent > 0 ? 'Used' : 'Available',
        notes: LEAVE_NOTES[type] || '',
      };
    });

    return {
      employeeId: emp._id,
      employeeName: emp.fullName,
      department: emp.department?.name || '',
      hireDate: emp.hireDate || null,
      cycleStart: cycle.currentCycleStart,
      nextReset: cycle.nextAnniversary,
      daysToReset: cycle.daysToReset,
      leaveStatus: cycle.status,
      totalLeaveRemaining: round2(types.reduce((s, t) => s + t.remaining, 0)),
      types,
    };
  });

  res.json({ asOf, labels: LEAVE_TYPE_LABELS, sheets });
});

export const listLeaveEntries = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.employee) filter.employee = req.query.employee;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.leaveType) filter.leaveType = req.query.leaveType;

  const items = await LeaveEntry.find(filter)
    .populate('employee', 'fullName employeeId hireDate')
    .sort({ startDate: -1, createdAt: -1 });
  res.json(items);
});

export const createLeaveEntry = asyncHandler(async (req, res) => {
  const {
    employee,
    leaveType,
    startDate,
    endDate,
    overrideDays,
    status = 'Approved',
    approvedBy = '',
    notes = '',
  } = req.body;

  if (!employee || !leaveType || !startDate || !endDate) {
    throw new AppError('employee, leaveType, startDate, endDate required');
  }
  if (!LEAVE_TYPES.includes(leaveType)) throw new AppError('Invalid leave type');

  const emp = await Employee.findById(employee);
  if (!emp) throw new AppError('Employee not found', 404);

  const { calculatedWorkdays, daysCounted } = await computeDays(
    new Date(startDate),
    new Date(endDate),
    overrideDays
  );

  const entry = await LeaveEntry.create({
    employee,
    leaveType,
    startDate,
    endDate,
    calculatedWorkdays,
    overrideDays: overrideDays != null && overrideDays !== '' ? Number(overrideDays) : null,
    daysCounted,
    status,
    approvedBy,
    notes,
    createdBy: req.user._id,
  });

  const populated = await LeaveEntry.findById(entry._id).populate(
    'employee',
    'fullName employeeId hireDate'
  );
  res.status(201).json(populated);
});

export const updateLeaveEntry = asyncHandler(async (req, res) => {
  const entry = await LeaveEntry.findById(req.params.id);
  if (!entry) throw new AppError('Leave entry not found', 404);

  const fields = ['employee', 'leaveType', 'startDate', 'endDate', 'overrideDays', 'status', 'approvedBy', 'notes'];
  for (const f of fields) {
    if (req.body[f] !== undefined) entry[f] = req.body[f];
  }

  const { calculatedWorkdays, daysCounted } = await computeDays(
    new Date(entry.startDate),
    new Date(entry.endDate),
    entry.overrideDays
  );
  entry.calculatedWorkdays = calculatedWorkdays;
  entry.daysCounted = daysCounted;
  if (req.body.overrideDays === null || req.body.overrideDays === '') {
    entry.overrideDays = null;
  }

  await entry.save();
  const populated = await LeaveEntry.findById(entry._id).populate(
    'employee',
    'fullName employeeId hireDate'
  );
  res.json(populated);
});

export const deleteLeaveEntry = asyncHandler(async (req, res) => {
  const entry = await LeaveEntry.findByIdAndDelete(req.params.id);
  if (!entry) throw new AppError('Leave entry not found', 404);
  res.json({ message: 'Deleted' });
});

/** Email (or queue) one staff member's leave balance summary */
export const emailLeaveBalance = asyncHandler(async (req, res) => {
  const { employeeId, asOf } = req.body;
  if (!employeeId) throw new AppError('employeeId required');

  const emp = await Employee.findById(employeeId).select('fullName email hireDate');
  if (!emp) throw new AppError('Employee not found', 404);

  const to = req.body.to || emp.email;
  if (!to) throw new AppError('No email address — add one on the employee record or pass to=');

  // Reuse dashboard math for one person
  req.query.asOf = asOf || new Date().toISOString().slice(0, 10);
  const settings = await getSettings();
  const entitlements = getEntitlements(settings);
  const cycle = getLeaveCycle(emp.hireDate, asOf ? new Date(asOf) : new Date());
  const entries = await LeaveEntry.find({
    employee: emp._id,
    status: 'Approved',
  }).select('leaveType startDate endDate daysCounted');

  const lines = [];
  let totalLeft = 0;
  for (const t of LEAVE_TYPES) {
    const used = round2(
      entries
        .filter((e) => {
          if (e.leaveType !== t) return false;
          if (!cycle.currentCycleStart) return true;
          const d = new Date(e.startDate);
          return d >= cycle.currentCycleStart && d < cycle.nextAnniversary;
        })
        .reduce((s, e) => s + (e.daysCounted || 0), 0)
    );
    const ent = entitlements[t] ?? 0;
    const left = round2(Math.max(0, ent - used));
    totalLeft = round2(totalLeft + left);
    lines.push(`${LEAVE_TYPE_LABELS[t] || t}: entitlement ${ent}, used ${used}, left ${left}`);
  }

  const { sendMail } = await import('../services/emailService.js');
  const subject = `Leave balance — ${emp.fullName}`;
  const text = [
    `Dear ${emp.fullName},`,
    '',
    `Your leave balance as of ${req.query.asOf}:`,
    ...lines.map((l) => `• ${l}`),
    '',
    `Total days left: ${totalLeft}`,
    cycle.nextAnniversary
      ? `Next leave-cycle reset: ${new Date(cycle.nextAnniversary).toLocaleDateString('en-GB')}`
      : '',
    '',
    '— Alpha Group Payroll',
  ]
    .filter(Boolean)
    .join('\n');

  const result = await sendMail({
    to,
    subject,
    text,
    html: `<p>Dear ${emp.fullName},</p><p>Your leave balance as of <strong>${req.query.asOf}</strong>:</p><ul>${lines
      .map((l) => `<li>${l}</li>`)
      .join('')}</ul><p><strong>Total days left:</strong> ${totalLeft}</p>`,
  });

  res.json({
    message: result?.skipped ? 'Email skipped (SMTP not configured) — use Share / mailto instead' : 'Leave balance emailed',
    skipped: Boolean(result?.skipped),
    to,
  });
});

/** Download one staff member's leave balance as PDF */
export const downloadLeaveBalance = asyncHandler(async (req, res) => {
  const { employeeId, asOf: asOfStr } = req.query;
  if (!employeeId) throw new AppError('employeeId required');

  const emp = await Employee.findById(employeeId).select('fullName employeeId hireDate status email');
  if (!emp) throw new AppError('Employee not found', 404);

  const asOf = asOfStr ? new Date(asOfStr) : new Date();
  const settings = await getSettings();
  const entitlements = getEntitlements(settings);
  const entries = await LeaveEntry.find({ status: 'Approved' }).select(
    'employee leaveType startDate endDate daysCounted'
  );

  const row = buildStaffBalanceRow(emp, entries, entitlements, asOf);

  streamLeaveBalancePdf(res, {
    companyName: settings.companyName || 'Payroll',
    row,
    asOf,
    labels: LEAVE_TYPE_LABELS,
  });
});
