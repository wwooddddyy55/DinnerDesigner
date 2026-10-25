import { isDeepEqual } from './equal'
import { generateId } from './id'
import { toSafeHttpUrl } from './url'
import {
  DAYS_PER_WEEK,
  MAX_ASSIGNMENT_WEIGHT,
  MEAL_TYPES,
  MIN_ASSIGNMENT_WEIGHT,
  PROTEIN_TYPES,
  stapleKey,
} from '../types'
import type {
  AppData,
  Ingredient,
  Meal,
  MealAssignment,
  MealType,
  Person,
  PlannedMealEntry,
  ProteinType,
  Staple,
  WeeklyPlan,
} from '../types'

/** Version of the persisted data shape. Shared by the localStorage persist
 * config, the sync payload, and JSON export, so all three agree on what
 * "current" means. Bump it (and extend `normalizeAppData`) for any shape
 * change. 5: household `staples`. */
export const CURRENT_SCHEMA_VERSION = 5

/** Converts a pre-day-planner Person (numeric `servingsPerMealType`) into
 * the current `availability` shape. For each meal type the person had an
 * explicit weekly count for, marks that many of the first N days (relative to
 * the plan's `weekStartDate`, capped at 7) available — an arbitrary but
 * deterministic reconstruction that preserves the aggregate weekly target
 * exactly, even though the specific days are a guess. A meal type the person
 * never had a count for is left absent so it falls back to the same "all 7
 * days available" default a brand-new person gets. No-ops on already-current
 * data. */
export function migratePerson(person: any): Person {
  if (person.availability) return person as Person
  const availability: Partial<Record<MealType, boolean[]>> = {}
  for (const [type, count] of Object.entries(person.servingsPerMealType ?? {})) {
    const n = Math.max(0, Math.min(Number(count) || 0, DAYS_PER_WEEK))
    availability[type as MealType] = Array.from({ length: DAYS_PER_WEEK }, (_, i) => i < n)
  }
  const { servingsPerMealType: _servingsPerMealType, ...rest } = person
  return { ...rest, availability }
}

/** Converts an older-shape PlannedMealEntry into the current shape. Handles
 * both the pre-leftovers-feature shape (single `mealType` + `servingsPerBatch`)
 * and the pre-day-planner shape (`servingsByType`) — neither carries
 * person/day information, so both collapse to an empty `assignments: []`;
 * previously-picked meals become fully unplaced and must be re-dragged onto
 * the day grid. Also backfills `weight: 1` onto any assignment missing it
 * (pre-combined-slots data), idempotently. */
export function migratePlannedMealEntry(entry: any, meals: Meal[]): PlannedMealEntry {
  if (entry.assignments) {
    return {
      ...entry,
      assignments: entry.assignments.map((a: any) => ({ weight: 1, ...a })),
    } as PlannedMealEntry
  }
  if (entry.servingsByType) {
    const { servingsByType: _servingsByType, ...rest } = entry
    return { ...rest, assignments: [] }
  }
  const meal = meals.find((m) => m.id === entry.mealId)
  const mealTypes: MealType[] = meal?.mealTypes ?? [entry.mealType]
  const totalServings: number = entry.servingsPerBatch ?? 0
  const { mealType: _mealType, servingsPerBatch: _servingsPerBatch, ...rest } = entry
  return { ...rest, mealTypes, totalServings, assignments: [] }
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as string[]).includes(value)
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function normalizeMealTypes(value: unknown): MealType[] {
  return Array.isArray(value) ? Array.from(new Set(value.filter(isMealType))) : []
}

function normalizeProtein(value: unknown): ProteinType {
  return typeof value === 'string' && (PROTEIN_TYPES as string[]).includes(value) ? (value as ProteinType) : 'Other'
}

function normalizeIngredients(value: unknown): Ingredient[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map((raw) => ({
    id: asString(raw.id) || generateId(),
    name: asString(raw.name),
    quantity: asFiniteNumber(raw.quantity, 0),
    unit: asString(raw.unit),
  }))
}

/** Returns `value` unchanged when it's already structurally identical to
 * `normalized` — keeps object identity for untouched records, which the sync
 * merge (`lib/sync.ts`) relies on as a cheap "unchanged" check. */
function keepIfSame<T>(value: unknown, normalized: T): T {
  return isDeepEqual(value, normalized) ? (value as T) : normalized
}

export function normalizeMeal(raw: unknown): Meal | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') return null
  const now = new Date().toISOString()
  const meal: Meal = {
    id: raw.id,
    name: raw.name,
    mealTypes: normalizeMealTypes(raw.mealTypes),
    protein: normalizeProtein(raw.protein),
    servingsPerBatch: Math.max(1, asFiniteNumber(raw.servingsPerBatch, 1)),
    ingredients: normalizeIngredients(raw.ingredients),
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
  }
  if (typeof raw.proteinCustomLabel === 'string') meal.proteinCustomLabel = raw.proteinCustomLabel
  if (typeof raw.notes === 'string') meal.notes = raw.notes
  const sourceUrl = toSafeHttpUrl(raw.sourceUrl)
  if (sourceUrl) meal.sourceUrl = sourceUrl
  return keepIfSame(raw, meal)
}

