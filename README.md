# R6 Team Planner

A Rainbow Six Siege team manager and planner. It starts with a five-player squad (Samuel, Anthony, Xavier, Mathis, William), and you can add players from the app.

Screens (bottom tab bar on phones, top bar on desktop; each has its own link, e.g. `#/matches`):

- **Home**: the team dashboard. Next match with a countdown and one-tap RSVP, matches waiting for a result, win/loss record and recent form, the current plan and lineup, roster availability, recent activity and quick actions.
- **Matches**: schedule scrims and league games (opponent, date and time, competition, map, notes). Upcoming, live, "needs result", completed and cancelled matches look different. Each match has RSVPs (In / Maybe / Out), a prep checklist and a quick score form. **Plan it** jumps to the Plan screen with the match's map.
- **Plan**: the lineup roller, map and site, tactic and bans (below).
- **Tactics**: the **strategy library**. Pick map, site, side and your five players' operators, get strategies ranked by how well they fit, adapt them to your operators, see the tactical board step by step with each operator's instructions, and save your team's version. The original role-based **Quick tactics** are in the second tab.
- **Team**: the roster (Ubisoft username, main role incl. IGL, starter / substitute / former, availability, notes, favourite operators, R6 Tracker link) and everyone's operator lists. The lineup roller uses the **starters** (up to five).

The Plan screen:

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

