import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Globe, HardDrive, Info, Loader2, Rocket, Sparkles, type LucideIcon } from "lucide-react";
import ClientOnly from "../../components/ClientOnly";
import SegmentedToggle from "../../components/SegmentedToggle";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { badgeGlow } from "../progress/badges";
import ChestIcon from "../progress/ChestIcon";
import GreenHeart from "./GreenHeart";
import ShareCard from "./ShareCard";
import ChipInCard from "./ChipInCard";

const INTRO_LEAD = "Here at Studily, we believe that learning should be free and accessible.";

const INTRO: string[] = [
  "However, providing these tools also costs us a lot to run! We kindly ask for any donations to help Studily keep running, so we can keep developing this app, provide more learning tools and make your school life easier.",
];

const COVERS: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: Globe,
    title: "Keeping Studily online",
    text: "Servers and hosting keep Studily fast and ready whenever you need it.",
  },
  {
    icon: HardDrive,
    title: "Storing your work",
    text: "Your schedules, deadlines, flashcards and files stay safely saved and on every device you use.",
  },
  {
    icon: Sparkles,
    title: "Powering the AI",
    text: "StudilyBot, flashcard generation and course imports run on AI that costs money every time you use it.",
  },
  {
    icon: Rocket,
    title: "Building what's next",
    text: "Your support shows us Studily is worth it, and keeps new features and improvements coming.",
  },
];

const POLL_MS = 2000;
const POLL_LIMIT_MS = 30_000;
const UUID = /^[0-9a-fA-F-]{36}$/;

interface DonationStatus {
  status: string;
  amountCents: number;
}

