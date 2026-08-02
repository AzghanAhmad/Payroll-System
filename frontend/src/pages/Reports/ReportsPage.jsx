import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line,
} from 'recharts';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { reportApi } from '@/services';
import { formatMoney, MONTHS, yearOptions } from '@/utils/helpers';

export default function ReportsPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data: yearly } = useQuery({
    queryKey: ['report-yearly', year],
    queryFn: () => reportApi.yearly({ year }),
  });
  const { data: departments = [] } = useQuery({
    queryKey: ['report-dept', year],
    queryFn: () => reportApi.department({ year }),
  });
  const { data: monthly = [] } = useQuery({
    queryKey: ['report-monthly', year, month],
    queryFn: () => reportApi.monthly({ year, month }),
  });
  const { data: iou = [] } = useQuery({
    queryKey: ['report-iou'],
    queryFn: reportApi.iou,
  });

  const download = async (type) => {
    try {
      const res = type === 'excel'
        ? await reportApi.exportExcel({ year, month })
        : await reportApi.exportPdf({ year, month });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = type === 'excel' ? 'payroll-report.xlsx' : 'payroll-report.pdf';
      a.click();
    } catch {
      toast.error('Export failed');
    }
  };

  return (
    <AppLayout title="Reports">
      <div className="space-y-4">
        <Card className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex gap-3">
            <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {yearOptions(year).map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
            <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => download('excel')}>Download Excel</Button>
            <Button variant="outline" onClick={() => download('pdf')}>Download PDF</Button>
          </div>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-heading mb-4">Yearly Payroll Cost</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={yearly?.months || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="grossPay" fill="#2563EB" radius={[8, 8, 0, 0]} name="Gross" />
                  <Bar dataKey="employerCost" fill="#06B6D4" radius={[8, 8, 0, 0]} name="Employer" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="font-heading mb-4">Department Costs</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departments}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="department" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="grossPay" fill="#22C55E" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="font-heading mb-4">Monthly Trend (Net)</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={yearly?.months || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="netPay" stroke="#F59E0B" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card>
            <h3 className="font-heading mb-3">Selected Month Payrolls</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {monthly.map((p) => (
                <div key={p._id} className="flex justify-between text-sm rounded-[12px] border border-border px-3 py-2">
                  <span>{p.periodLabel} ({p.type})</span>
                  <span className="font-medium">{formatMoney(p.totals?.netPay)}</span>
                </div>
              ))}
              {!monthly.length && <p className="text-sm text-muted">No payroll data for this month</p>}
            </div>
          </Card>
        </div>

        <Card>
          <h3 className="font-heading mb-3">IOU Report</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b">
                  <th className="py-2">Employee</th>
                  <th className="py-2">Amount</th>
                  <th className="py-2">Balance</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {iou.map((l) => (
                  <tr key={l._id} className="border-b border-border/50">
                    <td className="py-2">{l.employee?.fullName}</td>
                    <td className="py-2">{formatMoney(l.amount)}</td>
                    <td className="py-2">{formatMoney(l.remainingBalance)}</td>
                    <td className="py-2 capitalize">{l.status}</td>
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
