import { useNavigate } from "react-router-dom";
import BackButton from "../../components/BackButton";
import ProfileForm from "./ProfileForm";

export default function ProfileEditPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-lg space-y-5 animate-in">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
        <h1 className="text-xl font-semibold text-fg">Edit profile</h1>
      </div>

      <ProfileForm
        submitLabel="Save changes"
        savingLabel="Saving…"
        onSaved={() => navigate("/profile")}
        secondaryAction={
          <button type="button" onClick={() => navigate("/profile")} className="btn btn-ghost">
            Cancel
          </button>
        }
      />
    </div>
  );
}
