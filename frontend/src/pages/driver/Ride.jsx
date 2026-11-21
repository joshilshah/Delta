import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Flag, Play, XCircle } from 'lucide-react';
import { useLive } from '../../hooks/useLive.js';
import { api } from '../../services/api.js';
import { inr } from '../../lib/format.js';
import { Alert, SkeletonCard, Spinner, StatusBadge } from '../../components/ui.jsx';
import { ContactCard, FareBreakdown, Route, TripStats } from '../../components/RideParts.jsx';

export default function DriverRide() {
  const { id } = useParams();
  const { data: ride, error, loading, refresh, setData } = useLive(() => api.getRide(id).then((r) => r.ride), {
    intervalMs: 2500, realtime: { table: 'rides', filter: `id=eq.${id}` },
  });
  const [busy, setBusy] = useState(null);
  const [actionError, setActionError] = useState(null);

  async function run(name, fn, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(name);
    setActionError(null);
    try { setData((await fn(id)).ride); } catch (e) { setActionError(e.message); refresh(); } finally { setBusy(null); }
  }

  if (loading) return <SkeletonCard lines={5} />;
  if (error && !ride) return <Alert>{error.status === 404 ? 'This ride could not be found.' : error.message}</Alert>;
  if (!ride) return null;

  const can = (a) => ride.allowed_actions.includes(a);
  const finished = ['completed', 'cancelled'].includes(ride.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold sm:text-3xl">Active ride</h1><StatusBadge status={ride.status} />
      </div>
      {actionError && <Alert>{actionError}</Alert>}
      {ride.status === 'cancelled' && <Alert tone="warn">This ride was cancelled by {ride.cancelled_by === 'driver' ? 'you' : 'the passenger'}. You are available for new requests.</Alert>}
      {ride.status === 'completed' && <Alert tone="success">Ride completed. Estimated fare {inr(ride.estimated_fare)}. You are available for new requests.</Alert>}

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <div className="space-y-5">
          <div className="card space-y-5"><Route pickup={ride.pickup.address} destination={ride.destination.address} /><TripStats {...ride} /></div>

          {!finished && (
            <div className="card space-y-3">
              <h2 className="font-semibold">Ride controls</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {can('start') && <button className="btn-accent" disabled={Boolean(busy)} onClick={() => run('start', api.startRide)}>{busy === 'start' ? <Spinner /> : <Play className="h-4 w-4" aria-hidden />} Start ride</button>}
                {can('complete') && <button className="btn-success" disabled={Boolean(busy)} onClick={() => run('complete', api.completeRide)}>{busy === 'complete' ? <Spinner /> : <Flag className="h-4 w-4" aria-hidden />} Complete ride</button>}
                {can('cancel') && <button className="btn-danger" disabled={Boolean(busy)} onClick={() => run('cancel', api.cancelRide, 'Cancel this ride? The passenger will be notified.')}>{busy === 'cancel' ? <Spinner /> : <XCircle className="h-4 w-4" aria-hidden />} Cancel ride</button>}
              </div>
            </div>
          )}
          {finished && <Link to="/driver/dashboard" className="btn-primary">{ride.status === 'completed' ? <CheckCircle2 className="h-4 w-4" aria-hidden /> : null} Back to dashboard</Link>}
        </div>

        <div className="space-y-5">
          {ride.passenger && <ContactCard title="Passenger" person={ride.passenger} />}
          <div className="card space-y-3"><h3 className="font-semibold">Fare</h3><FareBreakdown fare={ride} /></div>
        </div>
      </div>
    </div>
  );
}
