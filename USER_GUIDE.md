# DinnerDesigner User Guide

DinnerDesigner helps you plan a week of meals against how many servings each person in your
household needs per meal type (breakfast/lunch/dinner), then turns your picks into a shopping list.
Everything is stored locally in your browser — there's no account and no server.

## Weekly Setup

- Start a new week by picking any start date and clicking **Start new week** — the week runs from
  that date through the following 6 days (it does not snap to the nearest Monday). You can
  optionally copy the people (and their serving targets) from your most recent plan.
- Choose which meal types (breakfast/lunch/dinner) you're planning for this week.
- Add each person eating that week (just a name — servings targets are set in the Day planner
  below).
- **Day planner**: for each person, mark them available or unavailable for each meal type you're
  tracking on each of the week's 7 days (starting from the date you picked above). A person's
  weekly serving target for a meal type is simply however
  many days they're marked available for it — defaults to all 7 days, so a new person or a newly
  tracked meal type starts at a target of 7 until you toggle days off (e.g. if they're eating out
  some nights).
- **Export data** downloads your full meal library and plan history as a JSON file. **Import data**
  loads a previously exported file, replacing everything currently in the app. Importing an export
  from an older version of the app is supported — old-format planned-meal entries are converted
  automatically.
- **Delete week**: with a week selected, click **Delete week** next to the picker to permanently
  remove it (people, meal picks, and assignments included) after a confirmation prompt. There's no
  undo, and no auto-selection of another week afterward — the picker just goes back to "Select a
  week..." until you pick or start one.

## Meal Library

Add, edit, filter, and delete meals. Each meal has a name, protein, one or more eligible meal types
(breakfast/lunch/dinner), a servings-per-batch count, an ingredient list, and an optional link back to
the original recipe. Deleting a meal from the library doesn't affect weeks that already used it — plans
keep their own snapshot of a meal at the time it was picked.

### Importing a recipe

Click **Import recipe** to add a meal without typing it in by hand:

1. Click **Copy chat prompt** to copy a ready-made prompt to your clipboard.
2. Paste that prompt into any Claude chat, followed by a recipe link (or the recipe's text pasted
   directly). Claude replies with a single JSON object describing the meal — name, meal types,
   protein, servings per batch, ingredients, a link back to the source recipe, and any brief notes.
3. Paste that JSON reply into the **Recipe JSON** box in the dialog and click **Parse**.
4. The meal library's add-meal form opens prefilled with the parsed values — review and adjust
   anything before clicking **Save meal**.

The app doesn't fetch recipe pages itself (it's client-only, with no server to do that fetching, and
most recipe sites block cross-origin requests from other web apps anyway) — the LLM chat step does the
extraction instead. Full step-by-step cooking instructions are expected to stay on the original recipe
page via its link rather than being retyped into the app's notes field.

## Plan Builder

For the active week, progress bars for every meal type you're tracking (breakfast/lunch/dinner) are
shown at once, so you can see servings picked vs. target across all of them without switching tabs.

**Choose meals** is a sidebar panel (scrolls independently, stays pinned alongside the rest of the
page) listing library meals you can add, filterable by two rows of toggle chips:
meal-type chips (scoped to the meal types this plan tracks) and protein chips. Select any combination
to narrow the list; clear a row with its **Clear** chip to show everything again. Each meal's row shows
which of the plan's meal types it's eligible for.

Clicking **+ Add** always cooks a new batch — even if that meal is already picked elsewhere in the
plan — so ingredient quantities on the shopping list never get merged into an existing batch. A newly
added meal starts with **zero servings placed**; drag its card onto the **Assignment grid** below
(see Leftovers below) to place servings before it counts toward any progress bar.

All picked meals appear together in a single **Picked meals** list — there's no more per-meal-type
panel to switch between. Each card shows an "X/Y placed" badge (turning green once every serving is
placed) and stays in the list — with `0`/Y shown — until you click **Remove** to delete the entry
entirely. Once any of a meal's servings are shared with another meal in a combined slot (see
**Combining meals in one slot** below), the "X" can be a fractional number like `2.5`.

### Marking a picked meal as leftover from a previous week

