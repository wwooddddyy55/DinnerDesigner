import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSeedMeals } from '../data/seedMeals'
import { CAPACITY_EPSILON, canSetAssignmentWeight, findCellAssignments, getEntryConsumedServings } from '../lib/calculations'
import { generateId } from '../lib/id'
import { CURRENT_SCHEMA_VERSION, migratePerson, migratePlannedMealEntry, normalizeAppData } from '../lib/migrations'
import type { Meal, MealAssignment, MealType, Person, PlannedMealEntry, WeeklyPlan } from '../types'
import { DAYS_PER_WEEK, MAX_ASSIGNMENT_WEIGHT, MAX_CELL_OCCUPANTS, MIN_ASSIGNMENT_WEIGHT } from '../types'

interface AppState {
  meals: Meal[]
  plans: WeeklyPlan[]
  activePlanId: string | null
  hasSeededMeals: boolean

  seedMealsIfNeeded: () => void

  addMeal: (meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateMeal: (meal: Meal) => void
  deleteMeal: (id: string) => void

  startNewWeek: (weekStartDate: string, copyFromPlanId?: string) => string
  setActivePlan: (id: string) => void
  deletePlan: (id: string) => void
  setPlanMealTypes: (planId: string, types: MealType[]) => void

  addPerson: (planId: string, name: string) => void
  updatePerson: (planId: string, person: Person) => void
  removePerson: (planId: string, personId: string) => void

  setPersonAvailability: (
    planId: string,
    personId: string,
    mealType: MealType,
    day: number,
    available: boolean,
  ) => void

  addPlannedMeal: (planId: string, meal: Meal) => void
  removePlannedMeal: (planId: string, entryId: string) => void
  setEntryLeftover: (planId: string, entryId: string, isLeftover: boolean) => void
  setEntryServingsLeft: (planId: string, entryId: string, servingsLeft: number) => void
  assignMealToCell: (
    planId: string,
    entryId: string,
    personId: string,
    mealType: MealType,
    day: number,
  ) => void
  clearAssignment: (planId: string, entryId: string, assignmentId: string) => void
  setAssignmentWeight: (planId: string, entryId: string, assignmentId: string, weight: number) => void

  replaceAllData: (data: { meals: Meal[]; plans: WeeklyPlan[] }) => void
}

function touchPlan(plan: WeeklyPlan): WeeklyPlan {
  return { ...plan, updatedAt: new Date().toISOString() }
}

// Re-exported for existing callers; the implementations live in lib/migrations.ts
// so lib code (sync, import) doesn't depend on store internals.
export { migratePerson, migratePlannedMealEntry }

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      meals: [],
      plans: [],
      activePlanId: null,
      hasSeededMeals: false,

      seedMealsIfNeeded: () => {
        const { meals, hasSeededMeals } = get()
        if (meals.length === 0 && !hasSeededMeals) {
          set({ meals: createSeedMeals(), hasSeededMeals: true })
        }
      },

      addMeal: (meal) => {
        const now = new Date().toISOString()
        const newMeal: Meal = { ...meal, id: generateId(), createdAt: now, updatedAt: now }
        set((state) => ({ meals: [...state.meals, newMeal] }))
      },

      updateMeal: (meal) => {
        set((state) => ({
          meals: state.meals.map((m) =>
            m.id === meal.id ? { ...meal, updatedAt: new Date().toISOString() } : m,
          ),
        }))
      },

      deleteMeal: (id) => {
        set((state) => ({ meals: state.meals.filter((m) => m.id !== id) }))
      },

      startNewWeek: (weekStartDate, copyFromPlanId) => {
        const now = new Date().toISOString()
        const sourcePlan = copyFromPlanId
          ? get().plans.find((p) => p.id === copyFromPlanId)
          : undefined

        const newPlan: WeeklyPlan = {
          id: generateId(),
          weekStartDate,
          selectedMealTypes: [],
          people: sourcePlan
            ? sourcePlan.people.map((p) => ({ ...p, id: generateId() }))
            : [],
          plannedMeals: [],
          createdAt: now,
          updatedAt: now,
        }

        set((state) => ({
          plans: [...state.plans, newPlan],
          activePlanId: newPlan.id,
        }))

        return newPlan.id
      },

