import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download, Printer, Eye, FileStack, Trash2 } from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ShareMenu } from '@/components/ui/ShareMenu';
import { payslipApi, departmentApi, payrollApi } from '@/services';
import { formatMoney, formatNumber, MONTHS, yearOptions, buildPayslipFilename, payslipFileLabel } from '@/utils/helpers';
import { formatFullDate, getWeekPeriod } from '@/utils/weekPeriod';

export default function PayslipsPage() {
  const now = new Date();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const employeeFilterId = searchParams.get('employee') || '';
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [week, setWeek] = useState(1);
  const [periodType, setPeriodType] = useState('weekly'); // weekly | monthly
  const [department, setDepartment] = useState('');
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState('list'); // list | staff

  const { data: departments = [] } = useQuery({ queryKey: ['departments'], queryFn: departmentApi.list });

  const { data: rawPayslips = [], isLoading } = useQuery({
    queryKey: ['payslips', year, month, periodType, week, department],
    queryFn: () =>
      payslipApi.list({
        year,
        month,
        type: periodType,
        week: periodType === 'weekly' ? week : undefined,
        department: department || undefined,
      }),
  });

  // One row per employee for the selected period (dedupe if any duplicates exist)
  const payslips = useMemo(() => {
    const byEmp = new Map();
    for (const p of rawPayslips) {
      const id = String(p.employee?._id || p.employee || p._id);
      const prev = byEmp.get(id);
      if (!prev || new Date(p.updatedAt || 0) > new Date(prev.updatedAt || 0)) {
        byEmp.set(id, p);
      }
    }
    return Array.from(byEmp.values()).sort((a, b) =>
      String(a.employee?.fullName || '').localeCompare(String(b.employee?.fullName || ''))
    );
  }, [rawPayslips]);

  const visiblePayslips = useMemo(() => {
    if (!employeeFilterId) return payslips;
    return payslips.filter((p) => String(p.employee?._id || p.employee) === String(employeeFilterId));
  }, [payslips, employeeFilterId]);

  const weekTotals = useMemo(() => {
    const gross = visiblePayslips.reduce((s, p) => s + (p.grossPay || 0), 0);
    const net = visiblePayslips.reduce((s, p) => s + (p.netPay || 0), 0);
    return {
      gross: Math.round(gross * 100) / 100,
      net: Math.round(net * 100) / 100,
      count: visiblePayslips.length,
    };
  }, [visiblePayslips]);

  const generateMut = useMutation({
    mutationFn: async () => {
      if (periodType === 'weekly') {
        return payrollApi.generateWeekly({ year, month, week: Number(week) });
      }
      return payrollApi.generateMonthly({ year, month });
    },
    onSuccess: () => {
      toast.success(periodType === 'weekly' ? `Week ${week} payslips saved` : 'Monthly payslips saved');
      qc.invalidateQueries({ queryKey: ['payslips'] });
      qc.invalidateQueries({ queryKey: ['payrolls'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || 'Failed'),
  });

  const fileCtx = useMemo(
    () => ({ year, month, week: periodType === 'weekly' ? week : undefined, periodType }),
    [year, month, week, periodType]
  );

  const deleteMut = useMutation({
    mutationFn: (id) => payslipApi.remove(id),
    onSuccess: (res, id) => {
      toast.success(res.message || 'Payslip deleted');
      setSelected((s) => (String(s?._id) === String(id) ? null : s));
      qc.invalidateQueries({ queryKey: ['payslips'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || 'Delete failed'),
  });

  const deletePeriodMut = useMutation({
    mutationFn: () =>
      payslipApi.removePeriod({
        year,
        month,
        type: periodType,
        week: periodType === 'weekly' ? week : undefined,
      }),
    onSuccess: (res) => {
      toast.success(res.message || 'Payslips deleted');
      setSelected(null);
      qc.invalidateQueries({ queryKey: ['payslips'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || err.message || 'Delete failed'),
  });

  const handleDelete = (p) => {
    const name = p.employee?.fullName || 'this employee';
    const label = payslipFileLabel(p, fileCtx);
    if (!window.confirm(`Delete payslip for ${name}?\n${label}`)) return;
    deleteMut.mutate(p._id);
  };

  const handleDeletePeriod = () => {
      if (!visiblePayslips.length) return;
    const msg =
      periodType === 'weekly'
        ? `Delete all ${visiblePayslips.length} payslip(s) for Week ${week}, ${MONTHS[month - 1]} ${year}?`
        : `Delete all ${visiblePayslips.length} monthly payslip(s) for ${MONTHS[month - 1]} ${year}?`;
    if (!window.confirm(msg)) return;
    deletePeriodMut.mutate();
  };

  const download = async (payslipOrId) => {
    try {
      const payslip =
        typeof payslipOrId === 'object'
          ? payslipOrId
          : visiblePayslips.find((p) => p._id === payslipOrId) || payslips.find((p) => p._id === payslipOrId);
      const id = typeof payslipOrId === 'object' ? payslipOrId._id : payslipOrId;
      const res = await payslipApi.download(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = buildPayslipFilename(payslip, fileCtx);
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed');
    }
  };

  const email = async (id) => {
    await payslipApi.email(id);
    toast.success('Payslip emailed');
  };

  const shareTextFor = (p) =>
    [
      `Payslip — ${p.employee?.fullName || ''}`,
      p.periodLabel || '',
      `Gross: ${formatMoney(p.grossPay)}`,
      `Net: ${formatMoney(p.netPay)}`,
      `IOU deduction: ${formatMoney(p.iouDeduction)}`,
    ].join('\n');

  const printPayslip = async (id) => {
    try {
      const res = await payslipApi.download(id);
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const w = window.open(url);
      if (w) w.onload = () => w.print();
    } catch {
      toast.error('Print failed');
    }
  };

  const downloadAll = async () => {
    try {
      const res = await payslipApi.downloadPack({
        year,
        month,
        type: periodType,
        week: periodType === 'weekly' ? week : undefined,
      });
      const zipName =
        periodType === 'weekly'
          ? `Payslips_${MONTHS[month - 1]}_${year}_Week${week}.zip`
          : `Payslips_${MONTHS[month - 1]}_${year}_Monthly.zip`;
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/zip' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success(`Downloaded ${visiblePayslips.length} payslip(s) as ${zipName}`);
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Download failed');
    }
  };

  const periodRange =
    periodType === 'weekly'
      ? (() => {
          const { start, end } = getWeekPeriod(year, month, Number(week));
          return `${formatFullDate(start)} – ${formatFullDate(end)}`;
        })()
      : `${MONTHS[month - 1]} 1 – ${MONTHS[month - 1]} ${new Date(year, month, 0).getDate()}, ${year}`;

  const periodLabel =
    periodType === 'weekly'
      ? `Week ${week} · ${MONTHS[month - 1]} ${year}`
      : `${MONTHS[month - 1]} ${year} (Monthly)`;

  return (
    <AppLayout title="Payslips">
      <div className="space-y-4">
        <Card className="space-y-4">
          <div className="flex flex-wrap items-end gap-3 justify-between">
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
              <Select
                label="Period"
                value={periodType}
                onChange={(e) => {
                  setPeriodType(e.target.value);
                  if (e.target.value === 'weekly' && !week) setWeek(1);
                }}
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
              {periodType === 'weekly' && (
                <Select label="Week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <option key={w} value={w}>Week {w}</option>
                  ))}
                </Select>
              )}
              <Select label="Department" value={department} onChange={(e) => setDepartment(e.target.value)}>
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>{d.name}</option>
                ))}
              </Select>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant={view === 'list' ? 'primary' : 'outline'} onClick={() => setView('list')}>
                Summary
              </Button>
              <Button type="button" variant={view === 'staff' ? 'primary' : 'outline'} onClick={() => setView('staff')}>
                Staff Payslip
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={generateMut.isPending}
                onClick={() => generateMut.mutate()}
              >
                <FileStack size={16} /> Save All Payslips
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!visiblePayslips.length || !!employeeFilterId}
                onClick={downloadAll}
                title={employeeFilterId ? 'Bulk download is disabled while filtering one employee' : undefined}
              >
                <Download size={16} /> Download PDFs
              </Button>
              <Button
                type="button"
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                disabled={!visiblePayslips.length || deletePeriodMut.isPending || !!employeeFilterId}
                onClick={handleDeletePeriod}
                title={employeeFilterId ? 'Period delete is disabled while filtering one employee' : undefined}
              >
                <Trash2 size={16} /> Delete Period
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted">
            {employeeFilterId
              ? 'Showing the selected employee for this period. Clear the search to use bulk download or period delete.'
              : 'Showing each employee once for the selected period. Change Month / Period / Week to switch payslips.'}
          </p>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Card>
            <p className="text-sm text-muted">Selected period</p>
            <p className="font-heading mt-1">{periodLabel}</p>
            <p className="text-xs text-muted mt-1">{periodRange}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{periodType === 'weekly' ? 'Week Gross Total' : 'Month Gross Total'}</p>
            <p className="font-heading text-xl mt-1 text-primary">{formatMoney(weekTotals.gross)}</p>
          </Card>
          <Card>
            <p className="text-sm text-muted">{periodType === 'weekly' ? 'Week Net Total' : 'Month Net Total'}</p>
            <p className="font-heading text-xl mt-1">{formatMoney(weekTotals.net)}</p>
            <p className="text-xs text-muted mt-1">{weekTotals.count} employee payslip(s)</p>
          </Card>
        </div>

        {view === 'list' ? (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-slate-50 border-b sticky top-0">
                  <tr className="text-left text-muted">
                    <th className="px-3 py-3">Name</th>
                    <th className="px-3 py-3">Period</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3 text-right">Normal</th>
                    <th className="px-3 py-3 text-right">T 1/2</th>
                    <th className="px-3 py-3 text-right">T2</th>
                    <th className="px-3 py-3 text-right">Gross</th>
                    <th className="px-3 py-3 text-right">NPF</th>
                    <th className="px-3 py-3 text-right">ACC</th>
                    <th className="px-3 py-3 text-right">Tax</th>
                    <th className="px-3 py-3 text-right">IOU</th>
                    <th className="px-3 py-3 text-right">Tea</th>
                    <th className="px-3 py-3 text-right">Net</th>
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td className="px-4 py-6" colSpan={14}>Loading…</td></tr>}
                  {!isLoading && !visiblePayslips.length && (
                    <tr>
                      <td className="px-4 py-6 text-muted" colSpan={14}>
                        No payslips for this period. Click Save All Payslips after selecting Month and Week.
                      </td>
                    </tr>
                  )}
                  {visiblePayslips.map((p) => (
                    <tr key={p._id} className="border-b border-border/60 hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">
                        <div>{p.employee?.fullName}</div>
                        <div className="text-[11px] text-muted font-mono mt-0.5">
                          {payslipFileLabel(p, fileCtx)}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{formatFullDate(p.periodStart)} – {formatFullDate(p.periodEnd)}</div>
                        <div className="text-muted">
                          {periodType === 'weekly' ? `W${p.week}` : 'Monthly'} · {p.bank || '—'} · {p.npfNumber || '—'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.hourlyRate)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(p.normalHours)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(p.otHours)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(p.doubleHours)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.grossPay)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.employeeNpf)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.employeeAcc)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.tax)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.iouDeduction)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.teaFund)}</td>
                      <td className="px-3 py-2 text-right font-semibold text-primary">{formatMoney(p.netPay)}</td>
                      <td className="px-3 py-2">
                        <div className="flex justify-end gap-1 items-center">
                          <button type="button" className="p-2 rounded-full hover:bg-slate-100 cursor-pointer" onClick={() => setSelected(p)}><Eye size={16} /></button>
                          <button type="button" className="p-2 rounded-full hover:bg-slate-100 cursor-pointer" onClick={() => download(p)}><Download size={16} /></button>
                          <ShareMenu
                            title={`Payslip — ${p.employee?.fullName || ''}`}
                            text={shareTextFor(p)}
                            onEmail={() => email(p._id)}
                            emailLabel="Email to staff"
                          />
                          <button type="button" className="p-2 rounded-full hover:bg-slate-100 cursor-pointer" onClick={() => printPayslip(p._id)}><Printer size={16} /></button>
                          <button
                            type="button"
                            className="p-2 rounded-full hover:bg-red-50 text-red-600 cursor-pointer"
                            title="Delete payslip"
                            disabled={deleteMut.isPending}
                            onClick={() => handleDelete(p)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {visiblePayslips.length > 0 && (
                    <tr className="bg-blue-50 font-semibold">
                      <td className="px-3 py-3" colSpan={6}>
                        {periodType === 'weekly' ? `WEEK ${week} TOTAL` : 'MONTH TOTAL'}
                      </td>
                      <td className="px-3 py-3 text-right text-primary">{formatMoney(weekTotals.gross)}</td>
                      <td className="px-3 py-3" colSpan={5} />
                      <td className="px-3 py-3 text-right">{formatMoney(weekTotals.net)}</td>
                      <td className="px-3 py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {visiblePayslips.map((p) => (
              <StaffPayslipCard
                key={p._id}
                payslip={p}
                fileCtx={fileCtx}
                onOpen={() => setSelected(p)}
                onDownload={() => download(p)}
                onDelete={() => handleDelete(p)}
              />
            ))}
            {!visiblePayslips.length && (
              <Card><p className="text-muted text-sm">No payslips for this period.</p></Card>
            )}
          </div>
        )}
      </div>

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Payslip Detail" className="max-w-3xl">
        {selected && (
          <PayslipDetail
            payslip={selected}
            onDownload={() => download(selected)}
            onEmail={() => email(selected._id)}
            shareText={shareTextFor(selected)}
            onPrint={() => printPayslip(selected._id)}
            onDelete={() => handleDelete(selected)}
          />
        )}
      </Modal>
    </AppLayout>
  );
}

