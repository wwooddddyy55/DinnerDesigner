import { describe, expect, it } from 'vitest'
import type { MealAssignment, PlannedMealEntry, Person, WeeklyPlan } from '../types'
import { MAX_CELL_OCCUPANTS } from '../types'
import {
  canPlaceEntryInCell,
  canSetAssignmentWeight,
  findCellAssignments,
  formatServingCount,
  getAssignmentFraction,
  getEntryConsumedServings,
  getMealTypePicked,
  getMealTypeTarget,
  getPersonMealTypeTarget,
  getShoppingList,
  isEntryFullyPlaced,
} from './calculations'

/** First `n` of 7 days marked available, rest unavailable. */
function daysTrue(n: number): boolean[] {
  return Array.from({ length: 7 }, (_, i) => i < n)
}

function makePerson(overrides: Partial<Person> = {}): Person {
  return {
    id: overrides.id ?? 'person-1',
    name: overrides.name ?? 'Alex',
    availability: overrides.availability ?? {},
  }
}

function makeAssignment(overrides: Partial<MealAssignment> = {}): MealAssignment {
  return {
    id: overrides.id ?? `assignment-${Math.random()}`,
    personId: overrides.personId ?? 'person-1',
    mealType: overrides.mealType ?? 'dinner',
    day: overrides.day ?? 0,
    weight: overrides.weight ?? 1,
  }
}

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
    id: overrides.id ?? 'plan-1',
    weekStartDate: overrides.weekStartDate ?? '2026-08-24',
    selectedMealTypes: overrides.selectedMealTypes ?? ['dinner'],
    people: overrides.people ?? [],
    plannedMeals: overrides.plannedMeals ?? [],
    createdAt: overrides.createdAt ?? '2026-08-24T00:00:00.000Z',
    updatedAt: overrides.updatedAt ?? '2026-08-24T00:00:00.000Z',
  }
}

describe('getPersonMealTypeTarget', () => {
  it('defaults to 7 when the person has no stored availability for the meal type', () => {
    expect(getPersonMealTypeTarget(makePerson(), 'dinner')).toBe(7)
  })

  it('counts only the days marked available for an explicit partial pattern', () => {
    const person = makePerson({ availability: { dinner: daysTrue(5) } })
    expect(getPersonMealTypeTarget(person, 'dinner')).toBe(5)
  })

  it('tracks each meal type independently for the same person', () => {
    const person = makePerson({ availability: { dinner: daysTrue(3) } })
    expect(getPersonMealTypeTarget(person, 'dinner')).toBe(3)
    expect(getPersonMealTypeTarget(person, 'breakfast')).toBe(7)
  })
})

describe('getMealTypeTarget', () => {
  it("sums each person's derived target for the given meal type", () => {
    const plan = makePlan({
      people: [
        makePerson({ id: 'p1', availability: { dinner: daysTrue(7), breakfast: daysTrue(5) } }),
        makePerson({ id: 'p2', availability: { dinner: daysTrue(5), breakfast: daysTrue(0) } }),
      ],
    })
    expect(getMealTypeTarget(plan, 'dinner')).toBe(12)
    expect(getMealTypeTarget(plan, 'breakfast')).toBe(5)
  })

  it('returns 0 for a plan with no people', () => {
    expect(getMealTypeTarget(makePlan({ people: [] }), 'dinner')).toBe(0)
  })
})

