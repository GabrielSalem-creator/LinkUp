# Competition/Season Statistics, Match Details, and Ticketing

**GitHub task title:** `[COMP-001] Add Competition/Season statistics, match details, premium ticketing, and payment-ready architecture`

**Status:** Approved implementation plan. Implement one child task at a time and stop at every audit gate.

**Scope:** Expo iOS/Android and Vercel-hosted web, with Appwrite handling authentication, data, storage, and server functions.

## Mandatory delivery workflow

For every numbered child task:

1. Implement only that approved child task.
2. Stop and hand the result to the assigned employee.
3. The employee audits the result, captures evidence, and fixes defects only within that task's scope.
4. The employee reruns all required checks.
5. Begin the next task only after the current task passes its acceptance gate.

Do not merge, deploy, modify production data, initiate a real payment, or broaden scope without separate approval.

## Repository findings and boundaries

- The application uses Expo 57, React Native, Expo Router, Appwrite, and a Vercel web export.
- Read `mobile/AGENTS.md` and its linked Expo 57 documentation before implementation.
- Existing navigation includes Events, Clubs, Leagues, and Profile. Competition/Season must be a new destination.
- Existing community `ClubEvent` records and RSVP behavior are not competitive matches and must remain unchanged.
- Existing club leaderboards measure community activity such as distance, hours, and sessions. They are not competition statistics.
- Existing event cards route to clubs rather than match details.
- Existing club administration uses a client-side shared club password. It must not authorize match, statistic, inventory, order, payment, or ticket operations.
- Existing Appwrite setup scripts grant broad authenticated-user writes. New collections must use deny-by-default permissions and server-authoritative privileged writes.
- There is no active ticket order service, payment provider integration, webhook processor, or ticket issuance flow.
- The current Whish flow is a placeholder; a README reference to Stripe is not an implemented provider selection.
- Preserve LinkUp's current colors, typography, and design language. The supplied Premier League screenshots guide layout and interaction only.

Relevant files:

- `mobile/types/index.ts`
- `mobile/constants/theme.ts`
- `mobile/components/events/EventCard.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/_layout.tsx`
- `mobile/app/club-portal.tsx`
- `mobile/app/club/[id].tsx`
- `mobile/lib/api.appwrite.ts`
- `mobile/lib/scoring.ts`
- `mobile/scripts/setup-appwrite.mjs`
- `mobile/app/club-request-pending.tsx`
- `mobile/APPWRITE_AND_VERCEL.md`

## Confirmed product requirements

### Competition model

- Competition teams are separate records linked to existing clubs.
- Competitive matches remain separate from community events.
- Competition/Season is a new destination; Events remains unchanged.
- V1 statistics are fixed by sport according to `Stats design.xlsx`.
- App admins may enter and correct statistic values, but may not configure statistic definitions.
- Initial entry is manual. Keep the service boundary suitable for a future spreadsheet or API importer without redesigning the domain.
- For V1, "game type" means sport. Competition metadata may include division, category, gender, or format, but those values do not dynamically change the statistic registry.

### Fixed V1 statistics

- Basketball: standings, fixtures, PPG, APG, RPG, SPG, BPG, plus the same leaderboards for Lebanese players.
- Football and futsal: standings, fixtures, goals, assists, goal involvements, goalkeeper clean sheets, red cards, and yellow cards.
- Tennis: Lebanese rankings for the top 30 men and top 20 women.
- Padel: men's and women's rankings for classes A, B, C, and D. Fixtures are a future update.
- Volleyball: standings and fixtures only.
- Racing: driver points rankings only.
- Handball: standings, fixtures, goals, assists, blocks, steals, and goalkeeper saves.

### Competition UI

- Provide Matches, Table, and Stats views where supported by the selected sport.
- Include competition/season selection, matchweek or date navigation, filters, reset behavior, standings, leader cards, and expanded rankings.
- Selecting a competitive match opens a dedicated match details route.
- Match details show both teams, a prominent `VS`, match metadata, ticket status, and team-specific imagery.
- Resolve team imagery in this order:
  1. Match-specific override.
  2. Team + competition + venue image.
  3. Team + competition image.
  4. Team + venue image.
  5. Team default image.
  6. Team colors plus logo.

