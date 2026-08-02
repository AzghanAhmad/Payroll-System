import { cn } from '@/utils/helpers';

export function Input({ className, label, error, ...props }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <input
        className={cn(
          'w-full rounded-[18px] border border-border bg-white px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Select({ className, label, error, children, ...props }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <select
        className={cn(
          'w-full rounded-[18px] border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20',
          error && 'border-danger',
          className
        )}
        {...props}
      >
        {children}
      </select>
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}

export function Textarea({ className, label, error, ...props }) {
  return (
    <label className="block space-y-1.5">
      {label && <span className="text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        className={cn(
          'w-full rounded-[18px] border border-border bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 min-h-[90px]',
          error && 'border-danger',
          className
        )}
        {...props}
      />
      {error && <span className="text-xs text-danger">{error}</span>}
    </label>
  );
}
