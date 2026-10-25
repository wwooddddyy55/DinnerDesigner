# DinnerDesigner User Guide

DinnerDesigner helps you plan a week of meals against how many servings each person in your
household needs per meal type (breakfast/lunch/dinner), then turns your picks into a shopping list.
There's no account. Data is always cached locally in your browser; if you're using the app through
the Home Assistant add-on, it also syncs across every device pointed at that add-on (see
**Cross-device sync** below). Running the app any other way (e.g. `npm run dev`), there's no server at
all and everything stays local to that one browser, exactly as before.

## Getting around

- The top bar switches between the five screens. **Plan Builder** and **Shopping List** stay
  disabled until a week exists; a line under the bar says so. On a phone the five screens get a
  row of their own under the app name, with short labels (**Setup**, **Meals**, **Plan**, **Shop**,
  **History**), so they all fit without scrolling.
- The **Theme** button at the right end of the top bar cycles **auto** (follow your device's
  light/dark setting), **light**, and **dark**. Home Assistant's own dark theme doesn't reach the
  add-on's panel, so pick **dark** here if you use a dark dashboard. The choice is remembered per
  browser.
- Every dialog closes with **Escape**, and keyboard focus stays inside it while it's open.
- **Undo:** removing a picked meal or a person, taking a meal off a slot with **×**, deleting a
  week, and importing data each show an **Undo** bar at the bottom of the screen for about 8
  seconds. Only the most recent action can be undone, and only in the tab where you did it.

### On a phone