      setActivePlan: (id) => set({ activePlanId: id }),

      deletePlan: (id) => {
        set((state) => ({
          plans: state.plans.filter((p) => p.id !== id),
          activePlanId: state.activePlanId === id ? null : state.activePlanId,
        }))
      },

      setPlanMealTypes: (planId, types) => {
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId ? touchPlan({ ...plan, selectedMealTypes: types }) : plan,
          ),
        }))
      },

      addPerson: (planId, name) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            const person: Person = { id: generateId(), name, availability: {} }
            return touchPlan({ ...plan, people: [...plan.people, person] })
          }),
        }))
      },

      updatePerson: (planId, person) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            return touchPlan({
              ...plan,
              people: plan.people.map((p) => (p.id === person.id ? person : p)),
            })
          }),
        }))
      },

      removePerson: (planId, personId) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            return touchPlan({
              ...plan,
              people: plan.people.filter((p) => p.id !== personId),
              plannedMeals: plan.plannedMeals.map((entry) => ({
                ...entry,
                assignments: entry.assignments.filter((a) => a.personId !== personId),
              })),
            })
          }),
        }))
      },

      setPersonAvailability: (planId, personId, mealType, day, available) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            return touchPlan({
              ...plan,
              people: plan.people.map((person) => {
                if (person.id !== personId) return person
                const days = person.availability[mealType] ?? Array(DAYS_PER_WEEK).fill(true)
                const next = [...days]
                next[day] = available
                return { ...person, availability: { ...person.availability, [mealType]: next } }
              }),
            })
          }),
        }))
      },

      addPlannedMeal: (planId, meal) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan

            // A meal eligible for lunch or dinner in the library can always be split
            // as leftovers between the two once a plan is tracking both — even if the
            // library only tagged it as one of them — since either can be cooked once
            // and eaten as the other's leftovers.
            const bothLunchAndDinner =
              plan.selectedMealTypes.includes('lunch') && plan.selectedMealTypes.includes('dinner')
            const mealTypes: MealType[] =
              bothLunchAndDinner && (meal.mealTypes.includes('lunch') || meal.mealTypes.includes('dinner'))
                ? Array.from(new Set([...meal.mealTypes, 'lunch', 'dinner']))
                : [...meal.mealTypes]

            const entry: PlannedMealEntry = {
              id: generateId(),
              mealId: meal.id,
              mealTypes,
              totalServings: meal.servingsPerBatch,
              assignments: [],
              name: meal.name,
              protein: meal.protein,
              proteinCustomLabel: meal.proteinCustomLabel,
              ingredients: meal.ingredients.map((i) => ({ ...i })),
            }
            return touchPlan({ ...plan, plannedMeals: [...plan.plannedMeals, entry] })
          }),
        }))
      },

      removePlannedMeal: (planId, entryId) => {
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? touchPlan({
                  ...plan,
                  plannedMeals: plan.plannedMeals.filter((e) => e.id !== entryId),
                })
              : plan,
          ),
        }))
      },

      /** Toggling on preserves any previously-entered `leftoverServingsUsed`
       * (in case the user toggles back on after a mis-click); toggling off
       * resets it to 0, restoring the entry to a fresh, fully-available batch. */
      setEntryLeftover: (planId, entryId, isLeftover) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            return touchPlan({
              ...plan,
              plannedMeals: plan.plannedMeals.map((e) =>
                e.id === entryId
                  ? { ...e, isLeftover, leftoverServingsUsed: isLeftover ? (e.leftoverServingsUsed ?? 0) : 0 }
                  : e,
              ),
            })
          }),
        }))
      },

      /** Sets how many of an entry's `totalServings` are still left to place
       * this week (the user-facing framing), stored internally as the
       * complementary `leftoverServingsUsed` baseline. Clamped so it can
       * never drop below servings already placed on the grid this week (that
       * would violate the capacity invariant) nor exceed `totalServings`. */
      setEntryServingsLeft: (planId, entryId, servingsLeft) => {
        set((state) => {
          const plan = state.plans.find((p) => p.id === planId)
          if (!plan) return state
          const entry = plan.plannedMeals.find((e) => e.id === entryId)
          if (!entry) return state

          const realConsumed = getEntryConsumedServings(plan, entry) - (entry.leftoverServingsUsed ?? 0)
          const clampedLeft = Math.max(realConsumed, Math.min(entry.totalServings, servingsLeft))
          const leftoverServingsUsed = entry.totalServings - clampedLeft

          return {
            plans: state.plans.map((p) =>
              p.id !== planId
                ? p
                : touchPlan({
                    ...p,
                    plannedMeals: p.plannedMeals.map((e) => (e.id === entryId ? { ...e, leftoverServingsUsed } : e)),
                  }),
            ),
          }
        })
      },

      assignMealToCell: (planId, entryId, personId, mealType, day) => {
        set((state) => {
          const plan = state.plans.find((p) => p.id === planId)
          if (!plan) return state

          const entry = plan.plannedMeals.find((e) => e.id === entryId)
          const person = plan.people.find((p) => p.id === personId)
          if (!entry || !person) return state
          if (!entry.mealTypes.includes(mealType)) return state

          const availability = person.availability[mealType]
          if (availability && availability[day] === false) return state

          const occupants = findCellAssignments(plan, personId, day, mealType)
          if (occupants.length >= MAX_CELL_OCCUPANTS) return state
          if (occupants.some((o) => o.entry.id === entryId)) return state

          const existingWeightSum = occupants.reduce((sum, o) => sum + o.assignment.weight, 0)
          const newFraction = 1 / (existingWeightSum + 1)
          const alreadyConsumed = getEntryConsumedServings(plan, entry)
          if (alreadyConsumed + newFraction > entry.totalServings + CAPACITY_EPSILON) return state

          const assignment: MealAssignment = { id: generateId(), personId, mealType, day, weight: 1 }
          return {
            plans: state.plans.map((p) =>
              p.id !== planId
                ? p
                : touchPlan({
                    ...p,
                    plannedMeals: p.plannedMeals.map((e) =>
                      e.id === entryId ? { ...e, assignments: [...e.assignments, assignment] } : e,
                    ),
                  }),
            ),
          }
        })
      },

      clearAssignment: (planId, entryId, assignmentId) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            return touchPlan({
              ...plan,
              plannedMeals: plan.plannedMeals.map((entry) =>
                entry.id === entryId
                  ? { ...entry, assignments: entry.assignments.filter((a) => a.id !== assignmentId) }
                  : entry,
              ),
            })
          }),
        }))
      },

      setAssignmentWeight: (planId, entryId, assignmentId, weight) => {
        set((state) => {
          const plan = state.plans.find((p) => p.id === planId)
          if (!plan) return state
          const clamped = Math.max(MIN_ASSIGNMENT_WEIGHT, Math.min(MAX_ASSIGNMENT_WEIGHT, Math.round(weight)))
          if (!canSetAssignmentWeight(plan, assignmentId, clamped)) return state

          return {
            plans: state.plans.map((p) =>
              p.id !== planId
                ? p
                : touchPlan({
                    ...p,
                    plannedMeals: p.plannedMeals.map((e) =>
                      e.id === entryId
                        ? {
                            ...e,
                            assignments: e.assignments.map((a) =>
                              a.id === assignmentId ? { ...a, weight: clamped } : a,
                            ),
                          }
                        : e,
                    ),
                  }),
            ),
          }
        })
      },

      replaceAllData: ({ meals, plans }) => {
        set({ meals, plans, activePlanId: null, hasSeededMeals: true })
      },
    }),
    {
      name: 'dinner-designer-storage',
      version: CURRENT_SCHEMA_VERSION,
      migrate: (persistedState) => {
        const state = (persistedState ?? {}) as Record<string, unknown>
        const { meals, plans } = normalizeAppData(state)
        state.meals = meals
        state.plans = plans
        return state as unknown as AppState
      },
    },
  ),
)
