import { useRef, useState } from "react";
import { Check, Clock, Coffee, Pause, Play, Plus, X } from "lucide-react";
import { formatMs } from "../../../lib/pomodoro";
import type { Phase } from "./useSessionControls";
import type { StudySessionDto, StudySessionTaskDto } from "../../../types";

const MAX_TASKS = 10;
const MAX_TASK_LEN = 200;

export function Ring({
  color,
  fraction,
  label,
  clock,
  caption,
  glow = false,
  large = false,
  compact = false,
  toggle = null,
  onToggle,
}: {
  color: string;
  fraction: number;
  label: string;
  clock: string;
  caption: string;
  glow?: boolean;
  large?: boolean;
  compact?: boolean;
  toggle?: "pause" | "play" | null;
  onToggle?: () => void;
}) {
  const dim = toggle ? "transition-opacity group-hover:opacity-30 group-focus-within:opacity-30" : "";
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <div
      className={`group relative mx-auto aspect-square shrink-0 ${large ? "" : compact ? "w-[120px]" : "w-[156px]"}`}
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
      <svg viewBox="0 0 100 100" className={`relative h-full w-full -rotate-90 overflow-visible ${dim}`}>
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
      <div className={`absolute inset-0 flex flex-col items-center justify-center text-center ${dim}`}>
        <span
          className={`font-semibold uppercase ${large ? "text-[12px] tracking-[0.18em]" : "text-[10px] tracking-[0.16em]"}`}
          style={{ color }}
        >
          {label}
        </span>
        <span
          className={`font-mono font-bold leading-none tabular-nums text-fg ${
            large ? "mt-1.5 text-[min(15vw,9vh,80px)]" : compact ? "mt-0.5 text-[25px]" : "mt-0.5 text-[32px]"
          }`}
        >
          {clock}
        </span>
        <span className={`truncate text-fg-3 ${large ? "mt-2 max-w-[70%] text-[13px]" : compact ? "mt-1 max-w-[96px] text-[10px]" : "mt-1 max-w-[120px] text-[11px]"}`}>
          {caption}
        </span>
      </div>
      {toggle && onToggle && (
        <button
          type="button"
          onClick={onToggle}
          aria-label={toggle === "pause" ? "Pause session" : "Resume session"}
          title={toggle === "pause" ? "Pause" : "Resume"}
          className="absolute inset-0 flex items-center justify-center rounded-full text-fg opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        >
          {toggle === "pause" ? (
            <Pause size={large ? 56 : compact ? 28 : 34} fill="currentColor" strokeWidth={0} />
          ) : (
            <Play size={large ? 56 : compact ? 28 : 34} fill="currentColor" strokeWidth={0} />
          )}
        </button>
      )}
    </div>
  );
}

