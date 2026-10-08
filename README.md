# R6 Tactical Command

A Rainbow Six Siege tactical planner for one team: a coach's digital whiteboard backed by a strategy library and adapted to the team's own operators and players. It answers one question first: **what are we playing, where are we playing it, and what is everyone supposed to do?**

Screens (bottom tab bar on phones, top bar on desktop; each has its own link, e.g. `#/strategies`):

- **Command** (home): create a strategy, jump to attack or defense plans, maps, the operator library and the team's saved strategies, with the featured plan on the board.
- **Strategy builder** (`#/build`, the **New strategy** button): map → site → attack/defense → five operators (with synergy suggestions, or roll them) → players and tactical roles → start from a library strategy adapted to your operators, or a blank board → customize → draw the tactics → steps and timing → save.
- **Strategies**: the team library, organised **Attack / Defense → map → strategy**, with favourites, versions (v1, v2, v3…), duplication and side-by-side comparison. Also **Find by composition**: strategies recommended around your **favorite** operators, with **blocked** operators never used, and the reasons shown on every result. and the older role-based **Quick tactics**.
- **Strategy view**: the tactical board step by step, the round clock timeline, each operator's role, player and instructions, synergy, plus:
  - **Coach mode**: full-screen presentation. *STEP 4 / 7 · 0:31 · Thermite: "Move to breach position."* → **Next step**.
  - **Player view**: one player sees only their operator, positions, routes, utility, crossfires and timing.
