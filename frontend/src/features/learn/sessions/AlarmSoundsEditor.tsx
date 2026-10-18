import { useState } from "react";
import SegmentedToggle from "../../../components/SegmentedToggle";
import { RingtoneGrid, VolumeSlider } from "../../../components/RingtonePicker";
import { playRingtone } from "../../../lib/ringtones";
import { sessionSounds, useSessionSounds, type SessionSoundKind } from "../../../lib/sessionSounds";
import type { StudySessionMode } from "../../../types";

const KINDS: { value: SessionSoundKind; label: string }[] = [
  { value: "focusEnd", label: "Focus end" },
  { value: "breakEnd", label: "Break end" },
];

const HINT: Record<SessionSoundKind, string> = {
  focusEnd: "Plays when a focus block ends and check-in opens.",
  breakEnd: "Plays when a break ends and the next block starts.",
};

export default function AlarmSoundsEditor({ mode }: { mode?: StudySessionMode }) {
  const sounds = useSessionSounds();
  const [kind, setKind] = useState<SessionSoundKind>("focusEnd");

  return (
    <div className="space-y-3">
      <SegmentedToggle options={KINDS} value={kind} onChange={setKind} className="w-full" />
      <p className="text-[12px] leading-snug text-fg-3">
        {HINT[kind]}
        {kind === "breakEnd" && mode === "TIMER" && " Timer sessions have no breaks, so it only plays in Pomodoro sessions."}
      </p>
      <RingtoneGrid
        value={sounds[kind]}
        volume={sounds.volume}
        label={kind === "focusEnd" ? "Focus end sound" : "Break end sound"}
        onSelect={(id) => sessionSounds.setSound(kind, id)}
      />
      <VolumeSlider
        volume={sounds.volume}
        disabled={sounds[kind] === "none"}
        onChange={sessionSounds.setVolume}
        onPreview={() => {
          const now = sessionSounds.getState();
          playRingtone(now[kind], now.volume);
        }}
      />
    </div>
  );
}
