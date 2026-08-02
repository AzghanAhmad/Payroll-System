import { cn } from '@/utils/helpers';

export function Button({ className, variant = 'primary', size = 'md', type = 'button', children, ...props }) {
  const variants = {
    primary: 'gradient-btn',
    secondary: 'bg-secondary text-white hover:opacity-90',
    outline: 'border border-border bg-white hover:bg-slate-50 text-slate-700',
    ghost: 'hover:bg-slate-100 text-slate-700',
    danger: 'bg-danger text-white hover:opacity-90',
    success: 'bg-success text-white hover:opacity-90',
  };
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-[18px] font-medium disabled:opacity-50 disabled:pointer-events-none cursor-pointer',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
