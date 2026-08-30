import { DAYS_PER_WEEK } from '../types'
import type { MealAssignment, MealType, PlannedMealEntry, Person, WeeklyPlan } from '../types'

export const CAPACITY_EPSILON = 1e-9

/** A person's availability pattern for a meal type: a 7-length boolean array
 * (index 0=Mon..6=Sun). Falls back to "available every day" when the person
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

/** All occupants of a given (person, day, mealType) cell, scanning every
 * entry's assignments — a cell may hold up to MAX_CELL_OCCUPANTS occupants
 * from different entries when meals are combined; see `assignMealToCell`. */
export function findCellAssignments(
  plan: WeeklyPlan,
  personId: string,
  day: number,
  mealType: MealType,
): { entry: PlannedMealEntry; assignment: MealAssignment }[] {
  const occupants: { entry: PlannedMealEntry; assignment: MealAssignment }[] = []
  for (const entry of plan.plannedMeals) {
    for (const assignment of entry.assignments) {
      if (assignment.personId === personId && assignment.day === day && assignment.mealType === mealType) {
        occupants.push({ entry, assignment })
      }
    }
  }
  return occupants
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

/** Trims a fractional serving count to at most 2 decimals with no trailing
 * zeros (e.g. 2.5, 2, 0.33), for display in the "placed" badge. */
export function formatServingCount(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/** Whether changing one assignment's weight to `proposedWeight` would push
 * its own or any cell co-occupant's *entry* over that entry's totalServings
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
    if (consumed > entry.totalServings + CAPACITY_EPSILON) return false
  }
  return true
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
