import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/utils/helpers';

export function PasswordInput({
  label = 'Password',
  error,
  className,
  inputClassName,
  ...props
}) {
  const [visible, setVisible] = useState(false);

  return (
    <label className={cn('block space-y-1.5', className)}>
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <div className="relative">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete={props.autoComplete || 'current-password'}
          className={cn(
            'w-full rounded-2xl border border-border bg-white px-4 py-2.5 pr-11 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
            error && 'border-danger',
            inputClassName
          )}
          {...props}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
