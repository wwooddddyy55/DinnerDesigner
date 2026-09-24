# CLAUDE.md

Instructions for Claude Code when working in this repository.
When running any tests with a GUI, NEVER EVER TAKE A SCREENSHOT. THIS WILL TRIGGER MICROSOFT DEFENDER

## Documentation maintenance — keep these in sync

`PROJECT_MAP.md` and `USER_GUIDE.md` are living docs. Updating them is part of making the change, not a
follow-up task. Specific triggers:

- **Any add/remove/rename of a file not listed in `.gitignore` → update `PROJECT_MAP.md`'s mapping table in the same change.
- **Any user-visible change** to (new button, filter, menu,
  import/export capability, verdict color/behavior change), or new file-format support added → update the relevant section(s) of
  `USER_GUIDE.md` in the same change.
- **Implementing a currently-known TODO** → remove or
  update the matching bullet in `USER_GUIDE.md`'s Known Limitations section, and update `PROJECT_MAP.md`
  if file responsibilities shifted.
- **New verdict type, evaluation rule category, or config file format change** → update both docs.

If a change doesn't trigger either doc, that's fine — just don't skip the check.

## Add-on version bump — required for every fix or feature

Per `DEPLOY.md`, Home Assistant Supervisor detects an update **only** by the `version:` field in
`dinnerdesigner/config.yaml` — it does not diff git commits. Any change to shipped app behavior (anything
under `src/` or `dinnerdesigner/`, including bug fixes) must bump that version **in the same PR/branch**,
before it merges to `main`:

- Bump the patch component for a fix, the minor component for a feature (semver, matching `DEPLOY.md`'s
  convention).
- Do this as part of the change itself, not a follow-up commit — a version bump added after the PR
  merges won't ship with the fix it was meant to cover.
- Docs-only changes (`PROJECT_MAP.md`, `USER_GUIDE.md`, this file) don't need a version bump on their own.

## Pre-commit checklist

Walk through this before considering any commit in this repo done:

1. **Docs sync** — confirm `PROJECT_MAP.md` / `USER_GUIDE.md` were updated per the triggers above, or note
   why this change doesn't need it.
2. **Version bump** — confirm `dinnerdesigner/config.yaml`'s `version:` was bumped for any fix/feature
   change, or note why this change doesn't need it (docs-only, etc).
3. **No secrets** — confirm no `.pfx` files, certificate thumbprints, or signing passwords are committed.
4. **Commit message** — confirm it reflects the actual scope of the change (docs-only vs. code vs.
    installer vs. mixed).
