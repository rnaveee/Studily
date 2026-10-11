import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Maximize2, Minimize2, Pause, Play, RotateCcw, SkipForward, Volume1, Volume2, VolumeX } from "lucide-react";
import {
  formatMs,
  phaseDurationMs,
  pomodoro,
  pomodoroColor,
  usePomodoro,
  type PomodoroPhase,
  type PomodoroState,
} from "../../lib/pomodoro";
import { formatTime } from "../../lib/format";
import { useFullscreen } from "../../lib/fullscreen";
import { playRingtone, RINGTONES, unlockAudio } from "../../lib/ringtones";
import BackButton from "../../components/BackButton";
import SegmentedToggle from "../../components/SegmentedToggle";

const PRESETS = [
  { study: 25, rest: 5, label: "Classic" },
  { study: 50, rest: 10, label: "Long" },
  { study: 90, rest: 15, label: "Deep" },
];

const PHASES: { value: PomodoroPhase; label: string }[] = [
  { value: "study", label: "Study" },
  { value: "break", label: "Break" },
];

const SESSIONS_PER_ROUND = 4;

export default function PomodoroPage() {
  const s = usePomodoro();
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    pomodoro.refreshDay();
  }, []);

  return (
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/learn" />
        <div>
          <h1 className="text-xl font-semibold text-fg">Pomodoro Timer</h1>
          <p className="mt-1 text-[13px] text-fg-3">Focus in sprints: study, break, repeat.</p>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-4xl gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="card relative px-6 pb-7 pt-5">
          <button
            onClick={() => setFullscreen(true)}
            aria-label="Enter fullscreen"
            className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          >
            <Maximize2 size={15} />
          </button>

          <div className="flex justify-center">
            <SegmentedToggle
              options={PHASES}
              value={s.phase}
              onChange={(v) => {
                if (v !== s.phase) pomodoro.skip();
              }}
            />
          </div>

          <TimerRing s={s} size="min(280px, 72vw)" timeClass="text-[clamp(44px,13vw,60px)]" />

          <Controls s={s} />

          <SessionDots count={s.completedToday} />
        </div>

        <div className="space-y-4">
          <DurationsCard s={s} />
          <SoundCard s={s} />
        </div>
      </div>

      {fullscreen && <FullscreenTimer onClose={() => setFullscreen(false)} />}
    </div>
  );
}

