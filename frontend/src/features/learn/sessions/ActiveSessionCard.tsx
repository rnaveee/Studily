import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Coffee, Maximize2, Minimize2, Pause, Play, Square, Zap } from "lucide-react";
import { api } from "../../../lib/api";
import { useConfirm } from "../../../lib/confirm";
import { formatTime } from "../../../lib/format";
import { useFullscreen } from "../../../lib/fullscreen";
import { formatMs, pomodoro, pomodoroColor } from "../../../lib/pomodoro";
import { applyDelta } from "../../../lib/progressDelta";
import { playRingtone } from "../../../lib/ringtones";
import { toast } from "../../../lib/toast";
import { progressKeys } from "../../progress/useProgress";
import { formatMultiplier, MODE_LABEL } from "./sessionFormat";
import type { StudySessionDto, StudySessionResult, StudySessionTaskDto } from "../../../types";

type Phase = "focus" | "break" | "checkin" | "late" | "expired" | "paused";

const FOCUS = pomodoroColor("study");
const BREAK = pomodoroColor("break");

export default function ActiveSessionCard({
  session,
  receivedAt,
}: {
  session: StudySessionDto;
  receivedAt: number;
}) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [expanded, setExpanded] = useState(false);
  const skew = Date.parse(session.serverNow) - receivedAt;
  const [now, setNow] = useState(() => Date.now() + skew);

  useEffect(() => {
    setNow(Date.now() + skew);
    const id = window.setInterval(() => setNow(Date.now() + skew), 250);
    return () => window.clearInterval(id);
  }, [skew]);

  const current = session.blocks.find((b) => b.index === session.currentBlock) ?? null;
  const running = session.status === "ACTIVE" && current?.status === "RUNNING" ? current : null;
  const startMs = running ? Date.parse(running.startedAt) : 0;
  const dueMs = running ? Date.parse(running.dueAt) : 0;
  const opensMs = session.checkinOpensAt ? Date.parse(session.checkinOpensAt) : dueMs - 60_000;
  const closesMs = session.checkinClosesAt ? Date.parse(session.checkinClosesAt) : dueMs + 5 * 60_000;

  let phase: Phase;
  if (!running) phase = "paused";
  else if (now < startMs) phase = "break";
  else if (now < opensMs) phase = "focus";
  else if (now <= dueMs) phase = "checkin";
  else if (now <= closesMs) phase = "late";
  else phase = "expired";

  const prevNow = useRef(now);
  const chimed = useRef<number | null>(null);
  useEffect(() => {
    if (running && prevNow.current < dueMs && now >= dueMs && chimed.current !== running.index) {
      chimed.current = running.index;
      const p = pomodoro.getState();
      playRingtone(p.ringtone, p.volume);
    }
    prevNow.current = now;
  }, [now, running, dueMs]);

  useEffect(() => {
    if (phase !== "expired") return;
    const sync = () => {
      qc.invalidateQueries({ queryKey: progressKeys.activeSession });
      qc.invalidateQueries({ queryKey: progressKeys.history });
      qc.invalidateQueries({ queryKey: progressKeys.streak });
    };
    sync();
    const id = window.setInterval(sync, 10_000);
    return () => window.clearInterval(id);
  }, [phase, qc]);

  useEffect(
    () => () => {
      if (qc.getQueryData(progressKeys.activeSession) === null) {
        qc.invalidateQueries({ queryKey: progressKeys.history });
        qc.invalidateQueries({ queryKey: progressKeys.streak });
      }
    },
    [qc],
  );

  function settle(result: StudySessionResult) {
    const s = result.session;
    const open = s.status === "ACTIVE" || s.status === "PAUSED";
    qc.setQueryData(progressKeys.activeSession, open ? s : null);
    qc.invalidateQueries({ queryKey: progressKeys.streak });
    qc.invalidateQueries({ queryKey: progressKeys.history });
    applyDelta(result.delta, qc);
    return s;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: progressKeys.activeSession });

  const checkin = useMutation({
    mutationFn: () => api.post<StudySessionResult>(`/study-sessions/${session.id}/checkin`),
    onSuccess: (r) => {
      const s = settle(r);
      if (s.status === "COMPLETED") toast.success("Session complete. Great work!");
    },
    onError: refresh,
  });

  const resume = useMutation({
    mutationFn: () => api.post<StudySessionDto>(`/study-sessions/${session.id}/resume`),
    onSuccess: (s) => qc.setQueryData(progressKeys.activeSession, s),
    onError: refresh,
  });

  const end = useMutation({
    mutationFn: () => api.post<StudySessionResult>(`/study-sessions/${session.id}/end`),
    onSuccess: (r) => {
      settle(r);
      toast.info("Study session ended");
    },
    onError: refresh,
  });

  const toggleTask = useMutation({
    mutationFn: (v: { taskId: number; done: boolean }) =>
      api.patch<StudySessionResult>(`/study-sessions/${session.id}/tasks/${v.taskId}`, { done: v.done }),
    onMutate: (v) => {
      qc.setQueryData<StudySessionDto | null>(progressKeys.activeSession, (old) =>
        old
          ? {
              ...old,
              serverNow: new Date(Date.now() + skew).toISOString(),
              tasks: old.tasks.map((t) => (t.id === v.taskId ? { ...t, done: v.done } : t)),
            }
          : old,
      );
    },
    onSuccess: settle,
    onError: refresh,
  });

  async function endSession() {
    const ok = await confirm({
      title: "End this study session?",
      message:
        "If you've studied at least 10 minutes of the current block, those minutes still count. Otherwise the block is dropped.",
      confirmLabel: "End session",
      danger: true,
    });
    if (ok) end.mutate();
  }

  const busy = checkin.isPending || resume.isPending || end.isPending;
  const color = phase === "break" ? BREAK : phase === "late" || phase === "checkin" ? "var(--accent)" : phase === "paused" || phase === "expired" ? "var(--fg-3)" : FOCUS;
  const localTime = (ms: number) => formatTime(new Date(ms - skew).toISOString());

  let fraction = 1;
  let clock = "--:--";
  let label = "Focus";
  let caption = "";
  if (phase === "focus" || phase === "checkin") {
    fraction = (dueMs - now) / Math.max(1, dueMs - startMs);
    clock = formatMs(dueMs - now);
    label = phase === "checkin" ? "Almost done" : "Focus";
    caption = `Ends at ${localTime(dueMs)}`;
  } else if (phase === "break") {
    fraction = (startMs - now) / Math.max(1, session.breakMinutes * 60_000);
    clock = formatMs(startMs - now);
    label = "Break";
    caption = `Block ${session.currentBlock} at ${localTime(startMs)}`;
  } else if (phase === "late") {
    fraction = (closesMs - now) / Math.max(1, closesMs - dueMs);
    clock = formatMs(closesMs - now);
    label = "Check in!";
    caption = "left to check in";
  } else if (phase === "expired") {
    fraction = 0;
    clock = "00:00";
    label = "Missed";
    caption = "Updating…";
  } else {
    label = "Paused";
    caption = "Missed a check-in";
  }
  fraction = Math.min(1, Math.max(0, fraction));

  const canCheckIn = phase === "checkin" || phase === "late";
  const ringProps = { color, fraction, label, clock, caption, glow: phase === "focus" || phase === "break" };
  const blocks = <BlockRow session={session} phase={phase} now={now} startMs={startMs} dueMs={dueMs} />;
  const actions = (
    <SessionActions
      phase={phase}
      busy={busy}
      canCheckIn={canCheckIn}
      untilStart={startMs - now}
      untilCheckin={opensMs - now}
      onCheckIn={() => checkin.mutate()}
      onResume={() => resume.mutate()}
      onEnd={endSession}
    />
  );
  const tasks =
    session.tasks.length > 0 ? (
      <TaskList tasks={session.tasks} onToggle={(t) => toggleTask.mutate({ taskId: t.id, done: !t.done })} />
    ) : null;

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

      {tasks && <div className="mt-4 border-t border-line pt-3">{tasks}</div>}

      {expanded && (
        <FullscreenSession color={color} onClose={() => setExpanded(false)}>
          <div
            className={`mx-auto grid w-full items-center gap-8 ${
              tasks ? "max-w-5xl lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-14" : "max-w-xl"
            }`}
          >
            <div className="flex min-w-0 flex-col items-center gap-6">
              <SessionHeader session={session} color={color} centered />
              <Ring {...ringProps} large />
              <div className="w-full max-w-md space-y-3">
                {blocks}
                {actions}
              </div>
            </div>
            {tasks && (
              <div
                className="w-full rounded-2xl border p-4 sm:p-5"
                style={{ borderColor: "var(--line)", background: "var(--surface)" }}
              >
                {tasks}
              </div>
            )}
          </div>
        </FullscreenSession>
      )}
    </div>
  );
}

