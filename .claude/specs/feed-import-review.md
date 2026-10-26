# Feed import review + notification center — shared contract

Plan: /home/rnaveee/.claude/plans/this-plan-is-to-tranquil-pebble.md

Already on main (do not recreate): `V72__notification_center_feed_imports.sql`, `canvas/FeedImport` (+Repository),
`canvas/FeedIgnoredRef` (+Repository). Next free migration is V73 — agents must NOT add migrations without asking the lead.

Project rules: no code comments or javadoc; match surrounding style; backend verified with `mvn package` inside
podman `maven:3.9-eclipse-temurin-21 --network=host`; frontend with `npm run build` in `frontend/`.

## Notification center (#0)

`notifications` now has nullable `title`, `url`; types add `FRIEND_REQUEST`, `FEED_REVIEW`.
Center types = `ANNOUNCEMENT`, `FRIEND_REQUEST`, `FEED_REVIEW`.

- `GET  /api/notifications/center?page=0&size=20` → `PageResponse<NotificationDto>` (center types, newest first)
- `GET  /api/notifications/unread-count` → `{ "count": n }` (center types, unread)
- `POST /api/notifications/read-all` → 204 (center types)
- `NotificationDto { id, type, title, message, url, relatedItemId, read, createdAt }`

FEED_REVIEW notifications: `relatedItemId = feedImport.id`, `url = "/imports/{id}"`,
title `"New courses and deadlines from Canvas"` (Brightspace / Moodle by provider).
Dispatched through `NotificationDispatcher.dispatch(user, FEED_REVIEW, importId, dedupKey, title, body, url)`.

## Staged payload (`feed_imports.payload`, JSON via Jackson)

```
StagedPayload {
  provider: "CANVAS" | "D2L" | "MOODLE",
  semesterId: Long | null,
  courses: StagedCourse[]
}
StagedCourse {
  key: String,                 // "canvas:<id>" | "<lmsProvider>:<lmsCourseId>" | "code:<codeKey>"
  canvasCourseId: Long | null,
  lmsProvider: String | null,
  lmsCourseId: String | null,
  name: String,                // "Fundamentals of Digital Logic and Design"
  code: String | null,         // "ENSC252 D100"
  color: String,
  semesterId: Long | null,
  linkedCourseId: Long | null, // already linked to a Studily course: no confirm slide, items still reviewed
  matchCourseId: Long | null,  // CourseMatcher suggestion for an unlinked course
  items: StagedItem[]
}
StagedItem {
  key: String,                 // == externalUid, unique within the payload
  externalUid: String,
  kind: "ITEM" | "EVENT",      // AcademicItem vs CalendarEvent
  type: "ASSIGNMENT" | "EXAM" | null,
  title: String,
  dueAt: ISO-8601 instant,
  place: String | null
}
```

Staging never creates courses or new items. It still silently updates items/events whose `externalUid` already
exists for the user, and imports events with no course. Refs in `feed_ignored_refs` are left out.
A feed has at most one PENDING import; a sync merges new staged things into it (by key).
If nothing new is staged, no import row and no notification.

## Endpoints (#1, #2)

- `POST /api/canvas/feed` (+ `/api/school-feed/feed`) body `FeedRequest` →
  `FeedStageResult { importId: Long|null, provider, newCourses, newItems, itemsUpdated, eventsImported, truncated }`
- `GET  /api/imports/{id}` → `FeedImportView { id, provider, status, createdAt, courses: StagedCourseView[] }`
  where `StagedCourseView = StagedCourse + match: CourseDto|null + linked: CourseDto|null`
- `POST /api/imports/{id}/dismiss` → 204
- `POST /api/imports/{id}/conflicts` body `CourseDecisions` → `Conflict[]`   (#2)
- `POST /api/imports/{id}/apply` body `ApplyRequest` → `ApplyResult`         (#2; #1 ships a version that applies
  every non-skipped item as ADD so the flow works end-to-end before #2 lands)

```
CourseDecisions { courses: CourseDecision[] }
CourseDecision  { key, decision: "ADD" | "MERGE" | "SKIP", targetCourseId: Long | null, overrides: CourseRequest | null }
ApplyRequest    { courses: CourseDecision[], items: ItemDecision[] }
ItemDecision    { key, decision: "ADD" | "REPLACE" | "SKIP",
                  existingId: Long | null, existingKind: "ITEM" | "EVENT" | null }   // both required for REPLACE
Conflict        { itemKey, courseKey, incoming: StagedItem,
                  existing: { id, kind: "ITEM"|"EVENT", title, type, dueAt, courseId, courseName, courseCode } }
ApplyResult     { coursesCreated, coursesMerged, itemsAdded, itemsReplaced, itemsSkipped }
```

Conflicts: for every staged item of a course that will be ADDed, MERGEd or is linked, existing AcademicItems and
CalendarEvents of the target course(s) whose externalUid is null or different and whose normalized title (lowercase,
punctuation to spaces, collapsed whitespace) equals the incoming one. ADD checks the courses CourseMatcher finds,
MERGE the chosen target (targetCourseId ?? matchCourseId), linked the linked course; SKIPped courses and items already
imported by externalUid are left out. Closest dueAt wins, each existing record is used once, sorted by existing dueAt.
REPLACE: same-kind updates title/dueAt (events: place) and stamps externalUid, keeping grades/status/weight and moving the
record to the target course (grade category cleared when the course changes); a different kind deletes the existing
record and adds the incoming one. existingId must belong to the user, else 404. If the incoming externalUid already
belongs to another record the replace does nothing. `ApplyResult.itemsReplaced` counts replacements.

All `/api/imports/{id}` endpoints load with `FeedImportRepository.findByIdAndUserId` → 404 otherwise.
Apply/dismiss on a non-PENDING import → 409. Linked courses (`linkedCourseId`) need no decision.
Courses skipped → `feed_ignored_refs(COURSE, key)`. Items skipped → `feed_ignored_refs(ITEM, externalUid)`.
Apply marks the import APPLIED and the matching FEED_REVIEW notification read.

## Merge rule
Keep existing values; fill empty fields from incoming; if the existing name is only a course code
(`CourseCodes.find` covers the whole trimmed name), set name = incoming name and code = incoming code;
stamp canvasCourseId / lmsProvider / lmsCourseId.

## Frontend routes
`/imports/:id` → `features/imports/ImportReviewPage.tsx`: course slides (#1) → conflict solver (#2) → apply.
