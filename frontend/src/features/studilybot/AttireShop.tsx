import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Coins, Gift, Lock, RotateCcw } from "lucide-react";
import { useConfirm } from "../../lib/confirm";
import { RARITY_COLOR, RARITY_LABEL } from "../../lib/flairs";
import type { BotOutfitDto, BotOutfitRef, BotOutfitSlot } from "../../types";
import { useBotOutfits, useBuyBotOutfit, useEquipBotOutfit } from "../progress/useProgress";
import Mascot, { useEquippedOutfit, type MascotState } from "./Mascot";

interface Category {
  slot: BotOutfitSlot;
  key: keyof BotOutfitRef;
  label: string;
  single: string;
  example: string;
}

const CATEGORIES: Category[] = [
  { slot: "TOP", key: "top", label: "Hoodies", single: "Top", example: "hoodie_varsity" },
  { slot: "BOTTOM", key: "bottom", label: "Pants", single: "Bottom", example: "pants_jeans" },
];

const BY_SLOT = new Map(CATEGORIES.map((c) => [c.slot, c]));
const EMPTY_LOOK: BotOutfitRef = { top: null, bottom: null };

function only(category: Category, code: string): BotOutfitRef {
  return { ...EMPTY_LOOK, [category.key]: code };
}

export default function AttireShop({ coins }: { coins: number }) {
  const outfits = useBotOutfits();
  const buy = useBuyBotOutfit();
  const equip = useEquipBotOutfit();
  const confirm = useConfirm();
  const equipped = useEquippedOutfit();
  const [open, setOpen] = useState<Category | null>(null);
  const [tryOn, setTryOn] = useState<BotOutfitRef | null>(null);
  const [mood, setMood] = useState<MascotState>("wave");

  const list = outfits.data ?? [];
  const look = tryOn ?? equipped;
  const byCode = new Map(list.map((o) => [o.code, o]));
  const worn = CATEGORIES.map((c) => ({ category: c, item: look[c.key] ? byCode.get(look[c.key] as string) : undefined }));
  const trying = worn.some((w) => w.item && !w.item.owned);
  const changed = CATEGORIES.some((c) => look[c.key] !== equipped[c.key]);

  function tryPiece(item: BotOutfitDto) {
    const key = BY_SLOT.get(item.slot)!.key;
    setTryOn({ ...look, [key]: look[key] === item.code ? null : item.code });
    setMood("idle");
  }

  function wear(next: BotOutfitRef) {
    equip.mutate(next, {
      onSuccess: () => {
        setTryOn(null);
        setMood("excited");
      },
    });
  }

  async function purchase(item: BotOutfitDto) {
    if (item.priceCoins == null) return;
    const ok = await confirm({
      title: `Buy ${item.title}?`,
      message: `This costs ${item.priceCoins} coins. You'll have ${coins - item.priceCoins} left.`,
      confirmLabel: `Buy for ${item.priceCoins}`,
    });
    if (!ok) return;
    buy.mutate(item.code, {
      onSuccess: () => wear({ ...equipped, [BY_SLOT.get(item.slot)!.key]: item.code }),
    });
  }

  if (outfits.isError) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm text-fg-3">Couldn't load StudilyBot's wardrobe.</p>
        <button onClick={() => outfits.refetch()} className="btn btn-soft mt-3 min-h-[40px]">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className="card flex flex-col items-center gap-3 p-4 sm:p-5"
        style={{
          background:
            "radial-gradient(circle at 50% 45%, color-mix(in srgb, var(--accent) 12%, var(--surface)) 0%, var(--surface) 70%)",
        }}
      >
        <div className="flex w-full items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-accent">
            {trying ? "Trying on" : "Your StudilyBot"}
          </span>
          {changed && (
            <button
              type="button"
              onClick={() => setTryOn(null)}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-medium text-fg-3 hover:text-fg"
            >
              <RotateCcw size={12} />
              Reset
            </button>
          )}
        </div>
        <Mascot state={mood} outfit={look} size={190} shadow label="StudilyBot preview" />
        <div className="flex flex-wrap justify-center gap-1.5">
          {worn.map(({ category, item }) => (
            <span
              key={category.slot}
              className="rounded-full px-2.5 py-1 text-[12px] text-fg-2"
              style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
            >
              <span className="text-fg-3">{category.single}:</span>{" "}
              <span className="font-medium text-fg">{item?.title ?? "Nothing"}</span>
            </span>
          ))}
        </div>
        {changed && !trying && (
          <button type="button" onClick={() => wear(look)} disabled={equip.isPending} className="btn btn-primary">
            Wear this look
          </button>
        )}
      </div>

      {open === null ? (
        <div key="categories" className="stagger-children grid grid-cols-2 gap-3">
          {CATEGORIES.map((category) => {
            const items = list.filter((o) => o.slot === category.slot);
            const owned = items.filter((o) => o.owned).length;
            return (
              <button
                key={category.slot}
                type="button"
                onClick={() => setOpen(category)}
                className="card card-lift group flex flex-col items-center gap-2 p-4 text-center"
              >
                <span
                  className="flex h-[150px] w-full items-center justify-center rounded-xl"
                  style={{ background: "color-mix(in srgb, var(--accent) 7%, var(--surface-hi))" }}
                >
                  <Mascot outfit={only(category, category.example)} size={104} still />
                </span>
                <span className="text-[15px] font-semibold text-fg">{category.label}</span>
                <span className="inline-flex items-center gap-1 text-[12px] text-fg-3 tabular-nums">
                  {outfits.isLoading ? "Loading…" : `${owned} of ${items.length} owned`}
                  <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div key={open.slot} className="space-y-3">
          <div className="animate-in flex items-center gap-2">
            <button type="button" onClick={() => setOpen(null)} className="btn btn-ghost text-xs">
              <ArrowLeft size={14} />
              All clothes
            </button>
            <h3 className="text-[15px] font-semibold text-fg">{open.label}</h3>
          </div>
          {outfits.isLoading ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="skeleton h-[230px] rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              {list
                .filter((o) => o.slot === open.slot)
                .map((item, index) => (
                  <OutfitCard
                    key={item.code}
                    index={index}
                    item={item}
                    selected={look[open.key] === item.code}
                    coins={coins}
                    busy={buy.isPending || equip.isPending}
                    buying={buy.isPending && buy.variables === item.code}
                    onTry={() => tryPiece(item)}
                    onBuy={() => purchase(item)}
                    onEquip={() => wear({ ...equipped, [open.key]: item.equipped ? null : item.code })}
                  />
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OutfitCard({
  index,
  item,
  selected,
  coins,
  busy,
  buying,
  onTry,
  onBuy,
  onEquip,
}: {
  index: number;
  item: BotOutfitDto;
  selected: boolean;
  coins: number;
  busy: boolean;
  buying: boolean;
  onTry: () => void;
  onBuy: () => void;
  onEquip: () => void;
}) {
  const color = RARITY_COLOR[item.rarity];
  const piece = only(BY_SLOT.get(item.slot)!, item.code);
  const short = (item.priceCoins ?? 0) - coins;

  return (
    <div
      className="attire-pop card flex flex-col gap-2 p-2.5"
      style={{
        animationDelay: `${index * 60}ms`,
        ...(selected ? { boxShadow: "0 0 0 2px var(--accent), var(--card-shadow)" } : {}),
      }}
    >
      <button
        type="button"
        onClick={onTry}
        aria-pressed={selected}
        aria-label={`Try on ${item.title}`}
        className="flex h-[130px] items-center justify-center rounded-xl"
        style={{ background: `color-mix(in srgb, ${color} 8%, var(--surface-hi))` }}
      >
        <Mascot outfit={piece} size={88} still />
      </button>
      <span
        className="self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide"
        style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}
      >
        {RARITY_LABEL[item.rarity]}
      </span>
      <span className="text-[13.5px] font-semibold leading-tight text-fg">{item.title}</span>
      <div className="mt-auto">
        {item.owned ? (
          <button
            type="button"
            onClick={onEquip}
            disabled={busy}
            className={`btn w-full min-h-[36px] text-xs ${item.equipped ? "btn-primary" : "btn-soft"}`}
          >
            {item.equipped ? (
              <>
                <Check size={13} />
                Wearing
              </>
            ) : (
              "Wear"
            )}
          </button>
        ) : item.unlock === "CHEST" ? (
          <span
            className="flex min-h-[36px] w-full items-center justify-center gap-1.5 rounded-xl text-[12px] font-semibold"
            style={{ color, background: `color-mix(in srgb, ${color} 12%, transparent)` }}
          >
            <Gift size={13} />
            In chests
          </span>
        ) : (
          <button
            type="button"
            onClick={onBuy}
            disabled={busy || short > 0 || item.priceCoins == null}
            className="btn btn-primary w-full min-h-[36px] text-xs tabular-nums"
          >
            {short > 0 ? (
              <>
                <Lock size={12} />
                {short} more
              </>
            ) : buying ? (
              "Buying…"
            ) : (
              <>
                <Coins size={12} />
                {item.priceCoins}
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
