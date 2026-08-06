import { useState } from 'react';
import toast from 'react-hot-toast';
import { KeyRound } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services';

export default function AccountSettings() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const strengthHint = (() => {
    const p = newPassword;
    if (!p) return '';
    const checks = [
      p.length >= 8,
      /[A-Z]/.test(p),
      /[a-z]/.test(p),
      /\d/.test(p),
      /[^A-Za-z0-9]/.test(p),
    ].filter(Boolean).length;
    if (checks <= 2) return 'Weak';
    if (checks <= 4) return 'Good';
    return 'Strong';
  })();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      toast.error('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.changePassword({ currentPassword, newPassword });
      toast.success('Password updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading text-lg">Account</h2>
        <p className="text-sm text-muted">Manage your login email and password.</p>
      </div>

      <Card className="space-y-3">
        <div className="flex items-start gap-3">
          <div className="rounded-[12px] bg-slate-100 p-2.5 text-slate-600">
            <KeyRound size={18} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Signed in as</p>
            <p className="text-sm text-muted mt-0.5">{user?.name || '—'}</p>
            <p className="text-sm font-mono text-slate-700 mt-1">{user?.email || '—'}</p>
            <p className="text-xs text-muted capitalize mt-1">Role: {user?.role || '—'}</p>
          </div>
        </div>
      </Card>

      <Card>
        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          <div>
            <h3 className="font-heading text-base">Change password</h3>
            <p className="text-xs text-muted mt-1">
              Use at least 8 characters. Include letters, numbers, and a symbol for a stronger password.
            </p>
          </div>

          <PasswordInput
            label="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
          <PasswordInput
            label="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          {newPassword && (
            <p className="text-xs text-muted -mt-2">
              Strength: <span className="font-medium text-slate-700">{strengthHint}</span>
            </p>
          )}
          <PasswordInput
            label="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
            required
          />

          <Button type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
