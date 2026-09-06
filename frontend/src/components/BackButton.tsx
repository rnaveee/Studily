import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  const location = useLocation();
  return useCallback(
    () => (location.key === "default" ? navigate(fallback) : navigate(-1)),
    [location.key, navigate, fallback],
  );
}

export default function BackButton({
  fallback = "/",
  iconOnly = false,
  onClick,
}: {
  fallback?: string;
  iconOnly?: boolean;
  onClick?: () => void;
}) {
  const goBack = useGoBack(fallback);

  return (
    <button
      type="button"
      onClick={onClick ?? goBack}
      className="btn btn-ghost shrink-0"
      aria-label="Go back"
    >
      <ArrowLeft size={13} />
      {!iconOnly && <span className="hidden sm:inline">Back</span>}
    </button>
  );
}
