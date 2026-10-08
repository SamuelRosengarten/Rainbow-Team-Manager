# Data review checklist

Things in `src/data/` that need a human check. Last checked against the web on 2026-10-05 (Y11S3, Operation Split Fire).

## Operators (`src/data/operators.json`)

**Roster: verified.** There are 78 operators, 39 per side.
- Attackers: [timesaver.gg Y11S3 tier list](https://timesaver.gg/blog/rainbow-six-siege-operator-tier-list-y11s3), which says "78 operators total: 39 attackers and 39 defenders".
- Defenders: [Dexerto defenders wiki](https://www.dexerto.com/wikis/rainbow-six/operators/defenders/) lists 38. Noor, added in Y11S3, makes 39 ([Ubisoft Split Fire page](https://www.ubisoft.com/en-us/game/rainbow-six/siege/news-updates/seasons/splitfire)).

IDs are lowercase ASCII slugs, so image names never contain accents: `capitao`, `nokk`, `jager`, `tubarao`, `skopos`, `solid-snake`.

### Role assignments to review

Roles are a judgement call. Most of the classic operators are well established. **Please review these ones:**

| Operator | Side | Assigned | Why unsure |
| --- | --- | --- | --- |
| Solid Snake | attack | intel | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Solid_Snake) (Oct 2026); secondary weapons not listed there |
| Rauora | attack | support | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Rauora) (Oct 2026) |
| Deimos | attack | intel | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Deimos) (Oct 2026; Ubisoft: Intel, Map Control) |
| Brava | attack | support | Gadget hijack; could also be intel |
| Ram | attack | soft-breacher | Could also count as support (utility clear) |
| Striker | attack | support | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Striker) (Oct 2026); picks any two gadgets |
| Fuze | attack | support, soft-breacher | Soft-breacher tag is debatable |
| Kali | attack | support | Her lance helps hard-breachers; not a breacher herself |
| Nøkk | attack | support | Flanker; no exact role fits |
| Glaz | attack | support | Sniper; no exact role fits |
| Noor | defend | anchor, support | Kit from [SiegeGG](https://siege.gg/news/rainbow-six-siege-operator-guide-noor), matching Mobalytics and Sportskeeda (Oct 2026; no Liquipedia page yet) |
| Denari | defend | anchor, support | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Denari) (Oct 2026; Glaive-12 from its patch notes). Ubisoft lists Anti-Entry / Crowd Control: a site trapper like Frost or Thorn |
| Skopós | defend | roamer, intel | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Skop%C3%B3s) (Oct 2026; light and fast since Silent Hunt; Ubisoft: Intel, Support) |
| Sentry | defend | anchor, support | Kit from [Liquipedia](https://liquipedia.net/rainbowsix/Sentry) (Oct 2026); picks any two gadgets |
| Tubarão | defend | support | Gadget-freezing utility |
| Fenrir | defend | anchor, support | Could also be a roamer |
| Kapkan | defend | support | Trapper; some teams count him as anchor |
| Clash | defend | support | Shield; some teams count her as anchor |

## Operator profiles (`src/data/operatorProfiles.json`)

Written from memory, **not** checked against the current season. Ubisoft changes loadouts often, so treat weapons as the most likely to be out of date. Please check:

- **Health / speed** for everyone. Values are 1 to 3 (Siege X health and speed ratings).
- **Weapons**. Lists hold the main options only; secondary gadgets are left out on purpose.
- **Marked `"check": true`** (the profile shows a "needs checking" note): Solid Snake only. Liquipedia lists no secondary weapons for him yet, so his profile shows "see the intro video" there. Every other operator has a sourced kit (Deimos, Striker, Sentry, Skopós, Rauora, Denari and Noor were filled in or corrected in October 2026).
- **Role taxonomy:** the app's roles are hard breacher, soft breacher, intel, anchor, roamer and support. There is no Entry or Flex role, so entry/flex attackers such as Amaru (Ubisoft: Front Line, Map Control), Nøkk and Flores stay **support**. Adding a role would change every recommendation, so it is not done in a data fix.
- **Intro videos**: every profile links to a YouTube search. Add a `"video"` URL to pin the exact video.

## Floor plans (`src/data/floorPlans.json`)

**Official Ubisoft blueprints, supplied by the team**, for all 63 floors of the 17 planner maps. They're unverified and have no callouts yet: see [MAP_ASSETS.md](MAP_ASSETS.md). Floors were identified by eye, because the blueprints don't print their floor names. Check these against the game first: **Kanal** (basement and floor order) and **Lair** (basement, 1F and 2F).

The floors listed for each map come only from its bomb sites (`B`, `1F`, `2F`, `3F`). Roofs, towers and other floors without a site aren't listed until you add a `floors` list to the map.

## Maps (`src/data/maps.json`)

Ubisoft's Split Fire page doesn't list the ranked pool, so the list is pieced together from several sources:

- **Verified in ranked:** Bank, Border, Chalet, Clubhouse, Consulate, Kafe Dostoyevsky, Lair, Nighthaven Labs (the Pro Pool), plus Calypso Casino, Coastline and Villa ([bo3.gg Y11S2 pool structure](https://bo3.gg/r6siege/news/ubisoft-revealed-a-new-approach-to-the-ranked-map-pool-in-rainbow-six-siege-for-y11s2), [timesaver.gg Y11S3 ranked guide](https://timesaver.gg/blog/rainbow-six-siege-ranked-guide-y11s3), and an in-game check reported in [a public repo](https://github.com/JPLutz7/R6Tactics/pull/149)). That check counted **17 ranked maps** and listed Emerald Plains, Stadium and Favela as unranked-only.
- **Not verified, probably ranked:** Fortress, Kanal, Oregon, Outback, Skyscraper, Theme Park. These six make up the count of 17, and all were in the Y11S1.2 or Y11S2 pools, but I found no source naming them for Y11S3. **Check them against the in-game ban screen.**
- **Excluded:** Emerald Plains (reported unranked-only in Y11S3).

### Bomb sites

Sites are filled in **only** for maps whose current site names I'm confident about: Bank, Border, Chalet, Clubhouse, Coastline, Kafe Dostoyevsky. `attack` and `defend` hold the same four bomb sites. Edit them separately if your team wants different lists per side.

**Oregon (added for the strategy library, please check):** 2F Kids' Dorms / Dorms Main Hall, 1F Kitchen / Dining Hall, 1F Meeting Hall / Kitchen, B Laundry Room / Supply Room. Written from memory, not checked against the current map.

**Added from sources (October 2026, please check in game):** the other ten maps, so every map can be planned. Each site is `"<floor> Room A / Room B"`, as for the others.

- Consulate, Fortress, Kanal, Lair, Nighthaven Labs, Outback, Skyscraper, Theme Park, Villa: the *Bomb* list on each map's Liquipedia page (`https://liquipedia.net/rainbowsix/<Map>`). Where the page shows several versions (Kanal, Outback, Theme Park), the current, post-rework list was used. Villa uses the Y11S3 layout (Art Storage / Old Office in the basement).
- **Fortress:** Liquipedia's list still uses the pre-rework room names (Bedroom / Commander's Office, Dormitory / Briefing Room, Kitchen / Cafeteria, Hammam / Sitting Room). The map was reworked in Operation Tenfold Pursuit (Dec 2025); check the sites in game.
- **Calypso Casino** (Operation System Override, June 2026; no Liquipedia page yet): site names from the GladiatorBoost site guide (Cigar Room / Pool, Blackjack / Poker, Bar / Betting, CCTV / Vault). Ubisoft's map page confirms the Vault is in the basement. The other floors are **inferred** from the Ubisoft blueprints (the billiard table is on 2F, the card tables on 1F): check them in game.

### Map notes

Short starter notes exist only for the six maps above. Every other map shows an "add notes" prompt in the app.

## Strategy library (`src/data/strategies.json`)

**AI suggestions (21):** written from general Siege knowledge by an AI and labelled "Suggested" in the app (no model runs in the app: they are fixed data, ranked by rules). They are role-based plans (hard-breach execute, vertical, breach denial, site hold, deep roam) applied to real site names. They are **not** verified or pro strategies, and their board positions come from an abstract layout, so they're flagged on the real map. Things to check before relying on one:

- Whether the "main wall", "hatch above" and "floor above" exist the way the plan assumes on that site.
- Spawn fields are empty on purpose: fill in your team's spawns when you adapt a strategy.
- Each operator's gadget sentence is generic (e.g. "Use your Evil Eye with a view of the main entry").

**References (3), link only:** the source pages' terms couldn't be checked (the sites were unreachable from the environment that built this), so nothing was copied: only title, URL, map, site and side. Operators were left empty because they couldn't be verified.

- R6 Coaching, "Clubhouse Cash Room / CCTV Room — Attack & Defense Strats" (attack and defense entries)
- Alviran, "R6 Clubhouse Callouts Guide 2026: Map Layout, Sites and Attack Plans"

Open each link once to confirm it still works and matches the title.
