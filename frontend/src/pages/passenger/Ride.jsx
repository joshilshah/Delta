import { useParams } from 'react-router-dom';
import RideTracker from '../../components/RideTracker.jsx';

export default function PassengerRide() {
  const { id } = useParams();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold sm:text-3xl">Your ride</h1>
      <RideTracker key={id} rideId={id} />
    </div>
  );
}
