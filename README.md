# Studily

A student planner with a social layer — schedule, deadlines, flashcards, study
sessions, and the classmates you share courses with, in one place. Live at
**[studily.ca](https://studily.ca)**.

Spring Boot 4 (Java 21) + PostgreSQL REST API, React 19 SPA (Vite, TypeScript,
Tailwind, TanStack Query), shipped as a single Docker image on Railway.

## Features

- **Semesters & courses** — courses with meeting blocks, professor, color; scoped per
  semester with auto-detection of the current term
- **Assignments & exams** — due dates, grade weights, TODO → IN_PROGRESS → DONE
  workflow, next-exam countdown
- **Dashboard** — time-proportional Sun–Sat schedule grid, "due this week" list,
  tap-a-day quick add, auto-refresh
- **Calendar** — month view of academic items plus custom events
- **Flashcards** — decks per course with SM-2 spaced repetition (review state lives
  server-side, the client previews next intervals Anki-style), plus Learn, Memory and
  Match modes, friends-only sharing, and a right/wrong summary after every run
- **Study sessions** — Pomodoro (25/5 blocks) or timer sessions with a checklist,
  a check-in at the end of each block, a weekly streak and an XP multiplier up to 1.5×
- **Progression** — XP and levels, badges on profiles (lit when earned, silhouetted
  when locked), coins from level-ups and chests, and a cosmetic badge shop
- **Course import** — Canvas calendar (iCal) feeds and AI reading of uploaded course
  outlines
- **Friends & messaging** — friend requests, real-time chat over WebSockets with
  unread tracking
- **Notifications** — in-app deadline reminders (hourly scheduled job, idempotent)
  plus Web Push; installable as a PWA
- **Account security** — email verification, password reset/change, account deletion,
  logout-everywhere via JWT token versioning
- **Notes & profiles** — per-course timestamped notes; profiles with server-processed
  avatars

Roadmap: a RAG-powered AI study chat over your course materials is deliberately
sequenced last, after launch — the core planning and social product ships first.

## Architecture

One deployable: a multi-stage `Dockerfile` builds the React app, copies it into
`src/main/resources/static`, and packages everything into a single Spring Boot jar.
The browser talks to the same origin that served the page — no separate frontend
host, no reverse proxy, no runtime CORS, and CSP can be `script-src 'self'`.
`SpaWebConfig` falls back to `index.html` for non-API paths so client-side routes
survive a hard refresh.

```
src/main/java/com/rnave/studily/
  auth/ user/ course/ semester/ academic/ note/ todo/
  dashboard/ calendar/ recurrence/ ics/ canvas/ parse/
  flashcard/ studysession/ progress/ pomodoro/
  friend/ conversation/ linkpreview/
  notification/ push/ mail/ admin/ support/ config/
frontend/src/
  lib/        api client, auth context, query client, websocket, sm2 preview,
              progress deltas
  features/   auth, onboarding, dashboard, calendar, courses, canvas, learn,
              progress, todos, friends, messages, profile, semesters,
              settings, admin, landing, static
```

Schema is owned by Flyway migrations (`src/main/resources/db/migration`);
`ddl-auto=validate` makes Hibernate a tripwire that entities match the real schema.

## Engineering notes

Decisions worth knowing about before reading the code:

- **Auth**: stateless JWT (HS256, 24h) in the `Authorization` header — CSRF protection
  is off because no credential rides in a cookie. Revocation without server-side
  sessions via a `token_version` column checked per request: password changes and
  logout-everywhere bump the version and stale tokens die immediately.
- **Authorization is ownership, not roles**: every service resolves resources through
  the current user (courses by `user_id`, conversations via `requireMember`), so IDOR
  is blocked at the query level.
- **Rate limiting**: hand-rolled in-memory fixed-window limiter (~40 lines, no Redis
  needed at single-instance scale). Login attempts key per *email* so an attacker
  can't brute-force one account from many IPs; the client IP is taken from the last
  `X-Forwarded-For` hop — the one appended by the trusted proxy.
- **Spaced repetition**: SM-2 with Anki's four grades mapped to quality scores
  (`Sm2.java`). The backend is authoritative; a TypeScript twin only previews
  intervals on the grade buttons.
- **Messaging**: WebSocket push with an auth handshake interceptor and a session
  registry; message history pages with `Slice` (no count query).
- **Uploads**: avatars are re-encoded server-side to bounded JPEGs, with declared
  image dimensions checked *before* decoding so a decompression bomb can't OOM the
  JVM. Stored as BYTEA — one small image per user, and the host filesystem is
  ephemeral.
- **Progression economy**: XP and coins are computed only on the server and written
  to append-only ledgers (`xp_events`, `coin_transactions`) with unique dedupe keys,
  so retries and replays can't grant twice. Every XP, coin or streak change takes a
  pessimistic lock on the user's `user_progress` row first; chests open with a
  conditional `UPDATE … WHERE opened_at IS NULL`, so concurrent opens or purchases
  can't double-spend. Level N needs `450 + 50N` XP.
- **Anti-farming**: study XP is paid per block only after a check-in inside a 5-minute
  window (a scheduled sweeper pauses and expires idle sessions and sends the
  block-end push), daily study XP tapers off after 4 hours, task and friend XP have
  daily caps and real-account checks, and streak dates use a per-user "progress
  timezone" that can change at most once a week so timezone hopping can't fake days.
- **Service worker**: cache-first for hashed immutable `/assets/*` only — never HTML
  or API responses, so a deploy can't be poisoned by a stale shell.
- **Observability**: Sentry on both backend and frontend; Railway healthchecks
  `/actuator/health` with `show-details=never`.
- **Tests**: 596 JUnit 5 / Mockito tests across 52 suites — security filters, JWT
  parsing, SM-2 math, rate limiters, avatar validation, scheduler dedupe, and every
  XP, streak, chest and shop rule at its boundaries. Known gaps: no
  Testcontainers-based integration tests, no frontend tests yet.
- **Development workflow**: large features are built contract-first. A spec in
  `.claude/specs/` fixes the schema, API shapes and file ownership, and a Claude Code
  agent team (`.claude/agents/`) builds in parallel, with code, security and browser
  QA reviews gating every change.

## Running locally

Prerequisites: JDK 21, Node 20+, PostgreSQL. Lombok doesn't support the newest
`javac` yet, so build with JDK 21 specifically; newer JDKs fail with an
`ExceptionInInitializerError` that looks like a code error but isn't.

```bash
createdb studily
DB_USER=postgres DB_PASSWORD=postgres ./mvnw spring-boot:run   # API on :8080
cd frontend && npm install && npm run dev                      # SPA on :5173, proxies /api
```

No JDK 21 installed? Build in a container and run the jar with any newer JRE:

```bash
podman run --rm --network=host -v "$PWD":/app:z -v "$HOME/.m2":/root/.m2:z -w /app \
  docker.io/library/maven:3.9-eclipse-temurin-21 mvn -B -q -Dmaven.test.skip=true package
java -jar target/Studily-0.0.1-SNAPSHOT.jar
```

Run the tests (`contextLoads` needs the local Postgres; `JWT_SECRET` must be 64+ chars):

```bash
JWT_SECRET=$(openssl rand -base64 64) ./mvnw test
```

All `/api/**` routes require a Bearer token except `/api/auth/**`; the WebSocket
handshake at `/ws` authenticates via the same JWT.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Server port (Railway injects this) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `localhost` / `5432` / `studily` / `postgres` / `postgres` | Postgres connection |
| `JWT_SECRET` | dev placeholder | HS256 key — **must be ≥64 chars in prod**, app refuses to boot otherwise |
| `JWT_EXPIRATION_MS` | `2592000000` | Token lifetime (30 days; refreshed on app open) |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed dev origin(s); prod is same-origin |
| `APP_TIMEZONE` | `America/Toronto` | Timezone for reminder scheduling |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | unset (push disabled) | Web Push keypair (`npx web-push generate-vapid-keys`) |
| `RESEND_API_KEY` / `MAIL_FROM` | unset (email disabled) | Resend key + verified From address for verification/reset emails |
| `APP_BASE_URL` | `http://localhost:5173` | Public URL used in email links |
| `ANTHROPIC_API_KEY` | unset (automatic course creation disabled) | Anthropic API key for reading uploaded course outlines; billed per parse from Console credits |
| `PARSE_ENABLED` | `true` | Kill switch for automatic course creation, independent of the key |
| `PARSE_MODEL_TEXT` / `PARSE_MODEL_VISION` | `claude-sonnet-5` / `claude-haiku-4-5` | Models used for PDF/pasted text and for images |
| `BADGE_ASSET_BASE_URL` | `https://badges.studily.ca/badges/v1` | Where badge art is served from; bump the version folder to bust caches |
| `PROGRESS_OG_CUTOFF` | `2026-10-11` | Accounts created before this date earn the OG badge |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | unset / `development` | Backend error tracking |
| `VITE_SENTRY_DSN` | unset | Frontend error tracking — **build-time** var, baked into the bundle |

## Deploying

Railway builds the `Dockerfile` via `railway.json` and healthchecks
`/actuator/health`. Add a Postgres plugin, reference its variables
(`DB_HOST` = `${{Postgres.PGHOST}}` etc.), and set `JWT_SECRET`
(`openssl rand -base64 64`). Railway passes service variables through as Docker
build args, so `VITE_SENTRY_DSN` is set in the same place as everything else.

Badge art lives in the Cloudflare R2 bucket `studily-badges`, served at
`badges.studily.ca` (allowed in the CSP `img-src`). To upload or replace art, put
files named `<badge code>.webp` in a folder and run `scripts/badges/upload.sh <dir>`.

Or locally:

```bash
docker build -t studily .
docker run -p 8080:8080 -e JWT_SECRET=$(openssl rand -base64 64) \
  -e DB_HOST=host.docker.internal -e DB_USER=postgres -e DB_PASSWORD=postgres studily
```
