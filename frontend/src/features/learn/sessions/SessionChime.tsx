import { useEffect, useRef } from "react";
import { audioUnlocked, playRingtone, unlockAudio } from "../../../lib/ringtones";
import { sessionSounds, type SessionSoundKind } from "../../../lib/sessionSounds";
import { useActiveSession } from "../../progress/useProgress";

const BREAK_GRACE_MS = 2 * 60_000;

function ring(kind: SessionSoundKind) {
  const s = sessionSounds.getState();
  playRingtone(s[kind], s.volume);
}

export default function SessionChime() {
  const { data: session, dataUpdatedAt } = useActiveSession();
  const block =
    session && session.status === "ACTIVE" && !session.userPausedAt
      ? (session.blocks.find((b) => b.index === session.currentBlock && b.status === "RUNNING") ?? null)
      : null;
  const skew = session ? Date.parse(session.serverNow) - dataUpdatedAt : 0;
  const startsAt = block ? Date.parse(block.startedAt) - skew : null;
  const opensAt = block && session?.checkinOpensAt ? Date.parse(session.checkinOpensAt) - skew : null;
  const closesAt = block && session?.checkinClosesAt ? Date.parse(session.checkinClosesAt) - skew : null;
  const key = block && session ? `${session.id}:${block.index}:${block.startedAt}:${session.checkinOpensAt}` : null;
  const live = session?.status === "ACTIVE";

  const last = useRef(Date.now());
  const chimed = useRef<string | null>(null);
  const onBreak = useRef<string | null>(null);

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
    if (key === null || startsAt === null || opensAt === null || closesAt === null) return;
    const tick = () => {
      const now = Date.now();
      if (now < startsAt) {
        onBreak.current = key;
      } else if (onBreak.current === key) {
        onBreak.current = null;
        if (now - startsAt < BREAK_GRACE_MS) ring("breakEnd");
      }
      if (last.current < opensAt && now >= opensAt && now <= closesAt && chimed.current !== key) {
        chimed.current = key;
        ring("focusEnd");
      }
      last.current = now;
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [key, startsAt, opensAt, closesAt]);

  return null;
}