### Ticketing

- General admission supports section-level availability, section price, and quantity.
- Assigned seating provides a premium interactive venue map and an equivalent accessible list by section, row, and seat.
- Deliver tickets both in-app and by email.
- In-app tickets use opaque or signed QR credentials and must not encode purchaser PII or raw order data.
- V1 has no self-service transfers.
- Model cancellation and refund states and provider hooks, but do not enable automated refunds until a provider and refund policy are approved.

### Payment boundary

- No payment provider is selected.
- Do not add a provider SDK or recommend a provider until merchant country, settlement currency, and required payment methods are confirmed.
- Keep checkout feature-gated and unavailable until provider approval.
- LinkUp must never collect or store raw card details.
- The server must validate sale window, inventory, quantity, price, currency, fees, hold ownership, and order state.
- A browser/app redirect is not proof of payment.
- Verify signed provider events and, where required, query the provider before accepting payment.
- Duplicate and out-of-order events must be idempotent.
- Issue tickets exactly once and only after verified payment for the correct order, amount, and currency.

## Recommended architecture

### Domain records

Use additive records rather than modifying community events:

- `competitions`
- `seasons`
- `competition_teams` linked to existing clubs
- `players`
- `team_players`
- `venues`
- `venue_sections`
- `venue_seats`
- `matches`
- `match_team_stats`
- `match_player_stats`
- `stat_corrections`
- `team_media`
- `ticket_offers`
- `ticket_holds`
- `orders`
- `order_items`
- `payment_attempts`
- `payment_events`
- `tickets`
- `ticket_deliveries`

Store money as integer minor units with an explicit ISO currency. Use immutable Appwrite account IDs, not email addresses, for ownership.

### Authorization

- Create an Appwrite `app-admins` team or approved equivalent.
- Verify app-admin membership in server code for every privileged request.
- Do not treat club ownership or a club password as app-admin authorization.
- Deny direct client writes to matches, results, statistics, inventory, orders, payments, and tickets.
- Make correction and payment-event audit records append-only.
- A correction records reason, before/after values, actor ID, timestamp, and correlation/request ID.
- Public reads return only published, sanitized competition data.
- Users may read only their own private orders and tickets.

### Server responsibilities

- Use Appwrite Functions or the repository's approved server convention for privileged mutations, order creation, hold management, payment callbacks, ticket issuance, and delivery jobs.
- Confirm the deployed Appwrite SDK/version and transaction support before relying on atomic database transactions.
- Hold acquisition and final order settlement must be atomic or provide equivalent conflict-safe compare-and-retry behavior.
- Standings and leaderboards are server-derived from authoritative results/stat lines; clients do not submit calculated rankings.

### Payment adapter

Define a provider-neutral server interface for:

- creating hosted checkout;
- verifying webhook/event authenticity;
- fetching provider payment state;
- cancellation;
- refund initiation and status.

Implement a fake adapter for automated testing. Do not implement a live adapter until separately approved.

## Migration and rollback

- Use versioned, additive, idempotent migration scripts.
- Provide dry-run output and validate required indexes, relationships, field limits, and permissions.
- Apply to an active staging project first and capture a metadata backup/export.
- Do not transform or delete current club/community event data.
- Rollback disables the feature flag, routes, and new write functions and releases or expires open holds.
- Never delete financial history, payment events, audit records, or issued tickets as a rollback technique.
- Production migration requires separate approval.

## Ordered implementation tasks

### Task 1 — Domain contracts and fixed sport-stat registry

**User-visible outcome:** None yet; this establishes the reliable definitions used by every later screen.

**Requirements covered:** Fixed workbook statistics, sport meaning, match/ticket/payment states, money validation, team-media precedence.

**Dependencies:** Clean implementation branch and approved plan.