- Dialogs (adding or editing a meal, importing a recipe) fill the screen, with the title and the
  **Save**/**Cancel** buttons pinned so they stay reachable while the keyboard is open. **×** in the
  title row closes without saving.
- Long screens keep their key controls pinned while you scroll: the Plan Builder's tabs and
  progress, the Meal Library's search box, and the Shopping List's progress and buttons.
- **Add to Home Screen** (from your phone browser's share or menu button) gives DinnerDesigner its
  own icon and opens it full screen. Add the add-on's direct `:8099` address rather than the Home
  Assistant sidebar panel's page: the panel's address changes, so a shortcut to it stops working.
  In the Home Assistant Companion app, just use the sidebar panel.

## Cross-device sync

When you access DinnerDesigner through the Home Assistant add-on (either the sidebar panel or the
direct `:8099` URL), the add-on keeps one shared copy of your meal library and plans and every device
that opens the app syncs with it:

- Opening the app pulls the latest shared data down to that device.
- Any change you make (adding a meal, picking meals for the week, dragging onto the Assignment grid,
  etc.) is pushed up automatically a moment later — and immediately if you switch away from or close
  the tab, so a last-second edit isn't lost.
- Other devices pick up those changes when you switch back to their tab or window, reopen the app, or
  within about 30 seconds while the app is open and visible.
- **Edits on two devices at once are merged, not overwritten.** If another device saved changes
  since this one last synced, the two sets of changes are combined per meal and per week: a meal or
  week changed on only one device keeps that device's version (including deletions), and one changed
  on both keeps whichever was edited most recently. A meal or week deleted on one device but edited
  on the other is kept.
- **Which week you're viewing stays per device.** Switching weeks on one device doesn't move
  anyone else's view; if the week you're on is deleted elsewhere, this device falls back to another
  week (or to Weekly Setup if none are left).
- If the add-on is unreachable (or rejects a save), the app keeps working from that browser's own
  local copy and keeps retrying. Unsaved changes are remembered even if you close the tab or reload,
  and are merged in once the add-on is reachable again.
- A small status label at the right end of the top bar shows **Synced**, **Saving…**, **Sync error —
  retrying**, or **Offline** (tap or hover it for a one-line explanation). It's hidden when the app has no add-on to sync
  with.
- The very first time sync turns on, whichever device already had data becomes the shared starting
  point for every other device.
- There's no login on the sync data itself — anyone who can reach the add-on's direct `:8099` port on
  your network can see, edit, or even erase it (the sidebar panel goes through your Home Assistant
  login). If you don't need the direct port, turn it off: in Home Assistant open the add-on's
  **Configuration** tab and clear the port under **Network**, then restart the add-on; the sidebar
  panel keeps working.
- **Backups:** the add-on keeps a rolling set of the last 50 snapshots of the shared data (at most
  one per minute) in its `/data/backups` folder. If the shared data is ever lost or wrongly
  overwritten, stop the add-on, copy the snapshot you want over `state.json` in the add-on's data
  directory, and start it again. That directory is only reachable from the Home Assistant host
  itself (under `/mnt/data/supervisor/addons/data/`, e.g. via an SSH add-on with host access), so
  regular **Export data** files remain the easiest backup to restore from. If `state.json` itself
  becomes unreadable, the add-on moves it aside and starts from the newest readable snapshot
  automatically.

This only applies when the app is hosted via the Home Assistant add-on. Running it any other way (for
example, local development) has no backend to sync with and behaves exactly as it always has.

## Weekly Setup

- Start a new week by picking any start date and clicking **Start new week** — the week runs from
  that date through the following 6 days (it does not snap to the nearest Monday); the full date
  range is shown under the picker, along with a note if you already have a week starting that day.
  The date defaults to the day after your most recent week ends (or today, for your first week).
- **Copying from your most recent week** (on by default): copies the people, their Day planner
  availability, and the meal types you tracked. Two optional extras underneath:
  - **Also copy its picked meals** adds the same meals again as freshly cooked batches (nothing
    marked as cooked last week), unplaced.
  - **…and where they were placed on the grid** also keeps each batch's placements, on the same
    days of the week, for the copied people.
- Each part of the screen below the week picker (**Start a new week**, **Meal types this week**,
  **People**, **Day planner**, **Servings targets**, **Data**) is a section you can fold away by
  tapping its heading; the heading stays at the top of the screen while you scroll through it.
  Once a week is selected, **Start a new week** and **Data** start folded, since they're needed less
  often.
- Once a week is selected, a checklist strip shows what's done: **Week started**, **Meal types
  chosen**, **People added**, **Meals picked**. An unfinished step is a link to where it's done
  (opening that section if it's folded). With meal types and people set, **Next: pick meals →**
  (and the checklist's **Meals picked** step) takes you to the Plan Builder.
- Choose which meal types (breakfast/lunch/dinner) you're planning for this week.
- Add each person eating that week (just a name — servings targets are set in the Day planner
  below). A new person's name field is selected straight away, so you can type over "Person 2".
- **Day planner**: for each person, mark them available or unavailable for each meal type you're
  tracking on each of the week's 7 days (starting from the date you picked above). A person's
  weekly serving target for a meal type is simply however
  many days they're marked available for it — defaults to all 7 days, so a new person or a newly
  tracked meal type starts at a target of 7 until you toggle days off (e.g. if they're eating out
  some nights). On a phone the whole week fits across the screen (short meal-type labels, the day
  and date stacked in each column header).
- **Export data** downloads your full meal library and plan history as a JSON file. **Import data**
  loads a previously exported file, replacing everything currently in the app — after a confirmation
  that shows how many meals and weeks you have now and how many the file contains, and with
  **Undo** available right afterwards (until anything is changed after the import — undoing then
  would erase that change too, so the Undo bar disappears). Importing an export
  from an older version of the app is supported — old-format planned-meal entries are converted
  automatically. Damaged or hand-edited files are repaired where possible (records too broken to use
  are skipped, invalid fields reset to defaults) rather than breaking the app; a file exported from a
  *newer* version of the app is refused.
- **Delete week**: with a week selected, click **Delete week** next to the picker to permanently
  remove it (people, meal picks, and assignments included) after a confirmation prompt. **Undo**
  brings it back. Another week isn't auto-selected afterward — the picker just goes back to "Select
  a week..." until you pick or start one.

## Meal Library

Add, edit, search, sort, filter, and delete meals. The search box matches meal names and ingredients
(every word you type has to match somewhere, so "chicken rice" finds a chicken dish with rice). Sort
by **Name**, **Haven't had in a while** (never-picked meals first, then the longest since they were
last picked), **Most often picked**, or **Recently added**. A count shows how many meals the filters
leave, and each card shows when that meal was last picked into a week. If nothing matches, **Clear
filters** resets the search and filters; an empty library offers **+ Add meal** and **Import recipe**.

In the add/edit form, pressing **Enter** (the keyboard's **Next** key on a phone) in an ingredient
moves from the name to the quantity to the unit, then on to the next ingredient — adding a new row
after the last one — instead of saving the meal half-typed. Number fields can be cleared and
retyped without snapping back to 0.

Each meal has a name, protein, one or more eligible meal types
(breakfast/lunch/dinner), a servings-per-batch count, an ingredient list, and an optional link back to
the original recipe. The recipe link must be a web address (`http://` or `https://`; a bare
`example.com/recipe` is treated as `https://`) — anything else is rejected when saving, and silently
dropped when importing. Deleting a meal from the library doesn't affect weeks that already used it — plans
keep their own snapshot of a meal at the time it was picked.

### Importing a recipe

Click **Import recipe** to add a meal without typing it in by hand:

1. Click **Copy chat prompt** to copy a ready-made prompt to your clipboard. If the browser won't allow
   an automatic copy (common when reaching the Home Assistant add-on over plain HTTP), a text box
   appears with the prompt pre-selected so you can copy it manually (Ctrl/Cmd+C).
2. Paste that prompt into any Claude chat, followed by a recipe link (or the recipe's text pasted
   directly). Claude replies with a single JSON object describing the meal — name, meal types,
   protein, servings per batch, ingredients, a link back to the source recipe, and any brief notes.
   Give it several recipes at once and it replies with a JSON list instead.
3. Paste that JSON reply into the **Recipe JSON** box in the dialog and click **Parse**.
4. For one meal, the meal library's add-meal form opens prefilled with the parsed values — review
   and adjust anything before clicking **Save meal**. For several, the dialog lists them with a
   checkbox each; untick any you don't want and click **Add N meals** to add them straight to the
   library (edit any of them afterwards). If one meal in a list is malformed, the error says which
   one (e.g. "Meal 2: …").

The app doesn't fetch recipe pages itself (it's client-only, with no server to do that fetching, and
most recipe sites block cross-origin requests from other web apps anyway) — the LLM chat step does the
extraction instead. Full step-by-step cooking instructions are expected to stay on the original recipe
page via its link rather than being retyped into the app's notes field.

## Plan Builder

For the active week, progress bars for every meal type you're tracking (breakfast/lunch/dinner) are
shown at once, so you can see servings picked vs. target across all of them without switching tabs.
Under each bar, **Still empty:** lists the first few available slots with nothing placed yet (with
the person's name when more than one person is eating).

**On a narrow (mobile) screen** — or a phone turned sideways — the page becomes two tabs instead of
one long scrolling page: **Pick meals** (the picker and picked-meals list below) and **Assign** (the
Assignment grid, shown as one day at a time — see **Placing meals on mobile** below). The **Assign**
tab shows how many picked meals still have servings to place. On **Pick meals**, the meal library
is shown while you're choosing; for a week that already has picks, the picked meals come first and
**+ Add more meals** opens the library (**Done adding** puts the picked meals first again). The
library's filter chips sit behind a **Filters** button there, which shows how many are on. On a
wider screen there's a
sidebar picker alongside the picked-meals list and full Assignment grid; in a medium-width window
(under about 960px, e.g. Home Assistant's panel next to its sidebar) the picker sits above the rest
instead of beside it.

**Choose meals** is a sidebar panel (scrolls independently, stays pinned alongside the rest of the
page) listing library meals you can add. It has the same search box and sort options as the Meal
Library (sorted **Haven't had in a while** by default, so meals you haven't eaten recently come
first), plus two rows of toggle chips: meal-type chips (scoped to the meal types this plan tracks)
and protein chips. Select any combination to narrow the list; clear a row with its **Clear** chip to
show everything again. Each meal's row shows which of the plan's meal types it's eligible for and
when it was last picked (counting earlier weeks only).

Clicking **+ Add** always cooks a new batch — even if that meal is already picked elsewhere in the
plan — so ingredient quantities on the shopping list never get merged into an existing batch. A newly
added meal starts with **zero servings placed**; drag its card onto the **Assignment grid** below
(see Leftovers below) to place servings before it counts toward any progress bar.

All picked meals appear together in a single **Picked meals** list — there's no more per-meal-type
panel to switch between. Each card shows an "X/Y placed" badge (turning green once every serving is
placed, and marked **— needs placing** while none of it is placed yet) and stays in the list — with
`0`/Y shown — until you click **Remove** to delete the entry entirely (**Undo** puts it back, placements
included). Once any of a meal's servings are shared with another meal in a combined slot (see
**Combining meals in one slot** below), the "X" can be a fractional number like `2.5`.

### Marking a picked meal as leftover from a previous week

If a batch was actually cooked *last* week and some of it is still in the fridge/freezer, check
**Already cooked last week (carry-over)** on that meal's card in the **Picked meals** list (on a
phone, tap **Options…** on the card first). A **Servings left**
field appears — set it to however many servings of the batch remain (e.g. `3` of a `6`-serving
batch); the "X/Y placed" badge immediately reflects that starting point (e.g. `3/6 placed`) even
before you've dragged the card onto the Assignment grid, and only the remaining servings can be
placed this week. Unchecking the box resets the entry back to a fresh, fully-available batch. A
carry-over batch's ingredients are left off this week's shopping list (they were bought last week);
see **Shopping List**. This
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
- **Click instead of drag:** click **Place** on a card (it changes to **Choosing cell…**), then click
  highlighted **+ Place here** cells. The meal stays selected while its batch has servings left, so
  you can place serving after serving; click **Choosing cell…** again to stop. Only cells the batch
  still has room for are highlighted. This also works
  entirely from the keyboard: Tab to **Place**, press Enter, Tab to a highlighted cell, press Enter.
  The drag handle is keyboard-draggable too (focus it, press Space, move with the arrow keys, press
  Space to drop). A **How placing works** summary sits above the grid.
- **Lunch/dinner is always placeable either way.** If your plan tracks both lunch and dinner, any
  meal you pick that's eligible for lunch *or* dinner (including ones picked before you started
  tracking both) can be dragged onto cells of either type — even
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

### Placing meals on mobile

Precise drag-and-drop is hard on a touchscreen, so on a narrow screen you place meals by tapping
instead (there's no drag handle on the cards there):

1. Tap a picked meal — its card (or **Place**) on the **Pick meals** tab, or its chip at the top of
   the **Assign** tab, which lists every meal with servings left ("Lasagna 6 left"). You're switched
   to the Assign tab, and a bar at the top shows **Placing Lasagna · 2/8 placed**.
2. Pick a day from the day switcher. Each day shows how many slots are still empty — or, while a
   meal is selected, how many slots it could still go into ("3 can take it"); days nobody is eating
   are faded. It opens on today when you're looking at the current week, and **Next day with room
   →** jumps ahead to the next day that still has space.
3. Tap highlighted slots to place servings. The meal **stays selected** after each tap, so placing a
   whole batch is just a tap per slot; it's deselected once every serving is placed, or when you tap
   **Done** (or the meal again). On phones that support it, a successful tap gives a short buzz; a
   tap that can't be placed gives a double buzz and leaves the meal selected.

The pinned bar at the top of the Assign tab also has a one-line progress summary for every meal type
(e.g. **Lunch 5/14 · Dinner 9/14**); tap it to show the full progress bars with their **Still empty**
lists. On a wider screen, dragging a card onto the full-week grid works exactly as described above in
**Leftovers**.

### Combining meals in one slot

Sometimes a meal is smaller than a full serving on its own — lasagna paired with chips, say — and
each only ends up using part of its batch for that meal. Drag a second (or third, or fourth) picked
meal card onto a cell that's **already holding a meal** to combine them there:

- Every item sharing a cell defaults to an even split of that cell — two items are 50/50 each, three
  are a third each, four are a quarter each — shown as a percentage next to each item's name.
- A cell holds **up to 4 combined items**; dropping a 5th is rejected.
- Each item's share is adjustable with the small **−/+** buttons next to it (on a phone, tap the
  item's **%** to show them). Raising one item's share
  shrinks everyone else's in that same cell to compensate — a change is only allowed if it doesn't
  push any of the combined items' batches over their own total servings.
- Click any item's **×** to remove just that one from the cell — the remaining items automatically
  rebalance to split the cell evenly again (e.g. a 3-way even split becomes 50/50 once one item is
  removed), with no need to manually readjust the others.
- Because the remaining items' shares grow, removing an item (or removing a whole picked meal, or a
  person) can leave another item's batch with more servings placed than it makes. Removing is never
  blocked; instead that meal's "X/Y placed" badge turns red with **— over batch size**. Fix it by
  removing one of its placements, or with the −/+ buttons (changes that reduce the overage are
  allowed even while it's still over).
- With a meal selected for placing (see **Click instead of drag**), a slot that already holds
  something shows a separate **+ Place … too** button for combining, so tapping its **×** or **−/+**
  never adds the selected meal by mistake.
- Combining only changes how much of *that item's own batch* a slot consumes — it does not change the
  shopping list, which still counts each batch's ingredients exactly once regardless of how many
  slots (or how much of each slot) it's spread across.

## Shopping List

Once meals are picked, the Shopping List screen aggregates every planned batch's ingredients into a
checkable list:

- Lines with the same ingredient name are combined when their units match — or when the units
  convert into each other: **g/kg**, **ml/l**, and **tsp/tbsp/cup** (shown in a readable unit, e.g.
  500 g + 0.75 kg → 1.25 kg). Metric and spoon/cup measures are never mixed, and other units (each,
  cans, cloves…) only combine with the exact same unit.
- Under each item, **for …** names the meals it's needed for.
- Batches marked **Already cooked last week** are left off, with a note naming them; tick **Include
  their ingredients anyway** to add them back.
- The header shows how many items you've ticked (with a progress bar); **Hide ticked** hides the ones
  you've already got. The header stays pinned at the top while you scroll the list, and rows are
  sized for one-handed ticking on a phone.
- While the list is open, the app asks your phone to keep the screen from dimming or locking, so it
  stays usable in the shop. Browsers only allow this on a secure (`https://`) page, so it works when
  you reach Home Assistant over HTTPS (e.g. through Home Assistant Cloud or your own certificate) but
  not on a plain-HTTP address such as the `:8099` port; where it isn't allowed, the screen just dims
  as usual.
- **Copy list as text** copies the items you haven't ticked (or the whole list, if everything is
  ticked) as plain "Name — quantity unit" lines, ready to paste into a notes app, a message, or Home
  Assistant's shopping list. If the browser blocks automatic copying, a text box appears for copying
  by hand.
- Ticks are kept only while you stay on this screen.

## History

The History tab looks across every week you've ever planned (no active week required):

- **Weekly log** lists every past week, most recent first, with the distinct meals picked that week.
- **What haven't we had in a while?** ranks every meal you've ever picked by how long it's been
  since it was last served (longest-ago first), plus how many distinct weeks it's appeared in.
  "Served" here means week-level — it tracks which week a meal was picked into, not which exact day.
  On a phone each meal is shown as its own row (name, then last served and times served) instead of
  a table.

If you haven't started any weekly plans yet, this tab just shows a short empty-state message.

## Known Limitations

- Sync merges whole meals and whole weeks: if the *same* meal or the *same* week is edited on two
  devices before either syncs, the most recently edited version of that meal/week wins and the other
  device's changes to it are dropped (changes to *different* meals/weeks are always kept).

- The Day planner and Assignment grid toggle/place one cell at a time — there's no bulk action to
  mark a whole row or column available/unavailable, or to place a batch across several cells at
  once.
