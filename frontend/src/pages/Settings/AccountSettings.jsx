import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { KeyRound, User, Save } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { useAuth } from '@/context/AuthContext';
import { authApi } from '@/services';

export default function AccountSettings() {
  const { user, setUser } = useAuth();

  // Profile Form state
  const [profileName, setProfileName] = useState(user?.name || '');
  const [profileEmail, setProfileEmail] = useState(user?.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileName(user.name || '');
      setProfileEmail(user.email || '');
    }
  }, [user]);

  // Password state
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

  const onUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName.trim() || !profileEmail.trim()) {
      return toast.error('Name and email are required');
    }
    setSavingProfile(true);
    try {
      const res = await authApi.updateProfile({
        name: profileName.trim(),
        email: profileEmail.trim(),
      });
      if (res?.user && setUser) {
        setUser((prev) => ({ ...prev, ...res.user }));
      }
      toast.success('Profile details updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update profile');
    } finally {
      setSavingProfile(false);
    }
  };

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
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-lg font-bold text-slate-900">Account &amp; Profile</h2>
        <p className="text-sm text-muted">Manage your personal profile information, email address, and security password.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Edit Profile Form */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/80">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <User size={18} />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900">Profile Details</h3>
              <p className="text-xs text-muted">Update your display name and login email.</p>
            </div>
          </div>

          <form onSubmit={onUpdateProfile} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name *</label>
              <Input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address *</label>
              <Input
                type="email"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
                placeholder="your.email@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Assigned Role</label>
              <Input
                value={user?.role === 'admin' ? 'Administrator' : 'Staff / Employee'}
                disabled
                className="bg-slate-50 text-slate-500 cursor-not-allowed capitalize font-medium"
              />
            </div>

            <div className="pt-2">
              <Button type="submit" disabled={savingProfile} className="text-xs flex items-center gap-1.5">
                <Save className="w-3.5 h-3.5" />
                {savingProfile ? 'Saving...' : 'Save Profile Details'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Change Password Form */}
        <Card className="p-5 space-y-4">
          <div className="flex items-center gap-2.5 pb-2 border-b border-border/80">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="font-heading text-sm font-bold text-slate-900">Security &amp; Password</h3>
              <p className="text-xs text-muted">Ensure your account uses a secure password.</p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5">
            <PasswordInput
              label="Current Password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
            />
            <PasswordInput
              label="New Password"
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
              label="Confirm New Password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPassword && newPassword !== confirmPassword ? 'Passwords do not match' : ''}
              required
            />

            <div className="pt-2">
              <Button type="submit" disabled={loading} className="text-xs">
                {loading ? 'Updating…' : 'Update Password'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
