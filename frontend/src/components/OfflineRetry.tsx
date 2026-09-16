import { CloudOff } from "lucide-react";

export default function OfflineRetry({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <CloudOff size={28} strokeWidth={1.75} style={{ color: "var(--fg-3)" }} />
      <p className="text-[15px] font-medium text-fg">Can't reach Studily</p>
      <p className="max-w-xs text-[13px] text-fg-3">
        You're still signed in — we just couldn't load your account. Check your connection and try
        again.
      </p>
      <button type="button" onClick={onRetry} className="btn btn-primary mt-1">
        Retry
      </button>
    </div>
  );
}
