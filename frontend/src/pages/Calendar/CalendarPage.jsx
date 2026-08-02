import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { calendarApi } from '@/services';
import { MONTHS, cn, yearOptions } from '@/utils/helpers';

const TYPE_STYLE = {
  payday: 'bg-emerald-500 text-white',
  payroll_processing: 'bg-sky-500 text-white',
  holiday: 'bg-rose-500 text-white',
  other: 'bg-violet-500 text-white',
};

const TYPE_DOT = {
  payday: 'bg-emerald-500',
  payroll_processing: 'bg-sky-500',
  holiday: 'bg-rose-500',
  other: 'bg-violet-500',
};

export default function CalendarPage() {
  const now = new Date();
  const qc = useQueryClient();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [filters, setFilters] = useState({
    payday: true,
    payroll_processing: true,
    holiday: true,
    other: true,
  });
  const [form, setForm] = useState({
    date: '',
    title: '',
    type: 'holiday',
    notes: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['calendar-month', year, month],
    queryFn: () => calendarApi.month({ year, month }),
  });

  const createMut = useMutation({
    mutationFn: () => calendarApi.create(form),
    onSuccess: () => {
      toast.success('Event added');
      setForm({ date: '', title: '', type: 'holiday', notes: '' });
      qc.invalidateQueries({ queryKey: ['calendar-month'] });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  });

  const delMut = useMutation({
    mutationFn: (id) => calendarApi.remove(id),
    onSuccess: () => {
      toast.success('Removed');
      qc.invalidateQueries({ queryKey: ['calendar-month'] });
    },
  });

  const goToday = () => {
    const t = new Date();
    setYear(t.getFullYear());
    setMonth(t.getMonth() + 1);
  };

  const shiftMonth = (delta) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const shiftYear = (delta) => {
    setYear((y) => y + delta);
  };

  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
  const todayDay = isCurrentMonth ? now.getDate() : null;

  const byDate = useMemo(() => {
    const map = new Map();
    const keyOf = (d) => {
      const x = new Date(d);
      return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    };
    const add = (item) => {
      const type = item.type || 'other';
      if (filters[type] === false) return;
      const key = keyOf(item.date);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(item);
    };
    (data?.computed || []).forEach(add);
    (data?.events || []).forEach(add);
    return map;
  }, [data, filters]);

  const first = new Date(year, month - 1, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const pickDay = (day) => {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setForm((f) => ({ ...f, date, title: f.title || 'Holiday' }));
  };

  const toggleFilter = (key) => {
    setFilters((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <AppLayout title="Payroll Calendar">
      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading">Payroll & Holiday Calendar</h3>
              <p className="text-sm text-muted mt-1">
                Paydays and processing days are auto-generated. Add custom holidays on the right.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 items-end">
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
              <Button type="button" variant="outline" onClick={goToday} disabled={isCurrentMonth}>
                Today
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { key: 'payday', label: 'Payday' },
              { key: 'payroll_processing', label: 'Payroll Processing' },
              { key: 'holiday', label: 'Holiday' },
              { key: 'other', label: 'Other' },
            ].map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => toggleFilter(key)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1 border transition cursor-pointer',
                  filters[key]
                    ? 'bg-white border-border text-slate-800'
                    : 'bg-slate-100 border-transparent text-muted opacity-60'
                )}
              >
                <span className={cn('h-2.5 w-2.5 rounded-full', TYPE_DOT[key])} />
                {label}
              </button>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 overflow-hidden p-0">
            {/* Month navigation toolbar */}
            <div className="flex items-center justify-between gap-2 px-3 py-3 border-b bg-white">
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!px-2"
                  onClick={() => shiftYear(-1)}
                  title="Previous year"
                >
                  <ChevronsLeft size={16} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!px-2"
                  onClick={() => shiftMonth(-1)}
                  title="Previous month"
                >
                  <ChevronLeft size={18} />
                </Button>
              </div>

              <div className="text-center min-w-0">
                <div className="font-heading text-base sm:text-lg text-slate-900">
                  {MONTHS[month - 1]} {year}
                </div>
                <div className="text-[11px] text-muted">
                  Click a day to add an event · Use arrows to change month
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!px-2"
                  onClick={() => shiftMonth(1)}
                  title="Next month"
                >
                  <ChevronRight size={18} />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="!px-2"
                  onClick={() => shiftYear(1)}
                  title="Next year"
                >
                  <ChevronsRight size={16} />
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 py-2 border-b bg-slate-50/80 lg:hidden">
              <Button type="button" size="sm" variant="outline" onClick={goToday} disabled={isCurrentMonth}>
                Today
              </Button>
            </div>

            <div className="grid grid-cols-7 bg-slate-100 text-xs font-medium text-center border-b">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d} className="py-2">{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 auto-rows-fr min-h-[420px]">
              {isLoading && (
                <div className="col-span-7 p-6 text-muted text-sm">Loading…</div>
              )}
              {!isLoading &&
                cells.map((day, idx) => {
                  if (day == null) {
                    return <div key={`e-${idx}`} className="border-b border-r border-border/40 bg-slate-50/40 min-h-[72px]" />;
                  }
                  const key = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const items = byDate.get(key) || [];
                  const isToday = todayDay === day;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => pickDay(day)}
                      className={cn(
                        'border-b border-r border-border/40 p-1.5 min-h-[72px] text-left hover:bg-sky-50/60 transition cursor-pointer',
                        isToday && 'bg-sky-50 ring-2 ring-inset ring-sky-400'
                      )}
                    >
                      <div
                        className={cn(
                          'text-xs font-medium mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full',
                          isToday ? 'bg-sky-600 text-white' : 'text-slate-700'
                        )}
                      >
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {items.map((it, i) => (
                          <div
                            key={`${it.type}-${i}-${it.title}`}
                            className={cn(
                              'rounded px-1 py-0.5 text-[10px] leading-tight truncate',
                              TYPE_STYLE[it.type] || TYPE_STYLE.other
                            )}
                            title={it.title}
                          >
                            {it.title}
                          </div>
                        ))}
                      </div>
                    </button>
                  );
                })}
            </div>
          </Card>

          <div className="space-y-4">
            <Card className="space-y-3">
              <h4 className="font-heading">Add holiday / event</h4>
              <Input label="Date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              <Input label="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="holiday">Holiday</option>
                <option value="payroll_processing">Payroll Processing</option>
                <option value="payday">Payday</option>
                <option value="other">Other</option>
              </Select>
              <Input label="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button
                type="button"
                onClick={() => createMut.mutate()}
                disabled={!form.date || !form.title || createMut.isPending}
              >
                Add to Calendar
              </Button>
            </Card>

            <Card className="space-y-2">
              <h4 className="font-heading text-sm">Custom events this month</h4>
              {(data?.events || []).length === 0 && (
                <p className="text-xs text-muted">No custom events. Paydays and processing days are auto-generated.</p>
              )}
              {(data?.events || []).map((e) => (
                <div key={e._id} className="flex items-start justify-between gap-2 text-xs border-b border-border/40 py-2">
                  <div>
                    <div className="font-medium">{e.title}</div>
                    <div className="text-muted">
                      {new Date(e.date).toLocaleDateString('en-GB')} · {e.type}
                    </div>
                  </div>
                  <Button type="button" variant="ghost" onClick={() => delMut.mutate(e._id)}>Delete</Button>
                </div>
              ))}
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
