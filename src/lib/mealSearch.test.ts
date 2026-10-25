import { describe, expect, it } from 'vitest'
import type { Meal } from '../types'
import { formatLastServed, matchesMealSearch, sortMeals } from './mealSearch'

function makeMeal(overrides: Partial<Meal> = {}): Meal {
  return {
    id: overrides.id ?? 'm1',
    name: overrides.name ?? 'Lasagna',
    mealTypes: overrides.mealTypes ?? ['dinner'],
    protein: overrides.protein ?? 'Beef',
    servingsPerBatch: overrides.servingsPerBatch ?? 8,
    ingredients: overrides.ingredients ?? [],
    createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-01-01T00:00:00.000Z',
  }
}

describe('matchesMealSearch', () => {
  const meal = makeMeal({
    name: 'Chicken Curry',
    ingredients: [{ id: 'i1', name: 'Basmati rice', quantity: 1, unit: 'cup' }],
  })

  it('matches the name or an ingredient, case-insensitively', () => {
    expect(matchesMealSearch(meal, 'curry')).toBe(true)
    expect(matchesMealSearch(meal, 'BASMATI')).toBe(true)
    expect(matchesMealSearch(meal, 'beef')).toBe(false)
  })

  it('requires every word to match somewhere', () => {
    expect(matchesMealSearch(meal, 'chicken rice')).toBe(true)
    expect(matchesMealSearch(meal, 'chicken pasta')).toBe(false)
  })

  it('matches everything for a blank query', () => {
    expect(matchesMealSearch(meal, '   ')).toBe(true)
  })
})

describe('sortMeals', () => {
  const a = makeMeal({ id: 'a', name: 'Apple pie', createdAt: '2026-03-01T00:00:00.000Z' })
  const b = makeMeal({ id: 'b', name: 'Burgers', createdAt: '2026-01-01T00:00:00.000Z' })
  const c = makeMeal({ id: 'c', name: 'Curry', createdAt: '2026-02-01T00:00:00.000Z' })
  const served = new Map([
    ['a', { lastServedDate: '2026-05-01', timesServed: 1 }],
    ['b', { lastServedDate: '2026-04-01', timesServed: 3 }],
  ])

  it('sorts by name', () => {
    expect(sortMeals([c, b, a], 'name', served).map((m) => m.id)).toEqual(['a', 'b', 'c'])
  })

  it('puts never-picked meals first, then the longest since served', () => {
    expect(sortMeals([a, b, c], 'least-recent', served).map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })

  it('sorts by most often picked', () => {
    expect(sortMeals([a, b, c], 'most-served', served).map((m) => m.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts by recently added', () => {
    expect(sortMeals([a, b, c], 'newest', served).map((m) => m.id)).toEqual(['a', 'c', 'b'])
  })

  it('does not mutate its input', () => {
    const input = [c, b, a]
    sortMeals(input, 'name', served)
    expect(input.map((m) => m.id)).toEqual(['c', 'b', 'a'])
  })
})

describe('formatLastServed', () => {
  it('describes how long ago, at week granularity', () => {
    expect(formatLastServed(undefined, '2026-05-10')).toBe('Never')
    expect(formatLastServed({ lastServedDate: '2026-05-10', timesServed: 1 }, '2026-05-10')).toBe('This week')
    expect(formatLastServed({ lastServedDate: '2026-05-03', timesServed: 1 }, '2026-05-10')).toBe('Last week')
    expect(formatLastServed({ lastServedDate: '2026-04-19', timesServed: 1 }, '2026-05-10')).toBe('3 wks ago')
    expect(formatLastServed({ lastServedDate: '2026-05-17', timesServed: 1 }, '2026-05-10')).toBe('In an upcoming week')
  })
})
