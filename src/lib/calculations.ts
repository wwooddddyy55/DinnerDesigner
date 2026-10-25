import { fromBaseUnit, toBaseUnit } from './units'
import type { UnitFamily } from './units'
import { DAYS_PER_WEEK, MAX_CELL_OCCUPANTS, stapleKey } from '../types'
import type { MealAssignment, MealType, PlannedMealEntry, Person, Staple, WeeklyPlan } from '../types'

export const CAPACITY_EPSILON = 1e-9

/** A person's availability pattern for a meal type: a 7-length boolean array
 * (index 0=weekStartDate..6=weekStartDate+6). Falls back to "available every day" when the person
 * has no stored data for this meal type. */
export function getPersonAvailability(person: Person, mealType: MealType): boolean[] {
  return person.availability[mealType] ?? Array(DAYS_PER_WEEK).fill(true)
}

export function isCellAvailable(person: Person, mealType: MealType, day: number): boolean {
  return getPersonAvailability(person, mealType)[day] ?? true
}

/** A person's weekly target for a meal type = how many days they're marked available. */
export function getPersonMealTypeTarget(person: Person, mealType: MealType): number {
  return getPersonAvailability(person, mealType).filter(Boolean).length
}

export function getMealTypeTarget(plan: WeeklyPlan, mealType: MealType): number {
  return plan.people.reduce((sum, person) => sum + getPersonMealTypeTarget(person, mealType), 0)
}

/** Counts distinct occupied (person, day) cells for a meal type — not raw
 * assignment rows, since a combined cell can hold multiple assignments (from
 * different entries) that together still represent just one meal slot. */
export function getMealTypePicked(plan: WeeklyPlan, mealType: MealType): number {
  const cells = new Set<string>()
  for (const entry of plan.plannedMeals) {
    for (const assignment of entry.assignments) {
      if (assignment.mealType === mealType) {
        cells.add(`${assignment.personId}|${assignment.day}`)
      }
    }
  }
  return cells.size
}

/** Every (person, day) slot for a meal type where the person is available
 * but nothing has been placed yet, in day then people order — what's still
 * left to fill for that meal type's progress bar. */
export function getOpenCells(plan: WeeklyPlan, mealType: MealType): { person: Person; day: number }[] {
  const open: { person: Person; day: number }[] = []
  for (let day = 0; day < DAYS_PER_WEEK; day++) {
    for (const person of plan.people) {
      if (!isCellAvailable(person, mealType, day)) continue
      if (findCellAssignments(plan, person.id, day, mealType).length === 0) open.push({ person, day })
    }
  }
  return open
}

type CellOccupant = { entry: PlannedMealEntry; assignment: MealAssignment }

function cellKey(personId: string, day: number, mealType: MealType): string {
  return `${personId}|${day}|${mealType}`
}

// Plans are immutable (every store action produces a new plan object), so an
// index keyed by plan identity is never stale and is rebuilt only when the
// plan actually changes — turning the per-cell full-plan scan below into a
// map lookup without changing any caller.
const cellIndexCache = new WeakMap<WeeklyPlan, Map<string, CellOccupant[]>>()

function getCellIndex(plan: WeeklyPlan): Map<string, CellOccupant[]> {
  let index = cellIndexCache.get(plan)
  if (!index) {
    index = new Map()
    for (const entry of plan.plannedMeals) {
      for (const assignment of entry.assignments) {
        const key = cellKey(assignment.personId, assignment.day, assignment.mealType)
        const list = index.get(key)
        if (list) list.push({ entry, assignment })
        else index.set(key, [{ entry, assignment }])
      }
    }
    cellIndexCache.set(plan, index)
  }
  return index
}

/** All occupants of a given (person, day, mealType) cell, across every
 * entry's assignments — a cell may hold up to MAX_CELL_OCCUPANTS occupants
 * from different entries when meals are combined; see `assignMealToCell`.
 * Returns a fresh array (callers may mutate it). */
export function findCellAssignments(
  plan: WeeklyPlan,
  personId: string,
  day: number,
  mealType: MealType,
): CellOccupant[] {
  return [...(getCellIndex(plan).get(cellKey(personId, day, mealType)) ?? [])]
}

