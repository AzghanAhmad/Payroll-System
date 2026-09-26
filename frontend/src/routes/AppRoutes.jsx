import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/Login/LoginPage';
import { ForgotPasswordPage, ResetPasswordPage } from '@/pages/Login/ForgotPasswordPage';
import DashboardPage from '@/pages/Dashboard/DashboardPage';
import EmployeesPage from '@/pages/Employees/EmployeesPage';
import StaffInfoPage from '@/pages/Staff/StaffInfoPage';
import TimesheetsPage from '@/pages/Timesheets/TimesheetsPage';
import PayrollPage from '@/pages/Payroll/PayrollPage';
import PayslipsPage from '@/pages/Payslips/PayslipsPage';
import ReportsPage from '@/pages/Reports/ReportsPage';
import SettingsLayout from '@/pages/Settings/SettingsLayout';
import CompanySettings from '@/pages/Settings/CompanySettings';
import PayrollRulesSettings from '@/pages/Settings/PayrollRulesSettings';
import LeaveSettings from '@/pages/Settings/LeaveSettings';
import StatutorySettings from '@/pages/Settings/StatutorySettings';
import DepartmentsSettings from '@/pages/Settings/DepartmentsSettings';
import AccountSettings from '@/pages/Settings/AccountSettings';
import LeavePage from '@/pages/Leave/LeavePage';
import MonthControlPage from '@/pages/MonthControl/MonthControlPage';
import SchedulePage from '@/pages/Schedule/SchedulePage';
import CalendarPage from '@/pages/Calendar/CalendarPage';
import StatutoryPage from '@/pages/Statutory/StatutoryPage';
import IouTrackerPage from '@/pages/IouTracker/IouTrackerPage';
import ModuleSelectPage from '@/pages/Hub/ModuleSelectPage';
import StockDashboardPage from '@/pages/Stock/StockDashboardPage';
import ProductsPage from '@/pages/Stock/ProductsPage';
import CategoriesPage from '@/pages/Stock/CategoriesPage';
import StockBalanceSheetPage from '@/pages/Stock/StockBalanceSheetPage';
import VendorsPage from '@/pages/Stock/VendorsPage';
import StockHistoryPage from '@/pages/Stock/StockHistoryPage';
import UserStockDashboard from '@/pages/Stock/UserStockDashboard';

import UsersSettings from '@/pages/Settings/UsersSettings';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

// Route specifically for staff/employee users: limits them to only their operations portal
function StaffOperationsOnlyRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === 'employee') {
    return <Navigate to="/stock/user" replace />;
  }
  return <Outlet />;
}

function GuestRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) {
    if (user.role === 'employee') return <Navigate to="/stock/user" replace />;
    return <Navigate to="/hub" replace />;
  }
  return <Outlet />;
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<GuestRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<Navigate to="/login" replace />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        {/* Quick User Stock Operations Portal - accessible to all authenticated users */}
        <Route path="/stock/user" element={<UserStockDashboard />} />

        {/* All admin / managerial modules - guarded so employee-role users only see the user dashboard */}
        <Route element={<StaffOperationsOnlyRoute />}>
          <Route path="/hub" element={<ModuleSelectPage />} />
          <Route path="/" element={<ModuleSelectPage />} />
          <Route path="/payroll-dashboard" element={<DashboardPage />} />
          <Route path="/employees" element={<EmployeesPage />} />
          <Route path="/staff" element={<StaffInfoPage />} />
          <Route path="/timesheets" element={<TimesheetsPage />} />
          <Route path="/payroll" element={<PayrollPage />} />
          <Route path="/payslips" element={<PayslipsPage />} />
          <Route path="/loans" element={<Navigate to="/iou-tracker" replace />} />
          <Route path="/leave" element={<LeavePage />} />
          <Route path="/month-control" element={<MonthControlPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/statutory" element={<StatutoryPage />} />
          <Route path="/iou-tracker" element={<IouTrackerPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsLayout />}>
            <Route index element={<CompanySettings />} />
            <Route path="account" element={<AccountSettings />} />
            <Route path="users" element={<UsersSettings />} />
            <Route path="company" element={<CompanySettings />} />
            <Route path="payroll" element={<PayrollRulesSettings />} />
            <Route path="leave" element={<LeaveSettings />} />
            <Route path="statutory" element={<StatutorySettings />} />
            <Route path="departments" element={<DepartmentsSettings />} />
          </Route>
          {/* Full Stock Suite */}
          <Route path="/stock" element={<StockDashboardPage />} />
          <Route path="/stock/products" element={<ProductsPage />} />
          <Route path="/stock/categories" element={<CategoriesPage />} />
          <Route path="/stock/balance-sheet" element={<StockBalanceSheetPage />} />
          <Route path="/stock/vendors" element={<VendorsPage />} />
          <Route path="/stock/history" element={<StockHistoryPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/hub" replace />} />
    </Routes>
  );
}
