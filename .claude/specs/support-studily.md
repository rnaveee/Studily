# Support Studily spec (contract)

Branch `support-studily`. This file is the contract for every agent. Do not change another agent's files; if the contract is wrong, stop and report.

## Global rules
- Follow CLAUDE.md. NO code comments anywhere (project rule). Constructor injection, `@Value` config, existing exceptions in `config/` (BadRequestException, ConflictException, ForbiddenException, NotFound...).
- Backend build check: `podman run --rm --network=host -v "$PWD":/w:Z -v "$HOME/.m2":/root/.m2:Z -w /w maven:3.9-eclipse-temurin-21 mvn -q package -DskipTests` (tests compile even with -DskipTests). Run your own tests with `-Dtest=...` (tests hit the local Postgres from application.properties).
- Migrations are fixed: V80 supporter badge (done, lead), V81 referrals (Referrals agent), V82 donations (Stripe agent). Never touch another number.
- Supporter badge: always grant through `com.rnave.studily.support.SupporterBadge#grantIfMissing(userId, delta)` (delta may be null).
- Frontend: React 19 + TS + Tailwind, `frontend/src/lib/api.ts` fetch wrapper, feature code in `frontend/src/features/support/`.
- Do not commit; the lead merges. Report: files changed, tests run with results, anything unverified.

## Shared contract (lead writes this first)
I'll write `.claude/specs/support-studily.md` before any agent starts, the same way `social-progress.md` worked. It is the contract every agent builds against: the DDL, API JSON, file ownership and the rules below.

**Lead scaffold, committed on branch `support-studily` before wave 1:**
- `V80__supporter_badge.sql`: adds the `supporter` row to `badges` (SOCIAL, image `supporter.webp`).
- `support/SupporterBadge.java`: `grantIfMissing(userId, ProgressDeltaBuilder)`. It wraps the existing check-then-grant pattern from `SurveyService` (`existsByUserIdAndBadgeCode` → `badgeService.grant(..., EARNED)`), and the `UNIQUE(user_id, badge_code)` constraint is the backstop.
- The migration numbers are fixed in advance: **V81 referrals** and **V82 donations**, so the parallel agents never collide.

**API contract:**
```
GET  /api/referrals/me             -> {code, link, joined, pending, rewardedCount, cap}
GET  /api/public/invites/{code}    -> {inviterName}   (404 if unknown/banned)
GET  /api/public/invites/{code}/preview.png
GET  /invite/{code}                -> SPA shell with invite OG/meta
POST /api/auth/signup              +referralCode (optional)
GET  /api/donations/config         -> {enabled, currency:"cad", presets:[200,500,1000,2000], minCents:200, maxCents:100000}
POST /api/donations/checkout {amountCents} -> {url}
GET  /api/donations/{id}           -> {status, amountCents}  (owner only)
POST /api/stripe/webhook           (public, signature-verified)
```

## Agents and waves
All agents are `general-purpose` and run in `isolation: "worktree"` cut from `support-studily`. I merge each one, then build and run the tests after every wave. "Sonnet 5.6" doesn't exist, so the extra agents use Sonnet 5.5.

