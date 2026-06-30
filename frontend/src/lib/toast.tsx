import { useEffect, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle, Info, X } from "lucide-react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

type Listener = (item: ToastItem) => void;
const _listeners = new Set<Listener>();

function _fire(message: string, type: ToastType) {
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

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    function listener(item: ToastItem) {
      setToasts((prev) => [...prev, item]);
      setTimeout(
        () => setToasts((prev) => prev.filter((t) => t.id !== item.id)),
        DURATION[item.type],
      );
    }
    _listeners.add(listener);
    return () => { _listeners.delete(listener); };
  }, []);

  return (
    <>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 md:bottom-6 md:right-6"
      >
        {toasts.map((t) => {
          const Icon = ICON[t.type];
          return (
            <div
              key={t.id}
              className="card flex min-w-[260px] max-w-sm items-start gap-3 px-4 py-3 shadow-lg animate-in"
            >
              <Icon size={15} style={{ color: COLOR[t.type] }} className="mt-0.5 shrink-0" />
              <span className="flex-1 text-[13px] text-fg">{t.message}</span>
              <button
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
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
