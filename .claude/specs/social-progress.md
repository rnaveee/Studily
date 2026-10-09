# Social progress: feature spec and team contract

The single source of truth for the progress team (`.claude/agents/*`). The lead (main session, `/progress-team` skill) owns this file. If an agent thinks something here is wrong, it says so in its HANDOFF; it never silently deviates. Economy numbers change only here, and only with Ryan's say-so.

## 1. Goal

Make Studily social and sticky through progression: XP and levels, badges on profiles, coins to buy cosmetic badges, chests as surprise rewards, and study sessions with streaks on `/learn`. XP comes from study sessions, flashcard runs and new friends.

## 2. House rules (apply to every agent)

- **No code comments.** Not in Java, TS, SQL, CSS. The whole project was stripped of them. Prompts and markdown are fine.
- Match the surrounding idiom. Backend: constructor injection, Lombok `@Getter @Setter` entities, records for DTOs (often grouped in a `*Dtos.java`), `config/BadRequestException|ConflictException|NotFoundException|ForbiddenException|TooManyRequestsException` mapped by `GlobalExceptionHandler`, `CurrentUser.id()` / `.entity()`, `config/PageResponse<T>(items, hasMore)`. Frontend: react-query, `lib/api.ts`, `components/Modal`, `components/SegmentedToggle`, `lib/toast`, lucide icons, existing CSS tokens.
- **Flyway is forward-only.** New files are V40–V44 exactly as in §6. Never edit V1–V39. `spring.jpa.hibernate.ddl-auto=validate`, so entities must match the SQL column-for-column. All timestamps are `TIMESTAMPTZ` mapped to `Instant`. Every `user_id` FK is `ON DELETE CASCADE` (account deletion relies on it).
- **Backend build check** (no local JDK 21; Lombok breaks on the host JDK):
  ```
  podman run --rm --network=host -v "$PWD":/app:z -v "$HOME/.m2":/root/.m2:z -w /app \
    -e JWT_SECRET=ci-test-secret-not-for-production-use-64chars-minimum-xxxxxxxxxx \
    docker.io/library/maven:3.9-eclipse-temurin-21 mvn -B -q package
  ```
  `package`, not `compile`: the Docker build compiles tests too. `contextLoads` needs local Postgres up (`pg_isready -h localhost -p 5432`). **`contextLoads` runs Flyway against `DB_NAME` (default `studily`, which is Ryan's dev DB), so agents must add `-e DB_NAME=<scratch db>` pointing at a `pg_dump` clone, and build in a scratch copy rather than the repo's `target/` whenever Ryan's app is running from it.**
- **Frontend build check:** `cd frontend && npm run build` (tsc + vite). There are no frontend unit tests.
- **Branch:** all feature work lives on `social-progress`. Main auto-deploys to Railway and runs migrations, so nothing lands on main until Ryan says so.
- **Agents never commit, push, merge, or deploy.** The lead commits after the reviewer approves, with no Claude attribution or co-author lines.
- **Stay in your lane.** Edit only files in your row of §11. If you need a change in someone else's file, put it in your HANDOFF as a request.
- **End every run with a HANDOFF block:**
  ```
  HANDOFF
  agent: <name>
  status: done | blocked | partial
  files: <created/modified paths>
  migrations: <V.. files or none>
  api: <endpoints added/changed or none>
  verified: <commands run and their result>
  requests: <changes needed in files you don't own>
  questions: <for the lead/Ryan>
  ```

## 3. XP and levels

- `xpToNext(level) = 450 + 50 × level` (L1→2 needs 500, L2→3 550, L13→14 1100).
- Total XP needed to *reach* level L: `(L − 1) × (450 + 25L)`. L5 = 2,300, L10 = 6,300, L20 = 18,050, L50 = 83,300, L100 = 292,050.
- `user_progress.xp` is lifetime total. `level` is denormalised and must always equal `LevelMath.levelFor(xp)`. `xpIntoLevel = xp − totalFor(level)`, `xpForNext = xpToNext(level)`.
- Pacing target: ~1h/day, 5 days a week → L10 in about a month, L20 by end of a semester.
- XP is computed on the server only. The client never sends an XP amount or a duration that the server trusts.

### XP sources

| Source (`xp_events.source`) | Amount | Dedupe key |
|---|---|---|
| `STUDY_BLOCK` | `2 × creditedMinutes + 10`, × session multiplier, then daily diminishing returns (§4) | `study-block:{blockId}` |
| `STUDY_PARTIAL` | `2 × floor(elapsedMinutes)`, × multiplier, only if the user ends a block early after ≥10 min | `study-block:{blockId}` |
| `STUDY_COMPLETE` | +40 × multiplier, when every planned block was confirmed and `planned_minutes ≥ 50` | `study-complete:{sessionId}` |
| `STUDY_TASK` | +5 per task, first 5 tasks of a session only, ticked ≥5 min after `started_at`, no multiplier, **paid only once the session has credited minutes** (§4 item 6), max **10 paid tasks per user per `local_date`** (decided by Ryan 2026-10-08 after the security review) | `study-task:{taskId}` |
| `FLASHCARD_RUN` | §5 | `flashcard-run:{runId}` |
| `FRIEND` | +50 to each user, once per pair ever, max 10 FRIEND grants per user per rolling 24h (counted by summed FRIEND XP ÷ 50; a pair that hits the cap gets no 0-XP row, so it can still pay once on a later re-friend). A user only earns it if the **other** account is ≥7 days old (`users.created_at`) **and** has at least one `xp_events` row with a source other than FRIEND (decided by Ryan 2026-10-08 after the security review). If the condition fails at accept time, no XP is granted for that pair, now or later. Popularity badges still count every friend | `friend:{recipientId}:{otherId}` |
| `CHEST` | rolled loot (§7) | `chest:{chestId}` |

- Streak multiplier: `min(1.5, 1.0 + 0.1 × max(0, streak − 1))`, where `streak` is the effective current streak when the session **starts**. It's frozen into `study_sessions.multiplier`.
- XP after the multiplier is rounded half-up to an integer.
- Existing friendships get **no retroactive XP**. Badges are retroactive (§8), because they're evaluated from current stats.

### Level-up

Each level gained inside a grant:
- `coins += 20 + 5 × newLevel`, with a `coin_transactions` row: reason `LEVEL_UP`, ref `level:{n}`.
- If `newLevel % 5 == 0`, a chest is granted: source `LEVEL`, source_ref `level:{n}`.
- Then badges are evaluated.

Several levels in one grant are handled in a loop.

## 4. Study sessions and anti-farming

Modes:
- `POMODORO`: `blocks` 1–8 (UI default 5), `block_minutes = 25`, `break_minutes = 5`, `planned_minutes = 25 × blocks`.
- `TIMER`: `minutes` ∈ {30, 60, 90, 120, 150, 180} (UI default 120), `block_minutes = 30`, `break_minutes = 0`, `planned_blocks = minutes / 30`.

Lifecycle (server time is authoritative):
1. **Start.**
   - Creates the session (`ACTIVE`) and block 1: `started_at = now`, `due_at = now + block_minutes`.
   - Tasks: 0–10, each 1–200 chars, trimmed, blanks dropped.
   - Only one `ACTIVE` or `PAUSED` session per user. A second start returns 409 `You already have a study session running`.
2. **Check-in.**
   - Accepted when `due_at − 60s ≤ now ≤ due_at + 5 min`.
   - Earlier → 409 `This block isn't finished yet`. Later → the block was already marked MISSED by the sweeper → 409 `This block expired`.
   - Confirming credits `block_minutes` and grants STUDY_BLOCK XP.
   - If this was the last planned block: the session becomes `COMPLETED` and gets the STUDY_COMPLETE bonus.
   - Otherwise the next block starts with `started_at = now + break_minutes` and `due_at = started_at + block_minutes`.
   - Check-in is idempotent: confirming an already-confirmed block returns the current state with an empty delta. This holds for 2 minutes after the confirm (the request has no block index). A later retry during a break gets 409 `This block isn't finished yet`, and the UI simply refetches (lead decision 2026-10-08).
3. **Sweeper** (`@Scheduled(fixedDelay = 30_000)`, DB-driven so it survives restarts):
   - (a) For ACTIVE sessions whose current block has `due_at ≤ now` and `notified_at IS NULL`: sends a push and sets `notified_at`. Push: title `Study session`, body `Block done! Check in to keep your XP.`, url `/learn`. Use `WebPushSender.sendToUser(userId, PushPayload.of(...), 300)`.
   - (b) For ACTIVE sessions where `now > due_at + 5 min`: block → `MISSED` (0 XP), session → `PAUSED`, `next_checkin_due_at = null`. If the missed block was the last planned block, the session goes straight to `EXPIRED` with `ended_at = now`, because there is nothing left to resume. A missed block uses up one planned block: resume starts block `current_block + 1`, so a session with a missed block can never earn STUDY_COMPLETE.
   - (c) For PAUSED sessions paused more than 30 min: → `EXPIRED`, `ended_at = now`.
4. **Resume** (PAUSED only): a new block starts now, and the session becomes ACTIVE.
5. **End** (ACTIVE or PAUSED):
   - If the current block is RUNNING with ≥10 elapsed minutes, it becomes `PARTIAL` with STUDY_PARTIAL XP. Otherwise the block is discarded.
   - The session becomes `ENDED`.
6. **Tasks** (decided by Ryan 2026-10-08 after the security review): `PATCH done=true|false` sets or clears `done_at`. A task is **payable** when it's done, at position 0–4, ticked ≥5 min after `started_at`, and not yet paid. Payable tasks are paid **immediately on tick** if `session.credited_minutes > 0`. Otherwise they stay pending and are all paid when the session first gets credited minutes (a CONFIRMED or PARTIAL block), in position order. A session that ends with 0 credited minutes pays no task XP. Each payment respects the daily cap of 10 paid tasks per `local_date` (tasks with `xp_awarded > 0` across the user's sessions on that date) and the day factor. Unticking never revokes XP, and the dedupe key stops a re-tick from paying twice.

