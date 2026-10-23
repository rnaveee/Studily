import { useNavigate } from "react-router-dom";
import Modal, { useModalClose } from "../../components/Modal";
import BadgeArt from "./BadgeArt";
import type { BadgeDto } from "../../types";

export default function BadgeAwardModal({ badges, onClose }: { badges: BadgeDto[]; onClose: () => void }) {
  const single = badges.length === 1 ? badges[0] : null;

  return (
    <Modal onClose={onClose} size="sm">
      <div className="flex flex-col items-center px-1 pb-1 pt-3 text-center">
        {single ? (
          <>
            <div className="relative flex h-36 w-36 items-center justify-center">
              <span
                aria-hidden
                className="level-glow absolute inset-0 rounded-full"
                style={{ border: "3px solid color-mix(in srgb, var(--accent) 45%, transparent)" }}
              />
              <span className="level-pop relative">
                <BadgeArt badge={single} size={128} locked={false} />
              </span>
            </div>
            <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">New badge!</p>
            <h2 className="mt-1 text-[18px] font-semibold text-fg">{single.title}</h2>
            <p className="mt-1 max-w-xs text-[13px] text-fg-3">{single.description}</p>
          </>
        ) : (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">New badges!</p>
            <div className="mt-4 flex flex-wrap justify-center gap-4">
              {badges.map((badge) => (
                <div key={badge.code} className="level-pop flex w-24 flex-col items-center gap-1.5">
                  <BadgeArt badge={badge} size={72} locked={false} />
                  <span className="text-[12px] font-semibold text-fg">{badge.title}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <Actions />
      </div>
    </Modal>
  );
}

function Actions() {
  const close = useModalClose();
  const navigate = useNavigate();
  return (
    <div className="mt-6 flex w-full flex-col gap-2">
      <button onClick={close} className="btn btn-primary btn-lg w-full" style={{ minHeight: 44 }} autoFocus>
        Nice!
      </button>
      <button
        type="button"
        className="btn btn-ghost w-full text-xs"
        onClick={() => {
          close();
          navigate("/profile/badges");
        }}
      >
        See my badges
      </button>
    </div>
  );
}
