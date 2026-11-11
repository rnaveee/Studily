# Studily — Project Instructions

## Technology Stack
- Backend: Java 21, Spring Boot 4
- Database: PostgreSQL
- ORM: Hibernate / JPA
- Frontend: React 19, TypeScript, Tailwind
- Build: Docker

## Backend Architecture
Follow the existing layered architecture:
- Controllers: HTTP requests and responses
- Services: Business logic
- Repositories: Database access
- Entities: Database models
- DTOs: API request/response structures

## Development Rules
- Follow existing project conventions.
- Avoid unnecessary abstractions.
- Do not modify unrelated files.
- Prefer existing utilities over duplicating functionality.
- Validate user input.
- Enforce resource ownership and authorization.
- Consider security and edge cases.
- Write JUnit 5 tests for important business logic.
- Use transactions where appropriate.

## AI Collaboration
- Explain significant architectural decisions.
- Work incrementally.
- Do not scan the entire repository unless requested.
- Identify relevant files before modifying them.
- Do not automatically refactor unrelated code.
- Prefer concise explanations.
- Ask before making significant architectural changes.

## Token efficiency
- Be concise.
- Don't repeat information.
- Only inspect relevant files.
- Don't explain basic concepts unless necessary.
- Reference actual files and methods.
- Explain important decisions, not every line.
- Ask before expanding into unrelated topics.

## Agent skills

### Issue tracker

Issues and specs live as GitHub issues in `rnaveee/Studily`, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles, using the default label names: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout: one `GLOSSARY.md` and `docs/adr/` at the repo root. See `docs/agents/domain.md`.
