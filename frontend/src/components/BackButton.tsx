import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export default function BackButton({ fallback = "/" }: { fallback?: string }) {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <button
      type="button"
      onClick={() => (location.key === "default" ? navigate(fallback) : navigate(-1))}
      className="btn btn-ghost shrink-0"
      aria-label="Go back"
    >
      <ArrowLeft size={13} />
      <span className="hidden sm:inline">Back</span>
    </button>
  );
}
