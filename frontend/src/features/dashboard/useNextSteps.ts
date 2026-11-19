import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useUpcomingExams } from "../exams/ExamsCard";
import type { Course, FlashcardSet, SemesterStats } from "../../types";

export interface NextStep {
  key: string;
  title: string;
  detail: string;
  to: string;
}

interface Hints {
  dismissed: string[];
}

export function useNextSteps(courses: Course[] | undefined, semesterId: number | null) {
  const { user, guest } = useAuth();
  const qc = useQueryClient();
  const enabled = !!user && !guest;

  const hintsQ = useQuery({
    queryKey: ["hints"],
    queryFn: () => api.get<Hints>("/settings/hints"),
    enabled,
  });
  const setsQ = useQuery({
    queryKey: ["flashcards", "sets"],
    queryFn: () => api.get<FlashcardSet[]>("/flashcard-sets"),
    enabled,
  });
  const statsQ = useQuery({
    queryKey: ["semesters", "stats"],
    queryFn: () => api.get<SemesterStats[]>("/semesters/stats"),
    enabled,
  });
  const examsQ = useUpcomingExams(semesterId);

  const dismissMut = useMutation({
    mutationFn: (key: string) => api.post<Hints>("/settings/hints/dismiss", { key }),
    onMutate: async (key) => {
      await qc.cancelQueries({ queryKey: ["hints"] });
      qc.setQueryData<Hints>(["hints"], (old) => ({
        dismissed: [...(old?.dismissed ?? []), key],
      }));
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["hints"] }),
  });

  const ready = enabled && !!hintsQ.data && !!setsQ.data && !!statsQ.data && !!courses;
  if (!ready || courses.length === 0) {
    return { steps: [] as NextStep[], dismiss: dismissMut.mutate };
  }

  const dismissed = new Set(hintsQ.data!.dismissed);
  const all: NextStep[] = [];

  const exam = (examsQ.data ?? []).find((e) => e.linkedSets === 0 && e.daysLeft >= 0);
  if (exam) {
    all.push({
      key: "exam",
      title: `Plan your study for ${exam.title}`,
      detail: `${exam.courseCode || exam.courseName} · link flashcards and tasks to it.`,
      to: `/courses/${exam.courseId}`,
    });
  }

  if (setsQ.data!.length === 0) {
    all.push({
      key: "flashcards",
      title: "Generate flashcards from your notes",
      detail: "Upload a syllabus or slides and let AI make the cards.",
      to: "/study/flashcards",
    });
  }

  const unweighted = (statsQ.data ?? []).flatMap((s) => s.courses).find((c) => c.grade == null && c.totalWeight === 0);
  if (unweighted) {
    all.push({
      key: "weights",
      title: "Add weights to see your grade",
      detail: `${unweighted.code || unweighted.name} has no graded weights yet.`,
      to: `/courses/${unweighted.courseId}`,
    });
  }

  all.push({
    key: "bot",
    title: "Ask StudilyBot",
    detail: "Get answers and practice questions from your own course files.",
    to: "/study/studilybot/chat",
  });

  return {
    steps: all.filter((s) => !dismissed.has(s.key)).slice(0, 2),
    dismiss: dismissMut.mutate,
  };
}
