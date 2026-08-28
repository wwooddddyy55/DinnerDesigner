# DinnerDesigner

A weekly meal-planning app. Pick which meal types you're planning
(breakfast/lunch/dinner), set how many servings each person needs per meal
type, then fill each meal type with meals from your library until you hit
the servings target. Each meal carries an ingredient list, and once you've
picked your meals for the week, DinnerDesigner combines them into a
shopping list.

## Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL in your browser. All data (meals, weekly
plans) is stored locally in your browser via `localStorage` — nothing is
sent to a server.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` — type-check and build for production
- `npm run preview` — preview the production build locally
- `npm run typecheck` — run TypeScript with no emit
- `npm run lint` — run oxlint
- `npm test` — run the Vitest unit tests (servings targets, shopping list aggregation)

## How it works

1. **Weekly Setup** — start a new week, select the meal types you're
   planning, add the people eating, and set how many servings of each meal
   type they'll eat that week (defaults to 7, lower it to account for
   eating out). This produces a servings target per meal type.
2. **Meal Library** — your reusable collection of meals: a name, which meal
   type(s) it fits, a protein tag, how many servings one batch makes (e.g.
   Lasagna = 8), and an ingredient list. A handful of starter meals are
   seeded in on first run — add, edit, or delete freely from here.
3. **Plan Builder** — for each selected meal type, filter the library by
   protein and add meals until the picked-servings total meets (or
   exceeds) that meal type's target. The same meal can be added more than
   once.
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
- People and their servings targets are stored **per week**, not as a
  global roster, since who's eating and how much varies week to week.
  Starting a new week offers a "copy people from last week" shortcut.

## Roadmap ideas

This is v1 — meant to be built out further:

- More templates / a richer meal library
- Home Assistant integration (e.g. a dashboard card for this week's meals
  or shopping list, reading the exported JSON, or a small local backend
  down the line for live sync)
- Marking shopping list items as purchased persistently (currently
  per-session only)