- **Maps**: every map and bomb site, the **floor plans** you've added (with calibrated callouts and a list of missing ones), the plans for each site and side, and the team's map notes.
- **Operators**: every operator with their portrait, roles and gadget, and the well-known pairs (Thermite + Thatcher, Smoke + Mute…).
- **Team**: the roster and everyone's operator pools. The old lineup roller is still there (**Lineup roller**).
- **In-game overlay** (Windows desktop app, optional): your part of the chosen strategy on top of Siege while you play, one step at a time with hotkeys. Read-only. See [In-game overlay](#in-game-overlay).

The **tactical map** supports players (with operator portraits), enemies, spawns, waypoints, drones and drone routes, cameras, operator-specific utility and general gadgets, traps, hard/soft/vertical breaches, reinforcements, rotation holes, plant spots, objectives, movement / entry / clearing / rotation routes, hold, contest, danger, no-entry, watch and enemy-likely areas (draw, move, resize, label), crossfires (player A + player B → an engagement area), and notes attached to a player, marker, location or step. Every object can carry a purpose, timing and instructions. Undo/redo, keyboard shortcuts and a grouped toolbar included.

Stack: Vite + React (JavaScript), Supabase (Postgres + Realtime), Vitest. It deploys to Vercel as a static site.

---

## Contents

1. [Upgrading an existing setup](#upgrading-an-existing-setup) (do this if your team already uses the app)
2. [Security model (read first)](#security-model-read-first)
3. [Setup: Supabase](#1-create-the-supabase-project)
4. [Setup: local development](#4-run-locally)
5. [Setup: Vercel](#5-deploy-on-vercel)
6. [Running tests](#running-tests)
7. [Adding operators, portraits and maps](#adding-operators) (and [operator profiles](#operator-profiles-and-intro-videos))
8. [Strategy library](#strategy-library) and [quick tactics](#tactics-quick-tactics)
9. [How rolling works](#how-rolling-works)
10. [In-game overlay](#in-game-overlay)
11. [Troubleshooting](#troubleshooting)

---

## Upgrading an existing setup

**From the match-planner version.** Match scheduling, match history, RSVPs and win/loss records were removed: the app is now a tactical planner. Nothing else used the `matches`, `match_availability` and `match_checklist` tables, so:

- the app no longer reads or writes them, and `supabase/schema.sql` no longer creates them for new setups;
- your existing tables and their data are **left untouched**. Re-running the schema doesn't change them;
- to delete them for good, run this by hand in the Supabase SQL editor (it can't be undone):

  ```sql
  drop table if exists public.match_checklist, public.match_availability, public.matches;
  ```

The new tactical features (zones, crossfires, round clocks, per-operator step actions, tactical roles, versions, favourites) live inside each strategy's document, so **no database change is needed** for them. Strategies saved by the previous version open as they are and are upgraded when they're next saved. Old `#/tactics/…` links redirect to `#/strategies/…`.

**From a setup older than the roster and strategy library**, do these **in this order**:

1. **Deploy the new app first** (merge to `main`; Vercel redeploys). It works with the old database: saving team strategies and roster details shows "Database update needed" until step 2.
2. **Re-run `supabase/schema.sql`** in Supabase → SQL Editor. It only adds things; your data stays. It adds `player_details`, `strategies` and `strategy_assignments`, lets the website add players, hides the passcode hash behind `check_team_passcode()` / `team_passcode_is_set()`, and turns on Realtime for the new tables.

Don't do step 2 before step 1: very old versions read the passcode hash directly and would show an error at the passcode screen until the new version is live. Your passcode doesn't change.

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

This creates the tables (`profiles`, `owned_operators`, `preferred_operators`, `tactics`, `map_notes`, `team_state`, `team_settings`, `player_details`, `strategies`, `strategy_assignments`), seeds the five profiles, enables RLS with the permissive team policies, adds the server-side passcode check, and turns on Realtime. The script is safe to run again.

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

The pure logic lives in `src/lib/` (tactical, strategies, strategy matching, synergy, board geometry, rolling, fit). It has no React and no Supabase. The tests cover:

- no duplicate operators within the team, and bans always respected
- re-rolling one player keeps the others unchanged
- owned-only pools per player, including overlapping pools solved with matching
- blocked operators are never rolled (a clear error instead), and favourite weighting (~5×)
- recommendations: blocked operators never appear, favorites fill the slots they can do, coverage and ranking
- normalised coordinates, the version 2 → 3 upgrade, per-floor boards and floor-plan validation
- the "not enough operators" error, with a readable message
- tactic filtering by map, side and site, generic fallback, and maps with no sites
- the fit check (one player per required role) and the minimal fit-aware re-roll
- data integrity for `operators.json`, `maps.json` and `tactics.json`
- passcode hashing, which matches the SQL formula
- the strategy document (v2 normalisation, legacy types, versions), round clocks and the execute timeline, coach briefings and player views, comparison stats, board geometry, fitting a strategy to five operators, and synergies
- every operator has a portrait file, and synergy pairs use real same-side operators
- the in-game overlay: step navigation (stops at the first and last step), the player filter (only your slot's objects), saving and loading window settings, and the read-only guard

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

## Operator portraits

Every operator has a portrait in `public/operators/<id>.svg`: the operator's in-game badge icon. They're used on the board (player and utility markers), in operator selection, strategy steps, coach and player views, and the squad lists.

- 76 of the 78 badges come from [r6operators](https://github.com/marcopixel/r6operators) (MIT-licensed code; the icons are Ubisoft's artwork, used here for a private, non-commercial team tool). *Tom Clancy's Rainbow Six Siege and its operator icons are trademarks of Ubisoft Entertainment. This project isn't affiliated with Ubisoft.*
- **Solid Snake** and **Noor** aren't in that set yet, so they have simple stand-in badges drawn for this app. Replace `public/operators/solid-snake.svg` and `noor.svg` when you have better ones.
- To swap any portrait, replace its file (keep the name). A square image works best. A data test fails if an operator has no portrait file.
- If an image fails to load, the app falls back to an initials badge.

## Operator profiles and intro videos

Click any operator on the **Operators** screen to open their profile: picture, health and speed (1 to 3), ability, primary and secondary weapons, a "how to play" tip, which teammates own, favour or block them, and a **Watch intro video** button.

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

### Building a strategy

**New strategy** opens the builder: map → site → side → five operators → players and tactical roles → a starting point → customize → tactics → steps → save.

- **Operators**: tap portraits to pick five, filter by role, or **Roll for the starters** (uses each starter's owned / favorite / blocked lists). *Pairs well with your picks* suggests partners (e.g. Thatcher for Thermite).
- **Players**: who plays each operator, and their **tactical role**: Entry, Support, Hard Breach, Flex, Flank Watch, Drone, IGL, Anchor, Roamer, Utility Denial, Plant, Post-Plant. The role shows next to the operator everywhere.
- **Start from**: a library strategy, ranked by fit and **adapted to your operators** (names and gadgets in the text are rewritten), or a blank board. The original is never changed.
- **Tactics**: the map editor (below). **Steps**: title, round clock (`0:45`), what happens, who acts, and one line per operator ("Thermite: Move to breach position."). One click adds a *Drone → Clear → Breach → Execute → Plant* template.

### The tactical map

The board is drawn on the **real floor plan** of the strategy's floor, when the team has added one (see [docs/MAP_ASSETS.md](docs/MAP_ASSETS.md)). The app never draws a map itself. Layers, bottom to top: floor plan, callouts (rooms, objectives, hatches, stairs), areas, routes, crossfires, players and utility, notes. Multi-floor maps get floor tabs, and every object remembers its floor. All positions are stored **normalised** (0 to 1 across the plan), so they stay on the same spot at any size, zoom or orientation.

Every map floor in the planner has its official Ubisoft blueprint (`public/maps/<map>/<floor>.webp`, registered in `src/data/floorPlans.json`). Built-in and older strategies had their positions drawn on an abstract layout. They now show on the real blueprint unchanged, and the board says they *haven't been placed on this map yet*. Drag them into place in the editor, then mark them as placed. Plans not tied to a map show a notice, never a drawing.

Toolbar groups (left rail; a row on phones):

| Group | Tools |
| --- | --- |
| Select | click to edit; drag to move; drag corner handles to resize areas, crossfire handles to move A / B / target / size |
| Units | Player, Enemy, Spawn, Waypoint |
| Routes | Movement, Entry route, Clearing route, Rotation |
| Intel | Drone, Drone route, Camera |
| Utility | Utility (the operator's own gadget, or smoke, stun, frag, claymore, EMP, wire, shield, bulletproof camera, C4, impact, alarm, observation blocker), Trap, Utility throw |
| Breach | Breach (hard / soft / vertical / hatch), Reinforce, Rotation hole |
| Areas | Hold, Contest, Danger, No entry, Watch this angle, Enemy likely here |
| Crossfire | click player A, player B, then the engagement area (clicks snap to players) |
| Objective | Plant spot, Objective |
| Note | click the map, or click an object to attach the note to it |

**Who** and **When** above the board decide which operator and step new objects belong to (*Setup* objects show in every step). The inspector edits the selected object: label, operator, step, purpose, timing and instructions. Viewers tap any object to see the same details.

Keys: `Ctrl+Z` / `Ctrl+Shift+Z` (or `Ctrl+Y`) undo / redo, `Delete` removes, `Esc` cancels, `Enter` finishes a route, arrows nudge (`Shift` for bigger steps).

### Library, versions, favourites, comparing

- The **Team library** groups the team's strategies by side and map and shows the latest version of each. **Include starting points** adds the built-in strategies.
- **New version** copies a team strategy into the same family as v2, v3… with a "what changed" note ("v2 Changed Buck route"). Every version stays; the version pills switch between them.
- **Duplicate** starts a separate strategy. **Save to team library** does the same for built-ins and references.
- **★** marks a favourite; favourites sort first and can be filtered.
- **Compare** puts two strategies side by side: operators, board, pace (from the step clocks), utility, steps, breaches, areas and crossfires.

**Strategy types.** Attack: Execute, Default, Rush, Slow take, Vertical, Clear, Plant, Post-plant, Conditioning, Fake, Split. Defense: Standard setup, Aggressive, Passive, Roam, Turtle, Retake, Utility-heavy, Vertical, Extended hold, Site denial.

**Synergy** pairs live in `src/data/synergies.json` (`ops`, `label`, `text`). They show in the builder, on strategies and in operator profiles.

### Where strategies come from

Every strategy shows one of three labels, and they're never mixed up:

| Label | What it is |
| --- | --- |
| **AI suggestion** | Starting points shipped in `src/data/strategies.json` (21 across Bank, Border, Chalet, Clubhouse, Coastline, Kafe, Oregon and two generic). Written by an AI from general Siege knowledge, **not verified or pro strategies**. Positions come from an abstract layout and are flagged on the real map until someone moves them. |
| **Online reference** | A link to a strategy someone published (website, coach, video), with a summary in your own words and, optionally, the operators it uses so it can be matched. Only metadata is stored; the text and images stay on the original page, which the strategy links to (*Source: … / Original strategy: …*). |
| **Team** / **Adapted by team** | Your own strategies, or copies of the above. A copy keeps a link to what it was adapted from. |

**About importing online strategies:** I couldn't find any R6 strategy source with a public API, feed or licence that allows copying its content. Liquipedia's text is CC BY-SA, but it covers maps and competitive history rather than step-by-step strats. So the app doesn't scrape or copy anything: references are links plus metadata, and your team writes its own adapted version. If a source gives you permission or publishes structured data under an open licence, it can be imported into `strategies.json` with its source and licence fields filled in.


### Data model

A strategy is one document (see `src/lib/strategies.js`; the vocabulary is in `src/lib/tactical.js`), `schemaVersion: 2`:

- `slots`: operator, operator category, **tactical role**, defuser carrier, alternatives, spawn, instructions;
- `steps`: title, **round clock**, description, operators involved, **one action per operator**, utility, notes;
- `markers`: point objects (player, enemy, utility with its gadget, breach with its type, note attached to a marker…), each with label, purpose, timing and instructions;
- `paths`, `zones` and `crossfires`;
- `family` + `version` + `versionNote` for versions, and `favorite`.

Every board item has coordinates on a 100 × 64 board and can belong to a slot and a step. The database stores the document in `strategies.doc` and copies the filter fields (map, site, floor, side, type, difficulty, operators, tags, source) into indexed columns. `strategy_assignments` maps (strategy, slot) → player. Saving one document at a time means a save can never half-apply. Two whole strategies are enough to compare them, which is why comparison needs no extra storage.

## Tactics (quick tactics)

Quick tactics come from two places:

- `src/data/tactics.json`: built-in tactics committed to the repo. It ships with clearly marked **[Example]** tactics (2 per side for Bank, Clubhouse and Chalet, plus one generic per side) for you to edit or replace.
- The Supabase `tactics` table: everything created or edited in the app.

How they combine:

- Editing a built-in in the app saves a copy with the same id that overrides it.
- Deleting a built-in hides it for everyone.
- Each tactic has an owner (a player, or *team*) and a **Shared with team** flag.

Tabs on the Quick tactics screen (Strategies → Quick tactics):

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

- On the **Lineup roller** (Team → Lineup roller), the diagram uses the rolled lineup. Each teammate's operator is placed where their role sets up around the two rooms of the chosen bomb site (hard breacher on the breach wall, soft breacher above the hatch, intel droning, anchors in site, roamers outside…). Required roles nobody covers show as red **?** spots. A numbered legend says who does what.
- On the **Tactics** screen, click **Diagram** on any card to see the roles' spots before rolling.
- It shows the real floor plan of the tactic's map and site floor. Quick tactics are role-based, so the numbered list says who does what and nothing is drawn on the map. You can still add a **Map image link** in the tactic editor (any `https://` image); it shows above the floor plan.

The image link is stored in the `image_url` column. **If your database was set up before this column existed, re-run `supabase/schema.sql`** (it's safe to re-run). Tactics without an image keep working either way.

---

## How rolling works

- Each player's pool is the selected side's operators, minus bans, and limited to their owned list when **Use owned operators only** is on. That setting is shared team state.
- **Blocked** (🚫): never rolled for that player, like a ban. If that leaves too few operators, you get a clear message.
- **Favorite** (★): rolled about 5× as often (`FAVORITE_WEIGHT` in `src/lib/roll.js`).

## How recommendations work

`src/lib/recommend.js` drives **Find by composition**, the builder's **Start from** list, substitute suggestions and *Pairs well with your picks*. The players in the setup (or just you) supply their favorites and blocks, and the team's bans count as blocks.

1. **Blocked operators are never used.** A strategy written around a blocked operator is adapted with a replacement and says so ("Requires blocked operator: Ace · adapted with Thermite"). If no usable operator can do that job, it's hidden and listed as hidden.
2. **Favorites are built in first.** Each slot takes a favorite whenever the favorite can do that slot's job (same role, or a listed alternative). A favorite with no job in a plan isn't forced in: the card says why and links a strategy that does use it.
3. Then the team's **selected operators**, then the strategy's own operators, then anyone else available.
4. Results are ranked by **favorite coverage** (favorites used ÷ favorites that could be used), then tactical quality. Each card shows ★ scores for favorite match, operator compatibility and strategy match, plus the reasons.
- Picks are distinct. If random picking keeps colliding (for example tight owned lists), a bipartite matching finds a valid lineup whenever one exists. When none exists, you get a clear message saying why, instead of a crash.
- **Re-roll to fit** keeps the players who already cover required roles, and re-rolls the fewest remaining players into the missing roles. It only widens to more players when that's the only way.

## Project layout

```
src/
  data/          operators.json, operatorProfiles.json, maps.json, strategies.json,
                 synergies.json, tactics.json (+ data tests)
  lib/           tactical.js (objects, zones, routes, roles, types, gadgets, clock,
                 briefings, stats), strategies.js (model, versions, adaptation),
                 strategyMatch.js, recommend.js, synergy.js, board.js (board geometry),
                 floorPlans.js (floor-plan assets), space.js (normalised coordinates),
                 roll.js, fit.js, tactics.js, diagram.js, roster.js (pure + tests),
                 api.js (all Supabase calls), passcode.js, config.js, maps.js, operators.js
  state/         useTeamData.js, useStrategyData.js, useHistory.js (undo/redo),
                 useHashRoute.js, useSessionState.js, roster-context.js
  components/    Screens: CommandView, StrategyBuilder, StrategiesView (library, detail,
                 editor, CoachMode, PlayerMode, StrategyCompare), MapsView,
                 OperatorLibraryView, TeamView, PlanView (lineup roller).
                 Board: TacticalBoard, MapLayer, BoardEditor, ObjectInspector, FloorPlanPanel.
  overlay/       the in-game overlay page (read-only; see "In-game overlay")
  styles.css, tactical.css
overlay/         the overlay's Electron app: main.js, preload.cjs, settings.js, vite.config.js
supabase/schema.sql
docs/DATA_REVIEW.md   data to verify by hand
docs/MAP_ASSETS.md    adding and verifying real floor plans
src/data/floorPlans.json  floor-plan manifest (empty until plans are added)
public/maps/          floor-plan images (<map>/<floor>.webp)
public/operators/     operator portraits (<id>.svg)
```

## In-game overlay

A small Windows app (`overlay/`, Electron) that shows **only your part** of a strategy in a see-through window on top of Rainbow Six Siege. It's a **read-only viewer**: it can't change tactics, and it never saves, deletes or assigns anything in the database.

**What you see during a round:** map · site · side · strategy on one line, your operator and tactical role, `STEP 3 / 7`, your instructions for that step as short bullets, utility to place and crossfires you hold now, and a mini-map zoomed to **your** positions, routes, utility and crossfires only. Nothing about other players, no coach notes, no timer.

**Safe with BattlEye.** The overlay is a separate always-on-top window. It doesn't touch the game: no injection, no reading game memory, no DirectX hooks, no screen capture.

**Siege must run in Borderless windowed mode** (Options → Display → Display mode). In exclusive full screen, Windows draws the game over every other window, so the overlay can't show.

### Install and run

On Windows, from the repository root (with your `.env` filled in, so the overlay can reach your team's strategies):

```bash
npm ci
npm run overlay:install   # Electron and electron-builder, into overlay/node_modules
npm run overlay:build     # installer + portable .exe in overlay/release/
```

Run the installer (`R6 Tactical Overlay Setup <version>.exe`) or the portable `.exe`. While working on it, `npm run overlay:dev` opens the overlay with hot reload. Build on Windows: electron-builder needs Windows (or Wine) for the Windows targets. Without Supabase settings the overlay shows the built-in strategies only.

### Using it

1. **Setup** (before the match, the only screen that takes clicks): team passcode (when `VITE_REQUIRE_PASSCODE` is on, checked with `check_team_passcode()` like the web app), then map → side → strategy → **Who are you playing?** The overlay remembers your choice; next launch goes straight to the round view. To pick again, use the tray menu → **Change strategy or operator**.
2. **In the round** the window is **click-through**: mouse and keyboard go to the game.

| Hotkey | Does |
| --- | --- |
| **F7** | show / hide the overlay |
| **F8** | next step |
| **F6** | previous step |

The step only changes when you press a key. If another app already uses one of these keys, the tray icon's tooltip says which.

**Edit mode** (tray icon → **Edit mode**): drag the window to move it, drag the bottom-right corner to resize. This only moves the window; it never edits tactics. Turn edit mode off and the window is click-through again. **Opacity** is in the tray menu (40–100%). Position, size and opacity are saved (`overlay-settings.json` in the app's user data folder) and restored on launch. If the monitor it was on is gone, the overlay comes back on your main screen.

### How it's built

- `overlay/main.js`: the Electron window (transparent, frameless, `setAlwaysOnTop(true, 'screen-saver')`, hidden from the taskbar), tray menu, global hotkeys and click-through. The page is served from `app://overlay/` with a content security policy.
- `overlay/preload.cjs`: the only bridge. It exposes the hotkey and tray events, the screen phase and edit-mode resizing; no Node, file system or database access (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- `overlay/settings.js`: window position, size and opacity (tested in `overlay/settings.test.js`).
- `src/overlay/`: the page. A separate Vite entry (`overlay/vite.config.js`) that reuses the read-only `TacticalBoard`, the "Who are you playing?" chooser and `src/lib` / `src/i18n`. The editor isn't in its bundle.
- `src/overlay/noWrites.test.js` fails if overlay code calls `.insert` / `.update` / `.upsert` / `.delete`, imports any database function other than the read ones in `src/overlay/readApi.js`, or reaches the editor, builder or undo history.

---

## Troubleshooting

| Message | Fix |
| --- | --- |
| "Supabase isn't configured" | `.env` is missing values (local), or the Vercel env vars weren't set before the build: add them and redeploy. |
| "Can't reach the database… project may be paused" | Check your connection. Free Supabase projects pause after inactivity; open the dashboard and click **Restore project**. |
| "The database tables are missing" | Run `supabase/schema.sql`. |
| "No team passcode has been set yet" | Run the passcode statement from step 3. |
| "Database update needed" when saving strategies or roster details | Re-run `supabase/schema.sql` (see [Upgrading](#upgrading-an-existing-setup)). |
| "Adding players needs the latest database setup" | Same: re-run `supabase/schema.sql`. |
| "Wrong passcode" | Re-run the statement from step 3 to reset it. |
| Live dot says "Reconnecting…" | Realtime dropped. It reconnects automatically and catches up on missed changes. |
| "Your change wasn't shared with the team" | The write failed (network or permissions). Your screen shows it; others don't see it yet. Retry once you're back online. |
