import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, Trash2, Loader2, Check } from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { statutoryApi, loanApi, employeeApi } from '@/services';
import { MONTHS, formatMoney, yearOptions } from '@/utils/helpers';

const SAVE_DELAY_MS = 450;

const toDateInput = (d) => {
  if (!d) return '';
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const yellowInput =
  'w-full min-w-[4.5rem] rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-right text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60';
const yellowInputLeft =
  'w-full min-w-[7rem] rounded-md border border-amber-200 bg-amber-50 px-1.5 py-1 text-left text-xs outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60';

function useDebouncedCallback(fn, delay) {
  const fnRef = useRef(fn);
  const timerRef = useRef(null);
  fnRef.current = fn;

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return useMemo(() => {
    const debounced = (...args) => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => fnRef.current(...args), delay);
    };
    debounced.flush = (...args) => {
      clearTimeout(timerRef.current);
      fnRef.current(...args);
    };
    debounced.cancel = () => clearTimeout(timerRef.current);
    return debounced;
  }, [delay]);
}

export default function IouTrackerPage() {
  const now = new Date();
  const qc = useQueryClient();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [viewWeek, setViewWeek] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    employee: '',
    amount: '',
    startWeek: 1,
    date: toDateInput(now),
    reason: '',
  });
  const [savingIds, setSavingIds] = useState(() => new Set());
  const [savedIds, setSavedIds] = useState(() => new Set());

  const { data, isLoading } = useQuery({
    queryKey: ['iou-tracker', year, month, viewWeek],
    queryFn: () => statutoryApi.iouTracker({ year, month, week: viewWeek }),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees-all-active'],
    queryFn: () => employeeApi.list({ status: 'active', limit: 500 }),
  });

  const empList = employeesData?.items || [];

  const markSaving = (key, on) => {
    setSavingIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const markSaved = (key) => {
    setSavedIds((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setSavedIds((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 1200);
  };

  const refreshTracker = () => qc.invalidateQueries({ queryKey: ['iou-tracker'] });

  const createMut = useMutation({
    mutationFn: loanApi.create,
    onSuccess: () => {
      toast.success('IOU added');
      setAddOpen(false);
      setForm({ employee: '', amount: '', startWeek: 1, date: toDateInput(now), reason: '' });
      refreshTracker();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Could not add IOU'),
  });

  const deleteMut = useMutation({
    mutationFn: loanApi.remove,
    onSuccess: () => {
      toast.success('IOU removed');
      refreshTracker();
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Delete failed'),
  });

  const saveField = async (rowKey, loanId, patch) => {
    if (!loanId) return;
    markSaving(rowKey, true);
    try {
      await loanApi.update(loanId, patch);
      markSaved(rowKey);
      refreshTracker();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed');
    } finally {
      markSaving(rowKey, false);
    }
  };

  const saveWeekPayment = async (rowKey, loanId, week, amount) => {
    if (!loanId) return;
    markSaving(rowKey, true);
    try {
      await loanApi.setWeekPayment(loanId, { year, month, week, amount });
      markSaved(rowKey);
      refreshTracker();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment update failed');
    } finally {
      markSaving(rowKey, false);
    }
  };

  /** Create IOU when typing into a No IOU row, then apply pending week payments */
  const ensureLoanAndSave = async (row, draft) => {
    const rowKey = String(row.employeeId);
    markSaving(rowKey, true);
    try {
      let loanId = row.loanId;
      if (!loanId) {
        const existing = await loanApi.list({ employee: row.employeeId, status: 'active' });
        const list = Array.isArray(existing) ? existing : [];
        if (list[0]?._id) loanId = list[0]._id;
      }

      const amt = Number(draft.amount) || 0;
      if (!loanId) {
        if (amt <= 0) {
          markSaving(rowKey, false);
          return null;
        }
        const created = await loanApi.create({
          employee: row.employeeId,
          amount: amt,
          installment: amt,
          startWeek: Number(draft.startWeek) || 1,
          date: draft.date || undefined,
          reason: draft.purpose || '',
        });
        loanId = created._id;
      } else {
        await loanApi.update(loanId, {
          amount: amt,
          installment: amt,
          startWeek: Number(draft.startWeek) || 1,
          date: draft.date || undefined,
          reason: draft.purpose || '',
        });
      }

      for (const w of [1, 2, 3, 4, 5]) {
        const pay = Number(draft.payments?.[w]) || 0;
        const prev = Number(row.weeks?.find((x) => x.week === w)?.payment) || 0;
        if (pay !== prev) {
          await loanApi.setWeekPayment(loanId, { year, month, week: w, amount: pay });
        }
      }

      markSaved(rowKey);
      refreshTracker();
      return loanId;
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not save IOU');
      return null;
    } finally {
      markSaving(rowKey, false);
    }
  };

  const staffWithIou = useMemo(
    () => (data?.staff || []).filter((r) => r.loanId),
    [data]
  );

  const employeesWithoutActive = useMemo(() => {
    const taken = new Set(
      (data?.staff || [])
        .filter((r) => r.loanId && r.status === 'Outstanding')
        .map((r) => String(r.employeeId))
    );
    return empList.filter((e) => !taken.has(String(e._id)));
  }, [empList, data]);

  const onAdd = (e) => {
    e.preventDefault();
    if (!form.employee || !form.amount) {
      toast.error('Staff and IOU amount are required');
      return;
    }
    createMut.mutate({
      employee: form.employee,
      amount: Number(form.amount),
      startWeek: Number(form.startWeek) || 1,
      date: form.date || undefined,
      reason: form.reason || '',
    });
  };

  return (
    <AppLayout title="Staff IOU Tracker">
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-lg">Staff IOU Tracker</h3>
              <p className="text-sm text-muted mt-1 max-w-2xl">
                Yellow cells autosave to the server as you type. Enter an amount on a blank row to create an IOU.
                Weekly payments sync to payroll &amp; payslips when those weeks exist.
              </p>
            </div>
            <Button type="button" onClick={() => setAddOpen(true)}>
              <Plus size={16} className="mr-1.5" />
              Add IOU
            </Button>
          </div>

          <div className="flex flex-wrap gap-3 items-end">
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
              label="Payslip Week View"
              value={viewWeek}
              onChange={(e) => setViewWeek(Number(e.target.value))}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>Week {String(w).padStart(2, '0')}</option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
            <SummaryPill label="Total IOU Issued" value={formatMoney(data?.totals?.totalIssued)} />
            <SummaryPill label="Total Repaid" value={formatMoney(data?.totals?.totalRepaid)} tone="emerald" />
            <SummaryPill label="Outstanding Balance" value={formatMoney(data?.totals?.outstanding)} tone="amber" />
            <SummaryPill label="Payslip Week View" value={String(viewWeek).padStart(2, '0')} tone="sky" />
          </div>
        </Card>

        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1400px] border-collapse">
              <thead className="sticky top-0 z-[1]">
                <tr className="bg-slate-800 text-white">
                  <th className="px-2 py-2.5 text-left font-semibold">Staff Name</th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-amber-600/40">Start Week</th>
                  <th className="px-2 py-2.5 text-center font-semibold bg-amber-600/40">IOU Amount</th>
                  {[1, 2, 3, 4, 5].map((w) => (
                    <th
                      key={w}
                      colSpan={2}
                      className={`px-1 py-2.5 text-center font-semibold ${
                        viewWeek === w ? 'bg-sky-700' : ''
                      }`}
                    >
                      Week {String(w).padStart(2, '0')}
                    </th>
                  ))}
                  <th className="px-2 py-2.5 text-right font-semibold">Total Repaid</th>
                  <th className="px-2 py-2.5 text-left font-semibold bg-amber-600/40">Date Loaned</th>
                  <th className="px-2 py-2.5 text-left font-semibold bg-amber-600/40">Purpose / Notes</th>
                  <th className="px-2 py-2.5 text-left font-semibold">Status</th>
                  <th className="px-2 py-2.5 w-14" />
                </tr>
                <tr className="bg-slate-700 text-slate-200 text-[10px]">
                  <th colSpan={3} />
                  {[1, 2, 3, 4, 5].map((w) => (
                    <FragmentHeaders key={w} highlight={viewWeek === w} />
                  ))}
                  <th colSpan={4} />
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={17}>Loading…</td>
                  </tr>
                )}
                {!isLoading && (data?.staff || []).length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={17}>No staff found.</td>
                  </tr>
                )}
                {(data?.staff || []).map((row) => {
                  const rowKey = String(row.employeeId);
                  return (
                    <TrackerRow
                      key={rowKey}
                      row={row}
                      viewWeek={viewWeek}
                      saving={savingIds.has(rowKey)}
                      saved={savedIds.has(rowKey)}
                      onAutosaveFields={(draft) => {
                        if (row.loanId) {
                          return saveField(rowKey, row.loanId, {
                            amount: Number(draft.amount) || 0,
                            installment: Number(draft.amount) || 0,
                            startWeek: Number(draft.startWeek) || 1,
                            date: draft.date || undefined,
                            reason: draft.purpose || '',
                          });
                        }
                        return ensureLoanAndSave(row, draft);
                      }}
                      onAutosaveWeek={(week, amount, draft) => {
                        if (row.loanId) {
                          return saveWeekPayment(rowKey, row.loanId, week, amount);
                        }
                        return ensureLoanAndSave(row, {
                          ...draft,
                          payments: { ...draft.payments, [week]: amount },
                        });
                      }}
                      onDelete={() => {
                        if (!row.loanId) return;
                        if (window.confirm(`Remove IOU for ${row.staffName}?`)) {
                          deleteMut.mutate(row.loanId);
                        }
                      }}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
          {staffWithIou.length === 0 && !isLoading && (
            <p className="px-4 py-3 text-sm text-muted border-t border-border">
              No IOUs yet — type an amount in a yellow cell, or click <strong>Add IOU</strong>.
            </p>
          )}
        </Card>
      </div>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add IOU">
        <form onSubmit={onAdd} className="space-y-4">
          <Select
            label="Staff"
            value={form.employee}
            onChange={(e) => setForm((f) => ({ ...f, employee: e.target.value }))}
            required
          >
            <option value="">Select staff…</option>
            {employeesWithoutActive.map((e) => (
              <option key={e._id} value={e._id}>
                {e.fullName} ({e.employeeId})
              </option>
            ))}
          </Select>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="IOU Amount"
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
            />
            <Select
              label="Start Week"
              value={form.startWeek}
              onChange={(e) => setForm((f) => ({ ...f, startWeek: Number(e.target.value) }))}
            >
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>Week {String(w).padStart(2, '0')}</option>
              ))}
            </Select>
            <Input
              label="Date Loaned"
              type="date"
              value={form.date}
              onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
            />
          </div>
          <Textarea
            label="Purpose / Notes"
            rows={3}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createMut.isPending}>
              {createMut.isPending ? 'Saving…' : 'Add IOU'}
            </Button>
          </div>
        </form>
      </Modal>
    </AppLayout>
  );
}

function SummaryPill({ label, value, tone = 'slate' }) {
  const tones = {
    slate: 'bg-slate-50 border-slate-200',
    emerald: 'bg-emerald-50 border-emerald-200',
    amber: 'bg-amber-50 border-amber-200',
    sky: 'bg-sky-50 border-sky-200',
  };
  return (
    <div className={`rounded-[14px] border px-4 py-3 ${tones[tone]}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted">{label}</p>
      <p className="font-heading text-lg mt-0.5">{value}</p>
    </div>
  );
}

function FragmentHeaders({ highlight }) {
  return (
    <>
      <th className={`px-1 py-1 text-center font-medium ${highlight ? 'bg-sky-600' : ''}`}>
        Payment
      </th>
      <th className={`px-1 py-1 text-center font-medium ${highlight ? 'bg-sky-600' : ''}`}>
        Balance
      </th>
    </>
  );
}

function TrackerRow({ row, viewWeek, saving, saved, onAutosaveFields, onAutosaveWeek, onDelete }) {
  const hasLoan = Boolean(row.loanId);
  const focusedRef = useRef(false);
  const draftRef = useRef(null);

  const [startWeek, setStartWeek] = useState(row.startWeek || 1);
  const [amount, setAmount] = useState(row.iouAmount || '');
  const [date, setDate] = useState(toDateInput(row.dateLoaned));
  const [purpose, setPurpose] = useState(row.purpose || '');
  const [payments, setPayments] = useState(() =>
    Object.fromEntries((row.weeks || []).map((w) => [w.week, w.payment || '']))
  );

  const getDraft = () => ({
    startWeek,
    amount,
    date,
    purpose,
    payments,
  });

  draftRef.current = getDraft();

  // Sync from server only when not editing this row
  useEffect(() => {
    if (focusedRef.current || saving) return;
    setStartWeek(row.startWeek || 1);
    setAmount(row.iouAmount || '');
    setDate(toDateInput(row.dateLoaned));
    setPurpose(row.purpose || '');
    setPayments(Object.fromEntries((row.weeks || []).map((w) => [w.week, w.payment || ''])));
  }, [row, saving]);

  const fieldsEqualServer = () => {
    const amt = Number(amount) || 0;
    const sw = Number(startWeek) || 1;
    return (
      amt === Number(row.iouAmount || 0) &&
      sw === Number(row.startWeek || 1) &&
      (date || '') === toDateInput(row.dateLoaned) &&
      (purpose || '') === (row.purpose || '')
    );
  };

  const pendingWeeksRef = useRef({});

  const scheduleFieldSave = useDebouncedCallback(() => {
    if (fieldsEqualServer() && hasLoan) return;
    // Creating new IOU requires a positive amount
    if (!hasLoan && !(Number(amount) > 0) && !(Number(draftRef.current.amount) > 0)) return;
    onAutosaveFields(draftRef.current);
  }, SAVE_DELAY_MS);

  const flushWeekSaves = useDebouncedCallback(async () => {
    const pending = { ...pendingWeeksRef.current };
    pendingWeeksRef.current = {};
    const weeks = Object.keys(pending).map(Number).sort((a, b) => a - b);
    if (!weeks.length) return;

    if (!hasLoan) {
      if (!(Number(draftRef.current.amount) > 0)) return;
      await onAutosaveWeek(weeks[0], Number(pending[weeks[0]]) || 0, {
        ...draftRef.current,
        payments: { ...draftRef.current.payments, ...pending },
      });
      return;
    }

    for (const week of weeks) {
      const v = Number(pending[week]) || 0;
      const prev = Number(row.weeks?.find((x) => x.week === week)?.payment) || 0;
      if (v !== prev) await onAutosaveWeek(week, v, draftRef.current);
    }
  }, SAVE_DELAY_MS);

  const queueWeekSave = (week, rawValue) => {
    pendingWeeksRef.current[week] = rawValue;
    flushWeekSaves();
  };

  const localWeeks = useMemo(() => {
    let running = Number(amount) || 0;
    return [1, 2, 3, 4, 5].map((w) => {
      const pay = Number(payments[w]) || 0;
      running = Math.max(0, Math.round((running - pay) * 100) / 100);
      return { week: w, payment: pay, balance: running };
    });
  }, [amount, payments]);

  const totalRepaid = localWeeks.reduce((s, w) => s + w.payment, 0);
  const finalBal = localWeeks[4]?.balance ?? 0;
  const status =
    !(hasLoan || Number(amount) > 0)
      ? 'No IOU'
      : finalBal <= 0 && Number(amount) > 0
        ? 'Paid'
        : Number(amount) > 0
          ? 'Outstanding'
          : 'No IOU';

  const onFocus = () => {
    focusedRef.current = true;
  };
  const onBlurRow = () => {
    focusedRef.current = false;
  };

  return (
    <tr
      className={`border-b border-border/50 ${
        status === 'No IOU' ? 'bg-slate-50/80' : 'hover:bg-slate-50/40'
      }`}
      onFocusCapture={onFocus}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) onBlurRow();
      }}
    >
      <td className="px-2 py-1.5 font-medium whitespace-nowrap">{row.staffName}</td>
      <td className="px-1 py-1 bg-amber-50/70">
        <input
          type="number"
          min={1}
          max={5}
          className={yellowInput}
          value={startWeek}
          onChange={(e) => {
            setStartWeek(e.target.value);
            scheduleFieldSave();
          }}
          onBlur={(e) => {
            setStartWeek(e.target.value);
            scheduleFieldSave.flush();
          }}
        />
      </td>
      <td className="px-1 py-1 bg-amber-50/70">
        <input
          type="number"
          min={0}
          step="0.01"
          className={yellowInput}
          value={amount}
          placeholder="0"
          onChange={(e) => {
            setAmount(e.target.value);
            scheduleFieldSave();
          }}
          onBlur={(e) => {
            setAmount(e.target.value);
            scheduleFieldSave.flush();
          }}
        />
      </td>
      {localWeeks.map((w) => (
        <FragmentWeek
          key={w.week}
          w={w}
          highlight={viewWeek === w.week}
          paymentValue={payments[w.week] ?? ''}
          onPaymentChange={(val) => {
            setPayments((p) => ({ ...p, [w.week]: val }));
            queueWeekSave(w.week, val);
          }}
          onPaymentBlur={(val) => {
            setPayments((p) => ({ ...p, [w.week]: val }));
            pendingWeeksRef.current[w.week] = val;
            flushWeekSaves.flush();
          }}
        />
      ))}
      <td className="px-2 py-1.5 text-right font-semibold bg-slate-100/80">
        {Number(amount) > 0 || hasLoan ? formatMoney(totalRepaid) : '—'}
      </td>
      <td className="px-1 py-1 bg-amber-50/70">
        <input
          type="date"
          className={yellowInputLeft}
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            scheduleFieldSave();
          }}
          onBlur={(e) => {
            setDate(e.target.value);
            scheduleFieldSave.flush();
          }}
        />
      </td>
      <td className="px-1 py-1 bg-amber-50/70">
        <input
          type="text"
          className={yellowInputLeft}
          value={purpose}
          placeholder="Notes…"
          onChange={(e) => {
            setPurpose(e.target.value);
            scheduleFieldSave();
          }}
          onBlur={(e) => {
            setPurpose(e.target.value);
            scheduleFieldSave.flush();
          }}
        />
      </td>
      <td className="px-2 py-1.5 whitespace-nowrap">
        <span
          className={
            status === 'Outstanding'
              ? 'font-semibold text-orange-600'
              : status === 'Paid'
                ? 'font-semibold text-emerald-600'
                : 'text-slate-400'
          }
        >
          {status}
        </span>
      </td>
      <td className="px-1 py-1">
        <div className="flex items-center gap-0.5">
          {saving && <Loader2 size={14} className="animate-spin text-sky-600" />}
          {!saving && saved && <Check size={14} className="text-emerald-600" />}
          {hasLoan && (
            <button
              type="button"
              title="Remove IOU"
              onClick={onDelete}
              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

function FragmentWeek({ w, highlight, paymentValue, onPaymentChange, onPaymentBlur }) {
  return (
    <>
      <td className={`px-1 py-1 ${highlight ? 'bg-sky-50' : 'bg-amber-50/50'}`}>
        <input
          type="number"
          min={0}
          step="0.01"
          className={yellowInput}
          value={paymentValue}
          onChange={(e) => onPaymentChange(e.target.value)}
          onBlur={(e) => onPaymentBlur(e.target.value)}
          placeholder="0"
        />
      </td>
      <td
        className={`px-2 py-1.5 text-right font-medium ${
          highlight ? 'bg-sky-100/80' : 'bg-slate-100'
        }`}
      >
        {formatMoney(w.balance)}
      </td>
    </>
  );
}
