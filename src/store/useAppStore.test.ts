import { beforeEach, describe, expect, it } from 'vitest'
import type { Person, PlannedMealEntry, WeeklyPlan } from '../types'
import { migratePlannedMealEntry, useAppStore } from './useAppStore'

function makePerson(id: string): Person {
  return { id, name: id, availability: {} }
}

function makeEntry(overrides: Partial<PlannedMealEntry> & { id: string }): PlannedMealEntry {
  return {
    mealId: 'meal-1',
    mealTypes: ['dinner'],
    totalServings: 4,
    assignments: [],
    name: 'Lasagna',
    protein: 'Beef',
    ingredients: [],
    ...overrides,
  }
}

function seedPlan(plan: Partial<WeeklyPlan> & { id: string }) {
  const full: WeeklyPlan = {
    weekStartDate: '2026-08-24',
    selectedMealTypes: ['dinner'],
    people: [],
    plannedMeals: [],
    createdAt: '2026-08-24T00:00:00.000Z',
    updatedAt: '2026-08-24T00:00:00.000Z',
    ...plan,
  }
  useAppStore.setState({ plans: [full] })
}

function getPlan(): WeeklyPlan {
  return useAppStore.getState().plans[0]
}

beforeEach(() => {
  useAppStore.setState({ meals: [], plans: [], activePlanId: null, hasSeededMeals: true })
})

