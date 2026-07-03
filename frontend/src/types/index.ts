export type SemesterTerm = "FALL" | "SPRING" | "SUMMER" | "WINTER";

export interface Semester {
  id: number;
  term: SemesterTerm;
  year: number;
  label: string;
  startDate: string;
  endDate: string;
}

export interface SemesterRequest {
  term: SemesterTerm;
  year: number;
  startDate?: string | null;
  endDate?: string | null;
}

export type DayOfWeek = "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT";
export const DAYS: DayOfWeek[] = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

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
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface MeetingBlock {
  id?: number;
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
}

export interface Course {
  id: number;
  semesterId?: number | null;
  name: string;
  code?: string | null;
  professor?: string | null;
  color?: string | null;
  meetingBlocks: MeetingBlock[];
}

export interface CourseRequest {
  name: string;
  semesterId?: number | null;
  code?: string | null;
  professor?: string | null;
  color?: string | null;
  meetingBlocks: MeetingBlock[];
}

export interface AcademicItem {
  id: number;
  courseId: number;
  courseName: string;
  courseColor?: string | null;
  type: ItemType;
  title: string;
  dueAt: string;
  location?: string | null;
  weight?: number | null;
  status: ItemStatus;
}

export interface AcademicItemRequest {
  type: ItemType;
  title: string;
  dueAt: string;
  location?: string | null;
  weight?: number | null;
  status: ItemStatus;
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
  color?: string | null;
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

export type NotificationType = "DEADLINE_REMINDER";

export interface Notification {
  id: number;
  type: NotificationType;
  message: string;
  relatedItemId?: number | null;
  read: boolean;
  createdAt: string;
}
