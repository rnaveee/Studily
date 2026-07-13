# Studily

A student study app: class planner + academic calendar + classmate matching.
Spring Boot (Java) backend, React (Vite + TypeScript + Tailwind) frontend.
See `study-app-PRD.md` for the product spec.

## Status

**Phase 0 (MVP) + classmate hook** is implemented:

- Email/password auth with JWT (any email)
- Course CRUD with color + meeting blocks
- Exams/assignments tied to a course
- Auto-generated weekly schedule (Sun–Sat) + next-exam countdown
- Month calendar of academic items
- Per-course timestamped notes
- In-app deadline reminders (hourly scheduled job)
- Classmate suggestions (same school + shared course code)

Deferred: chat/DMs (Phase 1), RAG (Phase 2). See the PRD.

## Prerequisites

- JDK 21+ (project targets Java 21)
- Node 20+
- PostgreSQL running locally

## Database

Create the database once:

```bash
createdb studily
```

Connection defaults to `localhost:5432`, db `studily`, user/password `postgres`/`postgres`.
Override with env vars: `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Schema is
managed by Flyway migrations (`src/main/resources/db/migration`); `ddl-auto=validate` just
checks Hibernate's model matches what Flyway created.

## Run the backend

```bash
DB_USER=postgres DB_PASSWORD=postgres ./mvnw spring-boot:run
```

API serves on `http://localhost:8080`. All `/api/**` routes require a Bearer token except
`/api/auth/signup` and `/api/auth/login`.

## Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Opens on `http://localhost:5173` and proxies `/api` to the backend, so run both together.

## Key environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `8080` | Port the server listens on (Railway injects this) |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Postgres host/port |
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `studily` / `postgres` / `postgres` | Postgres connection |
| `JWT_SECRET` | dev placeholder | HS256 signing key — **must be ≥64 chars in prod**, app refuses to boot otherwise |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s), comma-separated |
| `APP_TIMEZONE` | `America/Toronto` | Timezone used for class/event/exam reminder scheduling |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | unset (push disabled) | Web Push VAPID keypair (base64url, P-256). Generate: `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:ryannave97@gmail.com` | Contact URI sent to push services |
| `SENTRY_DSN` | unset (disabled) | Backend error tracking — DSN from your Sentry project |
| `SENTRY_ENVIRONMENT` | `development` | Tag backend Sentry events with an environment name |
| `VITE_SENTRY_DSN` | unset (disabled) | Frontend error tracking — **build-time** var, must be set when the Docker image is built, not at runtime |

## Deploying (Railway)

The app is a single Docker image: the multi-stage `Dockerfile` builds the React app, copies
it into `src/main/resources/static`, and packages everything into one Spring Boot jar. There
is no separate frontend host, no reverse proxy, and no CORS to configure at runtime — the
browser talks to the same origin that served the page, and `api.ts`'s relative `/api/...`
calls just work. `SpaWebConfig` falls back to `index.html` for any non-API, non-static path
so client-side routes (e.g. `/courses/123`) survive a hard refresh.

1. Push this repo to GitHub and create a new Railway project from it (or `railway up`).
   Railway auto-detects `railway.json` and builds via the Dockerfile.
2. Add a Postgres plugin to the project.
3. Set these service variables (Railway lets you reference the Postgres plugin's own vars):
   - `DB_HOST` = `${{Postgres.PGHOST}}`
   - `DB_PORT` = `${{Postgres.PGPORT}}`
   - `DB_NAME` = `${{Postgres.PGDATABASE}}`
   - `DB_USER` = `${{Postgres.PGUSER}}`
   - `DB_PASSWORD` = `${{Postgres.PGPASSWORD}}`
   - `JWT_SECRET` = a random string ≥64 characters (`openssl rand -base64 64`)
   - `CORS_ORIGINS` = your Railway-assigned domain (harmless once same-origin, but keep it
     accurate in case you ever split the frontend out)
   - `SENTRY_DSN` / `VITE_SENTRY_DSN` = DSNs from your Sentry project (create one at
     sentry.io — a Java project for the backend DSN, a React project for the frontend one).
     Railway passes service variables through as Docker build args automatically when the
     Dockerfile declares a matching `ARG`, so `VITE_SENTRY_DSN` gets baked into the frontend
     bundle at build time from the same place you set everything else. `SENTRY_ENVIRONMENT` =
     `production` is worth setting too, to separate prod events from local dev noise.
4. Railway healthchecks `/actuator/health` (configured in `railway.json`); only that one
   endpoint is exposed, with no detail leakage (`show-details=never`).

To build/run the image locally instead:

```bash
docker build -t studily .
docker run -p 8080:8080 -e JWT_SECRET=$(openssl rand -base64 64) \
  -e DB_HOST=host.docker.internal -e DB_USER=postgres -e DB_PASSWORD=postgres studily
```

## Project layout

```
src/main/java/com/rnave/studily/
  auth/ config/ user/ course/ academic/ note/
  dashboard/ calendar/ classmate/ notification/
frontend/src/
  lib/        api client, auth context, query client, formatters
  components/  Layout, ProtectedRoute
  features/    auth, dashboard, calendar, courses, profile, classmates
```
