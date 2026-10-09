import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Gift, PackageOpen, Sparkles } from "lucide-react";
import Avatar from "../../components/Avatar";
import Modal, { useModalClose } from "../../components/Modal";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { flairRef, RARITY_COLOR, RARITY_LABEL } from "../../lib/flairs";
import { applyDelta } from "../../lib/progressDelta";
import BadgeArt from "./BadgeArt";
import { CHEST_SOURCE_LABEL } from "./badges";
import { useEquipFlair } from "./useProgress";
import type { ChestDto, ChestOpenResult, FlairDto } from "../../types";

const MIN_SHAKE_MS = 650;

export default function ChestModal({ chests, onClose }: { chests: ChestDto[]; onClose: () => void }) {
  return (
    <Modal onClose={onClose} size="sm">
      <ChestFlow chests={chests} />
    </Modal>
  );
}

function ChestFlow({ chests }: { chests: ChestDto[] }) {
  const qc = useQueryClient();
  const close = useModalClose();
  const [index, setIndex] = useState(0);
  const [opened, setOpened] = useState<ChestDto | null>(null);
  const chest = chests[index];
  const remaining = chests.length - index - 1;

  const open = useMutation({
    mutationFn: async (id: number) => {
      const [res] = await Promise.all([
        api.post<ChestOpenResult>(`/chests/${id}/open`),
        new Promise((r) => setTimeout(r, MIN_SHAKE_MS)),
      ]);
      return res;
    },
    onSuccess: (res) => {
      setOpened(res.chest);
      const lootBadge = res.chest.loot?.badge;
      const lootFlair = res.chest.loot?.flair;
      applyDelta(res.delta, qc, {
        toastXp: false,
        shownBadges: lootBadge ? [lootBadge.code] : [],
        shownFlairs: lootFlair ? [lootFlair.code] : [],
      });
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ["chests"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
      if (remaining > 0) next();
      else close();
    },
  });

  function next() {
    setOpened(null);
    setIndex((i) => i + 1);
  }

  if (!chest) return null;

  const loot = opened?.loot ?? null;
  const lootFlair = loot?.flair ?? null;
  const shaking = open.isPending;

  return (
    <div className="flex flex-col items-center pb-1 pt-3 text-center">
      {chests.length > 1 && (
        <span className="mb-2 text-[11px] font-medium tabular-nums text-fg-3">
          Chest {index + 1} of {chests.length}
        </span>
      )}

      <button
        type="button"
        onClick={() => !opened && !shaking && open.mutate(chest.id)}
        disabled={!!opened || shaking}
        aria-label={opened ? "Chest opened" : "Open chest"}
        className="relative flex h-32 w-32 items-center justify-center rounded-full disabled:cursor-default"
      >
        {opened && (
          <span
            aria-hidden
            className="level-glow absolute inset-0 rounded-full"
            style={{ border: "3px solid color-mix(in srgb, var(--amber-vivid) 60%, transparent)" }}
          />
        )}
        <span
          key={opened ? "open" : "closed"}
          className={`relative flex h-28 w-28 items-center justify-center rounded-[28px] ${
            opened ? "chest-reveal" : shaking ? "chest-shake" : ""
          }`}
          style={{
            background: opened
              ? "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--amber-vivid) 30%, var(--surface)) 0%, var(--surface) 75%)"
              : "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--accent) 22%, var(--surface)) 0%, var(--surface) 75%)",
            boxShadow: opened
              ? "inset 0 0 0 2px color-mix(in srgb, var(--amber-vivid) 70%, transparent), 0 12px 32px -10px color-mix(in srgb, var(--amber-vivid) 60%, transparent)"
              : "inset 0 0 0 2px color-mix(in srgb, var(--accent) 50%, transparent), 0 12px 32px -10px color-mix(in srgb, var(--accent) 50%, transparent)",
          }}
        >
          {opened ? (
            <PackageOpen size={52} strokeWidth={1.5} style={{ color: "var(--amber-vivid)" }} />
          ) : (
            <Gift size={52} strokeWidth={1.5} className="text-accent" />
          )}
        </span>
      </button>

      <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
        {CHEST_SOURCE_LABEL[chest.source]}
      </p>
      <h2 className="mt-1 text-[18px] font-semibold text-fg">
        {opened ? (lootFlair ? "A rare find!" : "Here's what you got") : shaking ? "Opening…" : "You found a chest!"}
      </h2>
      {!opened && !shaking && <p className="mt-1 text-[13px] text-fg-3">Tap it to see what's inside.</p>}

      {opened && (
        <ul className="mt-4 w-full space-y-2 stagger-children">
          {loot && loot.coins > 0 && (
            <LootRow
              icon={<Coins size={16} />}
              color="var(--yellow)"
              tint="var(--amber-vivid)"
              label={`+${loot.coins} coins`}
            />
          )}
          {loot && loot.xp > 0 && (
            <LootRow icon={<Sparkles size={16} />} color="var(--accent)" tint="var(--accent)" label={`+${loot.xp} XP`} />
          )}
          {loot?.badge && (
            <li
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
              style={{ background: "color-mix(in srgb, var(--accent) 9%, transparent)" }}
            >
              <BadgeArt badge={loot.badge} size={40} locked={false} />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-accent">New badge</span>
                <span className="block truncate text-[14px] font-semibold text-fg">{loot.badge.title}</span>
              </span>
            </li>
          )}
          {lootFlair && <FlairLoot flair={lootFlair} />}
        </ul>
      )}

      <div className="mt-6 flex w-full gap-2">
        {opened ? (
          remaining > 0 ? (
            <button onClick={next} className="btn btn-primary btn-lg w-full" style={{ minHeight: 44 }}>
              Next chest ({remaining} left)
            </button>
          ) : (
            <button onClick={close} className="btn btn-primary btn-lg w-full" style={{ minHeight: 44 }} autoFocus>
              Done
            </button>
          )
        ) : (
          <>
            <button onClick={close} disabled={shaking} className="btn btn-ghost btn-lg flex-1" style={{ minHeight: 44 }}>
              Later
            </button>
            <button
              onClick={() => open.mutate(chest.id)}
              disabled={shaking}
              className="btn btn-primary btn-lg flex-1"
              style={{ minHeight: 44 }}
              autoFocus
            >
              <Gift size={15} />
              Open
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function FlairLoot({ flair }: { flair: FlairDto }) {
  const { user } = useAuth();
  const equip = useEquipFlair();
  const wearing = user?.flair?.code === flair.code;
  const color = RARITY_COLOR[flair.rarity];

  return (
    <li
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      style={{ background: `color-mix(in srgb, ${color} 10%, transparent)` }}
    >
      <span className="flair-reveal shrink-0">
        <Avatar
          name={user?.name}
          username={user?.username}
          avatarUrl={user?.avatarUrl}
          flair={flairRef(flair)}
          size={56}
          className="text-lg"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-semibold uppercase tracking-wider" style={{ color }}>
          {RARITY_LABEL[flair.rarity]} flair
        </span>
        <span className="block truncate text-[14px] font-semibold text-fg">{flair.title}</span>
      </span>
      {wearing ? (
        <span className="btn btn-ghost pointer-events-none shrink-0" style={{ minHeight: 40, color: "var(--green)" }}>
          <Check size={14} />
          Equipped
        </span>
      ) : (
        <button
          onClick={() => equip.mutate(flair.code)}
          disabled={equip.isPending}
          className="btn btn-soft shrink-0"
          style={{ minHeight: 40 }}
        >
          {equip.isPending ? "Equipping…" : "Equip"}
        </button>
      )}
    </li>
  );
}

function LootRow({ icon, color, tint, label }: { icon: React.ReactNode; color: string; tint: string; label: string }) {
  return (
    <li
      className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left"
      style={{ background: `color-mix(in srgb, ${tint} 12%, transparent)` }}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `color-mix(in srgb, ${tint} 18%, transparent)`, color }}
      >
        {icon}
      </span>
      <span className="text-[15px] font-semibold tabular-nums" style={{ color }}>
        {label}
      </span>
    </li>
  );
}
