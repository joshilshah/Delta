import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { LogOut, Navigation } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { Alert, FullPageSpinner } from './ui.jsx';

export function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 text-lg font-bold tracking-tight">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink"><Navigation className="h-4 w-4 text-accent" aria-hidden /></span>
      Glide
    </Link>
  );
}

const NAV = {
  passenger: [['/passenger/dashboard', 'Home'], ['/passenger/book', 'Book a ride']],
  driver: [['/driver/dashboard', 'Dashboard'], ['/driver/requests', 'Requests']],
};

function AppShell() {
  const { me, role, signOut } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4">
          <Logo to={`/${role}/dashboard`} />
          <nav className="flex items-center gap-1" aria-label="Main">
            {NAV[role].map(([to, label]) => (
              <NavLink key={to} to={to} className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-canvas text-ink' : 'text-muted hover:text-ink'}`}>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:block">{me.profile.full_name}</span>
            <button onClick={signOut} className="btn-outline !px-3 !py-2" aria-label="Sign out"><LogOut className="h-4 w-4" aria-hidden /></button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:py-10"><Outlet /></main>
    </div>
  );
}

/** Requires a signed-in user with the given role; wraps pages in the app shell. */
export function ProtectedRoute({ role }) {
  const { session, me, loading, error, configured, refresh } = useAuth();
  const location = useLocation();
  if (!configured) {
    return <div className="mx-auto max-w-lg p-6"><Alert tone="warn">Supabase is not configured. Add the frontend environment variables (see README).</Alert></div>;
  }
  if (loading) return <FullPageSpinner />;
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (!me) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Alert>{error ?? 'Could not load your account.'}</Alert>
        <button className="btn-primary" onClick={refresh}>Try again</button>
      </div>
    );
  }
  if (me.user.role !== role) return <Navigate to={`/${me.user.role}/dashboard`} replace />;
  return <AppShell />;
}
