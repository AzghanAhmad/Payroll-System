import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { KeyRound, Copy, Check } from 'lucide-react';
import { authApi } from '@/services';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import AuthLayout from './AuthLayout';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setCopied(false);
    try {
      const data = await authApi.forgotPassword(email.trim());
      setResult(data);
      toast.success(data.message || 'Password reset');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = async () => {
    if (!result?.newPassword) return;
    try {
      await navigator.clipboard.writeText(result.newPassword);
      setCopied(true);
      toast.success('Password copied');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — select and copy manually');
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your account email. If it matches, we’ll create a new password for you."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      {!result?.newPassword ? (
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
            {loading ? 'Resetting…' : 'Reset password'}
          </Button>
        </form>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-white border border-emerald-100 p-2 text-emerald-700">
                <KeyRound size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-emerald-900">New password ready</p>
                <p className="text-sm text-emerald-800/80 mt-1">{result.message}</p>
                <p className="text-xs text-emerald-800/70 mt-2">Account: {result.email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-white p-4 space-y-2">
            <p className="text-xs font-medium text-muted uppercase tracking-wide">Your new password</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 break-all rounded-xl bg-slate-50 border border-border px-3 py-2.5 text-base font-semibold text-slate-900 tracking-wide">
                {result.newPassword}
              </code>
              <button
                type="button"
                onClick={copyPassword}
                className="shrink-0 rounded-xl border border-border p-2.5 hover:bg-slate-50 cursor-pointer"
                title="Copy password"
              >
                {copied ? <Check size={18} className="text-emerald-600" /> : <Copy size={18} />}
              </button>
            </div>
            <p className="text-xs text-muted">
              Copy this password, then sign in. You can change it anytime in Settings → Account.
            </p>
          </div>

          <Link
            to="/login"
            className="flex items-center justify-center w-full h-11 rounded-2xl bg-primary text-white text-sm font-medium hover:opacity-95"
          >
            Go to sign in
          </Link>

          <button
            type="button"
            className="w-full text-sm text-muted hover:text-primary cursor-pointer"
            onClick={() => {
              setResult(null);
              setEmail('');
            }}
          >
            Reset another account
          </button>
        </div>
      )}
    </AuthLayout>
  );
}

/** Kept for old email links — redirects users to forgot-password flow */
export function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Reset password"
      subtitle="Password reset now works from Forgot password — we’ll generate a new password for you."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Back to sign in
        </Link>
      }
    >
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">
          Enter your email on the forgot password page to get a new password instantly.
        </p>
        <Link
          to="/forgot-password"
          className="inline-flex items-center justify-center w-full h-11 rounded-2xl bg-primary text-white text-sm font-medium"
        >
          Go to Forgot password
        </Link>
      </div>
    </AuthLayout>
  );
}
