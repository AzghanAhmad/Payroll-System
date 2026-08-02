import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { opsApi } from '@/services';
import { MONTHS, yearOptions } from '@/utils/helpers';

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

export default function MonthControlPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['month-control'],
    queryFn: opsApi.monthControl,
  });

  const [setYear, setSetYear] = useState(new Date().getFullYear());
  const [setMonth, setSetMonth] = useState(new Date().getMonth() + 1);

  const createMut = useMutation({
    mutationFn: opsApi.createNextMonth,
    onSuccess: (res) => {
      toast.success(res.message || 'Next month created');
      qc.invalidateQueries({ queryKey: ['month-control'] });
      qc.invalidateQueries({ queryKey: ['timesheet'] });
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const setMut = useMutation({
    mutationFn: () => opsApi.setCurrentMonth({ year: setYear, month: setMonth }),
    onSuccess: () => {
      toast.success('Current payroll month updated');
      qc.invalidateQueries({ queryKey: ['month-control'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await opsApi.exportMonthPdfs({
        year: data?.currentYear,
        month: data?.currentMonth,
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data?.nextFileName || 'payroll'}_PDFs.zip`.replace('NEXT', 'CURRENT');
      // Use current month naming
      a.download = `${String(data.currentMonth).padStart(2, '0')}${MONTHS[data.currentMonth - 1]}${data.currentYear}_PAYROLL_PDFs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('PDF pack downloaded'),
    onError: (err) => toast.error(err.response?.data?.message || 'Export failed'),
  });

  return (
    <AppLayout title="Payroll Month Control">
      <div className="space-y-4 max-w-3xl">
        <Card className="space-y-4">
          <h3 className="font-heading text-lg">Payroll Month Control</h3>
          <p className="text-sm text-muted">
            Create the next payroll month without copying or renaming workbooks manually.
            The next timesheet period is prepared and tracked under the year payroll folder name.
          </p>

          {isLoading ? (
            <p className="text-muted text-sm">Loading…</p>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="rounded-[14px] bg-slate-50 p-3">
                <dt className="text-muted text-xs">Current Payroll Month</dt>
                <dd className="font-semibold text-base mt-1">{fmt(data?.currentPayrollMonth)}</dd>
              </div>
              <div className="rounded-[14px] bg-sky-50 p-3 border border-sky-100">
                <dt className="text-sky-800 text-xs">Next Payroll Month</dt>
                <dd className="font-semibold text-base mt-1 text-sky-950">{fmt(data?.nextPayrollMonth)}</dd>
              </div>
              <div className="rounded-[14px] bg-slate-50 p-3 sm:col-span-2">
                <dt className="text-muted text-xs">Next File Name</dt>
                <dd className="font-mono text-sm mt-1 break-all">{data?.nextFileName}</dd>
              </div>
              <div className="rounded-[14px] bg-slate-50 p-3">
                <dt className="text-muted text-xs">Payroll Weeks</dt>
                <dd className="font-semibold mt-1">{Number(data?.payrollWeeks || 0).toFixed(2)}</dd>
              </div>
              <div className="rounded-[14px] bg-slate-50 p-3">
                <dt className="text-muted text-xs">Save Folder</dt>
                <dd className="font-semibold mt-1">{data?.saveFolder}</dd>
              </div>
            </dl>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
              {createMut.isPending ? 'Creating…' : 'Create Next Month'}
            </Button>
            <Button type="button" variant="outline" onClick={() => exportMut.mutate()} disabled={exportMut.isPending || !data}>
              {exportMut.isPending ? 'Packing…' : 'Save Full Payroll PDFs'}
            </Button>
          </div>
        </Card>

        <Card className="space-y-3">
          <h4 className="font-heading">What the buttons do</h4>
          <ul className="text-sm text-muted space-y-2 list-disc pl-5">
            <li>
              <strong className="text-slate-800">Create Next Month</strong> prepares the next timesheet month
              (all active staff rows) and advances the current payroll month pointer.
            </li>
            <li>
              <strong className="text-slate-800">Save Full Payroll PDFs</strong> builds a zip for the current month
              with payslips, leave records, IOUs, weekly summary, and PAYE / NPF / ACC totals.
            </li>
          </ul>
        </Card>

        <Card className="space-y-3">
          <h4 className="font-heading">Set current payroll month</h4>
          <div className="flex flex-wrap gap-3 items-end">
            <Select label="Year" value={setYear} onChange={(e) => setSetYear(Number(e.target.value))}>
              {yearOptions(setYear).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <Select label="Month" value={setMonth} onChange={(e) => setSetMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </Select>
            <Button type="button" variant="outline" onClick={() => setMut.mutate()} disabled={setMut.isPending}>
              Update
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
