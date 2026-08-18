import { useMemo, useState, Fragment, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import AppLayout from '@/layouts/AppLayout';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Input';
import { employeeApi, timesheetApi, settingsApi } from '@/services';
import { formatMoney, formatNumber, MONTHS, WEEK_DAYS, yearOptions } from '@/utils/helpers';
import { splitWeekHours } from '@/utils/weekPeriod';

export default function StaffInfoPage() {
  const now = new Date();
  const [searchParams] = useSearchParams();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [tab, setTab] = useState(searchParams.get('tab') || 'info'); // info | hours | settings
  const employeeSearch = (searchParams.get('search') || '').trim().toLowerCase();

  useEffect(() => {
    setTab(searchParams.get('tab') || 'info');
  }, [searchParams]);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: settingsApi.get });
  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees-staff'],
    queryFn: () => employeeApi.list({ limit: 200, sort: 'employeeId', order: 'asc' }),
  });
  const { data: timesheet } = useQuery({
    queryKey: ['timesheet', year, month],
    queryFn: () => timesheetApi.getMonth(year, month),
  });

  const employees = employeesData?.items || [];
  const filteredEmployees = useMemo(() => {
    if (!employeeSearch) return employees;
    return employees.filter(
      (e) =>
        String(e.fullName || '').toLowerCase().includes(employeeSearch) ||
        String(e.employeeId || '').toLowerCase().includes(employeeSearch)
    );
  }, [employees, employeeSearch]);
  const cap = settings?.normalHoursCap ?? 40;

  const hoursByEmployee = useMemo(() => {
    const map = {};
    for (const emp of employees) {
      map[emp._id] = {
        1: { normal: 0, ot: 0, double: 0 },
        2: { normal: 0, ot: 0, double: 0 },
        3: { normal: 0, ot: 0, double: 0 },
        4: { normal: 0, ot: 0, double: 0 },
        5: { normal: 0, ot: 0, double: 0 },
      };
    }
    for (const week of timesheet?.weeks || []) {
      for (const entry of week.entries || []) {
        const id = entry.employee?._id || entry.employee;
        if (!map[id]) continue;
        let doubleHours = 0;
        for (const day of WEEK_DAYS) {
          const d = entry.days?.[day.key];
          if (!d) continue;
          const rule = settings?.doubleTimeRule || 'sunday';
          const isDouble =
            rule === 'none'
              ? false
              : rule === 'sunday'
                ? day.key === 'sunday'
                : Boolean(d.isDoubleTime);
          if (isDouble) {
            doubleHours += d.workingHours || 0;
          }
        }
        const split = splitWeekHours(entry.weeklyHours || 0, doubleHours, cap);
        map[id][week.weekNumber] = {
          normal: split.normalHours,
          ot: split.otHours,
          double: split.doubleHours,
        };
      }
    }
    return map;
  }, [employees, timesheet, settings, cap]);

  return (
    <AppLayout title="Staff Information">
      <div className="space-y-4">
        <Card className="flex flex-wrap items-end gap-3 justify-between">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={tab === 'info' ? 'primary' : 'outline'} onClick={() => setTab('info')}>
              A) Information
            </Button>
            <Button type="button" variant={tab === 'hours' ? 'primary' : 'outline'} onClick={() => setTab('hours')}>
              B) Working Hours
            </Button>
            <Button type="button" variant={tab === 'settings' ? 'primary' : 'outline'} onClick={() => setTab('settings')}>
              C) Payroll Settings
            </Button>
          </div>
          {tab === 'hours' && (
            <div className="flex gap-3">
              <Select label="Year" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {yearOptions(year).map((y) => <option key={y} value={y}>{y}</option>)}
              </Select>
              <Select label="Month" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </Select>
            </div>
          )}
        </Card>

        {tab === 'info' && (
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[1100px]">
                <thead className="bg-slate-50 sticky top-0 border-b">
                  <tr className="text-left text-muted">
                    <th className="px-3 py-3">ID</th>
                    <th className="px-3 py-3">Staff</th>
                    <th className="px-3 py-3 text-right">Rate</th>
                    <th className="px-3 py-3">Bank</th>
                    <th className="px-3 py-3">Account no.</th>
                    <th className="px-3 py-3">NPF no.</th>
                    <th className="px-3 py-3">DOB</th>
                    <th className="px-3 py-3">Village</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Hire Date</th>
                    <th className="px-3 py-3">Position</th>
                    <th className="px-3 py-3">Department</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr><td className="px-4 py-6" colSpan={13}>Loading…</td></tr>}
                  {filteredEmployees.map((e) => (
                    <tr key={e._id} className="border-b border-border/50 hover:bg-slate-50/70">
                      <td className="px-3 py-2 whitespace-nowrap">{e.employeeId}</td>
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{e.fullName}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(e.hourlyRate)}</td>
                      <td className="px-3 py-2">{e.bank || '—'}</td>
                      <td className="px-3 py-2">{e.accountNumber || '—'}</td>
                      <td className="px-3 py-2">{e.npfNumber || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.dob ? new Date(e.dob).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{e.village || '—'}</td>
                      <td className="px-3 py-2">{e.phone || '—'}</td>
                      <td className="px-3 py-2">{e.email || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap">{e.hireDate ? new Date(e.hireDate).toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2">{e.position || '—'}</td>
                      <td className="px-3 py-2">{e.department?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4 border-t border-border">
              <Link to="/employees"><Button type="button" variant="outline">Edit staff in Employees</Button></Link>
            </div>
          </Card>
        )}

        {tab === 'hours' && (
          <Card className="overflow-hidden p-0">
            <div className="px-4 py-3 border-b bg-slate-50 text-sm text-muted">
              Working hours by week for {MONTHS[month - 1]} {year} (from Timesheets)
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[1400px]">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left" rowSpan={2}>Staff</th>
                    {[1, 2, 3, 4, 5].map((w) => (
                      <th key={w} className="px-2 py-2 text-center border-l border-border" colSpan={3}>
                        WEEK {w}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-muted">
                    {[1, 2, 3, 4, 5].map((w) => (
                      <Fragment key={`h-${w}`}>
                        <th className="px-2 py-1 text-right border-l border-border font-normal">Normal</th>
                        <th className="px-2 py-1 text-right font-normal">OT</th>
                        <th className="px-2 py-1 text-right font-normal">Double</th>
                      </Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map((e) => {
                    const h = hoursByEmployee[e._id] || {};
                    return (
                      <tr key={e._id} className="border-b border-border/50">
                        <td className="px-3 py-2 font-medium whitespace-nowrap">{e.fullName}</td>
                        {[1, 2, 3, 4, 5].map((w) => (
                          <Fragment key={`${e._id}-w${w}`}>
                            <td className="px-2 py-2 text-right border-l border-border/60">
                              {formatNumber(h[w]?.normal || 0)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {formatNumber(h[w]?.ot || 0)}
                            </td>
                            <td className="px-2 py-2 text-right">
                              {formatNumber(h[w]?.double || 0)}
                            </td>
                          </Fragment>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {tab === 'settings' && (
          <Card className="space-y-4 max-w-xl">
            <h3 className="font-heading">Staff Information & Payroll Settings</h3>
            <p className="text-sm text-muted">
              These rules drive weekly worklog costing and payslips. Update them in Settings; values shown here are live.
            </p>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Standard Weekly Hours" value={settings?.normalHoursCap ?? 40} />
              <Info label="Overtime Multiplier" value={`${settings?.otMultiplier ?? 1.5}x`} />
              <Info label="Double-Time Multiplier" value={`${settings?.doubleMultiplier ?? 2}x`} />
              <Info label="Employer NPF Rate" value={`${((settings?.employerNpfRate ?? 0.1) * 100).toFixed(1)}%`} />
              <Info label="Employer ACC Rate" value={`${((settings?.employerAccRate ?? 0.01) * 100).toFixed(1)}%`} />
              <Info label="Tea Fund" value={formatMoney(settings?.teaFundAmount ?? 0)} />
              <Info label="Currency" value={settings?.currency || 'USD'} />
              <Info label="Week Start" value={settings?.weekStart || 'friday'} />
            </div>
            <ol className="text-sm text-muted list-decimal pl-5 space-y-1">
              <li>Change an employee&apos;s hourly rate in Employees.</li>
              <li>Change payroll rules in Settings.</li>
              <li>Enter clock-in/out times on the Timesheets tab.</li>
              <li>Hours, gross wages, employer NPF/ACC and employer cost update automatically.</li>
              <li>Click Save All Payslips on Timesheets or Payslips to generate PDFs.</li>
            </ol>
            <Link to="/settings"><Button type="button">Open Settings</Button></Link>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

function Info({ label, value }) {
  return (
    <div className="rounded-[14px] border border-border px-3 py-2">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-semibold mt-0.5">{value}</p>
    </div>
  );
}