describe('getMealTypePicked', () => {
  it('counts assignments only for entries matching the meal type', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          mealTypes: ['dinner'],
          totalServings: 8,
          assignments: [
            makeAssignment({ mealType: 'dinner', day: 0 }),
            makeAssignment({ mealType: 'dinner', day: 1, personId: 'p2' }),
          ],
        }),
        makeEntry({
          mealTypes: ['dinner'],
          totalServings: 6,
          assignments: [makeAssignment({ mealType: 'dinner', day: 2 })],
        }),
        makeEntry({
          mealTypes: ['breakfast'],
          totalServings: 4,
          assignments: [makeAssignment({ mealType: 'breakfast', day: 0 })],
        }),
      ],
    })
    expect(getMealTypePicked(plan, 'dinner')).toBe(3)
    expect(getMealTypePicked(plan, 'breakfast')).toBe(1)
    expect(getMealTypePicked(plan, 'lunch')).toBe(0)
  })

  it('counts the same meal picked multiple times as separate entries', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          id: 'e1',
          mealId: 'oatmeal',
          mealTypes: ['breakfast'],
          totalServings: 4,
          assignments: [makeAssignment({ mealType: 'breakfast', day: 0 })],
        }),
        makeEntry({
          id: 'e2',
          mealId: 'oatmeal',
          mealTypes: ['breakfast'],
          totalServings: 4,
          assignments: [makeAssignment({ mealType: 'breakfast', day: 1 })],
        }),
      ],
    })
    expect(getMealTypePicked(plan, 'breakfast')).toBe(2)
  })

  it('splits a single batch entry across two meal types without double counting', () => {
    const plan = makePlan({
      selectedMealTypes: ['lunch', 'dinner'],
      plannedMeals: [
        makeEntry({
          mealTypes: ['lunch', 'dinner'],
          totalServings: 8,
          assignments: [
            makeAssignment({ mealType: 'lunch', day: 0 }),
            makeAssignment({ mealType: 'dinner', day: 0 }),
          ],
          ingredients: [{ id: 'i1', name: 'Pasta', quantity: 1, unit: 'box' }],
        }),
      ],
    })
    expect(getMealTypePicked(plan, 'lunch')).toBe(1)
    expect(getMealTypePicked(plan, 'dinner')).toBe(1)
    expect(getShoppingList(plan)).toEqual([
      { key: 'pasta|box', name: 'Pasta', unit: 'box', quantity: 1 },
    ])
  })

  it('counts a cell shared by two combined entries as one pick, not two', () => {
    const shared = { personId: 'p1', day: 0, mealType: 'dinner' as const }
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', totalServings: 4, assignments: [makeAssignment(shared)] }),
        makeEntry({ id: 'e2', totalServings: 4, assignments: [makeAssignment(shared)] }),
      ],
    })
    expect(getMealTypePicked(plan, 'dinner')).toBe(1)
  })
})

describe('findCellAssignments', () => {
  it('finds the entry occupying a given (person, day, mealType) cell', () => {
    const assignment = makeAssignment({ personId: 'p1', day: 2, mealType: 'dinner' })
    const entry = makeEntry({ assignments: [assignment] })
    const plan = makePlan({ plannedMeals: [entry] })
    const found = findCellAssignments(plan, 'p1', 2, 'dinner')
    expect(found).toHaveLength(1)
    expect(found[0].entry.id).toBe(entry.id)
    expect(found[0].assignment.id).toBe(assignment.id)
  })

  it('returns an empty array for an empty cell', () => {
    const plan = makePlan({ plannedMeals: [makeEntry({ assignments: [] })] })
    expect(findCellAssignments(plan, 'p1', 2, 'dinner')).toEqual([])
  })

  it('returns every occupant sharing a combined cell', () => {
    const shared = { personId: 'p1', day: 2, mealType: 'dinner' as const }
    const plan = makePlan({
      plannedMeals: [
        makeEntry({ id: 'e1', assignments: [makeAssignment(shared)] }),
        makeEntry({ id: 'e2', assignments: [makeAssignment(shared)] }),
        makeEntry({ id: 'e3', assignments: [makeAssignment(shared)] }),
      ],
    })
    const found = findCellAssignments(plan, 'p1', 2, 'dinner')
    expect(found.map((o) => o.entry.id)).toEqual(['e1', 'e2', 'e3'])
  })
})

