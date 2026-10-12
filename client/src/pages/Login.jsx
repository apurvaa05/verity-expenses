import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function submit(e) {
    e.preventDefault();
    if (!email.trim() || !password) return setError('Enter your work email and password to continue.');
    setBusy(true);
    setError('');
    try {
      await login(email.trim(), password);
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="card login" onSubmit={submit} noValidate>
        <span className="brand-mark" aria-hidden="true">V</span>
        <div className="eyebrow">Verity Expenses · Secure workspace</div>
        <h1>Good to see you.</h1>
        <p className="muted">Sign in to prepare vouchers, review requests, and keep expense records moving.</p>
        <div className="field">
          <label htmlFor="email">Work email</label>
          <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" placeholder="you@company.com" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="Enter your password" />
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Signing you in…' : 'Sign in to workspace'}</button>
        <p className="muted small" style={{ textAlign: 'center', marginTop: '.75rem' }}>Access is based on your assigned role.</p>
      </form>
    </div>
  );
}
