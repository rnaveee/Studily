import { DAYS } from "../types";
import type {
  AcademicItem,
  Course,
  CourseGrade,
  DayColumn,
  FlashcardSet,
  Note,
  ScheduledMeeting,
  Semester,
  SemesterStats,
  WeekView,
} from "../types";

function startOfWeek(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
}

function shift(base: Date, days: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + days);
}

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function at(days: number, time: string): string {
  const now = new Date();
  return `${iso(shift(new Date(now.getFullYear(), now.getMonth(), now.getDate()), days))}T${time}`;
}

export const DEMO_SEMESTER: Semester = (() => {
  const now = new Date();
  return {
    id: 1,
    term: "FALL",
    year: now.getFullYear(),
    label: `Fall ${now.getFullYear()}`,
    startDate: iso(shift(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -35)),
    endDate: iso(shift(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 60)),
  };
})();

export function demoCourses(): Course[] {
  return [
    {
      id: 1,
      semesterId: 1,
      name: "Calculus I",
      code: "MATH 101",
      professor: "Dr. R. Alvarez",
      location: "Hall 210",
      color: "#7968dc",
      meetingBlocks: [
        { id: 1, dayOfWeek: "MON", kind: "LECTURE", startTime: "09:30", endTime: "10:20", location: "Hall 210" },
        { id: 2, dayOfWeek: "WED", kind: "LECTURE", startTime: "09:30", endTime: "10:20", location: "Hall 210" },
        { id: 3, dayOfWeek: "FRI", kind: "LECTURE", startTime: "09:30", endTime: "10:20", location: "Hall 210" },
        { id: 4, dayOfWeek: "TUE", kind: "TUTORIAL", startTime: "14:30", endTime: "15:50", location: "Room 118" },
      ],
    },
    {
      id: 2,
      semesterId: 1,
      name: "Introduction to Psychology",
      code: "PSYC 101",
      professor: "Dr. S. Whitfield",
      location: "Hall A",
      color: "#3b82f6",
      meetingBlocks: [
        { id: 5, dayOfWeek: "TUE", kind: "LECTURE", startTime: "10:30", endTime: "11:50", location: "Hall A" },
        { id: 6, dayOfWeek: "THU", kind: "LECTURE", startTime: "10:30", endTime: "11:50", location: "Hall A" },
        { id: 7, dayOfWeek: "THU", kind: "TUTORIAL", startTime: "13:30", endTime: "14:20", location: "Room 118" },
      ],
    },
    {
      id: 3,
      semesterId: 1,
      name: "Introductory Biology",
      code: "BIOL 101",
      professor: "Dr. N. Okafor",
      location: "Science 140",
      color: "#10b981",
      meetingBlocks: [
        { id: 8, dayOfWeek: "MON", kind: "LECTURE", startTime: "13:30", endTime: "14:50", location: "Science 140" },
        { id: 9, dayOfWeek: "WED", kind: "LECTURE", startTime: "13:30", endTime: "14:50", location: "Science 140" },
        { id: 10, dayOfWeek: "FRI", kind: "LAB", startTime: "11:30", endTime: "13:20", location: "Lab B12" },
      ],
    },
    {
      id: 4,
      semesterId: 1,
      name: "Academic Writing",
      code: "ENGL 101",
      professor: "Dr. J. Moreau",
      location: "Room 305",
      color: "#f59e0b",
      meetingBlocks: [
        { id: 11, dayOfWeek: "TUE", kind: "LECTURE", startTime: "16:30", endTime: "17:50", location: "Room 305" },
        { id: 12, dayOfWeek: "THU", kind: "LECTURE", startTime: "16:30", endTime: "17:50", location: "Room 305" },
      ],
    },
  ];
}

