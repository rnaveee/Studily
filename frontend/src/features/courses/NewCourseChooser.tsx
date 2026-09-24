import { useQuery } from "@tanstack/react-query";
import { PencilLine, Sparkles } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { ParseAccuracy } from "../../types";
import { parseBlocked, parseQuotaText, useParseAvailability } from "./parseAvailability";

interface Props {
  onManual: () => void;
  onAutomatic: () => void;
  onClose: () => void;
}

export default function NewCourseChooser({ onManual, onAutomatic, onClose }: Props) {
  const { user } = useAuth();
  const { data: availability } = useParseAvailability();

  const autoEnabled = availability?.enabled ?? false;
  const verified = user?.emailVerified ?? false;
  const blocked = parseBlocked(availability);
  const usable = verified && !blocked;
  const quota = parseQuotaText(availability);

  const { data: accuracy } = useQuery({
    queryKey: ["course-parse-accuracy"],
    queryFn: () => api.get<ParseAccuracy>("/courses/parse/accuracy"),
    enabled: autoEnabled,
    staleTime: 10 * 60_000,
  });

  return (
    <Modal onClose={onClose} title="Add a course" size="lg" variant="sheet">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {autoEnabled && (
          <button
            type="button"
            onClick={onAutomatic}
            disabled={!usable}
            className={usable ? "card card-lift p-4 text-left" : "card p-4 text-left"}
            style={usable ? undefined : { opacity: 0.6, cursor: "not-allowed" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                style={{ background: "color-mix(in srgb, var(--accent) 12%, transparent)" }}
              >
                <Sparkles size={16} className="text-accent" />
              </span>
              <span className="text-[14px] font-semibold text-fg">Automatic</span>
              <span className="badge badge-accent ml-auto text-[10px]">Beta</span>
            </div>
            <p className="mt-2 text-[12px] text-fg-2">
              Upload your course outline, a screenshot, or paste the details, and we fill in the rest.
            </p>
            <p className="mt-1 text-[11px] text-fg-3">
              {verified
                ? "You check everything before it saves."
                : "Verify your email to unlock this."}
            </p>
            {verified && quota && (
              <p className={`mt-1 text-[11px] ${blocked ? "text-red" : "text-fg-3"}`}>{quota}</p>
            )}
            {accuracy?.successRate != null && (
              <p className="mt-2 text-[11px] font-medium text-accent">
                Studily users report that this feature works {accuracy.successRate}% of the time.
              </p>
            )}
          </button>
        )}

        <button type="button" onClick={onManual} className="card card-lift p-4 text-left">
          <div className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ background: "var(--surface-hi)" }}
            >
              <PencilLine size={16} className="text-fg-2" />
            </span>
            <span className="text-[14px] font-semibold text-fg">Manual</span>
          </div>
          <p className="mt-2 text-[12px] text-fg-2">
            Type in the course name, code, times and room yourself.
          </p>
          <p className="mt-1 text-[11px] text-fg-3">Takes about a minute.</p>
        </button>
      </div>
    </Modal>
  );
}