function SessionHeader({
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
  phase,
  busy,
  canCheckIn,
  untilStart,
  untilCheckin,
  onCheckIn,
  onResume,
  onEnd,
}: {
  phase: Phase;
  busy: boolean;
  canCheckIn: boolean;
  untilStart: number;
  untilCheckin: number;
  onCheckIn: () => void;
  onResume: () => void;
  onEnd: () => void;
}) {
  return (
    <>
      {phase === "paused" ? (
        <>
          <p className="text-[12.5px] leading-snug text-fg-2">
            You missed a check-in, so this session is on hold. Resume within 30 minutes or it ends on its own.
          </p>
          <button onClick={onResume} disabled={busy} className="btn btn-primary btn-lg w-full" style={{ minHeight: 48 }}>
            <Play size={15} fill="currentColor" strokeWidth={0} />
            Resume session
          </button>
        </>
      ) : (
        <>
          <p className="text-[12.5px] leading-snug text-fg-2">
            {phase === "break"
              ? "Stretch, refill your water. The next block starts on its own."
              : phase === "focus"
                ? "Stay on task. Check in when the block ends to bank its XP."
                : phase === "expired"
                  ? "The check-in window closed, so this block didn't count."
                  : "Block done! Check in now to keep its XP."}
          </p>
          <button
            onClick={onCheckIn}
            disabled={!canCheckIn || busy}
            className={`btn btn-lg w-full ${canCheckIn ? "btn-primary checkin-pulse" : "btn-ghost"}`}
            style={{ minHeight: 48, fontSize: 15 }}
          >
            {canCheckIn ? (
              <>
                <Check size={17} strokeWidth={2.6} />
                Check in
              </>
            ) : phase === "break" ? (
              <>
                <Coffee size={15} />
                Next block in {formatMs(untilStart)}
              </>
            ) : phase === "expired" ? (
              <>
                <Pause size={15} />
                Block expired
              </>
            ) : (
              <>
                <Clock size={15} />
                Check-in opens in {formatMs(untilCheckin)}
              </>
            )}
          </button>
        </>
      )}

      <div className="flex justify-end">
        <button
          onClick={onEnd}
          disabled={busy}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
        >
          <Square size={12} />
          End session
        </button>
      </div>
    </>
  );
}

