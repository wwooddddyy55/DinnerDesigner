import type { MealType, WeeklyPlan } from '../types'

export function getMealTypeTarget(plan: WeeklyPlan, mealType: MealType): number {
  return plan.people.reduce((sum, person) => sum + (person.servingsPerMealType[mealType] ?? 0), 0)
}

export function getMealTypePicked(plan: WeeklyPlan, mealType: MealType): number {
  return plan.plannedMeals
    .filter((entry) => entry.mealType === mealType)
    .reduce((sum, entry) => sum + entry.servingsPerBatch, 0)
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
