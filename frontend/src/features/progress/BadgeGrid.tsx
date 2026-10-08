import BadgeTile from "./BadgeTile";
import type { BadgeDto } from "../../types";

export default function BadgeGrid({
  badges,
  picking = false,
  picked = [],
  onPick,
}: {
  badges: BadgeDto[];
  picking?: boolean;
  picked?: string[];
  onPick?: (badge: BadgeDto) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
      {badges.map((b) => {
        const index = picked.indexOf(b.code);
        return (
          <BadgeTile
            key={b.code}
            badge={b}
            picking={picking}
            slot={picking && index >= 0 ? index + 1 : null}
            onPick={onPick}
          />
        );
      })}
    </div>
  );
}
