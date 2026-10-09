import { useState } from "react";
import Modal, { useModalClose } from "../../components/Modal";
import { ApiError } from "../../lib/api";
import StreakFlame from "./StreakFlame";
import { useRestoreStreak } from "./useProgress";
import type { BrokenStreakDto } from "../../types";

function weekday(date: string): string {
  return new Date(date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long" });
}

function missedLine(days: string[]): string {
  const names = days.map(weekday);
  return days.length === 1
    ? `You missed ${names[0]}. That takes 1 restore.`
    : `You missed ${names.join(" and ")}. That takes ${days.length} restores.`;
}

export default function StreakRestoreModal({
  broken,
  restoresLeft,
  onClose,
}: {
  broken: BrokenStreakDto;
  restoresLeft: number;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose} size="sm">
      <RestoreBody broken={broken} restoresLeft={restoresLeft} />
    </Modal>
  );
}

function RestoreBody({ broken, restoresLeft }: { broken: BrokenStreakDto; restoresLeft: number }) {
  const close = useModalClose();
  const restore = useRestoreStreak();
  const [snapshot] = useState(() => ({ broken, restoresLeft }));
  const restored = restore.data?.streak.current;
  const cost = snapshot.broken.missedDays.length;
  const left = restored !== undefined ? restore.data!.streak.restoresLeft : snapshot.restoresLeft;
  const error = restore.error instanceof ApiError ? restore.error.message : restore.error ? "Something went wrong" : null;

  return (
    <div className="pb-1 pt-2 text-center">
      <p className="text-[17px] font-bold text-fg">
        {restored !== undefined ? "Streak restored!" : `You have ${left} ${left === 1 ? "restore" : "restores"} this week.`}
      </p>

      <div className="my-6 flex justify-center">
        <span key={restored !== undefined ? "lit" : "out"} className={restored !== undefined ? "level-pop" : ""}>
          <StreakFlame streak={restored ?? 0} size={120} />
        </span>
      </div>

      <p
        className={`text-[16px] font-bold tabular-nums ${
          restored !== undefined ? "text-fg" : "text-fg-3 line-through"
        }`}
      >
        {restored ?? snapshot.broken.lostStreak}-day streak
      </p>
      <p className="mx-auto mt-1 max-w-xs text-[12.5px] leading-snug text-fg-3">
        {restored !== undefined
          ? `${left} ${left === 1 ? "restore" : "restores"} left this week. Study today to keep it going.`
          : missedLine(snapshot.broken.missedDays)}
      </p>

      <div className="mt-6">
        {restored !== undefined ? (
          <button onClick={close} className="btn btn-primary min-h-[44px] w-full">
            Done
          </button>
        ) : snapshot.restoresLeft >= cost ? (
          <button
            onClick={() => restore.mutate()}
            disabled={restore.isPending}
            className="btn btn-primary min-h-[44px] w-full"
          >
            {restore.isPending ? "Restoring…" : "Restore my streak"}
          </button>
        ) : (
          <button
            disabled
            className="btn min-h-[44px] w-full"
            style={{ background: "var(--surface-hi)", color: "var(--fg-3)", opacity: 1 }}
          >
            {snapshot.restoresLeft === 0 ? "No more restores" : "Not enough restores"}
          </button>
        )}
        {error && <p className="mt-2 text-[12.5px] text-red">{error}</p>}
      </div>
    </div>
  );
}
