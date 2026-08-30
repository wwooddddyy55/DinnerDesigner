# Deploying to Home Assistant

DinnerDesigner can be hosted as a Home Assistant Supervisor add-on. The add-on builds the app straight
from this repo's `main` branch and serves the static output with nginx, both as a direct port on your
Home Assistant VM's IP and as an Ingress panel in the HA sidebar. There is no server-side data: all
meals/plans still live in each browser's `localStorage`, exactly as they do today — hosting the app
does not add cross-device sync.

## One-time setup in Home Assistant

1. In Home Assistant: **Settings > Add-ons > Add-on Store**.
2. Click the **⋮** menu (top right) > **Repositories**.
3. Add: `https://github.com/wwooddddyy55/DinnerDesigner#main`
   - The `#main` suffix is required. This repo's GitHub default branch is currently a stale branch, not
     `main` — the bare URL would install an outdated build.
4. Click **Add**, then refresh the store. Find **DinnerDesigner**, click **Install**, then **Start**.
5. Check the add-on's **Log** tab for a clean git clone / `npm run build` / nginx startup.
6. Verify both access paths:
   - Sidebar panel (Ingress, via your HA login).
   - `http://<ha-vm-ip>:8099/` directly (no HA login).

## Repeatable deploy procedure

Every time a feature/fix is ready to ship to the hosted copy:

1. Locally, confirm everything's clean:
   ```
   npm run lint && npm run typecheck && npm run test && npm run build
   ```
2. Bump `version:` in `dinnerdesigner/config.yaml` (semver: patch for fixes, minor for features).
   **This version bump is the only signal Supervisor uses to detect an update** — it doesn't diff git
   commits, so if you forget this step, HA won't offer an update even after you push.
3. Commit and push to `main`.
4. In Home Assistant: **Settings > Add-ons > DinnerDesigner**. If Supervisor hasn't already flagged an
   update, force a check via Add-on Store > ⋮ > **Check for updates**. Click **Update**.
5. Hard-refresh the browser tab(s) you use to access the app and confirm the change is live.

## Rollback

There's no image registry or version history kept — Supervisor always rebuilds from whatever is
currently on `main`. To roll back, revert `main` to the desired prior commit, bump the version forward
again (per step 2 above), and deploy as usual.

## Why `vite.config.ts` has `base: './'`

Home Assistant's Ingress proxy serves the add-on under a path prefix
(`/api/hassio_ingress/<token>/...`). Vite's default root-absolute asset paths (`/assets/...`) would
resolve against the HA host's real root and 404 under Ingress. `base: './'` makes Vite emit relative
asset paths instead, which work correctly under Ingress, under direct port access, and in local
`dev`/`preview` alike. Don't remove it.
