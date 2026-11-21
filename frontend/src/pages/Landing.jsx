import { Link } from 'react-router-dom';
import { ArrowRight, Clock, IndianRupee, MapPinned } from 'lucide-react';
import { Logo } from '../components/Layout.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const FEATURES = [
  [MapPinned, 'Nearest driver, first', 'Requests go to the closest available driver, one at a time, with automatic fallback.'],
  [IndianRupee, 'Fare you can read', 'Base fare, distance and time shown line by line before you book.'],
  [Clock, 'Live status', 'Watch your ride move from searching to confirmed to completed, without refreshing.'],
];

export default function Landing() {
  const { me } = useAuth();
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
        <Logo />
        <div className="flex items-center gap-2">
          {me ? (
            <Link to={`/${me.user.role}/dashboard`} className="btn-primary">Open dashboard</Link>
          ) : (
            <>
              <Link to="/login" className="btn-outline">Log in</Link>
              <Link to="/signup" className="btn-primary hidden sm:inline-flex">Sign up</Link>
            </>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 pb-16 pt-14 sm:pt-24">
        <p className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-accent">Phase 1 hackathon MVP</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-[1.1] sm:text-6xl">Get where you're going, without the wait.</h1>
        <p className="mt-5 max-w-xl text-lg text-ink-soft">
          Book a ride in seconds. Glide finds the closest available driver and keeps you updated until they arrive.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link to="/signup?role=passenger" className="btn-primary px-6 py-3.5">Book a ride <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          <Link to="/signup?role=driver" className="btn-outline px-6 py-3.5">Drive with Glide</Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 pb-16 sm:grid-cols-3">
        {FEATURES.map(([Icon, title, text]) => (
          <div key={title} className="card">
            <span className="mb-4 grid h-10 w-10 place-items-center rounded-xl bg-canvas"><Icon className="h-5 w-5" aria-hidden /></span>
            <h3 className="font-semibold">{title}</h3>
            <p className="mt-1.5 text-sm text-ink-soft">{text}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-line py-8 text-center text-xs text-muted">
        Demo project. Drivers are unverified and there is no production driver verification.
      </footer>
    </div>
  );
}
