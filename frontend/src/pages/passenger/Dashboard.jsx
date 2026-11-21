import { Link } from 'react-router-dom';
import { ArrowRight, Car } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useLive } from '../../hooks/useLive.js';
import { api } from '../../services/api.js';
import { SkeletonCard, StatusBadge } from '../../components/ui.jsx';
import { Route, TripStats } from '../../components/RideParts.jsx';

export default function PassengerDashboard() {
  const { me } = useAuth();
  const { data, loading } = useLive(() => api.activeRide().then((r) => r.ride), {
    intervalMs: 4000, realtime: { table: 'rides', filter: `passenger_id=eq.${me.user.id}` },
  });
  const first = me.profile.full_name.split(' ')[0];

  return (
    <div className="space-y-8">
      <div><h1 className="text-3xl font-bold sm:text-4xl">Hello, {first}</h1><p className="mt-1 text-muted">Where would you like to go today?</p></div>

      <Link to="/passenger/book" className="card flex items-center justify-between transition hover:shadow-md">
        <div className="flex items-center gap-4">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-ink"><Car className="h-5 w-5 text-white" aria-hidden /></span>
          <div><p className="font-semibold">Book a ride</p><p className="text-sm text-muted">Enter pickup and destination, see your fare, find a driver.</p></div>
        </div>
        <ArrowRight className="hidden h-5 w-5 text-muted sm:block" aria-hidden />
      </Link>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Current ride</h2>
        {loading ? <SkeletonCard /> : data ? (
          <Link to={`/passenger/ride/${data.id}`} className="card block space-y-5 transition hover:shadow-md">
            <div className="flex items-center justify-between"><StatusBadge status={data.status} />
              <span className="text-sm font-medium text-accent">View ride</span></div>
            <Route pickup={data.pickup.address} destination={data.destination.address} />
            <TripStats {...data} />
            {data.driver && <p className="text-sm text-ink-soft">Driver: <strong>{data.driver.name}</strong> · {data.driver.vehicle_model}</p>}
          </Link>
        ) : (
          <div className="card text-sm text-muted">No active ride. Your next trip will show up here.</div>
        )}
      </section>
    </div>
  );
}
