import { useState } from "react";
import { Link, Navigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Coins, Lock, Pin, ShoppingBag, Trophy } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useConfirm } from "../../lib/confirm";
import { toast } from "../../lib/toast";
import BackButton from "../../components/BackButton";
import SegmentedToggle from "../../components/SegmentedToggle";
import { Skeleton } from "../../components/Skeleton";
import BadgeArt from "./BadgeArt";
import BadgeGrid from "./BadgeGrid";
import { CATEGORY_COLOR, CATEGORY_LABEL, groupBadges } from "./badges";
import { progressKeys, useBadges, useMyProgress, useProgressEnabled } from "./useProgress";
import type { BadgeDto, BadgePurchaseResult, ProgressDto, Relationship } from "../../types";

type Tab = "collection" | "shop";

const TABS: { value: Tab; label: string }[] = [
  { value: "collection", label: "Collection" },
  { value: "shop", label: "Shop" },
];

export default function BadgesPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const enabled = useProgressEnabled();

  if (!enabled) return <GuestBadges />;
  if (userId === undefined) return <OwnBadges />;

  const id = Number(userId);
  if (user && id === user.id) return <Navigate to="/profile/badges" replace />;
  return <UserBadges userId={id} />;
}

function GuestBadges() {
  return (
    <div className="mx-auto w-full max-w-lg animate-in">
      <div className="card mt-8 p-8 text-center">
        <span
          className="mx-auto flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
        >
          <Trophy size={20} className="text-accent" />
        </span>
        <h1 className="mt-4 text-[15px] font-semibold text-fg">Badges are for Studily members</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-fg-3">
          Sign in to earn XP, level up, and collect badges for studying, flashcards and friends.
        </p>
        <Link to="/login" className="btn btn-primary mt-5 min-h-[40px]">
          Sign in
        </Link>
      </div>
    </div>
  );
}

function OwnBadges() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "shop" ? "shop" : "collection";
  const badges = useBadges("me");
  const progress = useMyProgress();
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  function setTab(next: Tab) {
    setParams(
      (p) => {
        const out = new URLSearchParams(p);
        if (next === "shop") out.set("tab", "shop");
        else out.delete("tab");
        return out;
      },
      { replace: true },
    );
    setPicking(false);
  }

  const saveFeatured = useMutation({
    mutationFn: (codes: string[]) => api.put<BadgeDto[]>("/me/featured-badges", { codes }),
    onSuccess: (featured) => {
      const slots = new Map(featured.map((b, i) => [b.code, b.featuredSlot ?? i + 1]));
      qc.setQueryData<BadgeDto[]>(progressKeys.badges("me"), (old) =>
        old?.map((b) => ({ ...b, featuredSlot: slots.get(b.code) ?? null })),
      );
      qc.setQueryData<ProgressDto>(progressKeys.me, (old) => (old ? { ...old, featuredBadges: featured } : old));
      qc.invalidateQueries({ queryKey: ["progress"] });
      setPicking(false);
      toast.success(featured.length === 0 ? "Featured badges cleared" : "Featured badges saved");
    },
  });

  function startPicking() {
    const current = (badges.data ?? [])
      .filter((b) => b.owned && b.featuredSlot != null)
      .sort((a, b) => (a.featuredSlot ?? 0) - (b.featuredSlot ?? 0))
      .map((b) => b.code);
    setPicked(current);
    setPicking(true);
  }

  function togglePick(badge: BadgeDto) {
    setPicked((p) => {
      if (p.includes(badge.code)) return p.filter((c) => c !== badge.code);
      if (p.length >= 3) {
        toast.info("You can feature up to 3 badges. Unpick one first.");
        return p;
      }
      return [...p, badge.code];
    });
  }

  const list = badges.data ?? [];
  const coins = progress.data?.coins;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback="/profile" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-semibold text-fg">Badges</h1>
          <p className="mt-0.5 text-[13px] text-fg-3 tabular-nums">
            {progress.data
              ? `${progress.data.badgeCount} of ${progress.data.badgeTotal} collected`
              : "Your collection and the badge shop"}
          </p>
        </div>
        {coins != null && <CoinChip coins={coins} />}
      </div>

      <SegmentedToggle options={TABS} value={tab} onChange={setTab} className="w-full sm:w-72" />

      {badges.isLoading ? (
        <BadgesSkeleton />
      ) : badges.isError ? (
        <LoadError onRetry={() => badges.refetch()} />
      ) : tab === "collection" ? (
        <>
          <FeaturedBar
            badges={list}
            picking={picking}
            picked={picked}
            saving={saveFeatured.isPending}
            onEdit={startPicking}
            onCancel={() => setPicking(false)}
            onSave={() => saveFeatured.mutate(picked)}
          />
          <Collection
            badges={list.filter((b) => b.category !== "COSMETIC" || b.owned)}
            picking={picking}
            picked={picked}
            onPick={togglePick}
            shopHint={list.some((b) => b.category === "COSMETIC" && !b.owned) ? () => setTab("shop") : undefined}
          />
        </>
      ) : (
        <Shop badges={list.filter((b) => b.category === "COSMETIC")} coins={coins ?? 0} />
      )}
    </div>
  );
}

