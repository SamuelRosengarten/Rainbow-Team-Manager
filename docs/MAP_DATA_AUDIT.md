# Map data audit

Generated during the builder and map-data audit. Nothing here was added to the data without a source the team can check.

## Bomb sites (`src/data/maps.json`)

Every map now lists its four bomb sites. The ten maps that were empty were filled in October 2026 from the sources in [DATA_REVIEW.md → Bomb sites](DATA_REVIEW.md#bomb-sites). Two still need checking in game: **Fortress** (the source predates its Dec 2025 rework) and **Calypso Casino** (floors inferred from the blueprints).

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
