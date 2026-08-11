import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";
import FullScreenSpinner from "./FullScreenSpinner";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, guest, loading, expired } = useAuth();

  if (loading) return <FullScreenSpinner />;

  if (!user && !guest) {
    return <Navigate to={expired ? "/login?expired=1" : "/login"} replace />;
  }
  return <>{children}</>;
}
