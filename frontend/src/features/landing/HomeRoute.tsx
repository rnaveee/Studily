import { Navigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import FullScreenSpinner from "../../components/FullScreenSpinner";
import OfflineRetry from "../../components/OfflineRetry";
import LandingPage from "./LandingPage";

export default function HomeRoute() {
  const { user, guest, loading, expired, bootFailed, retry } = useAuth();

  if (loading) return <FullScreenSpinner />;
  if (bootFailed && !user) return <OfflineRetry onRetry={retry} />;
  if (expired) return <Navigate to="/login?expired=1" replace />;
  if (user || guest) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}
