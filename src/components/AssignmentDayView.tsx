import { useEffect, useRef } from 'react'
import { canPlaceEntryInCell, findCellAssignments, getDayStatus, isCellAvailable } from '../lib/calculations'
import type { DayStatus } from '../lib/calculations'
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

/** The small status line under a day tab: where the selected meal can still
 * go, or (with nothing selected) how many slots are still empty. */
function describeDay(status: DayStatus, placing: boolean): string {
  if (status.available === 0) return 'Nobody in'
  if (placing) return status.eligible > 0 ? `${status.eligible} can take it` : 'No room'
  return status.open > 0 ? `${status.open} empty` : 'Full ✓'
}

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
  const statuses = DAYS.map((d) => getDayStatus(plan, d, selectedEntry))
  const wanted = (s: DayStatus) => (selectedEntry ? s.eligible > 0 : s.open > 0)
  // Next day after this one (wrapping round the week) that still has room.
  const nextDay = DAYS.map((offset) => (day + 1 + offset) % DAYS.length).find(
    (d) => d !== day && wanted(statuses[d]),
  )

  const activeTabRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [day])

  return (
    <div>
      <div className={styles.dayTabs} role="group" aria-label="Day to show">
        {DAYS.map((d) => {
          const status = statuses[d]
          const note = describeDay(status, Boolean(selectedEntry))
          return (
            <button
              key={d}
              ref={d === day ? activeTabRef : undefined}
              type="button"
              className={[
                styles.dayTab,
                d === day ? styles.dayTabActive : '',
                status.available === 0 ? styles.dayTabIdle : '',
                selectedEntry && status.eligible > 0 ? styles.dayTabEligible : '',
              ].join(' ')}
              onClick={() => onDayChange(d)}
              aria-pressed={d === day}
              aria-label={`${formatDayHeader(plan.weekStartDate, d)}: ${note}`}
            >
              <span>{formatDayHeader(plan.weekStartDate, d)}</span>
              <span className={styles.dayNote} aria-hidden="true">
                {note}
              </span>
            </button>
          )
        })}
      </div>
      {nextDay !== undefined && (
        <button type="button" className={`button buttonSecondary ${styles.nextDay}`} onClick={() => onDayChange(nextDay)}>
          Next day with room: {formatDayHeader(plan.weekStartDate, nextDay)} →
        </button>
      )}

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
                    tapEligible={canPlaceEntryInCell(selectedEntry, type, occupants, plan)}
                    placingName={selectedEntry?.name}
                    cellLabel={`${person.name}, ${MEAL_TYPE_LABELS[type]}, ${formatDayHeader(plan.weekStartDate, day)}`}
                    occupants={occupants}
                    onClear={onClear}
                    onReweight={onReweight}
                    onTapPlace={onTapPlace}
                    plan={plan}
                    compact
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
