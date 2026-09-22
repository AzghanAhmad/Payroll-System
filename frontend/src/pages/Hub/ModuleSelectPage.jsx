import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  Boxes,
  Wallet,
  ArrowRight,
  TrendingUp,
  PackageCheck,
  Building2,
  LogOut,
  Sparkles,
  Layers,
  BarChart3,
} from 'lucide-react';

export default function ModuleSelectPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleSelectModule = (path) => {
    localStorage.setItem('preferredModule', path);
    navigate(path);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-blue-100 selection:text-blue-900">
      {/* Top Navbar */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/80 bg-white/70 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Alpha Group</h1>
            <p className="text-xs text-slate-500 font-medium">Enterprise Management Suite</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col text-right">
            <span className="text-sm font-semibold text-slate-800">{user?.name || user?.email || 'Administrator'}</span>
            <span className="text-xs text-slate-500 capitalize">{user?.role || 'User'}</span>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Hero Selection */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-12 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-center max-w-xl mb-12"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-blue-600" /> Choose Workspace
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            Select Your Module
          </h2>
          <p className="text-slate-600 mt-2 text-sm sm:text-base leading-relaxed">
            Choose a workspace to continue. You can seamlessly switch between inventory management and payroll at any time.
          </p>
        </motion.div>

        {/* 2 Modern Reference-Matching Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          {/* Card 1: Stock Management */}
          <motion.div
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="group relative bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-sky-300 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
            onClick={() => handleSelectModule('/stock')}
          >
            {/* Top Visual Graphic Section */}
            <div className="h-48 sm:h-52 bg-gradient-to-b from-sky-100 via-sky-50 to-white flex items-center justify-center relative p-6 border-b border-sky-100/50">
              <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:16px_16px] opacity-30" />
              <div className="relative z-10 w-24 h-24 rounded-2xl bg-white shadow-lg shadow-sky-500/10 border border-sky-200/60 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Boxes className="w-12 h-12 text-sky-500" />
              </div>
              <div className="absolute top-4 right-4 bg-sky-500/10 text-sky-700 border border-sky-200/80 text-xs font-bold px-2.5 py-1 rounded-full">
                Inventory Suite
              </div>
            </div>

            {/* Bottom Content Section */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="h-1.5 w-12 bg-sky-500 rounded-full mb-4 group-hover:w-20 transition-all duration-300" />
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-sky-600 transition-colors">
                  Stock Management
                </h3>
                <p className="text-slate-500 text-sm mt-2.5 leading-relaxed">
                  Track inventory balances (start, in, out, end), categories, units, low stock alerts, vendor contacts, and employee weekly/monthly sales performance.
                </p>

                {/* Micro tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Balance Sheet
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Vendors
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Top Sellers
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    WhatsApp Share
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  className="w-full py-3 px-5 rounded-2xl bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white font-semibold text-sm shadow-md shadow-sky-500/25 flex items-center justify-center gap-2 group-hover:gap-3 transition-all duration-200"
                >
                  <span>Launch Stock Management</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Payroll Management */}
          <motion.div
            whileHover={{ y: -6, transition: { duration: 0.2 } }}
            className="group relative bg-white rounded-3xl border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-blue-400 transition-all duration-300 flex flex-col overflow-hidden cursor-pointer"
            onClick={() => handleSelectModule('/payroll-dashboard')}
          >
            {/* Top Visual Graphic Section */}
            <div className="h-48 sm:h-52 bg-gradient-to-b from-blue-100 via-blue-50 to-white flex items-center justify-center relative p-6 border-b border-blue-100/50">
              <div className="absolute inset-0 bg-[radial-gradient(#2563eb_1px,transparent_1px)] [background-size:16px_16px] opacity-25" />
              <div className="relative z-10 w-24 h-24 rounded-2xl bg-white shadow-lg shadow-blue-500/10 border border-blue-200/60 flex items-center justify-center group-hover:scale-105 transition-transform duration-300">
                <Wallet className="w-12 h-12 text-blue-600" />
              </div>
              <div className="absolute top-4 right-4 bg-blue-600/10 text-blue-700 border border-blue-200/80 text-xs font-bold px-2.5 py-1 rounded-full">
                Payroll & HR
              </div>
            </div>

            {/* Bottom Content Section */}
            <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between">
              <div>
                <div className="h-1.5 w-12 bg-blue-600 rounded-full mb-4 group-hover:w-20 transition-all duration-300" />
                <h3 className="text-2xl font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                  Payroll Management
                </h3>
                <p className="text-slate-500 text-sm mt-2.5 leading-relaxed">
                  Full employee salary processing, hourly timesheets, leave management, statutory sheets (NPF, PAYE, ACC), IOU loans, and automated payslips.
                </p>

                {/* Micro tags */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Employees
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Timesheets
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Statutory
                  </span>
                  <span className="text-[11px] font-semibold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md">
                    Payslips
                  </span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-8 pt-5 border-t border-slate-100">
                <button
                  type="button"
                  className="w-full py-3 px-5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-sm shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 group-hover:gap-3 transition-all duration-200"
                >
                  <span>Launch Payroll System</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-slate-400 border-t border-slate-200/60 bg-white/50">
        Alpha Group Enterprise System &bull; Payroll &amp; Inventory Management
      </footer>
    </div>
  );
}
