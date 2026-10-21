import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { useConfirm } from "../../../lib/confirm";
import { formatTime } from "../../../lib/format";
import { formatMs, pomodoroColor } from "../../../lib/pomodoro";
import { applyDelta, holdProgressMoments } from "../../../lib/progressDelta";
import { progressKeys } from "../../progress/useProgress";
import type { StudySessionDto, StudySessionResult, StudySessionTaskDto } from "../../../types";

export type Phase = "focus" | "break" | "checkin" | "late" | "expired" | "paused" | "held";

const FOCUS = pomodoroColor("study");
const BREAK = pomodoroColor("break");
const CHECKIN = "var(--blue-vivid)";
const USER_PAUSE_LIMIT_MS = 30 * 60_000;

export function useSessionControls(session: StudySessionDto, receivedAt: number) {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const skew = Date.parse(session.serverNow) - receivedAt;
  const [now, setNow] = useState(() => Date.now() + skew);

  useEffect(() => {
    setNow(Date.now() + skew);
    const id = window.setInterval(() => setNow(Date.now() + skew), 250);
    return () => window.clearInterval(id);
  }, [skew]);

  const current = session.blocks.find((b) => b.index === session.currentBlock) ?? null;
  const running = session.status === "ACTIVE" && current?.status === "RUNNING" ? current : null;
  const startMs = running ? Date.parse(running.startedAt) : 0;
  const dueMs = running ? Date.parse(running.dueAt) : 0;
  const opensMs = session.checkinOpensAt ? Date.parse(session.checkinOpensAt) : dueMs - 60_000;
  const closesMs = session.checkinClosesAt ? Date.parse(session.checkinClosesAt) : dueMs + 10 * 60_000;
  const heldMs = running && session.userPausedAt ? Date.parse(session.userPausedAt) : null;

  let phase: Phase;
  if (!running) phase = "paused";
  else if (heldMs !== null) phase = "held";
  else if (now < startMs) phase = "break";
  else if (now < opensMs) phase = "focus";
  else if (now <= dueMs) phase = "checkin";
  else if (now <= closesMs) phase = "late";
  else phase = "expired";

  useEffect(() => {
    if (phase !== "expired") return;
    const sync = () => {
      qc.invalidateQueries({ queryKey: progressKeys.activeSession });
      qc.invalidateQueries({ queryKey: progressKeys.history });
      qc.invalidateQueries({ queryKey: progressKeys.streak });
    };
    sync();
    const id = window.setInterval(sync, 10_000);
    return () => window.clearInterval(id);
  }, [phase, qc]);

  useEffect(
    () => () => {
      if (qc.getQueryData(progressKeys.activeSession) === null) {
        qc.invalidateQueries({ queryKey: progressKeys.history });
        qc.invalidateQueries({ queryKey: progressKeys.streak });
      }
    },
    [qc],
  );

  function settle(result: StudySessionResult) {
    const s = result.session;
    const open = s.status === "ACTIVE" || s.status === "PAUSED";
    if (!open) holdProgressMoments();
    qc.setQueryData(progressKeys.activeSession, open ? s : null);
    qc.invalidateQueries({ queryKey: progressKeys.streak });
    qc.invalidateQueries({ queryKey: progressKeys.history });
    applyDelta(result.delta, qc, { toastXp: open });
    return s;
  }

  const refresh = () => qc.invalidateQueries({ queryKey: progressKeys.activeSession });

  const checkin = useMutation({
    mutationFn: () => api.post<StudySessionResult>(`/study-sessions/${session.id}/checkin`),
    onSuccess: settle,
    onError: refresh,
  });

  const pause = useMutation({
    mutationFn: () => api.post<StudySessionDto>(`/study-sessions/${session.id}/pause`),
    onSuccess: (s) => qc.setQueryData(progressKeys.activeSession, s),
    onError: refresh,
  });

  const resume = useMutation({
    mutationFn: () => api.post<StudySessionDto>(`/study-sessions/${session.id}/resume`),
    onSuccess: (s) => qc.setQueryData(progressKeys.activeSession, s),
    onError: refresh,
  });

  const end = useMutation({
    mutationFn: () => api.post<StudySessionResult>(`/study-sessions/${session.id}/end`),
    onSuccess: settle,
    onError: refresh,
  });

  const toggleTask = useMutation({
    mutationFn: (v: { taskId: number; done: boolean }) =>
      api.patch<StudySessionResult>(`/study-sessions/${session.id}/tasks/${v.taskId}`, { done: v.done }),
    onMutate: (v) => {
      qc.setQueryData<StudySessionDto | null>(progressKeys.activeSession, (old) =>
        old
          ? {
              ...old,
              serverNow: new Date(Date.now() + skew).toISOString(),
              tasks: old.tasks.map((t) => (t.id === v.taskId ? { ...t, done: v.done } : t)),
            }
          : old,
      );
    },
    onSuccess: settle,
    onError: refresh,
  });

  const patchTasks = (fn: (tasks: StudySessionTaskDto[]) => StudySessionTaskDto[]) =>
    qc.setQueryData<StudySessionDto | null>(progressKeys.activeSession, (old) =>
      old ? { ...old, serverNow: new Date(Date.now() + skew).toISOString(), tasks: fn(old.tasks) } : old,
    );

  const addTask = useMutation({
    mutationFn: (text: string) => api.post<StudySessionDto>(`/study-sessions/${session.id}/tasks`, { text }),
    onSuccess: (s) => qc.setQueryData(progressKeys.activeSession, s),
    onError: refresh,
  });

  const renameTask = useMutation({
    mutationFn: (v: { taskId: number; text: string }) =>
      api.patch<StudySessionResult>(`/study-sessions/${session.id}/tasks/${v.taskId}`, { text: v.text }),
    onMutate: (v) => patchTasks((tasks) => tasks.map((t) => (t.id === v.taskId ? { ...t, text: v.text } : t))),
    onSuccess: settle,
    onError: refresh,
  });

  const removeTask = useMutation({
    mutationFn: (taskId: number) => api.del<StudySessionDto>(`/study-sessions/${session.id}/tasks/${taskId}`),
    onMutate: (taskId) => patchTasks((tasks) => tasks.filter((t) => t.id !== taskId)),
    onSuccess: (s) => qc.setQueryData(progressKeys.activeSession, s),
    onError: refresh,
  });

  async function endSession() {
    const ok = await confirm({
      title: "End this study session?",
      message:
        "If you've studied at least 10 minutes of the current block, those minutes still count. Otherwise the block is dropped.",
      confirmLabel: "End session",
      danger: true,
    });
    if (ok) end.mutate();
  }

  const busy = checkin.isPending || pause.isPending || resume.isPending || end.isPending;
  const color =
    phase === "break"
      ? BREAK
      : phase === "late" || phase === "checkin"
        ? CHECKIN
        : phase === "paused" || phase === "expired" || phase === "held"
          ? "var(--fg-3)"
          : FOCUS;
  const localTime = (ms: number) => formatTime(new Date(ms - skew).toISOString());

  let fraction = 1;
  let clock = "--:--";
  let label = "Focus";
  let caption = "";
  if (phase === "focus" || phase === "checkin") {
    fraction = (dueMs - now) / Math.max(1, dueMs - startMs);
    clock = formatMs(dueMs - now);
    label = phase === "checkin" ? "Almost done" : "Focus";
    caption = `Ends at ${localTime(dueMs)}`;
  } else if (phase === "break") {
    fraction = (startMs - now) / Math.max(1, session.breakMinutes * 60_000);
    clock = formatMs(startMs - now);
    label = "Break";
    caption = `Block ${session.currentBlock} at ${localTime(startMs)}`;
  } else if (phase === "late") {
    fraction = (closesMs - now) / Math.max(1, closesMs - dueMs);
    clock = formatMs(closesMs - now);
    label = "Check in!";
    caption = "left to check in";
  } else if (phase === "expired") {
    fraction = 0;
    clock = "00:00";
    label = "Missed";
    caption = "Updating…";
  } else if (phase === "held" && heldMs !== null) {
    const inBreak = heldMs < startMs;
    const left = inBreak ? startMs - heldMs : dueMs - heldMs;
    fraction = left / Math.max(1, inBreak ? session.breakMinutes * 60_000 : dueMs - startMs);
    clock = formatMs(left);
    label = "Paused";
    caption = `Ends in ${formatMs(heldMs + USER_PAUSE_LIMIT_MS - now)}`;
  } else {
    label = "On hold";
    caption = "Missed a check-in";
  }
  fraction = Math.min(1, Math.max(0, fraction));

  const canCheckIn = phase === "checkin" || phase === "late";
  const toggle: "pause" | "play" | null =
    phase === "focus" || phase === "break" ? "pause" : phase === "held" || phase === "paused" ? "play" : null;

  return {
    phase,
    color,
    now,
    startMs,
    dueMs,
    busy,
    canCheckIn,
    toggle,
    untilStart: startMs - now,
    untilCheckin: opensMs - now,
    ring: { color, fraction, label, clock, caption, glow: phase === "focus" || phase === "break" },
    onToggle: () => (toggle === "pause" ? pause.mutate() : toggle === "play" ? resume.mutate() : undefined),
    onCheckIn: () => checkin.mutate(),
    onResume: () => resume.mutate(),
    onEnd: endSession,
    tasks: {
      tasks: session.tasks,
      adding: addTask.isPending,
      onToggle: (t: StudySessionTaskDto) => toggleTask.mutate({ taskId: t.id, done: !t.done }),
      onRename: (t: StudySessionTaskDto, text: string) => renameTask.mutate({ taskId: t.id, text }),
      onRemove: (t: StudySessionTaskDto) => removeTask.mutate(t.id),
      onAdd: (text: string) => addTask.mutate(text),
    },
  };
}

export type SessionControls = ReturnType<typeof useSessionControls>;
