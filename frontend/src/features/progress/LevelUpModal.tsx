import { Coins, Gift } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";

export default function LevelUpModal({
  levelBefore,
  levelAfter,
  coinsGained,
  onClose,
}: {
  levelBefore: number;
  levelAfter: number;
  coinsGained: number;
  onClose: () => void;
}) {
  const jumped = levelAfter - levelBefore;
  const chestLevels: number[] = [];
  for (let l = levelBefore + 1; l <= levelAfter; l++) if (l % 5 === 0) chestLevels.push(l);

  return (
    <Modal onClose={onClose} size="sm">
      <div className="flex flex-col items-center px-1 pb-1 pt-3 text-center">
        <div className="relative flex h-28 w-28 items-center justify-center">
          <span
            aria-hidden
            className="level-glow absolute inset-0 rounded-full"
            style={{ border: "3px solid color-mix(in srgb, var(--accent) 55%, transparent)" }}
          />
          <span
            className="level-pop relative flex h-28 w-28 flex-col items-center justify-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 50% 32%, color-mix(in srgb, var(--accent) 24%, var(--surface)) 0%, var(--surface) 72%)",
              boxShadow:
                "inset 0 0 0 3px var(--accent), 0 10px 30px -8px color-mix(in srgb, var(--accent) 55%, transparent)",
            }}
          >
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">Level</span>
            <span className="text-[40px] font-bold leading-none tabular-nums text-fg">{levelAfter}</span>
          </span>
        </div>

        <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">Level up!</p>
        <h2 className="mt-1 text-[18px] font-semibold text-fg">You reached level {levelAfter}</h2>
        {jumped > 1 && <p className="mt-1 text-[13px] text-fg-3">That's {jumped} levels in one go.</p>}

        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {coinsGained > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums"
              style={{
                background: "color-mix(in srgb, var(--amber-vivid) 16%, transparent)",
                color: "var(--yellow)",
              }}
            >
              <Coins size={14} />+{coinsGained} coins
            </span>
          )}
          {chestLevels.length > 0 && (
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold"
              style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)", color: "var(--accent)" }}
            >
              <Gift size={14} />
              {chestLevels.length === 1 ? "A chest" : `${chestLevels.length} chests`}
            </span>
          )}
        </div>

        <CloseButton />
      </div>
    </Modal>
  );
}

function CloseButton() {
  const close = useModalClose();
  return (
    <button onClick={close} className="btn btn-primary btn-lg mt-6 w-full" autoFocus>
      Keep going
    </button>
  );
}
