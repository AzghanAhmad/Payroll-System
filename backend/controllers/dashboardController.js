import Employee from '../models/Employee.js';
import Payroll from '../models/Payroll.js';
import Loan from '../models/Loan.js';
import Timesheet from '../models/Timesheet.js';
import Department from '../models/Department.js';
import Notification from '../models/Notification.js';
import LeaveEntry, { LEAVE_TYPES, LEAVE_TYPE_LABELS } from '../models/LeaveEntry.js';
import CalendarEvent from '../models/CalendarEvent.js';
import Settings from '../models/Settings.js';
import { asyncHandler, round2 } from '../utils/helpers.js';
import {
  getLeaveCycle,
  startOfDay,
  DEFAULT_LEAVE_ENTITLEMENTS,
} from '../services/leaveService.js';
import { MONTH_NAMES } from '../services/payrollSchedule.js';

const activity = ({ id, title, message, type = 'info', link = '', at }) => ({
  _id: id,
  title,
  message,
  type,
  link,
  createdAt: at,
});

/** Build live activity feed from recent records across the app */
const buildRecentActivities = async (limit = 15) => {
  const [
    leaves,
    payrolls,
    loans,
    employees,
    timesheets,
    holidays,
    notifications,
  ] = await Promise.all([
    LeaveEntry.find()
      .populate('employee', 'fullName')
      .sort({ updatedAt: -1 })
      .limit(8),
    Payroll.find().sort({ updatedAt: -1 }).limit(8),
    Loan.find()
      .populate('employee', 'fullName')
      .sort({ updatedAt: -1 })
      .limit(8),
    Employee.find().sort({ createdAt: -1 }).limit(6),
    Timesheet.find().sort({ updatedAt: -1 }).limit(6),
    CalendarEvent.find({ type: 'holiday' }).sort({ createdAt: -1 }).limit(6),
    Notification.find().sort({ createdAt: -1 }).limit(6),
  ]);

  const items = [];

  for (const n of notifications) {
    items.push(
      activity({
        id: `n-${n._id}`,
        title: n.title,
        message: n.message,
        type: n.type || 'info',
        link: n.link || '',
        at: n.createdAt,
      })
    );
  }

  for (const e of leaves) {
    const name = e.employee?.fullName || 'Staff';
    const leaveLabel = LEAVE_TYPE_LABELS[e.leaveType] || e.leaveType;
    items.push(
      activity({
        id: `leave-${e._id}-${e.updatedAt?.getTime?.() || ''}`,
        title: `Leave ${e.status || 'updated'}`,
        message: `${name} · ${leaveLabel} · ${Number(e.daysCounted || 0)} day(s)`,
        type: e.status === 'Approved' ? 'success' : e.status === 'Rejected' ? 'danger' : 'info',
        link: '/leave',
        at: e.updatedAt || e.createdAt,
      })
    );
  }

  for (const p of payrolls) {
    const label =
      p.type === 'weekly'
        ? `Week ${p.week} — ${MONTH_NAMES[(p.month || 1) - 1]} ${p.year}`
        : `${MONTH_NAMES[(p.month || 1) - 1]} ${p.year}`;
    items.push(
      activity({
        id: `payroll-${p._id}-${p.updatedAt?.getTime?.() || ''}`,
        title: `${p.type === 'weekly' ? 'Weekly' : 'Monthly'} payroll generated`,
        message: `${label} · Net ${round2(p.totals?.netPay || 0)} · ${p.status || 'finalized'}`,
        type: 'success',
        link: '/payroll',
        at: p.updatedAt || p.createdAt,
      })
    );
  }

  for (const l of loans) {
    const name = l.employee?.fullName || 'Staff';
    const lastPay = l.history?.length ? l.history[l.history.length - 1] : null;
    const at = lastPay?.date || l.updatedAt || l.createdAt;
    items.push(
      activity({
        id: `loan-${l._id}-${new Date(at).getTime()}`,
        title: l.status === 'paid' ? 'IOU fully repaid' : lastPay ? 'IOU payment recorded' : 'IOU issued',
        message: lastPay
          ? `${name} · paid ${round2(lastPay.amount)} · balance ${round2(l.remainingBalance)}`
          : `${name} · amount ${round2(l.amount)} · ${l.status}`,
        type: l.status === 'paid' ? 'success' : 'warning',
        link: '/iou-tracker',
        at,
      })
    );
  }

  for (const emp of employees) {
    items.push(
      activity({
        id: `emp-${emp._id}`,
        title: 'Employee added',
        message: `${emp.fullName}${emp.employeeId ? ` (${emp.employeeId})` : ''} · ${emp.status || 'active'}`,
        type: 'info',
        link: '/employees',
        at: emp.createdAt,
      })
    );
  }

  for (const ts of timesheets) {
    items.push(
      activity({
        id: `ts-${ts._id}-${ts.updatedAt?.getTime?.() || ''}`,
        title: 'Timesheet updated',
        message: `${MONTH_NAMES[(ts.month || 1) - 1]} ${ts.year} · ${round2(ts.monthlyHours || 0)} hrs · ${ts.status || 'draft'}`,
        type: 'info',
        link: '/timesheets',
        at: ts.updatedAt || ts.createdAt,
      })
    );
  }

  for (const h of holidays) {
    items.push(
      activity({
        id: `cal-${h._id}`,
        title: 'Holiday / calendar event added',
        message: `${h.title} · ${new Date(h.date).toLocaleDateString('en-GB')}`,
        type: 'info',
        link: '/calendar',
        at: h.createdAt,
      })
    );
  }

  items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // De-dupe near-identical titles+messages within same second
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    const key = `${item.title}|${item.message}|${new Date(item.createdAt).toISOString().slice(0, 16)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
    if (unique.length >= limit) break;
  }
  return unique;
};

const getEntitlements = (settings) => ({
  annual: settings?.leaveAnnual ?? DEFAULT_LEAVE_ENTITLEMENTS.annual,
  sick: settings?.leaveSick ?? DEFAULT_LEAVE_ENTITLEMENTS.sick,
  maternity: settings?.leaveMaternity ?? DEFAULT_LEAVE_ENTITLEMENTS.maternity,
  paternity: settings?.leavePaternity ?? DEFAULT_LEAVE_ENTITLEMENTS.paternity,
  bereavement: settings?.leaveBereavement ?? DEFAULT_LEAVE_ENTITLEMENTS.bereavement,
});

const buildLeaveSummary = async (asOf = new Date()) => {
  const settings = (await Settings.findOne()) || {};
  const entitlements = getEntitlements(settings);
  const employees = await Employee.find({ status: 'active' }).select('fullName hireDate');
  const entries = await LeaveEntry.find({ status: 'Approved' }).select(
    'employee leaveType startDate daysCounted'
  );

  const byType = Object.fromEntries(
    LEAVE_TYPES.map((t) => [t, { entitlement: 0, used: 0, remaining: 0 }])
  );

  let staffWithHire = 0;
  let totalLeaveEntitlement = 0;
  let totalLeaveUsed = 0;
  let totalLeaveRemaining = 0;

  for (const emp of employees) {
    const cycle = getLeaveCycle(emp.hireDate, asOf);
    if (!cycle.hireDate) continue;
    staffWithHire += 1;

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
      const remaining = round2(Math.max(0, ent - used));
      byType[type].entitlement = round2(byType[type].entitlement + ent);
      byType[type].used = round2(byType[type].used + used);
      byType[type].remaining = round2(byType[type].remaining + remaining);
      totalLeaveEntitlement = round2(totalLeaveEntitlement + ent);
      totalLeaveUsed = round2(totalLeaveUsed + used);
      totalLeaveRemaining = round2(totalLeaveRemaining + remaining);
    }
  }

  const leaveByType = LEAVE_TYPES.map((t) => ({
    type: t,
    name: LEAVE_TYPE_LABELS[t],
    short: LEAVE_TYPE_LABELS[t].replace(' Leave', ''),
    entitlement: byType[t].entitlement,
    used: byType[t].used,
    remaining: byType[t].remaining,
  }));

  const pendingRequests = await LeaveEntry.countDocuments({ status: 'Pending' });
  const approvedThisMonth = await LeaveEntry.countDocuments({
    status: 'Approved',
    startDate: {
      $gte: new Date(asOf.getFullYear(), asOf.getMonth(), 1),
      $lte: new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0, 23, 59, 59),
    },
  });

  // Top staff by leave remaining (with hire date)
  const staffRemaining = [];
  for (const emp of employees) {
    const cycle = getLeaveCycle(emp.hireDate, asOf);
    if (!cycle.hireDate) continue;
    let rem = 0;
    for (const type of LEAVE_TYPES) {
      const ent = entitlements[type] || 0;
      let used = 0;
      for (const e of entries) {
        if (String(e.employee) !== String(emp._id) || e.leaveType !== type) continue;
        const start = startOfDay(e.startDate);
        if (start >= cycle.currentCycleStart && start < cycle.nextAnniversary) {
          used += Number(e.daysCounted) || 0;
        }
      }
      rem += Math.max(0, ent - used);
    }
    staffRemaining.push({
      name: emp.fullName,
      remaining: round2(rem),
      daysToReset: cycle.daysToReset,
    });
  }
  staffRemaining.sort((a, b) => b.remaining - a.remaining);

  return {
    cards: {
      totalLeaveEntitlement,
      totalLeaveUsed,
      totalLeaveRemaining,
      pendingLeaveRequests: pendingRequests,
      approvedLeaveThisMonth: approvedThisMonth,
      staffOnLeaveCycle: staffWithHire,
    },
    leaveByType,
    leaveRemainingPie: leaveByType.map((r) => ({
      name: r.short,
      value: r.remaining,
    })),
    topLeaveBalances: staffRemaining.slice(0, 8),
  };
};

export const getDashboard = asyncHandler(async (req, res) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const [totalEmployees, activeEmployees, departments, loans, monthlyPayrolls, weeklyPayrolls, timesheet, leaveSummary] =
    await Promise.all([
      Employee.countDocuments(),
      Employee.countDocuments({ status: 'active' }),
      Department.find(),
      Loan.find({ status: 'active' }),
      Payroll.find({ year, month, type: 'monthly' }),
      Payroll.find({ year, month, type: 'weekly' }).sort({ week: 1 }),
      Timesheet.findOne({ year, month }).populate('weeks.entries.employee', 'fullName'),
      buildLeaveSummary(now),
    ]);

  const currentMonthPayroll = monthlyPayrolls[0]?.totals?.netPay
    || weeklyPayrolls.reduce((s, p) => s + (p.totals?.netPay || 0), 0);
  const currentWeekPayroll = weeklyPayrolls.at(-1)?.totals?.netPay || 0;
  const monthlyCost = monthlyPayrolls[0]?.totals?.grossPay
    || weeklyPayrolls.reduce((s, p) => s + (p.totals?.grossPay || 0), 0);
  const employerCost = monthlyPayrolls[0]?.totals?.employerCost
    || weeklyPayrolls.reduce((s, p) => s + (p.totals?.employerCost || 0), 0);

  const totalIOU = await Loan.aggregate([{ $group: { _id: null, total: { $sum: '$amount' } } }]);
  const pendingIOU = loans.reduce((s, l) => s + l.remainingBalance, 0);

  const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][
    now.getDay()
  ];
  let todayAttendance = 0;
  if (timesheet) {
    const week = timesheet.weeks.find((w) => w.weekNumber === Math.ceil(now.getDate() / 7)) || timesheet.weeks[0];
    if (week) {
      todayAttendance = week.entries.filter((e) => (e.days?.[dayName]?.workingHours || 0) > 0).length;
    }
  }

  const yearPayrolls = await Payroll.find({ year, type: 'monthly' }).sort({ month: 1 });
  const payrollCostChart = Array.from({ length: 12 }, (_, i) => {
    const p = yearPayrolls.find((x) => x.month === i + 1);
    return { month: i + 1, gross: p?.totals?.grossPay || 0, net: p?.totals?.netPay || 0 };
  });

  const deptCounts = await Employee.aggregate([
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const deptMap = Object.fromEntries(departments.map((d) => [String(d._id), d.name]));
  const departmentChart = deptCounts.map((d) => ({
    name: deptMap[d._id] || 'Unassigned',
    count: d.count,
  }));

  const attendanceChart = (timesheet?.weeks || []).map((w) => ({
    week: `W${w.weekNumber}`,
    hours: round2(w.entries.reduce((s, e) => s + (e.weeklyHours || 0), 0)),
  }));

  const weeklyHoursChart = (weeklyPayrolls || []).map((p) => ({
    week: `W${p.week}`,
    normal: p.totals?.normalHours || 0,
    ot: p.totals?.otHours || 0,
    double: p.totals?.doubleHours || 0,
  }));

  const overtimeChart = weeklyHoursChart.map((w) => ({
    week: w.week,
    overtime: round2((w.ot || 0) + (w.double || 0)),
  }));

  const recentActivities = await buildRecentActivities(15);

  const upcomingPayroll = {
    year,
    month,
    nextWeek: (weeklyPayrolls.at(-1)?.week || 0) + 1,
    label: `Week ${(weeklyPayrolls.at(-1)?.week || 0) + 1} of ${month}/${year}`,
  };

  res.json({
    cards: {
      totalEmployees,
      activeEmployees,
      currentMonthPayroll: round2(currentMonthPayroll),
      currentWeekPayroll: round2(currentWeekPayroll),
      totalIOU: round2(totalIOU[0]?.total || 0),
      pendingIOU: round2(pendingIOU),
      monthlyCost: round2(monthlyCost),
      employerCost: round2(employerCost),
      todayAttendance,
      ...leaveSummary.cards,
    },
    charts: {
      payrollCost: payrollCostChart,
      departmentEmployees: departmentChart,
      monthlyPayroll: payrollCostChart,
      attendance: attendanceChart,
      weeklyHours: weeklyHoursChart,
      overtime: overtimeChart,
      leaveByType: leaveSummary.leaveByType,
      leaveRemainingPie: leaveSummary.leaveRemainingPie,
      topLeaveBalances: leaveSummary.topLeaveBalances,
    },
    recentActivities,
    upcomingPayroll,
    quickActions: [
      { label: 'Add Employee', path: '/employees' },
      { label: 'Open Timesheet', path: '/timesheets' },
      { label: 'Leave Tracker', path: '/leave' },
      { label: 'Generate Payroll', path: '/payroll' },
      { label: 'Statutory Sheets', path: '/statutory' },
      { label: 'Month Control', path: '/month-control' },
      { label: 'Payroll Schedule', path: '/schedule' },
      { label: 'Calendar', path: '/calendar' },
      { label: 'IOU Tracker', path: '/iou-tracker' },
      { label: 'View Payslips', path: '/payslips' },
      { label: 'Reports', path: '/reports' },
    ],
  });
});
