import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useAuth } from "../lib/auth";

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, guest, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg">
        <div className="flex items-center gap-2 text-sm text-fg-3">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
          Loading…
        </div>
      </div>
    );
  }

  if (!user && !guest) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
