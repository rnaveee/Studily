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
  credits?: number | null;
  letter?: string | null;
  points?: number | null;
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
  termGpa?: number | null;
  cumulativeGpa?: number | null;
  gpaScale: GpaScaleName;
  creditsMissing: boolean;
  courses: CourseGrade[];
}

export type GpaScaleName = "FOUR_POINT" | "FOUR_THREE_THREE" | "NINE_POINT" | "UBC_PERCENT";

export interface GpaScalePrefs {
  scale: GpaScaleName;
  defaultScale: GpaScaleName;
  explicit: boolean;
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
  flair?: FlairRef | null;
  emailVerified: boolean;
  admin?: boolean;
  welcomed?: boolean;
  suspended?: boolean;
  suspendedUntil?: string | null;
  banned?: boolean;
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
  credits?: number | null;
  targetGrade?: number | null;
  meetingBlocks: MeetingBlock[];
}

export interface CourseRequest {
  name: string;
  semesterId?: number | null;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  color?: string | null;
  credits?: number | null;
  targetGrade?: number | null;
  meetingBlocks: MeetingBlock[];
}

export interface DraftItem {
  type: ItemType;
  title: string;
  dueAt: string | null;
  weight?: number | null;
  location?: string | null;
  category?: string | null;
}

export interface DraftCategory {
  name: string;
  kind: ItemType;
  weight: number;
}

export interface GradeCategory {
  id: number;
  courseId: number;
  name: string;
  kind: ItemType;
  weight: number | null;
  color: string;
  position: number;
}

export interface GradeCategoryRequest {
  name: string;
  weight?: number | null;
  position?: number | null;
  color?: string | null;
}

export type ParseRating = "ACCURATE" | "MINOR_FIXES" | "INACCURATE";

export interface ParseAvailability {
  enabled: boolean;
  monthlyLimit: number;
  remaining: number;
  paused: boolean;
}

export interface GenAvailability {
  enabled: boolean;
  monthlyLimit: number;
  remaining: number;
  paused: boolean;
  maxFiles: number;
  maxFileBytes: number;
  maxTotalBytes: number;
}

export interface GeneratedCard {
  front: string;
  back: string;
  frontImage: string | null;
  backImage: string | null;
  sourcePage: number | null;
  sourceLabel: string | null;
  sourceFile: string | null;
  duplicate: boolean;
}

export interface GeneratedDeck {
  title: string;
  cards: GeneratedCard[];
  warnings: string[];
  remaining: number;
}

export interface ParseAccuracy {
  successRate: number | null;
  sampleSize: number;
}

export interface CourseDraft {
  parseId?: number | null;
  name?: string | null;
  code?: string | null;
  professor?: string | null;
  location?: string | null;
  meetingBlocks: MeetingBlock[];
  gradeCategories: DraftCategory[];
  items: DraftItem[];
  warnings: string[];
}

export interface ScheduleDraftCourse {
  name?: string | null;
  code?: string | null;
  color?: string | null;
  meetingBlocks: MeetingBlock[];
}

export interface ScheduleDraft {
  parseId?: number | null;
  courses: ScheduleDraftCourse[];
  warnings: string[];
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
  gradeCategoryId?: number | null;
  gradeCategoryName?: string | null;
  gradeCategoryColor?: string | null;
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
  gradeCategoryId?: number | null;
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
  courseId?: number | null;
  courseName?: string | null;
  courseCode?: string | null;
  courseColor?: string | null;
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
  flair?: FlairRef | null;
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
  setId?: number;
  front: string;
  back: string;
  frontImage?: string | null;
  backImage?: string | null;
  dueAt?: string;
  intervalDays?: number;
  repetitions?: number;
  easeFactor?: number;
}

export type ReviewGrade = "AGAIN" | "HARD" | "GOOD" | "EASY";

export type FlashcardSetVisibility = "PRIVATE" | "FRIENDS" | "PUBLIC";

export interface FlashcardSet {
  id: number;
  courseId?: number | null;
  folderId?: number | null;
  title: string;
  description?: string | null;
  visibility: FlashcardSetVisibility;
  createdAt: string;
  dueCount: number;
  copiedFrom?: CopiedFrom | null;
  cards: Flashcard[];
}

export interface CopiedFrom {
  setId?: number | null;
  title?: string | null;
  owner: SetOwner;
}

