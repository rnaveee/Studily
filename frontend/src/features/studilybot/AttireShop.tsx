import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, Coins, Gift, Lock, RotateCcw } from "lucide-react";
import { botOutfit, type BotGroup } from "../../lib/botArt";
import { useConfirm } from "../../lib/confirm";
import { RARITY_COLOR, RARITY_LABEL } from "../../lib/flairs";
import type { BotOutfitDto, BotOutfitRef, BotOutfitSlot } from "../../types";
import { useBotOutfits, useBuyBotOutfit, useEquipBotOutfit } from "../progress/useProgress";
import Mascot, { useEquippedOutfit, type MascotState } from "./Mascot";

interface SlotInfo {
  slot: BotOutfitSlot;
  key: keyof BotOutfitRef;
  single: string;
}

interface Category {
  id: string;
  slot: BotOutfitSlot;
  group: BotGroup;
  label: string;
  example: string;
  parent?: Category;
}

const SLOTS: SlotInfo[] = [
  { slot: "TOP", key: "top", single: "Top" },
  { slot: "BOTTOM", key: "bottom", single: "Bottom" },
];
const SLOT_KEY = new Map(SLOTS.map((s) => [s.slot, s.key]));

const HOODIES: Category = { id: "hoodies", slot: "TOP", group: "hoodie", label: "Hoodies", example: "hoodie_varsity" };
const SCHOOL_HOODIES: Category = {
  id: "school",
  slot: "TOP",
  group: "school",
  label: "School hoodies",
  example: "hoodie_ubc",
  parent: HOODIES,
};
const CATEGORIES: Category[] = [
  HOODIES,
  { id: "shirts", slot: "TOP", group: "shirt", label: "Shirts", example: "tee_studily" },
  { id: "pants", slot: "BOTTOM", group: "bottom", label: "Pants", example: "pants_jeans" },
];

const EMPTY_LOOK: BotOutfitRef = { top: null, bottom: null };

function only(slot: BotOutfitSlot, code: string): BotOutfitRef {
  return { ...EMPTY_LOOK, [SLOT_KEY.get(slot)!]: code };
}

function groupOf(item: BotOutfitDto): BotGroup {
  const art = botOutfit(item.code, SLOT_KEY.get(item.slot)!);
  return art?.group ?? (item.slot === "TOP" ? "hoodie" : "bottom");
}

function itemsIn(list: BotOutfitDto[], category: Category): BotOutfitDto[] {
  return list.filter((o) => o.slot === category.slot && groupOf(o) === category.group);
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
  const worn = SLOTS.map((s) => ({ slot: s, item: look[s.key] ? byCode.get(look[s.key] as string) : undefined }));
  const trying = worn.some((w) => w.item && !w.item.owned);
  const changed = SLOTS.some((s) => look[s.key] !== equipped[s.key]);
  const openKey = open ? SLOT_KEY.get(open.slot)! : null;
  const schoolItems = itemsIn(list, SCHOOL_HOODIES);

  function tryPiece(item: BotOutfitDto) {
    const key = SLOT_KEY.get(item.slot)!;
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
      onSuccess: () => wear({ ...equipped, [SLOT_KEY.get(item.slot)!]: item.code }),
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
          {worn.map(({ slot, item }) => (
            <span
              key={slot.slot}
              className="rounded-full px-2.5 py-1 text-[12px] text-fg-2"
              style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
            >
              <span className="text-fg-3">{slot.single}:</span>{" "}
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
        <div key="categories" className="stagger-children grid grid-cols-2 gap-3 sm:grid-cols-3">
          {CATEGORIES.map((category) => {
            const items = [...itemsIn(list, category), ...(category === HOODIES ? schoolItems : [])];
            const owned = items.filter((o) => o.owned).length;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => setOpen(category)}
                className="card card-lift group flex flex-col items-center gap-2 p-4 text-center"
              >
                <span
                  className="flex h-[150px] w-full items-center justify-center rounded-xl"
                  style={{ background: "color-mix(in srgb, var(--accent) 7%, var(--surface-hi))" }}
                >
                  <Mascot outfit={only(category.slot, category.example)} size={104} still />
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
        <div key={open.id} className="space-y-3">
          <div className="animate-in flex items-center gap-2">
            <button type="button" onClick={() => setOpen(open.parent ?? null)} className="btn btn-ghost text-xs">
              <ArrowLeft size={14} />
              {open.parent ? open.parent.label : "All clothes"}
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
              {open === HOODIES && schoolItems.length > 0 && (
                <SchoolHoodiesCard items={schoolItems} onOpen={() => setOpen(SCHOOL_HOODIES)} />
              )}
              {itemsIn(list, open).map((item, index) => (
                <OutfitCard
                  key={item.code}
                  index={open === HOODIES ? index + 1 : index}
                  item={item}
                  selected={look[openKey!] === item.code}
                  coins={coins}
                  busy={buy.isPending || equip.isPending}
                  buying={buy.isPending && buy.variables === item.code}
                  onTry={() => tryPiece(item)}
                  onBuy={() => purchase(item)}
                  onEquip={() => wear({ ...equipped, [openKey!]: item.equipped ? null : item.code })}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SchoolHoodiesCard({ items, onOpen }: { items: BotOutfitDto[]; onOpen: () => void }) {
  const owned = items.filter((o) => o.owned).length;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="attire-pop card card-lift group flex flex-col gap-2 p-2.5 text-left"
    >
      <span
        className="flex h-[130px] items-center justify-center rounded-xl"
        style={{ background: "color-mix(in srgb, var(--accent) 8%, var(--surface-hi))" }}
      >
        <Mascot outfit={only(SCHOOL_HOODIES.slot, SCHOOL_HOODIES.example)} size={88} still />
      </span>
      <span
        className="self-start rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-accent tabular-nums"
        style={{ background: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
      >
        {items.length} schools
      </span>
      <span className="text-[13.5px] font-semibold leading-tight text-fg">School hoodies</span>
      <span
        className="mt-auto flex min-h-[36px] w-full items-center justify-center gap-1 rounded-xl text-[12px] font-semibold text-accent tabular-nums"
        style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
      >
        {owned > 0 ? `${owned} owned` : "Browse"}
        <ChevronRight size={13} className="transition-transform group-hover:translate-x-0.5" />
      </span>
    </button>
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
  const piece = only(item.slot, item.code);
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
