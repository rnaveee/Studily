import { useQuery } from "@tanstack/react-query";
import { PencilLine, Sparkles } from "lucide-react";
import Modal from "../../components/Modal";
import { api } from "../../lib/api";

interface Props {
  onManual: () => void;
  onAutomatic: () => void;
  onClose: () => void;
}

export default function NewCourseChooser({ onManual, onAutomatic, onClose }: Props) {
  const { data: availability } = useQuery({
    queryKey: ["course-parse-enabled"],
    queryFn: () => api.get<{ enabled: boolean }>("/courses/parse/enabled"),
    staleTime: 5 * 60_000,
  });

  const autoEnabled = availability?.enabled ?? false;

  return (
    <Modal onClose={onClose} title="Add a course" size="lg" variant="sheet">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {autoEnabled && (
          <button type="button" onClick={onAutomatic} className="card card-lift p-4 text-left">
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
              You check everything before it saves.
            </p>
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
