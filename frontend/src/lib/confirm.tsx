import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    if (!state) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") respond(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state]);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise((resolve) => setState({ ...opts, resolve })),
    [],
  );

  function respond(ok: boolean) {
    state?.resolve(ok);
    setState(null);
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => respond(false)}
        >
          <div
            className="card w-full max-w-sm space-y-4 p-5 shadow-xl animate-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-[15px] font-semibold text-fg">{state.title}</h2>
              {state.message && (
                <p className="mt-1.5 text-[13px] text-fg-2">{state.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => respond(false)} className="btn btn-ghost" autoFocus>
                Cancel
              </button>
              <button
                onClick={() => respond(true)}
                className={state.danger ? "btn btn-danger" : "btn btn-primary"}
              >
                {state.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}
