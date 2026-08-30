export type MealType = 'breakfast' | 'lunch' | 'dinner'

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner']

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export type ProteinType = 'Beef' | 'Chicken' | 'Pork' | 'Fish' | 'Vegetarian' | 'Other'

export const PROTEIN_TYPES: ProteinType[] = [
  'Beef',
  'Chicken',
  'Pork',
  'Fish',
  'Vegetarian',
  'Other',
]

export interface Ingredient {
  id: string
  name: string
  quantity: number
  unit: string
}

export interface Meal {
  id: string
  name: string
  mealTypes: MealType[]
  protein: ProteinType
  proteinCustomLabel?: string
  servingsPerBatch: number
  ingredients: Ingredient[]
  notes?: string
  sourceUrl?: string
  createdAt: string
  updatedAt: string
}

export const DAYS_PER_WEEK = 7

/** Max number of foods that can share one (person, day, mealType) cell. */
export const MAX_CELL_OCCUPANTS = 4
export const MIN_ASSIGNMENT_WEIGHT = 1
export const MAX_ASSIGNMENT_WEIGHT = 6

export interface Person {
  id: string
  name: string
  /** Per meal type, which of the week's 7 days (index 0=Mon..6=Sun) this
   * person is available to eat that meal type. A meal type absent from this
   * object (new person, or legacy data migrated from before this feature
   * existed) defaults to "available all 7 days" — see
   * `getPersonAvailability` in `lib/calculations.ts`. Day is an index
   * relative to the plan's `weekStartDate`, not an ISO date, so a person's
   * availability pattern carries over correctly when "copy people from last
   * week" clones them into a plan with a different `weekStartDate`. */
  availability: Partial<Record<MealType, boolean[]>>
}

/** One serving (or a share of one) of a `PlannedMealEntry`'s batch placed
 * onto a specific (person, day, mealType) cell in the Plan Builder's
 * assignment grid. Up to `MAX_CELL_OCCUPANTS` assignments — from different
 * entries — may share one cell, to model combining foods into one meal (e.g.
 * lasagna + chips); see `assignMealToCell` in the store.
 *
 * `weight` is NOT a fraction by itself — the actual serving fraction an
 * assignment consumes is always derived from its weight relative to every
 * assignment currently sharing its cell: `getAssignmentFraction` in
 * `lib/calculations.ts` computes `weight / sum(co-occupants' weights)`. This
 * means a cell with a single occupant always derives fraction 1 regardless
 * of that occupant's weight — weight only matters once 2+ items share a
 * cell — and removing or reweighting one occupant automatically rebalances
 * everyone else sharing that cell, with nothing stored needing to change. */
export interface MealAssignment {
  id: string
  personId: string
  mealType: MealType
  day: number // 0=Mon..6=Sun, relative to WeeklyPlan.weekStartDate
  weight: number
}

/** A meal picked into a WeeklyPlan, snapshotted at pick-time so later edits
 * to the meal library don't retroactively change past weeks' plans.
 *
 * One entry == one cooked batch. `totalServings` is the fixed size of that
 * batch (== meal.servingsPerBatch at pick-time) and never changes after
 * creation. `assignments` places shares of that batch onto specific (person,
 * day, mealType) grid cells; the sum of each assignment's *derived fraction*
 * (see `MealAssignment`, and `getEntryConsumedServings` in
 * `lib/calculations.ts`) plus `leftoverServingsUsed` must never exceed
 * `totalServings`. Under-placement is allowed — batch servings not yet
 * placed on any cell simply don't count toward any progress bar.
 *
 * `mealTypes` is usually just the underlying meal's library `mealTypes`
 * snapshot, EXCEPT: if the plan tracks both lunch and dinner, any meal
 * eligible for either one gets both added here at pick-time, so it can
 * always be placed as leftovers across lunch/dinner regardless of which one
 * it's tagged for in the library (see `addPlannedMeal`).
 *
 * `isLeftover` and `leftoverServingsUsed` model a batch that was actually
 * cooked in a *previous* week and already partly eaten before this entry was
 * picked — e.g. a 6-serving batch with 3 already eaten last week should only
 * offer 3 servings' worth of grid capacity this week. `leftoverServingsUsed`
 * is a static baseline folded into `getEntryConsumedServings` alongside real
 * assignments, so it counts toward the same `totalServings` cap without any
 * separate "remaining" bookkeeping. Both fields are optional/absent for a
 * freshly-cooked entry (treated as `isLeftover: false`, `leftoverServingsUsed: 0`).
 */
export interface PlannedMealEntry {
  id: string
  mealId: string
  mealTypes: MealType[]
  totalServings: number
  isLeftover?: boolean
  leftoverServingsUsed?: number
  assignments: MealAssignment[]
  name: string
  protein: ProteinType
  proteinCustomLabel?: string
  ingredients: Ingredient[]
}

export interface WeeklyPlan {
  id: string
  weekStartDate: string
  selectedMealTypes: MealType[]
  people: Person[]
  plannedMeals: PlannedMealEntry[]
  createdAt: string
  updatedAt: string
}

export function proteinLabel(protein: ProteinType, customLabel?: string): string {
  if (protein === 'Other' && customLabel && customLabel.trim().length > 0) {
    return customLabel.trim()
  }
  return protein
}
