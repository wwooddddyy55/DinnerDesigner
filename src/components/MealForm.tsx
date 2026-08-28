import { useState } from 'react'
import type { FormEvent } from 'react'
import { generateId } from '../lib/id'
import { MEAL_TYPE_LABELS, MEAL_TYPES, PROTEIN_TYPES } from '../types'
import type { Ingredient, Meal, MealType, ProteinType } from '../types'
import { IngredientListEditor } from './IngredientListEditor'
import styles from './MealForm.module.css'

interface MealFormProps {
  initialMeal?: Meal
  onCancel: () => void
  onSave: (meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>) => void
}

export function MealForm({ initialMeal, onCancel, onSave }: MealFormProps) {
  const [name, setName] = useState(initialMeal?.name ?? '')
  const [mealTypes, setMealTypes] = useState<MealType[]>(initialMeal?.mealTypes ?? [])
  const [protein, setProtein] = useState<ProteinType>(initialMeal?.protein ?? 'Beef')
  const [proteinCustomLabel, setProteinCustomLabel] = useState(
    initialMeal?.proteinCustomLabel ?? '',
  )
  const [servingsPerBatch, setServingsPerBatch] = useState(initialMeal?.servingsPerBatch ?? 4)
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialMeal?.ingredients.map((i) => ({ ...i })) ?? [],
  )
  const [notes, setNotes] = useState(initialMeal?.notes ?? '')
  const [error, setError] = useState<string | null>(null)

  function toggleMealType(type: MealType) {
    setMealTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    )
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (name.trim().length === 0) {
      setError('Give the meal a name.')
      return
    }
    if (mealTypes.length === 0) {
      setError('Select at least one meal type.')
      return
    }
    if (servingsPerBatch <= 0) {
      setError('Servings per batch must be greater than 0.')
      return
    }

    const cleanedIngredients = ingredients
      .map((i) => ({ ...i, id: i.id || generateId(), name: i.name.trim(), unit: i.unit.trim() }))
      .filter((i) => i.name.length > 0)

    onSave({
      name: name.trim(),
      mealTypes,
      protein,
      proteinCustomLabel: protein === 'Other' ? proteinCustomLabel.trim() : undefined,
      servingsPerBatch,
      ingredients: cleanedIngredients,
      notes: notes.trim() || undefined,
    })
  }

  return (
    <div className={styles.overlay}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2>{initialMeal ? 'Edit meal' : 'Add meal'}</h2>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="meal-name">
            Name
          </label>
          <input
            id="meal-name"
            className={styles.input}
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Lasagna"
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Meal types</span>
          <div className={styles.checkboxRow}>
            {MEAL_TYPES.map((type) => (
              <label className={styles.checkboxLabel} key={type}>
                <input
                  type="checkbox"
                  checked={mealTypes.includes(type)}
                  onChange={() => toggleMealType(type)}
                />
                {MEAL_TYPE_LABELS[type]}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="meal-protein">
            Protein
          </label>
          <select
            id="meal-protein"
            className={styles.select}
            value={protein}
            onChange={(e) => setProtein(e.target.value as ProteinType)}
          >
            {PROTEIN_TYPES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {protein === 'Other' && (
          <div className={styles.field}>
            <label className={styles.label} htmlFor="meal-protein-custom">
              Protein label
            </label>
            <input
              id="meal-protein-custom"
              className={styles.input}
              type="text"
              value={proteinCustomLabel}
              onChange={(e) => setProteinCustomLabel(e.target.value)}
              placeholder="e.g. Eggs, Tofu"
            />
          </div>
        )}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="meal-servings">
            Servings per batch
          </label>
          <input
            id="meal-servings"
            className={styles.input}
            type="number"
            min={1}
            value={servingsPerBatch}
            onChange={(e) => setServingsPerBatch(Number(e.target.value))}
          />
        </div>

        <div className={styles.field}>
          <span className={styles.label}>Ingredients</span>
          <IngredientListEditor ingredients={ingredients} onChange={setIngredients} />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="meal-notes">
            Notes (optional)
          </label>
          <input
            id="meal-notes"
            className={styles.input}
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.footer}>
          <button type="button" className="button buttonSecondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="button">
            Save meal
          </button>
        </div>
      </form>
    </div>
  )
}
