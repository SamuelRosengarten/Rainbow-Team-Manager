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

## Maps (`src/data/maps.json`)

Ubisoft's Split Fire page doesn't list the ranked pool, so the list is pieced together from several sources:

- **Verified in ranked:** Bank, Border, Chalet, Clubhouse, Consulate, Kafe Dostoyevsky, Lair, Nighthaven Labs (the Pro Pool), plus Calypso Casino, Coastline and Villa ([bo3.gg Y11S2 pool structure](https://bo3.gg/r6siege/news/ubisoft-revealed-a-new-approach-to-the-ranked-map-pool-in-rainbow-six-siege-for-y11s2), [timesaver.gg Y11S3 ranked guide](https://timesaver.gg/blog/rainbow-six-siege-ranked-guide-y11s3), and an in-game check reported in [a public repo](https://github.com/JPLutz7/R6Tactics/pull/149)). That check counted **17 ranked maps** and listed Emerald Plains, Stadium and Favela as unranked-only.
- **Not verified, probably ranked:** Fortress, Kanal, Oregon, Outback, Skyscraper, Theme Park. These six make up the count of 17, and all were in the Y11S1.2 or Y11S2 pools, but I found no source naming them for Y11S3. **Check them against the in-game ban screen.**
- **Excluded:** Emerald Plains (reported unranked-only in Y11S3).

### Bomb sites

Sites are filled in **only** for maps whose current site names I'm confident about: Bank, Border, Chalet, Clubhouse, Coastline, Kafe Dostoyevsky. `attack` and `defend` hold the same four bomb sites. Edit them separately if your team wants different lists per side.

**Left empty on purpose (please fill in):** Calypso Casino, Consulate, Fortress, Kanal, Lair, Nighthaven Labs, Oregon, Outback, Skyscraper, Theme Park, Villa. Villa's sites changed this season (Living Room / Library moved to the basement).

### Map notes

Short starter notes exist only for the six maps above. Every other map shows an "add notes" prompt in the app.
