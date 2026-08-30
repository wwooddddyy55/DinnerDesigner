import { generateId } from '../lib/id'
import type { Ingredient, Meal } from '../types'

function ing(name: string, quantity: number, unit: string): Ingredient {
  return { id: generateId(), name, quantity, unit }
}

function meal(input: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>): Meal {
  const now = new Date().toISOString()
  return { ...input, id: generateId(), createdAt: now, updatedAt: now }
}

export function createSeedMeals(): Meal[] {
  return [
    meal({
      name: 'Lasagna',
      mealTypes: ['dinner'],
      protein: 'Beef',
      servingsPerBatch: 8,
      ingredients: [
        ing('Ground beef', 900, 'g'),
        ing('Lasagna noodles', 1, 'box'),
        ing('Marinara sauce', 2, 'jars'),
        ing('Ricotta cheese', 1, 'container'),
        ing('Mozzarella cheese', 2, 'cups'),
      ],
    }),
    meal({
      name: 'Beef Tacos',
      mealTypes: ['dinner'],
      protein: 'Beef',
      servingsPerBatch: 6,
      ingredients: [
        ing('Ground beef', 700, 'g'),
        ing('Taco shells', 12, 'each'),
        ing('Shredded cheese', 1, 'cup'),
        ing('Lettuce', 1, 'head'),
        ing('Taco seasoning', 1, 'packet'),
      ],
    }),
    meal({
      name: 'Chicken Stir Fry',
      mealTypes: ['dinner', 'lunch'],
      protein: 'Chicken',
      servingsPerBatch: 4,
      ingredients: [
        ing('Chicken breast', 700, 'g'),
        ing('Mixed stir-fry vegetables', 1, 'bag'),
        ing('Soy sauce', 0.25, 'cup'),
        ing('Rice', 2, 'cups'),
      ],
    }),
    meal({
      name: 'Pulled Pork Sandwiches',
      mealTypes: ['dinner', 'lunch'],
      protein: 'Pork',
      servingsPerBatch: 6,
      ingredients: [
        ing('Pork shoulder', 1.4, 'kg'),
        ing('BBQ sauce', 1, 'bottle'),
        ing('Sandwich buns', 6, 'each'),
        ing('Coleslaw mix', 1, 'bag'),
      ],
    }),
    meal({
      name: 'Grilled Salmon',
      mealTypes: ['dinner'],
      protein: 'Fish',
      servingsPerBatch: 4,
      ingredients: [
        ing('Salmon fillets', 4, 'each'),
        ing('Lemon', 2, 'each'),
        ing('Asparagus', 1, 'bunch'),
        ing('Olive oil', 2, 'tbsp'),
      ],
    }),
    meal({
      name: 'Veggie Chili',
      mealTypes: ['dinner', 'lunch'],
      protein: 'Vegetarian',
      servingsPerBatch: 6,
      ingredients: [
        ing('Kidney beans', 2, 'cans'),
        ing('Black beans', 2, 'cans'),
        ing('Diced tomatoes', 2, 'cans'),
        ing('Onion', 1, 'each'),
        ing('Chili powder', 2, 'tbsp'),
      ],
    }),
    meal({
      name: 'Oatmeal',
      mealTypes: ['breakfast'],
      protein: 'Vegetarian',
      servingsPerBatch: 4,
      ingredients: [
        ing('Rolled oats', 2, 'cups'),
        ing('Milk', 2, 'cups'),
        ing('Brown sugar', 2, 'tbsp'),
        ing('Cinnamon', 1, 'tsp'),
      ],
    }),
    meal({
      name: 'Scrambled Eggs & Toast',
      mealTypes: ['breakfast'],
      protein: 'Other',
      proteinCustomLabel: 'Eggs',
      servingsPerBatch: 2,
      ingredients: [
        ing('Eggs', 4, 'each'),
        ing('Bread', 4, 'slices'),
        ing('Butter', 1, 'tbsp'),
      ],
    }),
  ]
}
