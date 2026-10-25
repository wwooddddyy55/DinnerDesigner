import { describe, expect, it } from 'vitest'
import { parseMealDraft, parseMealDrafts } from './mealImport'

function validDraftJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    name: 'Lemongrass Pork Tacos',
    mealTypes: ['dinner'],
    protein: 'Pork',
    servingsPerBatch: 2,
    ingredients: [{ name: 'Pork mince', quantity: 300, unit: 'g' }],
    sourceUrl: 'https://www.hellofresh.com.au/recipes/example',
    notes: 'Char the tortillas for extra flavor.',
    ...overrides,
  })
}

describe('parseMealDraft', () => {
  it('parses a well-formed draft, generating ingredient ids', () => {
    const draft = parseMealDraft(validDraftJson())
    expect(draft.name).toBe('Lemongrass Pork Tacos')
    expect(draft.mealTypes).toEqual(['dinner'])
    expect(draft.protein).toBe('Pork')
    expect(draft.servingsPerBatch).toBe(2)
    expect(draft.sourceUrl).toBe('https://www.hellofresh.com.au/recipes/example')
    expect(draft.ingredients).toHaveLength(1)
    expect(draft.ingredients[0].id).toBeTruthy()
    expect(draft.ingredients[0].name).toBe('Pork mince')
  })

  it('omits optional fields when absent', () => {
    const draft = parseMealDraft(
      JSON.stringify({
        name: 'Simple Bowl',
        mealTypes: ['lunch'],
        protein: 'Vegetarian',
        servingsPerBatch: 4,
      }),
    )
    expect(draft.sourceUrl).toBeUndefined()
    expect(draft.notes).toBeUndefined()
    expect(draft.ingredients).toEqual([])
  })

  it('throws on invalid JSON', () => {
    expect(() => parseMealDraft('not json')).toThrow('valid JSON')
  })

  it('throws on missing name', () => {
    expect(() => parseMealDraft(validDraftJson({ name: '' }))).toThrow('name')
  })

  it('throws on invalid mealTypes', () => {
    expect(() => parseMealDraft(validDraftJson({ mealTypes: ['brunch'] }))).toThrow('mealTypes')
  })

  it('throws on invalid protein', () => {
    expect(() => parseMealDraft(validDraftJson({ protein: 'Tofu' }))).toThrow('protein')
  })

  it('throws on non-positive servingsPerBatch', () => {
    expect(() => parseMealDraft(validDraftJson({ servingsPerBatch: 0 }))).toThrow(
      'servingsPerBatch',
    )
  })

  it('throws on an ingredient missing quantity', () => {
    expect(() =>
      parseMealDraft(validDraftJson({ ingredients: [{ name: 'Salt', unit: 'tsp' }] })),
    ).toThrow('quantity')
  })
})

describe('parseMealDrafts', () => {
  const one = { name: 'Chili', mealTypes: ['dinner'], protein: 'Beef', servingsPerBatch: 6 }
  const two = { name: 'Oats', mealTypes: ['breakfast'], protein: 'Vegetarian', servingsPerBatch: 2 }

  it('accepts a single object', () => {
    expect(parseMealDrafts(JSON.stringify(one)).map((d) => d.name)).toEqual(['Chili'])
  })

  it('accepts an array of meals', () => {
    expect(parseMealDrafts(JSON.stringify([one, two])).map((d) => d.name)).toEqual(['Chili', 'Oats'])
  })

  it('names the position of an invalid meal in an array', () => {
    expect(() => parseMealDrafts(JSON.stringify([one, { ...two, protein: 'Tofu' }]))).toThrow(/^Meal 2: /)
  })

  it('rejects an empty array', () => {
    expect(() => parseMealDrafts('[]')).toThrow('no meals')
  })
})
