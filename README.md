# R6 Team Planner

A Rainbow Six Siege planner for a five-player squad (Samuel, Anthony, Xavier, Mathis, William):

- **Roll** a distinct random operator for each player. A roll respects the selected side, bans, owned operators, favourites and "avoid" lists.
- **Re-roll** a single player without touching the rest of the lineup.
- **Pick a map and bomb site** from the current ranked pool, with editable team notes and per-player notes.
- **Roll a tactic** for the map, side and site. The app checks whether the lineup covers the tactic's required roles, and **Re-roll to fit** swaps only as many players as needed.
- **Copy lineup** produces Discord-ready text:
  `Map: Bank | Site: B Lockers / CCTV Room | Attackers: Samuel - Ash | Anthony - Thermite | ...`
- **Live sync**: when anyone rolls or changes the map, site, side or bans, everyone's screen updates (Supabase Realtime).

Stack: Vite + React (JavaScript), Supabase (Postgres + Realtime), Vitest. It deploys to Vercel as a static site.

---

## Contents

1. [Security model (read first)](#security-model-read-first)
2. [Setup: Supabase](#1-create-the-supabase-project)
3. [Setup: local development](#4-run-locally)
4. [Setup: Vercel](#5-deploy-on-vercel)
5. [Running tests](#running-tests)
6. [Adding operators, images and maps](#adding-operators)
7. [Tactics: editing and committing to the repo](#tactics)
8. [How rolling works](#how-rolling-works)
9. [Troubleshooting](#troubleshooting)

---

## Security model (read first)

This app has **no real authentication**, and that is by design:

- The Supabase **anon key** is bundled into the website, as it is in every Supabase frontend. Anyone who has the site can extract it.
- Row Level Security is **enabled**, but the policies in `supabase/schema.sql` deliberately allow the `anon` role to read and write the team tables. Everything is open to the team.
- The **team passcode** is a *light gate*. The app hashes what you type and compares it with a hash stored in the `team_settings` table, **in the browser**. Anyone with the link and the passcode, or anyone who reads the anon key out of the site, can read and write everything.
- The five profiles are just names. Picking "Samuel" doesn't prove you are Samuel.

Fine for a friends' planning board. **Do not store anything private in it.** Never put the Supabase **service role** key in this project, in `.env`, or in Vercel.

---

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) and click **New project** (the free tier is fine).
2. Pick a name, a database password (you won't need it in the app) and a region near your team.
3. Wait for the project to finish provisioning.

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates the tables (`profiles`, `owned_operators`, `preferred_operators`, `tactics`, `map_notes`, `team_state`, `team_settings`), seeds the five profiles, enables RLS with the permissive team policies, and turns on Realtime. The script is safe to run again.

## 3. Set the team passcode

Still in the SQL editor, run this **one statement**, replacing `YOUR-PASSCODE` with your team passcode:

```sql
update public.team_settings
set passcode_hash = encode(sha256(convert_to('r6tp:' || 'YOUR-PASSCODE', 'UTF8')), 'hex')
where id = 1;
```

- Only the hash is stored. The passcode itself never goes into the repo.
- To change it, run the statement again with a new passcode.
- Leading and trailing spaces in what people type are ignored.
- A correct passcode is remembered for that browser tab session only. `localStorage` holds only the selected profile.

Then grab your keys from **Project Settings → API**: the **Project URL** and the **anon public** key. Don't use the `service_role` key.

## 4. Run locally

Requires Node 20+ (developed on Node 24).

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
VITE_REQUIRE_PASSCODE=false   # set to true to test the passcode screen locally
```

```bash
npm run dev       # http://localhost:5173
```

`.env` is git-ignored. Only `.env.example` is committed.

Without a `.env`, the app shows a "Supabase isn't configured" screen with a **Try it offline** button. Offline mode keeps everything in memory on that one device, which is handy for a quick look.

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |
| `npm run lint` | ESLint |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Serve the production build locally |

## 5. Deploy on Vercel

1. Push the repo to GitHub.
2. In [Vercel](https://vercel.com), click **Add New… → Project** and import the repo.
3. Vercel detects **Vite**. Keep the defaults:
   - Build command: `npm run build`
   - Output directory: `dist`
   - The app uses base path `/` (set in `vite.config.js`).
4. Under **Environment Variables**, add these for *Production* (and *Preview* if you use preview deploys):

   | Name | Value |
   | --- | --- |
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon public key |
   | `VITE_REQUIRE_PASSCODE` | `true` |

5. Click **Deploy**. If you add or change variables after the first deploy, go to **Deployments → ⋯ → Redeploy**. `VITE_*` values are baked in at build time, so a redeploy is required.
6. Share the URL and the passcode with the team.

No `vercel.json` is needed: the app is a single page with no client-side routes. There's no GitHub Pages or GitHub Actions setup; Vercel builds on every push.

About `VITE_REQUIRE_PASSCODE`: `true` shows the passcode screen and `false` hides it. **If it's unset, it defaults to on for production builds and off for `npm run dev`.**

---

## Running tests

```bash
npm test
```

The pure logic lives in `src/lib/roll.js`, `src/lib/fit.js` and `src/lib/tactics.js`. It has no React and no Supabase, and takes an injectable RNG. The tests cover:

- no duplicate operators within the team, and bans always respected
- re-rolling one player keeps the others unchanged
- owned-only pools per player, including overlapping pools solved with matching
- avoid lists (skipped when possible) and favourite weighting (~3×)
- the "not enough operators" error, with a readable message
- tactic filtering by map, side and site, generic fallback, and maps with no sites
- the fit check (one player per required role) and the minimal fit-aware re-roll
- data integrity for `operators.json`, `maps.json` and `tactics.json`
- passcode hashing, which matches the SQL formula

---

## Adding operators

Edit **only** `src/data/operators.json` and add one object:

```json
{ "id": "new-op", "name": "New Op", "side": "attack", "roles": ["intel", "support"] }
```

- `id`: lowercase letters, digits and dashes, with no accents (`tubarao`, `nokk`, `solid-snake`). The id is also the image filename and the key stored in the database.
- `side`: `"attack"` or `"defend"`.
- `roles`: one or more of `hard-breacher`, `soft-breacher`, `intel`, `anchor`, `roamer`, `support`.

Then run `npm test`. A data test checks ids and roles. The test that expects exactly 39 per side will fail on purpose, so update its numbers in `src/data/data.test.js` when the roster grows.

Role assignments are a judgement call. See [`docs/DATA_REVIEW.md`](docs/DATA_REVIEW.md) for the ones flagged for review.

## Adding images

Put a PNG in `public/operators/` named after the operator id:

```
public/operators/thermite.png
public/operators/solid-snake.png
```

A square image of about 128×128 or larger works best (it's shown in a circle). Any operator without an image gets a styled circle with its initials, so you can add images gradually. Use images you have the rights to. The repo doesn't include or hotlink Ubisoft assets.

## Adding or changing maps

Edit `src/data/maps.json`:

```json
{
  "id": "new-map",
  "name": "New Map",
  "sites": {
    "attack": ["2F Site A / Site B", "1F Site C / Site D"],
    "defend": ["2F Site A / Site B", "1F Site C / Site D"]
  },
  "notes": ""
}
```

- The file should hold only the current ranked pool. Remove maps that rotate out.
- `sites.attack` and `sites.defend` are the bomb sites offered for each side (normally the same list).
- If you don't know a map's sites, leave the lists empty. The app says "No bomb sites are defined" and everything else still works.
- `notes` holds the starter **team notes** shown until someone edits them in the app. Edited notes are stored in Supabase.

Several maps currently have **empty site lists on purpose**. See [`docs/DATA_REVIEW.md`](docs/DATA_REVIEW.md).

---

## Tactics

Tactics come from two places:

- `src/data/tactics.json`: built-in tactics committed to the repo. It ships with clearly marked **[Example]** tactics (2 per side for Bank, Clubhouse and Chalet, plus one generic per side) for you to edit or replace.
- The Supabase `tactics` table: everything created or edited in the app.

How they combine:

- Editing a built-in in the app saves a copy with the same id that overrides it.
- Deleting a built-in hides it for everyone.
- Each tactic has an owner (a player, or *team*) and a **Shared with team** flag.

Tabs on the Tactics screen:

| Tab | Shows |
| --- | --- |
| **My tactics** | tactics you own (shared or not) |
| **Team tactics** | team-owned tactics plus everyone's shared ones |
| **By player** | everything a chosen teammate owns (all data is visible by design) |

**Roll tactic** picks from team tactics plus your own. It prefers tactics for the selected map, side and site (a tactic with no site fits any site on its map), and falls back to generic `"any"`-map tactics.

**Committing tactics to the repo:**

1. On the Tactics tab, choose **Team tactics** (or another tab) and click **Export JSON**.
2. Replace `src/data/tactics.json` with the downloaded file, run `npm test`, and commit.

**Import JSON** loads such a file back into the database. On the *My tactics* tab, imports become yours; on any other tab, they become team tactics.

Tactic format:

```json
{
  "id": "bank-atk-basement",
  "name": "Basement split push",
  "side": "attack",
  "mapId": "bank",
  "site": "B Lockers / CCTV Room",
  "description": "Who does what…",
  "requiredRoles": ["hard-breacher", "support", "intel"],
  "shared": true
}
```

`mapId: "any"` makes a generic tactic, and `site: ""` means any site. `requiredRoles` can repeat (for example two anchors), and each required role must be filled by a different player.

---

## How rolling works

- Each player's pool is the selected side's operators, minus bans, and limited to their owned list when **Use owned operators only** is on. That setting is shared team state.
- **Avoid**: skipped for that player unless nothing else is left.
- **Favourite**: rolled about 3× as often (`FAVORITE_WEIGHT` in `src/lib/roll.js`).
- Picks are distinct. If random picking keeps colliding (for example tight owned lists), a bipartite matching finds a valid lineup whenever one exists. When none exists, you get a clear message saying why, instead of a crash.
- **Re-roll to fit** keeps the players who already cover required roles, and re-rolls the fewest remaining players into the missing roles. It only widens to more players when that's the only way.

## Project layout

```
src/
  data/          operators.json, maps.json, tactics.json (+ data tests)
  lib/           roll.js, fit.js, tactics.js (pure + tests), api.js (all Supabase calls),
                 passcode.js, config.js, constants.js, maps.js, operators.js
  state/         useTeamData.js (loading, realtime, optimistic writes, offline mode)
  components/    UI
supabase/schema.sql
docs/DATA_REVIEW.md   data to verify by hand
public/operators/     your operator images
```

## Troubleshooting

| Message | Fix |
| --- | --- |
| "Supabase isn't configured" | `.env` is missing values (local), or the Vercel env vars weren't set before the build: add them and redeploy. |
| "Can't reach the database… project may be paused" | Check your connection. Free Supabase projects pause after inactivity; open the dashboard and click **Restore project**. |
| "The database tables are missing" | Run `supabase/schema.sql`. |
| "No team passcode has been set yet" | Run the passcode statement from step 3. |
| "Wrong passcode" | Re-run the statement from step 3 to reset it. |
| Live dot says "Reconnecting…" | Realtime dropped. It reconnects automatically and catches up on missed changes. |
| "Your change wasn't shared with the team" | The write failed (network or permissions). Your screen shows it; others don't see it yet. Retry once you're back online. |
