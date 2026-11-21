import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Car, User } from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { Alert, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Signup() {
  const { signUp, configured } = useAuth();
  const [params] = useSearchParams();
  const [form, setForm] = useState({
    role: params.get('role') === 'driver' ? 'driver' : 'passenger',
    full_name: '', email: '', password: '', phone: '', vehicle_model: '', vehicle_registration: '',
  });
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isDriver = form.role === 'driver';

  function validate() {
    if (form.full_name.trim().length < 2) return 'Please enter your full name.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (!/^\+?[\d\s()-]{7,20}$/.test(form.phone.trim())) return 'Enter a valid phone number (7–20 digits).';
    if (isDriver && (!form.vehicle_model.trim() || !form.vehicle_registration.trim())) {
      return 'Vehicle model and registration number are required for drivers.';
    }
    return null;
  }

  async function submit(e) {
    e.preventDefault();
    const problem = validate();
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    const { data, error: err } = await signUp({
      ...form, email: form.email.trim(), full_name: form.full_name.trim(), phone: form.phone.trim(),
      vehicle_model: form.vehicle_model.trim(), vehicle_registration: form.vehicle_registration.trim().toUpperCase(),
    });
    setBusy(false);
    if (err) return setError(err.message);
    if (!data.session) setNotice('Account created. Check your email to confirm your address, then log in.');
  }

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center"><Logo /></div>
        <form onSubmit={submit} className="card space-y-5">
          <div><h1 className="text-2xl font-bold">Create your account</h1><p className="mt-1 text-sm text-muted">Your role is fixed once the account is created.</p></div>
          {!configured && <Alert tone="warn">Supabase is not configured. See the README.</Alert>}
          {error && <Alert>{error}</Alert>}
          {notice && <Alert tone="success">{notice} <Link to="/login" className="font-semibold underline">Log in</Link></Alert>}

          <fieldset>
            <legend className="label">I want to</legend>
            <div className="grid grid-cols-2 gap-3">
              {[['passenger', 'Book rides', User], ['driver', 'Drive', Car]].map(([value, label, Icon]) => (
                <label key={value} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                  form.role === value ? 'border-ink bg-ink text-white' : 'border-line bg-white hover:bg-canvas'}`}>
                  <input type="radio" name="role" value={value} className="sr-only" checked={form.role === value} onChange={set('role')} />
                  <Icon className="h-4 w-4" aria-hidden /> {label}
                </label>
              ))}
            </div>
          </fieldset>

          <div><label className="label" htmlFor="name">Full name</label><input id="name" required className="input" autoComplete="name" value={form.full_name} onChange={set('full_name')} /></div>
          <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" required className="input" autoComplete="email" value={form.email} onChange={set('email')} /></div>
          <div><label className="label" htmlFor="phone">Phone number</label><input id="phone" type="tel" required className="input" autoComplete="tel" placeholder="+91 …" value={form.phone} onChange={set('phone')} /></div>
          <div><label className="label" htmlFor="password">Password</label><input id="password" type="password" required minLength={8} className="input" autoComplete="new-password" value={form.password} onChange={set('password')} /></div>

          {isDriver && (
            <div className="space-y-5 rounded-xl border border-line bg-canvas p-4">
              <Alert tone="warn">Demo only: drivers are <strong>not verified</strong>. There is no licence or vehicle checking in this prototype.</Alert>
              <div><label className="label" htmlFor="vm">Vehicle model</label><input id="vm" className="input" placeholder="e.g. Maruti Swift Dzire" value={form.vehicle_model} onChange={set('vehicle_model')} /></div>
              <div><label className="label" htmlFor="vr">Vehicle registration number</label><input id="vr" className="input" placeholder="e.g. KA01 AB 1234" value={form.vehicle_registration} onChange={set('vehicle_registration')} /></div>
            </div>
          )}

          <button className="btn-primary w-full" disabled={busy || !configured}>{busy && <Spinner />} Create account</button>
          <p className="text-center text-sm text-muted">Already registered? <Link to="/login" className="font-semibold text-accent">Log in</Link></p>
        </form>
      </div>
    </div>
  );
}
