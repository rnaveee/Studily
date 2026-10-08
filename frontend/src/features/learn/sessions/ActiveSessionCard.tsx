import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Coffee, Pause, Play, Square, Zap } from "lucide-react";
import { api } from "../../../lib/api";
import { useConfirm } from "../../../lib/confirm";
import { formatTime } from "../../../lib/format";
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

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: `color-mix(in srgb, ${color} 35%, var(--line))`,
        background: `color-mix(in srgb, ${color} 5%, var(--surface))`,
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 items-center gap-4 sm:grid-cols-[auto_minmax(0,1fr)] sm:gap-6">
        <Ring color={color} fraction={fraction} label={label} clock={clock} caption={caption} />

        <div className="min-w-0 space-y-3">
          <BlockRow session={session} phase={phase} now={now} startMs={startMs} dueMs={dueMs} />

          {phase === "paused" ? (
            <>
              <p className="text-[12.5px] leading-snug text-fg-2">
                You missed a check-in, so this session is on hold. Resume within 30 minutes or it ends on its own.
              </p>
              <button
                onClick={() => resume.mutate()}
                disabled={busy}
                className="btn btn-primary btn-lg w-full"
                style={{ minHeight: 48 }}
              >
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
                onClick={() => checkin.mutate()}
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
                    Next block in {formatMs(startMs - now)}
                  </>
                ) : phase === "expired" ? (
                  <>
                    <Pause size={15} />
                    Block expired
                  </>
                ) : (
                  <>
                    <Clock size={15} />
                    Check-in opens in {formatMs(opensMs - now)}
                  </>
                )}
              </button>
            </>
          )}

          <div className="flex justify-end">
            <button
              onClick={endSession}
              disabled={busy}
              className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
            >
              <Square size={12} />
              End session
            </button>
          </div>
        </div>
      </div>

      {session.tasks.length > 0 && (
        <TaskList
          tasks={session.tasks}
          onToggle={(t) => toggleTask.mutate({ taskId: t.id, done: !t.done })}
        />
      )}
    </div>
  );
}

function Ring({
  color,
  fraction,
  label,
  clock,
  caption,
}: {
  color: string;
  fraction: number;
  label: string;
  clock: string;
  caption: string;
}) {
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto aspect-square w-[156px] shrink-0">
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90 overflow-visible">
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
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em]" style={{ color }}>
          {label}
        </span>
        <span className="mt-0.5 font-mono text-[32px] font-bold leading-none tabular-nums text-fg">{clock}</span>
        <span className="mt-1 max-w-[120px] truncate text-[11px] text-fg-3">{caption}</span>
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
          {session.blocks.filter((b) => b.status === "CONFIRMED").length} of {session.plannedBlocks} blocks done
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
    <div className="mt-4 border-t border-line pt-3">
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
