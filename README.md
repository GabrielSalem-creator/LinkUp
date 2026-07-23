# LinkUp (One_Community / 1COM)

Sports-club community app for Lebanon — originally built on Base44 as **One_Community / 1COM**, now with a native **React Native (Expo)** app ready to run and ship to the App Store.

## Run the mobile app (recommended)

```bash
cd mobile
npm install
npx expo start
```

Open in Expo Go, a simulator, or press `w` for web.

**Appwrite + Vercel publish:** follow [`mobile/APPWRITE_AND_VERCEL.md`](mobile/APPWRITE_AND_VERCEL.md)  
Project already pointed at `https://fra.cloud.appwrite.io/v1` / `6a61202f000e451a56a8`.

### Vercel deploy (important)

Pushed commit `8a58aa5` includes a ready-made site in **`www/`**.

In Vercel → Project → **Settings → Build & Development Settings**:

1. Framework Preset = **Other**
2. Root Directory = **empty** (repo root) — clear it if set to `mobile`
3. Build Command override = **OFF** (uses `node scripts/vercel-build.mjs`)
4. Output Directory override = **OFF** (uses `.vercel-static`) **or** set to `.vercel-static`
5. Install Command override = **OFF**
6. Production Branch = **`main`**

Then **Deployments → Redeploy** latest `main` with **“Use existing Build Cache” unchecked**.

`vercel.json` now copies `www/` into `.vercel-static` during build (the old `echo` build left the output folder empty → 404).

---

# One_Community — Project Export for Claude Code

This ZIP contains a full export of the "One_Community" app built on Base44, prepared so Claude Code (or any AI coding agent) can understand and rebuild the entire application at a glimpse.

## Contents

- `source/` — the complete application source code, with the exact same file paths as the original project (126 files total).
- `CONVERSATION_HISTORY.md` — the full build conversation log (228 messages) between the user and the Base44 AI builder, showing every instruction, edit, and design decision made throughout development. Read this to understand the *intent* and *history* behind the code.
- `README.md` — this file.

## Tech Stack (detected from package.json)

- Framework: React app scaffolded via Vite, using the Base44 SDK (`@base44/sdk`) for backend/data/auth.
- Key dependencies: @base44/sdk, @base44/vite-plugin, @hello-pangea/dnd, @hookform/resolvers, @radix-ui/react-accordion, @radix-ui/react-alert-dialog, @radix-ui/react-aspect-ratio, @radix-ui/react-avatar, @radix-ui/react-checkbox, @radix-ui/react-collapsible, @radix-ui/react-context-menu, @radix-ui/react-dialog, @radix-ui/react-dropdown-menu, @radix-ui/react-hover-card, @radix-ui/react-label, @radix-ui/react-menubar, @radix-ui/react-navigation-menu, @radix-ui/react-popover, @radix-ui/react-progress, @radix-ui/react-radio-group, @radix-ui/react-scroll-area, @radix-ui/react-select, @radix-ui/react-separator, @radix-ui/react-slider, @radix-ui/react-slot, ...
- Dev dependencies: @eslint/js, @types/node, @types/react, @types/react-dom, @vitejs/plugin-react, autoprefixer, baseline-browser-mapping, eslint, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-react-refresh, eslint-plugin-unused-imports, globals, postcss, tailwindcss, ...

## Project Structure (source/)

