import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useSettingsForm } from './useSettingsForm';

const FIELDS = ['npfEmployerNumber', 'npfZone', 'accEmpNumber1', 'accEmpNumber2'];

export default function StatutorySettings() {
  const { form, set, save, isSaving, isLoading } = useSettingsForm(FIELDS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">Statutory / Fund Details</h2>
          <p className="text-sm text-muted">Employer numbers shown on NPF and ACC schedule sheets.</p>
        </div>
        <Button type="button" onClick={save} disabled={isSaving || isLoading}>
          {isSaving ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="NPF Employer Number" value={form.npfEmployerNumber || ''} onChange={(e) => set('npfEmployerNumber', e.target.value)} />
          <Input label="NPF Zone" value={form.npfZone || ''} onChange={(e) => set('npfZone', e.target.value)} />
          <Input label="ACC Emp. Number 1" value={form.accEmpNumber1 || ''} onChange={(e) => set('accEmpNumber1', e.target.value)} />
          <Input label="ACC Emp. Number 2" value={form.accEmpNumber2 || ''} onChange={(e) => set('accEmpNumber2', e.target.value)} />
        </div>
      </Card>
    </div>
  );
}
