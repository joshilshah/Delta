import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api.js';
import { useLive } from './useLive.js';

/** Live pending offers for the signed-in driver + accept/reject actions. */
export function useOffers(driverId, enabled) {
  const navigate = useNavigate();
  const live = useLive(() => api.offers().then((r) => r.offers), {
    intervalMs: 2000, enabled, realtime: { table: 'ride_offers', filter: `driver_id=eq.${driverId}` },
  });
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  async function act(offer, fn, after) {
    setBusyId(offer.id);
    setError(null);
    try { await after(await fn(offer.id)); } catch (e) { setError(e.message); } finally { setBusyId(null); live.refresh(); }
  }
  const accept = (offer) => act(offer, api.acceptOffer, (r) => navigate(`/driver/ride/${r.ride.id}`));
  const reject = (offer) => act(offer, api.rejectOffer, () => {});

  return { ...live, offers: live.data ?? [], busyId, actionError: error, accept, reject };
}