function StaffPayslipCard({ payslip: p, fileCtx, onOpen, onDownload, onDelete }) {
  return (
    <Card className="space-y-3">
      <div className="flex justify-between gap-2 border-b border-border pb-3">
        <div>
          <p className="font-heading text-lg">{p.employee?.fullName}</p>
          <p className="text-[11px] text-muted font-mono mt-0.5">{payslipFileLabel(p, fileCtx)}</p>
          <p className="text-xs text-muted">
            {p.position || '—'} · {p.departmentName || p.employee?.department?.name || '—'}
          </p>
          <p className="text-xs text-muted mt-1">
            Period: {formatFullDate(p.periodStart)} – {formatFullDate(p.periodEnd)} · Week {p.week || '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">Net Pay</p>
          <p className="font-heading text-primary text-xl">{formatMoney(p.netPay)}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="font-semibold text-slate-700 mb-1">Payments</p>
          <Row label="Normal" value={`${formatNumber(p.normalHours)} × ${formatMoney(p.hourlyRate)} = ${formatMoney(p.normalPay)}`} />
          <Row label="OT T½" value={`${formatNumber(p.otHours)} × ${formatMoney(p.otRate || p.hourlyRate * 1.5)} = ${formatMoney(p.otPay)}`} />
          <Row label="Double T2" value={`${formatNumber(p.doubleHours)} = ${formatMoney(p.doublePay)}`} />
          <Row label="Gross" value={formatMoney(p.grossPay)} bold />
        </div>
        <div>
          <p className="font-semibold text-slate-700 mb-1">Deductions</p>
          <Row label="SNPF" value={formatMoney(p.employeeNpf)} />
          <Row label="ACC" value={formatMoney(p.employeeAcc)} />
          <Row label="PAYE" value={formatMoney(p.tax)} />
          <Row label="IOU" value={formatMoney(p.iouDeduction)} />
          <Row label="Tea Fund" value={formatMoney(p.teaFund)} />
          <Row label="Total Ded." value={formatMoney(p.totalDeductions)} bold />
        </div>
      </div>
      <div className="rounded-[14px] bg-slate-50 p-3 text-xs">
        <p className="font-semibold mb-1">IOU Note</p>
        <p>
          Amount {formatMoney(p.iouAmount)} · Paid {formatMoney(p.iouPaid)} · Balance {formatMoney(p.loanBalance)} · Payments {p.iouPaymentsCount || 0}
        </p>
        {p.comments && <p className="mt-1 text-muted">Comments: {p.comments}</p>}
      </div>
      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" size="sm" onClick={onOpen}>View</Button>
        <Button type="button" size="sm" onClick={onDownload}>PDF</Button>
        <Button type="button" variant="outline" size="sm" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onDelete}>
          Delete
        </Button>
      </div>
    </Card>
  );
}

