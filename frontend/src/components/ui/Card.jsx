import { cn } from '@/utils/helpers';
import { motion } from 'framer-motion';

export function Card({ className, children, ...props }) {
  return (
    <div className={cn('rounded-[18px] bg-card soft-shadow border border-border/60 p-5', className)} {...props}>
      {children}
    </div>
  );
}

export function StatCard({ title, value, icon: Icon, color = 'primary', delay = 0 }) {
  const colors = {
    primary: 'from-blue-500/15 to-cyan-500/10 text-primary',
    success: 'from-green-500/15 to-emerald-500/10 text-success',
    warning: 'from-amber-500/15 to-orange-500/10 text-warning',
    danger: 'from-red-500/15 to-rose-500/10 text-danger',
    accent: 'from-cyan-500/15 to-sky-500/10 text-accent',
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className="rounded-[18px] bg-card soft-shadow border border-border/60 p-5 hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{title}</p>
          <p className="mt-2 text-2xl font-heading font-bold text-slate-900">{value}</p>
        </div>
        {Icon && (
          <div className={cn('rounded-[14px] bg-gradient-to-br p-3', colors[color])}>
            <Icon size={20} />
          </div>
        )}
      </div>
    </motion.div>
  );
}
