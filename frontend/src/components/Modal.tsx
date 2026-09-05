import { createContext, useContext, useEffect, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDeferredClose } from "../lib/motion";

const ModalCloseContext = createContext<() => void>(() => {});

export function useModalClose() {
  return useContext(ModalCloseContext);
}

const WIDTH = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
} as const;

export default function Modal({
  onClose,
  title,
  children,
  variant = "card",
  size = "sm",
  footer,
  bodyClassName = "",
  showClose = true,
  padded = true,
  closeRef,
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  variant?: "card" | "sheet";
  size?: keyof typeof WIDTH;
  footer?: ReactNode;
  bodyClassName?: string;
  showClose?: boolean;
  padded?: boolean;
  closeRef?: MutableRefObject<(() => void) | null>;
}) {
  const { closing, close } = useDeferredClose(onClose, 170);

  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = close;
    return () => {
      closeRef.current = null;
    };
  }, [close, closeRef]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  const sheet = variant === "sheet";
  const panelAnim = closing
    ? sheet ? "modal-out" : "panel-out"
    : sheet ? "modal-in" : "panel-in";

  return createPortal(
    <ModalCloseContext.Provider value={close}>
      <div
        role="dialog"
        aria-modal="true"
        className={`fixed inset-x-0 top-0 z-[90] flex overflow-y-auto overscroll-contain ${
          sheet ? "" : "p-4"
        } ${closing ? "overlay-out" : "overlay-in"}`}
        style={{ background: "rgba(0,0,0,0.45)", height: "var(--app-height, 100%)" }}
      >
        <div
          className={`card flex w-full ${WIDTH[size]} flex-col shadow-xl ${panelAnim} ${
            sheet ? "mt-auto rounded-b-none sm:m-auto sm:rounded-b-xl" : "m-auto"
          }`}
          style={
            sheet ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined
          }
          onFocus={(e) => {
            const el = e.target;
            window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 350);
          }}
        >
          {title && (
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              {typeof title === "string" ? (
                <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
              ) : (
                title
              )}
              {showClose && (
              <button
                type="button"
                onClick={close}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
                aria-label="Close"
              >
                <X size={14} />
              </button>
              )}
            </div>
          )}

          <div
            className={`flex min-h-0 flex-col ${
              padded ? `gap-4 p-5 ${title ? "pt-4" : ""}` : ""
            } ${bodyClassName}`}
          >
            {children}
          </div>

          {footer && (
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>
          )}
        </div>
      </div>
    </ModalCloseContext.Provider>,
    document.body,
  );
}
