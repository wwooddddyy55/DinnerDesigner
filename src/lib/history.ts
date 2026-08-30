import type { WeeklyPlan } from '../types'

export interface WeekHistoryEntry {
  planId: string
  weekStartDate: string
  meals: { mealId: string; name: string }[]
}

export interface MealStalenessEntry {
  mealId: string
  name: string
  lastServedDate: string
  timesServed: number
}

function sortPlansByWeekDesc(plans: WeeklyPlan[]): WeeklyPlan[] {
  return [...plans].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
}

export function getWeekHistory(plans: WeeklyPlan[]): WeekHistoryEntry[] {
  return sortPlansByWeekDesc(plans).map((plan) => {
    const byMealId = new Map<string, { mealId: string; name: string }>()
    for (const entry of plan.plannedMeals) {
      byMealId.set(entry.mealId, { mealId: entry.mealId, name: entry.name })
    }
    const meals = [...byMealId.values()].sort((a, b) => a.name.localeCompare(b.name))
    return { planId: plan.id, weekStartDate: plan.weekStartDate, meals }
  })
}

export function getMealStaleness(plans: WeeklyPlan[]): MealStalenessEntry[] {
  const byMealId = new Map<
    string,
    { mealId: string; name: string; lastServedDate: string; weeksServedIn: Set<string> }
  >()

  for (const plan of plans) {
    const mealsThisWeek = new Map<string, string>()
    for (const entry of plan.plannedMeals) {
      mealsThisWeek.set(entry.mealId, entry.name)
    }
    for (const [mealId, name] of mealsThisWeek) {
      const existing = byMealId.get(mealId)
      if (existing) {
        existing.weeksServedIn.add(plan.id)
        if (plan.weekStartDate > existing.lastServedDate) {
          existing.lastServedDate = plan.weekStartDate
        }
      } else {
        byMealId.set(mealId, {
          mealId,
          name,
          lastServedDate: plan.weekStartDate,
          weeksServedIn: new Set([plan.id]),
        })
      }
    }
  }

  return [...byMealId.values()]
    .map((entry) => ({
      mealId: entry.mealId,
      name: entry.name,
      lastServedDate: entry.lastServedDate,
      timesServed: entry.weeksServedIn.size,
    }))
    .sort((a, b) => a.lastServedDate.localeCompare(b.lastServedDate) || a.name.localeCompare(b.name))
}
