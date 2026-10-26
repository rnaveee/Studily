import { useEffect, useRef, useState } from "react";
import { useProgressEnabled } from "../../progress/useProgress";
import StartSessionModal from "./StartSessionModal";

const OPEN_EVENT = "studily:start-session";

export interface StartSessionPrefill {
  tasks?: string[];
}

export function openStartSession(prefill: StartSessionPrefill = {}) {
  window.dispatchEvent(new CustomEvent<StartSessionPrefill>(OPEN_EVENT, { detail: prefill }));
}

export default function StartSessionHost() {
  const enabled = useProgressEnabled();
  const [open, setOpen] = useState<{ key: number; tasks: string[] } | null>(null);
  const counter = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    const show = (e: Event) => {
      const detail = (e as CustomEvent<StartSessionPrefill>).detail;
      setOpen((current) =>
        current ?? { key: ++counter.current, tasks: detail?.tasks ?? [] },
      );
    };
    window.addEventListener(OPEN_EVENT, show);
    return () => window.removeEventListener(OPEN_EVENT, show);
  }, [enabled]);

  if (!open) return null;
  return <StartSessionModal key={open.key} initialTasks={open.tasks} onClose={() => setOpen(null)} />;
}
