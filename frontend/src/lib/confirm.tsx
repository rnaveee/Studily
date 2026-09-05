import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import Modal, { useModalClose } from "../components/Modal";

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  danger?: boolean;
}

type ConfirmState = ConfirmOptions;

const ConfirmCtx = createContext<(opts: ConfirmOptions) => Promise<boolean>>(
  () => Promise.resolve(false),
);

export function useConfirm() {
  return useContext(ConfirmCtx);
}

function ConfirmButtons({
  danger,
  confirmLabel,
  onPick,
}: {
  danger?: boolean;
  confirmLabel?: string;
  onPick: (ok: boolean) => void;
}) {
  const close = useModalClose();

  return (
    <>
      <button
        onClick={() => {
          onPick(false);
          close();
        }}
        className="btn btn-ghost"
        autoFocus
      >
        Cancel
      </button>
      <button
        onClick={() => {
          onPick(true);
          close();
        }}
        className={danger ? "btn btn-danger" : "btn btn-primary"}
      >
        {confirmLabel ?? "Confirm"}
      </button>
    </>
  );
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const answer = useRef(false);
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions): Promise<boolean> =>
      new Promise((resolve) => {
        answer.current = false;
        pending.current = resolve;
        setState(opts);
      }),
    [],
  );

  const finish = useCallback(() => {
    const resolve = pending.current;
    pending.current = null;
    setState(null);
    resolve?.(answer.current);
  }, []);

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal
          onClose={finish}
          title={state.title}
          showClose={false}
          footer={
            <ConfirmButtons
              danger={state.danger}
              confirmLabel={state.confirmLabel}
              onPick={(ok) => {
                answer.current = ok;
              }}
            />
          }
        >
          {state.message && <p className="text-[13px] text-fg-2">{state.message}</p>}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}
