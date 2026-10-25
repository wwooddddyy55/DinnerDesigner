import { generateId } from './id'
import { toSafeHttpUrl } from './url'
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
  const parsed = parseJson(text)
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error('Expected a single JSON object describing one meal.')
  }
  return parseMealObject(parsed as Record<string, unknown>)
}

/** Like `parseMealDraft`, but also accepts a JSON array of meal objects (the
 * import prompt asks for one when several recipes are pasted at once). An
 * error in any meal names its 1-based position so the user can find it. */
export function parseMealDrafts(text: string): MealDraft[] {
  const parsed = parseJson(text)
  if (!Array.isArray(parsed)) {
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Expected a JSON object describing one meal, or an array of them.')
    }
    return [parseMealObject(parsed as Record<string, unknown>)]
  }
  if (parsed.length === 0) throw new Error('That array has no meals in it.')
  return parsed.map((item, index) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error(`Meal ${index + 1}: expected a JSON object.`)
    }
    try {
      return parseMealObject(item as Record<string, unknown>)
    } catch (err) {
      throw new Error(`Meal ${index + 1}: ${err instanceof Error ? err.message : String(err)}`)
    }
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    throw new Error('That doesn\'t look like valid JSON.')
  }
}

function parseMealObject(raw: Record<string, unknown>): MealDraft {

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
  // Only http(s) links survive; anything else (javascript:, data:, junk) is
  // dropped rather than failing the whole import over an optional field.
  const sourceUrl = toSafeHttpUrl(raw.sourceUrl)
  if (sourceUrl) {
    draft.sourceUrl = sourceUrl
  }

  return draft
}

export const MEAL_IMPORT_PROMPT_TEMPLATE = `Here's a recipe [link or pasted text]. Extract it into this exact JSON shape and reply with ONLY the JSON, no other text. If I give you more than one recipe, reply with a JSON array containing one of these objects per recipe:

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
