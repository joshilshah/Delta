import { Check, MapPin, Navigation, Phone } from 'lucide-react';
import { inr, km, mins } from '../lib/format.js';
import { UnverifiedBadge } from './ui.jsx';

export function Route({ pickup, destination }) {
  return (
    <div className="relative space-y-4 pl-7">
      <div className="absolute left-[9px] top-3 h-[calc(100%-1.5rem)] w-px bg-line" aria-hidden />
      <div className="relative">
        <span className="absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-ink"><span className="h-1.5 w-1.5 rounded-full bg-white" /></span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Pickup</p>
        <p className="text-sm font-medium">{pickup}</p>
      </div>
      <div className="relative">
        <span className="absolute -left-7 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-accent"><MapPin className="h-3 w-3 text-white" aria-hidden /></span>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">Destination</p>
        <p className="text-sm font-medium">{destination}</p>
      </div>
    </div>
  );
}

export function TripStats({ distance_km, duration_minutes, estimated_fare }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-line rounded-xl bg-canvas py-3 text-center">
      <div><p className="text-xs text-muted">Distance</p><p className="font-semibold">{km(distance_km)}</p></div>
      <div><p className="text-xs text-muted">Time</p><p className="font-semibold">{mins(duration_minutes)}</p></div>
      <div><p className="text-xs text-muted">Fare</p><p className="font-semibold">{inr(estimated_fare)}</p></div>
    </div>
  );
}

export function FareBreakdown({ fare }) {
  const b = fare.breakdown ?? fare.fare_breakdown;
  if (!b) return null;
  const km_ = fare.distance_km;
  const min_ = fare.duration_minutes;
  const rows = [
    ['Base fare', inr(b.base_fare)],
    [`Distance  ${Number(km_).toFixed(1)} km × ${inr(b.per_km_rate)}`, inr(b.distance_charge)],
    [`Time  ${Math.round(min_)} min × ${inr(b.per_minute_rate)}`, inr(b.time_charge)],
  ];
  return (
    <div className="rounded-xl border border-line">
      <dl className="divide-y divide-line text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><dt className="text-ink-soft">{k}</dt><dd className="font-medium">{v}</dd></div>
        ))}
        <div className="flex justify-between bg-canvas px-4 py-3 text-base font-semibold">
          <dt>Estimated fare</dt><dd>{inr(fare.estimated_fare)}</dd>
        </div>
      </dl>
      {(fare.route_source === 'mock' || b.route_source === 'mock') && (
        <p className="border-t border-line px-4 py-2 text-xs text-amber-700">Demo estimate: straight-line distance, not Google Routes.</p>
      )}
    </div>
  );
}

const STEPS = [
  ['searching', 'Finding driver'],
  ['accepted', 'Driver confirmed'],
  ['in_progress', 'On trip'],
  ['completed', 'Completed'],
];

export function Timeline({ status }) {
  const idx = STEPS.findIndex(([s]) => s === (status === 'requested' ? 'searching' : status));
  return (
    <ol className="flex items-center justify-between gap-1" aria-label="Ride progress">
      {STEPS.map(([key, label], i) => {
        const done = idx > i || status === 'completed';
        const current = idx === i && status !== 'completed';
        return (
          <li key={key} className="flex flex-1 flex-col items-center gap-1.5 text-center">
            <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition ${
              done ? 'bg-success text-white' : current ? 'bg-ink text-white' : 'bg-gray-200 text-muted'}`}>
              {done ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
            </span>
            <span className={`text-[11px] leading-tight sm:text-xs ${current || done ? 'font-medium text-ink' : 'text-muted'}`}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ContactCard({ title, person, vehicle, verified }) {
  return (
    <div className="card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{title}</p>
          <p className="truncate text-lg font-semibold">{person.name}</p>
        </div>
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-ink text-sm font-semibold text-white">
          {person.name?.slice(0, 1).toUpperCase()}
        </span>
      </div>
      {vehicle && (
        <div className="flex items-center gap-3 rounded-xl bg-canvas p-3 text-sm">
          <Navigation className="h-4 w-4 text-muted" aria-hidden />
          <div><p className="font-medium">{vehicle.vehicle_model}</p><p className="font-mono text-xs tracking-wider text-ink-soft">{vehicle.vehicle_registration}</p></div>
        </div>
      )}
      {vehicle && verified === false && <UnverifiedBadge />}
      {person.phone ? (
        <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} className="btn-accent w-full">
          <Phone className="h-4 w-4" aria-hidden /> Call {person.phone}
        </a>
      ) : (
        <p className="text-xs text-muted">Phone number is only shared while the ride is active.</p>
      )}
    </div>
  );
}
