import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { SlidersHorizontal } from "lucide-react";
import GradingScaleEditor from "./GradingScaleEditor";
import { api } from "../lib/api";
import { GPA_SCALES, GPA_SCALE_LABELS } from "../lib/gpa";
import { toast } from "../lib/toast";
import type { GpaScaleName, GpaScalePrefs } from "../types";

export function useGpaScalePrefs() {
  return useQuery({
    queryKey: ["settings", "gpa-scale"],
    queryFn: () => api.get<GpaScalePrefs>("/settings/gpa-scale"),
  });
}

export default function GpaScalePicker({
  className,
  variant = "compact",
}: {
  className?: string;
  variant?: "compact" | "labelled";
}) {
  const qc = useQueryClient();
  const prefsQ = useGpaScalePrefs();
  const [editing, setEditing] = useState(false);

  const save = useMutation({
    mutationFn: (scale: GpaScaleName | null) =>
      api.put<GpaScalePrefs>("/settings/gpa-scale", { scale }),
    onSuccess: (next) => {
      qc.setQueryData(["settings", "gpa-scale"], next);
      qc.invalidateQueries({ queryKey: ["semesters", "stats"] });
    },
    onError: (err) => toast.error(err instanceof Error ? err.message : "Couldn't save"),
  });

  const prefs = prefsQ.data;
  const custom = prefs?.custom ?? null;
  const editLabel = custom ? "Edit custom scale" : "Create custom scale";

  return (
    <div
      className={`flex min-w-0 max-w-full items-center gap-2 ${variant === "labelled" ? "flex-wrap" : ""} ${
        className ?? ""
      }`}
    >
      <select
        className="input w-auto"
        style={{ maxWidth: "100%", minWidth: 0 }}
        aria-label="GPA scale"
        disabled={!prefs || save.isPending}
        value={prefs?.explicit ? prefs.scale : "AUTO"}
        onChange={(e) => save.mutate(e.target.value === "AUTO" ? null : (e.target.value as GpaScaleName))}
      >
        <option value="AUTO">
          {prefs ? `Match my school: ${GPA_SCALE_LABELS[prefs.defaultScale]}` : "Match my school"}
        </option>
        {GPA_SCALES.map((s) => (
          <option key={s} value={s}>
            {GPA_SCALE_LABELS[s]}
          </option>
        ))}
        {custom && (
          <option value="CUSTOM">{custom.name ? `Custom: ${custom.name}` : GPA_SCALE_LABELS.CUSTOM}</option>
        )}
      </select>
      {variant === "labelled" ? (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={!prefs}
          className="btn btn-ghost min-h-10 md:min-h-0"
        >
          <SlidersHorizontal size={14} />
          {editLabel}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={!prefs}
          aria-label={editLabel}
          title={editLabel}
          className="btn btn-ghost h-10 w-10 shrink-0 md:h-9 md:w-9"
          style={{ padding: 0 }}
        >
          <SlidersHorizontal size={15} />
        </button>
      )}
      {editing && prefs && <GradingScaleEditor prefs={prefs} onClose={() => setEditing(false)} />}
    </div>
  );
}
