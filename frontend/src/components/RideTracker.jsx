import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, RotateCcw, SearchX, XCircle } from 'lucide-react';
import { api } from '../services/api.js';
import { useCountdown, useLive } from '../hooks/useLive.js';
import { inr } from '../lib/format.js';
import { Alert, SkeletonCard, Spinner, StatusBadge } from './ui.jsx';
import { ContactCard, FareBreakdown, Route, Timeline, TripStats } from './RideParts.jsx';

function MatchingProgress({ matching }) {
  const left = useCountdown(matching?.offer_seconds_left ?? null, matching?.attempt);
  return (
    <div className="card flex flex-col items-center py-10 text-center" aria-live="polite">
      <div className="relative mb-5 grid h-16 w-16 place-items-center">
        <span className="absolute inset-0 animate-ping rounded-full bg-blue-100" />
        <span className="relative grid h-12 w-12 place-items-center rounded-full bg-ink"><Spinner className="h-5 w-5 text-white" /></span>
      </div>
      <h2 className="text-lg font-semibold">Finding your driver…</h2>
      <p className="mt-1 max-w-xs text-sm text-muted">
        We ask the closest driver first. If they can't take it, we move to the next one automatically.
      </p>
      <p className="mt-4 text-xs font-medium text-ink-soft">
        {matching?.attempt ? `Driver ${matching.attempt} contacted` : 'Searching nearby'}
        {left != null && left > 0 ? ` · waiting ${left}s for a reply` : ''}
      </p>
    </div>
  );
}

/** Live ride view shared by the booking page and /passenger/ride/:id. */
export default function RideTracker({ rideId, onRetry }) {
  const { data, error, loading, refresh, setData } = useLive(() => api.getRide(rideId).then((r) => r.ride), {
    intervalMs: 2500,
    realtime: { table: 'rides', filter: `id=eq.${rideId}` },
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const ride = data;

  async function cancel() {
    if (!window.confirm('Cancel this ride?')) return;
    setBusy(true);
    setActionError(null);
    try { setData((await api.cancelRide(rideId)).ride); } catch (e) { setActionError(e.message); refresh(); } finally { setBusy(false); }
  }

  if (loading) return <SkeletonCard lines={5} />;
  if (error && !ride) return <Alert>{error.status === 404 ? 'This ride could not be found.' : error.message}</Alert>;
  if (!ride) return null;

  const { status } = ride;
  const live = ['requested', 'searching', 'accepted', 'in_progress'].includes(status);

  return (
    <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
      <div className="space-y-5">
        {error && <Alert tone="warn">Connection problem, retrying… ({error.message})</Alert>}
        {actionError && <Alert>{actionError}</Alert>}

        <div className="card space-y-5">
          <div className="flex items-center justify-between"><h2 className="font-semibold">Ride status</h2><StatusBadge status={status} /></div>
          {live && <Timeline status={status} />}
        </div>

        {['requested', 'searching'].includes(status) && <MatchingProgress matching={ride.matching} />}

        {status === 'unmatched' && (
          <div className="card flex flex-col items-center py-10 text-center">
            <SearchX className="mb-3 h-8 w-8 text-amber-600" aria-hidden />
            <h2 className="text-lg font-semibold">No driver available right now</h2>
            <p className="mt-1 max-w-sm text-sm text-muted">No eligible driver accepted within 10 km. Nothing was charged. Please try again.</p>
            {onRetry ? <button className="btn-primary mt-5" onClick={onRetry}><RotateCcw className="h-4 w-4" aria-hidden /> Try again</button>
              : <Link to="/passenger/book" className="btn-primary mt-5"><RotateCcw className="h-4 w-4" aria-hidden /> Book again</Link>}
          </div>
        )}

        {status === 'cancelled' && (
          <div className="card flex flex-col items-center py-10 text-center">
            <XCircle className="mb-3 h-8 w-8 text-danger" aria-hidden />
            <h2 className="text-lg font-semibold">Ride cancelled</h2>
            <p className="mt-1 text-sm text-muted">Cancelled by {ride.cancelled_by === 'driver' ? 'the driver' : 'you'}.</p>
            <Link to="/passenger/book" className="btn-primary mt-5">Book another ride</Link>
          </div>
        )}

        {status === 'completed' && (
          <div className="card flex flex-col items-center py-10 text-center">
            <CheckCircle2 className="mb-3 h-8 w-8 text-success" aria-hidden />
            <h2 className="text-lg font-semibold">You've arrived</h2>
            <p className="mt-1 text-sm text-muted">Estimated fare {inr(ride.estimated_fare)}. Thanks for riding.</p>
            <Link to="/passenger/dashboard" className="btn-primary mt-5">Back to home</Link>
          </div>
        )}

        {['accepted', 'in_progress'].includes(status) && (
          <Alert tone="success">
            {status === 'accepted' ? 'Driver confirmed. They are heading to your pickup point.' : 'Your trip is in progress.'}
          </Alert>
        )}

        <div className="card space-y-5">
          <Route pickup={ride.pickup.address} destination={ride.destination.address} />
          <TripStats {...ride} />
        </div>
      </div>

      <div className="space-y-5">
        {ride.driver && <ContactCard title="Your driver" person={ride.driver} vehicle={ride.driver} verified={ride.driver.is_verified} />}
        <div className="card space-y-3"><h3 className="font-semibold">Fare</h3><FareBreakdown fare={ride} /></div>
        {ride.allowed_actions.includes('cancel') && (
          <button className="btn-danger w-full" onClick={cancel} disabled={busy}>{busy && <Spinner />} Cancel ride</button>
        )}
      </div>
    </div>
  );
}
