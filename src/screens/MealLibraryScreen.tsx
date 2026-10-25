import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImportMealDialog } from '../components/ImportMealDialog'
import { MealCard } from '../components/MealCard'
import { MealForm } from '../components/MealForm'
import { MealSearchBar } from '../components/MealSearchBar'
import { ProteinFilterChips } from '../components/ProteinFilterChips'
import { toIsoDate } from '../lib/date'
import type { MealDraft } from '../lib/mealImport'
import { formatLastServed, getMealServedIndex, matchesMealSearch, sortMeals } from '../lib/mealSearch'
import type { MealSort } from '../lib/mealSearch'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, MEAL_TYPES } from '../types'
import type { Meal, MealType, ProteinType } from '../types'
import styles from './MealLibraryScreen.module.css'

export function MealLibraryScreen() {
  const meals = useAppStore((s) => s.meals)
  const addMeal = useAppStore((s) => s.addMeal)
  const updateMeal = useAppStore((s) => s.updateMeal)
  const deleteMeal = useAppStore((s) => s.deleteMeal)
  const plans = useAppStore((s) => s.plans)

  const [mealTypeFilter, setMealTypeFilter] = useState<MealType | 'all'>('all')
  const [proteinFilter, setProteinFilter] = useState<ProteinType[]>([])
  const [editingMeal, setEditingMeal] = useState<Meal | 'new' | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Meal | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<MealSort>('name')

  const served = useMemo(() => getMealServedIndex(plans), [plans])
  const today = toIsoDate(new Date())
  const filtersActive = mealTypeFilter !== 'all' || proteinFilter.length > 0 || query.trim().length > 0

  const filteredMeals = sortMeals(
    meals.filter((meal) => {
      if (mealTypeFilter !== 'all' && !meal.mealTypes.includes(mealTypeFilter)) return false
      if (proteinFilter.length > 0 && !proteinFilter.includes(meal.protein)) return false
      return matchesMealSearch(meal, query)
    }),
    sort,
    served,
  )

  function clearFilters() {
    setMealTypeFilter('all')
    setProteinFilter([])
    setQuery('')
  }

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

  function handleImportedMany(drafts: MealDraft[]) {
    setShowImportDialog(false)
    for (const draft of drafts) addMeal(draft)
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

      <p className={styles.hint}>
        Tip: <strong>Import recipe</strong> turns a recipe link into a meal — paste it into any AI chat with the
        prompt it gives you.
      </p>

      <div className={styles.filters}>
        <div className={`stickyBar ${styles.searchSticky}`}>
          <MealSearchBar
            query={query}
            onQueryChange={setQuery}
            sort={sort}
            onSortChange={setSort}
            shownCount={filteredMeals.length}
            totalCount={meals.length}
          />
        </div>
        <select
          className={styles.mealTypeSelect}
          aria-label="Filter by meal type"
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

      {meals.length === 0 ? (
        <div className={styles.emptyState}>
          <p>Your library is empty. Add your first meal by hand, or import one from a recipe link.</p>
          <div className={styles.headerActions}>
            <button type="button" className="button" onClick={() => setEditingMeal('new')}>
              + Add meal
            </button>
            <button type="button" className="button buttonSecondary" onClick={() => setShowImportDialog(true)}>
              Import recipe
            </button>
          </div>
        </div>
      ) : filteredMeals.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No meals match these filters.</p>
          {filtersActive && (
            <button type="button" className="button buttonSecondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredMeals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              lastServedLabel={`Last picked: ${formatLastServed(served.get(meal.id), today)}`}
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
        <ImportMealDialog
          onCancel={() => setShowImportDialog(false)}
          onImported={handleImported}
          onImportedMany={handleImportedMany}
        />
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
