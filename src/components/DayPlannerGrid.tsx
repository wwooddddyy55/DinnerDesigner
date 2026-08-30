import { Fragment } from 'react'
import { isCellAvailable } from '../lib/calculations'
import { formatDayHeader } from '../lib/date'
import { MEAL_TYPE_LABELS } from '../types'
import type { MealType, WeeklyPlan } from '../types'
import styles from './DayPlannerGrid.module.css'

interface DayPlannerGridProps {
  plan: WeeklyPlan
  onToggle: (personId: string, mealType: MealType, day: number, available: boolean) => void
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]

export function DayPlannerGrid({ plan, onToggle }: DayPlannerGridProps) {
  return (
    <div className={styles.wrapper}>
      {plan.people.map((person) => (
        <div className={styles.personBlock} key={person.id}>
          <h4 className={styles.personLabel}>{person.name}</h4>
          <div className={styles.scroll}>
            <div className={styles.grid}>
              <div className={`${styles.headerCell} ${styles.nameCell}`} />
              {DAYS.map((day) => (
                <div className={styles.headerCell} key={day}>
                  {formatDayHeader(plan.weekStartDate, day)}
                </div>
              ))}
              {plan.selectedMealTypes.map((type) => (
                <Fragment key={type}>
                  <div className={styles.nameCell}>{MEAL_TYPE_LABELS[type]}</div>
                  {DAYS.map((day) => {
                    const available = isCellAvailable(person, type, day)
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`${styles.cell} ${available ? styles.cellAvailable : ''}`}
                        aria-pressed={available}
                        onClick={() => onToggle(person.id, type, day, !available)}
                      >
                        {available ? 'Yes' : 'No'}
                      </button>
                    )
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
