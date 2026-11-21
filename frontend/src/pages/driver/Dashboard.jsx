import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Inbox, LocateFixed } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLive } from '../../hooks/useLive.js';
import { useOffers } from '../../hooks/useOffers.js';
import { useDriverLocation } from '../../hooks/useDriverLocation.js';
import { api } from '../../services/api.js';
import OfferCard from '../../components/OfferCard.jsx';
import { Route, TripStats } from '../../components/RideParts.jsx';
import { Alert, EmptyState, SkeletonCard, Spinner, StatusBadge, UnverifiedBadge } from '../../components/ui.jsx';

export default function DriverDashboard() {
  const { me } = useAuth();
  const state = useLive(() => api.me().then((r) => r.driver), { intervalMs: 5000 });
  const driver = state.data ?? me.driver;
  const online = Boolean(driver?.is_online);
  const loc = useDriverLocation({ online, onUpdated: state.refresh });
  const offers = useOffers(me.driver.id, online);
  const [toggling, setToggling] = useState(false);
  const [toggleError, setToggleError] = useState(null);

  const active = useLive(() => api.activeRide().then((r) => r.ride), {
    intervalMs: 4000, realtime: { table: 'rides', filter: `driver_id=eq.${me.driver.id}` },
  });

  async function toggle() {
    setToggling(true);
    setToggleError(null);
    try {
      const { driver: next } = await api.setAvailability(!online);
      state.setData(next);
    } catch (e) { setToggleError(e.message); } finally { setToggling(false); }
  }

  const first = me.profile.full_name.split(' ')[0];
  const hasActive = Boolean(active.data);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-3xl font-bold sm:text-4xl">Hello, {first}</h1>
          <p className="mt-1 text-muted">{driver?.vehicle_model} · <span className="font-mono">{driver?.vehicle_registration}</span></p></div>
        <UnverifiedBadge />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">Availability</p>
              <p className={`text-xl font-semibold ${online ? 'text-success' : 'text-ink'}`}>{online ? 'Online' : 'Offline'}</p>
              <p className="text-sm text-muted">{online ? 'You can receive ride requests.' : 'You will not receive requests.'}</p>
            </div>
            <button role="switch" aria-checked={online} aria-label="Toggle availability" onClick={toggle} disabled={toggling || state.loading}
              className={`relative h-9 w-16 shrink-0 rounded-full transition ${online ? 'bg-success' : 'bg-gray-300'} disabled:opacity-60`}>
              <span className={`absolute left-1 top-1 grid h-7 w-7 place-items-center rounded-full bg-white shadow transition-transform ${online ? 'translate-x-7' : ''}`}>
                {toggling && <Spinner className="h-3 w-3 text-muted" />}
              </span>
            </button>
          </div>
          {toggleError && <Alert>{toggleError}</Alert>}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2"><LocateFixed className="h-4 w-4 text-muted" aria-hidden /><h2 className="font-semibold">Location</h2></div>
          {!online ? <p className="text-sm text-muted">Go online to share your location with the dispatcher.</p> : (
            <>
              {loc.message && <Alert tone={loc.status === 'denied' ? 'warn' : 'error'}>{loc.message}</Alert>}
              {!loc.message && driver?.location && (
                <p className={`text-sm ${driver.location_is_fresh ? 'text-success' : 'text-amber-700'}`}>
                  {driver.location_is_fresh ? 'Location is fresh.' : 'Location is stale: you will not be matched until you update it.'}
                  <span className="block text-xs text-muted">Last update {new Date(driver.location.updated_at).toLocaleTimeString()}</span>
                </p>
              )}
              {!driver?.location && !loc.message && <p className="text-sm text-amber-700">No location yet. Share it so riders nearby can reach you.</p>}
              <div className="flex flex-wrap items-center gap-3">
                <button className="btn-outline" onClick={loc.share} disabled={loc.status === 'asking'}>
                  {loc.status === 'asking' ? <Spinner /> : <LocateFixed className="h-4 w-4" aria-hidden />} Update my location
                </button>
                <label className="flex items-center gap-2 text-sm text-ink-soft">
                  <input type="checkbox" checked={loc.auto} onChange={(e) => loc.setAuto(e.target.checked)} />
                  Refresh every 30 s while this page is open
                </label>
              </div>
            </>
          )}
        </div>
      </div>

      {hasActive && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Active ride</h2>
          <Link to={`/driver/ride/${active.data.id}`} className="card block space-y-5 transition hover:shadow-md">
            <div className="flex items-center justify-between"><StatusBadge status={active.data.status} /><span className="inline-flex items-center gap-1 text-sm font-medium text-accent">Open controls <ArrowRight className="h-4 w-4" aria-hidden /></span></div>
            <Route pickup={active.data.pickup.address} destination={active.data.destination.address} />
            <TripStats {...active.data} />
          </Link>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Incoming requests</h2>
        {offers.actionError && <Alert>{offers.actionError}</Alert>}
        {!online ? <EmptyState icon={Inbox} title="You're offline">Go online to start receiving ride requests.</EmptyState>
          : offers.loading ? <SkeletonCard lines={4} />
            : offers.offers.length === 0 ? <EmptyState icon={Inbox} title="Waiting for requests">New requests appear here automatically. Keep this page open.</EmptyState>
              : offers.offers.map((o) => <OfferCard key={o.id} offer={o} busy={offers.busyId === o.id} onAccept={offers.accept} onReject={offers.reject} />)}
      </section>
    </div>
  );
}