export function demoItems(): AcademicItem[] {
  return [
    {
      id: 1, courseId: 1, courseName: "Calculus I", courseColor: "#7968dc",
      type: "ASSIGNMENT", title: "Problem Set 1: Limits", dueAt: at(-16, "23:59:00"),
      weight: 10, score: 18, maxScore: 20, status: "DONE",
    },
    {
      id: 2, courseId: 1, courseName: "Calculus I", courseColor: "#7968dc",
      type: "EXAM", title: "Midterm 1", dueAt: at(-9, "09:30:00"), location: "Hall 210",
      weight: 25, score: 41, maxScore: 50, status: "DONE",
    },
    {
      id: 3, courseId: 1, courseName: "Calculus I", courseColor: "#7968dc",
      type: "ASSIGNMENT", title: "Problem Set 2: Derivatives", dueAt: at(-4, "23:59:00"),
      weight: 10, score: 17, maxScore: 20, status: "DONE",
    },
    {
      id: 4, courseId: 1, courseName: "Calculus I", courseColor: "#7968dc",
      type: "ASSIGNMENT", title: "Problem Set 3: Chain Rule", dueAt: at(2, "23:59:00"),
      weight: 10, status: "IN_PROGRESS",
    },
    {
      id: 5, courseId: 1, courseName: "Calculus I", courseColor: "#7968dc",
      type: "EXAM", title: "Final Exam", dueAt: at(34, "15:30:00"), location: "Gym C",
      weight: 45, status: "TODO",
    },
    {
      id: 6, courseId: 2, courseName: "Introduction to Psychology", courseColor: "#3b82f6",
      type: "ASSIGNMENT", title: "Reading Response 3", dueAt: at(-6, "23:59:00"),
      weight: 8, score: 24, maxScore: 25, status: "DONE",
    },
    {
      id: 7, courseId: 2, courseName: "Introduction to Psychology", courseColor: "#3b82f6",
      type: "ASSIGNMENT", title: "Reading Response 4", dueAt: at(3, "23:59:00"),
      weight: 8, status: "TODO",
    },
    {
      id: 8, courseId: 2, courseName: "Introduction to Psychology", courseColor: "#3b82f6",
      type: "EXAM", title: "Midterm 2", dueAt: at(5, "10:30:00"), location: "Hall A",
      weight: 30, status: "TODO",
    },
    {
      id: 9, courseId: 3, courseName: "Introductory Biology", courseColor: "#10b981",
      type: "ASSIGNMENT", title: "Lab Report 3: Osmosis", dueAt: at(-8, "23:59:00"),
      weight: 12, score: 44, maxScore: 50, status: "DONE",
    },
    {
      id: 10, courseId: 3, courseName: "Introductory Biology", courseColor: "#10b981",
      type: "ASSIGNMENT", title: "Lab Report 4: Photosynthesis", dueAt: at(4, "23:59:00"),
      weight: 12, status: "IN_PROGRESS",
    },
    {
      id: 11, courseId: 4, courseName: "Academic Writing", courseColor: "#f59e0b",
      type: "ASSIGNMENT", title: "Essay 2: First Draft", dueAt: at(6, "23:59:00"),
      weight: 5, status: "TODO",
    },
  ];
}

