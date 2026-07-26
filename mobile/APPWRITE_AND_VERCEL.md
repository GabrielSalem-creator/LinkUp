# LinkUp → Appwrite + Vercel (do this in order)

Your project is already wired in code:

| Setting | Value |
|---------|--------|
| Endpoint | `https://fra.cloud.appwrite.io/v1` |
| Project ID | `6a61202f000e451a56a8` |
| Database ID | `linkup` |

---

## Part A — Appwrite Console (5 minutes)

Open: [https://cloud.appwrite.io](https://cloud.appwrite.io) → project **6a61202f000e451a56a8**

### 1) Add web platforms (required or browser calls are blocked)

**Overview → Platforms → Add platform → Web**

Add these hostnames (one platform each):

- `localhost`
- `*` (optional while testing)
- your Vercel domain later, e.g. `linkup-xxx.vercel.app`

### 2) Enable auth methods

**Auth → Settings**

- Enable **Email/Password**
- Enable **Anonymous** (for “Continue as guest”)

### 3) Create an API key (for schema setup only)

**Overview → Integrations → API keys → Create**

Scopes needed:

- `databases.read`
- `databases.write`

Copy the key once.

### 4) Put the key in local `.env`

In `mobile/.env`:

```env
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=6a61202f000e451a56a8
EXPO_PUBLIC_APPWRITE_DATABASE_ID=linkup
APPWRITE_API_KEY=paste_your_key_here
```

### 5) Create all collections + seed Lebanon demo data

```bash
cd mobile
npm run setup:appwrite
npm run seed:appwrite
```

This creates database `linkup` with:

`profiles`, `clubs`, `club_events`, `club_memberships`, `activities`, `leagues`, `league_participants`, `event_participants`, `friendships`, `memories`, `merch`, `posts`

Demo after seed:

- League code: `BEIRUT26`
- Club portal (Run Club Beirut): `demo1234`

### 6) Run locally against Appwrite

```bash
cd mobile
npx expo start --web
```

Login screen → **Register** a real user, or **Continue as guest**.

---

## Part B — Publish on Vercel

### 1) Push to GitHub

Repo: https://github.com/GabrielSalem-creator/LinkUp

### 2) Create / fix Vercel project

1. [vercel.com/new](https://vercel.com/new) → Import **GabrielSalem-creator/LinkUp**
2. **Root Directory** → leave as repo root (`.`) **OR** set to `mobile`
   - Repo root works now via root `vercel.json` → builds `mobile/dist`
   - If Root Directory = `mobile`, it uses `mobile/vercel.json`
3. Framework preset → **Other**
4. Build command / Output are already in `vercel.json` — do **not** override to Next.js
5. Ensure Output Directory is **`mobile/dist`** (root) or **`dist`** (if Root Directory = mobile)

### 3) Environment variables in Vercel

**Project → Settings → Environment Variables** (Production + Preview):

```
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://fra.cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=6a61202f000e451a56a8
EXPO_PUBLIC_APPWRITE_DATABASE_ID=linkup
```

Do **not** add `APPWRITE_API_KEY` to Vercel (server secret for local scripts only).

### 4) Deploy

Click **Redeploy**. After it finishes, open the `.vercel.app` URL — you should see LinkUp, not `404 NOT_FOUND`.

### 5) Allow that hostname in Appwrite

Back in Appwrite → **Platforms → Web** → add `your-app.vercel.app` (no `https://`).

Reload the Vercel site → register / demo login → clubs & events load.

---

## Architecture (what talks to what)

```
Browser (Vercel) ──Expo web──► Appwrite Cloud (FRA)
                                 ├─ Auth (email / anonymous)
                                 └─ Database `linkup` (collections)
```

App code path:

- Screens call `lib/api.ts`
- That routes to `lib/api.appwrite.ts` (live) or `lib/api.mock.ts` (offline)
- Toggle mock: `EXPO_PUBLIC_USE_MOCK=1`

---

## CLI alternative (optional)

```bash
npm i -g vercel
cd mobile
vercel
```

Follow prompts; set the same env vars when asked.

---

## If something fails

| Symptom | Fix |
|---------|-----|
| Vercel blank / `404 NOT_FOUND` | Redeploy latest commit. Framework = **Other**. Output = `mobile/dist` (root) or `dist` (Root Directory = mobile). Do not use Next.js preset. |
| `Invalid origin` / CORS | Add hostname under Appwrite Platforms |
| Guest login fails | Enable Anonymous in Auth settings |
| Empty Events list | Run `npm run seed:appwrite` |
| `Missing APPWRITE_API_KEY` | Paste key into `mobile/.env` |
| Vercel blank page | Confirm build logs show `Exported: dist` and Output Directory matches |

---

## Côte Sport stubs (MVP)

- **Club subscription:** `CLUB_SUBSCRIPTION_USD = 0` in `constants/theme.ts`. Whish pay button records `payment_intent` only.
- **Strava / Apple Health:** UI in `/connections` with local AsyncStorage toggles — no OAuth/HealthKit yet.
- **Event completion codes:** stored as `attendance_password` on `club_events`; users complete from Profile → Events.