**Reuse:** Existing TypeScript types, sport theme constants, API abstraction, and Appwrite IDs.

**Likely affected areas:**

- `mobile/types/index.ts`
- `mobile/constants/theme.ts`
- new `mobile/lib/competition/*`
- new `mobile/lib/ticketing/*`
- focused domain tests

**States/validation:** Reject unknown statistic codes, invalid score structures, negative or non-finite values, invalid money, unsupported currency, and invalid state transitions.

**Desktop/mobile:** Shared platform-neutral domain code.

**Accessibility:** No UI in this task.

**Must remain unchanged:** Community-event types, activity scoring, RSVP, and club leaderboards.

**Non-goals:** Screens, collections, migrations, payment SDKs, or production data.

**Acceptance criteria:** Every workbook requirement maps to a versioned immutable definition; all validation and resolver tests pass.

**Verification/evidence:** TypeScript output, unit-test output, and workbook-to-registry review matrix.

**Risks/regressions:** Accidentally changing existing `Sport` behavior or coupling statistics to UI labels.

**Completion gate:** Definitions contain no unresolved product interpretation and pass review.

### Task 2 — Additive Appwrite schema and authorization

**User-visible outcome:** None until data is published; secure staging storage exists.

**Requirements covered:** Separate competition data, app-admin corrections, media, venues, inventory, orders, payments, and tickets.

**Dependencies:** Task 1 and an active staging Appwrite project.

**Reuse:** Existing Appwrite configuration conventions, but not its broad permission grants.

**Likely affected areas:** Versioned migration scripts, migration tests, Appwrite configuration, server API adapters, and generated/shared types.

**Required states:** Migration dry-run, already-applied, partial failure, index readiness, permission denial, rollback/disable.

**Desktop/mobile:** Not applicable beyond compatible read APIs.

**Accessibility:** Not applicable.

**Must remain unchanged:** Existing collections, community events, club portal, and production project.

**Non-goals:** Seed production data, UI, or live checkout.

**Authorization tests:**

- unauthenticated correction denied;
- ordinary user denied;
- club owner/admin denied unless also an app admin;
- current app admin accepted;
- revoked membership denied;
- direct database mutation denied;
- cross-competition identifier tampering denied;
- other user's order/ticket/QR denied;
- audit update/delete denied;
- public reads expose no purchaser/admin data.

**Verification/evidence:** Dry-run, staging apply, permission-test output, schema/index inventory, rollback rehearsal.

**Completion gate:** All authorization tests and migration/rollback checks pass.

### Task 3 — App-admin match and statistics management

**User-visible outcome:** App admins can create/update match results and correct fixed statistics with a reason and audit history.

**Dependencies:** Tasks 1–2.

**Reuse:** Current form primitives, loading/error patterns, and LinkUp design tokens.

**Likely affected areas:** `mobile/app/admin/matches/*`, `mobile/components/competition/admin/*`, competition function/API, and audit tests.

**Required states:** Loading, no season, draft, validation error, save error, concurrent conflict, success, revoked permission, and read-only completed match.

**Desktop/mobile:** Compact mobile form and efficient desktop table/form layout.

**Accessibility:** Explicit labels, field-level errors plus error summary, focus management, numeric input hints, and non-color-only validation.

**Must remain unchanged:** Club portal and community-event administration.

**Non-goals:** Configurable statistic definitions, spreadsheet upload, live feeds, or club-admin correction rights.

**Acceptance criteria:** Every accepted correction is authorized, validated, audited, and causes server-derived standings/leaderboards to recalculate.

**Verification/evidence:** Authorized and unauthorized recordings, test output, and before/after audit examples.

**Completion gate:** Positive workflow, negative authorization, conflict handling, and audit integrity pass.

### Task 4 — Competition/Season destination

**User-visible outcome:** Users browse Matches, Table, and Stats in a new destination while Events remains unchanged.

**Dependencies:** Published staging data from Tasks 2–3.