export interface FlashcardSetRequest {
  title: string;
  description?: string | null;
  courseId?: number | null;
  cards: Flashcard[];
  visibility?: FlashcardSetVisibility;
}

export interface FlashcardFolder {
  id: number;
  name: string;
  position: number;
  setCount: number;
  createdAt: string;
}

export interface StudyGroup {
  kind: "folder" | "course";
  id: number;
  title: string;
  setCount: number;
  truncated: boolean;
  cards: Flashcard[];
}

export interface StudyCard {
  id?: number;
  setId?: number;
  front: string;
  back: string;
  frontImage?: string | null;
  backImage?: string | null;
}

export interface SetOwner {
  id: number;
  username: string;
  name: string;
  avatarUrl?: string | null;
  flair?: FlairRef | null;
}

export interface SharedFlashcardSet {
  id: number;
  title: string;
  description?: string | null;
  visibility: FlashcardSetVisibility;
  createdAt: string;
  cardCount: number;
  owner: SetOwner;
  viewerIsOwner: boolean;
  cards: StudyCard[];
}

export interface FlashcardSetSummary {
  id: number;
  title: string;
  description?: string | null;
  visibility: FlashcardSetVisibility;
  cardCount: number;
  createdAt: string;
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
  replyTo?: MessageReply | null;
}

export interface MessageReply {
  id: number;
  senderId: number | null;
  senderName: string | null;
  body: string | null;
  deleted: boolean;
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
  examCountdown: boolean;
}

export interface UpcomingExam {
  id: number;
  title: string;
  dueAt: string;
  courseId: number;
  courseName: string;
  courseCode?: string | null;
  courseColor?: string | null;
  daysLeft: number;
  weight?: number | null;
  currentPercent?: number | null;
  targetGrade?: number | null;
  neededPercent?: number | null;
  linkedSets: number;
  linkedTodos: number;
}

export interface ExamPlanSet {
  linkId: number;
  setId: number;
  title: string;
  totalCards: number;
  remainingCards: number;
}

export interface ExamPlanTodo {
  linkId: number;
  todoId: number;
  title: string;
  completed: boolean;
}

export interface ExamPlanDay {
  date: string;
  cards: number;
  todos: { todoId: number; title: string }[];
  today: boolean;
}

export interface ExamPlan {
  examId: number;
  title: string;
  dueAt: string;
  courseId: number;
  courseName: string;
  daysLeft: number;
  remainingCards: number;
  todayCards: number;
  sets: ExamPlanSet[];
  todos: ExamPlanTodo[];
  days: ExamPlanDay[];
}


export interface IcsImportResult {
  calendarName?: string | null;
  imported: number;
  updated: number;
  skipped: number;
  truncated: boolean;
}

export interface CalendarFeedCreated {
  httpsUrl: string;
  webcalUrl: string;
  createdAt: string;
}

export interface CalendarFeedStatus {
  exists: boolean;
  createdAt: string | null;
  lastFetchedAt: string | null;
}

export type FeedProvider = "CANVAS" | "D2L" | "MOODLE";

export interface FeedStageResult {
  importId: number | null;
  provider: FeedProvider;
  newCourses: number;
  newItems: number;
  itemsUpdated: number;
  eventsImported: number;
  truncated: boolean;
}

export interface StagedItem {
  key: string;
  externalUid: string;
  kind: "ITEM" | "EVENT";
  type: ItemType | null;
  title: string;
  dueAt: string;
  place: string | null;
}

export interface StagedCourseView {
  key: string;
  canvasCourseId: number | null;
  lmsProvider: string | null;
  lmsCourseId: string | null;
  name: string;
  code: string | null;
  color: string;
  semesterId: number | null;
  linkedCourseId: number | null;
  matchCourseId: number | null;
  items: StagedItem[];
  match: Course | null;
  linked: Course | null;
}

export interface FeedImportView {
  id: number;
  provider: FeedProvider | null;
  status: "PENDING" | "APPLIED" | "DISMISSED";
  createdAt: string;
  courses: StagedCourseView[];
}

export type CourseChoice = "ADD" | "MERGE" | "SKIP";
export type ItemChoice = "ADD" | "REPLACE" | "SKIP";

