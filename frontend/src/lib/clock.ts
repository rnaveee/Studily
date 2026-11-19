import { useEffect, useState } from "react";

interface Channel {
  listeners: Set<() => void>;
  id: number | null;
}

const channels = new Map<number, Channel>();

function fire(channel: Channel) {
  channel.listeners.forEach((fn) => fn());
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) channels.forEach(fire);
  });
}

export function subscribeClock(intervalMs: number, fn: () => void): () => void {
  let channel = channels.get(intervalMs);
  if (!channel) {
    channel = { listeners: new Set(), id: null };
    channels.set(intervalMs, channel);
  }
  const shared = channel;
  shared.listeners.add(fn);
  if (shared.id === null) shared.id = window.setInterval(() => fire(shared), intervalMs);
  return () => {
    shared.listeners.delete(fn);
    if (shared.listeners.size === 0 && shared.id !== null) {
      window.clearInterval(shared.id);
      shared.id = null;
      channels.delete(intervalMs);
    }
  };
}

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    return subscribeClock(intervalMs, () => setNow(Date.now()));
  }, [intervalMs]);
  return now;
}
