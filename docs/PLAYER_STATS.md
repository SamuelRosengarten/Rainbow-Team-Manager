# Player stats

Stats are **coaching input**, not a feature of their own. They are optional: a team with no stats source works exactly as before, and a player with no stats is simply coached from their roles, favorites and blocks.

```
Ubisoft username + platform
        ↓
statsProvider.js   (the only file that knows where stats come from)
        ↓
playerStats.js     (normalise; infer roles, strong and weak maps)
        ↓
player_details     (saved with the player, shared with the team)
        ↓
lineup.js          (the coaching engine uses them as soft signals)
```

## Connecting a source

Set `VITE_STATS_API_URL` to an HTTP endpoint you control or trust. The app calls

```
GET <url>?username=<ubisoft username>&platform=<pc|xbox|playstation>
```

and expects JSON (any field may be missing; rates can be `0.54` or `54`):

```json
{
  "rank": { "name": "Emerald II", "rp": 3100 },
  "kd": 1.18, "winRate": 54, "headshotPct": 48, "matches": 126,
  "operators": [{ "name": "Thermite", "kd": 1.5, "winRate": 62, "matches": 90 }],
  "maps":      [{ "name": "Clubhouse", "winRate": 66, "matches": 20 }],
  "attack":  { "kd": 1.2, "winRate": 55 },
  "defense": { "kd": 1.15, "winRate": 53 }
}
```

Return `404` for an unknown player and `429` when rate limited. Unknown operators and maps are dropped; nothing is guessed.

- The endpoint is called from the browser, so it must allow CORS. Keep any API key on **its** server; anything in `VITE_*` is public.
- The app only ever sends a public Ubisoft username and a platform. It never asks for, receives or stores Ubisoft credentials.
- Changing source means changing `statsProvider.js` (or the endpoint). Nothing else in the app depends on it.

Without `VITE_STATS_API_URL`, **Find Player** and **Refresh** report "Stats unavailable" and the app carries on.

## Database

Stats are saved with the player in three optional columns on `player_details` (`platform`, `stats`, `stats_updated_at`). Re-run `supabase/schema.sql` to add them; it only adds. Until then everything else is saved as usual and stats simply aren't shared.

## How the coach uses them

Priority, strongest first (see `src/lib/lineup.js`):

1. **Blocked** operators (anyone's blocks, plus team bans) are never recommended. This is a filter, not a score.
2. **Favorites** beat every statistic. The weights guarantee a favorite that can do a job outranks a better-performing operator.
3. A player's **proven strengths** (operator performance, ignoring small samples).
4. **Team composition**: one operator per job, the player's role (explicit main role, else inferred from what they play, else Flex).
5. **Site and map**: the job the plan needs there; a weak map is a soft nudge toward a lower-risk job, never a penalty.
6. General viability: how closely the operator matches the plan.
