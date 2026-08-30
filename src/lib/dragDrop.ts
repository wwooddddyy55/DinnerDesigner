import type { MealType } from '../types'

const CELL_ID_SEP = '::'

export function cellDroppableId(personId: string, mealType: MealType, day: number): string {
  return [personId, mealType, day].join(CELL_ID_SEP)
}

export function parseCellDroppableId(id: string): { personId: string; mealType: MealType; day: number } {
  const [personId, mealType, day] = id.split(CELL_ID_SEP)
  return { personId, mealType: mealType as MealType, day: Number(day) }
}
