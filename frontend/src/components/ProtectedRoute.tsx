import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import FullScreenSpinner from "./FullScreenSpinner";
import OfflineRetry from "./OfflineRetry";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, guest, loading, expired, bootFailed, retry } = useAuth();

  if (loading) return <FullScreenSpinner />;

  if (bootFailed && !user) return <OfflineRetry onRetry={retry} />;

  if (!user && !guest) {
    return <Navigate to={expired ? "/login?expired=1" : "/login"} replace />;
  }
  return <>{children}</>;
}
