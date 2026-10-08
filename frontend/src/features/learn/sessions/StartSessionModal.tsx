import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Circle, Info, Minus, Play, Plus, X } from "lucide-react";
import Modal, { useModalClose } from "../../../components/Modal";
import SegmentedToggle from "../../../components/SegmentedToggle";
import { api, ApiError } from "../../../lib/api";
import { unlockAudio } from "../../../lib/ringtones";
import { progressKeys } from "../../progress/useProgress";
import { formatMinutes } from "./sessionFormat";
import type { StartStudySessionRequest, StudySessionDto, StudySessionMode } from "../../../types";

const MODES: { value: StudySessionMode; label: string }[] = [
  { value: "POMODORO", label: "Pomodoro" },
  { value: "TIMER", label: "Timer" },
];

const POMO_BLOCK = 25;
const POMO_BREAK = 5;
const MIN_BLOCKS = 1;
const MAX_BLOCKS = 8;
const TIMER_OPTIONS = [30, 60, 90, 120, 150, 180];
const MAX_TASKS = 10;
const MAX_TASK_LEN = 200;

export default function StartSessionModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} title="Start a study session" variant="sheet" size="md">
      <StartForm />
    </Modal>
  );
}

function StartForm() {
  const qc = useQueryClient();
  const close = useModalClose();
  const [mode, setMode] = useState<StudySessionMode>("POMODORO");
  const [blocks, setBlocks] = useState(5);
  const [minutes, setMinutes] = useState(120);
  const [tasks, setTasks] = useState<{ id: number; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const draftRef = useRef<HTMLInputElement>(null);
  const nextId = useRef(0);

  const start = useMutation({
    mutationFn: (req: StartStudySessionRequest) => api.post<StudySessionDto>("/study-sessions", req),
    onSuccess: (session) => {
      qc.setQueryData(progressKeys.activeSession, session);
      qc.invalidateQueries({ queryKey: progressKeys.history });
      close();
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        qc.invalidateQueries({ queryKey: progressKeys.activeSession });
        close();
      }
    },
  });

  function addDraft() {
    const text = draft.trim();
    if (!text || tasks.length >= MAX_TASKS) return;
    setTasks((t) => [...t, { id: nextId.current++, text: text.slice(0, MAX_TASK_LEN) }]);
    setDraft("");
  }

  function submit() {
    unlockAudio();
    const pending = draft.trim();
    const list = [...tasks.map((t) => t.text), ...(pending && tasks.length < MAX_TASKS ? [pending] : [])]
      .map((t) => t.trim())
      .filter(Boolean)
      .slice(0, MAX_TASKS);
    start.mutate(
      mode === "POMODORO"
        ? { mode, blocks, tasks: list }
        : { mode, minutes, tasks: list },
    );
  }

  const focus = mode === "POMODORO" ? blocks * POMO_BLOCK : minutes;
  const breaks = mode === "POMODORO" ? (blocks - 1) * POMO_BREAK : 0;
  const full = tasks.length >= MAX_TASKS;

  return (
    <>
      <section className="space-y-3">
        <h3 className="text-[13px] font-semibold text-fg">How long will I study?</h3>
        <SegmentedToggle options={MODES} value={mode} onChange={setMode} className="w-full" />

        {mode === "POMODORO" ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-hi px-3 py-2.5" style={{ boxShadow: "var(--control-inset)" }}>
              <button
                type="button"
                onClick={() => setBlocks((b) => Math.max(MIN_BLOCKS, b - 1))}
                disabled={blocks <= MIN_BLOCKS}
                className="btn btn-ghost h-10 w-10 shrink-0 rounded-full p-0"
                aria-label="Fewer blocks"
              >
                <Minus size={16} />
              </button>
              <div className="text-center">
                <div className="text-[22px] font-bold leading-none tabular-nums text-fg">
                  {blocks} {blocks === 1 ? "block" : "blocks"}
                </div>
                <div className="mt-1 text-[11.5px] text-fg-3">
                  {POMO_BLOCK} min focus · {POMO_BREAK} min break
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBlocks((b) => Math.min(MAX_BLOCKS, b + 1))}
                disabled={blocks >= MAX_BLOCKS}
                className="btn btn-ghost h-10 w-10 shrink-0 rounded-full p-0"
                aria-label="More blocks"
              >
                <Plus size={16} />
              </button>
            </div>
            <PlanBar blocks={blocks} />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {TIMER_OPTIONS.map((m) => {
              const active = m === minutes;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMinutes(m)}
                  aria-pressed={active}
                  className="card press min-h-[40px] px-2 py-2 text-[13px] font-semibold tabular-nums transition-colors hover:bg-surface-hi"
                  style={
                    active
                      ? {
                          borderColor: "var(--accent)",
                          background: "color-mix(in srgb, var(--accent) 10%, var(--surface))",
                          color: "var(--accent)",
                        }
                      : { color: "var(--fg-2)" }
                  }
                >
                  {formatMinutes(m)}
                </button>
              );
            })}
          </div>
        )}

        <p className="text-[12px] tabular-nums text-fg-3">
          <span className="font-semibold text-fg-2">{formatMinutes(focus)}</span> of focus
          {breaks > 0 && <> · {formatMinutes(focus + breaks)} with breaks</>}
          {mode === "TIMER" && <> · {focus / 30} check-ins, one every 30 min</>}
        </p>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="text-[13px] font-semibold text-fg">What do I need to get done?</h3>
          <span className="text-[11px] tabular-nums text-fg-3">
            {tasks.length}/{MAX_TASKS}
          </span>
        </div>
        <ul className="space-y-1.5">
          {tasks.map((t, i) => (
            <li key={t.id} className="flex items-center gap-2">
              <Circle size={15} className="shrink-0 text-fg-3" />
              <input
                className="input"
                value={t.text}
                maxLength={MAX_TASK_LEN}
                aria-label={`Task ${i + 1}`}
                onChange={(e) =>
                  setTasks((list) => list.map((x) => (x.id === t.id ? { ...x, text: e.target.value } : x)))
                }
                onBlur={() => setTasks((list) => list.filter((x) => x.text.trim()))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    draftRef.current?.focus();
                  }
                }}
              />
              <button
                type="button"
                onClick={() => setTasks((list) => list.filter((x) => x.id !== t.id))}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
                aria-label={`Remove task ${i + 1}`}
              >
                <X size={15} />
              </button>
            </li>
          ))}
          {!full && (
            <li className="flex items-center gap-2">
              <Plus size={15} className="shrink-0 text-accent" />
              <input
                ref={draftRef}
                className="input"
                value={draft}
                maxLength={MAX_TASK_LEN}
                placeholder={tasks.length === 0 ? "e.g. Finish chapter 4 problems" : "Add another task"}
                aria-label="New task"
                enterKeyHint="enter"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraft();
                  }
                }}
              />
              <button
                type="button"
                onClick={addDraft}
                disabled={!draft.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-accent transition-colors hover:bg-surface-hi disabled:opacity-40"
                aria-label="Add task"
              >
                <Plus size={16} />
              </button>
            </li>
          )}
        </ul>
        {full && <p className="text-[11.5px] text-fg-3">That's the max of {MAX_TASKS} tasks.</p>}
      </section>

      <p
        className="flex items-start gap-2 rounded-lg px-3 py-2.5 text-[12px] leading-snug text-fg-2"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
      >
        <Info size={14} className="mt-px shrink-0 text-accent" />
        <span>
          Check in at the end of each block to earn its XP. You'll get a notification, and you have 5 minutes to
          check in before the session pauses.
        </span>
      </p>

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={close} className="btn btn-ghost btn-lg flex-1 sm:flex-none">
          Cancel
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={start.isPending}
          className="btn btn-primary btn-lg flex-1"
        >
          <Play size={15} fill="currentColor" strokeWidth={0} />
          {start.isPending ? "Starting…" : "Start session"}
        </button>
      </div>
    </>
  );
}

function PlanBar({ blocks }: { blocks: number }) {
  const segments: { kind: "focus" | "break"; minutes: number }[] = [];
  for (let i = 0; i < blocks; i++) {
    segments.push({ kind: "focus", minutes: POMO_BLOCK });
    if (i < blocks - 1) segments.push({ kind: "break", minutes: POMO_BREAK });
  }
  return (
    <div className="flex h-2.5 gap-[3px]" aria-hidden>
      {segments.map((s, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{
            flexGrow: s.minutes,
            flexBasis: 0,
            background: s.kind === "focus" ? "var(--orange)" : "var(--green)",
            opacity: s.kind === "focus" ? 0.85 : 0.6,
          }}
        />
      ))}
    </div>
  );
}