export function BlockRow({
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

export function TaskList({
  tasks,
  adding,
  onToggle,
  onRename,
  onRemove,
  onAdd,
}: {
  tasks: StudySessionTaskDto[];
  adding: boolean;
  onToggle: (task: StudySessionTaskDto) => void;
  onRename: (task: StudySessionTaskDto, text: string) => void;
  onRemove: (task: StudySessionTaskDto) => void;
  onAdd: (text: string) => void;
}) {
  const sorted = [...tasks].sort((a, b) => a.position - b.position);
  const done = tasks.filter((t) => t.done).length;
  const full = tasks.length >= MAX_TASKS;
  const [editing, setEditing] = useState<number | null>(null);
  const [edit, setEdit] = useState("");
  const [draft, setDraft] = useState("");
  const open = useRef<number | null>(null);

  function startEdit(task: StudySessionTaskDto) {
    open.current = task.id;
    setEdit(task.text);
    setEditing(task.id);
  }

  function stopEdit() {
    open.current = null;
    setEditing(null);
  }

  function commit(task: StudySessionTaskDto) {
    if (open.current !== task.id) return;
    const text = edit.trim();
    stopEdit();
    if (text && text !== task.text) onRename(task, text);
  }

  function add() {
    const text = draft.trim();
    if (!text || full || adding) return;
    onAdd(text);
    setDraft("");
  }

  return (
    <div>
      <div className="mb-1 flex items-center justify-between px-0.5 text-[12px]">
        <span className="font-semibold text-fg">Tasks</span>
        {tasks.length > 0 && (
          <span className="tabular-nums text-fg-3">
            {done}/{tasks.length} done
          </span>
        )}
      </div>
      <ul>
        {sorted.map((t) => (
          <li key={t.id} className="flex min-h-[40px] items-center gap-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={t.done}
              aria-label={t.text}
              onClick={() => onToggle(t)}
              className="flex h-10 w-9 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-surface-hi"
            >
              <span
                className="flex h-[18px] w-[18px] items-center justify-center rounded-full transition-colors"
                style={
                  t.done
                    ? { background: "var(--green)", color: "var(--accent-fg)" }
                    : { border: "1.5px solid var(--fg-3)" }
                }
              >
                {t.done && <Check size={11} strokeWidth={3.2} />}
              </span>
            </button>
            {editing === t.id ? (
              <input
                className="input"
                autoFocus
                value={edit}
                maxLength={MAX_TASK_LEN}
                aria-label="Edit task"
                enterKeyHint="done"
                onChange={(e) => setEdit(e.target.value)}
                onBlur={() => commit(t)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commit(t);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    e.stopPropagation();
                    stopEdit();
                  }
                }}
                style={{ minHeight: 36, fontSize: 13 }}
              />
            ) : (
              <button
                type="button"
                onClick={() => startEdit(t)}
                title="Edit task"
                className={`min-w-0 flex-1 break-words rounded-lg px-1.5 py-2 text-left text-[13px] transition-colors hover:bg-surface-hi ${
                  t.done ? "text-fg-3 line-through" : "text-fg"
                }`}
              >
                {t.text}
              </button>
            )}
            {!t.earned && editing !== t.id && (
              <button
                type="button"
                onClick={() => onRemove(t)}
                aria-label={`Remove ${t.text}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-red"
              >
                <X size={14} />
              </button>
            )}
          </li>
        ))}
        {!full && (
          <li className="flex items-center gap-1">
            <span className="flex h-10 w-9 shrink-0 items-center justify-center text-accent">
              <Plus size={15} />
            </span>
            <input
              className="input"
              value={draft}
              maxLength={MAX_TASK_LEN}
              placeholder={tasks.length === 0 ? "Add a task" : "Add another task"}
              aria-label="New task"
              enterKeyHint="enter"
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                }
              }}
              style={{ minHeight: 36, fontSize: 13 }}
            />
            <button
              type="button"
              onClick={add}
              disabled={!draft.trim() || adding}
              aria-label="Add task"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-surface-hi disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </li>
        )}
      </ul>
      {full && <p className="mt-1 px-0.5 text-[11.5px] text-fg-3">That's the max of {MAX_TASKS} tasks.</p>}
    </div>
  );
}

export function PrimaryAction({
  phase,
  busy,
  canCheckIn,
  untilStart,
  untilCheckin,
  onCheckIn,
  onResume,
  compact = false,
}: {
  phase: Phase;
  busy: boolean;
  canCheckIn: boolean;
  untilStart: number;
  untilCheckin: number;
  onCheckIn: () => void;
  onResume: () => void;
  compact?: boolean;
}) {
  const size = compact ? { minHeight: 40, fontSize: 13 } : { minHeight: 48, fontSize: 15 };
  if (phase === "held" || phase === "paused") {
    return (
      <>
        {!compact && (
          <p className="text-[12.5px] leading-snug text-fg-2">
            {phase === "held"
              ? "Paused. Session will end on it's own in 30 minutes."
              : "You missed a check-in. Resume your study session."}
          </p>
        )}
        <button onClick={onResume} disabled={busy} className="btn btn-primary btn-lg w-full" style={size}>
          <Play size={15} fill="currentColor" strokeWidth={0} />
          {phase === "held" ? "Resume" : "Resume session"}
        </button>
      </>
    );
  }
  return (
    <>
      {!compact && (
        <p className="text-[12.5px] leading-snug text-fg-2">
          {phase === "break"
            ? "Break time! The next block will start on its own."
            : phase === "focus"
              ? "Lock in."
              : phase === "expired"
                ? "The check-in window closed, so this block didn't count."
                : "Block done! Check in now to keep its XP."}
        </p>
      )}
      <button
        onClick={onCheckIn}
        disabled={!canCheckIn || busy}
        className={`btn btn-lg w-full ${canCheckIn ? "btn-checkin checkin-pulse" : "btn-ghost"}`}
        style={size}
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
            Check-in: {formatMs(untilCheckin)}
          </>
        )}
      </button>
    </>
  );
}