describe('getAssignmentFraction', () => {
  it('is always 1 for a single occupant, regardless of its weight', () => {
    const solo = makeAssignment({ weight: 5 })
    expect(getAssignmentFraction(solo, [solo])).toBe(1)
  })

  it('splits evenly among equal-weight co-occupants', () => {
    const a = makeAssignment({ id: 'a' })
    const b = makeAssignment({ id: 'b' })
    const c = makeAssignment({ id: 'c' })
    expect(getAssignmentFraction(a, [a, b, c])).toBeCloseTo(1 / 3)
    expect(getAssignmentFraction(b, [a, b, c])).toBeCloseTo(1 / 3)
  })

  it('skews shares according to relative weight', () => {
    const a = makeAssignment({ id: 'a', weight: 2 })
    const b = makeAssignment({ id: 'b', weight: 1 })
    expect(getAssignmentFraction(a, [a, b])).toBeCloseTo(2 / 3)
    expect(getAssignmentFraction(b, [a, b])).toBeCloseTo(1 / 3)
  })

  it('auto-rebalances the remaining occupants once one is removed', () => {
    const a = makeAssignment({ id: 'a' })
    const b = makeAssignment({ id: 'b' })
    const c = makeAssignment({ id: 'c' })
    expect(getAssignmentFraction(a, [a, b, c])).toBeCloseTo(1 / 3)
    // c removed from the cell — recomputing over the remaining two rebalances them to 1/2 each
    expect(getAssignmentFraction(a, [a, b])).toBeCloseTo(1 / 2)
    expect(getAssignmentFraction(b, [a, b])).toBeCloseTo(1 / 2)
  })
})

describe('getEntryConsumedServings', () => {
  it('matches plain assignment count when nothing is combined', () => {
    const entry = makeEntry({
      totalServings: 4,
      assignments: [
        makeAssignment({ day: 0 }),
        makeAssignment({ day: 1 }),
        makeAssignment({ day: 2 }),
      ],
    })
    const plan = makePlan({ plannedMeals: [entry] })
    expect(getEntryConsumedServings(plan, entry)).toBe(3)
  })

  it('counts only a fractional share when a cell is combined with another entry', () => {
    const shared = { personId: 'p1', day: 0, mealType: 'dinner' as const }
    const entry = makeEntry({ id: 'e1', totalServings: 4, assignments: [makeAssignment(shared)] })
    const other = makeEntry({ id: 'e2', totalServings: 4, assignments: [makeAssignment(shared)] })
    const plan = makePlan({ plannedMeals: [entry, other] })
    expect(getEntryConsumedServings(plan, entry)).toBeCloseTo(0.5)
  })

  it('seeds the sum with leftoverServingsUsed even with no assignments placed yet', () => {
    const entry = makeEntry({ totalServings: 6, leftoverServingsUsed: 3, assignments: [] })
    const plan = makePlan({ plannedMeals: [entry] })
    expect(getEntryConsumedServings(plan, entry)).toBe(3)
  })

  it('adds leftoverServingsUsed on top of real assignment placements', () => {
    const entry = makeEntry({
      totalServings: 6,
      leftoverServingsUsed: 3,
      assignments: [makeAssignment({ day: 0 }), makeAssignment({ day: 1 })],
    })
    const plan = makePlan({ plannedMeals: [entry] })
    expect(getEntryConsumedServings(plan, entry)).toBe(5)
  })
})

describe('isEntryFullyPlaced / formatServingCount', () => {
  it('treats a floating-point-close sum of thirds as fully placed', () => {
    const cellA = { personId: 'p1', day: 0, mealType: 'dinner' as const }
    const cellB = { personId: 'p1', day: 1, mealType: 'dinner' as const }
    const cellC = { personId: 'p1', day: 2, mealType: 'dinner' as const }
    // e1 has one assignment in each of 3 cells, each shared 3 ways (1/3 each),
    // so its own consumed sum is 1/3 + 1/3 + 1/3 — mathematically 1, but only
    // approximately 1 in floating point.
    const entry = makeEntry({
      id: 'e1',
      totalServings: 1,
      assignments: [makeAssignment(cellA), makeAssignment(cellB), makeAssignment(cellC)],
    })
    const filler1 = makeEntry({
      id: 'e2',
      totalServings: 4,
      assignments: [makeAssignment(cellA), makeAssignment(cellB), makeAssignment(cellC)],
    })
    const filler2 = makeEntry({
      id: 'e3',
      totalServings: 4,
      assignments: [makeAssignment(cellA), makeAssignment(cellB), makeAssignment(cellC)],
    })
    const plan = makePlan({ plannedMeals: [entry, filler1, filler2] })
    expect(isEntryFullyPlaced(plan, entry)).toBe(true)
  })

  it('formats fractional serving counts trimmed to 2 decimals with no trailing zeros', () => {
    expect(formatServingCount(2)).toBe('2')
    expect(formatServingCount(2.5)).toBe('2.5')
    expect(formatServingCount(1 / 3)).toBe('0.33')
  })
})

