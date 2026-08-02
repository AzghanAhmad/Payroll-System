import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { payrollApi } from '@/services';
import { MONTHS, formatMoney, formatNumber, yearOptions } from '@/utils/helpers';

export default function PayrollPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [week, setWeek] = useState(1);
  const qc = useQueryClient();

  const { data: payrolls = [], isLoading } = useQuery({
    queryKey: ['payrolls', year, month],
    queryFn: () => payrollApi.list({ year, month }),
  });

  const { data: summary } = useQuery({
    queryKey: ['payroll-summary', year, month],
    queryFn: () => payrollApi.summary({ year, month }),
  });

  const weeklyMut = useMutation({
    mutationFn: () => payrollApi.generateWeekly({ year, month, week }),
    onSuccess: () => {
      toast.success(`Week ${week} payroll generated`);
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      qc.invalidateQueries({ queryKey: ['payslips'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Generate failed'),
  });

  const monthlyMut = useMutation({
    mutationFn: () => payrollApi.generateMonthly({ year, month }),
    onSuccess: () => {
      toast.success('Monthly payroll generated');
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
      qc.invalidateQueries({ queryKey: ['payslips'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Generate failed'),
  });

  const selected = payrolls.find((p) => p.type === 'weekly' && p.week === week)
    || payrolls.find((p) => p.type === 'monthly');

  return (
    <AppLayout title="Payroll">
      <div className="space-y-4">
        <Card className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap gap-3">
            <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions(year).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
            <Select label="Week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((w) => <option key={w} value={w}>Week {w}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => weeklyMut.mutate()} disabled={weeklyMut.isPending}>
              {weeklyMut.isPending ? 'Generating…' : 'Generate Weekly'}
            </Button>
            <Button variant="secondary" onClick={() => monthlyMut.mutate()} disabled={monthlyMut.isPending}>
              Generate Monthly
            </Button>
          </div>
          <p className="w-full text-xs text-muted">
            Payroll does not auto-refresh. After adding employees or updating timesheets, click{' '}
            <strong>Generate Weekly</strong> for this week to rebuild lines (includes tea fund per employee).
          </p>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <p className="text-sm text-muted">Week Totals</p>
            <div className="mt-2 space-y-1 text-sm">
              {(summary?.weeks || []).map((w) => (
                <div key={w.week} className="flex justify-between">
                  <span>W{w.week}</span>
                  <span className="font-medium">{formatMoney(w.netPay)}</span>
                </div>
              ))}
              {!summary?.weeks?.length && <p className="text-muted">No weekly payrolls yet</p>}
            </div>
          </Card>
          <Card>
            <p className="text-sm text-muted">Month Total</p>
            <p className="text-2xl font-heading mt-2">{formatMoney(summary?.month?.netPay || 0)}</p>
            <p className="text-xs text-muted mt-1">Employer: {formatMoney(summary?.month?.employerCost || 0)}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">Grand Total</p>
            <p className="text-2xl font-heading mt-2">{formatMoney(summary?.grandTotal?.netPay || 0)}</p>
            <p className="text-xs text-muted mt-1">
              Hours N/OT/DT: {formatNumber(summary?.grandTotal?.normalHours || 0)} / {formatNumber(summary?.grandTotal?.otHours || 0)} / {formatNumber(summary?.grandTotal?.doubleHours || 0)}
            </p>
          </Card>
        </div>

        <Card className="overflow-hidden p-0">
          <div className="px-5 py-4 border-b border-border flex justify-between items-center">
            <h3 className="font-heading">Payroll Summary — Excel Style</h3>
            <span className="text-sm text-muted">
              {selected
                ? `${selected.periodLabel} · ${selected.lines?.length || 0} employees`
                : 'Generate a week to see all active employees'}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[1100px]">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-left text-muted">
                  {['Employee', 'Normal', 'OT', 'Double', 'Gross', 'NPF', 'ACC', 'Tax', 'Tea', 'IOU', 'Net', 'Employer'].map((h) => (
                    <th key={h} className="px-3 py-3 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading && <tr><td className="px-4 py-6" colSpan={12}>Loading…</td></tr>}
                {(selected?.lines || []).map((line, i) => (
                  <tr key={i} className="border-b border-border/60 hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{line.employee?.fullName || '—'}</td>
                    <td className="px-3 py-2">{formatNumber(line.normalHours)}</td>
                    <td className="px-3 py-2">{formatNumber(line.otHours)}</td>
                    <td className="px-3 py-2">{formatNumber(line.doubleHours)}</td>
                    <td className="px-3 py-2">{formatNumber(line.grossPay)}</td>
                    <td className="px-3 py-2">{formatNumber(line.employeeNpf)}</td>
                    <td className="px-3 py-2">{formatNumber(line.employeeAcc)}</td>
                    <td className="px-3 py-2">{formatNumber(line.tax)}</td>
                    <td className="px-3 py-2">{formatNumber(line.teaFund)}</td>
                    <td className="px-3 py-2">{formatNumber(line.iouDeduction)}</td>
                    <td className="px-3 py-2 font-semibold text-primary">{formatNumber(line.netPay)}</td>
                    <td className="px-3 py-2">{formatNumber(line.employerCost)}</td>
                  </tr>
                ))}
                {selected?.totals && (
                  <tr className="bg-blue-50/60 font-semibold">
                    <td className="px-3 py-3">TOTAL</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.normalHours)}</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.otHours)}</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.doubleHours)}</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.grossPay)}</td>
                    <td className="px-3 py-3" colSpan={4} />
                    <td className="px-3 py-3">{formatNumber(selected.totals.iou)}</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.netPay)}</td>
                    <td className="px-3 py-3">{formatNumber(selected.totals.employerCost)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
