import { describe, expect, it } from 'vitest'
import type { PlannedMealEntry, Person, WeeklyPlan } from '../types'
import { getMealTypePicked, getMealTypeTarget, getShoppingList } from './calculations'

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id ?? 'person-1',
    name: overrides.name ?? 'Alex',
    servingsPerMealType: overrides.servingsPerMealType ?? {},
  }
}

function makeEntry(overrides: Partial<PlannedMealEntry> = {}): PlannedMealEntry {
  return {
    id: overrides.id ?? 'entry-1',
    mealId: overrides.mealId ?? 'meal-1',
    mealType: overrides.mealType ?? 'dinner',
    name: overrides.name ?? 'Lasagna',
    protein: overrides.protein ?? 'Beef',
    servingsPerBatch: overrides.servingsPerBatch ?? 8,
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

describe('getMealTypeTarget', () => {
  it('sums each person\'s servings for the given meal type', () => {
    const plan = makePlan({
      people: [
        makePerson({ id: 'p1', servingsPerMealType: { dinner: 7, breakfast: 5 } }),
        makePerson({ id: 'p2', servingsPerMealType: { dinner: 5 } }),
      ],
    })
    expect(getMealTypeTarget(plan, 'dinner')).toBe(12)
    expect(getMealTypeTarget(plan, 'breakfast')).toBe(5)
  })

  it('returns 0 for an empty plan or a meal type nobody set', () => {
    const plan = makePlan({ people: [makePerson({ servingsPerMealType: {} })] })
    expect(getMealTypeTarget(plan, 'lunch')).toBe(0)
    expect(getMealTypeTarget(makePlan({ people: [] }), 'dinner')).toBe(0)
  })
})

describe('getMealTypePicked', () => {
  it('sums servingsPerBatch only for entries matching the meal type', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ mealType: 'dinner', servingsPerBatch: 8 }),
        makeEntry({ mealType: 'dinner', servingsPerBatch: 6 }),
        makeEntry({ mealType: 'breakfast', servingsPerBatch: 4 }),
      ],
    })
    expect(getMealTypePicked(plan, 'dinner')).toBe(14)
    expect(getMealTypePicked(plan, 'breakfast')).toBe(4)
    expect(getMealTypePicked(plan, 'lunch')).toBe(0)
  })

  it('counts the same meal picked multiple times as separate entries', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', mealId: 'oatmeal', mealType: 'breakfast', servingsPerBatch: 4 }),
        makeEntry({ id: 'e2', mealId: 'oatmeal', mealType: 'breakfast', servingsPerBatch: 4 }),
      ],
    })
    expect(getMealTypePicked(plan, 'breakfast')).toBe(8)
  })
})

describe('getShoppingList', () => {
  it('sums quantities for matching name + unit across meals', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          id: 'e1',
          ingredients: [{ id: 'i1', name: 'Garlic', quantity: 2, unit: 'cloves' }],
        }),
        makeEntry({
          id: 'e2',
          ingredients: [{ id: 'i2', name: '  garlic ', quantity: 3, unit: 'Cloves' }],
        }),
      ],
    })
    const list = getShoppingList(plan)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'Garlic', unit: 'cloves', quantity: 5 })
  })

  it('keeps the same ingredient name with a different unit as separate lines', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          id: 'e1',
          ingredients: [
            { id: 'i1', name: 'Garlic', quantity: 2, unit: 'cloves' },
            { id: 'i2', name: 'Garlic', quantity: 1, unit: 'heads' },
          ],
        }),
      ],
    })
    const list = getShoppingList(plan)
    expect(list).toHaveLength(2)
  })

  it('returns an empty list for a plan with no planned meals', () => {
    expect(getShoppingList(makePlan({ plannedMeals: [] }))).toEqual([])
  })

  it('sorts results alphabetically by name', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          id: 'e1',
          ingredients: [
            { id: 'i1', name: 'Tomatoes', quantity: 1, unit: 'each' },
            { id: 'i2', name: 'Beef', quantity: 1, unit: 'lb' },
          ],
        }),
      ],
    })
    const list = getShoppingList(plan)
    expect(list.map((l) => l.name)).toEqual(['Beef', 'Tomatoes'])
  })
})
