import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { useSettingsForm } from './useSettingsForm';

const FIELDS = [
  'weekStart', 'normalHoursCap', 'otMultiplier', 'doubleMultiplier', 'doubleTimeRule',
  'teaFundAmount', 'employerNpfRate', 'employeeNpfRate', 'employerAccRate', 'employeeAccRate',
];

export default function PayrollRulesSettings() {
  const { form, set, isSaving } = useSettingsForm(FIELDS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">Payroll Rules</h2>
          <p className="text-sm text-muted">
            Hours caps, OT multipliers, and contribution rates. Changes autosave and recalculate open payrolls.
          </p>
        </div>
        <span className="text-xs text-muted px-2 py-1.5 rounded-lg bg-slate-50 border border-border">
          {isSaving ? 'Saving…' : 'Autosaves as you type'}
        </span>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select label="Week Start" value={form.weekStart || 'friday'} onChange={(e) => set('weekStart', e.target.value)}>
            <option value="friday">Friday</option>
            <option value="monday">Monday</option>
            <option value="sunday">Sunday</option>
          </Select>
          <Input label="Normal Hours Cap" type="number" value={form.normalHoursCap ?? 40} onChange={(e) => set('normalHoursCap', Number(e.target.value))} />
          <Input label="OT Multiplier" type="number" step="0.1" value={form.otMultiplier ?? 1.5} onChange={(e) => set('otMultiplier', Number(e.target.value))} />
          <Input label="Double Multiplier" type="number" step="0.1" value={form.doubleMultiplier ?? 2} onChange={(e) => set('doubleMultiplier', Number(e.target.value))} />
          <Select label="Double Time Rule" value={form.doubleTimeRule || 'sunday'} onChange={(e) => set('doubleTimeRule', e.target.value)}>
            <option value="sunday">Sunday</option>
            <option value="public_holiday">Public Holiday</option>
            <option value="manual">Manual</option>
            <option value="none">None</option>
          </Select>
          <Input label="Tea Fund Amount" type="number" step="0.01" value={form.teaFundAmount ?? 2} onChange={(e) => set('teaFundAmount', Number(e.target.value))} />
          <Input label="Employer NPF Rate" type="number" step="0.01" value={form.employerNpfRate ?? 0.1} onChange={(e) => set('employerNpfRate', Number(e.target.value))} />
          <Input label="Employee NPF Rate" type="number" step="0.01" value={form.employeeNpfRate ?? 0.1} onChange={(e) => set('employeeNpfRate', Number(e.target.value))} />
          <Input label="Employer ACC Rate" type="number" step="0.01" value={form.employerAccRate ?? 0.01} onChange={(e) => set('employerAccRate', Number(e.target.value))} />
          <Input label="Employee ACC Rate" type="number" step="0.01" value={form.employeeAccRate ?? 0.01} onChange={(e) => set('employeeAccRate', Number(e.target.value))} />
        </div>
      </Card>
    </div>
  );
}
