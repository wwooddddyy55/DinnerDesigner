import { DAYS_PER_WEEK, MAX_CELL_OCCUPANTS } from '../types'
import type { MealAssignment, MealType, PlannedMealEntry, Person, WeeklyPlan } from '../types'

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

/** Trims a fractional serving count to at most 2 decimals with no trailing
 * zeros (e.g. 2.5, 2, 0.33), for display in the "placed" badge. */
export function formatServingCount(n: number): string {
  return (Math.round(n * 100) / 100).toString()
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
 * agree on cell eligibility. Advisory/UX-only: the store's `assignMealToCell`
 * re-checks independently (and also enforces the servings-capacity invariant,
 * which this does not), so a stale or optimistic `true` here can never let an
 * invalid placement actually land. */
export function canPlaceEntryInCell(
  entry: PlannedMealEntry | undefined,
  mealType: MealType,
  occupants: { entry: PlannedMealEntry }[],
): boolean {
  if (!entry || !entry.mealTypes.includes(mealType)) return false
  if (occupants.length >= MAX_CELL_OCCUPANTS) return false
  return !occupants.some((o) => o.entry.id === entry.id)
}

export interface ShoppingListLine {
  key: string
  name: string
  unit: string
  quantity: number
}

/** Aggregates ingredients across every planned meal in the week, summing
 * quantities for ingredients that share the same name (case-insensitive,
 * trimmed) and unit. Same name with a different unit stays a separate line. */
export function getShoppingList(plan: WeeklyPlan): ShoppingListLine[] {
  const map = new Map<string, ShoppingListLine>()

  for (const entry of plan.plannedMeals) {
    for (const ingredient of entry.ingredients) {
      const name = ingredient.name.trim()
      const unit = ingredient.unit.trim()
      const key = `${name.toLowerCase()}|${unit.toLowerCase()}`
      const existing = map.get(key)
      if (existing) {
        existing.quantity += ingredient.quantity
      } else {
        map.set(key, { key, name, unit, quantity: ingredient.quantity })
      }
    }
  }

  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
}
