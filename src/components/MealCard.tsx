import type { ReactNode } from 'react'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { Meal } from '../types'
import styles from './MealCard.module.css'

interface MealCardProps {
  meal: Meal
  onEdit?: () => void
  onDelete?: () => void
  actionSlot?: ReactNode
}

export function MealCard({ meal, onEdit, onDelete, actionSlot }: MealCardProps) {
  return (
    <div className={`card ${styles.card}`}>
      <div className={styles.header}>
        <div>
          <div className={styles.name}>{meal.name}</div>
          <div className={styles.meta}>
            <span className="badge">{proteinLabel(meal.protein, meal.proteinCustomLabel)}</span>
            {meal.mealTypes.map((type) => (
              <span key={type} className="badge">
                {MEAL_TYPE_LABELS[type]}
              </span>
            ))}
            <span className="badge">{meal.servingsPerBatch} servings/batch</span>
          </div>
        </div>
      </div>
      {meal.ingredients.length > 0 && (
        <div className={styles.ingredientPreview}>
          {meal.ingredients.map((i) => i.name).join(', ')}
        </div>
      )}
      <div className={styles.actions}>
        {onEdit && (
          <button type="button" className="button buttonSecondary" onClick={onEdit}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" className="button buttonDanger" onClick={onDelete}>
            Delete
          </button>
        )}
        {actionSlot}
      </div>
    </div>
  )
}