export interface CourseDecision {
  key: string;
  decision: CourseChoice;
  overrides?: CourseRequest | null;
  targetCourseId?: number | null;
}

export interface ItemDecision {
  key: string;
  decision: ItemChoice;
  existingId?: number | null;
  existingKind?: "ITEM" | "EVENT" | null;
}

export interface CourseDecisions {
  courses: CourseDecision[];
}

export interface ExistingItem {
  id: number;
  kind: "ITEM" | "EVENT";
  title: string;
  type: ItemType | null;
  dueAt: string;
  courseId: number;
  courseName: string;
  courseCode: string | null;
}

export interface ImportConflict {
  itemKey: string;
  courseKey: string;
  incoming: StagedItem;
  existing: ExistingItem;
}

export interface ApplyRequest {
  courses: CourseDecision[];
  items: ItemDecision[];
}

export interface ApplyResult {
  coursesCreated: number;
  coursesMerged: number;
  itemsAdded: number;
  itemsReplaced: number;
  itemsSkipped: number;
}

export interface SchoolFeedView {
  id: number;
  provider: "CANVAS" | "D2L" | "MOODLE" | null;
  host: string;
  lastSyncedAt: string | null;
  lastSuccessAt: string | null;
  lastError: string | null;
  enabled: boolean;
}

