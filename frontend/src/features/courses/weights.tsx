import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../lib/api";
import ColorSwatches from "../../components/ColorSwatches";
import type { GradeCategory, GradeCategoryRequest } from "../../types";

export function weightsKey(courseId: number) {
  return ["course", courseId, "weights"] as const;
}

export function useGradeCategories(courseId: number | null | undefined) {
  return useQuery({
    queryKey: weightsKey(courseId ?? 0),
    queryFn: () => api.get<GradeCategory[]>(`/courses/${courseId}/weights`),
    enabled: courseId != null && Number.isFinite(courseId),
  });
}

export function totalWeight(categories: GradeCategory[]): number {
  return categories.reduce((sum, c) => sum + (c.weight ?? 0), 0);
}

export function trimPercent(value: number): string {
  return String(Math.round(value * 100) / 100);
}

interface FormProps {
  initial?: GradeCategory;
  busy?: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (req: GradeCategoryRequest) => void;
  onCancel: () => void;
}

export function WeightForm({
  initial,
  busy = false,
  error,
  submitLabel,
  onSubmit,
  onCancel,
}: FormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [weight, setWeight] = useState(
    initial?.weight != null ? trimPercent(initial.weight) : "",
  );
  const [color, setColor] = useState<string | null>(initial?.color ?? null);
  const [localError, setLocalError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setLocalError("Give this weight a name");
      return;
    }
    const blank = !weight.trim();
    const value = Number(weight);
    if (!blank && (!Number.isFinite(value) || value < 0 || value > 100)) {
      setLocalError("Enter a percentage between 0 and 100, or leave it blank");
      return;
    }
    setLocalError(null);
    onSubmit({
      name: trimmed,
      weight: blank ? null : value,
      position: initial?.position ?? null,
      color,
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-lg border border-line p-3"
      style={{ background: "var(--surface-hi)" }}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <label className="field-label">Name</label>
          <input
            className="input"
            placeholder="e.g. Quizzes, Assignments and Labs"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            autoFocus
          />
        </div>
        <div className="sm:w-32">
          <label className="field-label">Weight %</label>
          <input
            className="input"
            type="number"
            inputMode="decimal"
            placeholder="optional"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            min={0}
            max={100}
            step="any"
          />
        </div>
      </div>

      <div>
        <label className="field-label mb-2">Color</label>
        <ColorSwatches value={color} onChange={setColor} allowAuto={!initial} autoLabel="Pick for me" />
      </div>

      <p className="text-[11px] text-fg-3">
        Leave the weight blank to use this as a label only — items keep whatever weight you give
        them.
      </p>

      {(localError || error) && (
        <p className="text-xs text-red animate-fade">{localError ?? error}</p>
      )}

      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn btn-primary">
          {busy ? "Saving…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} className="btn btn-ghost">
          Cancel
        </button>
      </div>
    </form>
  );
}
