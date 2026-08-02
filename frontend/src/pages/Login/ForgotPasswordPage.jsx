import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authApi } from '@/services';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import AuthLayout from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await authApi.forgotPassword(email.trim());
      toast.success(data.message);
      if (data.resetToken) setToken(data.resetToken);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we’ll send a reset link if an account exists."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? 'Sending…' : 'Send reset link'}
        </Button>
        {token && (
          <p className="text-xs break-all text-muted rounded-2xl bg-slate-50 border border-border p-3">
            Dev token:{' '}
            <Link className="text-primary font-medium" to={`/reset-password?token=${token}`}>
              Open reset page
            </Link>
          </p>
        )}
      </form>
    </AuthLayout>
  );
}

export function ResetPasswordPage() {
  const params = new URLSearchParams(window.location.search);
  const [token, setToken] = useState(params.get('token') || '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword({ token, password });
      toast.success('Password updated');
      window.location.href = '/login';
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Reset password"
      subtitle="Choose a new password for your account."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Reset token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          required
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        <PasswordInput
          label="Confirm new password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={confirm && password !== confirm ? 'Passwords do not match' : ''}
          required
          minLength={6}
        />
        <Button type="submit" className="w-full h-11" disabled={loading}>
          {loading ? 'Updating…' : 'Update password'}
        </Button>
      </form>
    </AuthLayout>
  );
}
