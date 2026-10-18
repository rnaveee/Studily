import { useEffect, useRef } from "react";
import { pomodoro } from "../../../lib/pomodoro";
import { audioUnlocked, playRingtone, unlockAudio } from "../../../lib/ringtones";
import { useActiveSession } from "../../progress/useProgress";

export default function CheckinChime() {
  const { data: session, dataUpdatedAt } = useActiveSession();
  const block =
    session && session.status === "ACTIVE" && !session.userPausedAt
      ? (session.blocks.find((b) => b.index === session.currentBlock && b.status === "RUNNING") ?? null)
      : null;
  const skew = session ? Date.parse(session.serverNow) - dataUpdatedAt : 0;
  const opensAt = block && session?.checkinOpensAt ? Date.parse(session.checkinOpensAt) - skew : null;
  const closesAt = block && session?.checkinClosesAt ? Date.parse(session.checkinClosesAt) - skew : null;
  const key = block && session ? `${session.id}:${block.index}:${session.checkinOpensAt}` : null;
  const live = session?.status === "ACTIVE";

  const last = useRef(Date.now());
  const chimed = useRef<string | null>(null);

  useEffect(() => {
    if (!live) return;
    const unlock = () => {
      if (!audioUnlocked()) unlockAudio();
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
    };
  }, [live]);

  useEffect(() => {
    if (key === null || opensAt === null || closesAt === null) return;
    const tick = () => {
      const now = Date.now();
      if (last.current < opensAt && now >= opensAt && now <= closesAt && chimed.current !== key) {
        chimed.current = key;
        const p = pomodoro.getState();
        playRingtone(p.ringtone, p.volume);
      }
      last.current = now;
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [key, opensAt, closesAt]);

  return null;
}