function TimerRing({ s, size, timeClass }: { s: PomodoroState; size: string; timeClass: string }) {
  const color = pomodoroColor(s.phase);
  const total = phaseDurationMs(s);
  const fraction = total > 0 ? Math.min(1, Math.max(0, s.remainingMs / total)) : 0;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  const endsAt = s.running ? formatTime(new Date(Date.now() + s.remainingMs).toISOString()) : null;

  return (
    <div className="relative mx-auto my-6 aspect-square" style={{ width: size }}>
      <div
        aria-hidden
        className={`absolute inset-[8%] rounded-full ${s.running ? "pomo-breathe" : ""}`}
        style={{
          background: `radial-gradient(circle, color-mix(in srgb, ${color} 26%, transparent) 0%, transparent 70%)`,
          filter: "blur(18px)",
        }}
      />
      <svg viewBox="0 0 100 100" overflow="visible" className="relative h-full w-full -rotate-90 overflow-visible">
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
          style={{ filter: `drop-shadow(0 0 3px color-mix(in srgb, ${color} 55%, transparent))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color }}>
          {s.phase === "study" ? "Focus" : "Break"}
        </span>
        <span className={`mt-1 font-mono font-bold leading-none tabular-nums text-fg ${timeClass}`}>
          {formatMs(s.remainingMs)}
        </span>
        <span className="mt-2 h-4 text-[12px] text-fg-3">
          {endsAt ? `Ends at ${endsAt}` : s.remainingMs < total ? "Paused" : `${Math.round(total / 60000)} min`}
        </span>
      </div>
    </div>
  );
}

function Controls({ s, large = false }: { s: PomodoroState; large?: boolean }) {
  const color = pomodoroColor(s.phase);
  const side = large ? "h-14 w-14" : "h-11 w-11";
  const main = large ? "h-20 w-20" : "h-16 w-16";

  return (
    <div className="flex items-center justify-center gap-5">
      <button
        onClick={() => pomodoro.reset()}
        aria-label="Reset"
        className={`btn btn-ghost ${side} rounded-full p-0`}
      >
        <RotateCcw size={large ? 20 : 17} />
      </button>
      <button
        onClick={() => (s.running ? pomodoro.pause() : pomodoro.start())}
        aria-label={s.running ? "Pause" : "Start"}
        className={`btn ${main} rounded-full p-0 text-white`}
        style={{
          background: color,
          borderColor: color,
          boxShadow: `0 8px 24px -6px color-mix(in srgb, ${color} 60%, transparent), var(--btn-shadow)`,
        }}
      >
        {s.running ? (
          <Pause size={large ? 30 : 26} fill="currentColor" strokeWidth={0} />
        ) : (
          <Play size={large ? 30 : 26} fill="currentColor" strokeWidth={0} className="translate-x-[2px]" />
        )}
      </button>
      <button
        onClick={() => pomodoro.skip()}
        aria-label="Skip to next phase"
        className={`btn btn-ghost ${side} rounded-full p-0`}
      >
        <SkipForward size={large ? 20 : 17} />
      </button>
    </div>
  );
}

function SessionDots({ count }: { count: number }) {
  const filled = count === 0 ? 0 : count % SESSIONS_PER_ROUND || SESSIONS_PER_ROUND;
  const color = pomodoroColor("study");

  return (
    <div className="mt-6 flex flex-col items-center gap-2">
      <div className="flex gap-2" aria-hidden>
        {Array.from({ length: SESSIONS_PER_ROUND }, (_, i) => (
          <span
            key={i}
            className="h-2.5 w-2.5 rounded-full transition-colors"
            style={{
              background: i < filled ? color : "var(--surface-hi)",
              boxShadow: i < filled ? `0 0 6px color-mix(in srgb, ${color} 60%, transparent)` : "var(--control-inset)",
            }}
          />
        ))}
      </div>
      <span className="text-[12px] text-fg-3">
        {count === 0
          ? "No sessions finished yet today"
          : `${count} ${count === 1 ? "session" : "sessions"} finished today`}
      </span>
    </div>
  );
}

function DurationsCard({ s }: { s: PomodoroState }) {
  const preset = PRESETS.find((p) => p.study === s.studyMin && p.rest === s.breakMin);
  const [custom, setCustom] = useState(!preset);

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-fg-3">Durations</h2>
      <div className="grid grid-cols-4 gap-2">
        {PRESETS.map((p) => {
          const active = !custom && preset === p;
          return (
            <button
              key={p.label}
              disabled={s.running}
              onClick={() => {
                setCustom(false);
                pomodoro.setDurations(p.study, p.rest);
              }}
              className={`btn flex-col gap-0 px-1 py-2 ${active ? "btn-soft" : "btn-ghost"}`}
              style={active ? { boxShadow: "inset 0 0 0 1.5px var(--accent)" } : undefined}
            >
              <span className="text-[13px] font-semibold tabular-nums">
                {p.study}/{p.rest}
              </span>
              <span className="text-[10px] opacity-75">{p.label}</span>
            </button>
          );
        })}
        <button
          disabled={s.running}
          onClick={() => setCustom(true)}
          className={`btn flex-col gap-0 px-1 py-2 ${custom ? "btn-soft" : "btn-ghost"}`}
          style={custom ? { boxShadow: "inset 0 0 0 1.5px var(--accent)" } : undefined}
        >
          <span className="text-[13px] font-semibold">Custom</span>
          <span className="text-[10px] opacity-75">
            {s.studyMin}/{s.breakMin}
          </span>
        </button>
      </div>

      {custom && (
        <div className="mt-3 grid grid-cols-2 gap-3 animate-in">
          <DurationField
            label="Study (minutes)"
            value={s.studyMin}
            disabled={s.running}
            onCommit={(n) => pomodoro.setStudyMin(n)}
          />
          <DurationField
            label="Break (minutes)"
            value={s.breakMin}
            disabled={s.running}
            onCommit={(n) => pomodoro.setBreakMin(n)}
          />
        </div>
      )}
      {s.running && <p className="mt-3 text-[12px] text-fg-3">Pause the timer to change durations.</p>}
    </div>
  );
}

function SoundCard({ s }: { s: PomodoroState }) {
  const VolumeIcon = s.volume === 0 ? VolumeX : s.volume < 0.5 ? Volume1 : Volume2;

  return (
    <div className="card p-5">
      <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
        Sound when time is up
      </h2>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Ringtone">
        {RINGTONES.map((r) => {
          const active = s.ringtone === r.id;
          return (
            <button
              key={r.id}
              role="radio"
              aria-checked={active}
              onClick={() => {
                pomodoro.setRingtone(r.id);
                unlockAudio();
                playRingtone(r.id, s.volume);
              }}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                active ? "" : "border-line hover:bg-surface-hi"
              }`}
              style={
                active
                  ? {
                      borderColor: "var(--accent)",
                      background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                    }
                  : undefined
              }
            >
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] font-medium ${active ? "text-accent" : "text-fg"}`}>
                  {r.label}
                </span>
                <span className="block truncate text-[11px] text-fg-3">{r.description}</span>
              </span>
              {active ? (
                <Check size={14} className="shrink-0 text-accent" />
              ) : r.id !== "none" ? (
                <Play size={12} className="shrink-0 text-fg-3" />
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-3">
        <VolumeIcon size={16} className="shrink-0 text-fg-3" />
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={s.volume}
          aria-label="Volume"
          disabled={s.ringtone === "none"}
          onChange={(e) => pomodoro.setVolume(Number(e.target.value))}
          onPointerUp={() => {
            unlockAudio();
            const now = pomodoro.getState();
            playRingtone(now.ringtone, now.volume);
          }}
          className="h-1.5 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
          style={{ accentColor: "var(--accent)" }}
        />
        <span className="w-9 text-right text-[12px] tabular-nums text-fg-3">{Math.round(s.volume * 100)}%</span>
      </div>
    </div>
  );
}

function FullscreenTimer({ onClose }: { onClose: () => void }) {
  const s = usePomodoro();
  const [containerEl, setContainerEl] = useState<HTMLDivElement | null>(null);
  useFullscreen(containerEl, onClose);

  return createPortal(
    <div
      ref={setContainerEl}
      className="fixed inset-0 z-[95] flex flex-col items-center justify-center animate-in"
      style={{ background: "var(--bg)" }}
    >
      <div
        className="absolute inset-x-0 top-0"
        style={{ height: "env(safe-area-inset-top, 0px)", background: "var(--surface)" }}
      />

      <button
        onClick={onClose}
        aria-label="Exit fullscreen"
        className="absolute right-4 rounded-lg p-2 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <Minimize2 size={18} />
      </button>

      <TimerRing s={s} size="min(78vw, 62vh)" timeClass="text-[min(16vw,13vh)]" />

      <Controls s={s} large />

      <SessionDots count={s.completedToday} />
    </div>,
    document.body,
  );
}

function DurationField({
  label,
  value,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  disabled: boolean;
  onCommit: (n: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  return (
    <div>
      <label className="field-label">{label}</label>
      <input
        className="input"
        type="number"
        min={1}
        max={180}
        value={draft}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => setDraft(String(value))}
      />
    </div>
  );
}
