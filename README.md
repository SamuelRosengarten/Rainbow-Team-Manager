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
3. [Setup: Supabase](#1-create-the-supabase-project), [logins](#3-logins-and-team-members) and [several teams](#running-several-teams)
4. [Setup: local development](#4-run-locally)
5. [Setup: Vercel](#5-deploy-on-vercel) (with [security headers](#security-headers))
6. [Backups](#backups)
7. [Running tests](#running-tests)
8. [Adding operators, portraits and maps](#adding-operators) (and [operator profiles](#operator-profiles-and-intro-videos))
9. [Strategy library](#strategy-library) and [quick tactics](#tactics-quick-tactics)
10. [How rolling works](#how-rolling-works)
11. [In-game overlay](#in-game-overlay)
12. [Troubleshooting](#troubleshooting)

---

## Upgrading an existing setup

**To self-serve accounts and teams.** Players create their own account (email + password or Steam), then create a team or join one with an invite link. Existing teams, members and data keep working; the earliest member of each team becomes its **captain**. Do these **in this order**:

1. **Run [`supabase/selfserve.sql`](supabase/selfserve.sql)** in Supabase → SQL Editor. It only adds things (captain/member roles, invite codes, the create / join / captain functions); nobody's access changes, and sign-ups stay off.
2. **Set up email sending** (custom SMTP, see [Emails](#emails-confirmation-and-password-reset)): with sign-ups on, Supabase's built-in sender runs out after a few emails an hour.
3. **Deploy the new website** (merge to `main`; Vercel redeploys).
4. **Using Steam sign-in?** Redeploy the function so a first Steam sign-in creates an account: `npx supabase functions deploy steam-auth --no-verify-jwt --project-ref your-project-ref`.
5. **Run [`supabase/schema.sql`](supabase/schema.sql) last.**
6. **Then turn sign-ups on**: Authentication → Sign In / Providers → **Allow new users to sign up**, with **Confirm email** on (step 3.1).
7. Check who's captain (Team → Settings). To change it by hand, see [Running several teams](#running-several-teams).

**From one team to several teams.** One website and one database can now hold several teams; each member only sees their own team. Your current data becomes the first team ("Team 1"). Do these **in this order**:

1. Optional: to give the first team another name, change `first_team_name` near the top of [`supabase/teams.sql`](supabase/teams.sql) before running it (or rename it later in **Table Editor → teams**).
2. **Run [`supabase/teams.sql`](supabase/teams.sql)** in Supabase → SQL Editor. It adds the `teams` table and a `team_id` on every table, moves all existing rows (players, strategies, tactics, notes, team state, logins) into the first team, and makes names and ids unique per team. **Nobody's access changes yet**: the current website keeps working.
3. **Deploy the new website** (merge to `main`; Vercel redeploys). It shows your team's name next to your name.
4. **Run [`supabase/schema.sql`](supabase/schema.sql) last.** This is the step that changes access: from now on each member sees and changes only their own team's rows. (It also removes the old one-row `team_state.id`.)

Run `schema.sql` before the new website is live and the old website can't save the team's state any more (it still looks for the old row). Nothing is lost; deploying the new website fixes it. Then add more teams: [Running several teams](#running-several-teams).

**From the team passcode to logins (email + password and Steam).** The website and the database now only let in signed-in team members. Do these **in this order** (the old site keeps working until step 5):

1. **Run [`supabase/members.sql`](supabase/members.sql)** in Supabase → SQL Editor. It only *adds* the `team_members` list, the membership check and the Steam sign-in tables; nobody's access changes yet.
2. **Deploy the Steam sign-in function** and set up Supabase Auth: [Logins and team members](#3-logins-and-team-members), steps 3.1 and 3.4.
3. **Create everyone's login and fill `team_members`**: steps 3.2 and 3.3.
4. **Deploy the new app** (merge to `main`; Vercel redeploys). Everyone signs in once.
5. **Run [`supabase/teams.sql`](supabase/teams.sql)**, then **[`supabase/schema.sql`](supabase/schema.sql) last.** This is the step that locks the database: from now on the anon key alone can't read or write anything, and each signed-in member reaches only their own team (everyone you added in step 3 is in the first team).
6. Optional: remove the old passcode by uncommenting the three lines at the end of `schema.sql` (marked **OPT-IN**) and running them.

**Don't run `schema.sql` first.** The old website has no login, so the moment the new rules are in place it can't load or save anything, and nobody can get back in until steps 2–4 are done.

**From the match-planner version.** Match scheduling, match history, RSVPs and win/loss records were removed: the app is now a tactical planner. Nothing else used the `matches`, `match_availability` and `match_checklist` tables, so:

- the app no longer reads or writes them, and `supabase/schema.sql` no longer creates them for new setups;
- your existing tables and their data are **left untouched**. Re-running the schema doesn't change them;
- to delete them for good, run this by hand in the Supabase SQL editor (it can't be undone):

  ```sql
  drop table if exists public.match_checklist, public.match_availability, public.matches;
  ```

The new tactical features (zones, crossfires, round clocks, per-operator step actions, tactical roles, versions, favourites) live inside each strategy's document, so **no database change is needed** for them. Strategies saved by the previous version open as they are and are upgraded when they're next saved. Old `#/tactics/…` links redirect to `#/strategies/…`.

**From a setup older than the roster and strategy library**: follow **From the team passcode to logins** above. The final `schema.sql` run also adds `player_details`, `strategies` and `strategy_assignments` and turns on Realtime for them; your data stays.

## Security model (read first)

Only your team gets in, and the database itself enforces it:

- **Accounts.** Anyone can create an account: **email + password** (they must confirm their email first) or **Sign in through Steam** (the first Steam sign-in creates the account). There's no 2FA in the app; Steam Guard happens on Steam's own site.
- **An account alone sees nothing.** It has to be in a team: it creates one (and becomes its captain) or joins one with the team's **invite code**. `public.team_members` records who's in which team, as which roster player ("Samuel" really is Samuel) and with which role. One login = one team.
- **Teams are managed through checked functions only.** Creating, joining, invites, roles, removing members and deleting the team all go through database functions that check who's asking (captains for the team's settings). The website can't write `teams` or `team_members` directly, and members never see the invite code. Limits: 3 new teams per person per day, 20 members per team, 10 invite-code tries per person per 10 minutes (codes can't be guessed).
- **Teams are isolated by the database.** Every row has a `team_id`, and every table's Row Level Security policy compares it with the signed-in member's team (`public.current_team_id()`). A member can't read, add, change or delete another team's rows, even by calling the API directly; the app never even sends `team_id` (the database fills it in). Rows can't move between teams, and can't point at another team's players. This is tested on a real Postgres in CI (`supabase/db/isolation.test.js`).
- **The anon key** still ships inside the website (as in every Supabase frontend), but on its own it can't read or write anything.
- **Steam sign-in** runs in a Supabase Edge Function (`supabase/functions/steam-auth`). It checks Steam's answer with Steam itself, refuses replays and other sites' answers, limits attempts per IP, and creates an account the first time a Steam account signs in (it still needs a team, like any account).
- **The service role key** exists only inside that Edge Function (Supabase provides it there). Never put it in this project, in `.env`, in Vercel or anywhere in the website; a test fails the build if it shows up in the bundle.
- **Sessions** are normal Supabase sessions, kept in the browser and refreshed automatically. **Log out** is in the account menu (click your name).
- **Headers.** The site is served with security headers (`vercel.json`), see [Security headers](#security-headers).
- **Backups.** Members can download their team's data as one JSON file (see [Backups](#backups)). Turn on Supabase's own backups too.
- **Removed members** lose access at their next request; the app notices within 30 seconds (or when the tab comes back) and shows Get started.
- **No captcha yet.** Supabase Auth's own rate limits apply. If bots start creating accounts, add Cloudflare Turnstile: Authentication → **Bot and Abuse Protection** → enable CAPTCHA protection (Turnstile), with a free Cloudflare key; the app then needs the Turnstile widget on the sign-up form.
- **Realtime.** Live updates are filtered to your team. When a row is *deleted*, Realtime can't filter by team, so other teams' apps get a "something was deleted" signal carrying only that row's key (an id, never its content) and simply reload their own data.

Still a small team's planning board: don't store anything private in it.

---

## 1. Create the Supabase project

1. Sign in at [supabase.com](https://supabase.com) and click **New project** (the free tier is fine).
2. Pick a name, a database password (you won't need it in the app) and a region near your team.
3. Wait for the project to finish provisioning.

## 2. Run the schema

1. In the Supabase dashboard, open **SQL Editor → New query**.
2. Paste the whole contents of [`supabase/schema.sql`](supabase/schema.sql) and click **Run**.

This creates the tables (`teams`, `profiles`, `team_members`, `owned_operators`, `preferred_operators`, `tactics`, `map_notes`, `team_state`, `player_details`, `strategies`, `strategy_assignments`, and the Steam sign-in's private `steam_nonces` and `steam_auth_attempts`), creates the first team ("Team 1") with the five starter players, enables Row Level Security with **own-team-only** policies, takes every permission away from the anon key, and turns on Realtime. The script is safe to run again.

Then grab your keys from **Project Settings → API**: the **Project URL** and the **anon public** key. Don't use the `service_role` key anywhere in the website.

## 3. Logins and team members

### 3.1 Supabase Auth settings

In the Supabase dashboard:

1. **Authentication → Sign In / Providers → Email**: enabled, with **Confirm email** **on** (people click a link in an email before they can sign in).
2. **Authentication → Sign In / Providers**: **Allow new users to sign up** **on** (self-serve). Upgrading? Turn this on last, see [Upgrading](#upgrading-an-existing-setup). Turn it off any time to stop new accounts; existing ones keep working.
3. **Authentication → URL Configuration**:
   - **Site URL**: your website, e.g. `https://your-team.vercel.app`.
   - **Redirect URLs**: add `https://your-team.vercel.app/` and, for local development, `http://localhost:5173/`. Confirmation and password-reset emails come back to these.
4. Don't turn on MFA: the app doesn't ask for a second factor.
5. Set up email sending (next section).

**Rate limits.** Supabase Auth limits sign-ups, sign-ins and emails per hour (**Authentication → Rate Limits**). The defaults are fine for a few teams; raise "emails per hour" once custom SMTP is set up.

#### Emails (confirmation and password reset)

Supabase's built-in email sender is for testing: it sends **only a few emails per hour**, so confirmation and password-reset emails stop arriving after a handful of sign-ups. Use your own sender. With [Resend](https://resend.com) (free tier, 3,000 emails a month):

1. Create a Resend account and **add your domain** (Domains → Add domain), then add the DNS records it shows at your domain provider and wait until it says *Verified*. (No domain? Resend's test sender only delivers to your own address, so you'll need one.)
2. In Resend, **API Keys → Create API key** (permission: *Sending access*). Copy it.
3. In Supabase, **Authentication → Emails → SMTP Settings → Enable custom SMTP**:
   - **Sender email**: e.g. `no-reply@your-domain.com` (on the verified domain); **Sender name**: e.g. `R6 Tactical Command`;
   - **Host** `smtp.resend.com`, **Port** `465`, **Username** `resend`, **Password**: the API key.
4. Save, then **Authentication → Rate Limits**: raise *Rate limit for sending emails* (e.g. 100 per hour).
5. Test: create an account on the site with your own email; the confirmation email should arrive within a minute.

The email texts are in **Authentication → Emails → Templates** (they can be translated there).

### 3.2 How players get in

Nothing to do per player any more:

1. **They create an account** on the login screen (**Create an account**: email + password, then the link in the confirmation email) or with **Sign in through Steam**.
2. **They land on Get started**:
   - **Create a team**: team name + their player name. They become its **captain**.
   - **Join a team**: the **invite code** or link their captain sent (`https://your-team.vercel.app/#/join/ABCDE-FGH23`). After **Check the code** they pick "I'm new on this team" (a new roster player) or one of the team's roster players who don't have a login yet (e.g. a starter player the team already had).
3. **Captains** manage the team in **Team → Settings**: copy the invite link or code, make a **new code** (the old one stops working), turn invites off and on, rename the team, make someone captain or member, remove a member, delete the team (type its name to confirm). Everyone can **leave** the team there. A team always keeps a captain: the last captain must make someone else captain before leaving or stepping down.

Opening an invite link while signed out leads to the login screen and then straight to the join form, with the code filled in.

### 3.3 Adding members by hand (optional)

Admins can still create logins (**Authentication → Users → Add user**: email + password with **Auto Confirm User**, or **Send invitation**) and put them in a team from the SQL editor. That's how the first teams were set up, and it's handy for fixing things.

Each login needs a row in `team_members`: the player's team, their roster player, and the email and/or Steam ID they sign in with. The easiest way is the `add_member` helper, in the **SQL Editor** (it also adds the player to the team's roster if they aren't there yet):

```sql
select public.add_member('Team 1', 'Samuel', 'samuel@example.com', null);           -- email + password
select public.add_member('Team 1', 'Anthony', null, '76561198000000001');           -- Steam only
select public.add_member('Team 1', 'Xavier', 'xavier@example.com', '76561198000000002'); -- both
```

- The team name must match a row in `teams` (a new setup has "Team 1"; see [Running several teams](#running-several-teams) for more).
- The email must be **the same** as the player's login (step 3.2); it's stored lowercase.
- The Steam ID is their **SteamID64** (17 digits).
- A member with both an email and a Steam ID signs into the **same** account either way. An email or Steam ID can be on only one team.

Or by hand: **Table Editor → team_members → Insert row** with `team_id` (the team), `profile_id` (a player of that team), `email` (lowercase) and/or `steam_id`. Leave `user_id` empty: it's filled on their first sign-in.

**Finding a SteamID64:** in Steam, open your profile. If the address is `steamcommunity.com/profiles/7656119…`, that number is it. With a custom address (`steamcommunity.com/id/name`), open the Steam client → your name (top right) → **Account details**: the "Steam ID" shown there is the SteamID64.

To remove someone, delete their `team_members` row (and their user under **Authentication → Users**). They're out at their next request. To move someone to another team, see [Running several teams](#running-several-teams).

### 3.4 Steam sign-in (Edge Function)

Steam uses OpenID 2.0, which Supabase Auth doesn't support, so a small Edge Function (`supabase/functions/steam-auth`) checks Steam's answer and signs the player in. Deploy it once with the [Supabase CLI](https://supabase.com/docs/guides/cli) (`npx supabase` works too):

```bash
npx supabase login
npx supabase functions deploy steam-auth --no-verify-jwt --project-ref your-project-ref
npx supabase secrets set --project-ref your-project-ref \
  ALLOWED_RETURN_ORIGINS="https://your-team.vercel.app, http://localhost:5173, http://127.0.0.1"
```

- `--no-verify-jwt`: players aren't signed in yet when they call it.
- `ALLOWED_RETURN_ORIGINS`: the addresses Steam may send players back to: your website, your local dev server, and `http://127.0.0.1` for the [in-game overlay](#in-game-overlay) (any port). Steam answers made for anything else are refused.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided to the function by Supabase. Don't set them, and never copy the service role key anywhere else.
- No Steam Web API key is needed. (If you add one later, e.g. for avatars, store it with `supabase secrets set`, never in the website.)

Re-deploy the function after pulling changes to `supabase/functions/`.

## Running several teams

One website and one database can hold several teams. Each login belongs to one team and only ever sees that team's players, strategies, tactics, notes, operator pools and team state. The built-in strategies and tactics are shared by everyone; when a team edits or hides one, that's only for that team.

**Players do most of this themselves** ([How players get in](#32-how-players-get-in)): they create teams, captains invite and manage members. Everything below is for admins, in the Supabase dashboard (**SQL Editor**), e.g. to set teams up by hand or fix something.

**Change a team's captain:**

```sql
update public.team_members m set role = 'captain'
from public.profiles p, public.teams t
where p.id = m.profile_id and t.id = m.team_id and t.name = 'Team 1' and p.name = 'Samuel';
```

(Use `role = 'member'` to make someone a member again.) **Turn a team's invites off**: `update public.teams set invite_enabled = false where name = 'Team 1';`. Teams made by hand get an invite code automatically; captains see it in Team → Settings.

**Create a team**

```sql
select public.create_team('Team Alpha');
```

Or **Table Editor → teams → Insert row** with a name (1–40 characters, unique). The team gets its own team state automatically, and starts with no players.

**Add members** (logins first, step 3.2), then:

```sql
select public.add_member('Team Alpha', 'Lucas', 'lucas@example.com', null);
select public.add_member('Team Alpha', 'Noah', null, '76561198000000003');
```

This adds each player to the team's roster and lets their login in. Player names only need to be unique within a team ("Samuel" can exist in two teams).

**Add roster players without a login** (e.g. a sub who never signs in): members can add players from the website (**Team → Add player**), or:

```sql
insert into public.profiles (team_id, name) select id, 'Ethan' from public.teams where name = 'Team Alpha';
```

**Move a member to another team.** Their old team keeps everything the player did (pools, notes, assignments stay with the old roster player). Give them a player in the new team and point their login there:

```sql
-- 1. a roster player for them in the new team
insert into public.profiles (team_id, name) select id, 'Lucas' from public.teams where name = 'Team Beta'
on conflict (team_id, name) do nothing;
-- 2. their login now belongs to Team Beta
update public.team_members m
set team_id = t.id, profile_id = p.id
from public.teams t join public.profiles p on p.team_id = t.id and p.name = 'Lucas'
where t.name = 'Team Beta' and m.email = 'lucas@example.com';
```

They see Team Beta at their next sign-in (or page reload).

**Remove a member:** delete their `team_members` row (their roster player and history stay with the team). **Rename a team:** edit its name in **Table Editor → teams**.

**Delete a team:** `delete from public.teams where name = 'Team Alpha';` deletes **everything of that team**: its players, strategies, tactics, notes, operator pools, team state and its members' access (their logins stay under **Authentication → Users** but can't see anything). It can't be undone: back up first (a member of that team can use **Back up team data**).

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
```

With Supabase settings you sign in like on the real site (add `http://localhost:5173/` to the redirect URLs and `ALLOWED_RETURN_ORIGINS`, step 3).

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

5. Click **Deploy**. If you add or change variables after the first deploy, go to **Deployments → ⋯ → Redeploy**. `VITE_*` values are baked in at build time, so a redeploy is required.
6. Put the site's address in Supabase (**Site URL** and **Redirect URLs**, step 3.1) and in `ALLOWED_RETURN_ORIGINS` (step 3.4), then share the URL with the team. Everyone signs in with their own login.

The app is a single page with no client-side routes; `vercel.json` only adds security headers. Vercel builds on every push (GitHub Actions only runs the tests).

### Security headers

`vercel.json` sends these on every page:

| Header | Value | Why |
| --- | --- | --- |
| `X-Content-Type-Options` | `nosniff` | files are only used as what they are |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | other sites see the domain, not the page |
| `X-Frame-Options` | `DENY` | no other site can show the app in a frame (clickjacking) |
| `Permissions-Policy` | camera, microphone, geolocation off | the app never needs them |
| `Strict-Transport-Security` | 2 years | browsers always use https |
| `Content-Security-Policy-Report-Only` | see `vercel.json` | allowed sources: the site, Google Fonts, `*.supabase.co`, images over https, Steam for sign-in |

The content security policy starts in **report-only** mode: nothing is blocked, the browser only reports what *would* be. To switch it on:

1. Use the deployed site for a while (sign in, open every screen, Steam sign-in) with the browser's DevTools console open.
2. If you see `[Report Only] Refused to …` lines, add the reported source to the matching directive in `vercel.json` (common ones: a custom Supabase domain in `connect-src` with both `https://` and `wss://`, and your `VITE_STATS_API_URL` host in `connect-src`).
3. When the console stays clean, rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `vercel.json` and deploy.

`vite preview` sends the same headers, and the end-to-end tests fail if the app triggers a policy report.

---

## Backups

Signed-in members can download **their team's data** as one JSON file: click your name (account menu) → **Back up team data**. It holds the team (`"team": { "id", "name" }`) and every row of that team in `profiles`, `player_details`, `owned_operators`, `preferred_operators`, `tactics`, `map_notes`, `team_state`, `strategies` and `strategy_assignments`. It never contains another team's data, logins or `team_members`.

Also turn on Supabase's own backups (**Database → Backups**; daily backups come with paid plans, and you can download a dump with `npx supabase db dump` any time).

**Restoring a table from the JSON file**, in the SQL editor. Restore `profiles` first, then the others. For each table, paste that table's array from the file (`"strategies": [ … ]`, only the `[ … ]` part) and put the **team's name** in the last line. The rows go into that team, whatever team they came from:

```sql
insert into public.strategies
select * from jsonb_populate_recordset(null::public.strategies, (
  select jsonb_agg(row || jsonb_build_object('team_id', t.id))
  from jsonb_array_elements($json$
    [ ...paste the "strategies" array here... ]
  $json$::jsonb) as row, public.teams t
  where t.name = 'Team 1'
))
on conflict do nothing;
```

Replace `strategies` (twice) with each table name. `on conflict do nothing` keeps rows that are still there and puts back the missing ones. To replace a table completely, empty it first with `delete from public.<table> where team_id = (select id from public.teams where name = 'Team 1');`. (Backups made before teams have no `team_id` in their rows; this works for them too.)

---

## Running tests

```bash
npm test
npm run test:db   # team isolation on a real Postgres (needs DATABASE_URL)
```

`npm run test:db` creates throwaway databases on the Postgres you point it at and runs `supabase/schema.sql` on a stand-in for Supabase's `auth` schema. It signs in as members of two teams and checks that neither can read, add, change, delete or move the other's rows, that outsiders and the anon key get nothing, and that upgrading a database full of data (built from the schema before teams) keeps every row. Point it at a **local or CI Postgres 15+ superuser**, never your Supabase project:

```bash
docker run --rm -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres npm run test:db
```

Without `DATABASE_URL` it's skipped (with a message); CI always runs it.

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
- self-serve, on a real Postgres: creating a team (one per login, name rules, 3 per day), joining (new or existing roster player, wrong / disabled / replaced codes, the 10-tries limit, 20 members), captain-only actions, members never see the invite code, removal takes effect at once, last-captain rules, deleting a team (exact name, nothing else touched), the upgrade (earliest member becomes captain, every row kept); invite links and form rules; end to end with a mocked Supabase: sign up → confirm → create a team → invite link, join as an existing roster player, member view, leave
- several teams: `team_id`, defaults, indexes and the "rows never move" trigger on every team table, own-team-only policies, `teams.sql` kept identical to `schema.sql`, team-scoped team state and Realtime channels
- logins: the Steam sign-in checks (valid answer, bad signature, wrong endpoint, wrong account format, foreign return address, old or reused nonce, unknown Steam ID, attempt limit), the website's Steam state check, and that no database policy or grant gives the anon key anything
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
                 api.js (all Supabase calls, sign-in, backup), steamLogin.js, config.js,
                 maps.js, operators.js
  state/         useAuth.js (sign-in and team membership), useTeamData.js, useStrategyData.js, useHistory.js (undo/redo),
                 useHashRoute.js, useSessionState.js, roster-context.js
  components/    Screens: CommandView, StrategyBuilder, StrategiesView (library, detail,
                 editor, CoachMode, PlayerMode, StrategyCompare), MapsView,
                 OperatorLibraryView, TeamView, PlanView (lineup roller).
                 Board: TacticalBoard, MapLayer, BoardEditor, ObjectInspector, FloorPlanPanel.
  overlay/       the in-game overlay page (read-only; see "In-game overlay")
  styles.css, tactical.css
overlay/         the overlay's Electron app: main.js, preload.cjs, settings.js, vite.config.js
supabase/schema.sql         the database (tables, team-members-only rules)
supabase/members.sql        logins only: the additive first step of an upgrade
supabase/teams.sql          several teams: the additive first step of an upgrade
supabase/selfserve.sql      self-serve accounts and teams: the additive first step of an upgrade
supabase/db/                team isolation tests on a real Postgres (+ fixtures)
supabase/functions/         steam-auth Edge Function + _shared/steam.js (tested)
vercel.json                 security headers
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

1. **Sign in** (once; the overlay stays signed in): your email + password, or **Sign in through Steam**. For Steam, the overlay opens Steam's login in your browser; after you sign in there, the tab says "You can close this tab and go back to the overlay" and the overlay is signed in. (Behind the scenes Steam sends you back to a one-shot server on `127.0.0.1` that only this computer can reach, on a random port, checking a random value, and closing after one answer or 5 minutes. `ALLOWED_RETURN_ORIGINS` must include `http://127.0.0.1`, step 3.4.) Forgot your password? Reset it on the website. To sign out: tray icon → **Log out**. If your login is removed or expires, the overlay asks you to sign in again.
2. **Setup** (before the match, the only screen that takes clicks): map → side → strategy → **Who are you playing?** The overlay remembers your choice; next launch goes straight to the round view. To pick again, use the tray menu → **Change strategy or operator**.
3. **In the round** the window is **click-through**: mouse and keyboard go to the game.

| Hotkey | Does |
| --- | --- |
| **F7** | show / hide the overlay |
| **F8** | next step |
| **F6** | previous step |

The step only changes when you press a key. If another app already uses one of these keys, the tray icon's tooltip says which.

**Edit mode** (tray icon → **Edit mode**): drag the window to move it, drag the bottom-right corner to resize. This only moves the window; it never edits tactics. Turn edit mode off and the window is click-through again. **Opacity** is in the tray menu (40–100%). Position, size and opacity are saved (`overlay-settings.json` in the app's user data folder) and restored on launch. If the monitor it was on is gone, the overlay comes back on your main screen.

### How it's built

- `overlay/main.js`: the Electron window (transparent, frameless, `setAlwaysOnTop(true, 'screen-saver')`, hidden from the taskbar), tray menu, global hotkeys and click-through. The page is served from `app://overlay/` with a content security policy; the built page narrows `connect-src` to your Supabase project only (`overlay/csp.js`).
- `overlay/loopback.js`: the one-shot `127.0.0.1` server for Steam sign-in (tested in `overlay/loopback.test.js`).
- `overlay/preload.cjs`: the only bridge. It exposes the hotkey and tray events, the screen phase, edit-mode resizing and the Steam sign-in; no Node, file system or database access (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- `overlay/settings.js`: window position, size and opacity (tested in `overlay/settings.test.js`).
- `src/overlay/`: the page. A separate Vite entry (`overlay/vite.config.js`) that reuses the read-only `TacticalBoard`, the "Who are you playing?" chooser and `src/lib` / `src/i18n`. The editor isn't in its bundle.
- `src/overlay/noWrites.test.js` fails if overlay code calls `.insert` / `.update` / `.upsert` / `.delete`, reaches the team's tables other than through the read functions in `src/overlay/readApi.js` (signing in goes through `src/state/useAuth.js`, sign-in calls only), or reaches the editor, builder or undo history.

### Security of the app itself

- **Electron fuses** are set when the `.exe` is built (`electronFuses` in `overlay/package.json`, applied by electron-builder with `@electron/fuses`): `RunAsNode` off, `NODE_OPTIONS` ignored, `--inspect` flags ignored, the app only loads from its `app.asar`, and that archive's integrity is checked at startup. Someone can't run the overlay as a plain Node.js or patch its files to run other code.
- **Windows SmartScreen** warns ("Windows protected your PC") the first time, because the `.exe` isn't code-signed: click **More info → Run anyway**. To sign it later, get a code-signing certificate and add it to electron-builder's Windows settings (`win.signtoolOptions` with `certificateFile` / `certificatePassword` from environment variables, or Azure Trusted Signing); signed builds don't show the warning once the certificate has a reputation.
- **Updates.** The overlay doesn't update itself. When Electron publishes security fixes (see [electronjs.org/releases](https://www.electronjs.org/docs/latest/tutorial/electron-timelines)), bump `electron` in `overlay/package.json`, run `npm run overlay:install` and `npm run overlay:build`, and hand out the new `.exe`.

---

## Troubleshooting

| Message | Fix |
| --- | --- |
| "Supabase isn't configured" | `.env` is missing values (local), or the Vercel env vars weren't set before the build: add them and redeploy. |
| "Can't reach the database… project may be paused" | Check your connection. Free Supabase projects pause after inactivity; open the dashboard and click **Restore project**. |
| "The database tables are missing" | Run `supabase/schema.sql`. |
| "Wrong email or password" | Check the email; use **Forgot password?**. An admin can also set a new password under **Authentication → Users**. |
| "Couldn't send the email" (Supabase: *Error sending confirmation email*) | Supabase couldn't hand the email to your SMTP server. In the SMTP settings: the password is the Resend **API key** (`re_…`), username `resend`, host `smtp.resend.com`, port `465`, and the sender email is on a domain Resend shows as *Verified*. Resend's test sender `onboarding@resend.dev` only delivers to the email that owns the Resend account. Resend → **Logs** and Supabase → **Logs → Auth** give the exact reason. |
| The confirmation email never arrives | Check spam. Supabase's built-in sender stops after a few emails an hour: set up custom SMTP ([Emails](#emails-confirmation-and-password-reset)). With SMTP set up, check **Authentication → Rate Limits** and your provider's logs. The player can use **Resend the confirmation email** on the login screen. |
| "That invite code doesn't work" | The code is mistyped, the captain made a new code (old ones stop working), or invites are turned off (Team → Settings). Ask the captain for the current link. |
| "Too many tries" when joining | 10 code tries per 10 minutes, so codes can't be guessed. Wait 10 minutes. |
| "You're already in a team" | One login = one team. Leave the current team first (Team → Settings → Leave team), then join. |
| "Your team needs a captain" | The last captain can't leave or step down while others are in the team: make someone else captain first. |
| "New accounts are turned off" | Sign-ups are off: Authentication → Sign In / Providers → Allow new users to sign up. |
| Get started shows instead of the team | That login isn't in a team (any more): it was removed, left, or the team was deleted. Join again with an invite code, or create a team. |
| "I can't see my team's data" (empty lists after signing in) | Check the member's `team_members.team_id`: it must be their team's id (**Table Editor → teams**). After moving someone, they need to reload the page. |
| "That name is already taken" when adding a player | Names are unique **per team**: that team already has a player with this name. Another team can use it. |
| The team's state (side, map, bans) doesn't save after the teams upgrade | `schema.sql` ran before the new website was live (see [Upgrading](#upgrading-an-existing-setup)). Deploy the new website. |
| "This Steam account isn't on the team" | Put the player's SteamID64 in `team_members.steam_id` (step 3.3). |
| "Steam sign-in isn't set up yet" / "Steam sign-in didn't work" | Deploy the `steam-auth` function and set `ALLOWED_RETURN_ORIGINS` to include the site's exact address (step 3.4). Check the function's logs in **Edge Functions → steam-auth → Logs**. |
| Password-reset link says it expired or fails | Open the link in the same browser you asked from, within an hour, and check the site is in **Redirect URLs** (step 3.1). |
| Everything is empty or every save fails after an upgrade | `schema.sql` ran before the logins were ready: finish [Upgrading](#upgrading-an-existing-setup) steps 2–4, then sign in. |
| "Database update needed" when saving strategies or roster details | Re-run `supabase/schema.sql` (see [Upgrading](#upgrading-an-existing-setup)). |
| "Adding players needs the latest database setup" | Same: re-run `supabase/schema.sql`. |
| Live dot says "Reconnecting…" | Realtime dropped. It reconnects automatically and catches up on missed changes. |
| "Your change wasn't shared with the team" | The write failed (network or permissions). Your screen shows it; others don't see it yet. Retry once you're back online. |