export interface SchoolFeedList {
  available: boolean;
  feeds: SchoolFeedView[];
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

export interface AdminParseSpender {
  username: string;
  parses: number;
  usd: number;
}

export interface AdminFeatureBudget {
  feature: string;
  label: string;
  usesThisMonth: number;
  usdToday: number;
  dailyBudget: number;
  usdMonth: number;
  monthlyBudget: number;
}

export interface AdminParseSpend {
  parsesToday: number;
  parses7d: number;
  parsesTotal: number;
  usdToday: number;
  usd7d: number;
  usdTotal: number;
  topSpenders7d: AdminParseSpender[];
  budgets: AdminFeatureBudget[];
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
  status: AccountStatus;
  banned: boolean;
  suspendedUntil: string | null;
  openReports: number;
}

export interface AdminUserDetail {
  user: AdminUserRow;
  year: number | null;
  major: string | null;
  bio: string | null;
  tokenVersion: number;
  counts: Record<string, number>;
  avatarUrl: string | null;
  actions: AdminModerationAction[];
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

export type BadgeCategory = "LEVEL" | "SOCIAL" | "TENURE" | "STUDY" | "FLASHCARDS" | "COSMETIC";

export interface BadgeDto {
  code: string;
  category: BadgeCategory;
  title: string;
  description: string;
  imageUrl: string;
  priceCoins: number | null;
  owned: boolean;
  acquiredAt: string | null;
  featuredSlot: number | null;
}

export interface StreakDto {
  current: number;
  best: number;
  multiplier: number;
}

export interface ProgressDto {
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  coins: number;
  streak: StreakDto;
  featuredBadges: BadgeDto[];
  badgeCount: number;
  badgeTotal: number;
  unopenedChests: number;
}

export interface PublicProgressDto {
  userId: number;
  level: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  streakCurrent: number;
  featuredBadges: BadgeDto[];
  badgeCount: number;
  badgeTotal: number;
}

export type ChestSource = "LEVEL" | "STREAK" | "SESSION" | "FLASHCARD" | "WELCOME" | "SURVEY";

export type ChestTier = "WOOD" | "SILVER" | "GOLD" | "DIAMOND";

export interface ChestDto {
  id: number;
  source: ChestSource;
  tier: ChestTier;
  createdAt: string;
  openedAt: string | null;
  loot: { coins: number; xp: number; badge: BadgeDto | null; flair: FlairDto | null } | null;
}

export interface ProgressDelta {
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  xp: number;
  xpIntoLevel: number;
  xpForNext: number;
  coinsGained: number;
  coins: number;
  newBadges: BadgeDto[];
  newFlairs: FlairDto[];
  chests: ChestDto[];
}

export type FlairRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";

export type FlairUnlock = "SHOP" | "CHEST" | "STREAK";

export interface FlairRef {
  code: string;
  imageUrl: string | null;
}

export interface FlairDto {
  code: string;
  title: string;
  description: string;
  rarity: FlairRarity;
  unlock: FlairUnlock;
  priceCoins: number | null;
  streakDays: number | null;
  imageUrl: string | null;
  owned: boolean;
  acquiredAt: string | null;
  equipped: boolean;
}

export interface FlairPurchaseResult {
  flair: FlairDto;
  coins: number;
}

export interface FlairEquipResult {
  equipped: FlairDto | null;
}

export interface BadgePurchaseResult {
  badge: BadgeDto;
  coins: number;
}

export interface ChestOpenResult {
  chest: ChestDto;
  delta: ProgressDelta;
}

export type StudySessionMode = "POMODORO" | "TIMER";

export type StudySessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ENDED" | "EXPIRED";

export interface StudySessionTaskDto {
  id: number;
  position: number;
  text: string;
  done: boolean;
  earned: boolean;
}

export interface StudySessionBlockDto {
  index: number;
  status: "RUNNING" | "CONFIRMED" | "MISSED" | "PARTIAL";
  startedAt: string;
  dueAt: string;
  creditedMinutes: number;
  xpAwarded: number;
}

export interface StudySessionDto {
  id: number;
  mode: StudySessionMode;
  status: StudySessionStatus;
  plannedBlocks: number;
  blockMinutes: number;
  breakMinutes: number;
  plannedMinutes: number;
  startedAt: string;
  endedAt: string | null;
  currentBlock: number;
  checkinOpensAt: string | null;
  checkinClosesAt: string | null;
  creditedMinutes: number;
  xpAwarded: number;
  multiplier: number;
  tasks: StudySessionTaskDto[];
  blocks: StudySessionBlockDto[];
  userPausedAt: string | null;
  serverNow: string;
}

export interface StudySessionSummaryDto {
  id: number;
  mode: StudySessionMode;
  status: StudySessionStatus;
  startedAt: string;
  endedAt: string | null;
  plannedMinutes: number;
  creditedMinutes: number;
  xpAwarded: number;
  tasksDone: number;
  tasksTotal: number;
}

export interface StudySessionResult {
  session: StudySessionDto;
  delta: ProgressDelta;
}

export interface StudySessionRecap {
  session: StudySessionDto;
  coinsAwarded: number;
  chests: ChestDto[];
}

export interface StartStudySessionRequest {
  mode: StudySessionMode;
  blocks?: number;
  minutes?: number;
  tasks: string[];
}

export type StreakDayLabel = "Su" | "M" | "Tu" | "W" | "Th" | "F" | "Sa";

export interface StreakWeekDto {
  current: number;
  best: number;
  multiplier: number;
  minutesToday: number;
  today: string;
  week: { date: string; label: StreakDayLabel; qualified: boolean; isToday: boolean; restored: boolean }[];
  restoresLeft: number;
  broken: BrokenStreakDto | null;
}

export interface BrokenStreakDto {
  lostStreak: number;
  missedDays: string[];
}

export interface StreakRestoreResult {
  streak: StreakWeekDto;
  delta: ProgressDelta;
}

export type FlashcardRunMode = "REVIEW" | "LEARN" | "MEMORY" | "MATCH";

export type XpReason = "FULL" | "REDUCED" | "REPEAT" | "DAILY_CAP" | "TOO_FAST" | "TOO_FEW";

export interface FlashcardRunStart {
  runId: number;
  startedAt: string;
}

export interface FlashcardRunCardResult {
  cardId: number;
  correct: boolean;
}

export interface FlashcardRunResult {
  runId: number;
  mode: FlashcardRunMode;
  cardCount: number;
  correctCount: number;
  xpAwarded: number;
  xpReason: XpReason;
  cards: {
    cardId: number;
    front: string;
    back: string;
    frontImage?: string | null;
    backImage?: string | null;
    correct: boolean;
  }[];
  delta: ProgressDelta;
}

export type AccountStatus = "GOOD" | "SUSPENDED";
export type ReportKind = "USER" | "MESSAGE";
export type ReportReason =
  | "SPAM"
  | "INAPPROPRIATE_AVATAR"
  | "INAPPROPRIATE_BIO"
  | "HARASSMENT"
  | "THREATS"
  | "HATE_SPEECH"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";
export type ReportStatus = "OPEN" | "ACTIONED" | "DISMISSED";
export type ModerationActionType = "WARNING" | "SUSPENSION" | "BAN";

export interface ModerationWarning {
  id: number;
  reasons: ReportReason[];
  note: string | null;
  createdAt: string;
}

export interface MeModeration {
  status: AccountStatus;
  banned: boolean;
  suspendedUntil: string | null;
  suspendedAt: string | null;
  reasons: ReportReason[];
  note: string | null;
  supportEmail: string | null;
  warnings: ModerationWarning[];
}

export interface AdminReportGroup {
  userId: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
  banned: boolean;
  suspendedUntil: string | null;
  openCount: number;
  totalCount: number;
  openReasons: Record<string, number>;
  latestAt: string;
}

export interface AdminReport {
  id: number;
  kind: ReportKind;
  reason: ReportReason;
  details: string | null;
  status: ReportStatus;
  reporterId: number | null;
  reporterUsername: string;
  createdAt: string;
  messageId: number | null;
  conversationId: number | null;
  messageBody: string | null;
  attachmentFilename: string | null;
  attachmentContentType: string | null;
  messageCreatedAt: string | null;
  messageExists: boolean;
  hasEvidence: boolean;
  targetNameSnapshot: string | null;
  targetBioSnapshot: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  actionId: number | null;
}

export interface AdminModerationAction {
  id: number;
  type: ModerationActionType;
  reasons: ReportReason[];
  note: string | null;
  createdAt: string;
  createdBy: string;
  endsAt: string | null;
  acknowledgedAt: string | null;
  revokedAt: string | null;
  revokedBy: string | null;
  removedAvatar: boolean;
  clearedBio: boolean;
  deletedMessages: number;
  active: boolean;
}

export interface AdminReportCase {
  user: AdminUserRow;
  bio: string | null;
  avatarUrl: string | null;
  reports: AdminReport[];
  actions: AdminModerationAction[];
}

export interface AdminModerationResult {
  actionId: number;
  status: AccountStatus;
  banned: boolean;
  suspendedUntil: string | null;
  deletedMessages: number;
}

export type SurveyQuestionType = "SINGLE" | "MULTI" | "MATRIX" | "SCALE" | "TEXT";

export interface SurveyQuestion {
  id: string;
  step: number;
  type: SurveyQuestionType;
  prompt: string;
  options: string[] | null;
  rows: { id: string; label: string }[] | null;
  columns: string[] | null;
  min: number | null;
  max: number | null;
  maxPicks: number | null;
  required: boolean;
  showIf: { question: string; values: string[] } | null;
  optionsFrom: string | null;
}

export interface SurveyDto {
  key: string;
  open: boolean;
  eligible: boolean;
  completed: boolean;
  promptSeen: boolean;
  definition: { key: string; steps: number; questions: SurveyQuestion[] };
}

export type SurveyAnswerValue = string | number | string[] | Record<string, string>;

export interface AdminSurveyCount {
  label: string;
  count: number;
}

export interface AdminSurveyMatrixRow {
  id: string;
  label: string;
  counts: AdminSurveyCount[];
}

export interface AdminSurveyQuestion {
  id: string;
  step: number;
  type: SurveyQuestionType;
  prompt: string;
  respondents: number;
  counts: AdminSurveyCount[];
  matrix: AdminSurveyMatrixRow[] | null;
}

export interface AdminSurveySummary {
  key: string;
  responses: number;
  eligible: number;
  pmfAll: number | null;
  pmfAllBase: number;
  pmfWeekly: number | null;
  pmfWeeklyBase: number;
  nps: number | null;
  npsBase: number;
  avgEase: number | null;
  questions: AdminSurveyQuestion[];
}

export interface AdminSurveyText {
  username: string;
  createdAt: string;
  value: string;
}

export interface AdminSurveyContact {
  username: string;
  email: string;
  createdAt: string;
}

export type NotificationKind =
  | "DEADLINE_REMINDER"
  | "CLASS_REMINDER"
  | "EVENT_TODAY"
  | "ITEM_WEEK_AHEAD"
  | "EXAM_TODAY"
  | "EXAM_COUNTDOWN"
  | "ANNOUNCEMENT"
  | "FRIEND_REQUEST"
  | "FEED_REVIEW";

export interface AppNotification {
  id: number;
  type: NotificationKind;
  title: string | null;
  message: string;
  url: string | null;
  relatedItemId: number | null;
  read: boolean;
  createdAt: string;
}

export interface UnreadCount {
  count: number;
}
