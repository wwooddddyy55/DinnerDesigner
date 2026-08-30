import { generateId } from './id'
import { MEAL_TYPES, PROTEIN_TYPES } from '../types'
import type { Ingredient, Meal, MealType, ProteinType } from '../types'

export type MealDraft = Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>

function isMealType(value: unknown): value is MealType {
  return typeof value === 'string' && (MEAL_TYPES as string[]).includes(value)
}

function isProteinType(value: unknown): value is ProteinType {
  return typeof value === 'string' && (PROTEIN_TYPES as string[]).includes(value)
}

/** Parses a single-meal JSON draft (e.g. produced by pasting a recipe into an LLM chat
 * using the app's import prompt template) into a `MealDraft` ready for `MealForm`/`addMeal`.
 * Throws a descriptive `Error` for any structural problem so the UI can show it inline. */
export function parseMealDraft(text: string): MealDraft {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('That doesn\'t look like valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Expected a single JSON object describing one meal.')
  }
  const raw = parsed as Record<string, unknown>

  if (typeof raw.name !== 'string' || raw.name.trim().length === 0) {
    throw new Error('Missing or invalid "name".')
  }

  if (!Array.isArray(raw.mealTypes) || raw.mealTypes.length === 0 || !raw.mealTypes.every(isMealType)) {
    throw new Error(`"mealTypes" must be a non-empty array of: ${MEAL_TYPES.join(', ')}.`)
  }

  if (!isProteinType(raw.protein)) {
    throw new Error(`"protein" must be one of: ${PROTEIN_TYPES.join(', ')}.`)
  }

  const servingsPerBatch = raw.servingsPerBatch
  if (typeof servingsPerBatch !== 'number' || !Number.isFinite(servingsPerBatch) || servingsPerBatch <= 0) {
    throw new Error('"servingsPerBatch" must be a positive number.')
  }

  let ingredients: Ingredient[] = []
  if (raw.ingredients !== undefined) {
    if (!Array.isArray(raw.ingredients)) {
      throw new Error('"ingredients" must be an array.')
    }
    ingredients = raw.ingredients.map((item, index) => {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Ingredient at index ${index} must be an object.`)
      }
      const ing = item as Record<string, unknown>
      if (typeof ing.name !== 'string' || ing.name.trim().length === 0) {
        throw new Error(`Ingredient at index ${index} is missing a "name".`)
      }
      if (typeof ing.quantity !== 'number' || !Number.isFinite(ing.quantity)) {
        throw new Error(`Ingredient "${ing.name}" is missing a numeric "quantity".`)
      }
      if (typeof ing.unit !== 'string') {
        throw new Error(`Ingredient "${ing.name}" is missing a "unit".`)
      }
      return {
        id: generateId(),
        name: ing.name.trim(),
        quantity: ing.quantity,
        unit: ing.unit.trim(),
      }
    })
  }

  const draft: MealDraft = {
    name: raw.name.trim(),
    mealTypes: raw.mealTypes,
    protein: raw.protein,
    servingsPerBatch,
    ingredients,
  }

  if (raw.protein === 'Other' && typeof raw.proteinCustomLabel === 'string') {
    draft.proteinCustomLabel = raw.proteinCustomLabel.trim()
  }
  if (typeof raw.notes === 'string' && raw.notes.trim().length > 0) {
    draft.notes = raw.notes.trim()
  }
  if (typeof raw.sourceUrl === 'string' && raw.sourceUrl.trim().length > 0) {
    draft.sourceUrl = raw.sourceUrl.trim()
  }

  return draft
}

export const MEAL_IMPORT_PROMPT_TEMPLATE = `Here's a recipe [link or pasted text]. Extract it into this exact JSON shape and reply with ONLY the JSON, no other text:

{
  "name": string,
  "mealTypes": array of any of "breakfast" | "lunch" | "dinner",
  "protein": one of "Beef" | "Chicken" | "Pork" | "Fish" | "Vegetarian" | "Other",
  "proteinCustomLabel": string (only include if protein is "Other"),
  "servingsPerBatch": number (use the recipe's stated serving size),
  "ingredients": [ { "name": string, "quantity": number, "unit": string }, ... ],
  "sourceUrl": string (the original recipe URL, if you were given one),
  "notes": string (brief tips only, optional — don't retype the full cooking steps, that's what sourceUrl is for)
}

Recipe:
<url or pasted text>`
