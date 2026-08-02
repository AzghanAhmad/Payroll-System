import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Users, UserCheck, Wallet, CalendarDays, HandCoins, AlertCircle,
  TrendingUp, Building2, UserRoundCheck, Palmtree, CalendarCheck2, Layers,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts';
import { motion } from 'framer-motion';
import AppLayout from '@/layouts/AppLayout';
import { StatCard, Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { dashboardApi } from '@/services';
import { formatMoney, formatNumber } from '@/utils/helpers';

const COLORS = ['#2563EB', '#06B6D4', '#22C55E', '#F59E0B', '#EF4444', '#8B5CF6'];
const LEAVE_COLORS = {
  entitlement: '#38BDF8',
  used: '#F59E0B',
  remaining: '#22C55E',
};

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: dashboardApi.get });
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 5;

  const cards = data?.cards || {};
  const charts = data?.charts || {};
  const leaveByType = charts.leaveByType || [];

  const allActivities = data?.recentActivities || [];
  const activityTotalPages = Math.max(1, Math.ceil(allActivities.length / ACTIVITY_PAGE_SIZE));
  const pagedActivities = useMemo(() => {
    const page = Math.min(activityPage, activityTotalPages);
    const start = (page - 1) * ACTIVITY_PAGE_SIZE;
    return allActivities.slice(start, start + ACTIVITY_PAGE_SIZE);
  }, [allActivities, activityPage, activityTotalPages]);

  return (
    <AppLayout title="Dashboard">
      {isLoading ? (
        <p className="text-muted">Loading dashboard…</p>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            <StatCard title="Total Employees" value={cards.totalEmployees ?? 0} icon={Users} color="primary" delay={0} />
            <StatCard title="Active Employees" value={cards.activeEmployees ?? 0} icon={UserCheck} color="success" delay={0.05} />
            <StatCard title="Current Month Payroll" value={formatMoney(cards.currentMonthPayroll)} icon={Wallet} color="accent" delay={0.1} />
            <StatCard title="Current Week Payroll" value={formatMoney(cards.currentWeekPayroll)} icon={CalendarDays} color="primary" delay={0.15} />
            <StatCard title="Total Leave Entitlement" value={formatNumber(cards.totalLeaveEntitlement ?? 0)} icon={Palmtree} color="success" delay={0.18} />
            <StatCard title="Leave Used" value={formatNumber(cards.totalLeaveUsed ?? 0)} icon={CalendarCheck2} color="warning" delay={0.2} />
            <StatCard title="Leave Remaining" value={formatNumber(cards.totalLeaveRemaining ?? 0)} icon={Layers} color="accent" delay={0.22} />
            <StatCard title="Pending Leave Requests" value={cards.pendingLeaveRequests ?? 0} icon={AlertCircle} color="danger" delay={0.24} />
            <StatCard title="Total IOU" value={formatMoney(cards.totalIOU)} icon={HandCoins} color="warning" delay={0.26} />
            <StatCard title="Pending IOU" value={formatMoney(cards.pendingIOU)} icon={AlertCircle} color="danger" delay={0.28} />
            <StatCard title="Monthly Cost" value={formatMoney(cards.monthlyCost)} icon={TrendingUp} color="accent" delay={0.3} />
            <StatCard title="Employer Cost" value={formatMoney(cards.employerCost)} icon={Building2} color="primary" delay={0.35} />
            <StatCard title="Today's Attendance" value={cards.todayAttendance ?? 0} icon={UserRoundCheck} color="success" delay={0.4} />
          </div>

          <div>
            <h2 className="font-heading text-lg mb-3">Leave Balance Overview</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-heading mb-1">Leave by Type</h3>
                <p className="text-xs text-muted mb-4">
                  Entitlement · Approved Used · Remaining (current hire-anniversary cycle)
                </p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={leaveByType} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="short" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="entitlement" name="Entitlement" fill={LEAVE_COLORS.entitlement} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="used" name="Approved Used" fill={LEAVE_COLORS.used} radius={[6, 6, 0, 0]} />
                      <Bar dataKey="remaining" name="Remaining" fill={LEAVE_COLORS.remaining} radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-1">Leave Remaining by Type</h3>
                <p className="text-xs text-muted mb-4">Share of remaining days across leave types</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={charts.leaveRemainingPie || []}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={95}
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {(charts.leaveRemainingPie || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => formatNumber(v)} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="xl:col-span-2 overflow-hidden p-0">
                <div className="px-4 py-3 border-b bg-emerald-50/80 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-sm">Leave Balance Sheet Summary</h3>
                    <p className="text-xs text-muted">Same structure as staff leave balance sheets</p>
                  </div>
                  <Link to="/leave">
                    <Button size="sm" variant="outline">Open Leave Tracker</Button>
                  </Link>
                </div>
                <div className="overflow-x-auto p-4">
                  <table className="w-full text-xs min-w-[640px]">
                    <thead>
                      <tr className="text-left text-muted border-b">
                        <th className="py-2 pr-3">Leave Type</th>
                        <th className="py-2 px-3 text-right">Entitlement</th>
                        <th className="py-2 px-3 text-right">Approved Used</th>
                        <th className="py-2 px-3 text-right">Remaining</th>
                        <th className="py-2 pl-3">Balance Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leaveByType.map((row) => (
                        <tr key={row.type} className="border-b border-border/40">
                          <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{row.name}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(row.entitlement)}</td>
                          <td className="py-2.5 px-3 text-right tabular-nums">{formatNumber(row.used)}</td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums text-emerald-700">
                            {formatNumber(row.remaining)}
                          </td>
                          <td className="py-2.5 pl-3">
                            <span className={row.remaining <= 0 && row.entitlement > 0 ? 'text-rose-700' : 'text-emerald-700'}>
                              {row.remaining <= 0 && row.entitlement > 0 ? 'Used' : 'Available'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="py-3 pr-3">TOTAL</td>
                        <td className="py-3 px-3 text-right">{formatNumber(cards.totalLeaveEntitlement)}</td>
                        <td className="py-3 px-3 text-right">{formatNumber(cards.totalLeaveUsed)}</td>
                        <td className="py-3 px-3 text-right text-emerald-800">{formatNumber(cards.totalLeaveRemaining)}</td>
                        <td className="py-3 pl-3 text-muted font-normal text-[11px]">
                          {cards.staffOnLeaveCycle ?? 0} staff on active leave cycle
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </Card>
            </div>
          </div>

          <div>
            <h2 className="font-heading text-lg mb-3">Payroll & Attendance</h2>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <h3 className="font-heading mb-4">Payroll Cost</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={charts.payrollCost || []}>
                      <defs>
                        <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Area type="monotone" dataKey="gross" stroke="#2563EB" fill="url(#g1)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-4">Department Wise Employees</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={charts.departmentEmployees || []} dataKey="count" nameKey="name" outerRadius={90} label>
                        {(charts.departmentEmployees || []).map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-4">Monthly Payroll</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.monthlyPayroll || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="net" fill="#06B6D4" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-4">Attendance / Weekly Hours</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={charts.attendance?.length ? charts.attendance : charts.weeklyHours || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="hours" stroke="#22C55E" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="normal" stroke="#2563EB" strokeWidth={2} />
                      <Line type="monotone" dataKey="ot" stroke="#F59E0B" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-4">Overtime Analysis</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.overtime || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="week" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="overtime" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card>
                <h3 className="font-heading mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 gap-2">
                  {(data?.quickActions || []).map((a) => (
                    <Link key={a.path} to={a.path}>
                      <Button variant="outline" size="sm" className="w-full justify-start text-left">
                        {a.label}
                      </Button>
                    </Link>
                  ))}
                </div>
                <div className="mt-4 rounded-[14px] bg-gradient-to-r from-blue-50 to-cyan-50 p-4">
                  <p className="text-sm text-muted">Upcoming Payroll</p>
                  <p className="font-heading text-lg mt-1">{data?.upcomingPayroll?.label || '—'}</p>
                </div>
              </Card>
            </div>
          </div>

          <Card>
            <div className="flex items-center justify-between gap-3 mb-3">
              <h3 className="font-heading">Recent Activities</h3>
              <span className="text-xs text-muted">
                {allActivities.length
                  ? `${Math.min((activityPage - 1) * ACTIVITY_PAGE_SIZE + 1, allActivities.length)}–${Math.min(activityPage * ACTIVITY_PAGE_SIZE, allActivities.length)} of ${allActivities.length}`
                  : 'Live feed'}
              </span>
            </div>
            <div className="space-y-2">
              {allActivities.length === 0 && (
                <p className="text-sm text-muted">No recent activity yet. Add leave, generate payroll, or update a timesheet.</p>
              )}
              {pagedActivities.map((n) => {
                const tone =
                  n.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : n.type === 'warning'
                      ? 'border-amber-200 bg-amber-50/50'
                      : n.type === 'danger'
                        ? 'border-rose-200 bg-rose-50/50'
                        : 'border-border/70 bg-white';
                const inner = (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`flex items-start justify-between gap-3 rounded-[14px] border px-4 py-3 ${tone}`}
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-muted mt-0.5">{n.message}</p>
                    </div>
                    <span className="text-xs text-muted whitespace-nowrap shrink-0">
                      {n.createdAt ? new Date(n.createdAt).toLocaleString() : ''}
                    </span>
                  </motion.div>
                );
                return n.link ? (
                  <Link key={n._id} to={n.link} className="block hover:opacity-90 transition">
                    {inner}
                  </Link>
                ) : (
                  <div key={n._id}>{inner}</div>
                );
              })}
            </div>
            {allActivities.length > ACTIVITY_PAGE_SIZE && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={activityPage <= 1}
                  onClick={() => setActivityPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted">
                  Page {Math.min(activityPage, activityTotalPages)} of {activityTotalPages}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={activityPage >= activityTotalPages}
                  onClick={() => setActivityPage((p) => Math.min(activityTotalPages, p + 1))}
                >
                  Next
                </Button>
              </div>
            )}
          </Card>
        </div>
      )}
    </AppLayout>
  );
}
