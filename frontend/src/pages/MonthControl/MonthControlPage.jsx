import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { opsApi, settingsApi } from '@/services';
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
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: settingsApi.get,
  });

  const [setYear, setSetYear] = useState(new Date().getFullYear());
  const [setMonth, setSetMonth] = useState(new Date().getMonth() + 1);
  const [editing, setEditing] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyEmail, setCompanyEmail] = useState('');

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName || '');
      setCompanyAddress(settings.companyAddress || '');
      setCompanyPhone(settings.companyPhone || '');
      setCompanyEmail(settings.companyEmail || '');
    }
  }, [settings]);

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

  const companyMut = useMutation({
    mutationFn: () =>
      settingsApi.update({
        companyName,
        companyAddress,
        companyPhone,
        companyEmail,
      }),
    onSuccess: () => {
      toast.success('Company details updated');
      setEditing(false);
      qc.invalidateQueries({ queryKey: ['settings'] });
      qc.invalidateQueries({ queryKey: ['month-control'] });
      qc.invalidateQueries({ queryKey: ['statutory'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  });

  const exportMut = useMutation({
    mutationFn: async () => {
      const res = await opsApi.exportMonthPdfs({
        year: data?.currentYear,
        month: data?.currentMonth,
      });
      const blob = new Blob([res.data], { type: 'application/zip' });
      if (blob.size < 100) {
        throw new Error('Export produced an empty file — generate payslips first, then retry');
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${String(data.currentMonth).padStart(2, '0')}${MONTHS[data.currentMonth - 1]}${data.currentYear}_PAYROLL_PDFs.zip`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => toast.success('PDF pack downloaded'),
    onError: async (err) => {
      let msg = err.message || 'Export failed';
      const data = err.response?.data;
      if (data instanceof Blob) {
        try {
          const text = await data.text();
          const j = JSON.parse(text);
          msg = j.message || msg;
        } catch {
          /* keep msg */
        }
      } else if (data?.message) {
        msg = data.message;
      }
      toast.error(msg);
    },
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
          <p className="text-xs text-muted">
            PDF export always includes weekly summary, leave, IOU, and statutory totals.
            Individual payslip PDFs are included when they have been generated for the month.
          </p>
        </Card>

        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="font-heading">Company details</h4>
            {!editing ? (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button type="button" size="sm" onClick={() => companyMut.mutate()} disabled={companyMut.isPending}>
                  {companyMut.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            )}
          </div>
          {editing ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Company Name" value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
              <Input label="Email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
              <Input label="Phone" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} />
              <Input label="Address" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} />
            </div>
          ) : (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-muted">Name</dt><dd className="font-medium">{settings?.companyName || '—'}</dd></div>
              <div><dt className="text-xs text-muted">Email</dt><dd className="font-medium">{settings?.companyEmail || '—'}</dd></div>
              <div><dt className="text-xs text-muted">Phone</dt><dd className="font-medium">{settings?.companyPhone || '—'}</dd></div>
              <div><dt className="text-xs text-muted">Address</dt><dd className="font-medium">{settings?.companyAddress || '—'}</dd></div>
            </dl>
          )}
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
            <li>
              <strong className="text-slate-800">Edit company details</strong> updates the name used in file names,
              payslips, and statutory sheets.
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
