import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Search } from 'lucide-react';
import PlaceInput from '../../components/PlaceInput.jsx';
import RideTracker from '../../components/RideTracker.jsx';
import { FareBreakdown, TripStats } from '../../components/RideParts.jsx';
import { Alert, SkeletonCard, Spinner } from '../../components/ui.jsx';
import { api } from '../../services/api.js';

const newKey = () => `bk-${crypto.randomUUID()}`;

export default function PassengerBook() {
  const [pickup, setPickup] = useState(null);
  const [destination, setDestination] = useState(null);
  const [fare, setFare] = useState(null);
  const [fareError, setFareError] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [rideId, setRideId] = useState(null);
  const [existing, setExisting] = useState(undefined); // undefined = still checking
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const key = useRef(newKey()); // one idempotency key per booking attempt

  // Recover an open ride after refresh / navigation.
  useEffect(() => {
    api.activeRide().then((r) => setExisting(r.ride)).catch(() => setExisting(null));
  }, []);

  // Price the trip on the server whenever both locations are confirmed.
  useEffect(() => {
    if (!pickup || !destination) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      setFare(null);
      setFareError(null);
      setEstimating(true);
      api.estimateFare(pickup, destination)
        .then((f) => !cancelled && setFare(f))
        .catch((e) => !cancelled && setFareError(e.message))
        .finally(() => !cancelled && setEstimating(false));
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [pickup, destination]);

  function changePickup(p) { setPickup(p); setFare(null); setFareError(null); }
  function changeDestination(d) { setDestination(d); setFare(null); setFareError(null); }

  async function findDriver() {
    if (submitting || !pickup || !destination || !fare) return; // guards repeated clicks
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { ride } = await api.createRide(pickup, destination, key.current);
      setRideId(ride.id);
    } catch (e) {
      if (e.code === 'ACTIVE_RIDE_EXISTS' && e.details?.ride_id) setRideId(e.details.ride_id);
      else setSubmitError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  function retry() {
    key.current = newKey();
    setRideId(null);
  }

  if (existing === undefined) return <SkeletonCard lines={4} />;

  if (rideId || existing) {
    const id = rideId ?? existing.id;
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold sm:text-3xl">{rideId ? 'Booking your ride' : 'You have an active ride'}</h1>
          <Link to={`/passenger/ride/${id}`} className="btn-outline">Open ride page</Link>
        </div>
        <RideTracker rideId={id} onRetry={() => { setExisting(null); retry(); }} />
      </div>
    );
  }

  const ready = pickup && destination && fare && !estimating;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Where to?</h1><p className="mt-1 text-muted">Pick a location from the suggestions to confirm it.</p></div>

      <div className="card space-y-5">
        <PlaceInput label="Pickup" placeholder="Enter pickup location" value={pickup} onChange={changePickup} />
        <PlaceInput label="Destination" placeholder="Where are you going?" value={destination} onChange={changeDestination} icon={MapPin} />
      </div>

      {estimating && <SkeletonCard lines={3} />}
      {fareError && <Alert>{fareError}</Alert>}
      {fare && !estimating && (
        <div className="card space-y-4">
          <h2 className="font-semibold">Fare estimate</h2>
          <TripStats {...fare} />
          <FareBreakdown fare={fare} />
        </div>
      )}
      {submitError && <Alert>{submitError}</Alert>}

      <button className="btn-accent w-full !py-4 text-base" disabled={!ready || submitting} onClick={findDriver}>
        {submitting ? <Spinner /> : <Search className="h-4 w-4" aria-hidden />} Find Driver
      </button>
    </div>
  );
}
