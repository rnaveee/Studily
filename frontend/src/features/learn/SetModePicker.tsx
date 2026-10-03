import { useSearchParams } from "react-router-dom";
import { Brain, GraduationCap, Layers, LayoutGrid, Lock, Zap } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type StudyMode = "flashcards" | "study" | "learn" | "memory" | "match";

const MODES: { mode: StudyMode; label: string; icon: LucideIcon }[] = [
  { mode: "flashcards", label: "Flashcards", icon: Layers },
  { mode: "study",      label: "Study",      icon: GraduationCap },
  { mode: "learn",      label: "Learn",      icon: Brain },
  { mode: "memory",     label: "Memory",     icon: LayoutGrid },
  { mode: "match",      label: "Match",      icon: Zap },
];

export function useStudyMode(): [StudyMode, (mode: StudyMode) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get("mode");
  const mode = MODES.some((m) => m.mode === raw) ? (raw as StudyMode) : "flashcards";
  const setMode = (next: StudyMode) => {
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (next === "flashcards") out.delete("mode");
        else out.set("mode", next);
        return out;
      },
      { replace: true },
    );
  };
  return [mode, setMode];
}

interface Props {
  mode: StudyMode;
  onChange: (mode: StudyMode) => void;
  color: string;
  dueCount?: number;
  studyLocked?: boolean;
}

export default function SetModePicker({ mode, onChange, color, dueCount = 0, studyLocked = false }: Props) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" role="tablist" aria-label="Study modes">
      {MODES.map(({ mode: m, label, icon: Icon }) => {
        const active = m === mode;
        const locked = m === "study" && studyLocked;
        return (
          <button
            key={m}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(m)}
            className="card press flex flex-col items-center gap-1 px-2 py-2.5 transition-colors hover:bg-surface-hi"
            style={
              active
                ? {
                    borderColor: color,
                    background: `color-mix(in srgb, ${color} 10%, var(--surface))`,
                  }
                : undefined
            }
          >
            <span className="relative">
              <Icon size={17} style={{ color: active ? color : "var(--fg-3)" }} />
              {locked && (
                <Lock size={10} className="absolute -right-2 -bottom-1 text-fg-3" />
              )}
            </span>
            <span className={`text-[12px] font-medium ${active ? "text-fg" : "text-fg-2"}`}>
              {label}
              {m === "study" && !studyLocked && dueCount > 0 ? ` (${dueCount})` : ""}
            </span>
          </button>
        );
      })}
    </div>
  );
}
