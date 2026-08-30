# Project Map

DinnerDesigner is a Vite + React 19 + TypeScript app for building a weekly meal plan from a personal
meal library, tracking progress toward per-person weekly serving targets, and generating a shopping
list. State lives in a single Zustand store persisted to `localStorage`, which remains the sole source
of truth when the app runs with no backend (e.g. local dev); there is no router (screen switching is
local `useState` in `App.tsx`). When hosted as the Home Assistant add-on, a small Node backend
(`dinnerdesigner/server/index.js`) inside the same container syncs that state across every device
pointed at the add-on — see `src/lib/sync.ts` and the "Data model notes" section below.

## File map

| Path | Responsibility |
| --- | --- |
| `src/main.tsx` | React root / entry point. |
| `src/App.tsx` | Top-level screen switcher (`setup` / `library` / `plan` / `shopping-list` / `history`), triggers meal-library seeding on mount. |
| `src/types/index.ts` | Core domain types: `MealType`, `ProteinType`, `Ingredient`, `Meal` (incl. optional `sourceUrl` link to the original recipe), `Person` (with `availability`, a per-meal-type 7-day pattern), `MealAssignment` (incl. `weight`, used to derive its share of a combined cell), `PlannedMealEntry` (incl. optional `isLeftover`/`leftoverServingsUsed`, a static baseline for a batch already partly eaten in a prior week), `WeeklyPlan`, plus shared constants/labels including `MAX_CELL_OCCUPANTS`, `MIN_ASSIGNMENT_WEIGHT`, `MAX_ASSIGNMENT_WEIGHT`. |
| `src/store/useAppStore.ts` | Zustand store (persisted as `dinner-designer-storage`, versioned with a `migrate` function, current version `4`). Owns meals, plans, active plan, and all mutating actions (`addMeal`, `startNewWeek`, `addPlannedMeal`, `setPersonAvailability`, `assignMealToCell`, `setAssignmentWeight`, `clearAssignment`, `removePlannedMeal`, `setEntryLeftover`, `setEntryServingsLeft`, etc.). Also exports `migratePerson` and `migratePlannedMealEntry`, the shared old→new shape converters used by both the persist migration and JSON import (the latter also backfills `weight: 1` onto any assignment missing it). |
| `src/data/seedMeals.ts` | Seed/starter meals inserted into an empty library on first load. |
| `src/lib/calculations.ts` | Pure functions over a `WeeklyPlan`: `getPersonAvailability`, `isCellAvailable`, `getPersonMealTypeTarget`, `getMealTypeTarget`, `getMealTypePicked` (counts distinct occupied cells, not raw assignment rows), `findCellAssignments` (all occupants of a cell), `getAssignmentFraction`, `getEntryConsumedServings` (seeded with `leftoverServingsUsed` before summing real assignments), `isEntryFullyPlaced`, `formatServingCount`, `canSetAssignmentWeight`, `getShoppingList`. |
| `src/lib/calculations.test.ts` | Vitest coverage for `calculations.ts`. |
| `src/lib/history.ts` (+ `.test.ts`) | Cross-plan aggregation for the History tab: `getWeekHistory` (weeks most-recent-first, distinct meals per week) and `getMealStaleness` (per-meal last-served week + distinct-weeks-served count, sorted most-overdue first). |
| `src/lib/date.ts` | Date helpers: `toIsoDate`, `formatWeekLabel`, `addDays`, `formatDayHeader`, `WEEKDAY_LABELS`. |
| `src/lib/id.ts` | `generateId()` (UUID) used for all new entities. |
| `src/lib/dragDrop.ts` | `cellDroppableId`/`parseCellDroppableId` encode/decode an `AssignmentGrid` cell's `(personId, mealType, day)` into the string id `@dnd-kit/core` droppables use. |
| `src/lib/exportImport.ts` | JSON export/import of the full `meals` + `plans` state (`buildExport`, `downloadExport`, `parseImport`); `parseImport` migrates any old-shape `Person`/`PlannedMealEntry` records via `migratePerson`/`migratePlannedMealEntry`. |
| `src/lib/sync.ts` | Cross-device sync orchestration against the add-on's `/api/state` backend (`dinnerdesigner/server/index.js`). `initialSync()` (called once from `App.tsx` before `seedMealsIfNeeded()`) detects whether a backend is reachable, adopts the server's state via `useAppStore.setState` (reusing `migratePerson`/`migratePlannedMealEntry`) if it already has data, or pushes this device's local state up as the seed if the server is empty; falls back to pure-`localStorage` behavior (today's default) if no backend responds. `startSyncLoop()` then debounces pushing local changes up and re-pulls on tab focus (`visibilitychange`). |
| `src/lib/mealImport.ts` (+ `.test.ts`) | Single-meal recipe import: `parseMealDraft` validates/parses a one-meal JSON draft (as produced by pasting a recipe into an LLM chat) into a `MealDraft`; `MEAL_IMPORT_PROMPT_TEMPLATE` is the copyable chat prompt describing that JSON shape (name, mealTypes, protein, servingsPerBatch, ingredients, sourceUrl, notes). |
| `src/screens/WeeklyPlanSetupScreen.tsx` (+ `.module.css`) | Pick/start a weekly plan, delete the selected week (via `ConfirmDialog`), choose meal types for the week, manage people, mark each person's day-by-day availability via `DayPlannerGrid` (their weekly serving target is derived from this), export/import data. |
| `src/screens/MealLibraryScreen.tsx` (+ `.module.css`) | Browse/filter/add/edit/delete meals in the library; **Import recipe** opens `ImportMealDialog` to bring in a single meal parsed from pasted JSON, prefilling `MealForm` for review before saving. |
| `src/screens/PlanBuilderScreen.tsx` (+ `.module.css`) | Progress bars for every meal type the plan tracks, shown at once (no tabs). A single "Choose meals" picker (filterable by meal-type and protein chips) adds meals to one unified picked list (`addPlannedMeal`); each picked-entry card (`PickedMealCard`, a `@dnd-kit/core` `useDraggable`) shows an "X/Y placed" badge (`getEntryConsumedServings`/`formatServingCount`, fractional once any of its cells are combined with other meals), plus a "Leftover from last week" checkbox (`setEntryLeftover`) that reveals a "Servings left" input (`setEntryServingsLeft`) for seeding a reduced starting-servings baseline on a batch already partly eaten in a prior week. The screen owns a `DndContext` (pointer + touch sensors, the latter with a press-and-hold activation delay so a swipe still scrolls) and a `DragOverlay` ghost card; dropping a card onto a cell in the `AssignmentGrid` below (resolved via `onDragEnd` + `parseCellDroppableId`) places one of the batch's servings onto that specific person/day/meal-type slot (the "leftovers" feature — same batch, multiple cells); dropping onto an already-occupied cell combines it with what's there instead of being rejected. |
| `src/screens/ShoppingListScreen.tsx` (+ `.module.css`) | Renders `getShoppingList(plan)` as a checkable shopping list. |
| `src/screens/HistoryScreen.tsx` (+ `.module.css`) | Renders `getWeekHistory`/`getMealStaleness` (from `lib/history.ts`) as a per-week log and a "haven't had in a while" table; works across all plans, no active plan required. |
| `src/components/NavBar.tsx` (+ `.module.css`) | Top navigation between the five screens; disables plan-dependent tabs until a plan is active (History is always enabled). |
| `src/components/PersonRow.tsx` (+ `.module.css`) | Editable row for one `Person`: name + Remove button. Availability (and thus serving targets) is set separately via `DayPlannerGrid`. |
| `src/components/DayPlannerGrid.tsx` (+ `.module.css`) | Weekly Setup's availability grid, starting from the plan's `weekStartDate`: one Meal-type × Day sub-grid per person; each cell toggles that person's `availability[mealType][day]` via `setPersonAvailability`. |
| `src/components/AssignmentGrid.tsx` (+ `.module.css`) | Plan Builder's Meal-type × Day drop-target grid (one sub-grid per person), each cell a `@dnd-kit/core` `useDroppable` (id from `lib/dragDrop.ts`'s `cellDroppableId`). Unavailable cells (per `DayPlannerGrid`) are disabled and reject drops; a cell can hold up to `MAX_CELL_OCCUPANTS` combined items — each occupant renders its name, its derived `%` share of the cell (`getAssignmentFraction`), a +/− weight stepper (`setAssignmentWeight`, disabled when `canSetAssignmentWeight` says a change would be invalid), and a "×" to remove it (`clearAssignment`); the cell keeps accepting drops until full (the actual `assignMealToCell` call happens in `PlanBuilderScreen`'s `onDragEnd`). |
| `src/components/MealCard.tsx` (+ `.module.css`) | Read-only card for a library `Meal` with edit/delete actions; links to `meal.sourceUrl` ("View original recipe") when set. |
| `src/components/MealForm.tsx` (+ `.module.css`) | Create/edit form for a `Meal` (name, meal types, protein, servings/batch, ingredients, notes, recipe link). |
| `src/components/ImportMealDialog.tsx` (+ `.module.css`) | Modal for the recipe-import flow: shows/copies `MEAL_IMPORT_PROMPT_TEMPLATE`, takes pasted JSON, calls `parseMealDraft`, and reports the parsed `MealDraft` (or an inline error) back to `MealLibraryScreen`. |
| `src/components/IngredientListEditor.tsx` (+ `.module.css`) | Editable list of `Ingredient` rows, used inside `MealForm`. |
| `src/components/ProteinFilterChips.tsx` (+ `.module.css`) | Multi-select protein filter chips, reused by the library and plan builder screens. |
| `src/components/ProgressBar.tsx` (+ `.module.css`) | Labeled progress bar for picked vs. target servings for a meal type. |
| `src/components/MealTypeFilterChips.tsx` | Multi-select meal-type filter chips (scoped to the active plan's `selectedMealTypes`), used by the plan builder's "Choose meals" picker; reuses `ProteinFilterChips.module.css` for styling. |
| `src/components/ConfirmDialog.tsx` (+ `.module.css`) | Generic confirm/cancel modal, used for meal deletion. |
| `src/styles/global.css` | Global CSS custom properties (colors, spacing, radius) and base element styles shared across the app. |
| `repository.yaml` | Marks this repo as a Home Assistant Supervisor add-on repository (name/url/maintainer), so it can be added via HA's Add-on Store > Repositories. |
| `dinnerdesigner/config.yaml` | HA add-on manifest: slug, version (bump to trigger a Supervisor update), ingress + direct-port (8099) access. No `options`/`schema`, no `map:` — the add-on's own persistent `/data` directory (where `server/index.js` stores synced state) is available to every HA add-on automatically without one. |
| `dinnerdesigner/Dockerfile` | Multi-stage add-on build: stage 1 clones this repo's `main` branch and runs `npm run build`; stage 2 serves `dist/` via nginx and also runs the small Node sync backend (`server/index.js`, via `start.sh`). See `DEPLOY.md`. |
| `dinnerdesigner/nginx.conf` | nginx config serving the built SPA on port 8099 for both Ingress and direct-port access (no ingress-proxy IP restriction, deliberately), plus a `location /api/` proxy to the local sync backend on `127.0.0.1:8100`. |
| `dinnerdesigner/server/index.js` | Dependency-free Node HTTP backend for cross-device sync: `GET`/`PUT /api/state` reading/writing a single JSON blob (`meals`, `plans`, `activePlanId`, `hasSeededMeals`, server-stamped `updatedAt`) atomically to `/data/state.json`. Listens on `127.0.0.1:8100` only, reachable exclusively via nginx's proxy. |
| `dinnerdesigner/server/package.json` | Pins `"type": "commonjs"` for `index.js` — without it, Node resolves module type by walking up to the nearest `package.json`, which (outside the container, e.g. local testing from within this repo checkout) would incorrectly hit the repo root's `"type": "module"`. |
| `dinnerdesigner/start.sh` | Container entrypoint: backgrounds `server/index.js`, then `exec`s nginx in the foreground as PID 1. |
| `.gitattributes` | Pins `dinnerdesigner/start.sh` to LF line endings regardless of a contributor's local Git config — CRLF would break its `#!/bin/sh` shebang inside the Linux container. |
| `DEPLOY.md` | Runbook for hosting the app as a Home Assistant add-on and for shipping updates to it (version bump + push + Update in HA). |

## Data model notes

- Planning has a **day-of-week dimension**: each `WeeklyPlan` has a `weekStartDate` (whatever date the
  user picks in Weekly Setup — not necessarily a Monday), and both a person's availability and a
  picked meal's placement are keyed by a **day index** (`0`=start day..`6`=start day+6) relative to
  that date, not an ISO date string. Day headers (`formatDayHeader`) derive the displayed weekday
  name from the actual calendar date, not the index, since the index no longer implies Monday-start.
  This is deliberate: `startNewWeek`'s
  "copy people from last week" spreads a `Person` verbatim into a new plan with a different
  `weekStartDate`, and an index-based weekly *pattern* carries over correctly as-is, whereas a
  date-based one would carry over the wrong calendar dates.
- `Person.availability` is `Partial<Record<MealType, boolean[]>>` — a 7-length boolean array per
  tracked meal type. A person's weekly serving target for a meal type
  (`getPersonMealTypeTarget`) is simply how many of those 7 days are `true`; there is no separate
  manually-typed target field. A meal type absent from `availability` (a brand-new person, or one
  migrated from before this feature existed) defaults to "available all 7 days"
  (`getPersonAvailability`'s fallback) rather than being stored explicitly.
- `PlannedMealEntry` represents one cooked batch. `totalServings` is a fixed snapshot of
  `Meal.servingsPerBatch` at pick-time; `assignments: MealAssignment[]` places shares of that fixed
  total onto specific `(personId, day, mealType)` cells. This is how "leftovers" are modeled — e.g. a
  lasagna batch of 8 gets dragged onto four different lunch/dinner cells across the week — without a
  lump-sum per-meal-type number.
- A cell can hold **up to `MAX_CELL_OCCUPANTS` assignments from different entries** — combining
  foods into one meal (e.g. lasagna + chips for dinner). `findCellAssignments` scans every entry's
  `assignments` and returns all current occupants of a cell. Each `MealAssignment.weight` (default
  `1`, adjustable `MIN_ASSIGNMENT_WEIGHT`–`MAX_ASSIGNMENT_WEIGHT`) is never a fraction by itself —
  `getAssignmentFraction` always *derives* the actual serving fraction as
  `weight / sum(weights of every assignment currently sharing that cell)`. A solo occupant always
  derives fraction `1` regardless of its own weight; weight only matters once 2+ items share a cell.
  This derivation is why removing or reweighting one occupant automatically rebalances everyone else
  sharing that cell — nothing stored needs to change, the fraction is recomputed from whoever remains.
  `getEntryConsumedServings` sums an entry's assignments' derived fractions; that sum must never
  exceed `totalServings`, and `assignMealToCell`/`setAssignmentWeight` both enforce this (rejecting,
  not clamping, an invalid drop or reweight). `getMealTypePicked` counts **distinct occupied cells**,
  not raw assignment rows, so a combined cell still counts as one pick regardless of how many items
  share it. `getShoppingList` sums each entry's ingredients exactly once regardless of how (or how
  many ways) its servings are placed, so leftovers and combined meals never double-count on the
  shopping list.
- `mealTypes` on a `PlannedMealEntry` is normally just the picked meal's library `mealTypes`, but
  `addPlannedMeal` widens it: if the plan tracks both lunch and dinner, a meal eligible for either
  one gets both added, so any lunch/dinner pick can be leftover-placed between the two regardless of
  which one it's tagged for in the library.
- `addPlannedMeal` always starts a new entry's `assignments` empty (`[]`) — every batch begins fully
  unplaced and is placed afterward by dragging its card onto `AssignmentGrid` cells.
- `removePlannedMeal` deletes an entry's assignments for free (they're nested inside it), but
  `removePerson` must explicitly strip that person's assignments from every other entry in the plan
  to avoid dangling `personId` references.