describe('canSetAssignmentWeight', () => {
  it('accepts an in-bounds reweight that keeps every sharing entry under capacity', () => {
    const shared = { personId: 'p1', day: 0, mealType: 'dinner' as const }
    const a = makeAssignment({ id: 'a', ...shared, weight: 1 })
    const b = makeAssignment({ id: 'b', ...shared, weight: 1 })
    const entryA = makeEntry({ id: 'e1', totalServings: 4, assignments: [a] })
    const entryB = makeEntry({ id: 'e2', totalServings: 4, assignments: [b] })
    const plan = makePlan({ plannedMeals: [entryA, entryB] })
    expect(canSetAssignmentWeight(plan, 'a', 2)).toBe(true)
  })

  it('rejects a reweight that would push a co-occupant entry over its totalServings', () => {
    const shared = { personId: 'p1', day: 0, mealType: 'dinner' as const }
    const a = makeAssignment({ id: 'a', ...shared, weight: 1 })
    const b = makeAssignment({ id: 'b', ...shared, weight: 1 })
    // entryB is already fully placed elsewhere too, so growing its share of this cell tips it over
    const entryA = makeEntry({ id: 'e1', totalServings: 4, assignments: [a] })
    const entryB = makeEntry({
      id: 'e2',
      totalServings: 1,
      assignments: [b, makeAssignment({ id: 'b2', personId: 'p2', day: 1, weight: 1 })],
    })
    const plan = makePlan({ plannedMeals: [entryA, entryB] })
    // shrinking a's weight grows b's derived share of the shared cell past what entryB can afford
    expect(canSetAssignmentWeight(plan, 'a', 0)).toBe(false)
  })
})

describe('canPlaceEntryInCell', () => {
  it('rejects when no entry is selected/dragging', () => {
    expect(canPlaceEntryInCell(undefined, 'dinner', [])).toBe(false)
  })

  it('rejects an entry not eligible for the target meal type', () => {
    const entry = makeEntry({ mealTypes: ['breakfast'] })
    expect(canPlaceEntryInCell(entry, 'dinner', [])).toBe(false)
  })

  it('rejects a cell already at MAX_CELL_OCCUPANTS', () => {
    const entry = makeEntry({ id: 'new-entry', mealTypes: ['dinner'] })
    const occupants = Array.from({ length: MAX_CELL_OCCUPANTS }, (_, i) =>
      makeEntry({ id: `occupant-${i}` }),
    ).map((occupant) => ({ entry: occupant }))
    expect(canPlaceEntryInCell(entry, 'dinner', occupants)).toBe(false)
  })

  it('rejects an entry already occupying the cell', () => {
    const entry = makeEntry({ id: 'e1', mealTypes: ['dinner'] })
    expect(canPlaceEntryInCell(entry, 'dinner', [{ entry }])).toBe(false)
  })

  it('accepts an eligible entry for a cell with room', () => {
    const entry = makeEntry({ id: 'e1', mealTypes: ['dinner'] })
    const other = makeEntry({ id: 'e2' })
    expect(canPlaceEntryInCell(entry, 'dinner', [{ entry: other }])).toBe(true)
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
            { id: 'i2', name: 'Beef', quantity: 1, unit: 'g' },
          ],
        }),
      ],
    })
    const list = getShoppingList(plan)
    expect(list.map((l) => l.name)).toEqual(['Beef', 'Tomatoes'])
  })

  it('ignores assignments entirely — ingredients count once regardless of placement', () => {
    const plan = makePlan({
      plannedMeals: [
        makeEntry({
          totalServings: 8,
          assignments: [
            makeAssignment({ mealType: 'dinner', day: 0 }),
            makeAssignment({ mealType: 'dinner', day: 1 }),
          ],
          ingredients: [{ id: 'i1', name: 'Beef', quantity: 2, unit: 'lb' }],
        }),
      ],
    })
    expect(getShoppingList(plan)).toEqual([{ key: 'beef|lb', name: 'Beef', unit: 'lb', quantity: 2 }])
  })
})