Daily diminishing returns (decided by Ryan 2026-10-07: applies to **all** study XP):
- Sum the credited minutes of the user's blocks on the same `local_date` before this block.
- Minutes up to 240 earn the full rate, 240–360 earn half rate, and anything beyond earns 0 XP. This applies to STUDY_BLOCK and STUDY_PARTIAL.
- STUDY_COMPLETE and STUDY_TASK use a single factor taken from the day's credited minutes at the moment of the grant (including the block just credited): 1.0 if ≤ 240, 0.5 if ≤ 360, else 0. Round half-up after the multiplier and the factor.
- Minutes are still recorded, and they still count for hours badges and streaks.

Streaks:
- `local_date` is the session start date in the user's **progress zone** (§4a), not the live `users.timezone`.
- A day **qualifies** when the credited minutes of that `local_date` total ≥15.
- When a day first qualifies:
  - If `streak_last_date == day`, nothing changes.
  - If `streak_last_date == day − 1`, then `streak_current += 1`.
  - Otherwise `streak_current = 1`.
  - Then `streak_best = max(...)` and `streak_last_date = day`.
  - If `streak_current % 7 == 0`, grant a chest: source `STREAK`, source_ref `streak:{day}`.
- **Effective current streak** (for display and the multiplier): `streak_current` if `streak_last_date` is today or yesterday in the user's zone, else 0.

Other limits:
- `resume` itself expires a PAUSED session whose `paused_at` is more than 30 min ago (status EXPIRED, `ended_at = now`) and returns 409 `This session expired`. It doesn't rely on the sweeper having run.
- STUDY_BLOCK and STUDY_PARTIAL are rounded half-up **once**, after the multiplier and the curve, not after each step.
- Max 8 blocks / 200 minutes.
- Check-in, task and run endpoints share a per-user limiter: 60 requests/min → 429.

### 4a. Progress zone (decided by Ryan 2026-10-08 after the security review)

