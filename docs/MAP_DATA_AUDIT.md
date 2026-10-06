# Map data audit

Generated during the builder and map-data audit. Nothing here was added to the data without a source the team can check.

## Maps with no bomb sites listed (`src/data/maps.json`)

The sites were **not added**. The sources to cite (Ubisoft, Liquipedia, the Rainbow Six Fandom wiki, siege.gg) were blocked from the environment this audit ran in, and web-search snippets were inconsistent (see notes). The leads below are unconfirmed: check each one in game or on a reliable page, then add it in the existing format (`"1F Room A / Room B"`, the same list for `attack` and `defend`).

| Map | Floors | Unconfirmed lead (do not copy as is) | Where to confirm |
|---|---|---|---|
| Calypso Casino | Basement, 1F, 2F, Roof | Basement: CCTV / Vault · 1F: Bar / Betting, Blackjack / Poker · 2F: Cigar Room / Pool (search snippet; floors per site unclear) | <https://www.ubisoft.com/es-es/game/rainbow-six/siege/game-info/maps/calypso-casino> · <https://gladiatorboost.com/news/rainbow-six-siege-calypso-casino-guide-best-strategies-operators-site-setups/> |
| Consulate | Basement, 1F, 2F, Roof | Consul Office / Meeting Room, Garage / Cafe, Lobby / Press Room, Tellers / Archives (floors not given) | <https://liquipedia.net/rainbowsix/Consulate> · <https://rainbowsix.fandom.com/wiki/Consulate> |
| Fortress | 1F, 2F, Roof | No usable result | <https://rainbowsix.fandom.com/wiki/Bomb_(Siege)> |
| Kanal | Basement, 1F, 2F, Roof | 2F Server / Radar, 1F Security / Maps, 1F Coast Guard Meeting / Lounge, B Supply / Kayaks (snippet contradicts itself: says "two sites", lists four) | <https://rainbowsix.fandom.com/wiki/File:Kanal_Rework_1.jpg> |
| Lair | Basement, 1F, 2F, Roof | Only two of four found: 2F Master Office / R6 Room, 1F Bunks / Briefing | <https://liquipedia.net/rainbowsix/Lair/siege> · <https://alviran.net/blog/r6-lair-callouts-guide-2026/> |
| Nighthaven Labs | Basement, 1F, 2F, Roof | 2F Command / Server, 1F Control / Storage, 1F Kitchen / Cafeteria, B Tank / Assembly (attributed to Liquipedia; same snippet also says "one basement site and two on 1F") | <https://liquipedia.net/rainbowsix/Nighthaven_Labs> |
| Outback | 1F, 2F, Roof | Green / Red Bedroom, Mechanic Shop / Kitchen, Party Room / Office, Piano Room / Laundry (may mix pre- and post-rework names; floors not given) | <https://siege.gg/news/rainbow-six-siege-map-guide-outback> |
| Skyscraper | 1F, 2F, Roof | Tea / Karaoke, Office / Exhibition, Kitchen / BBQ, Master / Bathroom (floors not given) | <https://alviran.net/blog/r6-skyscraper-callouts-guide-2026/> |
| Theme Park | 1F, 2F, Roof | Armory / Throne, Bunk / Day Care, Lab / Storage, Initiation / Office (floors not given) | <https://alviran.net/blog/r6-theme-park-callouts-guide-2026/> |
| Villa | Basement, 1F, 2F, Roof | Y11S3: Aviator / Games (2F), Trophy / Statuary (2F), Kitchen / Dining (1F), Art Storage / Old Office (B) — reported redesign | <https://timesaver.gg/blog/rainbow-six-siege-villa-callouts-y11s3> |

## Floor plans (`src/data/floorPlans.json`)

63 floor plans, **0 verified**, **0 with callouts**. Automated checks passed for every plan: the image file exists, its pixel size matches the manifest, no image is reused for two floors, and a source and license are recorded.

Verifying means a teammate compares the plan with the game and ticks each check under **Maps → map → Floor plans → Verify and export**: shape, rooms, halls, stairs, doors, windows, hatches, objectives, walls. Calibrating callouts (room names on the plan) is a separate step that also highlights bomb-site rooms on the board.

