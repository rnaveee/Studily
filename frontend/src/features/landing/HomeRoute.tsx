import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import FullScreenSpinner from "../../components/FullScreenSpinner";
import LandingPage from "./LandingPage";

export default function HomeRoute() {
  const { user, guest, loading, expired } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (expired) return <Navigate to="/login?expired=1" replace />;
  if (user || guest) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}
