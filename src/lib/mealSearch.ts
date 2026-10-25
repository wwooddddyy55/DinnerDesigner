import { getMealStaleness } from './history'
import type { Meal, WeeklyPlan } from '../types'

export type MealSort = 'name' | 'least-recent' | 'most-served' | 'newest'

export const MEAL_SORT_LABELS: Record<MealSort, string> = {
  name: 'Name (A–Z)',
  'least-recent': "Haven't had in a while",
  'most-served': 'Most often picked',
  newest: 'Recently added',
}

export interface MealServedInfo {
  lastServedDate: string
  timesServed: number
}

/** Per-meal last-served week and distinct-weeks count, keyed by meal id —
 * the History tab's staleness data, reshaped for lookups in lists. Meals
 * never picked into any week are simply absent. */
export function getMealServedIndex(plans: WeeklyPlan[]): Map<string, MealServedInfo> {
  return new Map(
    getMealStaleness(plans).map((e) => [e.mealId, { lastServedDate: e.lastServedDate, timesServed: e.timesServed }]),
  )
}

/** Case-insensitive substring match on a meal's name or any ingredient name.
 * Every whitespace-separated word of the query must match somewhere, so
 * "chicken rice" finds a chicken dish that uses rice. */
export function matchesMealSearch(meal: Meal, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = [meal.name, ...meal.ingredients.map((i) => i.name)].join('\n').toLowerCase()
  return words.every((w) => haystack.includes(w))
}

/** Returns a sorted copy. "Haven't had in a while" puts never-picked meals
 * first, then oldest last-served week first; ties fall back to name. */
export function sortMeals(meals: Meal[], sort: MealSort, served: Map<string, MealServedInfo>): Meal[] {
  const byName = (a: Meal, b: Meal) => a.name.localeCompare(b.name)
  const copy = [...meals]
  switch (sort) {
    case 'name':
      return copy.sort(byName)
    case 'newest':
      return copy.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || byName(a, b))
    case 'most-served':
      return copy.sort(
        (a, b) => (served.get(b.id)?.timesServed ?? 0) - (served.get(a.id)?.timesServed ?? 0) || byName(a, b),
      )
    case 'least-recent':
      return copy.sort((a, b) => {
        const la = served.get(a.id)?.lastServedDate ?? ''
        const lb = served.get(b.id)?.lastServedDate ?? ''
        return la.localeCompare(lb) || byName(a, b)
      })
  }
}

/** Short "last picked" label relative to `referenceIsoDate` (the active
 * week's start, or today): "Never", "This week", "Last week", "3 wks ago",
 * or "In an upcoming week" for a later one. Week granularity, matching how
 * History counts "served". */
export function formatLastServed(info: MealServedInfo | undefined, referenceIsoDate: string): string {
  if (!info) return 'Never'
  const days = Math.round((isoToUtcMs(referenceIsoDate) - isoToUtcMs(info.lastServedDate)) / 86_400_000)
  if (days < 0) return 'In an upcoming week'
  const weeks = Math.floor(days / 7)
  if (weeks === 0) return 'This week'
  if (weeks === 1) return 'Last week'
  return `${weeks} wks ago`
}

function isoToUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}
