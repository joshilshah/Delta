import { Check, X } from 'lucide-react';
import { useCountdown } from '../hooks/useLive.js';
import { Route, TripStats } from './RideParts.jsx';
import { Spinner } from './ui.jsx';

const TTL = 30;

export default function OfferCard({ offer, onAccept, onReject, busy }) {
  const left = useCountdown(offer.seconds_left, offer.id);
  const expired = left === 0;
  return (
    <div className="card space-y-5 ring-2 ring-accent/20" role="group" aria-label="Incoming ride request">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-accent">New ride request</p>
          <p className="text-sm text-muted">{expired ? 'This offer has expired' : `Respond within ${left}s`}</p></div>
        <span className="grid h-12 w-12 place-items-center rounded-full border-2 border-accent text-sm font-bold text-accent tabular-nums">{left}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-gray-100" aria-hidden>
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-linear" style={{ width: `${Math.min(100, (left / TTL) * 100)}%` }} />
      </div>
      <Route pickup={offer.pickup_address} destination={offer.destination_address} />
      <TripStats {...offer} />
      <div className="grid grid-cols-2 gap-3">
        <button className="btn-outline" disabled={busy || expired} onClick={() => onReject(offer)}><X className="h-4 w-4" aria-hidden /> Reject</button>
        <button className="btn-success" disabled={busy || expired} onClick={() => onAccept(offer)}>
          {busy ? <Spinner /> : <Check className="h-4 w-4" aria-hidden />} Accept
        </button>
      </div>
    </div>
  );
}
