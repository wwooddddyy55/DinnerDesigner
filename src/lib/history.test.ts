import { describe, expect, it } from 'vitest'
import type { PlannedMealEntry, WeeklyPlan } from '../types'
import { getMealStaleness, getWeekHistory } from './history'

function makeEntry(overrides: Partial<PlannedMealEntry> = {}): PlannedMealEntry {
  return {
    id: overrides.id ?? 'entry-1',
    mealId: overrides.mealId ?? 'meal-1',
    mealTypes: overrides.mealTypes ?? ['dinner'],
    totalServings: overrides.totalServings ?? 8,
    assignments: overrides.assignments ?? [],
    name: overrides.name ?? 'Lasagna',
    protein: overrides.protein ?? 'Beef',
    ingredients: overrides.ingredients ?? [],
  }
}

function makePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: overrides.id ?? 'plan-1',
    weekStartDate: overrides.weekStartDate ?? '2026-08-24',
    selectedMealTypes: overrides.selectedMealTypes ?? ['dinner'],
    people: overrides.people ?? [],
    plannedMeals: overrides.plannedMeals ?? [],
    createdAt: overrides.createdAt ?? '2026-08-24T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-24T00:00:00.000Z',
  }
}

describe('getWeekHistory', () => {
  it('sorts weeks most-recent first', () => {
    const older = makePlan({ id: 'p1', weekStartDate: '2026-08-10' })
    const newer = makePlan({ id: 'p2', weekStartDate: '2026-08-24' })
    const history = getWeekHistory([older, newer])
    expect(history.map((w) => w.planId)).toEqual(['p2', 'p1'])
  })

  it('dedupes a meal picked twice in the same week into one entry', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', mealId: 'lasagna', name: 'Lasagna' }),
        makeEntry({ id: 'e2', mealId: 'lasagna', name: 'Lasagna' }),
        makeEntry({ id: 'e3', mealId: 'tacos', name: 'Tacos' }),
      ],
    })
    const [week] = getWeekHistory([plan])
    expect(week.meals).toEqual([
      { mealId: 'lasagna', name: 'Lasagna' },
      { mealId: 'tacos', name: 'Tacos' },
    ])
  })

  it('returns an empty meals list for a week with no planned meals', () => {
    const [week] = getWeekHistory([makePlan({ plannedMeals: [] })])
    expect(week.meals).toEqual([])
  })
})

describe('getMealStaleness', () => {
  it('tracks the most recent week a meal was served', () => {
    const plans = [
      makePlan({ id: 'p1', weekStartDate: '2026-08-10', plannedMeals: [makeEntry({ mealId: 'tacos', name: 'Tacos' })] }),
      makePlan({ id: 'p2', weekStartDate: '2026-08-24', plannedMeals: [makeEntry({ mealId: 'tacos', name: 'Tacos' })] }),
    ]
    const [entry] = getMealStaleness(plans)
    expect(entry.lastServedDate).toBe('2026-08-24')
  })

  it('counts distinct weeks served, not raw planned-meal entries', () => {
    const plans = [
      makePlan({
        id: 'p1',
        weekStartDate: '2026-08-10',
        plannedMeals: [
          makeEntry({ id: 'e1', mealId: 'tacos', name: 'Tacos' }),
          makeEntry({ id: 'e2', mealId: 'tacos', name: 'Tacos' }),
        ],
      }),
      makePlan({
        id: 'p2',
        weekStartDate: '2026-08-24',
        plannedMeals: [makeEntry({ id: 'e3', mealId: 'tacos', name: 'Tacos' })],
      }),
    ]
    const [entry] = getMealStaleness(plans)
    expect(entry.timesServed).toBe(2)
  })

  it('sorts by staleness, oldest last-served first', () => {
    const plans = [
      makePlan({
        id: 'p1',
        weekStartDate: '2026-08-24',
        plannedMeals: [makeEntry({ mealId: 'tacos', name: 'Tacos' })],
      }),
      makePlan({
        id: 'p2',
        weekStartDate: '2026-07-01',
        plannedMeals: [makeEntry({ mealId: 'soup', name: 'Soup' })],
      }),
    ]
    const staleness = getMealStaleness(plans)
    expect(staleness.map((m) => m.name)).toEqual(['Soup', 'Tacos'])
  })

  it('returns an empty list when there are no plans', () => {
    expect(getMealStaleness([])).toEqual([])
  })
})
