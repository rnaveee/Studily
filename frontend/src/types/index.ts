export interface Page<T> {
  items: T[];
  hasMore: boolean;
}

export type SemesterTerm = "FALL" | "SPRING" | "SUMMER" | "WINTER";

export interface Semester {
  id: number;
  term: SemesterTerm;
  year: number;
  label: string;
  startDate: string;
  endDate: string;
}

export interface CourseGrade {
  courseId: number;
  name: string;
  code?: string | null;
  color?: string | null;
  grade?: number | null;
  gradedWeight: number;
  totalWeight: number;
  gradedCount: number;
  itemCount: number;
}

export interface SemesterStats {
  semesterId: number;
  average?: number | null;
  courseCount: number;
  gradedCourseCount: number;
  itemsTotal: number;
  itemsDone: number;
  itemsGraded: number;
  upcomingCount: number;
  nextDueAt?: string | null;
  courses: CourseGrade[];
}

export interface SemesterRequest {
  term: SemesterTerm;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
}

export type DayOfWeek = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
export const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

export type SeriesScope = "OCCURRENCE" | "SERIES";

export type RecurrenceFreq = "DAILY" | "WEEKLY" | "MONTHLY";

export interface Recurrence {
  freq: RecurrenceFreq;
  interval: number;
  byDay?: DayOfWeek[];
  until?: string;
  count?: number;
}

export type ItemType = "EXAM" | "ASSIGNMENT";
export type ItemStatus = "TODO" | "IN_PROGRESS" | "DONE";

export interface User {
  id: number;
  email: string;
  username: string;
  name: string;
  school?: string | null;
  schoolId?: string | null;
  year?: number | null;
  major?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export type MeetingKind = "LECTURE" | "LAB" | "TUTORIAL";
export const MEETING_KINDS: MeetingKind[] = ["LECTURE", "LAB", "TUTORIAL"];
export const MEETING_KIND_LABEL: Record<MeetingKind, string> = {
  LECTURE: "Lecture",
  LAB: "Lab",
  TUTORIAL: "Tutorial",
};
export const MEETING_KIND_PLURAL: Record<MeetingKind, string> = {
  LECTURE: "Lectures",
  LAB: "Labs",
  TUTORIAL: "Tutorials",
};

export interface MeetingBlock {
  id?: number;
  dayOfWeek: DayOfWeek;
  kind?: MeetingKind;
  startTime: string;
  endTime: string;
  location?: string | null;
}

export interface Course {
  id: number;
  semesterId?: number | null;
  name: string;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  color?: string | null;
  meetingBlocks: MeetingBlock[];
}

export interface CourseRequest {
  name: string;
  semesterId?: number | null;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  color?: string | null;
  meetingBlocks: MeetingBlock[];
}

export interface AcademicItem {
  seriesId?: string | null;
  recurrenceRule?: string | null;
  id: number;
  courseId: number;
  courseName: string;
  courseColor?: string | null;
  type: ItemType;
  title: string;
  dueAt: string;
  location?: string | null;
  weight?: number | null;
  score?: number | null;
  maxScore?: number | null;
  status: ItemStatus;
}

export interface AcademicItemRequest {
  type: ItemType;
  title: string;
  dueAt: string;
  location?: string | null;
  weight?: number | null;
  score?: number | null;
  maxScore?: number | null;
  status: ItemStatus;
  recurrence?: Recurrence | null;
}

export interface CourseMatchItem {
  type: ItemType;
  title: string;
  dueAt: string;
  weight?: number | null;
  location?: string | null;
}

export interface CourseMatch {
  id: number;
  name: string;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  school?: string | null;
  meetingBlocks: MeetingBlock[];
  items: CourseMatchItem[];
  userCount: number;
}

export interface EventCategory {
  id: number;
  name: string;
  color: string;
}

export interface EventCategoryRequest {
  name: string;
  color: string;
}

export interface CalendarEvent {
  seriesId?: string | null;
  recurrenceRule?: string | null;
  id: number;
  title: string;
  place?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  startAt: string;
}

export interface CalendarEventRequest {
  title: string;
  place?: string | null;
  categoryId?: number | null;
  startAt: string;
  recurrence?: Recurrence | null;
}

export interface Note {
  id: number;
  courseId: number;
  body: string;
  createdAt: string;
}

export interface ScheduledMeeting {
  courseId: number;
  courseName: string;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  color?: string | null;
  kind?: MeetingKind | null;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface DayColumn {
  date: string;
  dayOfWeek: DayOfWeek;
  meetings: ScheduledMeeting[];
  items: AcademicItem[];
}

export interface WeekView {
  weekStart: string;
  weekEnd: string;
  semester: Semester | null;
  days: DayColumn[];
  dueThisWeek: AcademicItem[];
  nextExam: AcademicItem | null;
}

export interface PublicUser {
  id: number;
  username: string;
  name: string;
  school?: string | null;
  year?: number | null;
  major?: string | null;
  bio?: string | null;
  avatarUrl?: string | null;
}

export type RelationshipStatus = "SELF" | "NONE" | "FRIENDS" | "OUTGOING_PENDING" | "INCOMING_PENDING";

export interface FriendRequestItem {
  id: number;
  user: PublicUser;
  status: "PENDING" | "ACCEPTED";
  createdAt: string;
  respondedAt?: string | null;
}

export interface Relationship {
  user: PublicUser;
  status: RelationshipStatus;
  requestId?: number | null;
}

export interface ProfileSchedule {
  semester: Semester | null;
  courses: Course[];
}

export interface Flashcard {
  id?: number;
  front: string;
  back: string;
  dueAt?: string;
  intervalDays?: number;
  repetitions?: number;
  easeFactor?: number;
}

export type ReviewGrade = "AGAIN" | "HARD" | "GOOD" | "EASY";

export interface FlashcardSet {
  id: number;
  courseId?: number | null;
  title: string;
  description?: string | null;
  createdAt: string;
  dueCount: number;
  cards: Flashcard[];
}

export interface FlashcardSetRequest {
  title: string;
  description?: string | null;
  courseId?: number | null;
  cards: Flashcard[];
}

export type ConversationType = "DIRECT" | "GROUP";

export interface Conversation {
  id: number;
  type: ConversationType;
  name?: string | null;
  members: PublicUser[];
  lastMessage?: string | null;
  lastMessageAt?: string | null;
  unread: boolean;
}

export interface Attachment {
  filename: string;
  contentType: string;
  size: number;
  image: boolean;
  width?: number | null;
  height?: number | null;
}

export interface Message {
  id: number;
  conversationId: number;
  sender: PublicUser;
  body: string;
  attachment?: Attachment | null;
  createdAt: string;
  likeCount: number;
  likedByMe: boolean;
}

export interface MessageLike {
  conversationId: number;
  messageId: number;
  likeCount: number;
  likedBy: number[];
}

export interface NotificationPrefs {
  messages: boolean;
  classReminders: boolean;
  eventDayOf: boolean;
  itemWeekAhead: boolean;
  examDayOf: boolean;
}


export interface IcsImportResult {
  calendarName?: string | null;
  imported: number;
  updated: number;
  skipped: number;
  truncated: boolean;
}
