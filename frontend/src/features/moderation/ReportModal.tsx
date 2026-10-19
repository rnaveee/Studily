import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import Modal, { useModalClose } from "../../components/Modal";
import { api } from "../../lib/api";
import { reasonsFor } from "../../lib/moderation";
import type { ReportReason } from "../../types";

type Target =
  | { kind: "USER"; userId: number; name: string }
  | { kind: "MESSAGE"; messageId: number; name: string };

function Footer({ done, canSubmit, pending, onSubmit }: { done: boolean; canSubmit: boolean; pending: boolean; onSubmit: () => void }) {
  const close = useModalClose();
  if (done) {
    return (
      <button type="button" onClick={close} className="btn btn-primary">
        Done
      </button>
    );
  }
  return (
    <>
      <button type="button" onClick={close} className="btn btn-ghost">
        Cancel
      </button>
      <button type="button" onClick={onSubmit} disabled={!canSubmit || pending} className="btn btn-danger">
        {pending ? "Sending…" : "Submit"}
      </button>
    </>
  );
}

export default function ReportModal({ target, onClose }: { target: Target; onClose: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [done, setDone] = useState(false);

  const options = reasonsFor(target.kind);
  const needsDetails = reason === "OTHER";
  const valid = reason !== null && (!needsDetails || details.trim().length > 0);

  const submit = useMutation({
    mutationFn: () =>
      api.post<void>("/reports", {
        kind: target.kind,
        userId: target.kind === "USER" ? target.userId : undefined,
        messageId: target.kind === "MESSAGE" ? target.messageId : undefined,
        reason,
        details: details.trim() || undefined,
      }),
    onSuccess: () => setDone(true),
  });

  return (
    <Modal
      onClose={onClose}
      title={target.kind === "USER" ? `Report @${target.name}` : "Report message"}
      size="md"
      footer={
        <Footer done={done} canSubmit={valid} pending={submit.isPending} onSubmit={() => submit.mutate()} />
      }
    >
      {done ? (
        <p className="text-[14px] text-fg-2">Thanks for letting us know. We'll review this report.</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-2" role="radiogroup" aria-label="Reason for report">
            {options.map((r) => {
              const active = reason === r.value;
              const label = target.kind === "MESSAGE" && r.messageLabel ? r.messageLabel : r.label;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setReason(r.value)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    active ? "" : "border-line hover:bg-surface-hi"
                  }`}
                  style={
                    active
                      ? {
                          borderColor: "var(--accent)",
                          background: "color-mix(in srgb, var(--accent) 10%, transparent)",
                        }
                      : undefined
                  }
                >
                  <span className={`min-w-0 flex-1 text-[13px] font-medium ${active ? "text-accent" : "text-fg"}`}>
                    {label}
                  </span>
                  {active && <Check size={14} className="shrink-0 text-accent" />}
                </button>
              );
            })}
          </div>

          <div>
            <label className="field-label" htmlFor="report-details">
              {needsDetails ? "Details (required)" : "Details (optional)"}
            </label>
            <textarea
              id="report-details"
              className="input min-h-[96px]"
              maxLength={1000}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              required={needsDetails}
            />
          </div>

          <p className="text-[12px] text-fg-3">
            @{target.name} won't be told who reported them. If someone is in immediate danger, contact local
            emergency services.
          </p>
        </div>
      )}
    </Modal>
  );
}
