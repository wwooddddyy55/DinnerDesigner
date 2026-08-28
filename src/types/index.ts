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
  createdAt: string
  updatedAt: string
}

export interface Person {
  id: string
  name: string
  servingsPerMealType: Partial<Record<MealType, number>>
}

/** A meal picked into a WeeklyPlan, snapshotted at pick-time so later edits
 * to the meal library don't retroactively change past weeks' plans. */
export interface PlannedMealEntry {
  id: string
  mealId: string
  mealType: MealType
  name: string
  protein: ProteinType
  proteinCustomLabel?: string
  servingsPerBatch: number
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

export const DEFAULT_SERVINGS_PER_WEEK = 7

export function proteinLabel(protein: ProteinType, customLabel?: string): string {
  if (protein === 'Other' && customLabel && customLabel.trim().length > 0) {
    return customLabel.trim()
  }
  return protein
}
