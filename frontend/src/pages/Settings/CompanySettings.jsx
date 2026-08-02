import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { FileUpload } from '@/components/ui/FileUpload';
import { CURRENCIES } from '@/utils/currencies';
import { useSettingsForm } from './useSettingsForm';

const FIELDS = [
  'companyName', 'companyAddress', 'companyPhone', 'companyEmail',
  'currency', 'digitalSignature',
];

export default function CompanySettings() {
  const { form, set, logo, setLogo, isSaving, isLoading } = useSettingsForm(FIELDS);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg">Company</h2>
          <p className="text-sm text-muted">Business identity shown on payslips and reports.</p>
        </div>
        <span className="text-xs text-muted px-2 py-1.5 rounded-lg bg-slate-50 border border-border">
          {isSaving ? 'Saving…' : 'Autosaves as you type'}
        </span>
      </div>

      <Card className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input label="Company Name" value={form.companyName || ''} onChange={(e) => set('companyName', e.target.value)} />
          <Input label="Email" value={form.companyEmail || ''} onChange={(e) => set('companyEmail', e.target.value)} />
          <Input label="Phone" value={form.companyPhone || ''} onChange={(e) => set('companyPhone', e.target.value)} />
          <Input label="Address" value={form.companyAddress || ''} onChange={(e) => set('companyAddress', e.target.value)} />
          <Select label="Currency" value={form.currency || 'USD'} onChange={(e) => set('currency', e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.symbol} — {c.name} ({c.code})
              </option>
            ))}
          </Select>
          <Input label="Digital Signature" value={form.digitalSignature || ''} onChange={(e) => set('digitalSignature', e.target.value)} />
          <FileUpload
            className="sm:col-span-2"
            label="Logo"
            accept="image/*"
            value={logo}
            previewUrl={!logo ? form.logo : undefined}
            onChange={setLogo}
            hint="Company logo — PNG or JPG"
          />
        </div>
      </Card>
    </div>
  );
}
