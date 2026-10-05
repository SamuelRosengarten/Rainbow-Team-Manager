# Map assets: real floor plans

The tactical board is only as good as the map under it. The app **does not draw maps**: every floor plan is an image the team supplies, and a floor without one is reported as missing instead of being approximated.

## Why no floor plans ship with the app

Accurate floor plans of Rainbow Six Siege maps are Ubisoft's game art (the in-game blueprints, and the community sites built from them). Ubisoft's fan-content rules restrict using imagery taken directly from the game, and the fan-art program that set those rules is currently closed. I couldn't confirm that bundling those images in this repository is allowed, so none are included. Whether a given image can be used is the team's call. Typical options:

- **Your own tracing.** A plan the team draws itself by tracing the game (wall lines, doors, hatches, stairs) is your own work. This is the safest option.
- **Ubisoft's official map pages** (`ubisoft.com/…/siege/game-info/maps/<map>`) show blueprints. They're fine as a *reference* for checking a plan. Check Ubisoft's terms before putting them in the repo.
- **Community map sites.** These are usually built from Ubisoft's blueprints, so the same question applies. Check each site's license, and ask the author if it isn't clear.

Record where every image came from and why you may use it (`source` and `license` in the manifest).

## Adding a floor plan

1. Get an accurate top-down image of one floor. Don't crop or stretch it, and keep north at the top, the same way for every floor of a map.
2. Save it as `public/maps/<map id>/<floor id>.webp`. PNG, JPG and SVG work too. Floor ids are `b`, `1f`, `2f`, `3f` and `roof`, and map ids are in `src/data/maps.json`.
3. Open **Maps → (map) → Floor plans**, pick the floor and click **Try an image from this computer**. Pick the same file. Nothing is uploaded; the image stays in this browser session.
4. Click **Calibrate callouts**. For each room, staircase, hatch, objective and so on, type its name, pick its kind and click its exact spot on the plan. Use the in-game names: a callout whose name matches a bomb-site room (for example "CEO Office" for `2F Executive Lounge / CEO Office`) is highlighted as the site.
5. Open **Verify and export**, fill in the source and license, then **Copy manifest entry**. Paste it into `plans` in `src/data/floorPlans.json`, merging it under the map's id.
6. Commit the image and the manifest.

Repeat for every floor. Ship fewer maps that are right rather than more that are close.

## Manifest format (`src/data/floorPlans.json`)

```json
{
  "plans": {
    "bank": {
      "2f": {
        "file": "maps/bank/2f.webp",
        "width": 2048,
        "height": 1486,
        "source": "Traced by the team from the game, Y11S3",
        "license": "Own work",
        "verified": true,
        "verifiedBy": "Samuel",
        "verifiedAt": "2026-10-05",
        "checks": ["shape", "rooms", "halls", "stairs", "doors", "windows", "hatches", "objectives", "walls"],
        "callouts": [
          { "id": "ceo-office", "name": "CEO Office", "kind": "room", "x": 0.4123, "y": 0.3377 },
          { "id": "ceo-hatch", "name": "CEO hatch", "kind": "hatch", "x": 0.4401, "y": 0.3912 }
        ]
      }
    }
  }
}
```

- `width` and `height` are the image's pixel size. They set the board's aspect ratio, so the plan is never stretched.
- `x` and `y` are **normalised**: 0 to 1 across the image, from the top-left corner. Every position in the app works this way: callouts, players, utility, drones, breaches, plants, paths, crossfires and areas.
- Callout `kind` is one of `room`, `objective`, `stairs`, `hatch`, `elevator`, `door`, `window` or `destructible-floor`.
- An entry is ignored when its file path isn't `maps/<map>/<floor>.<png|webp|jpg|jpeg|svg>` or its size is missing.

## Verification

A plan stays **unverified** (the board says so) until someone compares it with the game and ticks every check: overall building shape, room positions, hallways, stairs, doors, windows, hatches, objective and site locations, and major walls. If anything doesn't line up, fix the image, not the check.

## Which floors a map has

`floorsFor(mapId)` uses `floors` in `maps.json` when it's set. Otherwise it lists the floors the map's bomb sites are on, plus any floor that has a plan. Nothing is guessed, so a map with no sites listed has no floors until you add them. To add a floor that has no bomb site (a roof, or Oregon's tower, for example), give the map a `floors` list such as `["b", "1f", "2f", "roof"]`.

## Strategies and layouts

- New strategies on a floor that has a plan use the **real floor plan** layout. Each object stores its floor, and the board shows one floor at a time.
- Strategies made before floor plans existed, and new ones on floors without a plan, use the **abstract schematic**. That's two boxes for the bomb site, clearly labelled as not the real map. Their positions are approximate.
- Once a plan exists, open a schematic strategy in the editor and use **Move it onto the real floor plan**. The objects keep their places on the board, so drag each one to its real position before saving.

## Missing assets

The Maps index lists every map floor without a plan (and the file it expects). At the time of writing, **no plans are bundled**, so every floor is missing.