If a batch was actually cooked *last* week and some of it is still in the fridge/freezer, check
**Leftover from last week** on that meal's card in the **Picked meals** list. A **Servings left**
field appears — set it to however many servings of the batch remain (e.g. `3` of a `6`-serving
batch); the "X/Y placed" badge immediately reflects that starting point (e.g. `3/6 placed`) even
before you've dragged the card onto the Assignment grid, and only the remaining servings can be
placed this week. Unchecking the box resets the entry back to a fresh, fully-available batch. This
is unrelated to the **Leftovers** placement feature below, which is about spreading *this* week's
freshly-cooked batch across multiple days/meal types — the two can be combined (a leftover entry
with 3 servings left can still be split across up to 3 different cells).

### Leftovers: placing one batch across days and meal types

Some meals — a lasagna, for example — are cooked once but eaten as leftovers across more than one
day or meal type over the week (lunch *and* dinner), while others — a risotto — are only ever eaten
once. DinnerDesigner handles this with the **Assignment grid**, a Meal-type × Day grid (one sub-grid
per person) below the picked-meals list:

- Drag a picked-meal card from the **Picked meals** list onto a person's cell for a specific day and
  meal type to place one of that batch's servings there. Repeat — dragging the same card onto
  different cells — to place the rest of the batch, e.g. a lasagna batch of 8 servings placed onto
  four different lunch/dinner cells across the week. Each meal type's progress bar reflects only the
  servings actually placed for that type. Dragging works with touch as well as a mouse — press and
  hold a card briefly before moving it, so a quick swipe still scrolls the page normally.
- **Lunch/dinner is always placeable either way.** If your plan tracks both lunch and dinner, any
  meal you pick that's eligible for lunch *or* dinner can be dragged onto cells of either type — even
  if it's tagged for only one of them in the library. A dinner-only meal can still be placed onto a
  lunch cell as leftovers; you don't need to re-tag it in the library first.
- A cell only accepts a drop if that person is marked **available** for that day/meal type in the
  Weekly Setup screen's Day planner — unavailable cells are shown disabled and reject the drop.
- The placement only affects which weekly progress bar the servings count toward. The shopping list
  still counts that batch's ingredients exactly once — cooking one lasagna never doubles the grocery
  list just because it's eaten twice.
- You don't have to place the full batch right away; unplaced servings simply don't count toward any
  progress bar yet (e.g. if part of a batch is being frozen for later), and the entry itself always
  stays visible in the picked list regardless of how much of the batch is placed.

### Combining meals in one slot

Sometimes a meal is smaller than a full serving on its own — lasagna paired with chips, say — and
each only ends up using part of its batch for that meal. Drag a second (or third, or fourth) picked
meal card onto a cell that's **already holding a meal** to combine them there:

- Every item sharing a cell defaults to an even split of that cell — two items are 50/50 each, three
  are a third each, four are a quarter each — shown as a percentage next to each item's name.
- A cell holds **up to 4 combined items**; dropping a 5th is rejected.
- Each item's share is adjustable with the small **−/+** buttons next to it. Raising one item's share
  shrinks everyone else's in that same cell to compensate — a change is only allowed if it doesn't
  push any of the combined items' batches over their own total servings.
- Click any item's **×** to remove just that one from the cell — the remaining items automatically
  rebalance to split the cell evenly again (e.g. a 3-way even split becomes 50/50 once one item is
  removed), with no need to manually readjust the others.
- Combining only changes how much of *that item's own batch* a slot consumes — it does not change the
  shopping list, which still counts each batch's ingredients exactly once regardless of how many
  slots (or how much of each slot) it's spread across.

## Shopping List

Once meals are picked, the Shopping List screen aggregates every planned batch's ingredients (same
name + unit combined into one line) into a checkable list.

## History

The History tab looks across every week you've ever planned (no active week required):

- **Weekly log** lists every past week, most recent first, with the distinct meals picked that week.
- **What haven't we had in a while?** ranks every meal you've ever picked by how long it's been
  since it was last served (longest-ago first), plus how many distinct weeks it's appeared in.
  "Served" here means week-level — it tracks which week a meal was picked into, not which exact day.

If you haven't started any weekly plans yet, this tab just shows a short empty-state message.

## Known Limitations

- The Day planner and Assignment grid toggle/place one cell at a time — there's no bulk action to
  mark a whole row or column available/unavailable, or to place a batch across several cells at
  once.
