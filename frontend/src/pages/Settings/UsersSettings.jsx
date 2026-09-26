import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { UserPlus, Trash2, KeyRound, ShieldCheck, UserCheck, UserX, ExternalLink, ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { authApi } from '@/services';
import { useAuth } from '@/context/AuthContext';
import { Link } from 'react-router-dom';

export default function UsersSettings() {
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'employee',
  });

  const [editingUser, setEditingUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users-list'],
    queryFn: authApi.listUsers,
  });

  const users = data?.items || [];

  const createMutation = useMutation({
    mutationFn: authApi.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast.success('User account created successfully');
      setForm({ name: '', email: '', password: '', role: 'employee' });
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to create user'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => authApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast.success('User updated successfully');
      setEditingUser(null);
      setNewPassword('');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update user'),
  });

  const deleteMutation = useMutation({
    mutationFn: authApi.deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users-list'] });
      toast.success('User removed');
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to delete user'),
  });

  const handleCreate = (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password) {
      return toast.error('Name, email, and initial password are required');
    }
    createMutation.mutate(form);
  };

  const handleToggleStatus = (u) => {
    if (u._id === currentUser?.id) {
      return toast.error('You cannot disable your own active account');
    }
    updateMutation.mutate({
      id: u._id,
      data: { isActive: !u.isActive },
    });
  };

  const handleRoleChange = (u, newRole) => {
    if (u._id === currentUser?.id) {
      return toast.error('You cannot change your own role');
    }
    updateMutation.mutate({
      id: u._id,
      data: { role: newRole },
    });
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (!editingUser || !newPassword.trim()) return;
    updateMutation.mutate({
      id: editingUser._id,
      data: { password: newPassword.trim() },
    });
  };

  return (
    <div className="space-y-6">
      {/* Quick User Portal Promotion Banner */}
      <div className="bg-gradient-to-r from-sky-50 via-white to-blue-50 border border-sky-200/80 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-100 text-sky-700 mb-1.5">
            <ShieldCheck className="w-3.5 h-3.5" /> Quick Operations Portal
          </div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            Quick User Portal (Manage Add &amp; Sales)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Regular staff users (role: Employee) can only access this focused operations dashboard to record stock inward and store sales.
          </p>
        </div>

        <Link
          to="/stock/user"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-sky-600 hover:bg-sky-700 text-white shadow-xs transition-colors shrink-0"
        >
          <span>Open Quick User Portal</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Header and User Creation Form */}
      <div>
        <h2 className="font-heading text-lg font-bold text-slate-900">User Management</h2>
        <p className="text-sm text-muted">
          Add login accounts and assign access roles. Staff users with the "Employee" role only see the quick stock &amp; sales portal.
        </p>
      </div>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-primary" /> Add New User
        </h3>

        <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
            <Input
              placeholder="e.g. John Doe"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
            <Input
              type="email"
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Password *</label>
            <Input
              type="password"
              placeholder="Minimum 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">User Role *</label>
            <div className="flex gap-2">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="employee">Employee (Quick User Portal Only)</option>
                <option value="admin">Administrator (Full Access)</option>
              </select>

              <Button type="submit" disabled={createMutation.isPending} className="shrink-0 text-xs">
                {createMutation.isPending ? 'Adding...' : 'Create'}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        <div className="p-4 border-b border-border/80 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Registered System Users ({users.length})</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Loading users...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    No users found.
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isSelf = u._id === currentUser?.id;
                  return (
                    <tr key={u._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-semibold text-slate-900 flex items-center gap-2">
                          <span>{u.name}</span>
                          {isSelf && (
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                              You
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{u.email}</div>
                      </td>

                      <td className="px-4 py-3.5">
                        {isSelf ? (
                          <span className="capitalize font-semibold text-slate-700 px-2 py-1 rounded-md bg-slate-100">
                            {u.role === 'admin' ? 'Administrator' : 'Employee'}
                          </span>
                        ) : (
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u, e.target.value)}
                            className="text-xs px-2.5 py-1 rounded-lg border border-slate-200 bg-white font-medium capitalize"
                          >
                            <option value="employee">Employee (Portal Only)</option>
                            <option value="admin">Administrator</option>
                          </select>
                        )}
                      </td>

                      <td className="px-4 py-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(u)}
                          disabled={isSelf}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold transition-colors ${
                            u.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                          }`}
                        >
                          {u.isActive ? (
                            <>
                              <UserCheck className="w-3 h-3" /> Active
                            </>
                          ) : (
                            <>
                              <UserX className="w-3 h-3" /> Disabled
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-3.5 text-slate-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setEditingUser(u)}
                            title="Reset Password"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 transition-colors"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          {!isSelf && (
                            <button
                              onClick={() => {
                                if (confirm(`Are you sure you want to delete user "${u.name}"?`)) {
                                  deleteMutation.mutate(u._id);
                                }
                              }}
                              title="Delete User"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Password Reset Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Reset Password</h3>
            <p className="text-xs text-slate-500 mt-1">
              Set a new password for <span className="font-semibold text-slate-800">{editingUser.name}</span> ({editingUser.email}).
            </p>

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Password *</label>
                <Input
                  type="password"
                  required
                  placeholder="Minimum 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 text-xs"
                  onClick={() => {
                    setEditingUser(null);
                    setNewPassword('');
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending} className="flex-1 text-xs">
                  {updateMutation.isPending ? 'Updating...' : 'Save Password'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
