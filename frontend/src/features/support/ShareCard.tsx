import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Download, Share2 } from "lucide-react";
import ClientOnly from "../../components/ClientOnly";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { rememberNext } from "../../lib/next";
import { canCopyImages, copyImage, downloadImage, shareImageFile } from "../../lib/shareImage";
import { toast } from "../../lib/toast";
import { renderStoryCard } from "./storyImage";

interface ReferralMe {
  code: string;
  link: string;
  joined: number;
  pending: number;
  rewardedCount: number;
  cap: number;
}

const STORY_FILENAME = "studily-story.png";

function StoryPreview() {
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;
    renderStoryCard()
      .then((b) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(b);
        setBlob(b);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  function copy() {
    if (!blob) return;
    copyImage(blob)
      .then(() => toast.success("Image copied"))
      .catch(() => toast.error("Couldn't copy the image"));
  }

  async function save() {
    if (!blob || busy) return;
    setBusy(true);
    try {
      const handled = await shareImageFile(blob, STORY_FILENAME);
      if (!handled) downloadImage(blob, STORY_FILENAME);
    } catch {
      toast.error("Couldn't save the image");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div
        className="flex h-[140px] w-[79px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
        style={{ background: "var(--surface-hi)", border: "1px solid var(--line)" }}
      >
        {url ? (
          <img src={url} alt="Studily story preview" className="h-full w-full object-cover" />
        ) : failed ? (
          <span className="px-1 text-center text-[10px] text-fg-3">Preview unavailable</span>
        ) : (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
        )}
      </div>
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-[12px] leading-relaxed text-fg-3">
          Post it to your story and tag Studily.
        </p>
        {canCopyImages && (
          <button type="button" onClick={copy} disabled={!blob} className="btn btn-ghost">
            <Copy size={13} />
            Copy image
          </button>
        )}
        <button type="button" onClick={save} disabled={!blob || busy} className="btn btn-primary">
          <Download size={13} />
          Save image
        </button>
      </div>
    </div>
  );
}

function InviteLink() {
  const { user, loading } = useAuth();
  const referral = useQuery({
    queryKey: ["referrals", "me"],
    queryFn: () => api.get<ReferralMe>("/referrals/me"),
    enabled: !!user,
    retry: false,
    staleTime: 60_000,
  });
  const [copied, setCopied] = useState(false);

  if (loading) {
    return <div className="h-[84px] animate-pulse rounded-lg" style={{ background: "var(--surface-hi)" }} />;
  }

  if (!user) {
    return (
      <Link
        to="/login"
        onClick={() => rememberNext("/support-studily")}
        className="btn btn-primary self-start"
      >
        Log in to get your invite link
      </Link>
    );
  }

  if (referral.isLoading) {
    return <div className="h-[84px] animate-pulse rounded-lg" style={{ background: "var(--surface-hi)" }} />;
  }

  if (referral.isError || !referral.data) {
    return (
      <div className="space-y-2">
        <p className="text-[12.5px] text-red">Couldn't load your invite link.</p>
        <button type="button" onClick={() => referral.refetch()} className="btn btn-ghost">
          Try again
        </button>
      </div>
    );
  }

  const r = referral.data;

  function copy() {
    navigator.clipboard
      .writeText(r.link)
      .then(() => {
        setCopied(true);
        toast.success("Invite link copied");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => toast.error("Couldn't copy the link"));
  }

  async function share() {
    try {
      await navigator.share({ url: r.link, title: "Join me on Studily" });
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        toast.error("Couldn't open the share sheet");
      }
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <input
          readOnly
          value={r.link}
          aria-label="Your invite link"
          className="input min-w-0 flex-1"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button type="button" onClick={copy} className="btn btn-ghost shrink-0">
          {copied ? <Check size={13} /> : <Copy size={13} />}
          {copied ? "Copied" : "Copy"}
        </button>
        {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
          <button type="button" onClick={share} className="btn btn-ghost shrink-0" aria-label="Share link">
            <Share2 size={13} />
          </button>
        )}
      </div>
      <p className="text-[12px] tabular-nums text-fg-3">
        {r.joined} joined · {r.pending} pending · {r.rewardedCount}/{r.cap} rewards
      </p>
      <p className="text-[12px] leading-relaxed text-fg-3">
        When a friend signs up with your link, verifies their email and starts studying, you both
        get a gold chest, and you earn the Supporter badge.
      </p>
    </div>
  );
}

export default function ShareCard() {
  return (
    <section className="card flex flex-col gap-4 p-5 sm:p-6">
      <div>
        <h2 className="text-[15px] font-semibold text-fg">Share Studily</h2>
        <p className="mt-1 text-[12.5px] text-fg-3">
          The best support is a friend who studies here too.
        </p>
      </div>
      <ClientOnly>
        <StoryPreview />
        <div className="h-px" style={{ background: "var(--line)" }} />
        <div>
          <h3 className="mb-2 text-[13px] font-semibold text-fg">Your invite link</h3>
          <InviteLink />
        </div>
      </ClientOnly>
    </section>
  );
}
