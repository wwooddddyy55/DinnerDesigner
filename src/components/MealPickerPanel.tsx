import { MealTypeFilterChips } from './MealTypeFilterChips'
import { ProteinFilterChips } from './ProteinFilterChips'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { Meal, MealType, ProteinType, WeeklyPlan } from '../types'
import styles from '../screens/PlanBuilderScreen.module.css'

interface MealPickerPanelProps {
  plan: WeeklyPlan
  availableMeals: Meal[]
  mealTypeFilter: MealType[]
  proteinFilter: ProteinType[]
  onToggleMealType: (type: MealType) => void
  onToggleProtein: (protein: ProteinType) => void
  onClearMealTypeFilter: () => void
  onClearProteinFilter: () => void
  onAdd: (meal: Meal) => void
}

export function MealPickerPanel({
  plan,
  availableMeals,
  mealTypeFilter,
  proteinFilter,
  onToggleMealType,
  onToggleProtein,
  onClearMealTypeFilter,
  onClearProteinFilter,
  onAdd,
}: MealPickerPanelProps) {
  return (
    <div>
      <h3>Choose meals</h3>
      <MealTypeFilterChips
        types={plan.selectedMealTypes}
        selected={mealTypeFilter}
        onToggle={onToggleMealType}
        onClear={onClearMealTypeFilter}
      />
      <ProteinFilterChips selected={proteinFilter} onToggle={onToggleProtein} onClear={onClearProteinFilter} />
      <div className={styles.pickerList}>
        {availableMeals.length === 0 && (
          <p className={styles.emptyState}>No meals match this meal type / protein filter yet.</p>
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
            </div>
            <button type="button" className="button buttonSecondary" onClick={() => onAdd(meal)}>
              + Add
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
