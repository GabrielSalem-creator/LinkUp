# LinkUp — React Native (Expo)

Native + web app for Lebanon’s sports clubs (Events, My Clubs, MyLeague, Profile, Club Portal).  
Backend: **Appwrite** (`fra.cloud.appwrite.io`, project `6a61202f000e451a56a8`). Deploy web on **Vercel**.

## Appwrite + Vercel (full guide)

Follow **[APPWRITE_AND_VERCEL.md](./APPWRITE_AND_VERCEL.md)** — console steps, schema script, seed, and Vercel env vars.

Quick version after you paste `APPWRITE_API_KEY` into `.env`:

```bash
cd mobile
npm run setup:appwrite
npm run seed:appwrite
npx expo start --web
```

## Run it locally

```bash
cd mobile
npm install
npx expo start
```

Then:

- Press **`w`** for web preview in the browser  
- Scan the QR code with **Expo Go** on your phone  
- Press **`a`** / **`i`** for Android emulator / iOS simulator  

Login screen: register, sign in, or continue as guest.  
Offline mock: set `EXPO_PUBLIC_USE_MOCK=1`.

### Demo tips

| Action | How |
|--------|-----|
| Join league by code | `BEIRUT26` on MyLeague |
| Club portal password | Select **Run Club Beirut** → `demo1234` |
| Friend request | People screen (bell on Events) |
| Dark mode | Profile → moon icon |

## App structure

```
mobile/
  app/
    (tabs)/          Events · My Clubs · MyLeague · Profile
    clubs/           Explore clubs
    club/[id]        Club detail
    people           Friends / discovery
    club-portal      Club owner portal
  lib/api.ts         Data layer (swap mock → Base44/backend here)
  data/mock.ts       Lebanon demo data
  constants/theme.ts Teal athletic theme (Space Grotesk + Inter)
```

## App Store path (when ready)

1. Create an [Expo](https://expo.dev) account and run `npx eas-cli login`
2. `npx eas build:configure`
3. Replace `extra.eas.projectId` in `app.json`
4. `npx eas build --platform ios` (needs Apple Developer account)
5. `npx eas submit --platform ios`

Android Play Store uses the same EAS flow with `--platform android`.

## Backend integration (guided)

Today every screen talks to `lib/api.ts` (mock). When you are ready, we will replace methods one entity at a time:

1. Auth (`api.auth`)
2. Clubs / Events
3. Memberships & Event participants
4. Leagues
5. Friendships / social
6. Club portal + Stripe subscription

Keep Base44 credentials for the web `source/` app; the mobile app can call the same backend once you provide `APP_ID` / base URL.

## Product mapping

| Web (source/) | Mobile |
|---------------|--------|
| `/` Events | `(tabs)/index` |
| `/my-clubs` | `(tabs)/my-clubs` |
| `/leaderboard` | `(tabs)/leagues` |
| `/profile` | `(tabs)/profile` |
| `/clubs` | `clubs/index` |
| `/clubs/:id` | `club/[id]` |
| `/people` | `people` |
| `/club-portal` | `club-portal` |
