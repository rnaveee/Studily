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
  admin?: boolean;
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
  canvasSynced?: boolean;
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

export type TodoPriority = "HIGH" | "MEDIUM" | "LOW";

export interface TodoCategory {
  id: number;
  name: string;
  color: string;
}

export interface TodoCategoryRequest {
  name: string;
  color: string;
}

export interface TodoChecklistItem {
  id?: number | null;
  text: string;
  done: boolean;
}

export interface Todo {
  id: number;
  title: string;
  notes?: string | null;
  priority: TodoPriority;
  dueAt?: string | null;
  completed: boolean;
  completedAt?: string | null;
  categoryId?: number | null;
  categoryName?: string | null;
  categoryColor?: string | null;
  checklist: TodoChecklistItem[];
  createdAt: string;
}

export interface TodoRequest {
  title: string;
  notes?: string | null;
  priority: TodoPriority;
  dueAt?: string | null;
  categoryId?: number | null;
  checklist: TodoChecklistItem[];
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
  todosDueThisWeek: Todo[];
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
  visible: boolean;
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
  otherReadAt?: string | null;
}

export type ScheduleVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

export interface PrivacyPrefs {
  readReceipts: boolean;
  scheduleVisibility: ScheduleVisibility;
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
  editedAt?: string | null;
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

export interface CanvasFeedResult {
  coursesCreated: number;
  coursesMatched: number;
  itemsImported: number;
  itemsUpdated: number;
  eventsImported: number;
  eventsUpdated: number;
  skipped: number;
  truncated: boolean;
}

export interface AdminStatus {
  unlocked: boolean;
  totpEnabled: boolean;
  expiresAt: string | null;
  sessionMs: number;
  username: string;
}

export interface AdminUnlockResponse {
  token: string;
  expiresAt: string;
}

export interface AdminTotpSetup {
  secret: string;
  provisioningUri: string;
}

export interface AdminUserMetrics {
  total: number;
  verified: number;
  newToday: number;
  new7d: number;
  prev7d: number;
  new30d: number;
  deletedNever: number;
}

export interface AdminActivityMetrics {
  dau: number;
  wau: number;
  mau: number;
  wauPrev: number;
  stickiness: number;
  neverActive: number;
}

export interface AdminFunnelStep {
  label: string;
  count: number;
  rate: number;
}

export interface AdminContentMetric {
  label: string;
  total: number;
  last7d: number;
}

export interface AdminSchoolCount {
  school: string;
  users: number;
}

export interface AdminRecentUser {
  id: number;
  username: string;
  name: string | null;
  email: string;
  school: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface AdminOverview {
  users: AdminUserMetrics;
  activity: AdminActivityMetrics;
  funnel: AdminFunnelStep[];
  content: AdminContentMetric[];
  schools: AdminSchoolCount[];
  recentSignups: AdminRecentUser[];
}

export interface AdminGrowthPoint {
  date: string;
  signups: number;
  messages: number;
  items: number;
}

export interface AdminUserRow {
  id: number;
  username: string;
  name: string | null;
  email: string;
  school: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  courses: number;
  items: number;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  year: number | null;
  major: string | null;
  bio: string | null;
  tokenVersion: number;
  counts: Record<string, number>;
}

export interface AdminResetLink {
  url: string;
  expiresAt: string;
}

export interface AdminTableInfo {
  name: string;
  rows: number;
  sizeBytes: number;
  sizePretty: string;
}

export interface AdminColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  primaryKey: boolean;
  binary: boolean;
}

export interface AdminTableRows {
  table: string;
  primaryKey: string | null;
  columns: AdminColumnInfo[];
  rows: Record<string, unknown>[];
  total: number;
  page: number;
  size: number;
}

export interface AdminQueryResult {
  columns: string[];
  rows: unknown[][];
  rowsAffected: number | null;
  millis: number;
  truncated: boolean;
  statementType: string;
}

export interface AdminHealth {
  status: string;
  dbLatencyMs: number;
  dbVersion: string;
  dbSize: string;
  schemaVersion: number;
  uptimeMs: number;
  heapUsedMb: number;
  heapMaxMb: number;
  availableProcessors: number;
  mailConfigured: boolean;
  pushConfigured: boolean;
  sentryConfigured: boolean;
  totpEnabled: boolean;
  timezone: string;
}

export interface AdminAuditRow {
  id: number;
  actorName: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
}

export interface AdminPaged<T> {
  items: T[];
  hasMore: boolean;
  total: number;
}

export interface OnboardingStatus {
  profile: boolean;
  semester: boolean;
  courses: boolean;
  coursework: boolean;
  avatar: boolean;
  completed: number;
  total: number;
  complete: boolean;
  courseCount: number;
}
