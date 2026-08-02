import { useMemo, useState, Fragment } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { ShareMenu } from '@/components/ui/ShareMenu';
import { leaveApi, employeeApi } from '@/services';
import { formatNumber } from '@/utils/helpers';

const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const TYPE_ORDER = ['annual', 'sick', 'maternity', 'paternity', 'bereavement'];

const emptyForm = {
  employee: '',
  leaveType: 'annual',
  startDate: '',
  endDate: '',
  overrideDays: '',
  status: 'Approved',
  approvedBy: '',
  notes: '',
};

const toInputDate = (d) => {
  if (!d) return '';
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return x.toISOString().slice(0, 10);
};

export default function LeavePage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('dashboard');
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10));
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: dash, isLoading } = useQuery({
    queryKey: ['leave-dashboard', asOf],
    queryFn: () => leaveApi.dashboard({ asOf }),
  });
  const { data: entries = [] } = useQuery({
    queryKey: ['leave-entries'],
    queryFn: () => leaveApi.list(),
  });
  const { data: empData } = useQuery({
    queryKey: ['employees-leave'],
    queryFn: () => employeeApi.list({ status: 'active', limit: 200 }),
  });

  const empList = empData?.items || [];

  const invalidateLeave = () => {
    qc.invalidateQueries({ queryKey: ['leave-dashboard'] });
    qc.invalidateQueries({ queryKey: ['leave-entries'] });
    qc.invalidateQueries({ queryKey: ['leave-staff-sheets'] });
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const startEdit = (entry) => {
    setEditingId(entry._id);
    setForm({
      employee: entry.employee?._id || entry.employee || '',
      leaveType: entry.leaveType || 'annual',
      startDate: toInputDate(entry.startDate),
      endDate: toInputDate(entry.endDate),
      overrideDays: entry.overrideDays != null ? String(entry.overrideDays) : '',
      status: entry.status || 'Approved',
      approvedBy: entry.approvedBy || '',
      notes: entry.notes || '',
    });
    setTab('log');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        overrideDays: form.overrideDays === '' ? null : Number(form.overrideDays),
      };
      return editingId ? leaveApi.update(editingId, payload) : leaveApi.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Leave entry updated' : 'Leave entry saved');
      resetForm();
      invalidateLeave();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const delMut = useMutation({
    mutationFn: (id) => leaveApi.remove(id),
    onSuccess: (_, id) => {
      toast.success('Deleted');
      if (editingId === id) resetForm();
      invalidateLeave();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const { data: sheetsData } = useQuery({
    queryKey: ['leave-staff-sheets', asOf],
    queryFn: () => leaveApi.staffSheets({ asOf }),
    enabled: tab === 'sheets',
  });

  const labels = dash?.labels || {};
  const entitlements = dash?.entitlements || {};

  const summaryRows = useMemo(() => {
    if (!dash?.totals) return [];
    return TYPE_ORDER.map((t) => ({
      type: labels[t] || t,
      remaining: dash.totals[t] ?? 0,
    }));
  }, [dash, labels]);

  return (
    <AppLayout title="Leave Tracker">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={tab === 'dashboard' ? 'primary' : 'outline'} onClick={() => setTab('dashboard')}>
            Staff Leave Balance
          </Button>
          <Button type="button" variant={tab === 'log' ? 'primary' : 'outline'} onClick={() => setTab('log')}>
            Leave Request / Usage Log
          </Button>
          <Button type="button" variant={tab === 'sheets' ? 'primary' : 'outline'} onClick={() => setTab('sheets')}>
            Leave Balance Sheets
          </Button>
        </div>

        {tab === 'dashboard' && (
          <>
            <Card className="space-y-3">
              <h3 className="font-heading text-lg">Staff Leave Balance Dashboard</h3>
              <p className="text-sm text-muted max-w-3xl">
                Leave balances reset automatically on each employee&apos;s hire-date anniversary.
                Enter leave once in the log; balances update automatically.
              </p>
              <div className="flex flex-wrap gap-4 items-end">
                {TYPE_ORDER.map((t) => (
                  <div key={t} className="rounded-[14px] bg-emerald-50 border border-emerald-100 px-3 py-2 min-w-[120px]">
                    <div className="text-xs text-emerald-800">{labels[t] || t}</div>
                    <div className="text-lg font-semibold text-emerald-900">{formatNumber(entitlements[t] ?? 0)}</div>
                  </div>
                ))}
                <Input label="As of Date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1400px]">
                  <thead className="bg-slate-100 sticky top-0">
                    <tr className="text-left">
                      <th className="px-2 py-2">Staff Name</th>
                      <th className="px-2 py-2">Hire Date</th>
                      <th className="px-2 py-2">Current Leave Cycle</th>
                      <th className="px-2 py-2">Next Anniversary</th>
                      <th className="px-2 py-2 text-right">Days to Reset</th>
                      {TYPE_ORDER.map((t) => (
                        <th key={t} className="px-1 py-2 text-center" colSpan={3}>
                          {(labels[t] || t).replace(' Leave', '')}
                        </th>
                      ))}
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2 text-right">Total Left</th>
                      <th className="px-2 py-2 text-center">Share</th>
                    </tr>
                    <tr className="bg-slate-50 text-[10px] text-muted">
                      <th colSpan={5} />
                      {TYPE_ORDER.map((t) => (
                        <Fragment key={t}>
                          <th className="px-1 py-1 text-right">Ent.</th>
                          <th className="px-1 py-1 text-right">Used</th>
                          <th className="px-1 py-1 text-right">Left</th>
                        </Fragment>
                      ))}
                      <th colSpan={3} />
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && (
                      <tr><td className="px-4 py-6 text-muted" colSpan={23}>Loading…</td></tr>
                    )}
                    {(dash?.staff || []).map((row) => {
                      const balanceText = [
                        `Leave balance — ${row.staffName}`,
                        `As of ${asOf}`,
                        ...TYPE_ORDER.map((t) => {
                          const x = row.types[t] || {};
                          return `${labels[t] || t}: Ent ${formatNumber(x.entitlement)} · Used ${formatNumber(x.used)} · Left ${formatNumber(x.left)}`;
                        }),
                        `Total left: ${formatNumber(row.totalLeaveLeft)}`,
                        row.nextAnniversary ? `Next reset: ${fmtDate(row.nextAnniversary)}` : '',
                      ]
                        .filter(Boolean)
                        .join('\n');

                      return (
                      <tr key={row.employeeId} className="border-b border-border/50 hover:bg-slate-50/70">
                        <td className="px-2 py-2 font-medium whitespace-nowrap">{row.staffName}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(row.hireDate)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(row.currentLeaveCycle)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(row.nextAnniversary)}</td>
                        <td className="px-2 py-2 text-right">{row.daysToReset}</td>
                        {TYPE_ORDER.map((t) => {
                          const x = row.types[t] || {};
                          return (
                            <Fragment key={t}>
                              <td className="px-1 py-2 text-right bg-sky-50/50">{formatNumber(x.entitlement)}</td>
                              <td className="px-1 py-2 text-right bg-amber-50/50">{formatNumber(x.used)}</td>
                              <td className="px-1 py-2 text-right font-semibold bg-emerald-50/50">{formatNumber(x.left)}</td>
                            </Fragment>
                          );
                        })}
                        <td className="px-2 py-2 whitespace-nowrap">{row.status}</td>
                        <td className="px-2 py-2 text-right font-semibold">{formatNumber(row.totalLeaveLeft)}</td>
                        <td className="px-2 py-2 text-center">
                          <ShareMenu
                            title={`Leave balance — ${row.staffName}`}
                            text={balanceText}
                            emailLabel="Email to staff"
                            onEmail={async () => {
                              const res = await leaveApi.emailBalance({
                                employeeId: row.employeeId,
                                asOf,
                              });
                              toast.success(res.message || 'Sent');
                            }}
                          />
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <h4 className="font-heading mb-3">Leave Type — Total Remaining</h4>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted border-b">
                      <th className="py-2">Leave Type</th>
                      <th className="py-2 text-right">Total Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summaryRows.map((r) => (
                      <tr key={r.type} className="border-b border-border/40">
                        <td className="py-2">{r.type}</td>
                        <td className="py-2 text-right font-medium">{formatNumber(r.remaining)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
              <Card className="flex flex-col justify-center gap-2">
                <div className="text-sm">Missing Hire Dates: <strong>{dash?.missingHireDates ?? 0}</strong></div>
                <p className="text-xs text-muted">Set hire dates on Employees so leave cycles can calculate.</p>
              </Card>
            </div>
          </>
        )}

        {tab === 'log' && (
          <>
            <Card className="space-y-3">
              <h3 className="font-heading">{editingId ? 'Edit Leave Entry' : 'Add Leave Entry'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <Select label="Staff Name" value={form.employee} onChange={(e) => setForm({ ...form, employee: e.target.value })}>
                  <option value="">Select…</option>
                  {empList.map((e) => (
                    <option key={e._id} value={e._id}>{e.fullName}</option>
                  ))}
                </Select>
                <Select label="Leave Type" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
                  {TYPE_ORDER.map((t) => (
                    <option key={t} value={t}>{labels[t] || t}</option>
                  ))}
                </Select>
                <Select label="Status" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  <option>Approved</option>
                  <option>Pending</option>
                  <option>Rejected</option>
                  <option>Cancelled</option>
                </Select>
                <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
                <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
                <Input label="Override Days (optional)" type="number" step="0.5" value={form.overrideDays} onChange={(e) => setForm({ ...form, overrideDays: e.target.value })} />
                <Input label="Approved By" value={form.approvedBy} onChange={(e) => setForm({ ...form, approvedBy: e.target.value })} />
                <Textarea label="Notes" className="sm:col-span-2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
              <div className="flex justify-end gap-2">
                {editingId && (
                  <Button type="button" variant="outline" onClick={resetForm}>
                    Cancel
                  </Button>
                )}
                <Button type="button" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.employee || !form.startDate || !form.endDate}>
                  {saveMut.isPending ? 'Saving…' : editingId ? 'Update Entry' : 'Add Entry'}
                </Button>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="px-4 py-3 border-b bg-slate-50 font-heading text-sm">Leave Request / Usage Log</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1000px]">
                  <thead className="bg-slate-100">
                    <tr className="text-left">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Staff Name</th>
                      <th className="px-2 py-2">Leave Type</th>
                      <th className="px-2 py-2">Start</th>
                      <th className="px-2 py-2">End</th>
                      <th className="px-2 py-2 text-right">Calc. Workdays</th>
                      <th className="px-2 py-2 text-right">Override</th>
                      <th className="px-2 py-2 text-right">Days Counted</th>
                      <th className="px-2 py-2">Status</th>
                      <th className="px-2 py-2">Approved By</th>
                      <th className="px-2 py-2">Notes</th>
                      <th className="px-2 py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((e, i) => (
                      <tr key={e._id} className={`border-b border-border/50 ${editingId === e._id ? 'bg-sky-50/80' : ''}`}>
                        <td className="px-2 py-2">{entries.length - i}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{e.employee?.fullName}</td>
                        <td className="px-2 py-2">{labels[e.leaveType] || e.leaveType}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(e.startDate)}</td>
                        <td className="px-2 py-2 whitespace-nowrap">{fmtDate(e.endDate)}</td>
                        <td className="px-2 py-2 text-right">{formatNumber(e.calculatedWorkdays)}</td>
                        <td className="px-2 py-2 text-right">{e.overrideDays != null ? formatNumber(e.overrideDays) : ''}</td>
                        <td className="px-2 py-2 text-right font-semibold">{formatNumber(e.daysCounted)}</td>
                        <td className="px-2 py-2">{e.status}</td>
                        <td className="px-2 py-2">{e.approvedBy}</td>
                        <td className="px-2 py-2">{e.notes}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                            <Button type="button" size="sm" variant="ghost" onClick={() => startEdit(e)}>
                              Edit
                            </Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => delMut.mutate(e._id)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {!entries.length && (
                      <tr><td colSpan={12} className="px-4 py-6 text-muted">No leave entries yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {tab === 'sheets' && (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-end gap-3 justify-between">
              <div>
                <h3 className="font-heading">Staff Leave Balance Sheets</h3>
                <p className="text-sm text-muted mt-1">
                  Read-only. Record leave on the Leave Request / Usage Log tab.
                </p>
              </div>
              <Input label="As of Date" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
            </Card>

            <div className="grid grid-cols-1 gap-4">
              {(sheetsData?.sheets || []).map((sheet) => (
                <Card key={sheet.employeeId} className="space-y-3 border-l-4 border-l-emerald-400 max-w-4xl">
                  <div>
                    <h4 className="font-heading text-base uppercase tracking-wide">
                      {sheet.employeeName} — Leave Balance
                    </h4>
                    <p className="text-xs text-muted mt-1">
                      This sheet is read-only. Record leave on the LeaveTracker tab.
                    </p>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-muted">Employee</dt>
                      <dd className="font-medium">{sheet.employeeName}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Department</dt>
                      <dd className="font-medium">{sheet.department || '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Hire Date</dt>
                      <dd>{fmtDate(sheet.hireDate)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Cycle Start</dt>
                      <dd>{fmtDate(sheet.cycleStart)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Next Reset</dt>
                      <dd>{fmtDate(sheet.nextReset)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted">Leave Status</dt>
                      <dd className="font-medium">{sheet.leaveStatus}</dd>
                    </div>
                  </dl>

                  <div className="overflow-x-auto -mx-1 px-1">
                    <table className="w-full text-xs border-collapse min-w-[560px]">
                      <thead>
                        <tr className="text-left text-muted border-b border-border">
                          <th className="py-2.5 pr-3 font-medium whitespace-nowrap">Leave Type</th>
                          <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Entitlement</th>
                          <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Approved Used</th>
                          <th className="py-2.5 px-3 text-right font-medium whitespace-nowrap">Remaining</th>
                          <th className="py-2.5 px-3 font-medium whitespace-nowrap">Status</th>
                          <th className="py-2.5 pl-3 font-medium whitespace-nowrap">Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sheet.types.map((t) => (
                          <tr key={t.leaveType} className="border-b border-border/40">
                            <td className="py-2.5 pr-3 font-medium whitespace-nowrap">{t.label}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatNumber(t.entitlement)}</td>
                            <td className="py-2.5 px-3 text-right tabular-nums whitespace-nowrap">{formatNumber(t.approvedUsed)}</td>
                            <td className="py-2.5 px-3 text-right font-semibold tabular-nums whitespace-nowrap">{formatNumber(t.remaining)}</td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={t.balanceStatus === 'Used' ? 'text-rose-700' : 'text-emerald-700'}>
                                {t.balanceStatus}
                              </span>
                            </td>
                            <td className="py-2.5 pl-3 text-muted min-w-[140px]">{t.notes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm pt-1">
                    <div>
                      Total Leave Remaining:{' '}
                      <strong>{formatNumber(sheet.totalLeaveRemaining)}</strong>
                    </div>
                    <div>
                      Days to Reset: <strong>{sheet.daysToReset}</strong>
                    </div>
                  </div>
                  <p className="text-xs text-muted">
                    Approved leave entered on LeaveTracker automatically reduces the matching balance above.
                  </p>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