**Reuse:** Existing tab navigation, header, filter controls, cards, spacing, colors, typography, and responsive shell.

**Likely affected areas:**

- `mobile/app/(tabs)/_layout.tsx`
- new `mobile/app/(tabs)/competition.tsx`
- new `mobile/app/competition/[id].tsx`
- `mobile/components/competition/*`
- competition read API

**Required states:** Skeleton, no competitions, empty season, no matches, no standings, unsupported/no player stats, partial data, offline/error/retry, and unavailable content.

**Desktop/mobile:** Verify widths 320, 390, 430, 768, and desktop; test native iOS/Android and web.

**Accessibility:** Keyboard-accessible tabs/filters, screen-reader labels, visible focus, at least 44x44 practical targets, and reduced-motion support.

**Must remain unchanged:** Existing Events routes/cards/RSVP and LinkUp theme.

**Non-goals:** Fantasy, news, live commentary, Premier League branding, or unrelated navigation redesign.

**Acceptance criteria:** Sport-appropriate Matches/Table/Stats content renders correctly and filters/navigation work consistently across targets.

**Verification/evidence:** Responsive screenshots for every tab, native/web recordings, automated checks, and console output.

**Completion gate:** All UI states and regression checks pass with no unexpected console errors.

### Task 5 — Match details and team media

**User-visible outcome:** A competitive match opens a dedicated page with both teams, prominent `VS`, metadata, imagery, and ticket status.

**Dependencies:** Task 4 and approved team-media data.

**Reuse:** Existing image/loading primitives and LinkUp match-card styling.

**Likely affected areas:** New `mobile/app/match/[id].tsx`, match-header/media components, resolver integration, and match API methods.

**Required states:** Upcoming, live, final, postponed, cancelled, image loading/failure, every fallback level, tickets available, not on sale, sold out, sales closed, and booking unavailable.

**Desktop/mobile:** Responsive two-team composition without obscuring text or controls.

**Accessibility:** Meaningful logo/team labels, sufficient text contrast over images, and status not conveyed by color alone.

**Must remain unchanged:** Community-event card routing.

**Non-goals:** Booking inventory implementation or live match commentary.

**Acceptance criteria:** Competitive match cards route correctly and every status/media fallback produces a complete usable page.

**Verification/evidence:** Mobile/web screenshots for statuses and all fallback levels.

**Completion gate:** Navigation, fallbacks, accessibility, and Events regression pass.

### Task 6 — Premium venue selection and inventory holds

**User-visible outcome:** Users select a general-admission quantity or assigned seats from a premium venue experience.

**Dependencies:** Tasks 2 and 5 plus approved venue map, inventory, and pricing data.

**Reuse:** LinkUp cards/buttons, existing modal patterns, and shared money formatting.

**Likely affected areas:** New `mobile/app/match/[id]/book.tsx`, `mobile/components/ticketing/*`, venue/inventory server API, and hold-expiration process.

**Required states:** Loading, no inventory, sold out, sale closed, invalid quantity, low availability, inaccessible/companion seating, seat lost, conflict, hold expired, network retry, repricing, and permission failure.

**Desktop/mobile:** Touch-friendly pan/zoom or approved map interaction on mobile; keyboard/mouse use on web; stable desktop layout.

**Accessibility:** Accessible section/row/seat list equivalent, announced selections, logical focus, and no color-only seat state.

**Must remain unchanged:** Match statistics and community-event booking/RSVP behavior.

**Non-goals:** Resale, transfers, dynamic pricing, promo codes, or unapproved fees.

**Acceptance criteria:** GA totals are correct; assigned-seat selection is usable visually and non-visually; holds are server-owned and conflict-safe.

**Verification/evidence:** Last-ticket concurrency tests, expiry tests, keyboard/screen-reader audit, and mobile/desktop recordings.

**Completion gate:** Inventory cannot oversell and all selection/expiry states pass.

### Task 7 — Order service and payment-ready boundary

**User-visible outcome:** Validated orders and payment states exist, but live checkout remains disabled until provider approval.