function FullscreenSession({
  color,
  onClose,
  children,
}: {
  color: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useFullscreen(document.documentElement, onClose);

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

function Ring({
  color,
  fraction,
  label,
  clock,
  caption,
  glow = false,
  large = false,
}: {
  color: string;
  fraction: number;
  label: string;
  clock: string;
  caption: string;
  glow?: boolean;
  large?: boolean;
}) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={`relative mx-auto aspect-square shrink-0 ${large ? "" : "w-[156px]"}`}
      style={large ? { width: "min(72vw, 44vh, 380px)" } : undefined}
    >
      {large && (
        <div
          aria-hidden
          className={`absolute inset-[8%] rounded-full ${glow ? "pomo-breathe" : ""}`}
          style={{
            background: `radial-gradient(circle, color-mix(in srgb, ${color} 26%, transparent) 0%, transparent 70%)`,
            filter: "blur(18px)",
          }}
        />
      )}
      <svg viewBox="0 0 100 100" className="relative h-full w-full -rotate-90 overflow-visible">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--surface-hi)" strokeWidth="5" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - fraction)}
          className="pomo-ring"
          style={{ filter: `drop-shadow(0 0 3px color-mix(in srgb, ${color} 50%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span
          className={`font-semibold uppercase ${large ? "text-[12px] tracking-[0.18em]" : "text-[10px] tracking-[0.16em]"}`}
          style={{ color }}
        >
          {label}
        </span>
        <span
          className={`font-mono font-bold leading-none tabular-nums text-fg ${
            large ? "mt-1.5 text-[min(15vw,9vh,80px)]" : "mt-0.5 text-[32px]"
          }`}
        >
          {clock}
        </span>
        <span className={`truncate text-fg-3 ${large ? "mt-2 max-w-[70%] text-[13px]" : "mt-1 max-w-[120px] text-[11px]"}`}>
          {caption}
        </span>
      </div>
    </div>
  );
}

function BlockRow({
  session,
  phase,
  now,
  startMs,
  dueMs,
}: {
  session: StudySessionDto;
  phase: Phase;
  now: number;
  startMs: number;
  dueMs: number;
}) {
  const total = Math.max(session.plannedBlocks, ...session.blocks.map((b) => b.index));
  const runningFill =
    phase === "focus" || phase === "checkin"
      ? (now - startMs) / Math.max(1, dueMs - startMs)
      : phase === "late" || phase === "expired"
        ? 1
        : 0;

  return (
    <div>
      <div className="flex gap-1" aria-hidden>
        {Array.from({ length: total }, (_, i) => {
          const b = session.blocks.find((x) => x.index === i + 1);
          const tone =
            b?.status === "CONFIRMED"
              ? "var(--green)"
              : b?.status === "PARTIAL"
                ? "var(--yellow)"
                : b?.status === "MISSED"
                  ? "color-mix(in srgb, var(--red) 55%, transparent)"
                  : null;
          return (
            <span
              key={i}
              className="relative h-2 flex-1 overflow-hidden rounded-full"
              style={{ background: tone ?? "var(--surface-hi)", boxShadow: tone ? undefined : "var(--control-inset)" }}
            >
              {b?.status === "RUNNING" && (
                <span
                  className="xp-fill absolute inset-y-0 left-0 rounded-full"
                  style={{ width: `${Math.min(1, Math.max(0, runningFill)) * 100}%`, background: "var(--accent)" }}
                />
              )}
            </span>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] tabular-nums text-fg-3">
        <span>
          {session.blocks.filter((b) => b.status === "CONFIRMED").length} of {session.plannedBlocks}{" "}
          {session.plannedBlocks === 1 ? "block" : "blocks"} done
        </span>
        <span>{session.creditedMinutes} min credited</span>
      </div>
    </div>
  );
}

function TaskList({
  tasks,
  onToggle,
}: {
  tasks: StudySessionTaskDto[];
  onToggle: (task: StudySessionTaskDto) => void;
}) {
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  const done = tasks.filter((t) => t.done).length;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5 text-[12px]">
        <span className="font-semibold text-fg">Tasks</span>
        <span className="tabular-nums text-fg-3">
          {done}/{tasks.length} done
        </span>
      </div>
      <ul>
        {sorted.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              role="checkbox"
              aria-checked={t.done}
              onClick={() => onToggle(t)}
              className="flex min-h-[40px] w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-surface-hi"
            >
              <span
                className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full transition-colors"
                style={
                  t.done
                    ? { background: "var(--green)", color: "var(--accent-fg)" }
                    : { border: "1.5px solid var(--fg-3)" }
                }
              >
                {t.done && <Check size={11} strokeWidth={3.2} />}
              </span>
              <span className={`min-w-0 flex-1 break-words text-[13px] ${t.done ? "text-fg-3 line-through" : "text-fg"}`}>
                {t.text}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
