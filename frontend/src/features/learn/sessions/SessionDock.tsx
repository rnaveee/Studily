import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useIsDesktop } from "../../../lib/useIsDesktop";
import { releaseProgressMoments } from "../../../lib/progressDelta";
import { useActiveSession, useProgressEnabled } from "../../progress/useProgress";
import { BlockRow, PrimaryAction, Ring, TaskList } from "./SessionParts";
import SessionSummaryModal from "./SessionSummaryModal";
import { useSessionControls } from "./useSessionControls";
import type { StudySessionDto } from "../../../types";

export function SessionHost() {
  const enabled = useProgressEnabled();
  const active = useActiveSession();
  const [summaryId, setSummaryId] = useState<number | null>(null);
  const last = useRef<StudySessionDto | null>(null);

  useEffect(() => {
    if (active.data) {
      last.current = active.data;
      return;
    }
    if (active.data === null && last.current) {
      setSummaryId(last.current.id);
      last.current = null;
    }
  }, [active.data]);

  useEffect(() => () => releaseProgressMoments(), []);

  if (!enabled || summaryId === null) return null;
  return <SessionSummaryModal sessionId={summaryId} onClose={() => setSummaryId(null)} />;
}

export default function SessionDock({ placement }: { placement: "sidebar" | "bar" }) {
  const enabled = useProgressEnabled();
  const desktop = useIsDesktop();
  const { pathname } = useLocation();
  const active = useActiveSession();

  if (!enabled || !active.data || pathname === "/learn") return null;
  if ((placement === "sidebar") !== desktop) return null;

  return placement === "sidebar" ? (
    <SidebarSession session={active.data} receivedAt={active.dataUpdatedAt} />
  ) : (
    <MobileSessionBar session={active.data} receivedAt={active.dataUpdatedAt} />
  );
}

function blockLabel(session: StudySessionDto) {
  return `Block ${Math.min(session.currentBlock, session.plannedBlocks)} of ${session.plannedBlocks}`;
}

function SidebarSession({ session, receivedAt }: { session: StudySessionDto; receivedAt: number }) {
  const c = useSessionControls(session, receivedAt);

  return (
    <div
      className="mx-2 mb-2 mt-3 rounded-xl border p-3"
      style={{
        borderColor: `color-mix(in srgb, ${c.color} 35%, var(--line))`,
        background: `color-mix(in srgb, ${c.color} 6%, var(--surface))`,
      }}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: c.color }}>
          {blockLabel(session)}
        </span>
        <span className="shrink-0 text-[11px] font-semibold tabular-nums text-accent">+{session.xpAwarded} XP</span>
      </div>
      <Ring {...c.ring} compact toggle={c.toggle} onToggle={c.onToggle} />
      <div className="mt-3 space-y-2">
        <BlockRow session={session} phase={c.phase} now={c.now} startMs={c.startMs} dueMs={c.dueMs} />
        <PrimaryAction
          compact
          phase={c.phase}
          busy={c.busy}
          canCheckIn={c.canCheckIn}
          untilStart={c.untilStart}
          untilCheckin={c.untilCheckin}
          onCheckIn={c.onCheckIn}
          onResume={c.onResume}
        />
      </div>
      <div className="mt-3 max-h-44 overflow-y-auto border-t border-line pt-2">
        <TaskList {...c.tasks} />
      </div>
      <Link to="/learn" className="btn btn-ghost mt-3 w-full">
        Open Study page
      </Link>
    </div>
  );
}

function MobileSessionBar({ session, receivedAt }: { session: StudySessionDto; receivedAt: number }) {
  const c = useSessionControls(session, receivedAt);
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const tint = `color-mix(in srgb, ${c.color} 18%, var(--surface))`;

  return (
    <div className="relative z-40 shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Close study session" : "Open study session"}
        className="relative flex min-h-[40px] w-full items-center justify-between gap-3 px-4 text-left"
        style={{ background: tint, borderBottom: "1px solid var(--line)" }}
      >
        <span className="flex min-w-0 items-center gap-2 text-[12.5px] font-semibold text-fg">
          <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: c.color }} />
          <span className="truncate">
            {c.ring.label} · Block {Math.min(session.currentBlock, session.plannedBlocks)}/{session.plannedBlocks}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="font-mono text-[15px] font-bold tabular-nums text-fg">{c.ring.clock}</span>
          {open ? <ChevronUp size={15} className="text-fg-3" /> : <ChevronDown size={15} className="text-fg-3" />}
        </span>
        <span
          aria-hidden
          className="absolute bottom-0 left-0 h-[2px]"
          style={{ width: `${c.ring.fraction * 100}%`, background: c.color }}
        />
      </button>

      {open && (
        <>
          <div aria-hidden className="fixed inset-0 -z-10 bg-black/35 animate-fade" onClick={() => setOpen(false)} />
          <div
            role="region"
            aria-label="Study session"
            className="animate-slide absolute inset-x-0 top-full overflow-y-auto overscroll-contain px-4 pb-4 pt-3"
            style={{
              maxHeight: "calc(var(--app-height, 100dvh) - 150px)",
              background: "var(--surface)",
              borderBottom: "1px solid var(--line)",
              boxShadow: "var(--glass-shadow)",
            }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest("button, input, a, [role=checkbox]")) return;
              setOpen(false);
            }}
          >
            <Ring {...c.ring} toggle={c.toggle} onToggle={c.onToggle} />
            <div className="mt-3 space-y-3">
              <BlockRow session={session} phase={c.phase} now={c.now} startMs={c.startMs} dueMs={c.dueMs} />
              <PrimaryAction
                phase={c.phase}
                busy={c.busy}
                canCheckIn={c.canCheckIn}
                untilStart={c.untilStart}
                untilCheckin={c.untilCheckin}
                onCheckIn={c.onCheckIn}
                onResume={c.onResume}
              />
            </div>
            <div className="mt-3 border-t border-line pt-3">
              <TaskList {...c.tasks} />
            </div>
            <Link to="/learn" className="btn btn-ghost mt-3 w-full" style={{ minHeight: 44 }}>
              Open Study page
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