function Banner({ tone, icon, children }: { tone: "green" | "neutral"; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div
      role="status"
      className="flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px] leading-relaxed text-fg"
      style={{
        background:
          tone === "green"
            ? "color-mix(in srgb, var(--heart-green-2) 14%, transparent)"
            : "var(--surface-hi)",
        border: `1px solid ${tone === "green" ? "color-mix(in srgb, var(--heart-green-2) 35%, transparent)" : "var(--line)"}`,
      }}
    >
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function DonationReturn() {
  const [params] = useSearchParams();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const state = params.get("donation");
  const id = params.get("id");
  const polling = state === "success" && !!id && UUID.test(id) && !!user;
  const [timedOut, setTimedOut] = useState(false);

  const donation = useQuery({
    queryKey: ["donations", "status", id],
    queryFn: () => api.get<DonationStatus>(`/donations/${id}`),
    enabled: polling && !timedOut,
    retry: false,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "PENDING" ? false : POLL_MS),
  });

  useEffect(() => {
    if (!polling) return;
    const t = setTimeout(() => setTimedOut(true), POLL_LIMIT_MS);
    return () => clearTimeout(t);
  }, [polling]);

  const status = donation.data?.status;

  useEffect(() => {
    if (status === "PAID") {
      qc.invalidateQueries({ queryKey: ["badges"] });
      qc.invalidateQueries({ queryKey: ["progress"] });
    }
  }, [status, qc]);

  if (state === "cancelled") {
    return (
      <Banner tone="neutral" icon={<Info size={16} className="text-fg-3" />}>
        Checkout was cancelled and you weren't charged. You can try again any time.
      </Banner>
    );
  }

  if (state !== "success") return null;

  if (status === "PAID") {
    return (
      <Banner tone="green" icon={<CheckCircle size={16} style={{ color: "var(--heart-green-2)" }} />}>
        Thank you! Your Supporter badge is on your profile.
      </Banner>
    );
  }

  if (status && status !== "PENDING") {
    return (
      <Banner tone="neutral" icon={<Info size={16} className="text-fg-3" />}>
        We couldn't confirm that payment. If you were charged, email us from the Support page.
      </Banner>
    );
  }

  if (timedOut || (!loading && !user)) {
    return (
      <Banner tone="neutral" icon={<Info size={16} className="text-fg-3" />}>
        Payment received, confirming… your badge will appear shortly.
      </Banner>
    );
  }

  return (
    <Banner tone="neutral" icon={<Loader2 size={16} className="animate-spin text-fg-3" />}>
      Confirming your payment…
    </Banner>
  );
}

type SupportTab = "donate" | "share";

const TABS: { value: SupportTab; label: string }[] = [
  { value: "donate", label: "Donate" },
  { value: "share", label: "Share Studily" },
];

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function SupportTabs() {
  const [tab, setTab] = useState<SupportTab>("donate");
  const index = TABS.findIndex((t) => t.value === tab);
  const panels = useRef<(HTMLDivElement | null)[]>([]);
  const [height, setHeight] = useState<number | null>(null);

  useIsoLayoutEffect(() => {
    const panel = panels.current[index];
    if (!panel) return;
    const measure = () => setHeight(panel.offsetHeight);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    return () => observer.disconnect();
  }, [index]);

  return (
    <div className="mx-auto w-full max-w-xl space-y-4">
      <SegmentedToggle options={TABS} value={tab} onChange={setTab} className="mx-auto w-full max-w-sm" />
      <div
        className="overflow-hidden transition-[height] duration-300 ease-out motion-reduce:transition-none"
        style={{ height: height ?? undefined, contain: "inline-size" }}
      >
        <div
          className="flex items-start transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {TABS.map((t, i) => (
            <div
              key={t.value}
              ref={(el) => {
                panels.current[i] = el;
              }}
              className="w-full shrink-0 p-px"
              aria-hidden={i !== index}
              inert={i !== index}
            >
              {t.value === "donate" ? <ChipInCard /> : <ShareCard />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const SUPPORTER_BADGE = "https://badges.studily.ca/badges/v4/supporter.webp";
const BADGE_SIZE = 200;

function SupporterBadgeShowcase() {
  return (
    <section className="card px-5 py-8 sm:px-8">
      <h2 className="text-center text-lg font-semibold text-fg">Earn rewards for supporting Studily</h2>
      <div className="mt-6 grid grid-cols-1 gap-8 sm:grid-cols-2 sm:gap-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-40 items-center justify-center sm:h-[200px]">
            <img
              src={SUPPORTER_BADGE}
              alt="Supporter badge"
              width={BADGE_SIZE}
              height={BADGE_SIZE}
              className="h-40 w-40 object-contain sm:h-[200px] sm:w-[200px]"
              style={{ filter: badgeGlow("supporter", BADGE_SIZE) }}
            />
          </div>
          <h3 className="text-[15px] font-semibold text-fg">Supporter badge</h3>
          <p className="max-w-xs text-[13px] leading-relaxed text-fg-2">
            Chip in any amount, or invite a friend who signs up and starts studying. It shows on your profile for
            good.
          </p>
        </div>
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-40 items-center justify-center sm:h-[200px]">
            <ChestIcon tier="GOLD" size={176} />
          </div>
          <h3 className="text-[15px] font-semibold text-fg">Gold chest</h3>
          <p className="max-w-xs text-[13px] leading-relaxed text-fg-2">
            You and every friend who joins with your invite link and starts studying each get one, full of coins
            and a shot at rare badges and flairs.
          </p>
        </div>
      </div>
    </section>
  );
}

export default function SupportStudilyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-6 stagger-children">
      <ClientOnly>
        <DonationReturn />
      </ClientOnly>

      <header className="mx-auto flex max-w-2xl flex-col items-center gap-4 px-2 pb-2 pt-6 text-center">
        <GreenHeart size={96} glow />
        <h1 className="text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Help support Studily!</h1>
        <p className="text-[15px] font-medium leading-relaxed text-fg sm:text-base">{INTRO_LEAD}</p>
        <div className="space-y-3 text-[13.5px] leading-relaxed text-fg-2 sm:text-[14px]">
          {INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </header>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-4 text-[15px] font-semibold text-fg">What your support covers</h2>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {COVERS.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              className="flex gap-3 rounded-xl p-3.5"
              style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
            >
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: "color-mix(in srgb, var(--heart-green-2) 16%, transparent)",
                  color: "var(--heart-green-2)",
                }}
              >
                <Icon size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-fg">{title}</span>
                <span className="mt-0.5 block text-[12.5px] leading-relaxed text-fg-2">{text}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <SupportTabs />

      <SupporterBadgeShowcase />
    </div>
  );
}
