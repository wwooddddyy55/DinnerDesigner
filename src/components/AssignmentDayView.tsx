import { canPlaceEntryInCell, findCellAssignments, isCellAvailable } from '../lib/calculations'
import { formatDayHeader } from '../lib/date'
import { MEAL_TYPE_LABELS } from '../types'
import type { MealType, WeeklyPlan } from '../types'
import { AssignmentCell } from './AssignmentCell'
import styles from './AssignmentDayView.module.css'

interface AssignmentDayViewProps {
  plan: WeeklyPlan
  day: number
  onDayChange: (day: number) => void
  selectedEntryId: string | null
  onTapPlace: (personId: string, mealType: MealType, day: number) => void
  onClear: (entryId: string, assignmentId: string) => void
  onReweight: (entryId: string, assignmentId: string, weight: number) => void
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]

export function AssignmentDayView({
  plan,
  day,
  onDayChange,
  selectedEntryId,
  onTapPlace,
  onClear,
  onReweight,
}: AssignmentDayViewProps) {
  const selectedEntry = plan.plannedMeals.find((e) => e.id === selectedEntryId)

  return (
    <div>
      <div className={styles.dayTabs}>
        {DAYS.map((d) => (
          <button
            key={d}
            type="button"
            className={`${styles.dayTab} ${d === day ? styles.dayTabActive : ''}`}
            onClick={() => onDayChange(d)}
            aria-pressed={d === day}
          >
            {formatDayHeader(plan.weekStartDate, d)}
          </button>
        ))}
      </div>

      <div className={styles.people}>
        {plan.people.map((person) => (
          <div className={styles.personGroup} key={person.id}>
            <h4 className={styles.personLabel}>{person.name}</h4>
            {plan.selectedMealTypes.map((type) => {
              const available = isCellAvailable(person, type, day)
              const occupants = findCellAssignments(plan, person.id, day, type)
              return (
                <div className={styles.mealTypeRow} key={type}>
                  <span className={styles.mealTypeLabel}>{MEAL_TYPE_LABELS[type]}</span>
                  <AssignmentCell
                    dropId={`day-view::${person.id}::${type}::${day}`}
                    personId={person.id}
                    mealType={type}
                    day={day}
                    available={available}
                    droppable={false}
                    tapEligible={canPlaceEntryInCell(selectedEntry, type, occupants)}
                    occupants={occupants}
                    onClear={onClear}
                    onReweight={onReweight}
                    onTapPlace={onTapPlace}
                    plan={plan}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