All progress date math uses a per-user **progress zone** stored on `user_progress`, not the live `users.timezone`. That covers session and run `local_date`, streaks, the effective streak, the streak week, the chest daily limits, the daily XP curve and the flashcard daily cap.
- `ProgressService.progressZone(progress, user)` returns the zone. Call it only while holding the `findForUpdate` lock; read-only paths may read it without updating it.
  - If `progress_zone` is null: adopt `UserTimeZones.zoneFor(user)`. Set `progress_zone_changed_at = now` only if `users.timezone` is non-null. If the user has no reported zone yet, the fallback is adopted with `progress_zone_changed_at` left null, so their first real reported zone is adopted immediately (lead decision 2026-10-08; safe because a timezone can't be reset to null).
  - Else if the live zone differs from `progress_zone` and `now − progress_zone_changed_at ≥ 7 days`: adopt the live zone and set `progress_zone_changed_at = now`.
  - Otherwise keep `progress_zone`.
- This means a timezone switch can't fake a new day, while a user who moves or travels gets their new zone within a week.

## 5. Flashcard runs

- `POST /api/flashcard-sets/{id}/runs {mode}` with `mode` ∈ `REVIEW | LEARN | MEMORY | MATCH`.
  - The set must be viewable by the caller, using the same rule the set page uses. Otherwise 404.
  - Max 30 run starts per user per rolling hour, else 429.
- `POST /api/flashcard-runs/{runId}/complete {results:[{cardId, correct}]}` validates:
  - The run is the caller's (404) and not already completed (409).
  - It completes within 3 h of `started_at` (400).
  - Card ids are distinct and belong to the run's set (400).
- XP:
  - `base = 2 × min(cardCount, 40)`.
  - `+20` if mode ∈ {REVIEW, LEARN} and `correct / cardCount ≥ 0.8`.
  - 0 if `cardCount < 5` (reason `TOO_FEW`).
  - 0 if `completed_at − started_at < minSeconds × cardCount` (reason `TOO_FAST`), where `minSeconds` is **1 for MATCH** and 2 for REVIEW, LEARN and MEMORY (decided by Ryan 2026-10-07).
  - Repeat factor for the same set on the same `local_date`: count only that day's earlier runs of the set that **earned XP** (`xp_awarded > 0`; decided by Ryan 2026-10-07). With 0 such runs the factor is 1.0, with 1 it's 0.5 (`REDUCED`), and with 2 or more it's 0 (`REPEAT`). Runs rejected as TOO_FAST or TOO_FEW don't use up the full-XP run.
  - Daily cap: total FLASHCARD_RUN XP per `local_date` ≤ 300 (`DAILY_CAP`, partial grant allowed).
  - Otherwise the reason is `FULL`.
- The response always includes the per-card summary, even with 0 XP, so the UI can show right/wrong.
- Chest: 10% chance when `cardCount ≥ 10` and XP > 0, max 1 `FLASHCARD` chest per user per `local_date`. The limit is counted with `chests.local_date` = the run's `local_date`, never `created_at`. Source_ref `run:{runId}`.

## 6. Data model: exact DDL (db-developer)

`V40__user_progress.sql`
```sql
CREATE TABLE user_progress (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    xp BIGINT NOT NULL DEFAULT 0 CHECK (xp >= 0),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    coins INT NOT NULL DEFAULT 0 CHECK (coins >= 0),
    streak_current INT NOT NULL DEFAULT 0,
    streak_best INT NOT NULL DEFAULT 0,
    streak_last_date DATE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO user_progress (user_id) SELECT id FROM users;

CREATE TABLE xp_events (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(32) NOT NULL,
    amount INT NOT NULL CHECK (amount >= 0),
    dedupe_key VARCHAR(128) UNIQUE,
    ref_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_xp_events_user_source_created ON xp_events(user_id, source, created_at);

CREATE TABLE coin_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount INT NOT NULL,
    reason VARCHAR(32) NOT NULL,
    ref VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_coin_transactions_user_created ON coin_transactions(user_id, created_at);
```

`V41__badges.sql`
```sql
CREATE TABLE badges (
    code VARCHAR(48) PRIMARY KEY,
    category VARCHAR(16) NOT NULL,
    title VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    image_key VARCHAR(128) NOT NULL,
    price_coins INT CHECK (price_coins IS NULL OR price_coins > 0),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_badges (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    badge_code VARCHAR(48) NOT NULL REFERENCES badges(code),
    source VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    featured_slot SMALLINT CHECK (featured_slot BETWEEN 1 AND 3),
    UNIQUE (user_id, badge_code)
);
CREATE UNIQUE INDEX uq_user_badges_featured ON user_badges(user_id, featured_slot) WHERE featured_slot IS NOT NULL;
```
Plus `INSERT INTO badges` seed rows for every code in §8. `image_key = '<code>.webp'`, and `sort_order` ascending within each category, in steps of 10. `user_badges.source` ∈ `EARNED | PURCHASED | CHEST`.

`V42__chests.sql`
```sql
CREATE TABLE chests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source VARCHAR(24) NOT NULL,
    source_ref VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    opened_at TIMESTAMPTZ,
    loot_coins INT,
    loot_xp INT,
    loot_badge_code VARCHAR(48) REFERENCES badges(code),
    UNIQUE (user_id, source, source_ref)
);
CREATE INDEX idx_chests_user_unopened ON chests(user_id) WHERE opened_at IS NULL;
```
`source` ∈ `LEVEL | STREAK | SESSION | FLASHCARD`.

`V43__study_sessions.sql`
```sql
CREATE TABLE study_sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mode VARCHAR(16) NOT NULL,
    planned_blocks INT NOT NULL CHECK (planned_blocks BETWEEN 1 AND 8),
    block_minutes INT NOT NULL,
    break_minutes INT NOT NULL,
    planned_minutes INT NOT NULL CHECK (planned_minutes BETWEEN 25 AND 200),
    status VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    paused_at TIMESTAMPTZ,
    local_date DATE NOT NULL,
    credited_minutes INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.00,
    current_block INT NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX uq_study_sessions_one_open ON study_sessions(user_id) WHERE status IN ('ACTIVE', 'PAUSED');
CREATE INDEX idx_study_sessions_user_started ON study_sessions(user_id, started_at DESC);
CREATE INDEX idx_study_sessions_user_date ON study_sessions(user_id, local_date);

CREATE TABLE study_session_blocks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    block_index INT NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    notified_at TIMESTAMPTZ,
    confirmed_at TIMESTAMPTZ,
    status VARCHAR(16) NOT NULL,
    credited_minutes INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    UNIQUE (session_id, block_index)
);
CREATE INDEX idx_study_session_blocks_running_due ON study_session_blocks(due_at) WHERE status = 'RUNNING';

CREATE TABLE study_session_tasks (
    id BIGSERIAL PRIMARY KEY,
    session_id BIGINT NOT NULL REFERENCES study_sessions(id) ON DELETE CASCADE,
    position INT NOT NULL,
    text VARCHAR(200) NOT NULL,
    done_at TIMESTAMPTZ,
    xp_awarded INT NOT NULL DEFAULT 0
);
CREATE INDEX idx_study_session_tasks_session ON study_session_tasks(session_id);
```
- Session `status` ∈ `ACTIVE | PAUSED | COMPLETED | ENDED | EXPIRED`.
- Block `status` ∈ `RUNNING | CONFIRMED | MISSED | PARTIAL`.
- Session `mode` ∈ `POMODORO | TIMER`.

`V44__flashcard_runs.sql`
```sql
CREATE TABLE flashcard_runs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_id BIGINT REFERENCES flashcard_sets(id) ON DELETE SET NULL,
    mode VARCHAR(16) NOT NULL,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    local_date DATE NOT NULL,
    card_count INT NOT NULL DEFAULT 0,
    correct_count INT NOT NULL DEFAULT 0,
    xp_awarded INT NOT NULL DEFAULT 0,
    xp_reason VARCHAR(16),
    results_json TEXT
);
CREATE INDEX idx_flashcard_runs_user_date ON flashcard_runs(user_id, local_date);
CREATE INDEX idx_flashcard_runs_user_started ON flashcard_runs(user_id, started_at);
```

`V45__progress_zone_and_chest_date.sql` (decided by Ryan 2026-10-08 after the security review)
```sql
ALTER TABLE user_progress ADD COLUMN progress_zone VARCHAR(64);
ALTER TABLE user_progress ADD COLUMN progress_zone_changed_at TIMESTAMPTZ;
ALTER TABLE chests ADD COLUMN local_date DATE;
CREATE INDEX idx_chests_user_source_date ON chests(user_id, source, local_date);
```
Entity fields: `UserProgress.progressZone` (String), `UserProgress.progressZoneChangedAt` (Instant), `Chest.localDate` (LocalDate).

### Entities and repositories (db-developer owns these files)

| Package | Entity → table | Enums (same package) | Repository |
|---|---|---|---|
| `progress` | `UserProgress` → user_progress (`@Id Long userId`, no generated id) | none | `UserProgressRepository` |
| `progress` | `XpEvent` → xp_events | `XpSource` | `XpEventRepository` |
| `progress` | `CoinTransaction` → coin_transactions | `CoinReason` (`LEVEL_UP, CHEST, PURCHASE`) | `CoinTransactionRepository` |
| `progress` | `Badge` → badges (`@Id String code`) | `BadgeCategory` (`LEVEL, SOCIAL, TENURE, STUDY, FLASHCARDS, COSMETIC`) | `BadgeRepository` |
| `progress` | `UserBadge` → user_badges | `BadgeSource` | `UserBadgeRepository` |
| `progress` | `Chest` → chests | `ChestSource` | `ChestRepository` |
| `studysession` | `StudySession` → study_sessions | `StudySessionMode`, `StudySessionStatus` | `StudySessionRepository` |
| `studysession` | `StudySessionBlock` → study_session_blocks | `StudyBlockStatus` | `StudySessionBlockRepository` |
| `studysession` | `StudySessionTask` → study_session_tasks | none | `StudySessionTaskRepository` |
| `flashcard` | `FlashcardRun` → flashcard_runs | `FlashcardRunMode` (`REVIEW, LEARN, MEMORY, MATCH`) | `FlashcardRunRepository` |

- FK columns are `@ManyToOne(fetch = LAZY)` to `User` / `StudySession` / `FlashcardSet` / `Badge`, as in `FlashcardSet.java`.
- Enums use `@Enumerated(EnumType.STRING)` with a `length` matching the VARCHAR.
- `multiplier` is a `BigDecimal` with `precision = 3, scale = 2`.

Repository methods the backend relies on. Names are fixed; db-developer may add more, but not rename these:
- `UserProgressRepository`:
  - `@Modifying @Query(nativeQuery) int insertIfMissing(Long userId)`, using `INSERT ... ON CONFLICT DO NOTHING`.
  - `@Lock(PESSIMISTIC_WRITE) @Query Optional<UserProgress> findForUpdate(Long userId)`.
- `XpEventRepository` (plus, in the V45 round, `boolean existsByUserIdAndSourceNot(Long userId, XpSource source)` for the friend-XP check):
  - `boolean existsByDedupeKey(String key)`.
  - `long countByUserIdAndSourceAndCreatedAtAfter(Long userId, XpSource source, Instant after)`.
  - `@Query int sumAmountByUserIdAndSourceAndCreatedAtBetween(Long userId, XpSource source, Instant from, Instant to)`, which returns 0 when there are no rows.
- `BadgeRepository`: `List<Badge> findByActiveTrueOrderByCategoryAscSortOrderAsc()`.
- `UserBadgeRepository`:
  - `List<UserBadge> findByUserId(Long userId)`.
  - `boolean existsByUserIdAndBadgeCode(Long userId, String code)`.
  - `List<UserBadge> findByUserIdAndFeaturedSlotNotNullOrderByFeaturedSlot(Long userId)`.
  - `long countByUserId(Long userId)`.
- `ChestRepository` (plus, in the V45 round, `long countByUserIdAndSourceAndLocalDate(Long userId, ChestSource source, LocalDate d)`):
  - `List<Chest> findByUserIdAndOpenedAtIsNullOrderByCreatedAt(Long userId)`.
  - `Optional<Chest> findByIdAndUserId(Long id, Long userId)`.
  - `@Modifying @Query int markOpened(Long id, Long userId, Instant at)`, which only updates rows where `opened_at IS NULL`.
  - `boolean existsByUserIdAndSourceAndSourceRef(...)`.
  - `long countByUserIdAndSourceAndCreatedAtBetween(...)`.
- `StudySessionRepository`:
  - `Optional<StudySession> findFirstByUserIdAndStatusIn(Long userId, Collection<StudySessionStatus> s)`.
  - `Optional<StudySession> findByIdAndUserId(Long id, Long userId)`.
  - `Slice<StudySession> findByUserIdOrderByStartedAtDesc(Long userId, Pageable p)`.
  - `@Query int sumCreditedMinutesByUserIdAndLocalDate(Long userId, LocalDate d)`.
  - `@Query long sumCreditedMinutesByUserId(Long userId)`.
  - `List<StudySession> findByStatusAndPausedAtBefore(StudySessionStatus s, Instant t)`.
  - `@Query List<LocalDate> qualifiedDates(Long userId, LocalDate from, LocalDate to, int minMinutes)`, which groups by local_date having sum ≥ minMinutes.
- `StudySessionBlockRepository`:
  - `Optional<StudySessionBlock> findBySessionIdAndBlockIndex(Long sessionId, int idx)`.
  - `List<StudySessionBlock> findBySessionIdOrderByBlockIndex(Long sessionId)`.
  - `List<StudySessionBlock> findByStatusAndDueAtBeforeAndNotifiedAtIsNull(StudyBlockStatus s, Instant t)`.
  - `List<StudySessionBlock> findByStatusAndDueAtBefore(StudyBlockStatus s, Instant t)`.
- `StudySessionTaskRepository`: `List<StudySessionTask> findBySessionIdOrderByPosition(Long sessionId)`, `Optional<StudySessionTask> findByIdAndSessionId(Long id, Long sessionId)`, and (V45 round) `@Query long countPaidByUserIdAndLocalDate(Long userId, LocalDate d)`, which counts tasks with `xp_awarded > 0` whose session belongs to the user and has that `local_date`.
- `FlashcardRunRepository` (plus `long countByUserIdAndSetIdAndLocalDateAndXpAwardedGreaterThan(Long userId, Long setId, LocalDate d, int min)` for the repeat factor, and, in the V45 round, `long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqualAndXpReasonNotIn(Long userId, int min, Collection<String> reasons)` for runs badges):
  - `Optional<FlashcardRun> findByIdAndUserId(Long id, Long userId)`.
  - `long countByUserIdAndStartedAtAfter(Long userId, Instant after)`.
  - `long countByUserIdAndSetIdAndLocalDateAndCompletedAtIsNotNull(Long userId, Long setId, LocalDate d)`.
  - `@Query int sumXpByUserIdAndLocalDate(Long userId, LocalDate d)`.
  - `long countByUserIdAndCompletedAtIsNotNullAndCardCountGreaterThanEqual(Long userId, int min)`.

## 7. Coins, chests, shop

- Coins only change inside a transaction that holds `findForUpdate` on `user_progress`, and every change writes a `coin_transactions` row.
- Chest drops:
  - **LEVEL**: every 5th level.
  - **STREAK**: every time the streak reaches a multiple of 7.
  - **SESSION**: 20% chance when a session completes with `planned_minutes ≥ 50` **and every planned block was confirmed**, the same condition as STUDY_COMPLETE (lead decision 2026-10-08), max 1 SESSION chest per user per `local_date`. The limit is counted with `chests.local_date` = the session's `local_date`, never `created_at`. Source_ref `session:{id}`. LEVEL and STREAK chests store `local_date` as null, or the streak day for STREAK.
  - **FLASHCARD**: see §5.
- Open: `markOpened` must return 1. If it returns 0 and the chest exists for this user, that's 409 `Chest already opened`; otherwise 404.
- Loot is rolled at open time with one `SecureRandom`:
  - Always: `coins = 30..120` inclusive.
  - 40% chance: `xp = 50..150`.
  - 5% chance: a random active COSMETIC badge the user doesn't own, source `CHEST`. If they own every cosmetic badge, they get +100 coins instead.
  - Loot is stored on the chest row and applied in the same transaction. The XP grant uses the `CHEST` source with key `chest:{id}`.
- Purchase checks, in this order:
  1. The badge exists and is active (404).
  2. `category = COSMETIC` and `price_coins` is not null (400 `This badge can't be bought`).
  3. The user doesn't already own it (409 `You already own this badge`).
  4. `coins ≥ price` (400 `Not enough coins`).
  5. Then deduct the coins (reason `PURCHASE`, ref `badge:{code}`) and insert the `user_badges` row with source `PURCHASED`.
- Cosmetic price tiers: 300, 600 and 1200.

## 8. Badges

Criteria are code (`BadgeRules` keyed by code). Copy, art and price are DB rows that Ryan will edit later. Seed these codes. Titles and descriptions are placeholders.

| code | category | title | description | price |
|---|---|---|---|---|
| level_1 | LEVEL | Level 1 | Start your Studily journey. | |
| level_5 | LEVEL | Level 5 | Reach level 5. | |
| level_10 | LEVEL | Level 10 | Reach level 10. | |
| level_20 | LEVEL | Level 20 | Reach level 20. | |
| level_30 | LEVEL | Level 30 | Reach level 30. | |
| level_50 | LEVEL | Level 50 | Reach level 50. | |
| level_75 | LEVEL | Level 75 | Reach level 75. | |
| level_100 | LEVEL | Level 100 | Reach level 100. | |
| friends_5 | SOCIAL | Making Friends | Have 5+ friends on Studily. | |
| friends_10 | SOCIAL | Study Circle | Have 10+ friends on Studily. | |
| friends_20 | SOCIAL | Popular! | Have 20+ friends on Studily. | |
| friends_50 | SOCIAL | Campus Famous | Have 50+ friends on Studily. | |
| schoolmates_10 | SOCIAL | School Spirit | Have 10+ friends from your school. | |
| og | TENURE | OG | Joined Studily in its first two months. | |
| member_1m | TENURE | One Month In | Be a Studily member for 1 month. | |
| member_6m | TENURE | Half-Year Scholar | Be a Studily member for 6 months. | |
| member_1y | TENURE | One Year Strong | Be a Studily member for 1 year. | |
| first_session | STUDY | First Focus | Complete your first study session. | |
| streak_7 | STUDY | On Fire | Reach a 7-day study streak. | |
| streak_30 | STUDY | Unstoppable | Reach a 30-day study streak. | |
| hours_10 | STUDY | Ten Hours Deep | Study for 10 hours in sessions. | |
| hours_100 | STUDY | Centurion | Study for 100 hours in sessions. | |
| runs_10 | FLASHCARDS | Card Shark | Complete 10 flashcard runs. | |
| runs_100 | FLASHCARDS | Flashcard Master | Complete 100 flashcard runs. | |
| cosmetic_spark | COSMETIC | Spark | A little flair for your profile. | 300 |
| cosmetic_comet | COSMETIC | Comet | Streak across the leaderboard in style. | 600 |
| cosmetic_crown | COSMETIC | Crown | For the true royalty of studying. | 1200 |

Rule details:
- **Friend counts:** accepted friend requests in either direction. **schoolmates_10** counts friends with the same non-null `school_key`.
- **og:** `users.created_at < app.progress.og-cutoff` (default `2026-10-11`, env `PROGRESS_OG_CUTOFF`, start of day UTC).
- **member_*:** `created_at` plus 1, 6 or 12 months ≤ now.
- **first_session:** ≥1 session with status COMPLETED.
- **hours_*:** `sumCreditedMinutesByUserId` ≥ 600 or ≥ 6000.
- **streak_*:** `streak_best` ≥ 7 or ≥ 30.
- **runs_*:** completed runs with `card_count ≥ 5` and `xp_reason` not in (TOO_FAST, TOO_FEW) (lead decision 2026-10-08, matching Ryan's "only XP-eligible runs count" rule).

When to evaluate:
- `BadgeService.evaluate(userId)` checks every non-cosmetic rule and inserts any missing badges (source `EARNED`). It returns the new ones.
- It runs at the end of every grant (§3), after a friendship is accepted (for both users), and on `GET /api/progress/me`, which catches tenure badges and existing users' retroactive badges.

Featured badges: max 3, owned only, slots 1–3 in the order given.

Art:
- `imageUrl = app.progress.badge-base-url + "/" + image_key`. The default is `https://badges.studily.ca/badges/v3`, overridable with env `BADGE_ASSET_BASE_URL`.
- Locked badges use the same image with a CSS silhouette.

## 9. API contract (backend implements, UI consumes, both match exactly)

JSON uses camelCase. Errors keep the existing `GlobalExceptionHandler` shape. All endpoints require auth. Endpoints under `/api/users/{id}/...` return 404 for unknown users. `/api/users/*/progress` and `/api/users/*/badges` also require a **verified email**, enforced the same way as the existing profile and schedule endpoints (add them to `EmailVerificationFilter`).

```ts
type BadgeCategory = "LEVEL" | "SOCIAL" | "TENURE" | "STUDY" | "FLASHCARDS" | "COSMETIC";
interface BadgeDto { code: string; category: BadgeCategory; title: string; description: string; imageUrl: string;
  priceCoins: number | null; owned: boolean; acquiredAt: string | null; featuredSlot: number | null; }
interface StreakDto { current: number; best: number; multiplier: number; }
interface ProgressDto { level: number; xp: number; xpIntoLevel: number; xpForNext: number; coins: number;
  streak: StreakDto; featuredBadges: BadgeDto[]; badgeCount: number; badgeTotal: number; unopenedChests: number; }
interface PublicProgressDto { userId: number; level: number; xp: number; xpIntoLevel: number; xpForNext: number;
  streakCurrent: number; featuredBadges: BadgeDto[]; badgeCount: number; badgeTotal: number; }
interface ChestDto { id: number; source: "LEVEL" | "STREAK" | "SESSION" | "FLASHCARD"; createdAt: string;
  openedAt: string | null; loot: { coins: number; xp: number; badge: BadgeDto | null } | null; }
interface ProgressDelta { xpGained: number; levelBefore: number; levelAfter: number; xp: number;
  xpIntoLevel: number; xpForNext: number; coinsGained: number; coins: number;
  newBadges: BadgeDto[]; chests: ChestDto[]; }
```
`badgeTotal` counts active non-cosmetic badges plus any cosmetic badges the user owns.

| Method & path | Body | 200 response | Errors |
|---|---|---|---|
| GET `/api/progress/me` | | `ProgressDto` | |
| GET `/api/users/{id}/progress` | | `PublicProgressDto` (no coins) | 404 |
| GET `/api/badges` | | `BadgeDto[]` for the caller (all active badges, `owned` flags) | |
| GET `/api/users/{id}/badges` | | `BadgeDto[]` for that user | 404 |
| PUT `/api/me/featured-badges` | `{codes: string[]}` | `BadgeDto[]` (featured, in slot order) | 400 >3, duplicate, or not owned |
| POST `/api/badges/{code}/purchase` | | `{badge: BadgeDto, coins: number}` | 404, 400, 409 (§7) |
| GET `/api/chests` | | `ChestDto[]` unopened | |
| POST `/api/chests/{id}/open` | | `{chest: ChestDto, delta: ProgressDelta}` | 404, 409 |

Study session types:
```ts
type StudySessionMode = "POMODORO" | "TIMER";
type StudySessionStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "ENDED" | "EXPIRED";
interface StudySessionTaskDto { id: number; position: number; text: string; done: boolean; }
interface StudySessionBlockDto { index: number; status: "RUNNING" | "CONFIRMED" | "MISSED" | "PARTIAL";
  startedAt: string; dueAt: string; creditedMinutes: number; xpAwarded: number; }
interface StudySessionDto { id: number; mode: StudySessionMode; status: StudySessionStatus; plannedBlocks: number;
  blockMinutes: number; breakMinutes: number; plannedMinutes: number; startedAt: string; endedAt: string | null;
  currentBlock: number; checkinOpensAt: string | null; checkinClosesAt: string | null;
  creditedMinutes: number; xpAwarded: number; multiplier: number;
  tasks: StudySessionTaskDto[]; blocks: StudySessionBlockDto[]; serverNow: string; }
interface StudySessionSummaryDto { id: number; mode: StudySessionMode; status: StudySessionStatus; startedAt: string;
  endedAt: string | null; plannedMinutes: number; creditedMinutes: number; xpAwarded: number;
  tasksDone: number; tasksTotal: number; }
interface StudySessionResult { session: StudySessionDto; delta: ProgressDelta; }
interface StreakWeekDto { current: number; best: number; multiplier: number; minutesToday: number; today: string;
  week: { date: string; label: "Su" | "M" | "Tu" | "W" | "Th" | "F" | "Sa"; qualified: boolean; isToday: boolean }[]; }
```
- `serverNow` lets the client correct for clock skew in its countdown.
- `checkinOpensAt` / `checkinClosesAt` describe the current RUNNING block's window, or are null.
- `week` runs Sunday → Saturday of the current week in the user's zone.

| Method & path | Body | 200 response | Errors |
|---|---|---|---|
| POST `/api/study-sessions` | `{mode, blocks?, minutes?, tasks: string[]}` | `StudySessionDto` (201) | 400, 409 |
| GET `/api/study-sessions/active` | | `StudySessionDto`, or 204 if none | |
| POST `/api/study-sessions/{id}/checkin` | | `StudySessionResult` | 404, 409 |
| POST `/api/study-sessions/{id}/resume` | | `StudySessionDto` | 404, 409 not paused |
| PATCH `/api/study-sessions/{id}/tasks/{taskId}` | `{done: boolean}` | `StudySessionResult` | 404, 409 session finished |
| POST `/api/study-sessions/{id}/end` | | `StudySessionResult` | 404, 409 already finished |
| GET `/api/study-sessions?page=0&size=20` | | `PageResponse<StudySessionSummaryDto>` (`{items, hasMore}`), newest first, size ≤ 50 | |
| GET `/api/study-sessions/streak` | | `StreakWeekDto` | |

Flashcard run types:
```ts
type FlashcardRunMode = "REVIEW" | "LEARN" | "MEMORY" | "MATCH";
type XpReason = "FULL" | "REDUCED" | "REPEAT" | "DAILY_CAP" | "TOO_FAST" | "TOO_FEW";
interface FlashcardRunStart { runId: number; startedAt: string; }
interface FlashcardRunResult { runId: number; mode: FlashcardRunMode; cardCount: number; correctCount: number;
  xpAwarded: number; xpReason: XpReason; cards: { cardId: number; front: string; back: string; correct: boolean }[];
  delta: ProgressDelta; }
```
| Method & path | Body | 200 response | Errors |
|---|---|---|---|
| POST `/api/flashcard-sets/{id}/runs` | `{mode}` | `FlashcardRunStart` | 404, 429 |
| POST `/api/flashcard-runs/{runId}/complete` | `{results: {cardId: number; correct: boolean}[]}` | `FlashcardRunResult` | 400, 404, 409 |

Backend layout (backend-developer):
- **`progress/`**:
  - `LevelMath` (static: `xpToNext`, `totalFor`, `levelFor`).
  - `ProgressService`:
    - `ensure(userId)`.
    - `grantXp(userId, XpSource, amount, dedupeKey, refId)` returns a `ProgressDelta` accumulator.
    - `grantChest(...)`, `me()`, `publicFor(userId)`, `multiplierFor(streak)`, `effectiveStreak(progress, zone)`.
  - `BadgeService` + `BadgeRules`, `ChestService`, `ProgressDtos` (records above).
  - `ProgressController` (`/api/progress/me`, `/api/users/{id}/progress`).
  - `BadgeController` (`/api/badges`, `/api/users/{id}/badges`, `/api/me/featured-badges`, purchase).
  - `ChestController`.
- **`studysession/`**: `StudySessionService`, `StudySessionController`, `StudySessionSweeper`, `StudySessionDtos`.
- **`flashcard/`**: `FlashcardRunService`, `FlashcardRunController`, `FlashcardRunDtos`.
- **Hooks:**
  - `FriendService.accept` calls `progressService.onFriendshipAccepted(requesterId, addresseeId)`, which grants FRIEND XP to both and evaluates badges for both.
  - `SecurityConfig` CSP `img-src` gains `https://badges.studily.ca`.
  - `application.properties` gains `app.progress.badge-base-url=${BADGE_ASSET_BASE_URL:https://badges.studily.ca/badges/v3}` and `app.progress.og-cutoff=${PROGRESS_OG_CUTOFF:2026-10-11}`.
- **Locking:** any method that changes xp, level, coins or streak calls `findForUpdate` first, after `insertIfMissing`. The dedupe check (`existsByDedupeKey`) happens under that lock, and the unique constraint is the backstop.

## 10. UI (ui-designer)

Follow the Studily look:
- Use tokens from `index.css` (`--accent`, `--surface`, `--surface-hi`, `--line`, `--green`, `--red`, `text-fg/-fg-2/-fg-3`), not hardcoded colours.
- `.card` has **no** backdrop-filter; `.glass` goes only on floating surfaces.
- Remember the Tailwind layer gotcha: utilities can't override the unlayered `.input/.btn/.card`, so use inline style.
- Every new animation class goes into the `prefers-reduced-motion` allowlist near the end of `index.css`.
- It must work in light, dark, and Classic look.
- **Responsive is mandatory**: 375px wide with a 16px gutter and no horizontal scroll, up to desktop. Tap targets ≥ 40px.
- Guest/demo mode (`isGuestMode()` in `lib/api.ts`): progress UI shows a sign-in prompt instead of calling the new endpoints.
- New types go into `types/index.ts`, copied from §9.

**Shared** (`features/progress/`):
- `useProgress.ts` holds the react-query hooks. Keys: `["progress","me"]`, `["progress",userId]`, `["badges",userId|"me"]`, `["chests"]`, `["study-session","active"]`, `["study-session","streak"]`, `["study-session","history"]`.
- `lib/progressDelta.ts` exports `applyDelta(delta, qc)`, which every reward response passes through:
  - invalidates progress queries,
  - toasts `+N XP`,
  - opens `LevelUpModal` when `levelAfter > levelBefore` (shows the new level and coins gained),
  - toasts each new badge,
  - offers to open new chests.
- Components: `LevelPill` (`Lv 13`), `XpBar`, `BadgeTile`, `BadgeGrid`, `ChestModal`, `LevelUpModal`.
  - `XpBar`: `724 / 1100 XP`, fill width = `xpIntoLevel / xpForNext`, animated.
  - `BadgeTile`: lit when owned. When locked: `filter: grayscale(1) brightness(0.25)` plus a lock glyph. Tap or hover opens a popover with title, description, how to earn it, and the price for cosmetics. Uses a fallback silhouette if the image fails to load.
  - `ChestModal`: tap to open, then reveal coins, XP and badge.

**Profile** (layout revised by Ryan, 2026-10-08; "display" means a card/container). This applies to `features/profile/ProfilePage.tsx` and, with the same structure, `features/friends/UserProfilePage.tsx`. There are exactly **four cards**:
1. **Profile card**: avatar, name, @username, email (own profile only), bio, **and** the progress, all in **one** card. The progress part is LevelPill + XpBar (`724 / 1100 XP`), a streak flame if `current > 0`, up to 3 featured badges **centered**, and the "All badges (12/31)" link. No separate progress card, no trophy icon, no "Progress" title. The unopened-chest button can live in this card on the own profile.
2. **Education card**, titled "Education": school, major, year. It's its own card, under the profile card.
3. **Current semester schedule card**: the existing schedule card.
4. **Shared flashcard sets card**: the existing "your shared flashcard sets" section.
- **Desktop (≥ lg, or md if it fits):** two columns. Left: Profile card, then Education card. Right: Current semester schedule, then Shared flashcard sets. Widen the page container to fit two columns; it's currently `max-w-lg`.
- **Mobile:** the cards stack in order 1 → 2 → 3 → 4. Progress stays merged into the profile card.
- **Coins** are no longer shown in the profile view. They go in the **app header** (`components/Layout.tsx`) for signed-in, non-guest users: a coin icon plus the balance, linking to `/profile/badges?tab=shop`, readable at 375px.

**Badge pages:**
- `BadgesPage` at routes `/profile/badges` (own) and `/users/:userId/badges` (wrapped in `VerifyGate`, like `/users/:userId`).
- Own page: a `SegmentedToggle` with Collection | Shop.
  - Collection: grouped by category, owned badges first within each group, and picking up to 3 featured badges (saves via PUT).
  - Shop: cosmetic badges with price and a Buy button (confirm via `lib/confirm.tsx`), plus the coin balance.
- Other users' page: Collection only, read-only.

**/learn** (`features/learn/LearnPage.tsx`, revised by Ryan, 2026-10-08):
- The nav label "Learn" becomes **"Study"** in the app header (desktop) and the mobile footer. The route stays `/learn`.
- The page order is: the **Study sessions** card first. Then the old page heading ("Learn" plus "Study tools to help you master your courses.") moves **under** the Study sessions card, as the heading of the tools grid. Then the tools grid.
- The Study sessions card has to stand out: a real, prominent **centered title "Study sessions"** with **no logo/icon next to the title**. Give it stronger visual weight than a normal card (e.g. a larger title, an accent-tinted surface or border, more padding), staying within the tokens and the glass/neu rules.
The card is built from `features/learn/sessions/`:
- **`StudySessionsPanel`**: the centered title, a "Start study session" button (or `ActiveSessionCard` when one is open), `StreakWeek`, and the last 3 sessions with a "See all" link to `/learn/sessions`.
- **`StartSessionModal`** (`components/Modal`):
  - "How long will I study?" uses a SegmentedToggle: Pomodoro | Timer.
    - Pomodoro: a stepper for 1–8 blocks of 25/5 (default 5), with total time shown.
    - Timer: chips for 30m–3h (default 2h).
  - "What do I need to get done?" is a checklist editor (add, remove; max 10; Enter adds a row; mobile-keyboard safe, see `lib/keyboardDock.ts`).
  - A short line explains that check-ins are needed at the end of each block to earn XP. Then a Start button.
- **`ActiveSessionCard`**:
  - Countdown to the current block's `dueAt`, corrected with `serverNow`. Reuse `formatMs` and `pomodoroColor` from `lib/pomodoro.ts` and `playRingtone` from `lib/ringtones.ts` for the block-end sound.
  - A block progress row and a big "Check in" button, enabled during the check-in window and pulsing then.
  - Paused state with a Resume button, task checkboxes (PATCH), and an End session button with confirm.
  - Do **not** drive the existing pomodoro store; the backend sends the block-end push.
- **`StreakWeek`**: seven circles labelled `Su M Tu W Th F Sa`, lit when `qualified`, with today ringed. Next to them, the Studily logo (`/studily-3a.svg`) with a flame animation when `current > 0` (grey when 0), the streak count, and a `×1.3` multiplier chip.
- **`SessionHistoryList`** and **`SessionHistoryPage`** (`/learn/sessions`): infinite "Load more" on `PageResponse`. Rows show date, mode, credited minutes, XP, tasks done/total and a status chip.
- **Naming:** `features/learn/StudySession.tsx` already exists (the SM-2 flashcard review). Don't create another file with that name, and don't rename it.

**Flashcard runs:**
- Each mode starts a run on mount or round start (`POST /flashcard-sets/{id}/runs`) and completes it when the run finishes.
  - `StudySession.tsx` (REVIEW): AGAIN counts as wrong.
  - `LearnMode.tsx` (LEARN).
  - `MemoryGame.tsx` (MEMORY) and `SpeedMatch.tsx` (MATCH): every matched card counts as correct, and the summary shows moves or time instead of right/wrong.
- A new `features/learn/RunSummary.tsx` shows XP gained (with `xpReason` explained in plain words when reduced), a right/wrong list with front/back, and Study again / Done buttons.
- Runs are skipped for guests and for sets with fewer than 5 cards.

**Routes** go in `App.tsx`: `/profile/badges`, `/users/:userId/badges`, `/learn/sessions`.

## 11. File ownership (parallel safety)

| Owner | May edit |
|---|---|
| db-developer | `src/main/resources/db/migration/V40__*.sql`–`V44__*.sql`; the entity, enum and repository classes listed in §6 |
| backend-developer | everything else under `src/main/**`, including edits to existing repositories, `FriendService`, `SecurityConfig`, `application.properties` |
| test-engineer | `src/test/**` |
| ui-designer | `frontend/src/**` except the release-docs files below |
| release-docs | `frontend/src/features/static/ChangelogPage.tsx`, new `frontend/src/features/progress/ProgressWhatsNew.tsx`, `frontend/src/components/Banners.tsx`, `learning/**`, `.claude/specs/social-progress.md` §12 only |
| platform-ops | Cloudflare/R2 resources, `scripts/badges/**`, placeholder art under `scripts/badges/placeholders/`, `.claude/specs/social-progress.md` §12 only |
| reviewer, security-reviewer, qa-verifier | nothing (read-only). qa-verifier may only add `127.0.0.1:5173` to the local `CORS_ORIGINS` env, never in committed files |

Mounting `ProgressWhatsNew` belongs to ui-designer, because `App.tsx` and `Layout.tsx` are theirs. release-docs states the mount point in its HANDOFF.

## 12. Ops runbook (platform-ops fills in; release-docs appends release notes)

### Badge art hosting (platform-ops)

**What exists (created 2026-10-07).**
- R2 bucket `studily-badges` on Ryan's Cloudflare account (`a7930b03a95082547ead7123d5981afe`), Standard storage class.
- Custom domain `badges.studily.ca` (zone `studily.ca`, `0a1b7f8fd952c5b1f00c3dbddcac1ad9`), min TLS 1.2, ownership and SSL `active`. Cloudflare added the proxied DNS record for it. No other DNS record was touched.
- The `r2.dev` public URL is **off**. The custom domain is the only public way in.
- Key layout: `badges/v3/<code>.webp`, so the public URL is `https://badges.studily.ca/badges/v3/<code>.webp`. That's exactly `app.progress.badge-base-url + "/" + image_key` with the code default.
- Every object is uploaded with `Content-Type: image/webp` and `Cache-Control: public, max-age=31536000, immutable`.
- Placeholder art for all 27 §8 codes is uploaded. The source files are `scripts/badges/placeholders/<code>.webp`: 256×256, transparent background, a rounded tile in the category colour with a short label. Verified: `level_1`, `level_100`, `cosmetic_crown` and `schoolmates_10` return 200 `image/webp`, and an unknown key returns 404.

**Uploading real art later.**
1. Put the final files in one folder, each named `<code>.webp` to match `badges.image_key`. Square artwork, 256×256 or larger, with a transparent background so the locked-badge CSS silhouette (`grayscale(1) brightness(0.25)`) reads as a shape.
2. From the repo root, with a valid wrangler login (`npx wrangler@latest whoami`), run `scripts/badges/upload.sh <dir>`.
3. The script uploads every `*.webp` in that folder to `studily-badges/badges/v3/<filename>` and skips other files.
4. Optional overrides: `BADGE_BUCKET` (default `studily-badges`) and `BADGE_PREFIX` (default `badges/v3`).

**Cache busting.** The objects are `immutable` with a one-year max-age, so browsers and the Cloudflare edge won't re-fetch a key that was overwritten. When real art replaces the placeholders:
1. Upload to a new prefix: `BADGE_PREFIX=badges/v3 scripts/badges/upload.sh <dir>`.
2. Point the app at it: `BADGE_ASSET_BASE_URL=https://badges.studily.ca/badges/v3` on Railway.
3. Leave `v1` in place, since old pages and cached API responses still reference it.

A single badge added later can go into the current prefix under its new code, because that key has never been cached.

**Railway variables at merge time (optional).** The code defaults (§8, §9 `application.properties`) already point at the right values, so the deploy works with neither set. Set them only to pin the values explicitly or to change them later without a code change. Use the dashboard (app service → Variables → New Variable) or the Railway CLI, linked to the production app service:
```
railway variables --set "BADGE_ASSET_BASE_URL=https://badges.studily.ca/badges/v3"
railway variables --set "PROGRESS_OG_CUTOFF=2026-10-11"
```
Each variable change triggers a redeploy, so set both together, before or alongside the merge. `PROGRESS_OG_CUTOFF` only needs setting if the OG window moves (for example, if launch slips past 2026-10-11).

**CSP.** The backend adds `https://badges.studily.ca` to `img-src` (§9 hooks). Without it the browser blocks every badge image even though the bucket serves fine.

**Firewall risk.** `badges.studily.ca` is a subdomain of `studily.ca`. School firewalls that sinkhole `studily.ca` as a newly registered domain (Palo Alto NRD) block the subdomain too, but they already block the app itself, so badges add no new failure mode. The recategorization fix for `studily.ca` covers both. Badge tiles already fall back to a silhouette if the image fails to load (§10).

**Local DNS gotcha.** If you look up `badges.studily.ca` before it exists, a caching resolver can hold the NXDOMAIN for up to 30 min (the zone's SOA negative TTL is 1800 s). To check the bucket while that's still cached, use `curl -sI --resolve badges.studily.ca:443:104.21.53.89 https://badges.studily.ca/badges/v3/level_1.webp` or DNS-over-HTTPS.

### Release notes (release-docs)

**What ships.** Levels and XP, study sessions with check-ins and streaks on `/learn`, badges with 3 featured on profiles, the coin shop, chests, and flashcard run summaries. The announcement copies the flashcards launch (`91fc0cc`):
- Changelog `v43` "Level up while you study", dated 2026-10-07. Change the date to the merge day.
- The banner in `Banners.tsx` (`studily.banner.progress`, links to `/learn` and opens the walkthrough) replaces the flashcards banner.
- `features/progress/ProgressWhatsNew.tsx`: 5 slides (Levels & XP, Study sessions, Badges, Chests & coins, Check-ins). It auto-opens once per device for accounts older than a day, with seen key `studily.whatsnew.progress`, and also marks `studily.whatsnew.flashcards` seen so the two never stack. ui-designer mounts it in `Layout.tsx`.
- Study site tour F10 (`learning/curriculum/study/f10-progress.html`) and 20 review cards. It isn't deployed yet.

**Left for Ryan before launch.**
- Real badge art (27 `.webp` files named by `image_key`) and final titles/descriptions. The V41 seed copy is placeholder. Flyway is forward-only, so copy edits go in a new migration, not in V41.
- The Railway vars from the runbook above (`BADGE_ASSET_BASE_URL`, `PROGRESS_OG_CUTOFF`). If launch slips past 2026-10-11, decide whether the OG cutoff moves too.
- An on-device push check-in test on the installed iOS PWA:
  1. Start a 1-block Pomodoro and lock the phone.
  2. "Block done! Check in to keep your XP." should arrive within about 30 s of the due time.
  3. Tap it, land on `/learn`, and check in.
  4. Repeat and let a block lapse. It should go MISSED, the session should go PAUSED, and Resume should work.
- Deploy the study site: from `learning/curriculum/study/`, run `npx wrangler pages deploy . --project-name studily-learn --branch main --commit-dirty=true`.

**Watch after launch (first two weeks).**
- XP per user per day. A heavy honest day is under ~1,000. The theoretical ceiling is roughly 2,500 (6 h of sessions split into short sessions, the 300 flashcard cap, 10 friends, chests). Anything higher is a bug or an exploit.
  `SELECT user_id, created_at::date d, source, SUM(amount) FROM xp_events WHERE created_at > now() - interval '7 days' GROUP BY 1,2,3 ORDER BY 4 DESC LIMIT 20;`
- Ledger audits. Both should return 0 rows:
  `SELECT p.user_id FROM user_progress p LEFT JOIN (SELECT user_id, SUM(amount) s FROM xp_events GROUP BY user_id) x USING (user_id) WHERE p.xp <> COALESCE(x.s, 0);`
  The same query with `coins` and `coin_transactions`.
- Chest open rate by source. A low rate means the open prompt isn't being found.
  `SELECT source, COUNT(*), COUNT(opened_at) FROM chests GROUP BY source;`
- Purchase errors: 4xx/5xx on `POST /api/badges/{code}/purchase` in the Railway logs. Spend should match `coin_transactions` with reason `PURCHASE`.
- The missed-block share:
  `SELECT status, COUNT(*) FROM study_session_blocks WHERE started_at > now() - interval '7 days' GROUP BY status;`
  A high MISSED share usually means pushes aren't arriving (iOS without the installed PWA), so it's a copy and onboarding fix, not a rule change.
- Sweeper health. RUNNING blocks with `due_at < now() - interval '10 minutes'` should always be 0.

## 13. Profile flairs (Ryan, 2026-10-08)

A **flair** is a decorative ring drawn around a user's avatar, **everywhere that avatar appears**. Users collect flairs and equip one at a time. They're unlocked by buying them in the shop, finding them in chests, or reaching study streaks (the fire rings). This wave lives on branch `profile-flairs`, which is cut from `social-progress`. §2 house rules apply.

### 13.1 Catalog (seed in V46; Ryan can restyle and re-price later)

| code | title | description | rarity | unlock | price | streak_days |
|---|---|---|---|---|---|---|
| ring_mint | Mint | A cool, fresh ring. | COMMON | SHOP | 250 | |
| ring_ocean | Ocean | Deep blue, calm focus. | COMMON | SHOP | 250 | |
| ring_sunset | Sunset | Warm evening gradient. | RARE | SHOP | 500 | |
| ring_gold | Gold | Polished and proud. | RARE | SHOP | 750 | |
| ring_neon | Neon Pulse | A ring that hums with light. | EPIC | SHOP | 1200 | |
| ring_aurora | Aurora | Shifting northern lights. | EPIC | SHOP | 1500 | |
| ring_prism | Prism | Found only in chests. | EPIC | CHEST | | |
| ring_galaxy | Galaxy | A rare find from a chest. | LEGENDARY | CHEST | | |
| ring_ember | Ember | Reach a 7-day study streak. | RARE | STREAK | | 7 |
| ring_blaze | Blaze | Reach a 30-day study streak. | EPIC | STREAK | | 30 |
| ring_inferno | Inferno | Reach a 100-day study streak. | LEGENDARY | STREAK | | 100 |

- Rings are **drawn in CSS** by the frontend, using a registry keyed by `code`. `image_key` is null for all of them now.
- Retire a flair with `active = false`, never by deleting it: an owned or looted flair is referenced by `user_flairs` and `chests`. This is the same as badges.
- Later, Ryan can give a flair an image (a transparent ring WebP). When `image_key` is set, the frontend draws the image instead of the CSS ring. `imageUrl = app.progress.flair-base-url + "/" + image_key`. The default base is `https://badges.studily.ca/flairs/v1` (env `FLAIR_ASSET_BASE_URL`), and art is uploaded with `BADGE_PREFIX=flairs/v1 scripts/badges/upload.sh <dir>`.
- **Unlock rules:**
  - **SHOP** flairs are bought with coins.
  - **CHEST** flairs come only from chests.
  - **STREAK** flairs unlock **permanently** when `user_progress.streak_best ≥ streak_days`. They're evaluated together with badges (§8), so existing users with a long best streak get them retroactively.
  - Flairs are never revoked.
- **Chest loot:** after the existing badge roll (§7), one more draw: `nextDouble() < 0.05`. On a hit, the user gets a random **unowned** active flair with unlock ∈ {SHOP, CHEST}, with source CHEST (`nextInt(n)` picks among the candidates, ordered by `sort_order`). If they own all of those, they get +100 coins instead. Store the result in `chests.loot_flair_code`. STREAK flairs never drop.

### 13.2 DDL: `V46__profile_flairs.sql` (db-developer)
```sql
CREATE TABLE flairs (
    code VARCHAR(48) PRIMARY KEY,
    title VARCHAR(64) NOT NULL,
    description VARCHAR(255) NOT NULL,
    rarity VARCHAR(16) NOT NULL,
    unlock VARCHAR(16) NOT NULL,
    price_coins INT CHECK (price_coins IS NULL OR price_coins > 0),
    streak_days INT CHECK (streak_days IS NULL OR streak_days > 0),
    image_key VARCHAR(128),
    sort_order INT NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE user_flairs (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    flair_code VARCHAR(48) NOT NULL REFERENCES flairs(code),
    source VARCHAR(16) NOT NULL,
    acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, flair_code)
);
CREATE INDEX idx_user_flairs_user ON user_flairs(user_id);

ALTER TABLE users ADD COLUMN equipped_flair_code VARCHAR(48) REFERENCES flairs(code) ON DELETE SET NULL;
ALTER TABLE chests ADD COLUMN loot_flair_code VARCHAR(48) REFERENCES flairs(code);
```
Plus `INSERT INTO flairs` for the 11 rows in §13.1, with `sort_order` 10, 20, … in table order.
- Enum values (stored as strings):
  - `FlairRarity` = COMMON | RARE | EPIC | LEGENDARY
  - `FlairUnlock` = SHOP | CHEST | STREAK
  - `FlairSource` = PURCHASED | CHEST | EARNED

### 13.3 Entities and repositories (db-developer)
- In package `progress`:
  - `Flair` → flairs (`@Id String code`).
  - `UserFlair` → user_flairs (`@ManyToOne(fetch = LAZY) User user`, `@ManyToOne(fetch = LAZY) Flair flair`).
  - Enums `FlairRarity`, `FlairUnlock`, `FlairSource`.
  - `FlairRepository.findByActiveTrueOrderBySortOrderAsc()`.
  - `UserFlairRepository`:
    - `List<UserFlair> findByUserId(Long userId)`
    - `boolean existsByUserIdAndFlairCode(Long userId, String code)`
    - `long countByUserId(Long userId)`
- New fields on existing entities: `User.equippedFlairCode` (String, column `equipped_flair_code`, length 48) and `Chest.lootFlairCode` (String). For this wave only, db-developer owns these two single-field additions to `user/User.java` and `progress/Chest.java`.

### 13.4 API (backend-developer implements, UI consumes)
```ts
type FlairRarity = "COMMON" | "RARE" | "EPIC" | "LEGENDARY";
type FlairUnlock = "SHOP" | "CHEST" | "STREAK";
interface FlairRef { code: string; imageUrl: string | null; }
interface FlairDto { code: string; title: string; description: string; rarity: FlairRarity; unlock: FlairUnlock;
  priceCoins: number | null; streakDays: number | null; imageUrl: string | null;
  owned: boolean; acquiredAt: string | null; equipped: boolean; }
```
- **Every user-bearing DTO that has `avatarUrl` gains `flair: FlairRef | null`**, built from `users.equipped_flair_code`. These are `user/UserDto`, all records in `friend/FriendDtos` that carry a user's avatar, and `flashcard/FlashcardDtos` (owner and creator avatars). Add a helper next to `AvatarUrls`, e.g. `user/Flairs.refOf(User, baseUrl)`, so every DTO builds it the same way.
- `ProgressDelta` gains `newFlairs: FlairDto[]`. `ChestDto.loot` gains `flair: FlairDto | null`.

| Method & path | Body | 200 response | Errors |
|---|---|---|---|
| GET `/api/flairs` | | `FlairDto[]`, all active flairs with the caller's `owned` and `equipped` | |
| POST `/api/flairs/{code}/purchase` | | `{flair: FlairDto, coins: number}` | 404 unknown or inactive; 400 `This flair can't be bought` (unlock ≠ SHOP); 409 `You already own this flair`; 400 `Not enough coins`. Checks run in that order, under `findForUpdate`. A `coin_transactions` row is written with reason PURCHASE and ref `flair:{code}`. |
| PUT `/api/me/flair` | `{code: string \| null}` | `{equipped: FlairDto \| null}` | 400 `You don't own this flair`. `null` unequips. |

- `FlairService.evaluateEarned(userId)` inserts any missing STREAK flairs (source EARNED). It runs wherever `BadgeService.evaluate` runs, and its results go into `delta.newFlairs`.
- Backend layout: `progress/FlairService`, `progress/FlairController`, `progress/FlairDtos` (or inside `ProgressDtos`), and edits to `ChestService` (loot roll), `ProgressDeltaBuilder`, `ProgressDtos`, the three user DTO files and `application.properties` (`app.progress.flair-base-url=${FLAIR_ASSET_BASE_URL:https://badges.studily.ca/flairs/v1}`).

### 13.5 UI (ui-designer)
- **`components/Avatar.tsx`** gains an optional `flair?: FlairRef | null` prop.
  - The ring is drawn **inside** the given `size`, and the photo or initial is inset by the ring width (`max(2, round(size × 0.08))`), so **layouts never shift**.
  - With `imageUrl`, a transparent ring image is overlaid instead, with an `onError` fallback to the CSS ring for that code, or to no ring.
  - A frontend registry `lib/flairs.ts` maps each code → CSS ring (conic and linear gradients from tokens or `color-mix`, with a glow for EPIC/LEGENDARY). It's subtly animated (slow rotation or pulse) for `ring_neon`, `ring_aurora`, `ring_galaxy`, `ring_prism`, `ring_blaze` and `ring_inferno`. The three fire rings (ember → blaze → inferno) escalate in intensity.
  - Every animation class goes into the reduced-motion allowlist.
  - Small avatars (≤ 32px) get the static version of the ring.
- **Pass `flair` at every `<Avatar>` call site** that shows a real user: Layout, ProfilePage, ProfileForm preview, UserProfilePage, FriendsPage, SchoolmatesPage, UserSearchModal, Messages, Conversation, NewGroupModal, CourseDetailPage, SharedSetPage. Add `flair` to the TS types those use.
- **`/profile/badges`** becomes a three-way `SegmentedToggle`: **Badges | Flairs | Shop**.
  - **Flairs:** an avatar preview with the equipped ring on top, then a grid of all flairs. Owned flairs are tappable to Equip or Unequip (via PUT). Locked flairs show a dimmed ring with how to unlock them: the price, "Found in chests", or "Reach a 7-day streak".
  - **Shop:** two sections, "Flairs" (SHOP flairs with price and Buy, and an Equip shortcut after buying) and the existing cosmetic badges.
  - Support `?tab=flairs`. On the own profile card, add a small "Change flair" link to `/profile/badges?tab=flairs`.
- **Rewards:**
  - `ChestModal` reveals a flair with an avatar preview.
  - `applyDelta` toasts `New flair unlocked: <title>` for each `newFlairs` entry, skipping any flair already shown in the chest reveal (same rule as badges).
- §10 rules apply: responsive at 375px, tokens only, tap targets ≥ 40px, guest gating, no comments.

### 13.6 Ownership for this wave
| Owner | May edit |
|---|---|
| db-developer | `V46__profile_flairs.sql`; the §13.3 entities, enums and repositories; the single new field in `User.java` and in `Chest.java` |
| backend-developer | all other `src/main/**` (as in §11) |
| ui-designer | `frontend/src/**` except `ChangelogPage.tsx` |
| release-docs | `ChangelogPage.tsx` (a new v44 entry "Profile flairs"), `learning/**` (a flairs section with review cards at the end of the F10 deck or a new short deck) |
| test-engineer | `src/test/**` |

### 13.7 Review round 1 decisions (lead, 2026-10-08)
- **V46 is frozen.** It's applied in Ryan's dev DB with a checksum, so any schema change from now on goes in V47+.
- **`User` gets `@DynamicUpdate`**, and **equip uses a targeted update** (`UserRepository` `@Modifying` query that sets only `equipped_flair_code`). This fixes a pre-existing lost-update risk: a full-row save of `users` could write back a stale `password_hash`, `token_version` or `avatar_image` that a concurrent password change, logout-everywhere or avatar upload had just changed.
- **`GET /api/flairs` returns all active flairs plus any inactive flair the caller owns**, so a retired flair that's still equipped shows as equipped. Equipping an owned inactive flair stays allowed, since flairs are never revoked.
- **Ops note for when art ships:** `Flairs` caches the `image_key` catalog for 5 minutes per instance, so a new or changed `image_key` reaches avatar rings within 5 minutes. `GET /api/flairs` reads it fresh.

### Badge art v2 (2026-10-08)
- The real badge art is designed in Claude Design ("Studily Badges" canvas) and generated by `design/badges/build_badges.py`. The generator writes SVG sources to `design/badges/svg/`, 512px PNG masters to `design/badges/export/png/`, and the 256px WebP files that ship to `design/badges/export/webp/`. Rendering uses the local Playwright headless Chromium and Montserrat Black.
- Each badge has three layers: the Studily logo frame in a tier material, a type icon, and a curved banner.
  - Tiers: wood → bronze → silver → gold → diamond → ruby → rainbow obsidian.
  - Icons: arrow (levels), brain (study), cards (flashcards), two people (friends), bicep (membership), double bicep (OG), plus spark, comet and crown for the cosmetics.
- The art lives in `studily-badges/badges/v3/` (v3 is review round 1: smaller bicep, no inner bevel line, banner text centred), and the code default and `upload.sh` default point at v3. `badges/v1/` (placeholders) and `badges/v2/` (first draft) aren't referenced by anything, and can be deleted once v3 is confirmed in prod.
- To change a badge, edit `BADGES` or `MATERIALS` in the generator and run `python3 design/badges/build_badges.py [codes…]`. Then re-upload into a **new** version folder (`BADGE_PREFIX=badges/v4`, then bump the default), because objects are cached `immutable` for a year.
