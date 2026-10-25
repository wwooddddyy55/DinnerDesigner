import { useState } from 'react'
import { MealSearchBar } from './MealSearchBar'
import { MealTypeFilterChips } from './MealTypeFilterChips'
import { ProteinFilterChips } from './ProteinFilterChips'
import { formatLastServed } from '../lib/mealSearch'
import type { MealServedInfo, MealSort } from '../lib/mealSearch'
import { useNavigate } from '../lib/navigation'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { Meal, MealType, ProteinType, WeeklyPlan } from '../types'
import styles from '../screens/PlanBuilderScreen.module.css'

interface MealPickerPanelProps {
  plan: WeeklyPlan
  /** Already filtered and sorted. */
  availableMeals: Meal[]
  /** How many library meals fit this plan's meal types at all (before filters). */
  eligibleCount: number
  /** Last-served info from weeks before this plan, keyed by meal id. */
  served: Map<string, MealServedInfo>
  query: string
  onQueryChange: (query: string) => void
  sort: MealSort
  onSortChange: (sort: MealSort) => void
  onClearAll: () => void
  mealTypeFilter: MealType[]
  proteinFilter: ProteinType[]
  onToggleMealType: (type: MealType) => void
  onToggleProtein: (protein: ProteinType) => void
  onClearMealTypeFilter: () => void
  onClearProteinFilter: () => void
  onAdd: (meal: Meal) => void
  /** Phone layout: filter chips fold away behind a "Filters (N)" toggle. */
  compact?: boolean
}

export function MealPickerPanel({
  plan,
  availableMeals,
  eligibleCount,
  served,
  query,
  onQueryChange,
  sort,
  onSortChange,
  onClearAll,
  mealTypeFilter,
  proteinFilter,
  onToggleMealType,
  onToggleProtein,
  onClearMealTypeFilter,
  onClearProteinFilter,
  onAdd,
  compact = false,
}: MealPickerPanelProps) {
  const navigate = useNavigate()
  const [showFilters, setShowFilters] = useState(false)
  const activeFilters = mealTypeFilter.length + proteinFilter.length
  const filtersVisible = !compact || showFilters
  return (
    <div>
      <h3>Choose meals</h3>
      <MealSearchBar
        query={query}
        onQueryChange={onQueryChange}
        sort={sort}
        onSortChange={onSortChange}
        shownCount={availableMeals.length}
        totalCount={eligibleCount}
      />
      {compact && (
        <button
          type="button"
          className={`button buttonSecondary ${styles.filtersToggle}`}
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          {showFilters ? 'Hide filters' : `Filters${activeFilters > 0 ? ` (${activeFilters})` : ''}`}
        </button>
      )}
      {filtersVisible && (
        <>
          <MealTypeFilterChips
            types={plan.selectedMealTypes}
            selected={mealTypeFilter}
            onToggle={onToggleMealType}
            onClear={onClearMealTypeFilter}
          />
          <ProteinFilterChips selected={proteinFilter} onToggle={onToggleProtein} onClear={onClearProteinFilter} />
        </>
      )}
      <div className={styles.pickerList}>
        {eligibleCount === 0 && (
          <div className={styles.emptyState}>
            <p>No library meals fit this week's meal types yet.</p>
            <button type="button" className="button buttonSecondary" onClick={() => navigate('library')}>
              Open Meal Library
            </button>
          </div>
        )}
        {eligibleCount > 0 && availableMeals.length === 0 && (
          <div className={styles.emptyState}>
            <p>No meals match this search / filter.</p>
            <button type="button" className="button buttonSecondary" onClick={onClearAll}>
              Clear filters
            </button>
          </div>
        )}
        {availableMeals.map((meal) => (
          <div className={`card ${styles.pickerRow}`} key={meal.id}>
            <div className={styles.pickerInfo}>
              <strong>{meal.name}</strong>
              <span className={styles.pickerMeta}>
                {proteinLabel(meal.protein, meal.proteinCustomLabel)} · {meal.servingsPerBatch} servings/batch ·{' '}
                {meal.mealTypes
                  .filter((t) => plan.selectedMealTypes.includes(t))
                  .map((t) => MEAL_TYPE_LABELS[t])
                  .join(', ')}
              </span>
              <span className={styles.pickerMeta}>
                Last picked: {formatLastServed(served.get(meal.id), plan.weekStartDate)}
              </span>
            </div>
            <button
              type="button"
              className="button buttonSecondary"
              onClick={() => onAdd(meal)}
              aria-label={`Add ${meal.name} to this week`}
            >
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
