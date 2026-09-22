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
  { to: '/stock/employee-sales', label: 'Employee Sales', icon: Trophy },
];

export default function StockLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row text-slate-800">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-500 text-white flex items-center justify-center font-bold">
            <Boxes className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-slate-900 leading-none block">Stock Suite</span>
            <span className="text-[10px] text-slate-500 font-medium">Inventory &amp; Sales</span>
          </div>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
          aria-label="Toggle Navigation"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col justify-between transition-transform duration-200 md:translate-x-0 md:static',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div>
          {/* Brand header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-sky-500/20">
                <Boxes className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-bold text-base text-slate-900 leading-tight">Stock Suite</h2>
                <span className="text-xs text-sky-600 font-medium">Alpha Group</span>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="md:hidden p-1 rounded-md text-slate-400 hover:text-slate-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Module Switcher button */}
          <div className="p-4">
            <button
              onClick={() => navigate('/hub')}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 hover:bg-sky-50 text-slate-700 hover:text-sky-700 border border-slate-200/80 transition-colors text-xs font-semibold group"
            >
              <span className="flex items-center gap-2">
                <ArrowLeftRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-600" />
                Switch Workspace
              </span>
              <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200 text-[10px] text-slate-500">
                Hub
              </span>
            </button>
          </div>

          {/* Nav Links */}
          <nav className="px-3 space-y-1">
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
                      'flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-sky-50 text-sky-600 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )
                  }
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User & Payroll Shortcut */}
        <div className="p-4 border-t border-slate-100 space-y-3">
          {/* Quick link to Payroll */}
          <button
            onClick={() => navigate('/payroll-dashboard')}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-blue-50/70 hover:bg-blue-100/70 text-blue-700 text-xs font-medium border border-blue-100 transition-colors"
          >
            <div className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
            <span>Go to Payroll System &rarr;</span>
          </button>

          <div className="flex items-center justify-between pt-1">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-slate-800 truncate max-w-[130px]">
                {user?.name || user?.email}
              </span>
              <span className="text-[10px] text-slate-400 capitalize">{user?.role || 'Admin'}</span>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop on mobile */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/30 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Header bar */}
        <header className="px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-20 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/hub"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Workspace Hub</span>
            </Link>
          </div>
        </header>

        <div className="p-6 max-w-7xl w-full mx-auto space-y-6">{children}</div>
      </main>
    </div>
  );
}
