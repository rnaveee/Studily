import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Sparkles } from "lucide-react";
import ParseDropzone from "../courses/ParseDropzone";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { DOCUMENT_RULES, GEN_AVAILABILITY_KEY, genBlocked, genQuotaText, useGenAvailability } from "./genAvailability";
import type { GeneratedDeck } from "../../types";

const STAGES: [number, string][] = [
  [0, "Reading your files…"],
  [5, "Looking through the pages…"],
  [12, "Writing your cards…"],
  [30, "Almost done…"],
];

export default function DocumentGenerator({
  setId,
  onGenerated,
  onCancel,
}: {
  setId?: number;
  onGenerated: (deck: GeneratedDeck) => void;
  onCancel?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const availability = useGenAvailability();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);

  const generate = useMutation({
    mutationFn: () => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      return api.post<GeneratedDeck>(setId ? `/flashcard-sets/${setId}/generate` : "/flashcard-sets/generate", form);
    },
    onSuccess: (deck) => onGenerated(deck),
    onSettled: () => qc.invalidateQueries({ queryKey: GEN_AVAILABILITY_KEY }),
  });

  useEffect(() => {
    if (!generate.isPending) {
      setSeconds(0);
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [generate.isPending]);

  const a = availability.data;
  if (availability.isLoading) {
    return <p className="text-[12px] text-fg-3">Loading…</p>;
  }
  if (!a?.enabled) {
    return (
      <p className="rounded-lg px-3 py-2.5 text-[12px] text-fg-2" style={{ background: "var(--surface-hi)" }}>
        Making cards from documents isn't available right now.
      </p>
    );
  }

  const verified = !!user?.emailVerified;
  const blocked = genBlocked(a);
  const quota = genQuotaText(a);
  const overQuota = files.length > a.remaining;
  const stage = [...STAGES].reverse().find(([at]) => seconds >= at)?.[1] ?? STAGES[0][1];
  const disabled = files.length === 0 || generate.isPending || blocked || !verified || overQuota;

  return (
    <div className="space-y-3">
      {generate.isPending ? (
        <div
          className="flex flex-col items-center gap-2 rounded-lg px-4 py-8 text-center"
          style={{ background: "color-mix(in srgb, var(--accent) 7%, transparent)" }}
          role="status"
          aria-live="polite"
        >
          <Loader2 size={22} className="animate-spin text-accent" />
          <p className="text-[13px] font-medium text-fg">{stage}</p>
          <p className="text-[12px] text-fg-3">This usually takes 10 to 40 seconds.</p>
        </div>
      ) : (
        <ParseDropzone
          files={files}
          onChange={setFiles}
          onError={setError}
          compact
          label="Drop lecture slides, notes or handouts here"
          rules={DOCUMENT_RULES}
        />
      )}

      {!verified && <p className="text-[12px] text-fg-3">Verify your email to unlock this.</p>}
      {quota && <p className={`text-[11px] ${blocked ? "text-red" : "text-fg-3"}`}>{quota}</p>}
      {overQuota && !blocked && (
        <p className="text-[11px] text-red">
          You have {a.remaining} {a.remaining === 1 ? "document" : "documents"} left this month. Remove some files.
        </p>
      )}
      {error && <p className="text-xs text-red animate-fade">{error}</p>}
      {generate.error && (
        <p className="text-xs text-red animate-fade">
          {generate.error instanceof Error ? generate.error.message : "Couldn't make cards from that."}
        </p>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={generate.isPending}>
            Cancel
          </button>
        )}
        <button type="button" onClick={() => generate.mutate()} disabled={disabled} className="btn btn-primary">
          <Sparkles size={13} />
          {generate.isPending ? "Making cards…" : "Make flashcards"}
        </button>
      </div>
    </div>
  );
}
