import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  leaving?: boolean;
}

type Listener = (item: ToastItem) => void;
const _listeners = new Set<Listener>();

const recent = new Map<string, number>();
const DEDUPE_MS = 1500;

function _fire(message: string, type: ToastType) {
  const key = `${type}:${message}`;
  const now = Date.now();
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_MS) return;
  recent.set(key, now);
  if (recent.size > 50) {
    for (const [k, t] of recent) if (now - t >= DEDUPE_MS) recent.delete(k);
  }
  const item: ToastItem = { id: Math.random().toString(36).slice(2), message, type };
  _listeners.forEach((l) => l(item));
}

export const toast = {
  success: (message: string) => _fire(message, "success"),
  error: (message: string) => _fire(message, "error"),
  info: (message: string) => _fire(message, "info"),
};

const DURATION: Record<ToastType, number> = { success: 3500, error: 5000, info: 4000 };

const ICON = { success: CheckCircle, error: AlertCircle, info: Info };

const COLOR: Record<ToastType, string> = {
  success: "var(--green)",
  error: "var(--red)",
  info: "var(--accent)",
};

const EXIT_MS = 170;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), EXIT_MS);
  }, []);

  useEffect(() => {
    function listener(item: ToastItem) {
      setToasts((prev) => [...prev, item]);
      setTimeout(() => {
        setToasts((prev) => prev.map((t) => (t.id === item.id ? { ...t, leaving: true } : t)));
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== item.id)), EXIT_MS);
      }, DURATION[item.type]);
    }
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-[calc(env(safe-area-inset-bottom,0px)+104px)] z-[130] flex flex-col items-end gap-2 md:inset-x-auto md:bottom-6 md:right-6"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.type];
          return (
            <div
              key={t.id}
              className={`glass pointer-events-auto flex w-full max-w-sm items-start gap-3 px-4 py-3 md:min-w-[260px] md:w-auto ${
                t.leaving ? "toast-out" : "animate-in"
              }`}
            >
              <Icon size={15} style={{ color: COLOR[t.type] }} className="mt-0.5 shrink-0" />
              <span className="flex-1 text-[13px] text-fg">{t.message}</span>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-0.5 text-fg-3 transition-colors hover:text-fg"
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </>
  );
}
