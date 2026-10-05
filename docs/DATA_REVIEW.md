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
| Solid Snake | attack | intel | I couldn't confirm the kit in detail |
| Rauora | attack | support | Placed as a line-of-sight / doorway utility op |
| Deimos | attack | intel | Tracking-style kit; could also be a fragger/roamer-hunter |
| Brava | attack | support | Gadget hijack; could also be intel |
| Ram | attack | soft-breacher | Could also count as support (utility clear) |
| Striker | attack | support | Flexible "pick your gadgets" operator |
| Fuze | attack | support, soft-breacher | Soft-breacher tag is debatable |
| Kali | attack | support | Her lance helps hard-breachers; not a breacher herself |
| Nøkk | attack | support | Flanker; no exact role fits |
| Glaz | attack | support | Sniper; no exact role fits |
| Noor | defend | anchor, support | New in Y11S3; shield counter / plant denial |
| Denari | defend | support | I couldn't confirm the kit in detail |
| Skopós | defend | roamer, intel | Two-body robot kit |
| Sentry | defend | anchor, support | Flexible "pick your gadgets" operator |
| Tubarão | defend | support | Gadget-freezing utility |
| Fenrir | defend | anchor, support | Could also be a roamer |
| Kapkan | defend | support | Trapper; some teams count him as anchor |
| Clash | defend | support | Shield; some teams count her as anchor |

## Operator profiles (`src/data/operatorProfiles.json`)

Written from memory, **not** checked against the current season. Ubisoft changes loadouts often, so treat weapons as the most likely to be out of date. Please check:

- **Health / speed** for everyone. Values are 1 to 3 (Siege X health and speed ratings).
- **Weapons**. Lists hold the main options only; secondary gadgets are left out on purpose.
- **Marked `"check": true`** (the profile shows a "needs checking" note): Deimos, Striker, Rauora, Solid Snake, Sentry, Skopós, Denari, Noor. Rauora, Solid Snake, Denari and Noor have no weapons listed and only a rough ability description.
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

**Left empty on purpose (please fill in):** Calypso Casino, Consulate, Fortress, Kanal, Lair, Nighthaven Labs, Outback, Skyscraper, Theme Park, Villa. Villa's sites changed this season (Living Room / Library moved to the basement).

### Map notes

Short starter notes exist only for the six maps above. Every other map shows an "add notes" prompt in the app.

## Strategy library (`src/data/strategies.json`)

**AI suggestions (21):** written from general Siege knowledge by an AI and labelled as such in the app. They are role-based plans (hard-breach execute, vertical, breach denial, site hold, deep roam) applied to real site names. They are **not** verified or pro strategies, and their board positions come from an abstract layout, so they're flagged on the real map. Things to check before relying on one:

- Whether the "main wall", "hatch above" and "floor above" exist the way the plan assumes on that site.
- Spawn fields are empty on purpose: fill in your team's spawns when you adapt a strategy.
- Each operator's gadget sentence is generic (e.g. "Use your Evil Eye with a view of the main entry").

**References (3), link only:** the source pages' terms couldn't be checked (the sites were unreachable from the environment that built this), so nothing was copied: only title, URL, map, site and side. Operators were left empty because they couldn't be verified.

- R6 Coaching, "Clubhouse Cash Room / CCTV Room — Attack & Defense Strats" (attack and defense entries)
- Alviran, "R6 Clubhouse Callouts Guide 2026: Map Layout, Sites and Attack Plans"

Open each link once to confirm it still works and matches the title.
