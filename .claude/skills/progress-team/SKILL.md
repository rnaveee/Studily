---
name: progress-team
description: Lead playbook for building the Studily social-progress feature (XP, levels, badges, coins, chests, study sessions) with the progress agent team. Run in the main session - subagents cannot launch subagents, so the main session is the team lead that dispatches waves, routes review findings back, and commits.
---

# Progress team lead

You are the lead. The team is in `.claude/agents/`, and the contract is `.claude/specs/social-progress.md`. Read the spec before dispatching anything. Its §11 ownership table is what makes parallel work safe.

| Role | Agent | Wave |
|---|---|---|
| Migrations, entities, repos | `db-developer` | 1 |
| Services, controllers, rules | `backend-developer` | 1 |
| R2, domain, Railway runbook | `platform-ops` | 1 |
| React UI | `ui-designer` | 1 |
| Changelog, what's-new, study deck | `release-docs` | 1 |
| JUnit tests | `test-engineer` | 2 |
| Code gate | `reviewer` | 2, then after every fix |
| Abuse gate | `security-reviewer` | 2 |
| Browser QA at 375px / 1280px | `qa-verifier` | 2 |

## Procedure

1. **Branch.** `git switch social-progress`, or create it from an up-to-date `main`. Never build this feature on `main`; main auto-deploys to Railway and runs migrations.
2. **Track.** Make a task list: one task per wave, plus one per open finding.
3. **Wave 1, builders, in parallel.** Launch the five builders in one message, all in the background.
   - Each prompt says: "You are on branch social-progress. Read .claude/specs/social-progress.md first. Stay inside your §11 row. End with the HANDOFF block."
   - Add anything specific to the current state: what already exists, and findings from earlier runs.
4. **Integrate.** When all five report back:
   - Run the backend build from spec §2 and `cd frontend && npm run build` yourself.
   - Route each error to the agent that owns the file, via `SendMessage` to that agent's id so it keeps its context.
   - Carry out cross-lane `requests:` from the HANDOFF blocks by sending them to the owner. Example: release-docs asks ui-designer to mount `ProgressWhatsNew`.
   - Repeat until both builds are green.
   - Then commit on the branch, e.g. `Add progress feature wave 1 (unreviewed)`.
5. **Wave 2, gates, in parallel.**
   - Launch `test-engineer`, `reviewer`, `security-reviewer` and `qa-verifier` together.
   - Give the reviewer every HANDOFF block from wave 1.
   - The backend must be bootable for qa-verifier. If it isn't, run qa-verifier after the fixes instead.
6. **Wave 3, fixes.**
   - Group findings by owner (§11) and send each owner its numbered list via `SendMessage`.
   - After the fixes, re-run the builds and send the **reviewer** a re-review of just those paths. Also re-run security-reviewer or qa-verifier if their findings were involved.
   - **Cap: 3 send-back rounds per agent.** After that, stop and ask Ryan, with the remaining findings and both sides' reasoning.
7. **Done** means:
   - the reviewer and security-reviewer both say APPROVED,
   - qa-verifier says PASS,
   - the test-engineer's tests are green in `mvn package`.

   Then commit on `social-progress`, and report to Ryan:
   - what shipped, with the test count,
   - the open items (real badge art and copy, Railway vars from spec §12, an on-device push check-in test, deploying the study deck),
   - and ask before merging to main.

## Rules for the lead

- Questions from agents go to Ryan (AskUserQuestion). Never answer economy or design questions by guessing. Decisions go into the spec first, then out to the agents.
- Never let an agent edit outside its lane to "save a round trip". Send the request to the owner.
- Commits: no Claude attribution or co-author lines (Ryan has attribution off). Don't push until Ryan asks. Merging to main, setting Railway variables, and deploying the study site all need Ryan's explicit go-ahead.
- Anything that touches production (Railway, DNS changes beyond `badges.studily.ca`, deleting things) needs Ryan's approval relayed in the agent's prompt.
- After merge: add the changelog check to memory, and update the project memory notes for this feature.
