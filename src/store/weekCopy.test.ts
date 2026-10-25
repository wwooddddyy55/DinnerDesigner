import { beforeEach, describe, expect, it } from 'vitest'
import type { Meal } from '../types'
import { useAppStore } from './useAppStore'

const meal: Meal = {
  id: 'meal-1',
  name: 'Lasagna',
  mealTypes: ['dinner'],
  protein: 'Beef',
  servingsPerBatch: 8,
  ingredients: [{ id: 'i1', name: 'Pasta', quantity: 1, unit: 'box' }],
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

/** A source week: one person, dinner tracked, one lasagna placed on day 2,
 * marked as a carry-over so we can check copies start fresh. */
function seedSourceWeek(): string {
  const store = useAppStore.getState()
  const planId = store.startNewWeek('2026-05-04')
  store.setPlanMealTypes(planId, ['dinner'])
  const personId = store.addPerson(planId, 'Alex')
  store.addPlannedMeal(planId, meal)
  const entryId = useAppStore.getState().plans[0].plannedMeals[0].id
  store.assignMealToCell(planId, entryId, personId, 'dinner', 2)
  store.setEntryLeftover(planId, entryId, true)
  return planId
}

beforeEach(() => {
  useAppStore.setState({ meals: [meal], plans: [], activePlanId: null, hasSeededMeals: true })
})

describe('startNewWeek copying', () => {
  it('copies people and meal types, but not meals, by default', () => {
    const sourceId = seedSourceWeek()
    const newId = useAppStore.getState().startNewWeek('2026-05-11', sourceId)
    const plan = useAppStore.getState().plans.find((p) => p.id === newId)!
    expect(plan.selectedMealTypes).toEqual(['dinner'])
    expect(plan.people.map((p) => p.name)).toEqual(['Alex'])
    expect(plan.plannedMeals).toEqual([])
    expect(useAppStore.getState().activePlanId).toBe(newId)
  })

  it('copies meals as fresh, unplaced batches', () => {
    const sourceId = seedSourceWeek()
    const newId = useAppStore.getState().startNewWeek('2026-05-11', sourceId, { copyMeals: true })
    const [source, copy] = useAppStore.getState().plans
    expect(copy.id).toBe(newId)
    expect(copy.plannedMeals).toHaveLength(1)
    const entry = copy.plannedMeals[0]
    expect(entry.id).not.toBe(source.plannedMeals[0].id)
    expect(entry.assignments).toEqual([])
    expect(entry.isLeftover).toBeUndefined()
    expect(entry.leftoverServingsUsed).toBeUndefined()
  })

  it('remaps copied placements onto the copied people', () => {
    const sourceId = seedSourceWeek()
    useAppStore.getState().startNewWeek('2026-05-11', sourceId, { copyMeals: true, copyPlacements: true })
    const copy = useAppStore.getState().plans[1]
    const [assignment] = copy.plannedMeals[0].assignments
    expect(assignment.personId).toBe(copy.people[0].id)
    expect(assignment.day).toBe(2)
    expect(assignment.id).not.toBe(useAppStore.getState().plans[0].plannedMeals[0].assignments[0].id)
  })

  it('starts empty without a source week', () => {
    const newId = useAppStore.getState().startNewWeek('2026-05-11')
    const plan = useAppStore.getState().plans.find((p) => p.id === newId)!
    expect(plan.selectedMealTypes).toEqual([])
    expect(plan.people).toEqual([])
  })
})

describe('restorePlan', () => {
  it('re-adds a deleted plan and can make it active again', () => {
    const planId = seedSourceWeek()
    const snapshot = useAppStore.getState().plans[0]
    useAppStore.getState().deletePlan(planId)
    expect(useAppStore.getState().plans).toEqual([])
    useAppStore.getState().restorePlan(snapshot, true)
    const restored = useAppStore.getState().plans[0]
    expect(restored.id).toBe(planId)
    expect(restored.plannedMeals).toEqual(snapshot.plannedMeals)
    expect(useAppStore.getState().activePlanId).toBe(planId)
  })
})