function normalizePerson(raw: unknown): Person | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const migrated = migratePerson(raw)
  const availability: Partial<Record<MealType, boolean[]>> = {}
  if (isObject(migrated.availability)) {
    for (const type of MEAL_TYPES) {
      const days = migrated.availability[type]
      if (Array.isArray(days) && days.length === DAYS_PER_WEEK && days.every((d) => typeof d === 'boolean')) {
        availability[type] = days
      }
    }
  }
  return { id: migrated.id, name: asString(migrated.name), availability }
}

function normalizeAssignment(raw: unknown, personIds: Set<string>): MealAssignment | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !personIds.has(raw.personId)) return null
  if (!isMealType(raw.mealType)) return null
  const day = raw.day
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 0 || day >= DAYS_PER_WEEK) return null
  const weight = Math.round(asFiniteNumber(raw.weight, 1))
  return {
    id: raw.id,
    personId: raw.personId,
    mealType: raw.mealType,
    day,
    weight: Math.max(MIN_ASSIGNMENT_WEIGHT, Math.min(MAX_ASSIGNMENT_WEIGHT, weight)),
  }
}

function normalizeEntry(raw: unknown, meals: Meal[], personIds: Set<string>): PlannedMealEntry | null {
  if (!isObject(raw) || typeof raw.id !== 'string') return null
  const migrated = migratePlannedMealEntry(raw, meals)
  const totalServings = Math.max(0, asFiniteNumber(migrated.totalServings, 0))
  const entry: PlannedMealEntry = {
    id: migrated.id,
    mealId: asString(migrated.mealId),
    mealTypes: normalizeMealTypes(migrated.mealTypes),
    totalServings,
    assignments: (Array.isArray(migrated.assignments) ? migrated.assignments : [])
      .map((a) => normalizeAssignment(a, personIds))
      .filter((a): a is MealAssignment => a !== null),
    name: asString(migrated.name),
    protein: normalizeProtein(migrated.protein),
    ingredients: normalizeIngredients(migrated.ingredients),
  }
  if (typeof migrated.proteinCustomLabel === 'string') entry.proteinCustomLabel = migrated.proteinCustomLabel
  if (typeof migrated.isLeftover === 'boolean') entry.isLeftover = migrated.isLeftover
  if (migrated.leftoverServingsUsed !== undefined) {
    entry.leftoverServingsUsed = Math.max(0, Math.min(totalServings, asFiniteNumber(migrated.leftoverServingsUsed, 0)))
  }
  return entry
}

export function normalizePlan(raw: unknown, meals: Meal[]): WeeklyPlan | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || typeof raw.weekStartDate !== 'string') return null
  const people = (Array.isArray(raw.people) ? raw.people : [])
    .map(normalizePerson)
    .filter((p): p is Person => p !== null)
  const personIds = new Set(people.map((p) => p.id))
  const now = new Date().toISOString()
  const plan: WeeklyPlan = {
    id: raw.id,
    weekStartDate: raw.weekStartDate,
    selectedMealTypes: normalizeMealTypes(raw.selectedMealTypes),
    people,
    plannedMeals: (Array.isArray(raw.plannedMeals) ? raw.plannedMeals : [])
      .map((e) => normalizeEntry(e, meals, personIds))
      .filter((e): e is PlannedMealEntry => e !== null),
    createdAt: asString(raw.createdAt, now),
    updatedAt: asString(raw.updatedAt, now),
  }
  return keepIfSame(raw, plan)
}

/** Keeps staples with a usable name, re-deriving `id` from it so ids always
 * match `stapleKey`, and drops repeats of the same name (first one wins). */
function normalizeStaples(value: unknown): Staple[] {
  if (!Array.isArray(value)) return []
  const now = new Date().toISOString()
  const seen = new Set<string>()
  const staples: Staple[] = []
  for (const raw of value) {
    if (!isObject(raw) || typeof raw.name !== 'string') continue
    const id = stapleKey(raw.name)
    if (id.length === 0 || seen.has(id)) continue
    seen.add(id)
    staples.push(keepIfSame(raw, { id, name: raw.name.trim(), updatedAt: asString(raw.updatedAt, now) }))
  }
  return staples
}

/** The single entry point for turning untrusted/old-shape data — localStorage
 * from an older build, a JSON import file, or the shared server state (which
 * anyone reaching the add-on can write) — into current-shape `meals`/`plans`/
 * `staples`. Migrates old shapes (data from before staples existed gets none),
 * drops records too broken to use (no id, wrong type), repairs individual bad
 * fields to safe defaults, strips non-http(s) recipe links, and removes
 * assignments pointing at people that don't exist. Idempotent: running it on
 * already-current data returns equal data (and the same object references
 * for records that needed no change). */
export function normalizeAppData(data: { meals?: unknown; plans?: unknown; staples?: unknown }): AppData {
  const meals = (Array.isArray(data.meals) ? data.meals : [])
    .map(normalizeMeal)
    .filter((m): m is Meal => m !== null)
  const plans = (Array.isArray(data.plans) ? data.plans : [])
    .map((p) => normalizePlan(p, meals))
    .filter((p): p is WeeklyPlan => p !== null)
  return { meals, plans, staples: normalizeStaples(data.staples) }
}
