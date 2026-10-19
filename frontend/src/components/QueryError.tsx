import { CloudOff } from "lucide-react";

export default function QueryError({
  onRetry,
  message = "Couldn't load this. Check your connection and try again.",
}: {
  onRetry: () => void;
  message?: string;
}) {
  return (
    <div
      role="alert"
      className="card flex flex-col items-center gap-2 px-6 py-8 text-center"
    >
      <CloudOff size={22} strokeWidth={1.75} style={{ color: "var(--fg-3)" }} />
      <p className="max-w-xs text-[13px] text-fg-2">{message}</p>
      <button type="button" onClick={onRetry} className="btn btn-ghost mt-1">
        Retry
      </button>
    </div>
  );
}