1. [Upgrading an existing setup](#upgrading-an-existing-setup) (do this if your team already uses the app)
2. [Security model (read first)](#security-model-read-first)
3. [Setup: Supabase](#1-create-the-supabase-project)
4. [Setup: local development](#4-run-locally)
5. [Setup: Vercel](#5-deploy-on-vercel)
6. [Running tests](#running-tests)
7. [Adding operators, images and maps](#adding-operators) (and [operator profiles](#operator-profiles-and-intro-videos))
8. [Strategy library](#strategy-library) and [quick tactics](#tactics-quick-tactics)
9. [How rolling works](#how-rolling-works)
10. [Troubleshooting](#troubleshooting)

---

## Upgrading an existing setup

If your Supabase project was set up before the Matches and Roster features, do these **in this order**:

1. **Deploy the new app first** (merge to `main`; Vercel redeploys). It works with the old database: Matches and roster details show "Database update needed" until step 2.
2. **Re-run `supabase/schema.sql`** in Supabase → SQL Editor. It only adds things; no table or column is renamed or removed, and your data stays. It:
   - adds the tables `player_details`, `matches`, `match_availability` and `match_checklist`, with checks on lengths and allowed values and an index on match time;
   - lets the website add players (new rows in `profiles`, names 1–24 characters). Renaming or deleting players from the website isn't allowed;
   - **hides the passcode hash** from the website and adds `check_team_passcode()` / `team_passcode_is_set()`, so the passcode is checked on the server;
   - turns on Realtime for the new tables.

The strategy library adds two more tables the same way (`strategies`, `strategy_assignments`). Until you re-run the schema, the built-in strategies still work; saving team strategies, references and player assignments is switched off.

Don't do step 2 before step 1: the old app reads the passcode hash directly, so it would show an error at the passcode screen until the new version is live. Your passcode doesn't change.

## Security model (read first)

This app has **no real authentication**, and that is by design:

- The Supabase **anon key** is bundled into the website, as it is in every Supabase frontend. Anyone who has the site can extract it.
- Row Level Security is **enabled**, but the policies in `supabase/schema.sql` deliberately allow the `anon` role to read and write the team tables. Everything is open to the team.
- The **team passcode** is a *light gate*. The database checks it (`check_team_passcode()`), and the stored hash can't be read from the website, so it can't be guessed offline. But it only gates the app's screens: anyone who reads the anon key out of the site can still call the API and read and write the team tables.
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

This creates the tables (`profiles`, `owned_operators`, `preferred_operators`, `tactics`, `map_notes`, `team_state`, `team_settings`, `player_details`, `matches`, `match_availability`, `match_checklist`), seeds the five profiles, enables RLS with the permissive team policies, adds the server-side passcode check, and turns on Realtime. The script is safe to run again.

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

## Operator profiles and intro videos

Click any operator on the **Operators** screen to open their profile: picture, health and speed (1 to 3), ability, primary and secondary weapons, a "how to play" tip, which teammates own, favour or avoid them, and a **Watch intro video** button.

Profile data lives in `src/data/operatorProfiles.json`, keyed by operator id:

```json
"thermite": {
  "health": 2, "speed": 2,
  "ability": "Exothermic Charge",
  "abilityText": "Deployable charge that burns a large hole through reinforced walls.",
  "primary": ["556XI", "M1014"], "secondary": ["5.7 USG", "M45 MEUSOC"],
  "tip": "The classic hard breacher…",
  "video": "https://www.youtube.com/watch?v=…"
}
```

- `video` is optional. Without it, the button opens a YouTube search for that operator's video, which always works. Paste the exact link of the video you like to pin it.
- `check: true` shows a small "still needs checking" note in the profile. See [`docs/DATA_REVIEW.md`](docs/DATA_REVIEW.md).
- The picture is the image from `public/operators/` (see above), or the initials badge.

A data test makes sure every operator has a profile, so add one when you add an operator.

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

## Strategy library

The **Tactics → Strategies** tab is built around your composition:

1. **Map → floor / site → attack or defense.**
2. **Players and operators:** five rows, each a player and the operator they'll play (**Use Plan lineup** copies the Plan screen).
3. **Results** are ranked by fit: ★★★★★ *Perfect operator match*, or e.g. ★★★☆☆ *3/5 operators match · 1 substitute*. Green pills are exact matches, yellow ones substitutes ("Ace ↔ Thermite"), red ones operators you're missing. Filters: search, type, difficulty, source, required role.
4. **Open a strategy** for:
   - its source and fit;
   - **Adapt to your operators**: "Thermite is in the original strategy. You picked Ace…" → **Use Ace**. The strategy updates: the slot, instructions, steps and board labels now say Ace and Ace's gadget, with a reminder to check the gadget differences;
   - the **tactical board**: positions, utility, breach points, drones and paths, coloured per operator. Step chips show one step at a time;
   - **Players and operators**: who plays which slot. These are stored separately from the strategy, so it survives roster changes. Tap an operator for their step-by-step instructions;
   - the strategy **steps** with timing, utility and notes.
5. **Duplicate & customize** (or **Save adapted copy**) creates a team-owned copy and opens the editor: details, operators (alternatives, spawn, instructions), steps, and the board (tap to place markers, drag to move, draw paths per step and operator). The original is never changed. **Load into Plan** sets the Plan screen's map, site, side and lineup.

### Where strategies come from

Every strategy shows one of three labels, and they're never mixed up:

| Label | What it is |
| --- | --- |
| **AI suggestion** | Starting points shipped in `src/data/strategies.json` (21 across Bank, Border, Chalet, Clubhouse, Coastline, Kafe, Oregon and two generic). Written by an AI from general Siege knowledge, **not verified or pro strategies**. Positions are schematic, not exact map spots. |
| **Online reference** | A link to a strategy someone published (website, coach, video), with a summary in your own words and, optionally, the operators it uses so it can be matched. Only metadata is stored; the text and images stay on the original page, which the strategy links to (*Source: … / Original strategy: …*). |
| **Team** / **Adapted by team** | Your own strategies, or copies of the above. A copy keeps a link to what it was adapted from. |

**About importing online strategies:** I couldn't find any R6 strategy source with a public API, feed or licence that allows copying its content. Liquipedia's text is CC BY-SA, but it covers maps and competitive history rather than step-by-step strats. So the app doesn't scrape or copy anything: references are links plus metadata, and your team writes its own adapted version. If a source gives you permission or publishes structured data under an open licence, it can be imported into `strategies.json` with its source and licence fields filled in.

The board uses a schematic of the site's two rooms because the real floor plans are Ubisoft's artwork. In the editor you can set **Board image link** to your own floor-plan screenshot.

### Data model

A strategy is one document (see `src/lib/strategies.js`):

- `slots`: operator, role, alternatives, spawn, instructions;
- `steps`: title, timing, description, operators involved, utility, notes;
- `markers` and `paths`: board coordinates (0–100 × 0–64), each tied to a slot and a step.

The database stores that document in `strategies.doc` and copies the filter fields (map, site, floor, side, type, difficulty, operators, tags, source) into indexed columns. `strategy_assignments` maps (strategy, slot) → player. Saving one document at a time means a save can never half-apply. The document has a `schemaVersion`, so moving steps, markers and paths into their own tables later is a straightforward migration.

## Tactics (quick tactics)

Quick tactics come from two places:

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

`mapId: "any"` makes a generic tactic, and `site: ""` means any site. `requiredRoles` can repeat (for example two anchors), and each required role must be filled by a different player. An optional `"imageUrl": "https://…"` adds a map image (see below).

**Tactic diagrams.** Every tactic gets a picture, drawn automatically:

- On the **Plan** screen, the diagram uses the rolled lineup. Each teammate's operator is placed where their role sets up around the two rooms of the chosen bomb site (hard breacher on the breach wall, soft breacher above the hatch, intel droning, anchors in site, roamers outside…). Required roles nobody covers show as red **?** spots. A numbered legend says who does what.
- On the **Tactics** screen, click **Diagram** on any card to see the roles' spots before rolling.
- It's a schematic (two rooms, not the real floor plan), so it works on every map. For the exact layout, add a **Map image link** in the tactic editor: any `https://` image, such as a screenshot of the site with your setup drawn on it. It shows above the diagram.

The image link is stored in the `image_url` column. **If your database was set up before this column existed, re-run `supabase/schema.sql`** (it's safe to re-run). Tactics without an image keep working either way.

---

## How rolling works

- Each player's pool is the selected side's operators, minus bans, and limited to their owned list when **Use owned operators only** is on. That setting is shared team state.
- **Avoid**: skipped for that player unless nothing else is left.
- **Favourite**: rolled about 3× as often (`FAVORITE_WEIGHT` in `src/lib/roll.js`).
- Picks are distinct. If random picking keeps colliding (for example tight owned lists), a bipartite matching finds a valid lineup whenever one exists. When none exists, you get a clear message saying why, instead of a crash.
- **Re-roll to fit** keeps the players who already cover required roles, and re-rolls the fewest remaining players into the missing roles. It only widens to more players when that's the only way.

## Project layout

Strategy library: `src/lib/strategies.js` (model, validation, adaptation), `src/lib/strategyMatch.js` (matching and ranking), `src/state/useStrategyData.js`, and `src/components/Strategy*.jsx`, `TacticsView.jsx`, `ReferenceForm.jsx`.


```
src/
  data/          operators.json, operatorProfiles.json, maps.json, tactics.json (+ data tests)
  lib/           roll.js, fit.js, tactics.js, diagram.js, matches.js, roster.js, activity.js
                 (pure + tests), api.js (all Supabase calls), passcode.js, config.js,
                 constants.js, maps.js, operators.js
  state/         useTeamData.js (roster, plan, tactics, notes, prefs: loading, realtime,
                 optimistic writes, offline mode), useMatchData.js (matches, RSVPs, checklist),
                 useHashRoute.js, roster-context.js, useNow.js
  components/    UI. Screens: DashboardView, MatchesView, PlanView, TacticsView, TeamView.
                 Shared pieces in ui.jsx (Card, Sheet, EmptyState, DataState, Badge…) and Icon.jsx
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
| "Database update needed" on Matches or the dashboard | Re-run `supabase/schema.sql` (see [Upgrading](#upgrading-an-existing-setup)). |
| "Adding players needs the latest database setup" | Same: re-run `supabase/schema.sql`. |
| "Wrong passcode" | Re-run the statement from step 3 to reset it. |
| Live dot says "Reconnecting…" | Realtime dropped. It reconnects automatically and catches up on missed changes. |
| "Your change wasn't shared with the team" | The write failed (network or permissions). Your screen shows it; others don't see it yet. Retry once you're back online. |
