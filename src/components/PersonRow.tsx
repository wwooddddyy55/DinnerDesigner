import { MEAL_TYPE_LABELS } from '../types'
import type { MealType, Person } from '../types'
import styles from './PersonRow.module.css'

interface PersonRowProps {
  person: Person
  mealTypes: MealType[]
  onChange: (person: Person) => void
  onRemove: () => void
}

export function PersonRow({ person, mealTypes, onChange, onRemove }: PersonRowProps) {
  function setServings(type: MealType, value: number) {
    onChange({
      ...person,
      servingsPerMealType: { ...person.servingsPerMealType, [type]: value },
    })
  }

  return (
    <div className={styles.row}>
      <input
        className={styles.name}
        type="text"
        value={person.name}
        onChange={(e) => onChange({ ...person, name: e.target.value })}
        placeholder="Name"
      />
      <div className={styles.servingsGroup}>
        {mealTypes.map((type) => (
          <div className={styles.servingsField} key={type}>
            <span className={styles.servingsLabel}>{MEAL_TYPE_LABELS[type]}</span>
            <input
              className={styles.servingsInput}
              type="number"
              min={0}
              value={person.servingsPerMealType[type] ?? 0}
              onChange={(e) => setServings(type, Number(e.target.value))}
            />
          </div>
        ))}
      </div>
      <button type="button" className={styles.removeButton} onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