```
.gitignore
README.md
base44/config.jsonc
base44/entities/Activity.jsonc
base44/entities/Club.jsonc
base44/entities/ClubEvent.jsonc
base44/entities/ClubMembership.jsonc
base44/entities/EventParticipant.jsonc
base44/entities/Friendship.jsonc
base44/entities/League.jsonc
base44/entities/LeagueParticipant.jsonc
base44/entities/Like.jsonc
base44/entities/Memory.jsonc
base44/entities/MerchItem.jsonc
base44/entities/Post.jsonc
base44/entities/User.jsonc
base44/functions/sendClubPasswordReset/entry.ts
components.json
eslint.config.js
index.html
jsconfig.json
package.json
postcss.config.js
src/App.jsx
src/api/base44Client.js
src/components/ProtectedRoute.jsx
src/components/UserNotRegisteredError.jsx
src/components/club-portal/ClubLoginGate.jsx
src/components/club-portal/ClubPortalEvents.jsx
src/components/club-portal/ClubPortalMerch.jsx
src/components/club-portal/ClubPortalPosts.jsx
src/components/club-portal/ClubPortalSettings.jsx
src/components/club-portal/ClubSubscriptionGate.jsx
src/components/club-portal/CreateClubModal.jsx
src/components/clubs/ClubCard.jsx
src/components/clubs/ClubLeaderboard.jsx
src/components/events/EventCalendarPicker.jsx
src/components/events/EventCard.jsx
src/components/events/EventFiltersOverlay.jsx
src/components/feed/CreatePostModal.jsx
src/components/feed/PostCard.jsx
src/components/layout/AppLayout.jsx
src/components/layout/BottomNav.jsx
src/components/leagues/CreateLeagueModal.jsx
src/components/profile/EditProfileModal.jsx
src/components/profile/EventsCalendar.jsx
src/components/profile/FollowStats.jsx
src/components/profile/HistoryTab.jsx
src/components/profile/MemoriesTab.jsx
src/components/profile/ProfileStats.jsx
src/components/shared/EmptyState.jsx
src/components/shared/SportBadge.jsx
src/components/shared/StatCard.jsx
src/components/social/FriendButton.jsx
src/components/ui/accordion.jsx
src/components/ui/alert-dialog.jsx
src/components/ui/alert.jsx
src/components/ui/aspect-ratio.jsx
src/components/ui/avatar.jsx
src/components/ui/badge.jsx
src/components/ui/breadcrumb.jsx
src/components/ui/button.jsx
src/components/ui/calendar.jsx
src/components/ui/card.jsx
src/components/ui/carousel.jsx
src/components/ui/chart.jsx
src/components/ui/checkbox.jsx
src/components/ui/collapsible.jsx
src/components/ui/command.jsx
src/components/ui/context-menu.jsx
src/components/ui/dialog.jsx
src/components/ui/drawer.jsx
src/components/ui/dropdown-menu.jsx
src/components/ui/form.jsx
src/components/ui/hover-card.jsx
src/components/ui/input-otp.jsx
src/components/ui/input.jsx
src/components/ui/label.jsx
src/components/ui/menubar.jsx
src/components/ui/navigation-menu.jsx
src/components/ui/pagination.jsx
src/components/ui/popover.jsx
src/components/ui/progress.jsx
src/components/ui/radio-group.jsx
src/components/ui/resizable.jsx
src/components/ui/scroll-area.jsx
src/components/ui/select.jsx
src/components/ui/separator.jsx
src/components/ui/sheet.jsx
src/components/ui/sidebar.jsx
src/components/ui/skeleton.jsx
src/components/ui/slider.jsx
src/components/ui/sonner.jsx
src/components/ui/switch.jsx
src/components/ui/table.jsx
src/components/ui/tabs.jsx
src/components/ui/textarea.jsx
src/components/ui/toast.jsx
src/components/ui/toaster.jsx
src/components/ui/toggle-group.jsx
src/components/ui/toggle.jsx
src/components/ui/tooltip.jsx
src/components/ui/use-toast.jsx
src/hooks/use-mobile.jsx
src/index.css
src/lib/AuthContext.jsx
src/lib/PageNotFound.jsx
src/lib/ThemeContext.jsx
src/lib/app-params.js
src/lib/query-client.js
src/lib/utils.js
src/main.jsx
src/pages/ClubDetail.jsx
src/pages/ClubPortal.jsx
src/pages/Clubs.jsx
src/pages/Events.jsx
src/pages/Home.jsx
src/pages/Leaderboard.jsx
src/pages/Leagues.jsx
src/pages/LogActivity.jsx
src/pages/MyClubs.jsx
src/pages/People.jsx
src/pages/Profile.jsx
src/utils/index.ts
tailwind.config.js
vite.config.js
```

## How to use this with Claude Code

1. Unzip this archive into a new project folder.
2. Point Claude Code at the `source/` folder as the codebase root.
3. Give Claude Code the `CONVERSATION_HISTORY.md` file for context on what features exist, why they were built, and any nuances/edge cases discussed during development.
4. Note: this app depends on the Base44 SDK/backend (entities, auth, file storage, integrations) as defined in `source/api` and `source/base44` (if present). To fully run it outside Base44, those backend calls will need to be reimplemented or pointed at an equivalent backend.