/** Finds the (entry, assignment) pair for a globally-unique assignment id,
 * scanning every entry — used where only the id is known (e.g. reweighting)
 * and the cell/co-occupants must be derived from it. */
function findAssignmentById(
  plan: WeeklyPlan,
  assignmentId: string,
): { entry: PlannedMealEntry; assignment: MealAssignment } | undefined {
  for (const entry of plan.plannedMeals) {
    const assignment = entry.assignments.find((a) => a.id === assignmentId)
    if (assignment) return { entry, assignment }
  }
  return undefined
}

/** The fraction of a batch's serving one assignment consumes, derived from
 * its weight relative to every assignment (itself included) sharing its
 * cell. Never stored — recomputed from current co-occupants so removing or
 * reweighting a sibling automatically rebalances everyone else. */
export function getAssignmentFraction(assignment: MealAssignment, cellOccupants: MealAssignment[]): number {
  const totalWeight = cellOccupants.reduce((sum, a) => sum + a.weight, 0)
  return totalWeight > 0 ? assignment.weight / totalWeight : 0
}

/** Sum of an entry's assignments' derived fractions across every cell they
 * occupy, plus its `leftoverServingsUsed` baseline (servings already eaten in
 * a prior week, for an entry marked `isLeftover`) — the value that must never
 * exceed `entry.totalServings` (the capacity invariant), and what the
 * "placed/totalServings" badge shows. */
export function getEntryConsumedServings(plan: WeeklyPlan, entry: PlannedMealEntry): number {
  const baseline = entry.leftoverServingsUsed ?? 0
  return entry.assignments.reduce((sum, assignment) => {
    const occupants = findCellAssignments(plan, assignment.personId, assignment.day, assignment.mealType).map(
      (o) => o.assignment,
    )
    return sum + getAssignmentFraction(assignment, occupants)
  }, baseline)
}

export function isEntryFullyPlaced(plan: WeeklyPlan, entry: PlannedMealEntry): boolean {
  return getEntryConsumedServings(plan, entry) >= entry.totalServings - CAPACITY_EPSILON
}

/** Whether an entry's placed servings exceed its batch. Adding or reweighting
 * an assignment can never cause this (the store rejects it), but *removing*
 * one can: taking an item out of a shared cell grows every remaining
 * co-occupant's share of that cell, which may push a near-capacity
 * co-occupant over. Removals are deliberately never blocked (a user must
 * always be able to take something off the plan), so the UI flags this state
 * instead and the +/- stepper stays usable to fix it. */
export function isEntryOverCapacity(plan: WeeklyPlan, entry: PlannedMealEntry): boolean {
  return getEntryConsumedServings(plan, entry) > entry.totalServings + CAPACITY_EPSILON
}

/** Formats a number with at most 2 decimals and no trailing zeros (e.g. 2.5,
 * 2, 0.33), using the device's decimal separator ("2,5" in much of Europe).
 * `locale` is injectable for tests. */
export function formatQuantity(n: number, locale?: string): string {
  return n.toLocaleString(locale, { maximumFractionDigits: 2, useGrouping: false })
}

/** A fractional serving count for the "placed" badge — see `formatQuantity`. */
export function formatServingCount(n: number, locale?: string): string {
  return formatQuantity(n, locale)
}

/** Whether changing one assignment's weight to `proposedWeight` would push
 * its own or any cell co-occupant's *entry* over that entry's totalServings
 * (or, for an entry already over capacity after a removal — see
 * `isEntryOverCapacity` — further over than it already is)
 * (raising one occupant's weight shrinks everyone else's derived share
 * within that cell only, but that can still tip a near-capacity co-occupant
 * entry over the edge). Checks every distinct entry sharing the cell, not
 * just the one being changed, since decreasing a weight grows siblings'
 * shares too. Used by the store to gate `setAssignmentWeight`, and by the UI
 * to pre-disable the +/- stepper before an invalid change is attempted. */
