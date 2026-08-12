import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../lib/auth";
import ProfileForm from "../profile/ProfileForm";

export default function ProfileSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/" replace />;

  const next = () => navigate("/onboarding", { replace: true });

  return (
    <div className="mx-auto w-full max-w-lg space-y-5 py-4 animate-in">
      <div className="text-center">
        <img src="/studily-3a.svg" alt="" className="mx-auto mb-3 h-14 w-14" />
        <h1 className="text-2xl font-bold text-fg">Finish creating your profile!</h1>
        <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-fg-2">
          Add a photo and a few details so schoolmates can recognize you. You can change any of
          this later from your profile.
        </p>
      </div>

      <ProfileForm
        submitLabel="Save and continue"
        savingLabel="Saving…"
        onSaved={next}
        secondaryAction={
          <button type="button" onClick={next} className="btn btn-ghost">
            No thanks, I'll do it later
          </button>
        }
      />
    </div>
  );
}
