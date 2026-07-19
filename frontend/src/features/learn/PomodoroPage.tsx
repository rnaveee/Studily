import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { formatMs, pomodoro, pomodoroColor, usePomodoro } from "../../lib/pomodoro";

export default function PomodoroPage() {
  const s = usePomodoro();
  const color = pomodoroColor(s.phase);

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center gap-3">
        <Link
          to="/learn"
          className="rounded-lg p-1.5 text-fg-3 transition-colors hover:bg-surface-hi hover:text-fg"
          aria-label="Back to Learn"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-xl font-semibold text-fg">Pomodoro Timer</h1>
          <p className="mt-1 text-[13px] text-fg-3">Focus in sprints — study, break, repeat.</p>
        </div>
      </div>

      <div className="card mx-auto w-full max-w-md p-8 text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wider"
          style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
        >
          {s.phase === "study" ? "Study" : "Break"}
        </span>

        <div
          className="mt-4 font-mono text-6xl font-bold tabular-nums"
          style={{ color }}
        >
          {formatMs(s.remainingMs)}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {s.running ? (
            <button onClick={() => pomodoro.pause()} className="btn btn-primary">
              <Pause size={13} />
              Pause
            </button>
          ) : (
            <button onClick={() => pomodoro.start()} className="btn btn-primary">
              <Play size={13} />
              Start
            </button>
          )}
          <button onClick={() => pomodoro.skip()} className="btn btn-ghost">
            <SkipForward size={13} />
            Skip
          </button>
          <button onClick={() => pomodoro.reset()} className="btn btn-ghost">
            <RotateCcw size={13} />
            Reset
          </button>
        </div>
      </div>

      <div className="card mx-auto w-full max-w-md p-5">
        <h2 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-fg-3">
          Durations
        </h2>
        <div className="grid grid-cols-2 gap-3">
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
        {s.running && (
          <p className="mt-3 text-[12px] text-fg-3">Pause the timer to change durations.</p>
        )}
      </div>
    </div>
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
