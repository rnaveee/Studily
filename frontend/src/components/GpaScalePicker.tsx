import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export default function GpaScalePicker({ className }: { className?: string }) {
  const qc = useQueryClient();
  const prefsQ = useGpaScalePrefs();

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

  return (
    <select
      className={`input w-auto ${className ?? ""}`}
      aria-label="GPA scale"
      disabled={!prefs || save.isPending}
      value={prefs?.explicit ? prefs.scale : "AUTO"}
      onChange={(e) => save.mutate(e.target.value === "AUTO" ? null : (e.target.value as GpaScaleName))}
    >
      <option value="AUTO">
        {prefs ? `Match my school (${GPA_SCALE_LABELS[prefs.defaultScale]})` : "Match my school"}
      </option>
      {GPA_SCALES.map((s) => (
        <option key={s} value={s}>
          {GPA_SCALE_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
