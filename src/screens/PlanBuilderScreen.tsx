import { useState } from 'react'
import { ProgressBar } from '../components/ProgressBar'
import { ProteinFilterChips } from '../components/ProteinFilterChips'
import { getMealTypePicked, getMealTypeTarget } from '../lib/calculations'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { MealType, ProteinType, WeeklyPlan } from '../types'
import styles from './PlanBuilderScreen.module.css'

interface PlanBuilderScreenProps {
  plan: WeeklyPlan
}

export function PlanBuilderScreen({ plan }: PlanBuilderScreenProps) {
  const meals = useAppStore((s) => s.meals)
  const addPlannedMeal = useAppStore((s) => s.addPlannedMeal)
  const removePlannedMeal = useAppStore((s) => s.removePlannedMeal)

  const [activeType, setActiveType] = useState<MealType>(plan.selectedMealTypes[0])
  const [proteinFilter, setProteinFilter] = useState<ProteinType[]>([])

  if (plan.selectedMealTypes.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyState}>
          Select at least one meal type on the Weekly Setup screen to start building a plan.
        </p>
      </div>
    )
  }

  const currentType = plan.selectedMealTypes.includes(activeType)
    ? activeType
    : plan.selectedMealTypes[0]

  const target = getMealTypeTarget(plan, currentType)
  const picked = getMealTypePicked(plan, currentType)

  const availableMeals = meals.filter((meal) => {
    if (!meal.mealTypes.includes(currentType)) return false
    if (proteinFilter.length > 0 && !proteinFilter.includes(meal.protein)) return false
    return true
  })

  const pickedEntries = plan.plannedMeals.filter((e) => e.mealType === currentType)

  function toggleProtein(protein: ProteinType) {
    setProteinFilter((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein],
    )
  }

  return (
    <div className={styles.page}>
      <h2>Plan builder</h2>

      <div className={styles.tabs}>
        {plan.selectedMealTypes.map((type) => (
          <button
            key={type}
            type="button"
            className={`${styles.tab} ${type === currentType ? styles.tabActive : ''}`}
            onClick={() => setActiveType(type)}
          >
            {MEAL_TYPE_LABELS[type]}
          </button>
        ))}
      </div>

      <div className={`card ${styles.progressCard}`}>
        <ProgressBar picked={picked} target={target} label={MEAL_TYPE_LABELS[currentType]} />
      </div>

      <div className={styles.columns}>
        <div>
          <h3>Choose meals</h3>
          <ProteinFilterChips
            selected={proteinFilter}
            onToggle={toggleProtein}
            onClear={() => setProteinFilter([])}
          />
          <div className={styles.pickerList}>
            {availableMeals.length === 0 && (
              <p className={styles.emptyState}>
                No meals match this meal type / protein filter yet.
              </p>
            )}
            {availableMeals.map((meal) => (
              <div className={`card ${styles.pickerRow}`} key={meal.id}>
                <div className={styles.pickerInfo}>
                  <strong>{meal.name}</strong>
                  <span className={styles.pickerMeta}>
                    {proteinLabel(meal.protein, meal.proteinCustomLabel)} ·{' '}
                    {meal.servingsPerBatch} servings/batch
                  </span>
                </div>
                <button
                  type="button"
                  className="button buttonSecondary"
                  onClick={() => addPlannedMeal(plan.id, currentType, meal)}
                >
                  + Add
                </button>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3>Picked for {MEAL_TYPE_LABELS[currentType]}</h3>
          <div className={styles.pickedList}>
            {pickedEntries.length === 0 && (
              <p className={styles.emptyState}>Nothing picked yet.</p>
            )}
            {pickedEntries.map((entry) => (
              <div className={`card ${styles.pickedRow}`} key={entry.id}>
                <div className={styles.pickerInfo}>
                  <strong>{entry.name}</strong>
                  <span className={styles.pickerMeta}>
                    {proteinLabel(entry.protein, entry.proteinCustomLabel)} ·{' '}
                    {entry.servingsPerBatch} servings
                  </span>
                </div>
                <button
                  type="button"
                  className="button buttonDanger"
                  onClick={() => removePlannedMeal(plan.id, entry.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