**Dependencies:** Task 6.

**Reuse:** Appwrite authentication/session and server API conventions.

**Likely affected areas:** Order/payment function, provider adapter, new `mobile/app/booking/[orderId].tsx`, and idempotency/payment-event tests.

**Required states:** Checkout unavailable, awaiting checkout, pending, paid, failed, cancelled, cancellation requested, refund unavailable, refund pending, partially refunded, refunded, and refund failed.

**Desktop/mobile:** Consistent order summary/status on all targets; app/web return routes remain safe if reopened.

**Accessibility:** Status changes announced, progress not color-only, clear recovery actions, and focus on actionable errors.

**Must remain unchanged:** Existing placeholder membership/subscription payment behavior unless separately approved.

**Non-goals:** Provider selection, real checkout, real charges, or enabled automated refunds.

**Acceptance criteria:** Server ignores client totals, validates authoritative values, creates idempotent orders, and never treats a redirect as payment confirmation.

**Verification/evidence:** Fake-provider tests for success, decline, cancel, asynchronous pending, return-before-event, event-before-return, duplicate/out-of-order event, invalid signature, amount/currency mismatch, expired hold, repeat click, last-seat concurrency, retry, and exactly-once issuance.

**Completion gate:** All fake-adapter and security scenarios pass; live provider work remains explicitly blocked.

### Task 8 — Ticket issuance, QR validation, and email delivery

**User-visible outcome:** Confirmed orders issue tickets exactly once; tickets appear in-app and are queued for email.

**Dependencies:** Task 7 and approved email delivery service.

**Reuse:** Existing authenticated user/session state and LinkUp card layouts.

**Likely affected areas:** New `mobile/app/tickets/[id].tsx`, ticket issuance/validation function, email adapter/queue, and QR presentation component.

**Required states:** Issuing, active, used, cancelled, refund pending, refunded, delivery queued, delivery failed, and delivery retry.

**Desktop/mobile:** QR and ticket details are readable without exposing secrets; responsive wallet-style layout.

**Accessibility:** Ticket details available as text; QR is not the only representation of ticket status; clear delivery state.

**Must remain unchanged:** User identity/authentication and unrelated profile areas.

**Non-goals:** Self-service transfers, resale, wallet passes, or production email until approved.

**Acceptance criteria:** Only verified paid orders issue tickets; duplicate events cannot duplicate them; ownership and QR tampering checks pass; email failure does not invalidate in-app access.

**Verification/evidence:** Exactly-once, duplicate-event, ownership, tampering, cancellation/refund, and delivery retry test output plus screenshots.

**Completion gate:** Ticket security and delivery recovery pass.

### Task 9 — Cross-platform audit and regression

**User-visible outcome:** The complete approved scope behaves consistently across web, iOS, and Android.

**Dependencies:** All applicable prior tasks.

**Verification:**

- TypeScript and Expo web export.
- Existing security checks.
- New domain, authorization, migration, concurrency, order, payment, and ticket tests.
- Browser console and network-error review.
- Responsive screenshot comparison against supplied references.
- Native device/simulator recordings.
- Events, Clubs, Leagues, Profile, authentication, deep-link, and back-navigation regression.
- Keyboard and screen-reader pass.
- Real provider sandbox suite only after provider approval.

**Completion gate:** No Critical or High defects, no unresolved authorization failure, and traceable evidence for every acceptance item. Merge/deployment remain separate decisions.

## Employee Audit and Fix Guide

### Prepare

1. Record task, branch, commit, environment, and approved scope.
2. Use staging/test credentials only.
3. Record platform, OS, browser/device, viewport, role, Appwrite project, and test-data version.
4. Follow repository instructions before running or changing the app.

### Required matrix

