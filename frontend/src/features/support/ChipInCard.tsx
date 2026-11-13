import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import ClientOnly from "../../components/ClientOnly";
import { api, ApiError } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { rememberNext } from "../../lib/next";

interface DonationConfig {
  enabled: boolean;
  currency: string;
  presets: number[];
  minCents: number;
  maxCents: number;
}

const SUPPORTER_BADGE = "https://badges.studily.ca/badges/v4/supporter.webp";
const DEFAULT_CHOICE = 500;
const CUSTOM_AMOUNT = /^\d+(\.\d{1,2})?$/;

function money(cents: number): string {
  return cents % 100 === 0 ? `C$${cents / 100}` : `C$${(cents / 100).toFixed(2)}`;
}

function parseCustom(text: string): number | null {
  const trimmed = text.trim();
  if (!CUSTOM_AMOUNT.test(trimmed)) return null;
  return Math.round(parseFloat(trimmed) * 100);
}

function ChipInBody() {
  const { user, loading } = useAuth();
  const config = useQuery({
    queryKey: ["donations", "config"],
    queryFn: () => api.get<DonationConfig>("/donations/config"),
    retry: false,
    staleTime: 5 * 60_000,
  });
  const [choice, setChoice] = useState<number | "custom" | null>(null);
  const [custom, setCustom] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  const checkout = useMutation({
    mutationFn: (amountCents: number) =>
      api.post<{ url: string }>("/donations/checkout", { amountCents }),
    onSuccess: ({ url }) => {
      setRedirecting(true);
      window.location.assign(url);
    },
  });

  useEffect(() => {
    function onShow(e: PageTransitionEvent) {
      if (e.persisted) setRedirecting(false);
    }
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  if (config.isLoading || loading) {
    return <div className="h-[160px] animate-pulse rounded-lg" style={{ background: "var(--surface-hi)" }} />;
  }

  const cfg = config.data;
  if (config.isError || !cfg || !cfg.enabled) {
    return (
      <p className="rounded-lg px-3 py-3 text-[13px] text-fg-2" style={{ background: "var(--surface-hi)" }}>
        Card payments are coming soon.
      </p>
    );
  }

  const selected: number | "custom" =
    choice ?? (cfg.presets.includes(DEFAULT_CHOICE) ? DEFAULT_CHOICE : (cfg.presets[0] ?? "custom"));
  const customCents = parseCustom(custom);
  const amountCents = selected === "custom" ? customCents : selected;

  let amountError: string | null = null;
  if (selected === "custom" && custom.trim() !== "") {
    if (customCents === null) amountError = "Enter an amount like 7.50";
    else if (customCents < cfg.minCents) amountError = `Minimum is ${money(cfg.minCents)}`;
    else if (customCents > cfg.maxCents) amountError = `Maximum is ${money(cfg.maxCents)}`;
  }
  const valid =
    amountCents !== null && amountCents >= cfg.minCents && amountCents <= cfg.maxCents && !amountError;
  const pending = checkout.isPending || redirecting;

  let requestError: string | null = null;
  if (checkout.error instanceof ApiError) {
    requestError =
      checkout.error.status === 429
        ? "Too many attempts, try again in a few minutes"
        : checkout.error.message || "Couldn't start the payment. Try again.";
  } else if (checkout.error) {
    requestError = "Couldn't start the payment. Try again.";
  }

  function submit() {
    if (!valid || amountCents === null || pending) return;
    checkout.mutate(amountCents);
  }

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Amount" className="flex flex-wrap gap-2">
        {cfg.presets.map((cents) => {
          const active = selected === cents;
          return (
            <button
              key={cents}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setChoice(cents)}
              className={`btn ${active ? "btn-primary" : "btn-ghost"}`}
            >
              {money(cents)}
            </button>
          );
        })}
        <button
          type="button"
          role="radio"
          aria-checked={selected === "custom"}
          onClick={() => setChoice("custom")}
          className={`btn ${selected === "custom" ? "btn-primary" : "btn-ghost"}`}
        >
          Custom
        </button>
      </div>

      {selected === "custom" && (
        <div>
          <label htmlFor="support-custom" className="field-label">Amount (CAD)</label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-fg-3">
              C$
            </span>
            <input
              id="support-custom"
              className="input"
              style={{ paddingLeft: 34 }}
              type="number"
              inputMode="decimal"
              min={cfg.minCents / 100}
              max={cfg.maxCents / 100}
              step="0.01"
              placeholder={String(cfg.minCents / 100)}
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              aria-invalid={amountError ? true : undefined}
            />
          </div>
          {amountError && <p className="mt-1 text-[12px] text-red">{amountError}</p>}
        </div>
      )}

      {user ? (
        <button type="button" onClick={submit} disabled={!valid || pending} className="btn btn-primary w-full">
          {pending ? "Opening checkout…" : valid && amountCents !== null ? `Support with ${money(amountCents)}` : "Choose an amount"}
        </button>
      ) : (
        <Link
          to="/login"
          onClick={() => rememberNext("/support-studily")}
          className="btn btn-primary w-full"
        >
          Log in to chip in
        </Link>
      )}

      {requestError && <p className="text-[12px] text-red">{requestError}</p>}

      <p className="text-[11.5px] leading-relaxed text-fg-3">
        Payments are handled securely by Stripe (cards, Apple Pay, Google Pay). This is a
        contribution to Studily, not a charitable donation.
      </p>
    </div>
  );
}

export default function ChipInCard() {
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">Chip in</h2>
        <p className="mt-1 text-[12.5px] text-fg-3">
          Pick an amount, or enter your own.
        </p>
      </div>
      <ClientOnly>
        <ChipInBody />
      </ClientOnly>
      <div className="flex items-center gap-3 rounded-lg px-3 py-2.5" style={{ background: "var(--surface-hi)" }}>
        <img src={SUPPORTER_BADGE} alt="Supporter badge" width={44} height={44} className="h-11 w-11 shrink-0 object-contain" />
        <p className="text-[12.5px] leading-relaxed text-fg-2">
          Everyone who chips in gets the Supporter badge on their profile.
        </p>
      </div>
    </section>
  );
}
