import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { useSettingsForm } from './useSettingsForm';

const FIELDS = [
  'leaveAnnual', 'leaveSick', 'leaveMaternity', 'leavePaternity', 'leaveBereavement',
];

export default function LeaveSettings() {
  const { form, set, isSaving } = useSettingsForm(FIELDS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">Leave Entitlements</h2>
          <p className="text-sm text-muted">
            Days allowed per leave cycle. Balances reset on each hire-date anniversary.
          </p>
        </div>
        <span className="text-xs text-muted px-2 py-1.5 rounded-lg bg-slate-50 border border-border">
          {isSaving ? 'Saving…' : 'Autosaves as you type'}
        </span>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Annual Leave" type="number" step="0.5" value={form.leaveAnnual ?? 10} onChange={(e) => set('leaveAnnual', Number(e.target.value))} />
          <Input label="Sick Leave" type="number" step="0.5" value={form.leaveSick ?? 10} onChange={(e) => set('leaveSick', Number(e.target.value))} />
          <Input label="Maternity Leave" type="number" step="0.5" value={form.leaveMaternity ?? 20} onChange={(e) => set('leaveMaternity', Number(e.target.value))} />
          <Input label="Paternity Leave" type="number" step="0.5" value={form.leavePaternity ?? 3} onChange={(e) => set('leavePaternity', Number(e.target.value))} />
          <Input label="Bereavement Leave" type="number" step="0.5" value={form.leaveBereavement ?? 3} onChange={(e) => set('leaveBereavement', Number(e.target.value))} />
        </div>
      </Card>
    </div>
  );
}