function PayslipDetail({ payslip: p, onDownload, onEmail, onPrint, onDelete, shareText }) {
  return (
    <div className="space-y-4 text-sm">
      <div className="grid grid-cols-2 gap-2">
        <p><span className="text-muted">Employee:</span> {p.employee?.fullName}</p>
        <p><span className="text-muted">Position:</span> {p.position || p.employee?.position || '—'}</p>
        <p><span className="text-muted">Department:</span> {p.departmentName || '—'}</p>
        <p><span className="text-muted">Hourly Rate:</span> {formatMoney(p.hourlyRate)}</p>
        <p><span className="text-muted">Period Start:</span> {formatFullDate(p.periodStart)}</p>
        <p><span className="text-muted">Period End:</span> {formatFullDate(p.periodEnd)}</p>
        <p><span className="text-muted">Bank:</span> {p.bank || '—'}</p>
        <p><span className="text-muted">Account:</span> {p.accountNumber || '—'}</p>
        <p><span className="text-muted">NPF No:</span> {p.npfNumber || '—'}</p>
        <p><span className="text-muted">Pay Day:</span> {formatFullDate(p.payDay)}</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-[14px] bg-slate-50 p-4 space-y-1">
          <p className="font-heading text-sm mb-2">Hours / Earnings</p>
          <Row label="Normal time" value={`${formatNumber(p.normalHours)} → ${formatMoney(p.normalPay)}`} />
          <Row label="T 1/2 (OT)" value={`${formatNumber(p.otHours)} → ${formatMoney(p.otPay)}`} />
          <Row label="T2 (Double)" value={`${formatNumber(p.doubleHours)} → ${formatMoney(p.doublePay)}`} />
          <Row label="Gross pay" value={formatMoney(p.grossPay)} bold />
        </div>
        <div className="rounded-[14px] bg-slate-50 p-4 space-y-1">
          <p className="font-heading text-sm mb-2">Deductions</p>
          <Row label="NPF (10%)" value={formatMoney(p.employeeNpf)} />
          <Row label="ACC (1%)" value={formatMoney(p.employeeAcc)} />
          <Row label="Tax" value={formatMoney(p.tax)} />
          <Row label="IOU" value={formatMoney(p.iouDeduction)} />
          <Row label="Tea Fund" value={formatMoney(p.teaFund)} />
          <Row label="Net pay" value={formatMoney(p.netPay)} bold />
        </div>
      </div>

      <div className="rounded-[14px] border border-border p-4">
        <p className="font-heading text-sm mb-2">IOU</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <p>IOU amnt: <strong>{formatMoney(p.iouAmount)}</strong></p>
          <p>Amnt paid: <strong>{formatMoney(p.iouPaid)}</strong></p>
          <p>Balance: <strong>{formatMoney(p.loanBalance)}</strong></p>
          <p>Payments: <strong>{p.iouPaymentsCount || 0}</strong></p>
        </div>
        {p.comments && <p className="text-xs text-muted mt-2">Comments: {p.comments}</p>}
      </div>

      <div className="flex gap-2 justify-end items-center">
        <Button type="button" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={onDelete}>
          Delete
        </Button>
        <Button type="button" variant="outline" onClick={onDownload}>Download PDF</Button>
        <ShareMenu
          title={`Payslip — ${p.employee?.fullName || ''}`}
          text={shareText || ''}
          onEmail={onEmail}
          emailLabel="Email to staff"
        />
        <Button type="button" onClick={onPrint}>Print</Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between gap-2 ${bold ? 'font-semibold' : ''}`}>
      <span className="text-muted">{label}</span>
      <span>{value}</span>
    </div>
  );
}
