import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { X } from "lucide-react";
import Modal, { hasOpenModal } from "../../components/Modal";
import ChatConversation from "./ChatConversation";

const WIDE_QUERY = "(min-width: 1024px)";

function subscribeWide(onChange: () => void) {
  const query = window.matchMedia(WIDE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useWide() {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE_QUERY).matches,
    () => false,
  );
}

function SidePanel({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      if (previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !event.defaultPrevented && !hasOpenModal()) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      aria-label="StudilyBot help"
      className="flex min-h-0 w-[360px] shrink-0 flex-col outline-none xl:w-[400px]"
      style={{ background: "var(--surface)", borderLeft: "1px solid var(--line)" }}
    >
      <header
        className="flex shrink-0 items-start justify-between gap-3 px-4 py-3"
        style={{ borderBottom: "1px solid var(--line)" }}
      >
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-fg">Ask StudilyBot</h2>
          <p className="mt-0.5 text-[12px] text-fg-3">Ask about the idea behind a problem</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close StudilyBot help"
          className="shrink-0 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
        >
          <X size={15} />
        </button>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </aside>
  );
}

export default function HelpChatPanel({
  chatId,
  question,
  questionKey,
  onQuestionSent,
  onClose,
}: {
  chatId: number;
  question: string | null;
  questionKey: number;
  onQuestionSent: () => void;
  onClose: () => void;
}) {
  const wide = useWide();
  const conversation = (
    <ChatConversation
      key={questionKey}
      chatId={chatId}
      compact
      initialQuestion={question}
      onInitialQuestionSent={onQuestionSent}
    />
  );

  if (!wide) {
    return (
      <Modal title="Ask StudilyBot" onClose={onClose} variant="sheet" size="lg" padded={false} bodyClassName="min-h-0">
        <div className="flex min-h-0 flex-col" style={{ height: "min(72dvh, 640px)" }}>
          {conversation}
        </div>
      </Modal>
    );
  }

  return <SidePanel onClose={onClose}>{conversation}</SidePanel>;
}
