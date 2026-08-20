import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Download } from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { DownloadMenu } from '@/components/ui/DownloadMenu';
import { statutoryApi } from '@/services';
import { MONTHS, formatMoney, yearOptions } from '@/utils/helpers';

const saveBlob = (data, filename, mime) => {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const downloadCsv = (filename, headers, rows) => {
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';

const displayMoney = (value) => (Number(value) ? formatMoney(value) : '-');

const cellInput =
  'w-full min-w-[72px] rounded-md border border-amber-300 bg-amber-50 px-1 py-1 text-right text-xs outline-none focus:ring-2 focus:ring-amber-200';

const cellInputLeft =
  'w-full min-w-[96px] rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-left text-xs outline-none focus:ring-2 focus:ring-amber-200';

const headerInput =
  'w-full rounded-md border border-amber-300 bg-amber-50 px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-amber-200';

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

const normalizeAccDept = (name) => {
  const n = String(name || '').toLowerCase();
  if (/caf[eé]/.test(n)) return 'Cafe';
  if (/chemist/.test(n)) return 'Chemist';
  return String(name || 'Other');
};

const computeAccDeptTotals = (rows = []) => {
  let cafe = 0;
  let chemist = 0;
  let all = 0;
  for (const r of rows) {
    const t = Number(r.total) || 0;
    all += t;
    const dept = normalizeAccDept(r.departmentName);
    if (dept === 'Cafe') cafe += t;
    else if (dept === 'Chemist') chemist += t;
  }
  return { all: round2(all), cafe: round2(cafe), chemist: round2(chemist) };
};

const recalcPayeRow = (row, syncBaseFromGross = true) => {
  row.payPeriod1 = round2(row.payPeriod1);
  row.payPeriod2 = round2(row.payPeriod2);
  row.payPeriod3 = round2(row.payPeriod3);
  row.taxPeriod1 = round2(row.taxPeriod1);
  row.taxPeriod2 = round2(row.taxPeriod2);
  row.taxPeriod3 = round2(row.taxPeriod3);
  row.grossTotal = round2(row.payPeriod1 + row.payPeriod2 + row.payPeriod3);
  row.totalTax = round2(row.taxPeriod1 + row.taxPeriod2 + row.taxPeriod3);
  if (syncBaseFromGross) row.baseAmount = row.grossTotal;
  else row.baseAmount = round2(row.baseAmount || row.grossTotal);
  row.npfTotal = round2(row.baseAmount * 0.09);
  row.accTotal = round2(row.baseAmount * 0.01);
  return row;
};

function EditableText({ value, onCommit, className = headerInput, align = 'left' }) {
  const [v, setV] = useState(value ?? '');
  useEffect(() => {
    setV(value ?? '');
  }, [value]);
  return (
    <input
      type="text"
      className={`${className} ${align === 'right' ? 'text-right' : ''}`}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        if (String(v) !== String(value ?? '')) onCommit(v);
      }}
    />
  );
}

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
      const syncBase = field !== 'baseAmount';
      recalcPayeRow(row, syncBase);
      return next;
    });
    queueOverride({ sheet: 'paye', rowKey: String(employeeId), field, value, week: 0 });
  };

  const updateMeta = (rowKey, field, value) => {
    setLocal((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      if (rowKey === '_employer') next.employer[field] = value;
      else if (rowKey === '_paye_summary') {
        next.paye.summary[field] = typeof next.paye.summary[field] === 'number' ? Number(value) || 0 : value;
      } else if (rowKey === '_statutory_totals') {
        next.statutoryTotals[field] = Number(value) || 0;
        next.statutoryTotals.total = round2(
          (Number(next.statutoryTotals.paye) || 0) +
            (Number(next.statutoryTotals.npf) || 0) +
            (Number(next.statutoryTotals.acc) || 0)
        );
      }
      return next;
    });
    queueOverride({ sheet: 'meta', rowKey, field, value, week: 0 });
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

  const downloadPaye = () => {
    const rows = (view?.paye?.rows || []).map((r) => [
      r.name, r.npfNumber, r.payPeriod, r.payPeriod1, r.payPeriod2, r.payPeriod3, r.grossTotal,
      r.baseAmount, r.taxPeriod1, r.taxPeriod2, r.taxPeriod3, r.totalTax, r.npfTotal, r.accTotal,
    ]);
    downloadCsv(`PAYE_${MONTHS[month - 1]}_${year}.csv`,
      ['Employee', 'NPF Number', 'Pay Period', 'Salary 1', 'Salary 2', 'Salary 3', 'Salary Total', 'Base Amount', 'Tax 1', 'Tax 2', 'Tax 3', 'Total Tax', 'NPF (9%)', 'ACC (1%)'], rows);
  };

  const downloadNpf = () => {
    const rows = (view?.npf?.rows || []).map((r) => [
      r.npfNumber, r.name, r.transactionType,
      ...(r.weeks || []).flatMap((w) => [w.employee, w.employer]),
      r.total,
    ]);
    const wHeaders = [1, 2, 3, 4, 5].flatMap((w) => [`W${w} Employee`, `W${w} Employer`]);
    downloadCsv(`NPF_${MONTHS[month - 1]}_${year}.csv`, ['NPF #', 'Name', 'Type', ...wHeaders, 'Total'], rows);
  };

  const downloadAcc = () => {
    const accRows = view?.acc?.rows || [];
    const rows = accRows.map((r) => [
      r.row, r.name,
      ...(r.weeks || []).flatMap((w) => [w.employee, w.employer]),
      r.total,
    ]);
    const totals = computeAccDeptTotals(accRows);
    const grandTotal = totals.all || view?.acc?.total || 0;
    rows.push(
      ['Total ACC Cafe & Chemist', '', '', '', '', '', '', '', '', '', '', '', grandTotal],
      ['', '', '', '', '', '', '', '', '', '', '', 'Cafe', totals.cafe],
      ['', '', '', '', '', '', '', '', '', '', '', 'Chemist', totals.chemist],
    );
    const wHeaders = [1, 2, 3, 4, 5].flatMap((w) => [`W${w} Employee`, `W${w} Employer`]);
    downloadCsv(`ACC_${MONTHS[month - 1]}_${year}.csv`, ['#', 'Name', ...wHeaders, 'Total'], rows);
  };

  const downloadTotals = () => {
    const t = view?.statutoryTotals || {};
    downloadCsv(`Statutory_Totals_${MONTHS[month - 1]}_${year}.csv`,
      ['Type', 'Amount'],
      [['PAYE', t.paye], ['NPF', t.npf], ['ACC', t.acc], ['TOTAL', t.total]]);
  };

  const tabs = [
    { id: 'paye', label: 'PAYE Sheet' },
    { id: 'npf', label: 'NPF Sheet' },
    { id: 'acc', label: 'ACC Schedule' },
    { id: 'totals', label: 'Monthly Totals' },
  ];

  const view = local || data;
  const payeRows = view?.paye?.rows || [];
  const payeGrossTotal = round2(payeRows.reduce((s, r) => s + Number(r.grossTotal || 0), 0));
  const payeTaxTotal = round2(payeRows.reduce((s, r) => s + Number(r.totalTax || 0), 0));
  const payeSummary = view?.paye?.summary || {};
  const accDeptTotals = useMemo(
    () => computeAccDeptTotals(view?.acc?.rows || []),
    [view?.acc?.rows]
  );

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
            {tab === 'npf' || tab === 'acc' ? (
              <DownloadMenu
                size="sm"
                disabled={isLoading}
                onPdf={async () => {
                  try {
                    if (tab === 'npf') {
                      const res = await statutoryApi.exportNpfPdf({ year, month });
                      saveBlob(res.data, `NPF_${MONTHS[month - 1]}_${year}.pdf`, 'application/pdf');
                      toast.success('NPF PDF downloaded');
                    } else {
                      const res = await statutoryApi.exportAccPdf({ year, month });
                      saveBlob(res.data, `ACC_${MONTHS[month - 1]}_${year}.pdf`, 'application/pdf');
                      toast.success('ACC PDF downloaded');
                    }
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'PDF download failed');
                  }
                }}
                onExcel={async () => {
                  try {
                    if (tab === 'npf') {
                      const res = await statutoryApi.exportNpfExcel({ year, month });
                      saveBlob(
                        res.data,
                        `NPF_${MONTHS[month - 1]}_${year}.xlsx`,
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      );
                      toast.success('NPF Excel downloaded');
                    } else {
                      const res = await statutoryApi.exportAccExcel({ year, month });
                      saveBlob(
                        res.data,
                        `ACC_${MONTHS[month - 1]}_${year}.xlsx`,
                        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                      );
                      toast.success('ACC Excel downloaded');
                    }
                  } catch (err) {
                    toast.error(err.response?.data?.message || 'Excel download failed');
                  }
                }}
              />
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (tab === 'paye') downloadPaye();
                  else downloadTotals();
                }}
              >
                <Download size={14} className="mr-1" /> Download
              </Button>
            )}
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
          <div className="space-y-4">
            <Card className="overflow-hidden p-0">
              <div className="border-b bg-emerald-50 px-4 py-3">
                <h3 className="font-heading">PAYE Sheet — {MONTHS[month - 1]} {year}</h3>
                <p className="text-xs text-muted">
                  Rebuilt to match the authority form. Yellow cells can still be adjusted and autosaved.
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1500px] text-xs border-collapse">
                  <tbody>
                    <tr className="bg-white">
                      <td className="border px-3 py-2 font-semibold uppercase">Payer / Employer:</td>
                      <td className="border px-3 py-2 bg-emerald-100" colSpan={4}>
                        <EditableText
                          value={view?.employer?.companyName}
                          onCommit={(v) => updateMeta('_employer', 'companyName', v)}
                        />
                      </td>
                      <td className="border px-3 py-2 font-semibold uppercase">Payment for the month of</td>
                      <td className="border px-3 py-2 bg-emerald-100 text-center font-semibold" colSpan={4}>
                        {MONTHS[month - 1]}-{String(year).slice(-2)}
                      </td>
                    </tr>
                    <tr className="bg-white">
                      <td className="border px-3 py-2 font-semibold uppercase">Tax Identification Number</td>
                      <td className="border px-3 py-2 bg-emerald-100" colSpan={2}>
                        <EditableText
                          value={view?.employer?.taxIdentificationNumber}
                          onCommit={(v) => updateMeta('_employer', 'taxIdentificationNumber', v)}
                        />
                      </td>
                      <td className="border px-3 py-2 font-semibold uppercase">Address:</td>
                      <td className="border px-3 py-2 bg-emerald-100" colSpan={6}>
                        <EditableText
                          value={view?.employer?.companyAddress}
                          onCommit={(v) => updateMeta('_employer', 'companyAddress', v)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1500px] text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-center">
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>NAME OF EMPLOYEES</th>
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>NPF Number</th>
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>PAY PERIOD</th>
                      <th className="border px-2 py-2 font-semibold" colSpan={4}>SALARY / WAGE / SOURCE DEDUCTION PAYMENTS</th>
                      <th className="border px-2 py-2 font-semibold" colSpan={4}>TAX DEDUCTIONS</th>
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>BASE AMOUNT</th>
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>NPF (9%)</th>
                      <th className="border px-2 py-2 align-bottom" rowSpan={3}>ACC (1%)</th>
                    </tr>
                    <tr className="bg-slate-50 text-center">
                      <th className="border px-2 py-2" colSpan={4}>PAY PERIODS OF THE MONTH</th>
                      <th className="border px-2 py-2" colSpan={4}>PAY PERIODS OF THE MONTH</th>
                    </tr>
                    <tr className="bg-slate-50 text-center text-muted">
                      <th className="border px-2 py-1">1</th>
                      <th className="border px-2 py-1">2</th>
                      <th className="border px-2 py-1">3</th>
                      <th className="border px-2 py-1">TOTAL</th>
                      <th className="border px-2 py-1">1</th>
                      <th className="border px-2 py-1">2</th>
                      <th className="border px-2 py-1">3</th>
                      <th className="border px-2 py-1">TOTAL TAX</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payeRows.map((r) => (
                      <tr key={r.employeeId} className="hover:bg-slate-50/60">
                        <td className="border px-1 py-1">
                          <EditableText
                            value={r.name}
                            className={cellInputLeft}
                            onCommit={(v) => updatePaye(r.employeeId, 'name', v)}
                          />
                        </td>
                        <td className="border px-1 py-1">
                          <EditableText
                            value={r.npfNumber}
                            className={cellInputLeft}
                            onCommit={(v) => updatePaye(r.employeeId, 'npfNumber', v)}
                          />
                        </td>
                        <td className="border px-1 py-1">
                          <EditableText
                            value={r.payPeriod || 'Fortnightly'}
                            className={cellInputLeft}
                            onCommit={(v) => updatePaye(r.employeeId, 'payPeriod', v)}
                          />
                        </td>
                        {['payPeriod1', 'payPeriod2', 'payPeriod3'].map((f) => (
                          <td key={f} className="border px-1 py-1 bg-emerald-50">
                            <EditableNum value={r[f]} onCommit={(n) => updatePaye(r.employeeId, f, n)} />
                          </td>
                        ))}
                        <td className="border px-2 py-2 text-right font-semibold bg-emerald-100">
                          {displayMoney(r.grossTotal)}
                        </td>
                        {['taxPeriod1', 'taxPeriod2', 'taxPeriod3'].map((f) => (
                          <td key={f} className="border px-1 py-1 bg-amber-50">
                            <EditableNum value={r[f]} onCommit={(n) => updatePaye(r.employeeId, f, n)} />
                          </td>
                        ))}
                        <td className="border px-2 py-2 text-right font-semibold bg-slate-100">
                          {displayMoney(r.totalTax)}
                        </td>
                        <td className="border px-1 py-1 bg-sky-50">
                          <EditableNum
                            value={r.baseAmount}
                            onCommit={(n) => updatePaye(r.employeeId, 'baseAmount', n)}
                          />
                        </td>
                        <td className="border px-2 py-2 text-right font-medium bg-violet-50">
                          {displayMoney(r.npfTotal)}
                        </td>
                        <td className="border px-2 py-2 text-right font-medium bg-violet-50">
                          {displayMoney(r.accTotal)}
                        </td>
                      </tr>
                    ))}
                    {!payeRows.length && (
                      <tr>
                        <td className="border px-4 py-6 text-muted" colSpan={14}>No PAYE rows for this month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.25fr_auto] lg:items-start">
                <div className="space-y-2">
                  <h4 className="font-heading">Total Gross Pay From</h4>
                  <div className="grid grid-cols-[1fr_180px] gap-x-4 gap-y-2 text-sm">
                    <div>Previous periods</div>
                    <EditableNum
                      value={payeSummary.previousGross}
                      onCommit={(n) => updateMeta('_paye_summary', 'previousGross', n)}
                    />
                    <div>This month</div>
                    <EditableNum
                      value={payeSummary.thisMonthGross ?? payeGrossTotal}
                      onCommit={(n) => updateMeta('_paye_summary', 'thisMonthGross', n)}
                    />
                    <div>Total year to date</div>
                    <EditableNum
                      value={payeSummary.yearToDateGross}
                      onCommit={(n) => updateMeta('_paye_summary', 'yearToDateGross', n)}
                    />
                    <div>Tax paid this month</div>
                    <EditableNum
                      value={payeSummary.taxPaidThisMonth ?? payeTaxTotal}
                      onCommit={(n) => updateMeta('_paye_summary', 'taxPaidThisMonth', n)}
                    />
                  </div>
                </div>

                <div className="min-w-[220px] rounded-md border bg-slate-50 px-4 py-3">
                  <div className="text-sm font-semibold">Total Tax to Pay</div>
                  <div className="mt-2">
                    <EditableNum
                      value={payeSummary.totalTaxToPay ?? payeTaxTotal}
                      onCommit={(n) => updateMeta('_paye_summary', 'totalTaxToPay', n)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <h4 className="font-heading">Declaration:</h4>
                <p className="italic text-muted">
                  I solemnly declare that the information provided in this form are true and correct; and I understand
                  that any misleading or false information is an offence under the Tax Administration Act 2012.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_1fr] md:items-center">
                <div className="font-semibold uppercase">Signature of Employer</div>
                <EditableText
                  value={view?.employer?.digitalSignature || view?.employer?.companyName || ''}
                  onCommit={(v) => updateMeta('_employer', 'digitalSignature', v)}
                />
                <div className="font-semibold uppercase">Designation</div>
                <EditableText
                  value={payeSummary.designation || view?.employer?.companyEmail || ''}
                  onCommit={(v) => updateMeta('_paye_summary', 'designation', v)}
                />
              </div>
            </Card>
          </div>
        )}

        {!isLoading && tab === 'npf' && (
          <div className="space-y-4">
            <Card className="space-y-3">
              <h3 className="font-heading">SAMOA NATIONAL PROVIDENT FUND</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Employer Number</dt>
                  <dd>
                    <EditableText
                      value={view?.employer?.npfEmployerNumber}
                      onCommit={(v) => updateMeta('_employer', 'npfEmployerNumber', v)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Employer Name</dt>
                  <dd>
                    <EditableText
                      value={view?.employer?.companyName}
                      onCommit={(v) => updateMeta('_employer', 'companyName', v)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Email / Address</dt>
                  <dd>
                    <EditableText
                      value={view?.employer?.companyAddress || view?.employer?.companyEmail || ''}
                      onCommit={(v) => updateMeta('_employer', 'companyAddress', v)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Telephone</dt>
                  <dd>
                    <EditableText
                      value={view?.employer?.companyPhone}
                      onCommit={(v) => updateMeta('_employer', 'companyPhone', v)}
                    />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Zone</dt>
                  <dd>
                    <EditableText
                      value={view?.employer?.npfZone}
                      onCommit={(v) => updateMeta('_employer', 'npfZone', v)}
                    />
                  </dd>
                </div>
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
                <div>
                  <span className="text-muted text-xs block">Employer name</span>
                  <EditableText
                    value={view?.employer?.companyName}
                    onCommit={(v) => updateMeta('_employer', 'companyName', v)}
                  />
                </div>
                <div><span className="text-muted text-xs block">Month of</span>{MONTHS[month - 1]}-{String(year).slice(-2)}</div>
                <div>
                  <span className="text-muted text-xs block">Emp. Numbers</span>
                  <div className="flex gap-2">
                    <EditableText
                      value={view?.employer?.accEmpNumber1}
                      onCommit={(v) => updateMeta('_employer', 'accEmpNumber1', v)}
                    />
                    <EditableText
                      value={view?.employer?.accEmpNumber2}
                      onCommit={(v) => updateMeta('_employer', 'accEmpNumber2', v)}
                    />
                  </div>
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
                      <td className="px-2 py-3" colSpan={12}>Total ACC Cafe &amp; Chemist</td>
                      <td className="px-2 py-3 text-right">{formatMoney(accDeptTotals.all || view?.acc?.total)}</td>
                    </tr>
                    <tr className="bg-amber-50 font-medium">
                      <td className="px-2 py-2" colSpan={11} />
                      <td className="px-2 py-2 text-right">Cafe</td>
                      <td className="px-2 py-2 text-right">{formatMoney(accDeptTotals.cafe)}</td>
                    </tr>
                    <tr className="bg-amber-50 font-medium">
                      <td className="px-2 py-2" colSpan={11} />
                      <td className="px-2 py-2 text-right">Chemist</td>
                      <td className="px-2 py-2 text-right">{formatMoney(accDeptTotals.chemist)}</td>
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
                  <td className="py-3 text-right">
                    <EditableNum
                      value={view?.statutoryTotals?.paye}
                      onCommit={(n) => updateMeta('_statutory_totals', 'paye', n)}
                    />
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">NPF</td>
                  <td className="py-3 text-right">
                    <EditableNum
                      value={view?.statutoryTotals?.npf}
                      onCommit={(n) => updateMeta('_statutory_totals', 'npf', n)}
                    />
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-3">ACC</td>
                  <td className="py-3 text-right">
                    <EditableNum
                      value={view?.statutoryTotals?.acc}
                      onCommit={(n) => updateMeta('_statutory_totals', 'acc', n)}
                    />
                  </td>
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
