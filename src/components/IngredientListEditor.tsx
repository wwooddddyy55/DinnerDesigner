import { generateId } from '../lib/id'
import { COMMON_UNITS } from '../lib/units'
import type { Ingredient } from '../types'
import styles from './IngredientListEditor.module.css'

interface IngredientListEditorProps {
  ingredients: Ingredient[]
  onChange: (ingredients: Ingredient[]) => void
}

export function IngredientListEditor({ ingredients, onChange }: IngredientListEditorProps) {
  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    onChange(ingredients.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)))
  }

  function addIngredient() {
    onChange([...ingredients, { id: generateId(), name: '', quantity: 1, unit: '' }])
  }

  function removeIngredient(id: string) {
    onChange(ingredients.filter((ing) => ing.id !== id))
  }

  return (
    <div>
      {ingredients.length === 0 && <p className={styles.empty}>No ingredients yet.</p>}
      {ingredients.map((ing) => (
        <div className={styles.row} key={ing.id}>
          <input
            className={`${styles.input} ${styles.nameField}`}
            type="text"
            placeholder="Ingredient name"
            value={ing.name}
            onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
          />
          <input
            className={`${styles.input} ${styles.qtyField}`}
            type="number"
            min={0}
            step="any"
            placeholder="Qty"
            value={ing.quantity}
            onChange={(e) => updateIngredient(ing.id, { quantity: Number(e.target.value) })}
          />
          <input
            className={`${styles.input} ${styles.unitField}`}
            type="text"
            placeholder="Unit"
            value={ing.unit}
            onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
            list="unit-suggestions"
          />
          <button
            type="button"
            className={`${styles.removeButton} ${styles.removeField}`}
            onClick={() => removeIngredient(ing.id)}
            aria-label="Remove ingredient"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`button buttonSecondary ${styles.addButton}`}
        onClick={addIngredient}
      >
        + Add ingredient
      </button>
      <datalist id="unit-suggestions">
        {COMMON_UNITS.map((unit) => (
          <option key={unit} value={unit} />
        ))}
      </datalist>
    </div>
  )
}
