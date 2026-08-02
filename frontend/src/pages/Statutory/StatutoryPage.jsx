import { Fragment, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { statutoryApi } from '@/services';
import { MONTHS, formatMoney, yearOptions } from '@/utils/helpers';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const cellInput =
  'w-full min-w-[72px] rounded-md border border-amber-300 bg-amber-50 px-1 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-amber-200';

function EditableNum({ value, onCommit }) {
  const [v, setV] = useState(value ?? 0);
  useEffect(() => {
    setV(value ?? 0);
  }, [value]);
  return (
    <input
      type="number"
      step="0.01"
      className={cellInput}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = Number(v);
        if (!Number.isNaN(n) && n !== Number(value)) onCommit(n);
      }}
    />
  );
}

export default function StatutoryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState('paye');
  const [local, setLocal] = useState(null);
  const pending = useRef([]);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['statutory', year, month],
    queryFn: () => statutoryApi.sheets({ year, month }),
  });

  useEffect(() => {
    if (data) setLocal(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const saveMut = useMutation({
    mutationFn: (overrides) => statutoryApi.saveSheets({ year, month, overrides }),
    onSuccess: () => {
      pending.current = [];
      qc.invalidateQueries({ queryKey: ['statutory', year, month] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Autosave failed'),
  });

  useEffect(() => {
    if (!pending.current.length) return undefined;
    const t = setTimeout(() => {
      const batch = [...pending.current];
      pending.current = [];
      if (batch.length) saveMut.mutate(batch);
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  const queueOverride = (o) => {
    pending.current = [
      ...pending.current.filter(
        (x) =>
          !(
            x.sheet === o.sheet &&
            x.rowKey === o.rowKey &&
            x.field === o.field &&
            Number(x.week || 0) === Number(o.week || 0)
          )
      ),
      o,
    ];
  };

  const updatePaye = (employeeId, field, value) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const row = next.paye.rows.find((r) => String(r.employeeId) === String(employeeId));
      if (!row) return prev;
      row[field] = value;
      row.total12 = Math.round((Number(row.week1 || 0) + Number(row.week2 || 0)) * 100) / 100;
      row.total34 = Math.round((Number(row.week3 || 0) + Number(row.week4 || 0)) * 100) / 100;
      row.total5 = Math.round(Number(row.week5 || 0) * 100) / 100;
      row.grandTotal = Math.round((row.total12 + row.total34 + row.total5) * 100) / 100;
      return next;
    });
    queueOverride({ sheet: 'paye', rowKey: String(employeeId), field, value, week: 0 });
  };

  const updateNpfWeek = (rowKey, weekIdx, field, value) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const row = next.npf.rows.find((r) => String(r.npfNumber || r.name) === String(rowKey));
      if (!row?.weeks?.[weekIdx]) return prev;
      row.weeks[weekIdx][field] = value;
      row.total = Math.round(
        row.weeks.reduce((s, w) => s + Number(w.employee || 0) + Number(w.employer || 0), 0) * 100
      ) / 100;
      return next;
    });
    queueOverride({
      sheet: 'npf',
      rowKey: String(rowKey),
      week: weekIdx + 1,
      field,
      value,
    });
  };

  const updateAccWeek = (rowKey, weekIdx, field, value) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      const row = next.acc.rows.find((r) => String(r.row || r.name) === String(rowKey));
      if (!row?.weeks?.[weekIdx]) return prev;
      row.weeks[weekIdx][field] = value;
      row.total = Math.round(
        row.weeks.reduce((s, w) => s + Number(w.employee || 0) + Number(w.employer || 0), 0) * 100
      ) / 100;
      return next;
    });
    queueOverride({
      sheet: 'acc',
      rowKey: String(rowKey),
      week: weekIdx + 1,
      field,
      value,
    });
  };

  const tabs = [
    { id: 'paye', label: 'PAYE Sheet' },
    { id: 'npf', label: 'NPF Sheet' },
    { id: 'acc', label: 'ACC Schedule' },
    { id: 'totals', label: 'Monthly Totals' },
  ];

  const view = local || data;

  return (
    <AppLayout title="Statutory Sheets">
      <div className="space-y-4">
        <Card className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions(year).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-muted px-2 py-1 rounded-lg bg-amber-50 border border-amber-200">
              {saveMut.isPending ? 'Saving…' : 'Yellow cells edit & autosave'}
            </span>
            {tabs.map((t) => (
              <Button
                key={t.id}
                type="button"
                size="sm"
                variant={tab === t.id ? 'primary' : 'outline'}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </Card>

        {isLoading && <Card><p className="text-muted text-sm">Loading…</p></Card>}

        {!isLoading && tab === 'paye' && (
          <Card className="overflow-hidden p-0">
            <div className="px-4 py-3 border-b bg-slate-50">
              <h3 className="font-heading">PAYE Sheet — {MONTHS[month - 1]} {year}</h3>
              <p className="text-xs text-muted">Edit week gross amounts — changes persist to the backend</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1100px]">
                <thead className="bg-slate-100">
                  <tr className="text-left">
                    <th className="px-2 py-2" rowSpan={2}>#</th>
                    <th className="px-2 py-2" rowSpan={2}>Employee name</th>
                    <th className="px-2 py-2 text-center" colSpan={3}>1</th>
                    <th className="px-2 py-2 text-center" colSpan={3}>2</th>
                    <th className="px-2 py-2 text-center" colSpan={2}>3</th>
                    <th className="px-2 py-2 text-right" rowSpan={2}>Total Tax</th>
                    <th className="px-2 py-2 text-right" rowSpan={2}>Total</th>
                  </tr>
                  <tr className="bg-slate-50 text-muted">
                    <th className="px-2 py-1 text-right">Week 1</th>
                    <th className="px-2 py-1 text-right">Week 2</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-right">Week 3</th>
                    <th className="px-2 py-1 text-right">Week 4</th>
                    <th className="px-2 py-1 text-right">Total</th>
                    <th className="px-2 py-1 text-right">Week 5</th>
                    <th className="px-2 py-1 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(view?.paye?.rows || []).map((r) => (
                    <tr key={r.employeeId} className="border-b border-border/40 hover:bg-slate-50/60">
                      <td className="px-2 py-2">{r.row}</td>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{r.name}</td>
                      {['week1', 'week2'].map((f) => (
                        <td key={f} className="px-1 py-1">
                          <EditableNum value={r[f]} onCommit={(n) => updatePaye(r.employeeId, f, n)} />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total12)}</td>
                      {['week3', 'week4'].map((f) => (
                        <td key={f} className="px-1 py-1">
                          <EditableNum value={r[f]} onCommit={(n) => updatePaye(r.employeeId, f, n)} />
                        </td>
                      ))}
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total34)}</td>
                      <td className="px-1 py-1">
                        <EditableNum value={r.week5} onCommit={(n) => updatePaye(r.employeeId, 'week5', n)} />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total5)}</td>
                      <td className="px-1 py-1">
                        <EditableNum value={r.totalTax} onCommit={(n) => updatePaye(r.employeeId, 'totalTax', n)} />
                      </td>
                      <td className="px-2 py-2 text-right font-semibold bg-emerald-50">{formatMoney(r.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="px-2 py-3" colSpan={11}>TOTAL</td>
                    <td className="px-2 py-3 text-right">{formatMoney(view?.paye?.totals?.gross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {!isLoading && tab === 'npf' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="font-heading">SAMOA NATIONAL PROVIDENT FUND</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div><dt className="text-xs text-muted">Employer Number</dt><dd className="font-medium">{view?.employer?.npfEmployerNumber || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Employer Name</dt><dd className="font-medium">{view?.employer?.companyName}</dd></div>
                <div><dt className="text-xs text-muted">Email / Address</dt><dd className="font-medium">{view?.employer?.companyAddress || view?.employer?.companyEmail || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Telephone</dt><dd className="font-medium">{view?.employer?.companyPhone || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Zone</dt><dd className="font-medium">{view?.employer?.npfZone || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Period</dt><dd className="font-medium">{fmtDate(view?.period?.start)} – {fmtDate(view?.period?.end)}</dd></div>
              </dl>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="px-4 py-3 border-b bg-violet-50 text-violet-950 font-heading text-sm">
                Contributions — yellow cells editable
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1200px]">
                  <thead className="bg-slate-100">
                    <tr className="text-left">
                      <th className="px-2 py-2" rowSpan={2}>NPF #</th>
                      <th className="px-2 py-2" rowSpan={2}>Employee Name</th>
                      <th className="px-2 py-2" rowSpan={2}>Type</th>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <th key={w} className="px-2 py-2 text-center" colSpan={2}>{w}</th>
                      ))}
                      <th className="px-2 py-2 text-right" rowSpan={2}>TOTAL</th>
                    </tr>
                    <tr className="bg-slate-50 text-muted">
                      {[1, 2, 3, 4, 5].map((w) => (
                        <Fragment key={w}>
                          <th className="px-2 py-1 text-right">Employee</th>
                          <th className="px-2 py-1 text-right">Employer</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(view?.npf?.rows || []).map((r, i) => {
                      const rowKey = r.npfNumber || r.name;
                      return (
                        <tr key={`${rowKey}-${i}`} className="border-b border-border/40">
                          <td className="px-2 py-2 font-mono">{r.npfNumber}</td>
                          <td className="px-2 py-2 whitespace-nowrap font-medium">{r.name}</td>
                          <td className="px-2 py-2">{r.transactionType}</td>
                          {r.weeks.map((w, wi) => (
                            <Fragment key={wi}>
                              <td className="px-1 py-1">
                                <EditableNum
                                  value={w.employee}
                                  onCommit={(n) => updateNpfWeek(rowKey, wi, 'employee', n)}
                                />
                              </td>
                              <td className="px-1 py-1 bg-violet-50/50">
                                <EditableNum
                                  value={w.employer}
                                  onCommit={(n) => updateNpfWeek(rowKey, wi, 'employer', n)}
                                />
                              </td>
                            </Fragment>
                          ))}
                          <td className="px-2 py-2 text-right font-semibold">{formatMoney(r.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-violet-100 font-semibold">
                      <td className="px-2 py-3" colSpan={13}>TOTAL CONTRIBUTIONS</td>
                      <td className="px-2 py-3 text-right">{formatMoney(view?.npf?.paymentsTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        )}

        {!isLoading && tab === 'acc' && (
          <div className="space-y-4">
            <Card className="space-y-2">
              <h3 className="font-heading">ACC Schedule</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <div><span className="text-muted text-xs block">Employer name</span>{view?.employer?.companyName}</div>
                <div><span className="text-muted text-xs block">Month of</span>{MONTHS[month - 1]}-{String(year).slice(-2)}</div>
                <div>
                  <span className="text-muted text-xs block">Emp. Numbers</span>
                  {[view?.employer?.accEmpNumber1, view?.employer?.accEmpNumber2].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs min-w-[1200px]">
                  <thead className="bg-slate-100">
                    <tr className="text-left">
                      <th className="px-2 py-2" rowSpan={2}>#</th>
                      <th className="px-2 py-2" rowSpan={2}>Employees name</th>
                      {[1, 2, 3, 4, 5].map((w) => (
                        <th key={w} className="px-2 py-2 text-center" colSpan={2}>Week {w}</th>
                      ))}
                      <th className="px-2 py-2 text-right" rowSpan={2}>TOTAL</th>
                    </tr>
                    <tr className="bg-slate-50 text-muted">
                      {[1, 2, 3, 4, 5].map((w) => (
                        <Fragment key={w}>
                          <th className="px-2 py-1 text-right">Employee</th>
                          <th className="px-2 py-1 text-right">Employer</th>
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(view?.acc?.rows || []).map((r) => {
                      const rowKey = r.row || r.name;
                      return (
                        <tr key={r.row} className="border-b border-border/40">
                          <td className="px-2 py-2">{r.row}</td>
                          <td className="px-2 py-2 font-medium whitespace-nowrap">{r.name}</td>
                          {r.weeks.map((w, wi) => (
                            <Fragment key={wi}>
                              <td className="px-1 py-1">
                                <EditableNum
                                  value={w.employee}
                                  onCommit={(n) => updateAccWeek(rowKey, wi, 'employee', n)}
                                />
                              </td>
                              <td className="px-1 py-1 bg-amber-50/50">
                                <EditableNum
                                  value={w.employer}
                                  onCommit={(n) => updateAccWeek(rowKey, wi, 'employer', n)}
                                />
                              </td>
                            </Fragment>
                          ))}
                          <td className="px-2 py-2 text-right font-semibold">{formatMoney(r.total)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-100 font-semibold">
                      <td className="px-2 py-3" colSpan={12}>Total ACC</td>
                      <td className="px-2 py-3 text-right">{formatMoney(view?.acc?.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </div>
        )}

        {!isLoading && tab === 'totals' && (
          <Card className="max-w-md space-y-4">
            <h3 className="font-heading">Monthly Statutory Totals</h3>
            <p className="text-xs text-muted">{MONTHS[month - 1]} {year}</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-3">PAYE (Tax)</td>
                  <td className="py-3 text-right font-medium">{formatMoney(view?.statutoryTotals?.paye)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">NPF</td>
                  <td className="py-3 text-right font-medium">{formatMoney(view?.statutoryTotals?.npf)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">ACC</td>
                  <td className="py-3 text-right font-medium">{formatMoney(view?.statutoryTotals?.acc)}</td>
                </tr>
                <tr className="bg-slate-100 font-semibold">
                  <td className="py-3 px-2 rounded-l-[12px]">TOTAL</td>
                  <td className="py-3 px-2 text-right rounded-r-[12px]">{formatMoney(view?.statutoryTotals?.total)}</td>
                </tr>
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
