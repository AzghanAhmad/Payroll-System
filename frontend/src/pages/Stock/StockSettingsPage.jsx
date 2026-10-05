import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, Users, KeyRound, ShieldCheck } from 'lucide-react';
import StockLayout from '@/layouts/StockLayout';
import AccountSettings from '@/pages/Settings/AccountSettings';
import UsersSettings from '@/pages/Settings/UsersSettings';
import { cn } from '@/utils/helpers';
import { useAuth } from '@/context/AuthContext';

export default function StockSettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const currentTab = searchParams.get('tab') || 'profile';

  const setTab = (tab) => {
    setSearchParams({ tab });
  };

  const tabs = [
    {
      id: 'profile',
      label: 'Edit Profile & Password',
      icon: User,
      desc: 'Update your personal name, email, and password',
    },
    ...(isAdmin
      ? [
          {
            id: 'users',
            label: 'Add & Manage Users',
            icon: Users,
            desc: 'Create new user logins and manage system roles',
          },
        ]
      : []),
  ];

  return (
    <StockLayout title="Stock & Operations Settings">
      <div className="space-y-6 max-w-6xl">
        {/* Navigation Bar / Tabs */}
        <div className="flex border-b border-border/80 gap-2 overflow-x-auto pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTab(tab.id)}
                className={cn(
                  'flex items-center gap-2.5 px-4 py-3 text-xs sm:text-sm font-semibold rounded-2xl border transition-all cursor-pointer whitespace-nowrap',
                  active
                    ? 'bg-primary text-white border-primary shadow-sm shadow-blue-900/20'
                    : 'bg-white text-slate-600 hover:text-slate-900 border-border/80 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div>
          {currentTab === 'profile' ? (
            <AccountSettings />
          ) : currentTab === 'users' && isAdmin ? (
            <UsersSettings />
          ) : (
            <AccountSettings />
          )}
        </div>
      </div>
    </StockLayout>
  );
}
