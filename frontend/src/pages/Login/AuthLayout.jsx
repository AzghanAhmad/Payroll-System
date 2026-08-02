import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Clock, FileText, ShieldCheck, Wallet } from 'lucide-react';

const features = [
  { icon: Clock, label: 'Timesheets & attendance' },
  { icon: Wallet, label: 'Weekly payroll costing' },
  { icon: FileText, label: 'Payslips & statutory sheets' },
  { icon: ShieldCheck, label: 'NPF · ACC · PAYE ready' },
];

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}) {
  return (
    <div className="min-h-dvh grid lg:grid-cols-2 bg-[#F1F5F9]">
      {/* Brand panel */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden px-12 py-12 text-white">
        <div className="absolute inset-0 bg-[linear-gradient(145deg,#0B1220_0%,#0F2A4A_42%,#0E7490_100%)]" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_15%_20%,rgba(56,189,248,0.45),transparent_45%),radial-gradient(ellipse_at_85%_75%,rgba(34,211,238,0.35),transparent_40%)]" />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <Link to="/login" className="inline-flex items-center gap-3">
            <img
              src="/Payroll-Icon.png"
              alt="Alpha Group"
              className="h-11 w-auto max-w-[200px] object-contain"
            />
          </Link>
          <h2 className="mt-14 max-w-md font-heading text-4xl leading-tight tracking-tight">
            Run payroll with clarity, not chaos.
          </h2>
          <p className="mt-4 max-w-sm text-base leading-relaxed text-slate-300">
            One place for timesheets, deductions, payslips, leave, and IOU tracking —
            built for Alpha Group payroll workflows.
          </p>
        </motion.div>

        <motion.ul
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.12 }}
          className="relative z-10 grid grid-cols-1 gap-3"
        >
          {features.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200">
                <Icon size={18} />
              </span>
              <span className="text-sm text-slate-200">{label}</span>
            </li>
          ))}
        </motion.ul>
      </aside>

      {/* Form panel */}
      <div className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(37,99,235,0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,rgba(6,182,212,0.1),transparent_45%)]" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative z-10 w-full max-w-[420px]"
        >
          <div className="mb-8 lg:hidden text-center">
            <Link to="/login" className="inline-flex items-center justify-center">
              <img
                src="/Payroll-Icon.png"
                alt="Alpha Group"
                className="h-10 w-auto max-w-[180px] object-contain"
              />
            </Link>
          </div>

          <div className="rounded-[28px] border border-white/80 bg-white/90 p-7 sm:p-9 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur-md">
            <div className="mb-7">
              <h1 className="font-heading text-2xl sm:text-[1.75rem] text-slate-900 tracking-tight">
                {title}
              </h1>
              {subtitle && <p className="mt-2 text-sm text-muted leading-relaxed">{subtitle}</p>}
            </div>

            {children}

            {footer && <div className="mt-6 text-center text-sm text-muted">{footer}</div>}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
