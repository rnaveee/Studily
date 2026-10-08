import { Check, Coins, Flame, Gift, Lock, ShoppingBag } from "lucide-react";
import Avatar from "../../components/Avatar";
import { Skeleton } from "../../components/Skeleton";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { flairRef, RARITY_COLOR, RARITY_LABEL, unlockHint } from "../../lib/flairs";
import { useBuyFlair, useEquipFlair, useFlairs } from "./useProgress";
import type { FlairDto, User } from "../../types";

export function FlairsPanel({ streakBest, onShop }: { streakBest: number | null; onShop: () => void }) {
  const { user } = useAuth();
  const flairs = useFlairs();
  const equip = useEquipFlair();

  if (flairs.isLoading) return <FlairsSkeleton preview />;
  if (!flairs.data) return <FlairsError onRetry={() => flairs.refetch()} />;

  const list = flairs.data;
  const owned = list.filter((f) => f.owned);
  const locked = list.filter((f) => !f.owned);
  const pendingCode = equip.isPending ? equip.variables : undefined;
  const shown =
    pendingCode !== undefined ? (list.find((f) => f.code === pendingCode) ?? null) : (list.find((f) => f.equipped) ?? null);

  function toggle(flair: FlairDto) {
    if (equip.isPending) return;
    equip.mutate(flair.equipped ? null : flair.code);
  }

  return (
    <div className="space-y-6">
      <Preview
        user={user}
        flair={shown}
        ownsAny={owned.length > 0}
        busy={equip.isPending}
        onRemove={() => equip.mutate(null)}
      />

      <section className="space-y-2.5">
        <SectionHeader title="Your flairs" count={`${owned.length}/${list.length}`} color="var(--accent)" />
        {owned.length === 0 ? (
          <div
            className="flex flex-col items-center gap-3 rounded-xl px-4 py-6 text-center"
            style={{ border: "1px dashed var(--line)" }}
          >
            <p className="max-w-xs text-[13px] leading-relaxed text-fg-3">
              No flairs yet. Buy one in the Shop, find one in a chest, or keep a 7-day study streak.
            </p>
            <button onClick={onShop} className="btn btn-soft min-h-[40px]">
              <ShoppingBag size={14} />
              Browse the Shop
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {owned.map((f) => (
              <OwnedTile
                key={f.code}
                flair={f}
                user={user}
                equipped={pendingCode !== undefined ? f.code === pendingCode : f.equipped}
                saving={pendingCode !== undefined && (f.code === pendingCode || (pendingCode === null && f.equipped))}
                onToggle={() => toggle(f)}
              />
            ))}
          </div>
        )}
      </section>

      {locked.length > 0 && (
        <section className="space-y-2.5">
          <SectionHeader title="Locked" count={String(locked.length)} color="var(--fg-3)" />
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {locked.map((f) => (
              <LockedTile key={f.code} flair={f} user={user} streakBest={streakBest} onShop={onShop} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function FlairShop({ coins }: { coins: number }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const flairs = useFlairs();
  const buy = useBuyFlair();
  const equip = useEquipFlair();

  const forSale = (flairs.data ?? [])
    .filter((f) => f.unlock === "SHOP")
    .sort((a, b) => (a.priceCoins ?? 0) - (b.priceCoins ?? 0));

  async function purchase(flair: FlairDto) {
    if (flair.priceCoins == null) return;
    const ok = await confirm({
      title: `Buy ${flair.title}?`,
      message: `This costs ${flair.priceCoins.toLocaleString()} coins. You'll have ${(coins - flair.priceCoins).toLocaleString()} left.`,
      confirmLabel: `Buy for ${flair.priceCoins.toLocaleString()}`,
    });
    if (ok) buy.mutate(flair.code);
  }

  return (
    <section className="space-y-2.5">
      <SectionHeader
        title="Flairs"
        count={flairs.data ? `${forSale.filter((f) => f.owned).length}/${forSale.length}` : ""}
        color="var(--accent)"
      />
      {flairs.isLoading ? (
        <ShopSkeleton />
      ) : !flairs.data ? (
        <FlairsError onRetry={() => flairs.refetch()} compact />
      ) : forSale.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm text-fg-3">No flairs for sale right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {forSale.map((f) => {
            const price = f.priceCoins ?? 0;
            const short = price - coins;
            const buying = buy.isPending && buy.variables === f.code;
            const equipping = equip.isPending && equip.variables === f.code;
            return (
              <div
                key={f.code}
                className="card flex items-center gap-3.5 p-4 sm:flex-col sm:items-stretch sm:text-center"
                style={
                  f.equipped
                    ? { borderColor: "color-mix(in srgb, var(--accent) 45%, var(--line))" }
                    : undefined
                }
              >
                <span className="flex justify-center">
                  <Avatar
                    name={user?.name}
                    username={user?.username}
                    avatarUrl={user?.avatarUrl}
                    flair={flairRef(f)}
                    size={64}
                    className="text-xl"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 sm:justify-center">
                    <span className="text-[14px] font-semibold text-fg">{f.title}</span>
                    <RarityLabel flair={f} />
                  </div>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{f.description}</p>
                  <div
                    className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold tabular-nums sm:justify-center"
                    style={{ color: "var(--yellow)" }}
                  >
                    <Coins size={13} />
                    {price.toLocaleString()}
                  </div>
                </div>
                {f.owned ? (
                  f.equipped ? (
                    <span
                      className="btn btn-ghost pointer-events-none shrink-0"
                      style={{ minHeight: 40, color: "var(--green)" }}
                    >
                      <Check size={14} />
                      Equipped
                    </span>
                  ) : (
                    <button
                      onClick={() => equip.mutate(f.code)}
                      disabled={equip.isPending}
                      className="btn btn-soft shrink-0"
                      style={{ minHeight: 40 }}
                    >
                      {equipping ? "Equipping…" : "Equip"}
                    </button>
                  )
                ) : (
                  <button
                    onClick={() => purchase(f)}
                    disabled={short > 0 || buy.isPending || f.priceCoins == null}
                    className="btn btn-primary shrink-0"
                    style={{ minHeight: 40 }}
                  >
                    {short > 0 ? (
                      <>
                        <Lock size={13} />
                        {short.toLocaleString()} more
                      </>
                    ) : buying ? (
                      "Buying…"
                    ) : (
                      "Buy"
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function SectionHeader({ title, count, color }: { title: string; count: string; color: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-0.5">
      <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} />
        {title}
      </h2>
      {count && <span className="text-[12px] tabular-nums text-fg-3">{count}</span>}
    </div>
  );
}

function Preview({
  user,
  flair,
  ownsAny,
  busy,
  onRemove,
}: {
  user: User | null;
  flair: FlairDto | null;
  ownsAny: boolean;
  busy: boolean;
  onRemove: () => void;
}) {
  const color = flair ? RARITY_COLOR[flair.rarity] : "var(--fg-3)";

  return (
    <div
      className="card flex items-center gap-4 p-5"
      style={{
        backgroundImage: `radial-gradient(circle at 68px 50%, color-mix(in srgb, ${flair ? color : "var(--accent)"} 12%, transparent) 0, transparent 150px), var(--card-grad)`,
      }}
    >
      <Avatar
        name={user?.name}
        username={user?.username}
        avatarUrl={user?.avatarUrl}
        flair={flair ? flairRef(flair) : null}
        size={88}
        className="text-3xl"
      />
      <div className="min-w-0 flex-1">
        <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em]" style={{ color }}>
          {flair ? `${RARITY_LABEL[flair.rarity]} · equipped` : "No flair equipped"}
        </div>
        <div className="mt-0.5 truncate text-[17px] font-semibold text-fg">{flair ? flair.title : "Just you"}</div>
        <p className="mt-0.5 text-[12.5px] leading-snug text-fg-3">
          {flair
            ? flair.description
            : ownsAny
              ? "Tap a flair you own to wear it around your avatar."
              : "Flairs ring your avatar everywhere on Studily."}
        </p>
        {flair && (
          <button onClick={onRemove} disabled={busy} className="btn btn-ghost mt-2.5" style={{ minHeight: 40 }}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function OwnedTile({
  flair,
  user,
  equipped,
  saving,
  onToggle,
}: {
  flair: FlairDto;
  user: User | null;
  equipped: boolean;
  saving: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={equipped}
      aria-label={`${flair.title}, ${equipped ? "equipped, tap to remove" : "tap to equip"}`}
      title={equipped ? "Tap to remove" : "Tap to equip"}
      className="card card-lift relative flex h-full min-h-[172px] flex-col items-center gap-1.5 px-2.5 pb-3.5 pt-4 text-center"
      style={
        equipped
          ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent), var(--card-shadow)" }
          : {
              borderColor: "color-mix(in srgb, var(--accent) 22%, var(--line))",
              backgroundColor: "color-mix(in srgb, var(--accent) 4%, var(--surface))",
            }
      }
    >
      <Avatar
        name={user?.name}
        username={user?.username}
        avatarUrl={user?.avatarUrl}
        flair={flairRef(flair)}
        size={64}
        className="text-xl"
      />
      <span className="mt-1 line-clamp-1 text-[13px] font-semibold text-fg">{flair.title}</span>
      <RarityLabel flair={flair} />
      <span
        className="mt-auto inline-flex min-h-[28px] items-center gap-1 rounded-full px-3 text-[12px] font-semibold"
        style={
          equipped
            ? { background: "var(--accent)", color: "var(--accent-fg)" }
            : { background: "color-mix(in srgb, var(--accent) 10%, transparent)", color: "var(--accent)" }
        }
      >
        {saving ? (
          "Saving…"
        ) : equipped ? (
          <>
            <Check size={12} strokeWidth={2.6} />
            Equipped
          </>
        ) : (
          "Equip"
        )}
      </span>
    </button>
  );
}

function LockedTile({
  flair,
  user,
  streakBest,
  onShop,
}: {
  flair: FlairDto;
  user: User | null;
  streakBest: number | null;
  onShop: () => void;
}) {
  const shop = flair.unlock === "SHOP";
  const content = (
    <>
      <span className="relative">
        <span className="block" style={{ opacity: 0.42, filter: "grayscale(0.65)" }}>
          <Avatar
            name={user?.name}
            username={user?.username}
            avatarUrl={user?.avatarUrl}
            flair={flairRef(flair)}
            size={64}
            className="text-xl"
            still
          />
        </span>
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            color: "var(--fg-2)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <Lock size={12} strokeWidth={2.4} />
        </span>
      </span>
      <span className="mt-1 line-clamp-1 text-[13px] font-semibold text-fg-2">{flair.title}</span>
      <RarityLabel flair={flair} />
      <UnlockHint flair={flair} streakBest={streakBest} />
    </>
  );

  const className =
    "card relative flex h-full min-h-[172px] flex-col items-center gap-1.5 px-2.5 pb-3.5 pt-4 text-center";

  if (shop) {
    return (
      <button
        type="button"
        onClick={onShop}
        aria-label={`${flair.title}, locked. ${unlockHint(flair)}`}
        className={`${className} card-lift`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={className} aria-label={`${flair.title}, locked. ${unlockHint(flair)}`} role="group">
      {content}
    </div>
  );
}

function UnlockHint({ flair, streakBest }: { flair: FlairDto; streakBest: number | null }) {
  if (flair.unlock === "SHOP") {
    return (
      <span
        className="mt-auto inline-flex items-center gap-1 text-[12px] font-semibold tabular-nums"
        style={{ color: "var(--yellow)" }}
      >
        <Coins size={12} />
        {flair.priceCoins != null ? `${flair.priceCoins.toLocaleString()} coins` : "In the Shop"}
      </span>
    );
  }
  if (flair.unlock === "CHEST") {
    return (
      <span className="mt-auto inline-flex items-center gap-1 text-[12px] font-medium text-fg-3">
        <Gift size={12} />
        Found in chests
      </span>
    );
  }
  const goal = flair.streakDays;
  return (
    <span className="mt-auto flex flex-col items-center gap-0.5">
      <span className="text-balance text-[12px] font-medium leading-snug" style={{ color: "var(--orange)" }}>
        <Flame size={12} className="-mt-0.5 mr-1 inline-block" />
        {goal != null ? `Reach a ${goal}\u2011day streak` : "Keep a study streak"}
      </span>
      {goal != null && streakBest != null && streakBest > 0 && (
        <span className="text-[11px] tabular-nums text-fg-3">
          Best so far: {Math.min(streakBest, goal)}/{goal}
        </span>
      )}
    </span>
  );
}

function RarityLabel({ flair }: { flair: FlairDto }) {
  return (
    <span
      className="text-[10px] font-semibold uppercase tracking-[0.12em]"
      style={{ color: RARITY_COLOR[flair.rarity] }}
    >
      {RARITY_LABEL[flair.rarity]}
    </span>
  );
}

function FlairsError({ onRetry, compact = false }: { onRetry: () => void; compact?: boolean }) {
  return (
    <div className={`card text-center ${compact ? "p-6" : "p-10"}`}>
      <p className="text-sm text-fg-3">Couldn't load flairs.</p>
      <button onClick={onRetry} className="btn btn-soft mt-3 min-h-[40px]">
        Try again
      </button>
    </div>
  );
}

function FlairsSkeleton({ preview = false }: { preview?: boolean }) {
  return (
    <div className="space-y-6" aria-hidden="true">
      {preview && (
        <div className="card flex items-center gap-4 p-5">
          <Skeleton width={88} height={88} className="shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton width={90} height={10} />
            <Skeleton width="55%" height={16} />
            <Skeleton width="80%" height={11} />
          </div>
        </div>
      )}
      <div className="space-y-2.5">
        <Skeleton width={110} height={13} />
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="card flex min-h-[172px] flex-col items-center gap-2.5 px-3 pb-3 pt-4">
              <Skeleton width={64} height={64} className="rounded-full" />
              <Skeleton width="60%" height={12} />
              <Skeleton width="40%" height={9} />
              <Skeleton width={70} height={24} className="mt-auto rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ShopSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="card flex items-center gap-3.5 p-4 sm:flex-col sm:items-center">
          <Skeleton width={64} height={64} className="shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 sm:w-full sm:flex-none">
            <Skeleton width="50%" height={13} className="sm:mx-auto" />
            <Skeleton width="80%" height={10} className="sm:mx-auto" />
          </div>
          <Skeleton width={64} height={36} className="rounded-lg" />
        </div>
      ))}
    </div>
  );
}
