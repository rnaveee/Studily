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
Override with env vars: `DB_NAME`, `DB_USER`, `DB_PASSWORD`. Schema is auto-created by
Hibernate (`ddl-auto=update`).

> Before any real deploy: set a strong `JWT_SECRET`, switch `ddl-auto` to `validate`, and
> introduce Flyway migrations.

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
| `DB_NAME` / `DB_USER` / `DB_PASSWORD` | `studily` / `postgres` / `postgres` | Postgres connection |
| `JWT_SECRET` | dev placeholder | HS256 signing key (≥32 bytes) |
| `JWT_EXPIRATION_MS` | `86400000` | Token lifetime |
| `CORS_ORIGINS` | `http://localhost:5173` | Allowed frontend origin(s) |
| `REMINDER_WINDOW_HOURS` | `48` | How far ahead deadline reminders fire |

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
