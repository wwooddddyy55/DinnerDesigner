import { describe, expect, it } from 'vitest'
import type { MealAssignment, PlannedMealEntry, Person, WeeklyPlan } from '../types'
import { formatShoppingListText, getLeftoverEntries, getOpenCells, getShoppingList } from './calculations'

function makeEntry(overrides: Partial<PlannedMealEntry> = {}): PlannedMealEntry {
  return {
    id: overrides.id ?? 'entry-1',
    mealId: overrides.mealId ?? 'meal-1',
    mealTypes: overrides.mealTypes ?? ['dinner'],
    totalServings: overrides.totalServings ?? 8,
    isLeftover: overrides.isLeftover,
    leftoverServingsUsed: overrides.leftoverServingsUsed,
    assignments: overrides.assignments ?? [],
    name: overrides.name ?? 'Lasagna',
    protein: overrides.protein ?? 'Beef',
    ingredients: overrides.ingredients ?? [],
  }
}

function makePlan(overrides: Partial<WeeklyPlan> = {}): WeeklyPlan {
  return {
    id: 'plan-1',
    weekStartDate: '2026-08-24',
    selectedMealTypes: ['dinner'],
    people: overrides.people ?? [],
    plannedMeals: overrides.plannedMeals ?? [],
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
  }
}

describe('getShoppingList — leftovers, units and sources', () => {
  it('skips entries already cooked last week unless asked to include them', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', name: 'Chili', ingredients: [{ id: 'i1', name: 'Beans', quantity: 2, unit: 'cans' }] }),
        makeEntry({
          id: 'e2',
          name: 'Lasagna',
          isLeftover: true,
          leftoverServingsUsed: 4,
          ingredients: [{ id: 'i2', name: 'Pasta', quantity: 1, unit: 'box' }],
        }),
      ],
    })
    expect(getShoppingList(plan).map((l) => l.name)).toEqual(['Beans'])
    expect(getShoppingList(plan, { includeLeftovers: true }).map((l) => l.name)).toEqual(['Beans', 'Pasta'])
    expect(getLeftoverEntries(plan).map((e) => e.name)).toEqual(['Lasagna'])
  })

  it('combines g and kg into one line, shown in kg from 1000 g, listing both source meals', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', name: 'B', ingredients: [{ id: 'i1', name: 'Flour', quantity: 500, unit: 'g' }] }),
        makeEntry({ id: 'e2', name: 'A', ingredients: [{ id: 'i2', name: 'flour', quantity: 0.75, unit: 'kg' }] }),
      ],
    })
    expect(getShoppingList(plan)).toEqual([
      { key: 'flour|mass', name: 'Flour', unit: 'kg', quantity: 1.25, sources: ['A', 'B'] },
    ])
  })

  it('keeps a small mass total in grams', () => {
    const plan = makePlan({
      plannedMeals: [makeEntry({ ingredients: [{ id: 'i1', name: 'Butter', quantity: 0.25, unit: 'kg' }] })],
    })
    expect(getShoppingList(plan)[0]).toMatchObject({ unit: 'g', quantity: 250 })
  })

  it('combines spoon measures and picks a readable unit', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          ingredients: [
            { id: 'i1', name: 'Oil', quantity: 2, unit: 'tbsp' },
            { id: 'i2', name: 'Oil', quantity: 3, unit: 'tsp' },
          ],
        }),
      ],
    })
    expect(getShoppingList(plan)[0]).toMatchObject({ unit: 'tbsp', quantity: 3 })
  })

  it('keeps metric volume and spoon/cup measures apart', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          ingredients: [
            { id: 'i1', name: 'Milk', quantity: 250, unit: 'ml' },
            { id: 'i2', name: 'Milk', quantity: 1, unit: 'cup' },
          ],
        }),
      ],
    })
    expect(getShoppingList(plan)).toHaveLength(2)
  })

  it('rounds away floating-point noise', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          ingredients: [
            { id: 'i1', name: 'Salt', quantity: 0.1, unit: 'each' },
            { id: 'i2', name: 'Salt', quantity: 0.2, unit: 'each' },
          ],
        }),
      ],
    })
    expect(getShoppingList(plan)[0].quantity).toBe(0.3)
  })
})

describe('formatShoppingListText', () => {
  it('writes one "name — qty unit" line per item', () => {
    expect(
      formatShoppingListText([
        { key: 'a', name: 'Beans', unit: 'cans', quantity: 2, sources: [] },
        { key: 'b', name: 'Eggs', unit: '', quantity: 6, sources: [] },
      ]),
    ).toBe('Beans — 2 cans\nEggs — 6')
  })
})

describe('getOpenCells', () => {
  function person(id: string, name: string, availableDays: number): Person {
    return { id, name, availability: { dinner: Array.from({ length: 7 }, (_, i) => i < availableDays) } }
  }
  function assignment(personId: string, day: number): MealAssignment {
    return { id: `${personId}-${day}`, personId, mealType: 'dinner', day, weight: 1 }
  }

  it('lists available, unfilled slots in day then person order', () => {
    const plan = makePlan({
      people: [person('p1', 'Alex', 2), person('p2', 'Sam', 1)],
      plannedMeals: [makeEntry({ assignments: [assignment('p1', 0)] })],
    })
    expect(getOpenCells(plan, 'dinner').map(({ person: p, day }) => `${p.name}${day}`)).toEqual(['Sam0', 'Alex1'])
  })
})
