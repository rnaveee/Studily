# Studily

A student planner with a social layer — schedule, deadlines, flashcards, and the
classmates you share courses with, in one place. Live at **[studily.ca](https://studily.ca)**.

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
- **Flashcards** — decks per course with SM-2 spaced repetition; review state lives
  server-side, the client previews next intervals Anki-style
- **Friends & messaging** — friend requests, real-time chat over WebSockets with
  unread tracking
- **Notifications** — in-app deadline reminders (hourly scheduled job, idempotent)
  plus Web Push; installable as a PWA
- **Account security** — email verification, password reset/change, account deletion,
  logout-everywhere via JWT token versioning
- **Notes & profiles** — per-course timestamped notes; profiles with server-processed
  avatars

Roadmap: RAG-powered syllabus upload and AI study chat are deliberately sequenced
last, after launch (see `FEATURES.md` for the full feature map and `study-app-PRD.md`
for the product spec).

## Architecture

One deployable: a multi-stage `Dockerfile` builds the React app, copies it into
`src/main/resources/static`, and packages everything into a single Spring Boot jar.
The browser talks to the same origin that served the page — no separate frontend
host, no reverse proxy, no runtime CORS, and CSP can be `script-src 'self'`.
`SpaWebConfig` falls back to `index.html` for non-API paths so client-side routes
survive a hard refresh.

```
src/main/java/com/rnave/studily/
  auth/ user/ course/ semester/ academic/ note/
  dashboard/ calendar/ flashcard/ friend/ conversation/
  notification/ push/ mail/ config/
frontend/src/
  lib/        api client, auth context, query client, websocket, sm2 preview
  features/   auth, dashboard, calendar, courses, learn, friends,
              messages, profile, semesters, settings
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
- **Service worker**: cache-first for hashed immutable `/assets/*` only — never HTML
  or API responses, so a deploy can't be poisoned by a stale shell.
- **Observability**: Sentry on both backend and frontend; Railway healthchecks
  `/actuator/health` with `show-details=never`.
- **Tests**: ~18 unit test classes over the security filters, JWT parsing, SM-2 math,
  rate limiters, avatar validation, and scheduler dedupe. Known gaps: no
  Testcontainers-based integration tests, no frontend tests yet.

## Running locally

Prerequisites: JDK 21+, Node 20+, PostgreSQL.

```bash
createdb studily
DB_USER=postgres DB_PASSWORD=postgres ./mvnw spring-boot:run   # API on :8080
cd frontend && npm install && npm run dev                      # SPA on :5173, proxies /api
```

Run the tests:

```bash
./mvnw test
```

All `/api/**` routes require a Bearer token except `/api/auth/**`; the WebSocket
handshake at `/ws` authenticates via the same JWT.

## Configuration

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Server port (Railway injects this) |
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `localhost` / `5432` / `studily` / `postgres` / `postgres` | Postgres connection |
| `JWT_SECRET` | dev placeholder | HS256 key — **must be ≥64 chars in prod**, app refuses to boot otherwise |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed dev origin(s); prod is same-origin |
| `APP_TIMEZONE` | `America/Toronto` | Timezone for reminder scheduling |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | unset (push disabled) | Web Push keypair (`npx web-push generate-vapid-keys`) |
| `RESEND_API_KEY` / `MAIL_FROM` | unset (email disabled) | Resend key + verified From address for verification/reset emails |
| `APP_BASE_URL` | `http://localhost:5173` | Public URL used in email links |
| `SENTRY_DSN` / `SENTRY_ENVIRONMENT` | unset / `development` | Backend error tracking |
| `VITE_SENTRY_DSN` | unset | Frontend error tracking — **build-time** var, baked into the bundle |

## Deploying

Railway builds the `Dockerfile` via `railway.json` and healthchecks
`/actuator/health`. Add a Postgres plugin, reference its variables
(`DB_HOST` = `${{Postgres.PGHOST}}` etc.), and set `JWT_SECRET`
(`openssl rand -base64 64`). Railway passes service variables through as Docker
build args, so `VITE_SENTRY_DSN` is set in the same place as everything else.

Or locally:

```bash
docker build -t studily .
docker run -p 8080:8080 -e JWT_SECRET=$(openssl rand -base64 64) \
  -e DB_HOST=host.docker.internal -e DB_USER=postgres -e DB_PASSWORD=postgres studily
```
