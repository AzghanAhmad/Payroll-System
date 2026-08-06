import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { timesheetApi, settingsApi, payrollApi, opsApi, calendarApi } from '@/services';
import { WEEK_DAYS, MONTHS, formatNumber, formatMoney, yearOptions } from '@/utils/helpers';
import {
  getWeekPeriod,
  formatShortDate,
  getDayDate,
  calcWeekCosting,
} from '@/utils/weekPeriod';

const FIELD_ROWS = [
  { key: 'clockIn', label: 'In', type: 'time', tone: 'yellow' },
  { key: 'clockOut', label: 'Out', type: 'time', tone: 'yellow' },
  { key: 'breakHours', label: 'Break', type: 'number', tone: 'orange' },
  { key: 'workingHours', label: 'Total', type: 'display', tone: 'calc' },
];

const TONE = {
  yellow: {
    row: 'bg-amber-50',
    label: 'bg-amber-100 text-amber-900 border-amber-200',
    input: 'bg-amber-50 border-amber-300 focus:border-amber-500 focus:ring-amber-200',
    cell: 'bg-amber-50/80',
  },
  orange: {
    row: 'bg-orange-50',
    label: 'bg-orange-100 text-orange-900 border-orange-200',
    input: 'bg-orange-50 border-orange-300 focus:border-orange-500 focus:ring-orange-200',
    cell: 'bg-orange-50/80',
  },
  calc: {
    row: 'bg-emerald-50',
    label: 'bg-sky-100 text-sky-900 border-sky-200',
    cell: 'bg-emerald-50/80',
    value: 'text-emerald-700',
  },
};

const EMP_W = 150;
const FIELD_W = 56;

