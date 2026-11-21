import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../components/Layout.jsx';
import { Alert, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { signIn, configured } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(form.email.trim(), form.password);
    if (err) { setError(err.message); setBusy(false); }
    // On success the auth listener loads the account and PublicOnly redirects to the right dashboard.
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="card space-y-5">
          <div><h1 className="text-2xl font-bold">Welcome back</h1><p className="mt-1 text-sm text-muted">Log in to continue.</p></div>
          {!configured && <Alert tone="warn">Supabase is not configured. See the README.</Alert>}
          {error && <Alert>{error}</Alert>}
          <div><label className="label" htmlFor="email">Email</label>
            <input id="email" type="email" required autoComplete="email" className="input" value={form.email} onChange={set('email')} /></div>
          <div><label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" required autoComplete="current-password" className="input" value={form.password} onChange={set('password')} /></div>
          <button className="btn-primary w-full" disabled={busy || !configured}>{busy && <Spinner />} Log in</button>
          <p className="text-center text-sm text-muted">New here? <Link to="/signup" className="font-semibold text-accent">Create an account</Link></p>
        </form>
      </div>
    </div>
  );
}
