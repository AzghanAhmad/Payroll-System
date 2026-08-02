import { NavLink, useNavigate, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Clock,
  Wallet,
  FileText,
  BarChart3,
  Settings,
  HandCoins,
  LogOut,
  Menu,
  X,
  IdCard,
  Palmtree,
  CalendarDays,
  CalendarRange,
  FolderPlus,
  Table2,
  Search,
  ChevronDown,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/utils/helpers';

const links = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/employees', label: 'Employees', icon: Users },
  { to: '/staff', label: 'Staff Info', icon: IdCard },
  { to: '/timesheets', label: 'Timesheets', icon: Clock },
  { to: '/leave', label: 'Leave Tracker', icon: Palmtree },
  { to: '/payroll', label: 'Payroll', icon: Wallet },
  { to: '/payslips', label: 'Payslips', icon: FileText },
  { to: '/statutory', label: 'Statutory Sheets', icon: Table2 },
  { to: '/month-control', label: 'Month Control', icon: FolderPlus },
  { to: '/schedule', label: 'Payroll Schedule', icon: CalendarRange },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/iou-tracker', label: 'IOU Tracker', icon: HandCoins },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings, roles: ['admin'] },
];

const QUICK_ACTIONS = [
  { label: 'Settings', path: '/settings/company', icon: Settings },
  { label: 'Timesheets', path: '/timesheets', icon: Clock },
  { label: 'Leave Tracker', path: '/leave', icon: Palmtree },
  { label: 'Generate Payroll', path: '/payroll', icon: Wallet },
  { label: 'Payslips', path: '/payslips', icon: FileText },
  { label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { label: 'Employees', path: '/employees', icon: Users },
];

export default function AppLayout({ children, title }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef(null);
  const profileRef = useRef(null);

  const filtered = links.filter((l) => !l.roles || l.roles.includes(user?.role));

  const searchResults = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return filtered.filter((l) => l.label.toLowerCase().includes(q)).slice(0, 8);
  }, [search, filtered]);

  const onLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/login');
  };

  useEffect(() => {
    const onDoc = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setSearchOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const goSearch = (path) => {
    setSearch('');
    setSearchOpen(false);
    navigate(path);
  };

  const initials = (user?.name || 'U')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-screen w-64 flex-col bg-sidebar text-white transition-transform',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="shrink-0 p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <img
              src="/Payroll-Icon.png"
              alt="Alpha Group"
              className="h-10 w-auto max-w-[160px] object-contain"
            />
          </div>
          <p className="text-xs text-slate-400 mt-2 pl-0.5">Payroll System</p>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {filtered.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[14px] px-3 py-2.5 text-sm text-slate-300 hover:bg-sidebar-hover hover:text-white transition',
                  isActive && 'bg-primary text-white shadow-lg shadow-blue-900/30'
                )
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="shrink-0 p-4 border-t border-white/10">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <p className="text-xs text-slate-400 capitalize mb-3">{user?.role}</p>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-[14px] px-3 py-2 text-sm text-slate-300 hover:bg-sidebar-hover cursor-pointer"
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />
      )}

      {/* Column scrolls in main only — sticky table headers stay under the fixed navbar */}
      <div className="flex h-dvh min-w-0 flex-col overflow-hidden lg:pl-64">
        <header className="shrink-0 z-40 h-16 border-b border-border/80 bg-white/95 backdrop-blur-md shadow-sm">
          <div className="h-full px-3 sm:px-6 flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 min-w-0 shrink-0 max-w-[42%] sm:max-w-[220px]">
              <button
                className="lg:hidden rounded-[12px] p-2 hover:bg-slate-100 cursor-pointer shrink-0"
                onClick={() => setOpen((v) => !v)}
                aria-label="Open menu"
              >
                {open ? <X size={20} /> : <Menu size={20} />}
              </button>

              <div className="min-w-0 hidden xs:block sm:block">
                <h1 className="text-base sm:text-xl font-heading text-slate-900 truncate">{title}</h1>
              </div>
            </div>

            {/* Global search — grows in the middle, never overlaps hamburger */}
            <div ref={searchRef} className="relative flex-1 min-w-0 max-w-xl mx-auto">
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setSearchOpen(true);
                  }}
                  onFocus={() => setSearchOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchResults[0]) {
                      e.preventDefault();
                      goSearch(searchResults[0].to);
                    }
                    if (e.key === 'Escape') setSearchOpen(false);
                  }}
                  placeholder="Search…"
                  className="w-full rounded-full border border-border bg-slate-50 pl-9 pr-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 focus:bg-white"
                />
              </div>
              {searchOpen && search.trim() && (
                <div className="absolute top-full left-0 right-0 mt-1.5 rounded-[14px] border border-border bg-white shadow-lg overflow-hidden z-50">
                  {searchResults.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted">No pages match “{search}”</p>
                  ) : (
                    searchResults.map(({ to, label, icon: Icon }) => (
                      <button
                        key={to}
                        type="button"
                        onClick={() => goSearch(to)}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-left hover:bg-slate-50 cursor-pointer"
                      >
                        <Icon size={16} className="text-slate-400" />
                        {label}
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Profile menu */}
            <div ref={profileRef} className="relative shrink-0 ml-auto">
              <button
                type="button"
                onClick={() => setProfileOpen((v) => !v)}
                className="flex items-center gap-1.5 rounded-full border border-border bg-white pl-1 pr-2 py-1 hover:bg-slate-50 cursor-pointer"
                title="Account & quick actions"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white text-xs font-semibold shadow-sm">
                  {initials || <UserRound size={16} />}
                </span>
                <ChevronDown size={14} className={cn('text-slate-500 transition hidden sm:block', profileOpen && 'rotate-180')} />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-[16px] border border-border bg-white shadow-xl overflow-hidden z-50">
                  <div className="px-4 py-3 border-b border-border/70 bg-slate-50">
                    <p className="text-sm font-medium truncate">{user?.name}</p>
                    <p className="text-xs text-muted capitalize">{user?.role}</p>
                  </div>
                  <div className="py-1">
                    {QUICK_ACTIONS.filter(
                      (a) => a.path !== '/settings/company' || user?.role === 'admin'
                    ).map(({ label, path, icon: Icon }) => (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                      >
                        <Icon size={16} className="text-slate-400" />
                        {label}
                      </Link>
                    ))}
                  </div>
                  <div className="border-t border-border/70 py-1">
                    <button
                      type="button"
                      onClick={onLogout}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <LogOut size={16} />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