- Web: current Chrome, Safari/WebKit, and Firefox where available.
- Native: representative iOS and Android phone.
- Widths: 320, 390, 430, 768, and desktop.
- Roles: signed out, normal user, club owner/admin without app-admin membership, app admin, and revoked app admin.
- Workflows: browse competition; switch Matches/Table/Stats; open match; exercise media fallbacks; correct statistics; select GA tickets; select assigned seats; expire/conflict a hold; exercise payment states; view/validate a ticket; regress Events.

### Compare with references

- Compare hierarchy, spacing, information density, date grouping, filters, tab behavior, standings, leader cards, match header, and booking interaction.
- Use LinkUp colors and typography; do not reproduce Premier League branding.
- Treat unclear or cropped handwritten content as an open question rather than inventing behavior.

### Audit focus

- Responsive layout and safe-area/navigation overlap.
- Loading, empty, validation, error, offline/retry, permission, and concurrency states.
- Keyboard traversal, focus, screen-reader order, labels, error association, contrast, target size, reduced motion, and non-color-only meaning.
- Correct authorization for every privileged write and private read.
- Existing community Events and other navigation regressions.

### Evidence

- Before/after screenshots at required widths.
- Short navigation and seat-selection recordings.
- Complete test command/results.
- Browser console output.
- Relevant sanitized network responses.
- Role and test-data IDs.
- Migration dry-run/apply/rollback output when applicable.
- Sanitized payment event/idempotency evidence.

### Severity

- **Critical:** Authorization bypass, overselling, false payment confirmation, duplicate tickets, or card/secret/PII exposure.
- **High:** Core workflow unusable, material data corruption, cross-user data access, or major platform breakage.
- **Medium:** Significant state, accessibility, responsiveness, validation, or recovery defect with a workaround.
- **Low:** Cosmetic inconsistency that does not block or mislead.

### When the employee may fix directly

Fix directly only when the issue is reproducible, expected behavior is explicit, the change stays within the active task, and it requires no new dependency, schema/product/payment decision, or unrelated redesign.

Stop and escalate when references conflict; a product/legal/payment decision is missing; a migration becomes destructive; another task or Events behavior would change; credentials/data/licensing are missing; or security depends on an unverified capability.

After a fix, rerun the failing case, related tests, authorization negatives when access changed, TypeScript/build checks, responsive/native checks, and affected regression flows.

### Audit report template

```markdown
# Task Audit Report

- Task tested:
- Branch and commit:
- Environment:
- Platform/browser/device:
- Viewport:
- User role:
- Test-data identifiers:

## Test Result

- Test case:
- Expected result:
- Actual result:
- Status: Pass / Fail
- Severity: Critical / High / Medium / Low / N/A
- Evidence:
- Reproduction steps:

## Analysis and Fix

- Root cause:
- Fix made:
- Files changed:
- Why the fix remains within task scope:
- Verification after the fix:
- Tests/checks rerun:
- Remaining risks:
- Escalations/open questions:
```

## Open decisions and required access

- Competition names, seasons, tie-break rules, and initial team/player data.
- Licensed team, venue, and competition imagery.
- Venue maps, sections, accessible seating, inventory, and pricing.
- Active staging Appwrite project, scoped migration credentials, Function deployment access, and test app-admin accounts.
- Vercel preview environment and iOS/Android test targets.
- Email provider and approved sender.
- Merchant country, settlement currency, required payment methods, provider/sandbox, and webhook secret.
- Cancellation/refund policy, taxes/fees, ticket terms, and legal review.

## Known risks

- The prior Appwrite project was reported paused; staging availability must be confirmed.
- Existing broad permissions are unsafe for these records.
- Appwrite transaction support may require SDK/project upgrades.
- Venue-map quality and assigned-seat complexity depend on source geometry.
- Team/logo/image licensing must be established.
- Time-zone and currency mistakes can affect sale windows and totals.
- Email delivery and QR replay require operational monitoring.
- Consumer/refund/tax rules depend on merchant jurisdiction.

## First approved implementation task

Begin with **Task 1 — Domain contracts and fixed sport-stat registry**. Do not start Task 2 until Task 1 has been implemented, audited, fixed within scope, rerun, and accepted.
