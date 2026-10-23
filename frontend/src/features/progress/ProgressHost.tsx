import { useEffect, useRef, useState } from "react";
import { api } from "../../lib/api";
import { wasAnnounced } from "../../lib/chestAnnounce";
import { offerChests, onProgressMoment, type ProgressMoment } from "../../lib/progressDelta";
import { useWelcomeTourStep } from "../../lib/welcomeTour";
import { useProgressEnabled } from "./useProgress";
import BadgeAwardModal from "./BadgeAwardModal";
import ChestModal from "./ChestModal";
import LevelUpModal from "./LevelUpModal";
import type { ChestDto } from "../../types";

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

  const enabled = useProgressEnabled();
  const touring = useWelcomeTourStep() !== null;
  const checked = useRef(false);

  useEffect(() => {
    if (!enabled || touring || checked.current) return;
    checked.current = true;
    api
      .get<ChestDto[]>("/chests")
      .then((chests) => offerChests(chests.filter((c) => c.source === "WELCOME" && !wasAnnounced(c.id))))
      .catch(() => {});
  }, [enabled, touring]);

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
  if (current.moment.kind === "badges") {
    return <BadgeAwardModal key={current.id} badges={current.moment.badges} onClose={done} />;
  }
  return <ChestModal key={current.id} chests={current.moment.chests} onClose={done} />;
}