export function demoWeek(): WeekView {
  const start = startOfWeek();
  const courses = demoCourses();
  const items = demoItems();

  const days: DayColumn[] = DAYS.map((dayOfWeek, i) => {
    const date = iso(shift(start, i));
    const meetings: ScheduledMeeting[] = courses
      .flatMap((c) =>
        c.meetingBlocks
          .filter((b) => b.dayOfWeek === dayOfWeek)
          .map((b) => ({
            courseId: c.id,
            courseName: c.name,
            code: c.code,
            professor: c.professor,
            location: b.location ?? c.location,
            color: c.color,
            kind: b.kind ?? null,
            dayOfWeek,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
      )
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
    return { date, dayOfWeek, meetings, items: items.filter((it) => it.dueAt.startsWith(date)) };
  });

  const weekStart = days[0].date;
  const weekEnd = days[6].date;
  const inWeek = items.filter((it) => {
    const d = it.dueAt.slice(0, 10);
    return d >= weekStart && d <= weekEnd;
  });

  const now = Date.now();
  const nextExam =
    items
      .filter((it) => it.type === "EXAM" && new Date(it.dueAt).getTime() > now)
      .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0] ?? null;

  return {
    weekStart,
    weekEnd,
    semester: DEMO_SEMESTER,
    days,
    dueThisWeek: inWeek.sort((a, b) => a.dueAt.localeCompare(b.dueAt)),
    todosDueThisWeek: [],
    nextExam,
  };
}

export function demoCourseGrades(): CourseGrade[] {
  const items = demoItems();
  return demoCourses().map((c) => {
    const mine = items.filter((it) => it.courseId === c.id);
    const scored = mine.filter(
      (it) => it.score != null && it.maxScore != null && it.maxScore > 0 && it.weight != null,
    );
    const gradedWeight = scored.reduce((sum, it) => sum + (it.weight ?? 0), 0);
    const earned = scored.reduce(
      (sum, it) => sum + (it.weight ?? 0) * (it.score! / it.maxScore!),
      0,
    );
    return {
      courseId: c.id,
      name: c.name,
      code: c.code,
      color: c.color,
      grade: gradedWeight > 0 ? (earned / gradedWeight) * 100 : null,
      gradedWeight,
      totalWeight: mine.reduce((sum, it) => sum + (it.weight ?? 0), 0),
      gradedCount: scored.length,
      itemCount: mine.length,
    };
  });
}

export function demoStats(): SemesterStats[] {
  const items = demoItems();
  const courses = demoCourseGrades();
  const graded = courses.filter((c) => c.grade != null);
  const now = Date.now();
  const upcoming = items
    .filter((it) => new Date(it.dueAt).getTime() > now)
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  return [
    {
      semesterId: DEMO_SEMESTER.id,
      average: graded.length
        ? graded.reduce((sum, c) => sum + (c.grade ?? 0), 0) / graded.length
        : null,
      courseCount: courses.length,
      gradedCourseCount: graded.length,
      itemsTotal: items.length,
      itemsDone: items.filter((it) => it.status === "DONE").length,
      itemsGraded: items.filter((it) => it.score != null).length,
      upcomingCount: upcoming.length,
      nextDueAt: upcoming[0]?.dueAt ?? null,
      courses,
    },
  ];
}

export function demoNotes(courseId: number): Note[] {
  if (courseId !== 1) return [];
  return [
    {
      id: 1,
      courseId,
      body: "The chain rule is just peeling an onion: differentiate the outside, leave the inside alone, then multiply by the derivative of the inside. Practice this before the final.",
      createdAt: at(-3, "20:14:00"),
    },
    {
      id: 2,
      courseId,
      body: "Office hours moved to Thursdays 2 to 4pm in Room 118.",
      createdAt: at(-11, "11:02:00"),
    },
  ];
}

export function demoFlashcardSets(): FlashcardSet[] {
  return [
    {
      id: 1,
      courseId: 3,
      title: "BIOL 101 \u00b7 The Cell",
      description: "Organelles and what each one actually does.",
      createdAt: at(-12, "18:40:00"),
      dueCount: 4,
      cards: [
        { id: 1, front: "What is the powerhouse of the cell?", back: "The mitochondria." },
        { id: 2, front: "Where is DNA stored in a eukaryotic cell?", back: "In the nucleus." },
        { id: 3, front: "What do ribosomes do?", back: "Build proteins by translating messenger RNA." },
        { id: 4, front: "What is the job of the cell membrane?", back: "Control what enters and leaves the cell." },
        { id: 5, front: "Which organelle does photosynthesis?", back: "The chloroplast, in plant cells." },
      ],
    },
    {
      id: 2,
      courseId: 2,
      title: "PSYC 101 \u00b7 Key Terms",
      description: "Definitions I keep mixing up before the midterm.",
      createdAt: at(-6, "21:05:00"),
      dueCount: 2,
      cards: [
        { id: 6, front: "Classical conditioning", back: "Learning to link a neutral cue with an automatic response, like Pavlov's dogs." },
        { id: 7, front: "Operant conditioning", back: "Learning driven by the consequences of a behaviour: reward or punishment." },
        { id: 8, front: "Confirmation bias", back: "Noticing the evidence that fits what you already believe, and skipping the rest." },
      ],
    },
  ];
}
