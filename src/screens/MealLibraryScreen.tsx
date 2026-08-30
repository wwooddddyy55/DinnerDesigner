import { useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImportMealDialog } from '../components/ImportMealDialog'
import { MealCard } from '../components/MealCard'
import { MealForm } from '../components/MealForm'
import { ProteinFilterChips } from '../components/ProteinFilterChips'
import type { MealDraft } from '../lib/mealImport'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '../types'
import type { Meal, MealType, ProteinType } from '../types'
import styles from './MealLibraryScreen.module.css'

export function MealLibraryScreen() {
  const meals = useAppStore((s) => s.meals)
  const addMeal = useAppStore((s) => s.addMeal)
  const updateMeal = useAppStore((s) => s.updateMeal)
  const deleteMeal = useAppStore((s) => s.deleteMeal)

  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | 'all'>('all')
  const [proteinFilter, setProteinFilter] = useState<ProteinType[]>([])
  const [editingMeal, setEditingMeal] = useState<Meal | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Meal | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)

  const filteredMeals = meals.filter((meal) => {
    if (mealTypeFilter !== 'all' && !meal.mealTypes.includes(mealTypeFilter)) return false
    if (proteinFilter.length > 0 && !proteinFilter.includes(meal.protein)) return false
    return true
  })

  function toggleProtein(protein: ProteinType) {
    setProteinFilter((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein],
    )
  }

  function handleSave(meal: Omit<Meal, 'id' | 'createdAt' | 'updatedAt'>) {
    if (editingMeal && editingMeal !== 'new' && editingMeal.id) {
      updateMeal({ ...editingMeal, ...meal })
    } else {
      addMeal(meal)
    }
    setEditingMeal(null)
  }

  function handleImported(draft: MealDraft) {
    setShowImportDialog(false)
    // Prefill MealForm as a new meal (empty id) so it's reviewable before saving.
    setEditingMeal({ ...draft, id: '', createdAt: '', updatedAt: '' })
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2>Meal library</h2>
        <div className={styles.headerActions}>
          <button type="button" className="button buttonSecondary" onClick={() => setShowImportDialog(true)}>
            Import recipe
          </button>
          <button type="button" className="button" onClick={() => setEditingMeal('new')}>
            + Add meal
          </button>
        </div>
      </div>

      <div className={styles.filters}>
        <select
          className={styles.mealTypeSelect}
          value={mealTypeFilter}
          onChange={(e) => setMealTypeFilter(e.target.value as MealType | 'all')}
        >
          <option value="all">All meal types</option>
          {MEAL_TYPES.map((type) => (
            <option key={type} value={type}>
              {MEAL_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <ProteinFilterChips
          selected={proteinFilter}
          onToggle={toggleProtein}
          onClear={() => setProteinFilter([])}
        />
      </div>

      {filteredMeals.length === 0 ? (
        <p className={styles.emptyState}>No meals match these filters yet.</p>
      ) : (
        <div className={styles.grid}>
          {filteredMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              onEdit={() => setEditingMeal(meal)}
              onDelete={() => setPendingDelete(meal)}
            />
          ))}
        </div>
      )}

      {editingMeal && (
        <MealForm
          initialMeal={editingMeal === 'new' ? undefined : editingMeal}
          onCancel={() => setEditingMeal(null)}
          onSave={handleSave}
        />
      )}

      {showImportDialog && (
        <ImportMealDialog onCancel={() => setShowImportDialog(false)} onImported={handleImported} />
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete meal?"
          message={`This removes "${pendingDelete.name}" from your library. Weeks that already used it keep their own copy.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDelete(null)}
          onConfirm={() => {
            deleteMeal(pendingDelete.id)
            setPendingDelete(null)
          }}
        />
      )}
    </div>
  )
}
