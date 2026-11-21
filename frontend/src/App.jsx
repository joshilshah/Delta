import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/Layout.jsx';
import { useAuth } from './context/AuthContext.jsx';
import Landing from './pages/Landing.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import PassengerDashboard from './pages/passenger/Dashboard.jsx';
import PassengerBook from './pages/passenger/Book.jsx';
import PassengerRide from './pages/passenger/Ride.jsx';
import DriverDashboard from './pages/driver/Dashboard.jsx';
import DriverRequests from './pages/driver/Requests.jsx';
import DriverRide from './pages/driver/Ride.jsx';

function PublicOnly({ children }) {
  const { me } = useAuth();
  return me ? <Navigate to={`/${me.user.role}/dashboard`} replace /> : children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />

      <Route element={<ProtectedRoute role="passenger" />}>
        <Route path="/passenger/dashboard" element={<PassengerDashboard />} />
        <Route path="/passenger/book" element={<PassengerBook />} />
        <Route path="/passenger/ride/:id" element={<PassengerRide />} />
      </Route>

      <Route element={<ProtectedRoute role="driver" />}>
        <Route path="/driver/dashboard" element={<DriverDashboard />} />
        <Route path="/driver/requests" element={<DriverRequests />} />
        <Route path="/driver/ride/:id" element={<DriverRide />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
