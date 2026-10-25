import { useRef } from 'react'
import type { KeyboardEvent } from 'react'
import { generateId } from '../lib/id'
import { COMMON_UNITS } from '../lib/units'
import type { Ingredient } from '../types'
import { NumberInput } from './NumberInput'
import styles from './IngredientListEditor.module.css'

interface IngredientListEditorProps {
  ingredients: Ingredient[]
  onChange: (ingredients: Ingredient[]) => void
}

type Field = 'name' | 'qty' | 'unit'

export function IngredientListEditor({ ingredients, onChange }: IngredientListEditorProps) {
  // Inputs by `${ingredientId}:${field}`, for moving focus with Enter.
  const inputs = useRef(new Map<string, HTMLInputElement>())
  // A just-added row whose name field should take focus once it mounts.
  const focusRowId = useRef<string | null>(null)

  function register(id: string, field: Field) {
    return (node: HTMLInputElement | null) => {
      if (!node) {
        inputs.current.delete(`${id}:${field}`)
        return
      }
      inputs.current.set(`${id}:${field}`, node)
      if (field === 'name' && focusRowId.current === id) {
        focusRowId.current = null
        node.focus()
      }
    }
  }

  function updateIngredient(id: string, patch: Partial<Ingredient>) {
    onChange(ingredients.map((ing) => (ing.id === id ? { ...ing, ...patch } : ing)))
  }

  function addIngredient() {
    const id = generateId()
    focusRowId.current = id
    onChange([...ingredients, { id, name: '', quantity: 1, unit: '' }])
  }

  function removeIngredient(id: string) {
    onChange(ingredients.filter((ing) => ing.id !== id))
  }

  /** Enter moves name → qty → unit → a new row, instead of submitting the
   * whole meal form half-typed (the phone keyboard's "Next" key). */
  function handleEnter(e: KeyboardEvent<HTMLInputElement>, id: string, field: Field) {
    if (e.key !== 'Enter' || e.nativeEvent.isComposing) return
    e.preventDefault()
    if (field === 'name') inputs.current.get(`${id}:qty`)?.focus()
    else if (field === 'qty') inputs.current.get(`${id}:unit`)?.focus()
    else {
      const index = ingredients.findIndex((ing) => ing.id === id)
      const next = ingredients[index + 1]
      if (next) inputs.current.get(`${next.id}:name`)?.focus()
      else addIngredient()
    }
  }

  return (
    <div>
      {ingredients.length === 0 && <p className={styles.empty}>No ingredients yet.</p>}
      {ingredients.map((ing, index) => (
        <div className={styles.row} key={ing.id}>
          <input
            ref={register(ing.id, 'name')}
            className={`${styles.input} ${styles.nameField}`}
            type="text"
            placeholder="Ingredient name"
            aria-label={`Ingredient ${index + 1} name`}
            autoCapitalize="sentences"
            autoComplete="off"
            enterKeyHint="next"
            value={ing.name}
            onChange={(e) => updateIngredient(ing.id, { name: e.target.value })}
            onKeyDown={(e) => handleEnter(e, ing.id, 'name')}
          />
          <NumberInput
            ref={register(ing.id, 'qty')}
            className={`${styles.input} ${styles.qtyField}`}
            min={0}
            step="any"
            placeholder="Qty"
            aria-label={`Ingredient ${index + 1} quantity`}
            enterKeyHint="next"
            value={ing.quantity}
            onCommit={(quantity) => updateIngredient(ing.id, { quantity })}
            onKeyDown={(e) => handleEnter(e, ing.id, 'qty')}
          />
          <input
            ref={register(ing.id, 'unit')}
            className={`${styles.input} ${styles.unitField}`}
            type="text"
            placeholder="Unit"
            aria-label={`Ingredient ${index + 1} unit`}
            autoCapitalize="none"
            autoComplete="off"
            enterKeyHint={index === ingredients.length - 1 ? 'enter' : 'next'}
            value={ing.unit}
            onChange={(e) => updateIngredient(ing.id, { unit: e.target.value })}
            onKeyDown={(e) => handleEnter(e, ing.id, 'unit')}
            list="unit-suggestions"
          />
          <button
            type="button"
            className={`${styles.removeButton} ${styles.removeField}`}
            onClick={() => removeIngredient(ing.id)}
            aria-label={`Remove ${ing.name || `ingredient ${index + 1}`}`}
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
