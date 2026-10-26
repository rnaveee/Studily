import { api } from "../../lib/api";
import type { Course } from "../../types";

export async function findSimilarCourses(
  name: string | null | undefined,
  code: string | null | undefined,
  semesterId: number | null | undefined,
): Promise<Course[]> {
  const q = new URLSearchParams();
  if (name?.trim()) q.set("name", name.trim());
  if (code?.trim()) q.set("code", code.trim());
  if (semesterId != null) q.set("semesterId", String(semesterId));
  if (!q.has("name") && !q.has("code")) return [];
  try {
    return await api.get<Course[]>(`/courses/similar?${q.toString()}`);
  } catch {
    return [];
  }
}