describe('assignMealToCell', () => {
  it('rejects a 5th occupant of an already-full cell', () => {
    const occupants = ['e1', 'e2', 'e3', 'e4'].map((id) =>
      makeEntry({ id, assignments: [{ id: `a-${id}`, personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }] }),
    )
    const fifth = makeEntry({ id: 'e5' })
    seedPlan({
      id: 'plan-1',
      people: [makePerson('p1')],
      plannedMeals: [...occupants, fifth],
    })

    useAppStore.getState().assignMealToCell('plan-1', 'e5', 'p1', 'dinner', 0)

    expect(getPlan().plannedMeals.find((e) => e.id === 'e5')!.assignments).toHaveLength(0)
  })

  it('rejects the same entry occupying a cell it is already in', () => {
    const entry = makeEntry({
      id: 'e1',
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    seedPlan({ id: 'plan-1', people: [makePerson('p1')], plannedMeals: [entry] })

    useAppStore.getState().assignMealToCell('plan-1', 'e1', 'p1', 'dinner', 0)

    expect(getPlan().plannedMeals[0].assignments).toHaveLength(1)
  })

  it('rejects a drop that would push the entry over its totalServings', () => {
    const entry = makeEntry({
      id: 'e1',
      totalServings: 1,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    seedPlan({ id: 'plan-1', people: [makePerson('p1'), makePerson('p2')], plannedMeals: [entry] })

    // entry already fully placed (1/1 solo cell) — a second, separate solo cell would consume another full serving
    useAppStore.getState().assignMealToCell('plan-1', 'e1', 'p2', 'dinner', 0)

    expect(getPlan().plannedMeals[0].assignments).toHaveLength(1)
  })

  it('allows combining into a partially-shared cell, consuming only a fraction', () => {
    const lasagna = makeEntry({
      id: 'lasagna',
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    const chips = makeEntry({ id: 'chips', totalServings: 4 })
    seedPlan({ id: 'plan-1', people: [makePerson('p1')], plannedMeals: [lasagna, chips] })

    useAppStore.getState().assignMealToCell('plan-1', 'chips', 'p1', 'dinner', 0)

    const plan = getPlan()
    expect(plan.plannedMeals.find((e) => e.id === 'chips')!.assignments).toHaveLength(1)
  })
})

describe('setAssignmentWeight', () => {
  it('applies a valid reweight', () => {
    const a = makeEntry({
      id: 'e1',
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    const b = makeEntry({
      id: 'e2',
      totalServings: 4,
      assignments: [{ id: 'a2', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    seedPlan({ id: 'plan-1', people: [makePerson('p1')], plannedMeals: [a, b] })

    useAppStore.getState().setAssignmentWeight('plan-1', 'e1', 'a1', 3)

    const updated = getPlan().plannedMeals.find((e) => e.id === 'e1')!.assignments[0]
    expect(updated.weight).toBe(3)
  })

  it('rejects a reweight that would blow a co-occupant entry over its capacity', () => {
    const a = makeEntry({
      id: 'e1',
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 }],
    })
    // e2 is already fully placed via a second, separate solo cell — shrinking a1's weight
    // would grow a2's share of the shared cell and push e2 over its totalServings of 1.
    const b = makeEntry({
      id: 'e2',
      totalServings: 1,
      assignments: [
        { id: 'a2', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 },
        { id: 'a2b', personId: 'p2', mealType: 'dinner', day: 0, weight: 1 },
      ],
    })
    seedPlan({ id: 'plan-1', people: [makePerson('p1'), makePerson('p2')], plannedMeals: [a, b] })

    useAppStore.getState().setAssignmentWeight('plan-1', 'e1', 'a1', 0)

    const updated = getPlan().plannedMeals.find((e) => e.id === 'e1')!.assignments[0]
    expect(updated.weight).toBe(1)
  })
})

describe('setEntryLeftover / setEntryServingsLeft', () => {
  it('turning on leftover leaves servingsLeft at the full batch until edited', () => {
    const entry = makeEntry({ id: 'e1', totalServings: 6 })
    seedPlan({ id: 'plan-1', people: [], plannedMeals: [entry] })

    useAppStore.getState().setEntryLeftover('plan-1', 'e1', true)

    const updated = getPlan().plannedMeals[0]
    expect(updated.isLeftover).toBe(true)
    expect(updated.leftoverServingsUsed ?? 0).toBe(0)
  })

  it('setting servings left to 3 of 6 seeds leftoverServingsUsed with the other 3', () => {
    const entry = makeEntry({ id: 'e1', totalServings: 6 })
    seedPlan({ id: 'plan-1', people: [], plannedMeals: [entry] })

    useAppStore.getState().setEntryLeftover('plan-1', 'e1', true)
    useAppStore.getState().setEntryServingsLeft('plan-1', 'e1', 3)

    const updated = getPlan().plannedMeals[0]
    expect(updated.leftoverServingsUsed).toBe(3)
  })

  it('clamps servingsLeft to totalServings on the high end', () => {
    const entry = makeEntry({ id: 'e1', totalServings: 6 })
    seedPlan({ id: 'plan-1', people: [], plannedMeals: [entry] })

    useAppStore.getState().setEntryServingsLeft('plan-1', 'e1', 99)

    expect(getPlan().plannedMeals[0].leftoverServingsUsed).toBe(0)
  })

  it('will not drop servingsLeft below servings already placed on the grid this week', () => {
    const entry = makeEntry({
      id: 'e1',
      totalServings: 6,
      assignments: [
        { id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 1 },
        { id: 'a2', personId: 'p1', mealType: 'dinner', day: 1, weight: 1 },
      ],
    })
    seedPlan({ id: 'plan-1', people: [makePerson('p1')], plannedMeals: [entry] })

    // 2 servings already placed this week — servingsLeft can't go below 2
    useAppStore.getState().setEntryServingsLeft('plan-1', 'e1', 0)

    expect(getPlan().plannedMeals[0].leftoverServingsUsed).toBe(4)
  })

  it('turning leftover off resets leftoverServingsUsed to 0', () => {
    const entry = makeEntry({ id: 'e1', totalServings: 6, isLeftover: true, leftoverServingsUsed: 3 })
    seedPlan({ id: 'plan-1', people: [], plannedMeals: [entry] })

    useAppStore.getState().setEntryLeftover('plan-1', 'e1', false)

    const updated = getPlan().plannedMeals[0]
    expect(updated.isLeftover).toBe(false)
    expect(updated.leftoverServingsUsed).toBe(0)
  })
})

describe('migratePlannedMealEntry', () => {
  it('backfills weight: 1 onto assignments missing it', () => {
    const legacy = {
      id: 'e1',
      mealId: 'meal-1',
      mealTypes: ['dinner'],
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0 }],
      name: 'Lasagna',
      protein: 'Beef',
      ingredients: [],
    }

    const migrated = migratePlannedMealEntry(legacy, [])

    expect(migrated.assignments[0].weight).toBe(1)
  })

  it('leaves an already-current assignment weight untouched', () => {
    const current = {
      id: 'e1',
      mealId: 'meal-1',
      mealTypes: ['dinner'],
      totalServings: 4,
      assignments: [{ id: 'a1', personId: 'p1', mealType: 'dinner', day: 0, weight: 3 }],
      name: 'Lasagna',
      protein: 'Beef',
      ingredients: [],
    }

    const migrated = migratePlannedMealEntry(current, [])

    expect(migrated.assignments[0].weight).toBe(3)
  })
})
