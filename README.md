# DinnerDesigner

A weekly meal-planning app. Pick which meal types you're planning
(breakfast/lunch/dinner), mark which days each person is eating each meal
type, then pick meals from your library and place their servings onto
people's days until you hit the servings target. Each meal carries an
ingredient list, and once you've picked your meals for the week,
DinnerDesigner combines them into a shopping list.

For full usage details see [USER_GUIDE.md](USER_GUIDE.md); for hosting it as
a Home Assistant add-on (with cross-device sync) see [DEPLOY.md](DEPLOY.md);
for a map of the codebase see [PROJECT_MAP.md](PROJECT_MAP.md).

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser. Run this way, all data
(meals, weekly plans) is stored locally in your browser via `localStorage` —
nothing is sent to a server. When hosted as the Home Assistant add-on (see
[DEPLOY.md](DEPLOY.md)), the add-on's small backend also keeps a shared copy
so every device pointed at it stays in sync.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run TypeScript with no emit
- `npm run lint` — run oxlint
- `npm test` — run the Vitest unit tests (calculations, history, recipe import, store)

## How it works

1. **Weekly Setup** — start a new week from any start date, select the
   meal types you're planning, add the people eating, and use the Day
   planner to mark which of the week's 7 days each person is eating each
   meal type (defaults to every day; untick days they're eating out). Each
   person's target for a meal type is the number of days they're marked
   available.
2. **Meal Library** — your reusable collection of meals: a name, which meal
   type(s) it fits, a protein tag, how many servings one batch makes (e.g.
   Lasagna = 8), and an ingredient list. A handful of starter meals are
   seeded in on first run — add, edit, or delete freely from here.
3. **Plan Builder** — filter the library by meal type and protein and add
   meals (each add is one cooked batch; the same meal can be added more
   than once). Then place each batch's servings onto people's day/meal
   cells — drag-and-drop on desktop, tap-to-place on mobile. Progress bars
   count only *placed* servings, so one batch can be spread across several
   days as leftovers, and up to 4 items can share one cell.
4. **Shopping List** — ingredients from every meal picked for the week are
   combined automatically (matching by ingredient name + unit), so you get
   one list to shop from.

Your data can be exported to / imported from a JSON file from the Weekly
Setup screen — handy for backups, moving to another browser, or (down the
line) feeding a Home Assistant dashboard from the exported file.

## Data model notes

- A meal picked into a week is **snapshotted** at pick time. Editing or
  deleting a meal in the library later won't change a week's plan or
  shopping list that already used it.
- People and their day-by-day availability are stored **per week**, not as
  a global roster, since who's eating and when varies week to week.
  Starting a new week offers a "copy people from last week" shortcut.

## Roadmap ideas

This is v1 — meant to be built out further:

- More templates / a richer meal library
- Deeper Home Assistant integration (e.g. a dashboard card for this week's
  meals or shopping list, read from the add-on's sync backend)
- Marking shopping list items as purchased persistently (currently
  per-session only)
