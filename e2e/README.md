# End-to-end tests

The built app in a real browser (Chromium), in offline mode, so no Supabase
settings are needed.

```sh
npm run e2e                      # builds, starts vite preview on :4173, runs everything
npx playwright test e2e/routes.spec.js   # one file
npx playwright show-report        # after a failure (screenshots and traces)
```

First time on a new machine: `npx playwright install chromium`.

| File | What it checks |
|---|---|
| `routes.spec.js` | Every route in English and French, desktop (1440) and phone (375): no console errors, no horizontal overflow, zero axe-core violations (also the first screen). |
| `builder.spec.js` | Simple builder from map to a saved plan (ready-made plan and empty map); Advanced 10-step flow, stepper, start over. |
| `tactics.spec.js` | Tactics editor: approximate positions, who/when, place, duplicate, hide, select from the panel and the map, edit, delete with undo, keyboard undo/redo, shortcuts, zoom, pan, floors, moving between steps. |
| `fullscreen.spec.js` | Fullscreen map on desktop, phone portrait and landscape: enter/leave with the button, F, Esc and back; place, edit, delete and undo inside it; controls on screen and 44 px on touch; scroll position restored. |
| `security.spec.js` | No service role key or Steam secret in the built website or overlay; the security headers from `vercel.json` are sent (`vite preview` uses them); the content security policy reports nothing while the app runs. |
| `selfserve.spec.js` | On an online build pointed at a fake Supabase (`mockSupabase.js`, port 4174): create an account → confirmation message → "confirm your email" → sign in → Get started → create a team → invite link and captain controls (axe clean); open an invite link signed out → sign in → join as an existing roster player → no captain controls → leave; a wrong code. |

CI (`.github/workflows/ci.yml`) runs lint, unit tests, build and these tests
on every pull request.
