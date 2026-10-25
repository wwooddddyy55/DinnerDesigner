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

/** Narrow labels for the phone layout, where the grid must fit ~340px. */
const MEAL_TYPE_SHORT_LABELS: Record<MealType, string> = {
  breakfast: 'Bkfst',
  lunch: 'Lunch',
  dinner: 'Dinner',
}

export function DayPlannerGrid({ plan, onToggle }: DayPlannerGridProps) {
  return (
    <div className={styles.wrapper}>
      {plan.people.map((person) => (
        <div
          className={styles.personBlock}
          key={person.id}
          role="group"
          aria-labelledby={`day-planner-${person.id}`}
        >
          <h4 className={styles.personLabel} id={`day-planner-${person.id}`}>
            {person.name}
          </h4>
          <div className={styles.scroll}>
            <div className={styles.grid}>
              <div className={`${styles.headerCell} ${styles.nameCell}`} />
              {DAYS.map((day) => (
                <div className={styles.headerCell} key={day}>
                  {/* "Mon 9/1", stacked onto two lines on phones. */}
                  {formatDayHeader(plan.weekStartDate, day)
                    .split(' ')
                    .map((part, i) => (
                      <span key={i} className={styles.headerPart}>
                        {part}
                      </span>
                    ))}
                </div>
              ))}
              {plan.selectedMealTypes.map((type) => (
                <Fragment key={type}>
                  <div className={styles.nameCell}>
                    <span className={styles.longLabel}>{MEAL_TYPE_LABELS[type]}</span>
                    <span className={styles.shortLabel} aria-hidden="true">
                      {MEAL_TYPE_SHORT_LABELS[type]}
                    </span>
                  </div>
                  {DAYS.map((day) => {
                    const available = isCellAvailable(person, type, day)
                    return (
                      <button
                        key={day}
                        type="button"
                        className={`${styles.cell} ${available ? styles.cellAvailable : ''}`}
                        aria-pressed={available}
                        aria-label={`${person.name}, ${MEAL_TYPE_LABELS[type]}, ${formatDayHeader(plan.weekStartDate, day)}: ${available ? 'available' : 'not available'}`}
                        onClick={() => onToggle(person.id, type, day, !available)}
                      >
                        <span aria-hidden="true">{available ? 'Yes' : 'No'}</span>
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
