import { createContext, useCallback, useContext, useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useDeferredClose } from "../lib/motion";

const ModalCloseContext = createContext<() => void>(() => {});

export function useModalClose() {
  return useContext(ModalCloseContext);
}

const modalStack: string[] = [];

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  beforeClose,
  above,
  dismissOnBackdrop = false,
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
  beforeClose?: () => boolean | Promise<boolean>;
  above?: ReactNode;
  dismissOnBackdrop?: boolean;
}) {
  const { closing, close } = useDeferredClose(onClose, 170);
  const asking = useRef(false);
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);

  const requestClose = useCallback(async () => {
    if (beforeClose) {
      if (asking.current) return;
      asking.current = true;
      try {
        if (!(await beforeClose())) return;
      } finally {
        asking.current = false;
      }
    }
    close();
  }, [beforeClose, close]);

  useEffect(() => {
    if (!closeRef) return;
    closeRef.current = close;
    return () => {
      closeRef.current = null;
    };
  }, [close, closeRef]);

  useEffect(() => {
    modalStack.push(id);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true });
    return () => {
      const at = modalStack.lastIndexOf(id);
      if (at >= 0) modalStack.splice(at, 1);
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && modalStack[modalStack.length - 1] === id) requestClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [id, requestClose]);

  function trapTab(e: ReactKeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Tab" || modalStack[modalStack.length - 1] !== id) return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement,
    );
    if (items.length === 0) {
      e.preventDefault();
      panel.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  const sheet = variant === "sheet";
  const panelAnim = closing
    ? sheet ? "modal-out" : "panel-out"
    : sheet ? "modal-in" : "panel-in";

  return createPortal(
    <ModalCloseContext.Provider value={close}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={typeof title === "string" ? titleId : undefined}
        className={`fixed inset-x-0 top-0 z-[90] flex overflow-y-auto overscroll-contain ${
          sheet ? "" : "p-4"
        } ${closing ? "overlay-out" : "overlay-in"}`}
        style={{
          background: "var(--scrim)",
          backdropFilter: "blur(var(--scrim-blur))",
          WebkitBackdropFilter: "blur(var(--scrim-blur))",
          height: "var(--app-height, 100%)",
        }}
        onClick={
          dismissOnBackdrop
            ? (e) => {
                if (e.target === e.currentTarget) requestClose();
              }
            : undefined
        }
      >
        <div
          ref={panelRef}
          tabIndex={-1}
          onKeyDown={trapTab}
          className={`glass relative flex w-full outline-none ${WIDTH[size]} flex-col ${panelAnim} ${
            sheet ? "mt-auto rounded-b-none sm:m-auto sm:rounded-b-2xl" : "m-auto"
          }`}
          style={
            sheet ? { paddingBottom: "env(safe-area-inset-bottom, 0px)" } : undefined
          }
          onFocus={(e) => {
            const el = e.target;
            if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
            window.setTimeout(() => {
              if (el.isConnected && document.activeElement === el) {
                el.scrollIntoView({ block: "center", behavior: "smooth" });
              }
            }, 350);
          }}
        >
          {above && (
            <div className="pointer-events-none absolute inset-x-0 bottom-full mb-3 flex flex-col px-4">
              {above}
            </div>
          )}
          {title && (
            <div className="flex items-start justify-between gap-3 px-5 pt-5">
              {typeof title === "string" ? (
                <h2 id={titleId} className="text-[15px] font-semibold text-fg">{title}</h2>
              ) : (
                title
              )}
              {showClose && (
              <button
                type="button"
                onClick={requestClose}
                className="-mr-1 -mt-1 shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
                aria-label="Close"
              >
                <X size={14} />
              </button>
              )}
            </div>
          )}

          {!title && showClose && (
            <button
              type="button"
              onClick={requestClose}
              className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          )}

          <div
            className={`flex min-h-0 flex-col ${
              padded ? `gap-4 p-5 ${title ? "pt-4" : showClose ? "pt-10" : ""}` : ""
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