export function canSetAssignmentWeight(plan: WeeklyPlan, assignmentId: string, proposedWeight: number): boolean {
  const found = findAssignmentById(plan, assignmentId)
  if (!found) return false
  const { assignment: target } = found
  const occupants = findCellAssignments(plan, target.personId, target.day, target.mealType)
  const hypotheticalWeights = new Map(occupants.map((o) => [o.assignment.id, o.assignment.weight]))
  hypotheticalWeights.set(target.id, proposedWeight)

  const affectedEntries = new Map(occupants.map((o) => [o.entry.id, o.entry]))
  for (const entry of affectedEntries.values()) {
    const currentConsumed = getEntryConsumedServings(plan, entry) - (entry.leftoverServingsUsed ?? 0)
    let consumed = 0
    for (const assignment of entry.assignments) {
      const isThisCell =
        assignment.personId === target.personId &&
        assignment.day === target.day &&
        assignment.mealType === target.mealType
      const cellOccupants = isThisCell
        ? occupants.map((o) => ({ ...o.assignment, weight: hypotheticalWeights.get(o.assignment.id)! }))
        : findCellAssignments(plan, assignment.personId, assignment.day, assignment.mealType).map(
            (o) => o.assignment,
          )
      const weight = isThisCell ? hypotheticalWeights.get(assignment.id)! : assignment.weight
      consumed += getAssignmentFraction({ ...assignment, weight }, cellOccupants)
    }
    const limit = Math.max(entry.totalServings - (entry.leftoverServingsUsed ?? 0), currentConsumed)
    if (consumed > limit + CAPACITY_EPSILON) return false
  }
  return true
}

/** Whether `entry` (currently being dragged, or tap-selected) can be placed
 * into a cell already holding `occupants` for `mealType` — shared by the
 * drag-and-drop grid and the tap-to-place day view so both interaction modes
 * agree on cell eligibility. Given `plan` (and occupants carrying their
 * assignments, as `findCellAssignments` returns), it also checks that the
 * batch has enough servings left for the share this cell would take, so a
 * fully placed selection stops highlighting cells. Advisory/UX-only: the
 * store's `assignMealToCell` re-checks independently, so a stale or
 * optimistic `true` here can never let an invalid placement actually land. */
export function canPlaceEntryInCell(
  entry: PlannedMealEntry | undefined,
  mealType: MealType,
  occupants: { entry: PlannedMealEntry; assignment?: MealAssignment }[],
  plan?: WeeklyPlan,
): boolean {
  if (!entry || !entry.mealTypes.includes(mealType)) return false
  if (occupants.length >= MAX_CELL_OCCUPANTS) return false
  if (occupants.some((o) => o.entry.id === entry.id)) return false
  if (!plan) return true
  // Mirrors assignMealToCell: a newcomer gets weight 1 of the cell.
  const existingWeightSum = occupants.reduce((sum, o) => sum + (o.assignment?.weight ?? 1), 0)
  const newFraction = 1 / (existingWeightSum + 1)
  return getEntryConsumedServings(plan, entry) + newFraction <= entry.totalServings + CAPACITY_EPSILON
}

/** Servings of a batch not yet placed (never negative). */
export function getEntryRemaining(plan: WeeklyPlan, entry: PlannedMealEntry): number {
  return Math.max(0, entry.totalServings - getEntryConsumedServings(plan, entry))
}

export interface DayStatus {
  /** Cells someone is available for, across every person and tracked meal type. */
  available: number
  /** Available cells with nothing placed yet. */
  open: number
  /** Cells `entry` could be placed into right now (0 without an entry). */
  eligible: number
}

/** Per-day summary for the mobile day switcher: how many slots are still
 * empty, and (with an entry selected) how many it could still go into. */
export function getDayStatus(plan: WeeklyPlan, day: number, entry?: PlannedMealEntry): DayStatus {
  const status: DayStatus = { available: 0, open: 0, eligible: 0 }
  for (const person of plan.people) {
    for (const mealType of plan.selectedMealTypes) {
      if (!isCellAvailable(person, mealType, day)) continue
      status.available++
      const occupants = findCellAssignments(plan, person.id, day, mealType)
      if (occupants.length === 0) status.open++
      if (entry && canPlaceEntryInCell(entry, mealType, occupants, plan)) status.eligible++
    }
  }
  return status
}

