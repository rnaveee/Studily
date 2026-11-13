import { useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { saveReferral } from "../../lib/referral";
import FullScreenSpinner from "../../components/FullScreenSpinner";
import GreenHeart from "./GreenHeart";

interface InvitePreview {
  inviterName: string;
}

const CODE = /^[A-Za-z0-9_-]{1,32}$/;

export default function InviteLanding() {
  const { code = "" } = useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const valid = CODE.test(code);

  useEffect(() => {
    if (valid && !loading && !user) saveReferral(code);
  }, [code, valid, loading, user]);

  useEffect(() => {
    if (!loading && user) navigate("/dashboard", { replace: true });
  }, [loading, user, navigate]);

  const invite = useQuery({
    queryKey: ["invites", code],
    queryFn: () => api.get<InvitePreview>(`/public/invites/${encodeURIComponent(code)}`),
    enabled: valid && !loading && !user,
    retry: false,
  });

  if (!valid) return <Navigate to="/signup" replace />;
  if (loading || user) return <FullScreenSpinner />;
  if (invite.isError && invite.error instanceof ApiError && invite.error.status === 404) {
    return <Navigate to="/signup" replace />;
  }

  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-5 px-2 py-12 text-center">
      <GreenHeart size={72} glow />
      {invite.data ? (
        <h1 className="text-xl font-semibold text-fg">{invite.data.inviterName} invited you to Studily</h1>
      ) : (
        <h1 className="text-xl font-semibold text-fg">You're invited to Studily</h1>
      )}
      <p className="text-[13px] leading-relaxed text-fg-2">
        A free planner for your schedule, deadlines, grades, flashcards and study sessions.
      </p>
      <Link to="/signup" className="btn btn-primary">
        Create your account
      </Link>
      <Link to="/login" className="text-[12px] text-fg-3 transition-colors hover:text-fg-2">
        Already have an account? Log in
      </Link>
    </div>
  );
}