function UserBadges({ userId }: { userId: number }) {
  const badges = useBadges(userId);
  const rel = useQuery({
    queryKey: ["friends", "user", userId],
    queryFn: () => api.get<Relationship>(`/friends/users/${userId}`),
    enabled: Number.isFinite(userId),
    retry: false,
  });

  if (rel.data?.status === "SELF") return <Navigate to="/profile/badges" replace />;

  const name = rel.data ? rel.data.user.name || rel.data.user.username : null;
  const list = (badges.data ?? []).filter((b) => b.category !== "COSMETIC" || b.owned);
  const owned = list.filter((b) => b.owned).length;
  const notFound = badges.error instanceof ApiError && badges.error.status === 404;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 stagger-children">
      <div className="flex items-center gap-3">
        <BackButton fallback={`/users/${userId}`} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-fg">{name ? `${name}'s badges` : "Badges"}</h1>
          <p className="mt-0.5 text-[13px] text-fg-3 tabular-nums">
            {badges.data ? `${owned} of ${list.length} collected` : " "}
          </p>
        </div>
      </div>

      {badges.isLoading ? (
        <BadgesSkeleton />
      ) : notFound ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-3">User not found.</p>
        </div>
      ) : badges.isError ? (
        <LoadError onRetry={() => badges.refetch()} />
      ) : (
        <Collection badges={list} />
      )}
    </div>
  );
}

function Collection({
  badges,
  picking = false,
  picked = [],
  onPick,
  shopHint,
}: {
  badges: BadgeDto[];
  picking?: boolean;
  picked?: string[];
  onPick?: (badge: BadgeDto) => void;
  shopHint?: () => void;
}) {
  const groups = groupBadges(badges);

  if (groups.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">No badges yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groups.map(({ category, badges: inGroup }) => {
        const owned = inGroup.filter((b) => b.owned).length;
        return (
          <section key={category} className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 px-0.5">
              <h2 className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_COLOR[category] }} />
                {CATEGORY_LABEL[category]}
              </h2>
              <span className="text-[12px] tabular-nums text-fg-3">
                {owned}/{inGroup.length}
              </span>
            </div>
            <BadgeGrid badges={inGroup} picking={picking} picked={picked} onPick={onPick} />
          </section>
        );
      })}
      {shopHint && !picking && (
        <button
          onClick={shopHint}
          className="card card-lift flex w-full items-center gap-3 p-4 text-left"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "color-mix(in srgb, var(--red-vivid) 12%, transparent)", color: "var(--red-vivid)" }}
          >
            <ShoppingBag size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-fg">More cosmetic badges in the Shop</span>
            <span className="block text-[12px] text-fg-3">Spend coins from level-ups and chests.</span>
          </span>
        </button>
      )}
    </div>
  );
}