export default function TimesheetsPage() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [week, setWeek] = useState(1);
  const [monthSynced, setMonthSynced] = useState(false);
  const qc = useQueryClient();

  // Align with Month Control / settings payroll month once loaded
  useEffect(() => {
    if (monthSynced || !settings) return;
    if (settings.currentPayrollYear && settings.currentPayrollMonth) {
      setYear(settings.currentPayrollYear);
      setMonth(settings.currentPayrollMonth);
    }
    setMonthSynced(true);
  }, [settings, monthSynced]);
  const { data: timesheet, isLoading } = useQuery({
    queryKey: ['timesheet', year, month],
    queryFn: () => timesheetApi.getMonth(year, month),
  });

  const [localWeeks, setLocalWeeks] = useState([]);
  const [attendanceFile, setAttendanceFile] = useState(null);
  const timesheetDirty = useRef(false);
  const pendingSave = useRef(false);
  const localWeeksRef = useRef([]);

  useEffect(() => {
    localWeeksRef.current = localWeeks;
  }, [localWeeks]);

  useEffect(() => {
    if (!timesheet?.weeks) return;
    // Always take server weeks when clean; when dirty, merge any newly added employees
    setLocalWeeks((prev) => {
      const server = JSON.parse(JSON.stringify(timesheet.weeks));
      if (!timesheetDirty.current || !prev?.length) {
        timesheetDirty.current = false;
        return server;
      }
      return server.map((sw) => {
        const lw = prev.find((w) => Number(w.weekNumber) === Number(sw.weekNumber));
        if (!lw) return sw;
        const localByEmp = new Map(
          (lw.entries || []).map((e) => [String(e.employee?._id || e.employee), e])
        );
        const mergedEntries = (sw.entries || []).map((se) => {
          const id = String(se.employee?._id || se.employee);
          const local = localByEmp.get(id);
          if (!local) return se; // brand-new employee from server
          return {
            ...local,
            employee: se.employee || local.employee, // keep populated employee for costing names/rates
          };
        });
        return { ...sw, entries: mergedEntries };
      });
    });
  }, [timesheet]);

  const attendanceMut = useMutation({
    mutationFn: () => opsApi.importAttendance(attendanceFile),
    onSuccess: (res) => {
      const months = (res.monthsTouched || []).join(', ');
      toast.success(
        `${res.message || 'Attendance imported'}${months ? ` → month(s): ${months}` : ''}`
      );
      if (res.errors?.length) {
        toast.error(
          `${res.errors.length} row(s) skipped — check names match employees (first name is OK)`
        );
      }
      if (months) {
        // Jump timesheet view to the first imported month so data is visible
        const [y, m] = String(months.split(',')[0]).trim().split('-').map(Number);
        if (y && m) {
          setYear(y);
          setMonth(m);
        }
      }
      setAttendanceFile(null);
      qc.invalidateQueries({ queryKey: ['timesheet'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Import failed'),
  });

  const saveMutation = useMutation({
    mutationFn: (weeks) => timesheetApi.update(timesheet._id, { weeks }),
    onSuccess: (data) => {
      // Only clear dirty if nothing new was typed during the request
      if (!pendingSave.current) timesheetDirty.current = false;
      // Update cache without a full refetch (avoids racing another autosave)
      if (data?._id) {
        qc.setQueryData(['timesheet', year, month], data);
      }
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Autosave failed';
      // Soft conflict — schedule another save; don't dump the raw Mongo message
      if (err.response?.status === 409 || /version|matching document/i.test(msg)) {
        timesheetDirty.current = true;
        pendingSave.current = true;
        return;
      }
      toast.error(msg.length > 120 ? 'Could not save timesheet — try again' : msg);
    },
    onSettled: () => {
      if (pendingSave.current && timesheetDirty.current) {
        pendingSave.current = false;
        // Flush latest localWeeks after in-flight save finishes
        setTimeout(() => {
          if (timesheetDirty.current && timesheet?._id) {
            saveMutation.mutate(localWeeksRef.current);
          }
        }, 200);
      } else {
        pendingSave.current = false;
      }
    },
  });

  // Autosave timesheet edits without pressing Save
  useEffect(() => {
    if (!timesheet?._id || !timesheetDirty.current) return undefined;
    const t = setTimeout(() => {
      if (!timesheetDirty.current) return;
      if (saveMutation.isPending) {
        pendingSave.current = true;
        return;
      }
      saveMutation.mutate(localWeeksRef.current);
    }, 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWeeks, timesheet?._id]);

  const generateMut = useMutation({
    mutationFn: () => payrollApi.generateWeekly({ year, month, week }),
    onSuccess: () => {
      toast.success(`Week ${week} payslips generated`);
      qc.invalidateQueries({ queryKey: ['payslips'] });
      qc.invalidateQueries({ queryKey: ['payrolls'] });
      qc.invalidateQueries({ queryKey: ['payroll-summary'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Generate failed'),
  });

  const currentWeek = useMemo(
    () => localWeeks.find((w) => Number(w.weekNumber) === Number(week)),
    [localWeeks, week]
  );
  const period = getWeekPeriod(year, month, week);

  const { data: calendarEvents } = useQuery({
    queryKey: ['calendar', year, month],
    queryFn: () => calendarApi.list({ year, month }),
  });

  const holidayDates = useMemo(() => {
    const set = new Set();
    (calendarEvents || []).forEach((ev) => {
      if (ev.type !== 'holiday' || !ev.date) return;
      const d = new Date(ev.date);
      set.add(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
    });
    return set;
  }, [calendarEvents]);

  const isHolidayDay = (weekNumber, dayKey) => {
    const dayIndex = WEEK_DAYS.findIndex((d) => d.key === dayKey);
    if (dayIndex < 0) return false;
    const dt = getDayDate(year, month, weekNumber, dayIndex);
    if (!dt) return false;
    return holidayDates.has(`${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`);
  };

  const updateDayField = (entryIdx, dayKey, field, value) => {
    if (isHolidayDay(week, dayKey)) {
      toast.error('This day is a holiday — hours cannot be entered');
      return;
    }
    timesheetDirty.current = true;
    setLocalWeeks((prev) => {
      const next = structuredClone(prev);
      const w = next.find((x) => x.weekNumber === week);
      if (!w) return prev;
      const entry = w.entries[entryIdx];
      if (!entry.days[dayKey]) entry.days[dayKey] = {};
      const d = entry.days[dayKey];

      if (field === 'breakHours') {
        d.breakHours = value;
        d.breakManual = true;
      } else {
        d[field] = value;
      }

      const parse = (t) => {
        if (!t || !String(t).includes(':')) return null;
        const [h, m] = String(t).split(':').map(Number);
        return h + m / 60;
      };
      const inH = parse(d.clockIn);
      const outH = parse(d.clockOut);
      // Auto 30‑min break when both clocks set (not Saturday) and break not manually set
      if (inH != null && outH != null && !d.breakManual) {
        d.breakHours = dayKey === 'saturday' ? 0 : 0.5;
      }
      if (inH != null && outH != null) {
        let hours = outH - inH - (Number(d.breakHours) || 0);
        if (hours < 0) hours += 24;
        d.workingHours = Math.round(Math.max(0, hours) * 100) / 100;
        d.dailyCost = Math.round(d.workingHours * (entry.employee?.hourlyRate || 0) * 100) / 100;
      } else if (['clockIn', 'clockOut', 'breakHours'].includes(field)) {
        if (!d.clockIn || !d.clockOut) {
          d.workingHours = 0;
          d.dailyCost = 0;
        }
      }
      entry.weeklyHours = WEEK_DAYS.reduce((s, day) => s + (entry.days[day.key]?.workingHours || 0), 0);
      entry.weeklyCost = WEEK_DAYS.reduce((s, day) => s + (entry.days[day.key]?.dailyCost || 0), 0);
      return next;
    });
  };

  const updateNotes = (entryIdx, notes) => {
    timesheetDirty.current = true;
    setLocalWeeks((prev) => {
      const next = structuredClone(prev);
      const w = next.find((x) => x.weekNumber === week);
      if (!w?.entries[entryIdx]) return prev;
      w.entries[entryIdx].weeklyNotes = notes;
      return next;
    });
  };

  const costingRows = useMemo(() => {
    return (currentWeek?.entries || []).map((entry) => ({
      entry,
      cost: calcWeekCosting(entry, settings || {}),
    }));
  }, [currentWeek, settings]);

  const weekTotals = useMemo(() => {
    const t = {
      totalHours: 0,
      normalHours: 0,
      otHours: 0,
      doubleHours: 0,
      grossPay: 0,
      employerNpf: 0,
      employerAcc: 0,
      employerCost: 0,
    };
    for (const { cost } of costingRows) {
      t.totalHours += cost.totalHours;
      t.normalHours += cost.normalHours;
      t.otHours += cost.otHours;
      t.doubleHours += cost.doubleHours;
      t.grossPay += cost.grossPay;
      t.employerNpf += cost.employerNpf;
      t.employerAcc += cost.employerAcc;
      t.employerCost += cost.employerCost;
    }
    Object.keys(t).forEach((k) => {
      t[k] = Math.round(t[k] * 100) / 100;
    });
    return t;
  }, [costingRows]);

  return (
    <AppLayout title="Timesheets">
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
            <Select label="Week" value={week} onChange={(e) => setWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map((w) => (
                <option key={w} value={w}>Week {w}</option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <div className="text-sm text-muted mr-2">
              <span className="font-heading text-slate-800">Week {week} Worklog & Costing</span>
              <div>
                Period: {formatShortDate(period.start)} – {formatShortDate(period.end)} · {MONTHS[month - 1]}-{year}
              </div>
            </div>
            <span className="text-xs text-muted px-2 py-1 rounded-lg bg-slate-50 border border-border">
              {saveMutation.isPending ? 'Saving…' : 'Autosaves as you type'}
            </span>
            <Button
              type="button"
              onClick={async () => {
                if (timesheetDirty.current) await saveMutation.mutateAsync(localWeeksRef.current);
                generateMut.mutate();
              }}
              disabled={!timesheet || generateMut.isPending}
            >
              {generateMut.isPending ? 'Generating…' : 'Save All Payslips'}
            </Button>
          </div>
        </Card>

        <Card className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h3 className="font-heading text-sm">Attendance / Timesheet Upload</h3>
            <p className="text-xs text-muted mt-1 max-w-xl">
              Upload the client payroll workbook (.xlsm) — we read the <strong>Timesheets</strong> sheet
              (In, Out, Break per day) — or a biometric export (AC-No., Name, Date, Clock In/Out). Staff
              are matched by <strong>name</strong>. After import, the view switches to the month in the
              file.
            </p>
          </div>
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-slate-700">Attendance file</span>
            <div className="flex flex-wrap items-center gap-2">
              <FileUpload
                label=""
                hint=""
                accept=".xlsx,.xls,.xlsm,.csv"
                value={attendanceFile}
                onChange={setAttendanceFile}
                className="min-w-0"
              />
              <Button
                type="button"
                onClick={() => attendanceMut.mutate()}
                disabled={!attendanceFile || attendanceMut.isPending}
              >
                {attendanceMut.isPending ? 'Importing…' : 'Import & Mark Attendance'}
              </Button>
            </div>
            <p className="text-xs text-muted">Payroll .xlsm Timesheets sheet, or biometric .xlsx / .xls / .csv</p>
          </div>
        </Card>

        <div className="flex flex-wrap gap-2 text-xs">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 text-amber-900 px-3 py-1 border border-amber-200">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Yellow = enter times
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-100 text-orange-900 px-3 py-1 border border-orange-200">
            <span className="h-2.5 w-2.5 rounded-full bg-orange-400" /> Orange = break
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 text-sky-900 px-3 py-1 border border-sky-200">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-500" /> Blue
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 text-emerald-900 px-3 py-1 border border-emerald-200">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Green = calculated
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 text-violet-900 px-3 py-1 border border-violet-200">
            <span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> Purple = payroll costing
          </span>
        </div>

        <Card className="p-0">
          <div className="px-4 py-3 border-b border-border bg-slate-50 flex justify-between shrink-0 rounded-t-[18px]">
            <h3 className="font-heading text-sm">Week {week} Worklog</h3>
            <span className="text-xs text-muted">In / Out / Break / Total hours per day</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-0 min-w-[1100px]">
              <thead className="[&_th]:sticky [&_th]:top-0">
                <tr className="border-b border-border shadow-sm">
                  <th
                    className="px-2 py-2 text-left sticky top-0 left-0 z-40 bg-slate-100 border-r border-b border-border"
                    style={{ minWidth: EMP_W }}
                  >
                    Employee
                  </th>
                  <th
                    className="px-2 py-2 text-left sticky top-0 z-30 bg-slate-100 border-r border-b border-border"
                    style={{ left: EMP_W, minWidth: FIELD_W }}
                  >
                    Field
                  </th>
                  {WEEK_DAYS.map((d, i) => {
                    const hol = isHolidayDay(week, d.key);
                    return (
                      <th
                        key={d.key}
                        className={`px-1 py-2 text-center min-w-[96px] sticky top-0 z-20 border-b border-border ${hol ? 'bg-rose-100 text-rose-900' : 'bg-slate-100'}`}
                      >
                        <div>{d.label}{hol ? ' · Holiday' : ''}</div>
                        <div className="font-normal text-muted">{formatShortDate(getDayDate(year, month, week, i))}</div>
                      </th>
                    );
                  })}
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-sky-100 text-sky-900 border-b border-border">Week Hrs</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-border">Rate</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr><td className="px-4 py-6 text-muted" colSpan={11}>Loading…</td></tr>
                )}
                {(currentWeek?.entries || []).map((entry, idx) =>
                  FIELD_ROWS.map((field, fieldIdx) => {
                    const isFirst = fieldIdx === 0;
                    const isLast = fieldIdx === FIELD_ROWS.length - 1;
                    const tone = TONE[field.tone];
                    const inputClass = `w-full min-w-[84px] rounded-lg border px-1 py-1 text-center text-xs outline-none focus:ring-2 ${tone.input || ''}`;

                    return (
                      <tr
                        key={`${entry.employee?._id}-${field.key}`}
                        className={`${tone.row} ${isLast ? 'border-b-2 border-border' : 'border-b border-border/30'}`}
                      >
                        {isFirst && (
                          <td
                            rowSpan={FIELD_ROWS.length}
                            className="px-2 py-1 sticky z-[5] font-medium align-middle border-r bg-white"
                            style={{ left: 0, minWidth: EMP_W }}
                          >
                            <div className="whitespace-nowrap">{entry.employee?.fullName}</div>
                            <div className="text-muted font-normal">{entry.employee?.employeeId}</div>
                          </td>
                        )}
                        <td
                          className={`px-2 py-1 sticky z-[5] font-semibold align-middle border-r ${tone.label}`}
                          style={{ left: EMP_W, minWidth: FIELD_W }}
                        >
                          {field.label}
                        </td>
                        {WEEK_DAYS.map((d) => {
                          const day = entry.days?.[d.key] || {};
                          const hol = isHolidayDay(week, d.key);
                          return (
                            <td key={d.key} className={`px-0.5 py-0.5 ${hol ? 'bg-rose-50' : tone.cell}`}>
                              {field.type === 'time' && (
                                <input
                                  type="time"
                                  className={`${inputClass} ${hol ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  value={hol ? '' : (day[field.key] || '')}
                                  disabled={hol}
                                  title={hol ? 'Public holiday — hours locked' : undefined}
                                  onChange={(e) => updateDayField(idx, d.key, field.key, e.target.value)}
                                />
                              )}
                              {field.type === 'number' && (
                                <input
                                  type="number"
                                  step="0.25"
                                  min="0"
                                  className={`${inputClass} ${hol ? 'opacity-50 cursor-not-allowed' : ''}`}
                                  value={hol ? 0 : (day.breakHours ?? 0)}
                                  disabled={hol}
                                  title={hol ? 'Public holiday — hours locked' : undefined}
                                  onChange={(e) => updateDayField(idx, d.key, 'breakHours', Number(e.target.value))}
                                />
                              )}
                              {field.type === 'display' && (
                                <div className={`text-center font-semibold py-1.5 rounded-lg ${hol ? 'bg-rose-100 text-rose-800' : `bg-emerald-100/90 ${tone.value}`}`}>
                                  {hol ? '—' : formatNumber(day.workingHours || 0)}
                                </div>
                              )}
                            </td>
                          );
                        })}
                        {isFirst && (
                          <>
                            <td rowSpan={FIELD_ROWS.length} className="px-2 text-right font-semibold align-middle bg-sky-50 text-sky-800 border-l border-sky-100">
                              {formatNumber(entry.weeklyHours || 0)}
                            </td>
                            <td rowSpan={FIELD_ROWS.length} className="px-2 text-right align-middle bg-violet-50 text-violet-800 border-l border-violet-100">
                              {formatMoney(entry.employee?.hourlyRate || 0)}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-0 border-violet-200">
          <div className="px-4 py-3 border-b border-violet-200 bg-violet-100 flex items-center justify-between shrink-0 rounded-t-[18px]">
            <h3 className="font-heading text-sm text-violet-950">Hours Summary & Payroll Costing — Week {week}</h3>
            <span className="text-xs text-violet-700">Purple = payroll costing</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[1200px] border-separate border-spacing-0">
              <thead className="[&_th]:sticky [&_th]:top-0">
                <tr className="text-left shadow-sm">
                  <th className="px-3 py-2 sticky top-0 left-0 z-40 bg-violet-100 text-violet-900 border-b border-violet-200">Employee</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-sky-100 text-sky-900 border-b border-violet-200">Total Hrs</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-emerald-100 text-emerald-900 border-b border-violet-200">Normal</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-emerald-100 text-emerald-900 border-b border-violet-200">OT 1.5</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-emerald-100 text-emerald-900 border-b border-violet-200">Double</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Rate</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Normal Pay</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">OT Pay</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Double Pay</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-200 text-violet-950 border-b border-violet-200">Gross Pay</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Employer NPF</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Employer ACC</th>
                  <th className="px-2 py-2 text-right sticky top-0 z-20 bg-violet-200 text-violet-950 border-b border-violet-200">Employer Cost</th>
                  <th className="px-3 py-2 sticky top-0 z-20 bg-violet-100 text-violet-900 border-b border-violet-200">Notes</th>
                </tr>
              </thead>
              <tbody>
                {costingRows.map(({ entry, cost }, idx) => (
                  <tr key={entry.employee?._id || idx} className="border-b border-violet-100">
                    <td className="px-3 py-2 font-medium whitespace-nowrap bg-white">{entry.employee?.fullName}</td>
                    <td className="px-2 py-2 text-right bg-sky-50 text-sky-800">{formatNumber(cost.totalHours)}</td>
                    <td className="px-2 py-2 text-right bg-emerald-50 text-emerald-800">{formatNumber(cost.normalHours)}</td>
                    <td className="px-2 py-2 text-right bg-emerald-50 text-emerald-800">{formatNumber(cost.otHours)}</td>
                    <td className="px-2 py-2 text-right bg-emerald-50 text-emerald-800">{formatNumber(cost.doubleHours)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.hourlyRate)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.normalPay)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.otPay)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.doublePay)}</td>
                    <td className="px-2 py-2 text-right bg-violet-100 font-semibold text-violet-900">{formatMoney(cost.grossPay)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.employerNpf)}</td>
                    <td className="px-2 py-2 text-right bg-violet-50">{formatMoney(cost.employerAcc)}</td>
                    <td className="px-2 py-2 text-right bg-violet-100 font-semibold text-violet-900">{formatMoney(cost.employerCost)}</td>
                    <td className="px-3 py-2 min-w-[180px] bg-violet-50/50">
                      <input
                        type="text"
                        className="w-full rounded-lg border border-violet-200 bg-white px-2 py-1 text-xs focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none"
                        placeholder="Notes…"
                        value={entry.weeklyNotes || ''}
                        onChange={(e) => updateNotes(idx, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
                <tr className="bg-violet-200 font-semibold text-violet-950">
                  <td className="px-3 py-3">WEEK {week} TOTAL</td>
                  <td className="px-2 py-3 text-right bg-sky-100">{formatNumber(weekTotals.totalHours)}</td>
                  <td className="px-2 py-3 text-right bg-emerald-100">{formatNumber(weekTotals.normalHours)}</td>
                  <td className="px-2 py-3 text-right bg-emerald-100">{formatNumber(weekTotals.otHours)}</td>
                  <td className="px-2 py-3 text-right bg-emerald-100">{formatNumber(weekTotals.doubleHours)}</td>
                  <td className="px-2 py-3" />
                  <td className="px-2 py-3" colSpan={3} />
                  <td className="px-2 py-3 text-right">{formatMoney(weekTotals.grossPay)}</td>
                  <td className="px-2 py-3 text-right">{formatMoney(weekTotals.employerNpf)}</td>
                  <td className="px-2 py-3 text-right">{formatMoney(weekTotals.employerAcc)}</td>
                  <td className="px-2 py-3 text-right">{formatMoney(weekTotals.employerCost)}</td>
                  <td className="px-3 py-3" />
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppLayout>
  );
}
