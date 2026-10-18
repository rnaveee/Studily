import { Check, Play, Volume1, Volume2, VolumeX } from "lucide-react";
import { playRingtone, RINGTONES, unlockAudio, type RingtoneId } from "../lib/ringtones";

export function RingtoneGrid({
  value,
  volume,
  onSelect,
  label = "Ringtone",
  className = "grid-cols-2",
}: {
  value: RingtoneId;
  volume: number;
  onSelect: (id: RingtoneId) => void;
  label?: string;
  className?: string;
}) {
  return (
    <div className={`grid gap-2 ${className}`} role="radiogroup" aria-label={label}>
      {RINGTONES.map((r) => {
        const active = value === r.id;
        return (
          <button
            key={r.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => {
              onSelect(r.id);
              unlockAudio();
              playRingtone(r.id, volume);
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
              <span className={`block text-[13px] font-medium ${active ? "text-accent" : "text-fg"}`}>{r.label}</span>
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
  );
}

export function VolumeSlider({
  volume,
  disabled = false,
  onChange,
  onPreview,
}: {
  volume: number;
  disabled?: boolean;
  onChange: (volume: number) => void;
  onPreview: () => void;
}) {
  const VolumeIcon = volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;
  return (
    <div className="flex items-center gap-3">
      <VolumeIcon size={16} className="shrink-0 text-fg-3" />
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        aria-label="Volume"
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => {
          unlockAudio();
          onPreview();
        }}
        className="h-1.5 flex-1 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
        style={{ accentColor: "var(--accent)" }}
      />
      <span className="w-9 text-right text-[12px] tabular-nums text-fg-3">{Math.round(volume * 100)}%</span>
    </div>
  );
}
