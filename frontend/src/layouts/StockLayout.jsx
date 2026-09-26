import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  Boxes,
  Package,
  Layers,
  TableProperties,
  Truck,
  Trophy,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  ArrowLeftRight,
  Share2,
  History,
  Sparkles,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/helpers';

const stockNavLinks = [
  { to: '/stock', label: 'Stock Overview', icon: LayoutDashboard, end: true },
  { to: '/stock/products', label: 'Products & Stock', icon: Package },
  { to: '/stock/categories', label: 'Categories', icon: Layers },
  { to: '/stock/balance-sheet', label: 'Inventory Sheet', icon: TableProperties },
  { to: '/stock/vendors', label: 'Vendors / Suppliers', icon: Truck },
  { to: '/stock/history', label: 'Stock History', icon: History },
];

export default function StockLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const onLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || user?.email || 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - fixed and full height matching AppLayout */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-sidebar text-white transition-transform',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand header */}
        <div className="shrink-0 p-5 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/Payroll-Icon.png"
                alt="Alpha Group"
                className="h-10 w-auto max-w-[150px] object-contain"
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-xs font-semibold text-sky-400 flex items-center gap-1.5">
              <Boxes className="w-3.5 h-3.5" /> Stock &amp; Inventory Suite
            </span>
            <Link
              to="/hub"
              className="text-[10px] font-semibold text-sky-400 hover:text-sky-300 bg-white/10 px-2 py-0.5 rounded-md transition-colors"
            >
              Hub &rarr;
            </Link>
          </div>
        </div>

        {/* Module Switcher button */}
        <div className="px-3 pt-3">
          <button
            onClick={() => navigate('/hub')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors text-xs font-medium group"
          >
            <span className="flex items-center gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-sky-400" />
              Switch Workspace
            </span>
            <span className="bg-white/10 px-2 py-0.5 rounded-md text-[10px] text-slate-300">
              Hub
            </span>
          </button>
        </div>

        {/* Scrollable Nav Links */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {stockNavLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-primary text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-300 hover:bg-sidebar-hover hover:text-white'
                  )
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* User & Payroll Shortcut footer */}
        <div className="shrink-0 p-4 border-t border-white/10 space-y-3">
          <button
            onClick={() => navigate('/payroll-dashboard')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 hover:text-white text-xs font-medium border border-white/10 transition-colors"
          >
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Payroll System
            </span>
            <span className="text-[10px] text-sky-400">&rarr;</span>
          </button>

          <div>
            <p className="text-sm font-medium truncate text-white">{user?.name || user?.email}</p>
            <p className="text-xs text-slate-400 capitalize mb-2">{user?.role || 'Admin'}</p>
            <button
              onClick={onLogout}
              className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-sm text-slate-300 hover:bg-sidebar-hover cursor-pointer transition-colors"
            >
              <LogOut className="w-4 h-4" /> Logout
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}

      {/* Main Content Area - padded left by sidebar on lg screens */}
      <div className="flex h-dvh min-w-0 flex-col overflow-hidden lg:pl-64">
        {/* Header bar matching AppLayout */}
        <header className="shrink-0 z-40 h-16 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <button
                className="lg:hidden rounded-[12px] p-2 hover:bg-slate-100 cursor-pointer shrink-0 text-slate-600"
                onClick={() => setOpen((v) => !v)}
                aria-label="Open menu"
              >
                {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
              <h1 className="text-base sm:text-xl font-heading text-slate-900 truncate font-bold">
                {title}
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <Link
                to="/hub"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Workspace Hub</span>
              </Link>
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable page body */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 space-y-6">
          {children}
        </main>
      </div>
    </div>
  );
}