| Map | Floor | Checks done | Callouts | Source | Notes |
|---|---|---|---|---|---|
| Bank | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-bank-blueprint-3.jpg |  |
| Bank | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-bank-blueprint-1.jpg |  |
| Bank | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-bank-blueprint-2.jpg |  |
| Bank | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-bank-blueprint-4.jpg |  |
| Border | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-border-blueprint-1.jpg |  |
| Border | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-border-blueprint-2.jpg |  |
| Border | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-border-blueprint-3.jpg |  |
| Calypso Casino | Basement | 0/9 | 0 | Ubisoft blueprint R6S_Maps_CalypsoCasino_Basement.png |  |
| Calypso Casino | 1F | 0/9 | 0 | Ubisoft blueprint R6S_Maps_CalypsoCasino_1F.png |  |
| Calypso Casino | 2F | 0/9 | 0 | Ubisoft blueprint R6S_Maps_CalypsoCasino_2F.png |  |
| Calypso Casino | Roof | 0/9 | 0 | Ubisoft blueprint R6S_Maps_CalypsoCasino_Roof.png |  |
| Chalet | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-chalet-blueprint-1.jpg |  |
| Chalet | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-chalet-blueprint-2.jpg |  |
| Chalet | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-chalet-blueprint-3.jpg |  |
| Chalet | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-chalet-blueprint-4.jpg |  |
| Clubhouse | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-clubhouse-blueprint-1.jpg |  |
| Clubhouse | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-clubhouse-blueprint-2.jpg |  |
| Clubhouse | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-clubhouse-blueprint-3.jpg |  |
| Clubhouse | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-clubhouse-blueprint-4.jpg |  |
| Coastline | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-coastline-blueprint-1.jpg | Building fills a small part of the image; consider cropping before calibrating. |
| Coastline | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-coastline-blueprint-2.jpg |  |
| Coastline | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-coastline-blueprint-3.jpg | Purple shape at the top of the image: check it against the game. |
| Consulate | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-consulate-blueprint-1.jpg |  |
| Consulate | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-consulate-blueprint-2.jpg | Building fills a small part of the image; consider cropping before calibrating. |
| Consulate | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-consulate-blueprint-3.jpg |  |
| Consulate | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-consulate-blueprint-4.jpg |  |
| Fortress | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-fortress-blueprint-1.jpg |  |
| Fortress | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-fortress-blueprint-2.jpg |  |
| Fortress | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-fortress-blueprint-3.jpg |  |
| Kafe Dostoyevsky | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-kafe-blueprint-1.jpg |  |
| Kafe Dostoyevsky | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-kafe-blueprint-2.jpg |  |
| Kafe Dostoyevsky | 3F | 0/9 | 0 | Ubisoft blueprint r6-maps-kafe-blueprint-3.jpg |  |
| Kafe Dostoyevsky | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-kafe-blueprint-4.jpg |  |
| Kanal | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-kanal-blueprint-2.jpg |  |
| Kanal | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-kanal-blueprint-3.jpg |  |
| Kanal | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-kanal-blueprint-4.jpg |  |
| Kanal | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-kanal-blueprint-5.jpg |  |
| Lair | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-lair-blueprint-1.jpg |  |
| Lair | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-lair-blueprint-2.jpg |  |
| Lair | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-lair-blueprint-3.jpg |  |
| Lair | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-lair-blueprint-4.jpg |  |
| Nighthaven Labs | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-nighthavenlabs-blueprint-1.jpg |  |
| Nighthaven Labs | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-nighthavenlabs-blueprint-2.jpg |  |
| Nighthaven Labs | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-nighthavenlabs-blueprint-3.jpg |  |
| Nighthaven Labs | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-nighthavenlabs-blueprint-4.jpg |  |
| Oregon | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-oregon-blueprint-1.jpg |  |
| Oregon | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-oregon-blueprint-2.jpg |  |
| Oregon | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-oregon-blueprint-3.jpg |  |
| Oregon | 3F | 0/9 | 0 | Ubisoft blueprint r6-maps-oregon-blueprint-4.jpg |  |
| Oregon | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-oregon-blueprint-5.jpg |  |
| Outback | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-outback-blueprint-1.jpg |  |
| Outback | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-outback-blueprint-2.jpg |  |
| Outback | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-outback-blueprint-3.jpg |  |
| Skyscraper | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-skyscraper-blueprint-1.jpg |  |
| Skyscraper | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-skyscraper-blueprint-2.jpg |  |
| Skyscraper | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-skyscraper-blueprint-3.jpg |  |
| Theme Park | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-themepark-blueprint-1.jpg |  |
| Theme Park | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-themepark-blueprint-2.jpg |  |
| Theme Park | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-themepark-blueprint-3.jpg |  |
| Villa | Basement | 0/9 | 0 | Ubisoft blueprint r6-maps-villa-blueprint-1.jpg | Building fills a small part of the image. One source reports a Y11S3 Villa redesign (new basement site); check this blueprint is current. |
| Villa | 1F | 0/9 | 0 | Ubisoft blueprint r6-maps-villa-blueprint-3.jpg | Building fills a small part of the image. One source reports a Y11S3 Villa redesign (new basement site); check this blueprint is current. |
| Villa | 2F | 0/9 | 0 | Ubisoft blueprint r6-maps-villa-blueprint-4.jpg |  |
| Villa | Roof | 0/9 | 0 | Ubisoft blueprint r6-maps-villa-blueprint-5.jpg |  |