function FeaturedBar({
  badges,
  picking,
  picked,
  saving,
  onEdit,
  onCancel,
  onSave,
}: {
  badges: BadgeDto[];
  picking: boolean;
  picked: string[];
  saving: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const byCode = new Map(badges.map((b) => [b.code, b]));
  const codes = picking
    ? picked
    : badges
        .filter((b) => b.owned && b.featuredSlot != null)
        .sort((a, b) => (a.featuredSlot ?? 0) - (b.featuredSlot ?? 0))
        .map((b) => b.code);
  const ownsAny = badges.some((b) => b.owned);

  return (
    <div
      className="card p-4"
      style={picking ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent), var(--card-shadow)" } : undefined}
    >
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            <Pin size={13} className="text-fg-3" />
            Featured on your profile
          </h2>
          <p className="mt-0.5 text-[12px] text-fg-3">
            {picking ? "Tap badges you own, in the order you want them shown." : "Up to 3 badges show on your profile."}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => {
            const b = codes[i] ? byCode.get(codes[i]) : undefined;
            return (
              <span
                key={i}
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={b ? undefined : { border: "1px dashed var(--line)" }}
              >
                {b ? (
                  <BadgeArt badge={b} size={38} />
                ) : (
                  <span className="text-[11px] font-semibold tabular-nums text-fg-3">{i + 1}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        {picking ? (
          <>
            <button onClick={onCancel} disabled={saving} className="btn btn-ghost min-h-[40px]">
              Cancel
            </button>
            <button onClick={onSave} disabled={saving} className="btn btn-primary min-h-[40px]">
              <Check size={14} />
              Save
            </button>
          </>
        ) : (
          <button onClick={onEdit} disabled={!ownsAny} className="btn btn-soft min-h-[40px]">
            {ownsAny ? "Choose badges" : "Earn a badge to feature it"}
          </button>
        )}
      </div>
    </div>
  );
}

function Shop({ badges, coins }: { badges: BadgeDto[]; coins: number }) {
  const qc = useQueryClient();
  const confirm = useConfirm();

  const buy = useMutation({
    mutationFn: (code: string) => api.post<BadgePurchaseResult>(`/badges/${encodeURIComponent(code)}/purchase`),
    onSuccess: (res) => {
      qc.setQueryData<BadgeDto[]>(progressKeys.badges("me"), (old) =>
        old?.map((b) => (b.code === res.badge.code ? res.badge : b)),
      );
      qc.setQueryData<ProgressDto>(progressKeys.me, (old) => (old ? { ...old, coins: res.coins } : old));
      qc.invalidateQueries({ queryKey: ["progress"] });
      qc.invalidateQueries({ queryKey: ["badges"] });
      toast.success(`${res.badge.title} is yours`);
    },
  });

  async function purchase(badge: BadgeDto) {
    if (badge.priceCoins == null) return;
    const ok = await confirm({
      title: `Buy ${badge.title}?`,
      message: `This costs ${badge.priceCoins} coins. You'll have ${coins - badge.priceCoins} left.`,
      confirmLabel: `Buy for ${badge.priceCoins}`,
    });
    if (ok) buy.mutate(badge.code);
  }

  const sorted = [...badges].sort((a, b) => (a.priceCoins ?? 0) - (b.priceCoins ?? 0));

  return (
    <div className="space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          style={{ background: "color-mix(in srgb, var(--amber-vivid) 16%, transparent)", color: "var(--yellow)" }}
        >
          <Coins size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[20px] font-bold leading-tight tabular-nums text-fg">
            {coins.toLocaleString()} <span className="text-[13px] font-medium text-fg-3">coins</span>
          </div>
          <p className="text-[12px] text-fg-3">Earn coins by levelling up and opening chests.</p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-sm text-fg-3">The shop is empty right now. Check back soon.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((b) => {
            const price = b.priceCoins ?? 0;
            const short = price - coins;
            const buying = buy.isPending && buy.variables === b.code;
            return (
              <div key={b.code} className="card flex items-center gap-3.5 p-4 sm:flex-col sm:items-stretch sm:text-center">
                <span className="flex justify-center">
                  <BadgeArt badge={b} size={64} locked={false} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14px] font-semibold text-fg">{b.title}</div>
                  <p className="mt-0.5 text-[12px] leading-snug text-fg-3">{b.description}</p>
                  <div className="mt-1.5 flex items-center gap-1 text-[13px] font-semibold tabular-nums sm:justify-center" style={{ color: "var(--yellow)" }}>
                    <Coins size={13} />
                    {price}
                  </div>
                </div>
                {b.owned ? (
                  <span className="btn btn-ghost pointer-events-none min-h-[40px] shrink-0" style={{ color: "var(--green)" }}>
                    <Check size={14} />
                    Owned
                  </span>
                ) : (
                  <button
                    onClick={() => purchase(b)}
                    disabled={short > 0 || buy.isPending || b.priceCoins == null}
                    className="btn btn-primary min-h-[40px] shrink-0"
                  >
                    {short > 0 ? (
                      <>
                        <Lock size={13} />
                        {short} more
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
    </div>
  );
}

function CoinChip({ coins }: { coins: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold tabular-nums"
      style={{ background: "color-mix(in srgb, var(--amber-vivid) 14%, transparent)", color: "var(--yellow)" }}
      title="Coins"
    >
      <Coins size={14} />
      {coins.toLocaleString()}
    </span>
  );
}

function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="card p-10 text-center">
      <p className="text-sm text-fg-3">Couldn't load badges.</p>
      <button onClick={onRetry} className="btn btn-soft mt-3 min-h-[40px]">
        Try again
      </button>
    </div>
  );
}

function BadgesSkeleton() {
  return (
    <div className="space-y-3" aria-hidden="true">
      <Skeleton width={120} height={13} />
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-5">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="card flex flex-col items-center gap-2.5 px-3 pb-3 pt-4">
            <Skeleton width={60} height={60} className="rounded-full" />
            <Skeleton width="70%" height={11} />
            <Skeleton width="85%" height={9} />
          </div>
        ))}
      </div>
    </div>
  );
}
