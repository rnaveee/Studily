import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Maximize2, Minimize2, Settings, Square, Zap } from "lucide-react";
import { api } from "../../../lib/api";
import { useFullscreen } from "../../../lib/fullscreen";
import { progressKeys } from "../../progress/useProgress";
import SessionSettingsModal from "./SessionSettingsModal";
import { BlockRow, PrimaryAction, Ring, TaskList } from "./SessionParts";
import { formatMultiplier, MODE_LABEL } from "./sessionFormat";
import { useSessionControls } from "./useSessionControls";
import type { StudySessionDto } from "../../../types";

export default function ActiveSessionCard({
  session,
  receivedAt,
}: {
  session: StudySessionDto;
  receivedAt: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const c = useSessionControls(session, receivedAt);
  const { phase, color } = c;

  const ringProps = { ...c.ring, toggle: c.toggle, onToggle: c.onToggle };
  const blocks = <BlockRow session={session} phase={phase} now={c.now} startMs={c.startMs} dueMs={c.dueMs} />;
  const actions = (
    <>
      <PrimaryAction
        phase={phase}
        busy={c.busy}
        canCheckIn={c.canCheckIn}
        untilStart={c.untilStart}
        untilCheckin={c.untilCheckin}
        onCheckIn={c.onCheckIn}
        onResume={c.onResume}
      />
      <SessionActions busy={c.busy} onEnd={c.onEnd} onSettings={() => setSettingsOpen(true)} />
    </>
  );
  const tasks = <TaskList {...c.tasks} />;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, var(--line))`,
        background: `color-mix(in srgb, ${color} 5%, var(--surface))`,
      }}
    >
      <SessionHeader session={session} color={color} onExpand={() => setExpanded(true)} />

      <div className="mt-3 grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
        <Ring {...ringProps} />

        <div className="min-w-0 space-y-3">
          {blocks}
          {actions}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-3">{tasks}</div>

      {expanded && (
        <FullscreenSession sessionId={session.id} color={color} onClose={() => setExpanded(false)}>
          <div
            className="mx-auto grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14"
          >
            <div className="flex min-w-0 flex-col items-center gap-6">
              <SessionHeader session={session} color={color} centered />
              <Ring {...ringProps} large />
              <div className="w-full max-w-md space-y-3">
                {blocks}
                {actions}
              </div>
            </div>
            <div
              className="w-full rounded-2xl border p-4 sm:p-5"
              style={{ borderColor: "var(--line)", background: "var(--surface)" }}
            >
              {tasks}
            </div>
          </div>
        </FullscreenSession>
      )}

      {settingsOpen && (
        <SessionSettingsModal mode={session.mode} tasks={tasks} onClose={() => setSettingsOpen(false)} />
      )}
    </div>
  );
}

export function SessionHeader({
  session,
  color,
  centered = false,
  onExpand,
}: {
  session: StudySessionDto;
  color: string;
  centered?: boolean;
  onExpand?: () => void;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${centered ? "justify-center" : "justify-between"}`}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
        {MODE_LABEL[session.mode]} · Block {Math.min(session.currentBlock, session.plannedBlocks)} of{" "}
        {session.plannedBlocks}
      </span>
      <span className="flex items-center gap-1.5">
        {session.multiplier > 1 && (
          <span
            className="badge tabular-nums"
            style={{ background: "color-mix(in srgb, var(--orange-vivid) 14%, transparent)", color: "var(--orange)" }}
            title="Streak multiplier for this session"
          >
            <Zap size={10} />
            {formatMultiplier(session.multiplier)}
          </span>
        )}
        <span className="text-[12px] font-semibold tabular-nums text-accent">+{session.xpAwarded} XP</span>
        {onExpand && (
          <button
            onClick={onExpand}
            aria-label="Open fullscreen"
            title="Fullscreen"
            className="-my-1 -mr-1.5 ml-0.5 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          >
            <Maximize2 size={15} />
          </button>
        )}
      </span>
    </div>
  );
}

function SessionActions({
  onEnd,
  onSettings,
  busy,
}: {
  onEnd: () => void;
  onSettings: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <span className="flex items-center">
        <button
          onClick={onSettings}
          aria-label="Session settings"
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
        >
          <Settings size={13} />
          Settings
        </button>
        <button
          onClick={onEnd}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
        >
          <Square size={12} />
          End session
        </button>
      </span>
    </div>
  );
}

function useFullscreenFocus(sessionId: number) {
  const qc = useQueryClient();

  useEffect(() => {
    let timer: number | undefined;
    let reporting = false;

    const send = (focused: boolean, keepalive = false) =>
      api
        .post<StudySessionDto>(`/study-sessions/${sessionId}/focus`, { focused }, { keepalive })
        .then((s) => {
          if (focused === reporting) qc.setQueryData(progressKeys.activeSession, s);
        })
        .catch(() => {});

    const start = () => {
      if (reporting) return;
      reporting = true;
      send(true);
      timer = window.setInterval(() => send(true), 30_000);
    };
    const stop = (keepalive: boolean) => {
      if (!reporting) return;
      reporting = false;
      window.clearInterval(timer);
      send(false, keepalive);
    };
    const onVisibility = () => (document.hidden ? stop(true) : start());
    const onPageHide = () => stop(true);

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stop(true);
    };
  }, [sessionId, qc]);
}

function FullscreenSession({
  sessionId,
  color,
  onClose,
  children,
}: {
  sessionId: number;
  color: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useFullscreen(document.documentElement, onClose);
  useFullscreenFocus(sessionId);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Study session"
      className="fixed inset-x-0 top-0 z-[85] overflow-y-auto overscroll-contain animate-in"
      style={{
        height: "var(--app-height, 100%)",
        background: `color-mix(in srgb, ${color} 6%, var(--bg))`,
        transition: "background-color 0.6s ease",
      }}
    >
      <div
        className="sticky top-0 z-10"
        style={{ height: "env(safe-area-inset-top, 0px)", background: "var(--surface)" }}
      />

      <button
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="fixed right-4 z-10 rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <Minimize2 size={18} />
      </button>

      <div
        className="flex min-h-full flex-col justify-center px-5 sm:px-8"
        style={{
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 64px)",
          paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 32px)",
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