/** Index (0–6) of today within the plan week, or `undefined` when today falls
 * outside it. `today` is an ISO date, injectable for tests. */
export function getTodayDayIndex(weekStartDate: string, today: string): number | undefined {
  const [y1, m1, d1] = weekStartDate.split('-').map(Number)
  const [y2, m2, d2] = today.split('-').map(Number)
  const diff = Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
  return diff >= 0 && diff < DAYS_PER_WEEK ? diff : undefined
}

export interface ShoppingListLine {
  key: string
  name: string
  unit: string
  quantity: number
  /** Names of the picked meals this line's ingredient comes from (distinct, A–Z). */
  sources: string[]
}

export interface ShoppingListOptions {
  /** Include entries marked "already cooked last week" (`isLeftover`). Off by
   * default: that batch's groceries were bought last week. */
  includeLeftovers?: boolean
}

/** Picked entries left off the shopping list by default because they were
 * cooked in a previous week (see `ShoppingListOptions.includeLeftovers`). */
export function getLeftoverEntries(plan: WeeklyPlan): PlannedMealEntry[] {
  return plan.plannedMeals.filter((e) => e.isLeftover)
}

function roundQuantity(n: number): number {
  return Math.round(n * 100) / 100
}

/** Aggregates ingredients across every planned meal in the week, summing
 * quantities for ingredients that share the same name (case-insensitive,
 * trimmed) and unit. Units that convert into each other (g/kg, ml/l,
 * tsp/tbsp/cup — see `lib/units.ts`) are combined and shown in a readable
 * unit; any other unit only combines with the exact same unit, so the same
 * name with an unrelated unit stays a separate line. Each batch's
 * ingredients count once no matter how its servings are placed. Batches
 * marked as cooked last week are skipped unless `includeLeftovers`. */
export function getShoppingList(plan: WeeklyPlan, options: ShoppingListOptions = {}): ShoppingListLine[] {
  const map = new Map<
    string,
    { key: string; name: string; unit: string; quantity: number; family: UnitFamily | null; sources: Set<string> }
  >()

  for (const entry of plan.plannedMeals) {
    if (entry.isLeftover && !options.includeLeftovers) continue
    for (const ingredient of entry.ingredients) {
      const name = ingredient.name.trim()
      const unit = ingredient.unit.trim()
      const base = toBaseUnit(ingredient.quantity, unit)
      const key = base ? `${name.toLowerCase()}|${base.family}` : `${name.toLowerCase()}|${unit.toLowerCase()}`
      const quantity = base ? base.baseQuantity : ingredient.quantity
      const existing = map.get(key)
      if (existing) {
        existing.quantity += quantity
        existing.sources.add(entry.name)
      } else {
        map.set(key, { key, name, unit, quantity, family: base?.family ?? null, sources: new Set([entry.name]) })
      }
    }
  }

  return [...map.values()]
    .map(({ key, name, unit, quantity, family, sources }) => {
      const display = family ? fromBaseUnit(family, quantity) : { quantity, unit }
      return {
        key,
        name,
        unit: display.unit,
        quantity: roundQuantity(display.quantity),
        sources: [...sources].sort((a, b) => a.localeCompare(b)),
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Splits shopping-list lines into what to buy and the household staples
 * (matched by `stapleKey`), which are listed separately and never copied. */
export function splitStaples(
  lines: ShoppingListLine[],
  staples: Staple[],
): { toBuy: ShoppingListLine[]; staples: ShoppingListLine[] } {
  const stapleIds = new Set(staples.map((s) => s.id))
  const toBuy: ShoppingListLine[] = []
  const stapleLines: ShoppingListLine[] = []
  for (const line of lines) (stapleIds.has(stapleKey(line.name)) ? stapleLines : toBuy).push(line)
  return { toBuy, staples: stapleLines }
}

/** Plain-text version of a shopping list for pasting into a notes app,
 * message, or Home Assistant's shopping list: one "Name — qty unit" per line. */
export function formatShoppingListText(lines: ShoppingListLine[], locale?: string): string {
  return lines.map((l) => `${l.name} — ${formatQuantity(l.quantity, locale)}${l.unit ? ` ${l.unit}` : ''}`).join('\n')
}
