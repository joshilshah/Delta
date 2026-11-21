import { Inbox } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useOffers } from '../../hooks/useOffers.js';
import OfferCard from '../../components/OfferCard.jsx';
import { Alert, EmptyState, SkeletonCard } from '../../components/ui.jsx';

export default function DriverRequests() {
  const { me } = useAuth();
  const o = useOffers(me.driver.id, true);
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-bold sm:text-3xl">Ride requests</h1>
        <p className="mt-1 text-muted">Offers are sent to one driver at a time and expire after 30 seconds.</p></div>
      {o.actionError && <Alert>{o.actionError}</Alert>}
      {o.error && !o.data && <Alert>{o.error.message}</Alert>}
      {o.loading ? <SkeletonCard lines={4} />
        : o.offers.length === 0 ? <EmptyState icon={Inbox} title="No requests right now">Make sure you are online with a fresh location. New requests appear here automatically.</EmptyState>
          : o.offers.map((offer) => <OfferCard key={offer.id} offer={offer} busy={o.busyId === offer.id} onAccept={o.accept} onReject={o.reject} />)}
    </div>
  );
}
