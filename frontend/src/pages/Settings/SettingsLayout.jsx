import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  Building2,
  Calculator,
  Palmtree,
  Landmark,
  Layers,
  KeyRound,
} from 'lucide-react';
import AppLayout from '@/layouts/AppLayout';
import { cn } from '@/utils/helpers';
import { useAuth } from '@/context/AuthContext';

const SECTIONS = [
  { to: '/settings/account', label: 'Account', icon: KeyRound, desc: 'Email & password', allRoles: true },
  { to: '/settings/company', label: 'Company', icon: Building2, desc: 'Name, logo, currency' },
  { to: '/settings/payroll', label: 'Payroll Rules', icon: Calculator, desc: 'OT, NPF & ACC rates' },
  { to: '/settings/leave', label: 'Leave Entitlements', icon: Palmtree, desc: 'Annual leave allowances' },
  { to: '/settings/statutory', label: 'Statutory Details', icon: Landmark, desc: 'NPF & ACC numbers' },
  { to: '/settings/departments', label: 'Departments', icon: Layers, desc: 'Café, Chemist, etc.' },
];

export default function SettingsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  if (location.pathname === '/settings' || location.pathname === '/settings/') {
    return <Navigate to={isAdmin ? '/settings/company' : '/settings/account'} replace />;
  }

  const visible = SECTIONS.filter((s) => s.allRoles || isAdmin);

  return (
    <AppLayout title="Settings">
      <div className="flex flex-col lg:flex-row gap-6 max-w-6xl">
        <aside className="lg:w-56 shrink-0">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 lg:sticky lg:top-4">
            {visible.map(({ to, label, icon: Icon, desc }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-start gap-3 rounded-[14px] px-3 py-2.5 text-sm whitespace-nowrap lg:whitespace-normal border border-transparent transition',
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-blue-900/20'
                      : 'text-slate-600 hover:bg-slate-100 bg-white border-border/60'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon size={18} className="mt-0.5 shrink-0" />
                    <span className="min-w-0">
                      <span className="block font-medium">{label}</span>
                      <span className={cn('hidden lg:block text-xs mt-0.5', isActive ? 'text-white/80' : 'text-muted')}>
                        {desc}
                      </span>
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex-1 min-w-0">
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}
