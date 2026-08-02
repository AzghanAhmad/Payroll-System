import { cn } from '@/utils/helpers';

export function Modal({ open, onClose, title, children, className }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cn('relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[18px] bg-white soft-shadow p-6', className)}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-lg font-heading">{title}</h3>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-muted hover:bg-slate-100 cursor-pointer">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Badge({ children, tone = 'default' }) {
  const tones = {
    default: 'bg-slate-100 text-slate-700',
    success: 'bg-green-100 text-green-700',
    danger: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
    info: 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', tones[tone])}>
      {children}
    </span>
  );
}
