import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { statutoryApi } from '@/services';
import { MONTHS, formatMoney, yearOptions } from '@/utils/helpers';

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

export default function StatutoryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState('paye');

  const { data, isLoading } = useQuery({
    queryKey: ['statutory', year, month],
    queryFn: () => statutoryApi.sheets({ year, month }),
  });

  const tabs = [
    { id: 'paye', label: 'PAYE Sheet' },
    { id: 'npf', label: 'NPF Sheet' },
    { id: 'acc', label: 'ACC Schedule' },
    { id: 'totals', label: 'Monthly Totals' },
  ];

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
          <div className="flex flex-wrap gap-2">
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
              <p className="text-xs text-muted">Weekly gross pay by employee (from generated weekly payroll)</p>
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
                  {(data?.paye?.rows || []).map((r) => (
                    <tr key={r.employeeId} className="border-b border-border/40 hover:bg-slate-50/60">
                      <td className="px-2 py-2">{r.row}</td>
                      <td className="px-2 py-2 font-medium whitespace-nowrap">{r.name}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.week1)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.week2)}</td>
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total12)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.week3)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.week4)}</td>
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total34)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.week5)}</td>
                      <td className="px-2 py-2 text-right font-semibold bg-sky-50">{formatMoney(r.total5)}</td>
                      <td className="px-2 py-2 text-right">{formatMoney(r.totalTax)}</td>
                      <td className="px-2 py-2 text-right font-semibold bg-emerald-50">{formatMoney(r.grandTotal)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-semibold">
                    <td className="px-2 py-3" colSpan={11}>TOTAL</td>
                    <td className="px-2 py-3 text-right">{formatMoney(data?.paye?.totals?.gross)}</td>
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
                <div><dt className="text-xs text-muted">Employer Number</dt><dd className="font-medium">{data?.employer?.npfEmployerNumber || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Employer Name</dt><dd className="font-medium">{data?.employer?.companyName}</dd></div>
                <div><dt className="text-xs text-muted">Email / Address</dt><dd className="font-medium">{data?.employer?.companyAddress || data?.employer?.companyEmail || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Telephone</dt><dd className="font-medium">{data?.employer?.companyPhone || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Zone</dt><dd className="font-medium">{data?.employer?.npfZone || '—'}</dd></div>
                <div><dt className="text-xs text-muted">Schedule Frequency</dt><dd className="font-medium">Monthly</dd></div>
                <div><dt className="text-xs text-muted">Period Start</dt><dd className="font-medium">{fmtDate(data?.period?.start)}</dd></div>
                <div><dt className="text-xs text-muted">Period End</dt><dd className="font-medium">{fmtDate(data?.period?.end)}</dd></div>
                <div><dt className="text-xs text-muted">Payments Total</dt><dd className="font-semibold text-base">{formatMoney(data?.npf?.paymentsTotal)}</dd></div>
              </dl>
              <p className="text-xs text-muted">Set Employer Number & Zone in Settings.</p>
            </Card>

            <Card className="overflow-hidden p-0">
              <div className="px-4 py-3 border-b bg-violet-50 text-violet-950 font-heading text-sm">
                Contributions for pay period ending
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
                    {(data?.npf?.rows || []).map((r, i) => (
                      <tr key={`${r.npfNumber}-${i}`} className="border-b border-border/40">
                        <td className="px-2 py-2 font-mono">{r.npfNumber}</td>
                        <td className="px-2 py-2 whitespace-nowrap font-medium">{r.name}</td>
                        <td className="px-2 py-2">{r.transactionType}</td>
                        {r.weeks.map((w, wi) => (
                          <Fragment key={wi}>
                            <td className="px-2 py-2 text-right">{formatMoney(w.employee)}</td>
                            <td className="px-2 py-2 text-right bg-violet-50/50">{formatMoney(w.employer)}</td>
                          </Fragment>
                        ))}
                        <td className="px-2 py-2 text-right font-semibold">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-violet-100 font-semibold">
                      <td className="px-2 py-3" colSpan={13}>TOTAL CONTRIBUTIONS</td>
                      <td className="px-2 py-3 text-right">{formatMoney(data?.npf?.paymentsTotal)}</td>
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
                <div><span className="text-muted text-xs block">Employer name</span>{data?.employer?.companyName}</div>
                <div><span className="text-muted text-xs block">Month of</span>{MONTHS[month - 1]}-{String(year).slice(-2)}</div>
                <div>
                  <span className="text-muted text-xs block">Emp. Numbers</span>
                  {[data?.employer?.accEmpNumber1, data?.employer?.accEmpNumber2].filter(Boolean).join(' · ') || '—'}
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
                    {(data?.acc?.rows || []).map((r) => (
                      <tr key={r.row} className="border-b border-border/40">
                        <td className="px-2 py-2">{r.row}</td>
                        <td className="px-2 py-2 font-medium whitespace-nowrap">{r.name}</td>
                        {r.weeks.map((w, wi) => (
                          <Fragment key={wi}>
                            <td className="px-2 py-2 text-right">{formatMoney(w.employee)}</td>
                            <td className="px-2 py-2 text-right bg-amber-50/50">{formatMoney(w.employer)}</td>
                          </Fragment>
                        ))}
                        <td className="px-2 py-2 text-right font-semibold">{formatMoney(r.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-100 font-semibold">
                      <td className="px-2 py-3" colSpan={12}>Total ACC</td>
                      <td className="px-2 py-3 text-right">{formatMoney(data?.acc?.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            <Card>
              <h4 className="font-heading text-sm mb-2">By department</h4>
              <div className="flex flex-wrap gap-4 text-sm">
                {Object.entries(data?.acc?.byDepartment || {}).map(([dept, amt]) => (
                  <div key={dept} className="rounded-[14px] bg-slate-50 px-3 py-2">
                    <div className="text-xs text-muted">{dept}</div>
                    <div className="font-semibold">{formatMoney(amt)}</div>
                  </div>
                ))}
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
                  <td className="py-3 text-right font-medium">{formatMoney(data?.statutoryTotals?.paye)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">NPF</td>
                  <td className="py-3 text-right font-medium">{formatMoney(data?.statutoryTotals?.npf)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">ACC</td>
                  <td className="py-3 text-right font-medium">{formatMoney(data?.statutoryTotals?.acc)}</td>
                </tr>
                <tr className="bg-slate-100 font-semibold">
                  <td className="py-3 px-2 rounded-l-[12px]">TOTAL</td>
                  <td className="py-3 px-2 text-right rounded-r-[12px]">{formatMoney(data?.statutoryTotals?.total)}</td>
                </tr>
              </tbody>
            </table>
            <p className="text-xs text-muted">
              PAYE sheet gross month total: {formatMoney(data?.statutoryTotals?.payeGross)}.
              Tax total above uses weekly PAYE deductions from payroll.
            </p>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