**Wave 1 (parallel, file sets don't overlap):**

| Agent | Model / effort | Owns |
|---|---|---|
| Design | Opus 5.5, medium | `frontend/src/features/support/GreenHeart.tsx`, `--heart-*` tokens + `hh-*` keyframes in `index.css`, the `supporter` entry in `design/badges/build_badges.py` + `export/webp/supporter.webp`, `BADGE_TIER.supporter = 6` in `badges.ts` |
| Referrals | Sonnet 5.5, high | V81, `referral/*`, the `AuthDtos`/`AuthService.signup` hook, `ChestSource.REFERRAL` + `ChestTier.defaultFor`, `NotificationType.REFERRAL_REWARD` (+ check-constraint widening in V81, `CENTER_TYPES`), invite OG image + `/invite/{code}` page controller, tests |
| Stripe | Sonnet 5.5, medium | `pom.xml` (stripe-java, pinned), `STRIPE_*` properties, V82, `donation/*`, webhook permitAll in `SecurityConfig` + exemption in `GlobalRateLimitFilter`, tests |

**Wave 2 (parallel):**

| Agent | Model / effort | Owns |
|---|---|---|
| Frontend | Sonnet 5.5, high | Header heart in `Layout.tsx`, `features/support/SupportStudilyPage.tsx`, the `/invite/:code` SPA route, `routes.json` + `App.tsx`, story-image share plumbing, signup `referralCode`. Wired to the real endpoints, with placeholders for the copy and story art |
| Payment security | Opus 5.5, medium | Audits and hardens `donation/*` + the webhook (list below), adds the failing-case tests, fixes what it finds |

**Wave 3 (lead):** merge → `mvn package` in the podman temurin-21 container → frontend build (the prerender route check) → verify → changelog **v84** → VS doc entry → show you before merging to main.

## Design (Design agent)
- **GreenHeart:** inline SVG on a 100×100 viewBox, built from layered OUTER/MID/CORE/SHINE paths like `StreakFlame.tsx`, possibly with the Studily mark inside. The glow uses the same two layers as the flame: a radial `span` that pulses, plus `drop-shadow`. The pulse is switched off under reduced motion. Props are `size` and `glow`.
- **Supporter badge:** the existing rainbow-obsidian frame from `build_badges.py` with a new `icon_heart()` and the `SUPPORTER` ribbon.
- Before the art is uploaded to R2 `badges/v4/`, I publish a small preview artifact (heart + badge, light/dark) for your approval. The art has to be uploaded before deploy, or Cloudflare caches a 404.

## Referral logic (anti-farming)
- **`referral_codes(user_id PK, code UNIQUE)`:** a random 8-character code, created the first time it's requested. It is not the username, because usernames can change and a random code can't be guessed.
- **`referrals`:** `(id, inviter_id, invitee_id UNIQUE, status PENDING|REWARDED|REJECTED, reason, created_at, rewarded_at)`.
  - `UNIQUE(invitee_id)` means each account can be counted once, ever.
- **At signup** (`AuthService.signup`), with any problem silently ignored so signup never fails:
  - The code must resolve to an inviter.
  - The inviter must not be banned or suspended.
  - The normalized emails of inviter and invitee must differ (`BannedEmails.normalize`).
  - If all of that holds, a PENDING row is inserted.
- **Payout check:** an `@Scheduled` sweeper (every 10 min) plus an opportunistic check when the invitee earns XP. It pays when all of these hold:
  - the invitee's email is verified, and the invitee has earned **non-friend XP** (reuse the existing friend-XP gate query);
  - the account is ≤30 days old, otherwise the row is REJECTED with reason `expired`;
  - the inviter is verified and not banned;
  - the inviter has fewer than **10** REWARDED referrals, otherwise REJECTED with `cap`. The badge still comes with the first one.
- **Paying out:** an atomic claim, `UPDATE referrals SET status='REWARDED' WHERE id=? AND status='PENDING'`. Only the caller that gets rowcount 1 grants anything.
  - `grantChest(GOLD, REFERRAL, "referral:"+inviteeId)` to the inviter and `"referred"` to the invitee. `UNIQUE(user_id, source, source_ref)` makes these idempotent.
  - `SupporterBadge.grantIfMissing(inviter)`.
  - Both users get a notification.
- **Invite page:** a Java2D `InvitePreviewImage` (1200×630, "{Name} invited you to Studily", same fonts as `SetPreviewImage`).
  - `InvitePageController` serves `/invite/{code}` by rewriting the meta tags in `spaPages.shell()`, mirroring `SharedSetPageController` + `SetPageMeta`.
  - The SPA route saves the code to localStorage (30-day expiry) and sends the visitor to `/signup`. A logged-in visitor goes to the dashboard instead.

## Stripe donations
- **Disabled unless `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set.** This follows the `FeedUrlCipher` pattern: a blank key disables, a malformed key fails at startup. While disabled, `config.enabled=false` and the page shows "Donations coming soon", so the branch is safe to deploy before Stripe is set up.
- **`donations`:** `(id UUID, user_id, amount_cents CHECK 200..100000, currency, status PENDING|PAID|REFUNDED|DISPUTED|EXPIRED, stripe_session_id UNIQUE, stripe_payment_intent UNIQUE, created_at, paid_at)`.
- **`stripe_events(event_id PK, type, received_at)`:** the webhook dedupe table.
- **Checkout** (logged in; 5 requests per 10 min per user via `SlidingWindowRateLimiter`):
  1. Validate the amount.
  2. If this user has a PENDING donation for the same amount created in the last 30 min, return its session URL. This stops double-click and double-tab duplicates.
  3. Otherwise insert a PENDING row and create the Checkout Session with:
     - `mode=payment`, `submit_type=donate`, `currency=cad`, inline `price_data`
     - `client_reference_id` = donation id, plus metadata
     - `customer_email`
     - the success/cancel URLs under `/support-studily`
     - the **Stripe Idempotency-Key = donation id**
  
  Payment methods are left to Stripe's automatic setting, so cards, Apple Pay and Google Pay all work. The CSP doesn't change.
- **Webhook:**
  - Read the raw `String` body and verify it with `Webhook.constructEvent`, using the default tolerance.
  - Insert into `stripe_events` first; a duplicate key means the event was already handled, so return 200.
  - Handled events:
    - `checkout.session.completed` (only when `payment_status=paid`) and `async_payment_succeeded`: check that the amount and currency match the row, then `UPDATE … SET status='PAID' WHERE id=? AND status='PENDING'`, then grant the badge and send a notification.
    - `async_payment_failed` / `checkout.session.expired`: mark the row EXPIRED.
    - `charge.refunded` / `charge.dispute.created`: mark it REFUNDED/DISPUTED. The badge is kept; it's cosmetic.
  - Any other event gets a 200 and is ignored.
- **The success page never grants anything.** It only polls `GET /api/donations/{id}`, owner only. The webhook is the only source of truth.
- **Payment-security audit checklist:**
  - signature check and replay handling
  - amount tampering
  - a duplicate or out-of-order `completed` vs `expired` event
  - concurrent deliveries of the same event (a test that races two threads)
  - IDOR on the status endpoint
  - card-testing limits
  - secrets never logged
  - the webhook skipped by the rate limiter and the www redirect

## What you do in Stripe (written into the spec + the final summary)
1. Create and activate a Stripe account: business details (sole proprietor), a Canadian bank account for payouts, statement descriptor `STUDILY`.
2. Turn on Apple Pay, Google Pay and Link under Settings → Payment methods (Checkout needs no domain verification). Add the logo and green brand colour under Settings → Branding.
3. Developers → Webhooks → add the endpoint `https://studily.ca/api/stripe/webhook`, using the host without `www.`. Subscribe these events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.
4. Railway: set `STRIPE_SECRET_KEY` (sk_live_…) and `STRIPE_WEBHOOK_SECRET` (whsec_…). Use the test-mode keys first.
5. Page wording: say "support/contribution", not "charitable donation". There's no tax receipt; Studily isn't a registered charity.

## Critical files
- Backend:
  - `auth/AuthService.java`, `auth/AuthDtos.java`
  - `progress/ProgressService.java` (`grantChest`), `ChestSource.java`, `ChestTier.java`, `BadgeService.java`
  - `notification/NotificationDispatcher.java`, `NotificationType.java`, `NotificationController.java`
  - `config/SecurityConfig.java`, `GlobalRateLimitFilter.java`
  - `moderation/BannedEmails.java`
  - `flashcard/SharedSetPageController.java`, `SetPageMeta.java`, `SetPreviewImage.java` (the pattern to copy)
- Frontend:
  - `components/Layout.tsx`, `features/progress/StreakFlame.tsx`, `CoinBalance.tsx`, `badges.ts`
  - `lib/shareImage.ts` (add a filename parameter + `navigator.share({files})` so the image can be saved to the camera roll)
  - `lib/scheduleImage.ts` (canvas helpers for the placeholder story card)
  - `routes.json`, `App.tsx`, `features/auth/SignupPage.tsx`, `ChangelogPage.tsx`
- Art: `design/badges/build_badges.py`.

## Verification
- **Backend:**
  - `mvn package` in `maven:3.9-eclipse-temurin-21 --network=host`.
  - New JUnit tests:
    - referral eligibility: self-invite, unverified invitee or inviter, cap, expiry, a race where two threads claim the payout but only one grant happens
    - donations: amount bounds, a forged signature gets 400, a replayed event is a no-op, amount mismatch, unpaid sessions, the async path, the duplicate-checkout reuse
  - A DB round-trip test, like `GradingScalePersistenceTest`.
- **Stripe end to end in test mode:**
  1. `stripe listen --forward-to localhost:8080/api/stripe/webhook`.
  2. Pay with 4242… and with an Apple Pay test card; check that the badge lands once.
  3. `stripe events resend` the same event to confirm a replay is a no-op.
  4. Pay with the 3DS card and a declining card.
- **Referral end to end:** create the inviter, open `/invite/{code}` (check the OG tags with curl and open the preview PNG), sign up the invitee, verify the email, finish a short study session, run the sweeper, then check that both chests and the badge landed and the notifications fired.
- **UI:** Chrome at 375×812 and 1280×800, light/dark/Classic. Check the header heart placement, the page logged out vs logged in, copy/save of the story image, and the amount chips (custom amount <2 is rejected).
- **Prerender:** `npm run build` passes the routes.json check.
