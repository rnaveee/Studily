import { useMutation, useQueryClient } from "@tanstack/react-query";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { formatReasons } from "../../lib/moderation";
import type { ModerationWarning } from "../../types";

export default function WarningModal({ warnings }: { warnings: ModerationWarning[] }) {
  const qc = useQueryClient();
  const sorted = [...warnings].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const ack = useMutation({
    mutationFn: () => api.post<void>("/me/moderation/warnings/ack", { ids: warnings.map((w) => w.id) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["me", "moderation"] }),
  });

  return (
    <Modal
      title="Warning"
      size="md"
      showClose={false}
      beforeClose={() => false}
      onClose={() => {}}
      footer={
        <button type="button" onClick={() => ack.mutate()} disabled={ack.isPending} className="btn btn-primary">
          I understand
        </button>
      }
    >
      <div className="space-y-4 text-[14px] text-fg-2">
        {sorted.map((w) => (
          <div key={w.id} className="space-y-2">
            <p>Your account has been reported for {formatReasons(w.reasons)}.</p>
            {w.note && (
              <p
                className="whitespace-pre-wrap rounded-lg px-3 py-2 text-[13px] [overflow-wrap:anywhere]"
                style={{ background: "var(--surface-hi)" }}
              >
                {w.note}
              </p>
            )}
          </div>
        ))}
        <p className="text-[13px] text-fg-3">
          Repeated violations can lead to a suspension. Review our{" "}
          <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-accent transition-colors hover:text-accent-2">
            Terms
          </a>
          .
        </p>
      </div>
    </Modal>
  );
}
