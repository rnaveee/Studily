import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Info, Loader2 } from "lucide-react";
import ClientOnly from "../../components/ClientOnly";
import SegmentedToggle from "../../components/SegmentedToggle";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import GreenHeart from "./GreenHeart";
import ShareCard from "./ShareCard";
import ChipInCard from "./ChipInCard";

const INTRO: string[] = ["Here at Studily, we believe that learning should be free and accessible. However, providing these" +
" tools also costs us a lot to run! We kindly ask for any donations to help Studily out and to keep running, so we can keep developing" +
" this app and providing more learning tools and make your school lives easier for you!"];

const COVERS: string[] = ["Running the website - It costs money to keep Studily running on the internet!", "Memory and storage - Keeping track of your schedules, deadlines, flashcards and files costs money to maintain!",
    "AI - Using our AI services costs money for the AI to run!",
"Motivation - Seeing Studily being used and supported makes us want to update and continue providing to students!"];

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

export default function SupportStudilyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-5 pb-6 stagger-children">
      <ClientOnly>
        <DonationReturn />
      </ClientOnly>

      <header className="flex flex-col items-center gap-4 px-2 pb-2 pt-6 text-center">
        <GreenHeart size={96} glow />
        <h1 className="text-2xl font-semibold tracking-tight text-fg">Help support Studily!</h1>
      </header>

      <section className="card p-5 sm:p-6">
        <div className="space-y-3 text-[13.5px] leading-relaxed text-fg-2">
          {INTRO.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </section>

      <section className="card p-5 sm:p-6">
        <h2 className="mb-3 text-[15px] font-semibold text-fg">What your support covers</h2>
        <ul className="space-y-2 text-[13.5px] leading-relaxed text-fg-2">
          {COVERS.map((item) => (
            <li key={item} className="flex gap-2.5">
              <span
                className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ background: "var(--heart-green-2)" }}
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <SupportTabs />
    </div>
  );
}
