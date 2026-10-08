import { useEffect, useRef, useState } from "react";
import { onProgressMoment, type ProgressMoment } from "../../lib/progressDelta";
import ChestModal from "./ChestModal";
import LevelUpModal from "./LevelUpModal";

interface Queued {
  id: number;
  moment: ProgressMoment;
}

function queuedChestIds(queue: Queued[]): Set<number> {
  const ids = new Set<number>();
  for (const q of queue) if (q.moment.kind === "chests") q.moment.chests.forEach((c) => ids.add(c.id));
  return ids;
}

export default function ProgressHost() {
  const [queue, setQueue] = useState<Queued[]>([]);
  const seq = useRef(0);

  useEffect(
    () =>
      onProgressMoment((moment) => {
        setQueue((q) => {
          if (moment.kind === "chests") {
            const seen = queuedChestIds(q);
            const fresh = moment.chests.filter((c) => !seen.has(c.id));
            if (fresh.length === 0) return q;
            return [...q, { id: ++seq.current, moment: { kind: "chests", chests: fresh } }];
          }
          return [...q, { id: ++seq.current, moment }];
        });
      }),
    [],
  );

  const current = queue[0];
  if (!current) return null;

  const done = () => setQueue((q) => q.slice(1));

  if (current.moment.kind === "level-up") {
    return (
      <LevelUpModal
        key={current.id}
        levelBefore={current.moment.levelBefore}
        levelAfter={current.moment.levelAfter}
        coinsGained={current.moment.coinsGained}
        onClose={done}
      />
    );
  }
  return <ChestModal key={current.id} chests={current.moment.chests} onClose={done} />;
}
