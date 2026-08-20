import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Select } from '@/components/ui/Input';
import { DownloadMenu } from '@/components/ui/DownloadMenu';
import { opsApi } from '@/services';
import { yearOptions } from '@/utils/helpers';

const fmt = (d) =>
  d
    ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

const saveBlob = (data, filename, mime) => {
  const url = window.URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

export default function SchedulePage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ['payroll-schedule', year],
    queryFn: () => opsApi.schedule({ year }),
  });

  return (
    <AppLayout title="Payroll Schedule">
      <div className="space-y-4">
        <Card className="flex flex-wrap items-end gap-3 justify-between">
          <div>
            <h3 className="font-heading">Payroll Schedule</h3>
            <p className="text-sm text-muted mt-1">
              Friday–Thursday pay periods with payday the following Friday. Assigned month follows payday.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions(year).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
            <DownloadMenu
              disabled={isLoading || !(data?.rows || []).length}
              onPdf={async () => {
                try {
                  const res = await opsApi.exportSchedulePdf({ year });
                  saveBlob(res.data, `Payroll_Schedule_${year}.pdf`, 'application/pdf');
                  toast.success('Schedule PDF downloaded');
                } catch (err) {
                  toast.error(err.response?.data?.message || 'PDF download failed');
                }
              }}
              onExcel={async () => {
                try {
                  const res = await opsApi.exportScheduleExcel({ year });
                  saveBlob(
                    res.data,
                    `Payroll_Schedule_${year}.xlsx`,
                    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                  );
                  toast.success('Schedule Excel downloaded');
                } catch (err) {
                  toast.error(err.response?.data?.message || 'Excel download failed');
                }
              }}
            />
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-slate-100 sticky top-0">
                <tr className="text-left">
                  <th className="px-3 py-2">Payday</th>
                  <th className="px-3 py-2">Pay Period Start</th>
                  <th className="px-3 py-2">Pay Period End</th>
                  <th className="px-3 py-2">Pay Cycle</th>
                  <th className="px-3 py-2">Assigned Payroll Month</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td className="px-4 py-6 text-muted" colSpan={5}>Loading…</td></tr>
                )}
                {(data?.rows || []).map((r) => (
                  <tr key={String(r.payday)} className="border-b border-border/50 hover:bg-slate-50/70">
                    <td className="px-3 py-2 whitespace-nowrap font-medium">{fmt(r.payday)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(r.periodStart)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{fmt(r.periodEnd)}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-muted">{r.payCycle}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{r.assignedPayrollMonth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
