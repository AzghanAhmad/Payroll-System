import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { Button } from '@/components/ui/Button';
import AuthLayout from './AuthLayout';

export default function SignupPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const passwordError = useMemo(() => {
    if (!touched && !confirm) return '';
    if (password.length > 0 && password.length < 6) return 'Password must be at least 6 characters';
    if (confirm && password !== confirm) return 'Passwords do not match';
    return '';
  }, [password, confirm, touched]);

  const confirmError = useMemo(() => {
    if (!confirm && !touched) return '';
    if (confirm && password !== confirm) return 'Passwords do not match';
    return '';
  }, [password, confirm, touched]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setTouched(true);
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
      await register({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      toast.success('Account created');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Set up access to the payroll workspace in a few steps."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          label="Full name"
          type="text"
          autoComplete="name"
          placeholder="Sione Tau"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <PasswordInput
          label="Password"
          autoComplete="new-password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched(true)}
          error={passwordError && password.length > 0 && password.length < 6 ? passwordError : ''}
          required
          minLength={6}
        />
        <PasswordInput
          label="Confirm password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value);
            setTouched(true);
          }}
          error={confirmError}
          required
          minLength={6}
        />

        <Button
          type="submit"
          className="w-full h-11 mt-1"
          disabled={loading || (touched && Boolean(confirmError))}
        >
          {loading ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  );
}
