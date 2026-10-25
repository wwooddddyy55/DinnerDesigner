export const COMMON_UNITS: string[] = [
  'g',
  'kg',
  'each',
  'cup',
  'tbsp',
  'tsp',
  'cloves',
  'cans',
  'bag',
  'box',
  'bottle',
  'bunch',
  'head',
  'packet',
  'jars',
  'container',
  'slices',
]

/** Units the shopping list can convert between, grouped into families that
 * are only ever combined with each other. Metric volume (ml/l) and spoon/cup
 * measures are deliberately separate families, so a list never turns "2 tbsp"
 * into an odd metric quantity. `factor` converts to the family's base unit. */
export type UnitFamily = 'mass' | 'metric-volume' | 'spoon'

interface UnitDef {
  family: UnitFamily
  factor: number
}

const UNIT_DEFS: Record<string, UnitDef> = {
  g: { family: 'mass', factor: 1 },
  gram: { family: 'mass', factor: 1 },
  grams: { family: 'mass', factor: 1 },
  kg: { family: 'mass', factor: 1000 },
  kgs: { family: 'mass', factor: 1000 },
  kilogram: { family: 'mass', factor: 1000 },
  kilograms: { family: 'mass', factor: 1000 },
  ml: { family: 'metric-volume', factor: 1 },
  millilitre: { family: 'metric-volume', factor: 1 },
  millilitres: { family: 'metric-volume', factor: 1 },
  milliliter: { family: 'metric-volume', factor: 1 },
  milliliters: { family: 'metric-volume', factor: 1 },
  l: { family: 'metric-volume', factor: 1000 },
  litre: { family: 'metric-volume', factor: 1000 },
  litres: { family: 'metric-volume', factor: 1000 },
  liter: { family: 'metric-volume', factor: 1000 },
  liters: { family: 'metric-volume', factor: 1000 },
  tsp: { family: 'spoon', factor: 1 },
  teaspoon: { family: 'spoon', factor: 1 },
  teaspoons: { family: 'spoon', factor: 1 },
  tbsp: { family: 'spoon', factor: 3 },
  tablespoon: { family: 'spoon', factor: 3 },
  tablespoons: { family: 'spoon', factor: 3 },
  cup: { family: 'spoon', factor: 48 },
  cups: { family: 'spoon', factor: 48 },
}

/** The convertible family for a unit string (case/whitespace-insensitive),
 * plus its quantity in that family's base unit — or `null` for a unit that
 * isn't convertible (each, cans, cloves...), which only ever combines with
 * the exact same unit. */
export function toBaseUnit(quantity: number, unit: string): { family: UnitFamily; baseQuantity: number } | null {
  const def = UNIT_DEFS[unit.trim().toLowerCase()]
  return def ? { family: def.family, baseQuantity: quantity * def.factor } : null
}

/** Picks a readable unit for a family total: kg/l from 1000 g/ml up, cups
 * from 1 cup up, tbsp from 1 tbsp up, otherwise the small unit. */
export function fromBaseUnit(family: UnitFamily, baseQuantity: number): { quantity: number; unit: string } {
  switch (family) {
    case 'mass':
      return baseQuantity >= 1000 ? { quantity: baseQuantity / 1000, unit: 'kg' } : { quantity: baseQuantity, unit: 'g' }
    case 'metric-volume':
      return baseQuantity >= 1000 ? { quantity: baseQuantity / 1000, unit: 'l' } : { quantity: baseQuantity, unit: 'ml' }
    case 'spoon':
      if (baseQuantity >= 48) return { quantity: baseQuantity / 48, unit: baseQuantity === 48 ? 'cup' : 'cups' }
      if (baseQuantity >= 3) return { quantity: baseQuantity / 3, unit: 'tbsp' }
      return { quantity: baseQuantity, unit: 'tsp' }
  }
}
