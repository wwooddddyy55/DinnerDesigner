import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSeedMeals } from '../data/seedMeals'
import { generateId } from '../lib/id'
import type { Meal, MealType, Person, PlannedMealEntry, WeeklyPlan } from '../types'
import { DEFAULT_SERVINGS_PER_WEEK } from '../types'

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

  addPlannedMeal: (planId: string, mealType: MealType, meal: Meal) => void
  removePlannedMeal: (planId: string, entryId: string) => void

  replaceAllData: (data: { meals: Meal[]; plans: WeeklyPlan[] }) => void
}

function touchPlan(plan: WeeklyPlan): WeeklyPlan {
  return { ...plan, updatedAt: new Date().toISOString() }
}

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
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            const people = plan.people.map((person) => {
              const servingsPerMealType = { ...person.servingsPerMealType }
              for (const type of types) {
                if (servingsPerMealType[type] === undefined) {
                  servingsPerMealType[type] = DEFAULT_SERVINGS_PER_WEEK
                }
              }
              return { ...person, servingsPerMealType }
            })
            return touchPlan({ ...plan, selectedMealTypes: types, people })
          }),
        }))
      },

      addPerson: (planId, name) => {
        set((state) => ({
          plans: state.plans.map((plan) => {
            if (plan.id !== planId) return plan
            const servingsPerMealType: Partial<Record<MealType, number>> = {}
            for (const type of plan.selectedMealTypes) {
              servingsPerMealType[type] = DEFAULT_SERVINGS_PER_WEEK
            }
            const person: Person = { id: generateId(), name, servingsPerMealType }
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
            return touchPlan({ ...plan, people: plan.people.filter((p) => p.id !== personId) })
          }),
        }))
      },

      addPlannedMeal: (planId, mealType, meal) => {
        const entry: PlannedMealEntry = {
          id: generateId(),
          mealId: meal.id,
          mealType,
          name: meal.name,
          protein: meal.protein,
          proteinCustomLabel: meal.proteinCustomLabel,
          servingsPerBatch: meal.servingsPerBatch,
          ingredients: meal.ingredients.map((i) => ({ ...i })),
        }
        set((state) => ({
          plans: state.plans.map((plan) =>
            plan.id === planId
              ? touchPlan({ ...plan, plannedMeals: [...plan.plannedMeals, entry] })
              : plan,
          ),
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

      replaceAllData: ({ meals, plans }) => {
        set({ meals, plans, activePlanId: null, hasSeededMeals: true })
      },
    }),
    { name: 'dinner-designer-storage', version: 1 },
  ),
)
