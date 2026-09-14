import type { QueryClient } from "@tanstack/react-query";

export function invalidateItemQueries(qc: QueryClient, courseId?: number) {
  if (courseId != null) {
    qc.invalidateQueries({ queryKey: ["course", courseId] });
    qc.invalidateQueries({ queryKey: ["course", courseId, "items"] });
    qc.invalidateQueries({ queryKey: ["course", courseId, "weights"] });
  }
  qc.invalidateQueries({ queryKey: ["courses"] });
  qc.invalidateQueries({ queryKey: ["calendar"] });
  qc.invalidateQueries({ queryKey: ["calendar-events"] });
  qc.invalidateQueries({ queryKey: ["semesters"] });
  qc.invalidateQueries({ queryKey: ["dashboard"] });
}
