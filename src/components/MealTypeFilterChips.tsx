import { MEAL_TYPE_LABELS } from '../types'
import type { MealType } from '../types'
import styles from './ProteinFilterChips.module.css'

interface MealTypeFilterChipsProps {
  types: MealType[]
  selected: MealType[]
  onToggle: (type: MealType) => void
  onClear: () => void
}

export function MealTypeFilterChips({ types, selected, onToggle, onClear }: MealTypeFilterChipsProps) {
  return (
    <div className={styles.row}>
      {types.map((type) => {
        const active = selected.includes(type)
        return (
          <button
            key={type}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={() => onToggle(type)}
            aria-pressed={active}
          >
            {MEAL_TYPE_LABELS[type]}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button type="button" className={styles.chip} onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  )
}
