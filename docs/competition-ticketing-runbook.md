# Competition / Season, Match Details & Ticketing — implementation runbook

Implements `docs/plans/2026-09-30-competition-season-ticketing.md` (`[COMP-001]`). Merged to `main` on 2026-10-10. **Vercel's production branch is `master`**: pushes to `main` create Preview deployments only, so after merging to `main` also run `git push origin main:master` (or change Production Branch to `main` in Vercel → Settings → Git).
Everything runs against the existing Appwrite Cloud project (`6a61202f000e451a56a8`, db `linkup`), which currently
serves as both staging and production. Community collections (clubs, club_events, RSVPs, leagues…) were not touched.

## What was built (by plan task)

| Task | Where | Status |
|---|---|---|
| 1 Domain contracts + fixed sport-stat registry | `mobile/lib/competition/*`, `mobile/lib/ticketing/*`, `mobile/tests/*.domain.test.ts` | done, 31 unit tests |
| 2 Additive Appwrite schema + authorization | `mobile/scripts/schema/competition-v1.mjs`, `mobile/scripts/migrate-competition.mjs`, team `app-admins` | applied + verified (27 collections) |
| 3 App-admin match & statistics management | function `linkup-api` (`mobile/functions/linkup-api/src/admin.ts`), `mobile/app/admin/*` | done, audited corrections, version conflicts |
| 4 Competition/Season destination | `mobile/app/(tabs)/competition.tsx`, `mobile/components/competition/*` | done (Matches / Table / Stats / Rankings) |
| 5 Match details + team media | `mobile/app/match/[id]/index.tsx`, `TeamHero`, `lib/competition/media.ts` | done, 6-level fallback |
| 6 Venue selection + inventory holds | `mobile/app/match/[id]/book.tsx`, `components/ticketing/VenueMap.tsx`, `functions/.../ticketing.ts` | done, lock-ID based, cannot oversell |
| 7 Order service + payment-ready boundary | `functions/.../payments/*`, `mobile/app/booking/[orderId].tsx` | done; fake adapter only, live provider blocked |
| 8 Ticket issuance, QR validation, email delivery | `functions/.../tickets.ts`, `mobile/app/tickets/*`, `mobile/app/admin/scan.tsx` | done; email queue-only until a sender is approved |
| 9 Cross-platform audit | web verified in Chrome; native not yet run on device | partial (see "Not done") |

## Architecture

- **Public reads** go straight to Appwrite collections with `read("any")` and **no client write grants**.
- **Private records** (`orders`, `tickets`, `ticket_holds`, `inventory_locks`, `payment_*`, `stat_corrections`, `ticket_deliveries`)
  have no collection-level grants; the server grants `read("user:<id>")` per document. Audit rows are never updated/deleted.
- **All privileged writes** go through the Appwrite Function `linkup-api` (node-22). It verifies `app-admins` team membership
  server-side for admin routes; club ownership / club password confers nothing.
- **Inventory**: a unit (GA slot or seat) is sold/held by creating `inventory_locks/<hash(offer, unit)>`. Document-ID
  uniqueness is the atomic primitive; expired locks are reclaimed with delete-then-create. Tickets use
  `tickets/<hash(order, unit)>` so duplicate payment events cannot duplicate tickets.
- **Payments**: provider-neutral interface (`payments/adapter.ts`), `NullProvider` (checkout unavailable) and
  `FakeProvider` (HMAC-signed events, test-mode checkout page inside the app). Redirects are never proof of payment:
  `/orders/:id/sync` queries the provider; webhooks are verified, deduplicated by event id, amount/currency-checked and
  tolerant to out-of-order events.
- **QR**: `LKT1.<ticketId>.<nonce>.<hmac>` signed with `TICKET_SIGNING_SECRET`; no PII, verified server-side on scan.
- **Standings / leaderboards / rankings** are derived server-side after every accepted change (`competition.ts`).

## Commands (run inside `mobile/`)

```bash
npm run typecheck                 # tsc
npm test                          # 62 domain + server tests (node:test, in-memory DB + fake provider)
npm run migrate:competition -- --dry-run | --apply | --verify | --inventory | --rollback
npm run deploy:function           # build (tsc) + upload + activate + env vars/scopes/schedule
npm run seed:competition -- --enable-test-checkout   # staging data (idempotent)
npm run admin -- ensure-admin <email> <password>     # grant app-admins membership
npm run admin -- recalc-all <admin-email>            # recompute standings/leaderboards
npm run test:authz                # 37 live authorization/permission checks against Appwrite + the function
npm run build:web                 # expo export + index patch (dist/ committed for Vercel)
```

## Feature flags & secrets

- `app_settings/ticketing`: `competition_enabled`, `checkout_enabled` (admin-toggleable, audited), `refunds_enabled` (false), `hold_ttl_seconds`.
- Function env: `PAYMENT_PROVIDER` (`none` | `fake`), `EMAIL_PROVIDER` (`none` | `appwrite`), `TICKET_SIGNING_SECRET`,
  `FAKE_PROVIDER_SECRET`, `APP_PUBLIC_URL`, `PAYMENT_WINDOW_SECONDS`. Secrets live in `mobile/.env` (gitignored).
- **Staging is currently in TEST MODE**: `PAYMENT_PROVIDER=fake` and `checkout_enabled=true`, labelled in the UI.
  Before go-live: set `checkout_enabled=false` (Admin → Tools → Pause online checkout) or redeploy with `PAYMENT_PROVIDER=none`.

## Rollback

`npm run migrate:competition -- --rollback` disables the feature flags and releases open holds. It never deletes
collections, financial history, payment events, audit rows or issued tickets.

## Not done / open decisions (from the plan)

- Native iOS/Android device recordings and keyboard/screen-reader passes were not run (web only, Chrome).
- No live payment provider (needs merchant country, settlement currency, payment methods, provider, webhook secret).
- No approved email sender: deliveries stay `queued`; in-app tickets remain valid. `EMAIL_PROVIDER=appwrite` wires Appwrite Messaging once a provider is configured.
- Refund policy not approved: `refunds_enabled=false`; paid orders can only request cancellation.
- Real competition names, seasons, tie-break rules, rosters, licensed imagery, venue maps and pricing are seed data.

## Test accounts (staging)

- `admin@linkup.app` — app admin (created by `admin-tools.mjs`).
- `demo@linkup.app` — the existing demo user, now also an app admin for testing; revoke with `npm run admin -- revoke-admin demo@linkup.app`.
