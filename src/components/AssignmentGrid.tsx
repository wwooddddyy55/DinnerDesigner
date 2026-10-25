import { Fragment } from 'react'
import { canPlaceEntryInCell, findCellAssignments, isCellAvailable } from '../lib/calculations'
import { formatDayHeader } from '../lib/date'
import { cellDroppableId } from '../lib/dragDrop'
import { MEAL_TYPE_LABELS } from '../types'
import type { MealType, PlannedMealEntry, WeeklyPlan } from '../types'
import { AssignmentCell } from './AssignmentCell'
import styles from './AssignmentGrid.module.css'

interface AssignmentGridProps {
  plan: WeeklyPlan
  draggingEntryId: string | null
  /** Entry chosen via a card's "Place" button: eligible cells become
   * clickable/keyboard-activatable (the desktop/keyboard counterpart of
   * mobile tap-to-place). */
  selectedEntryId: string | null
  onTapPlace: (personId: string, mealType: MealType, day: number) => void
  onClear: (entryId: string, assignmentId: string) => void
  onReweight: (entryId: string, assignmentId: string, weight: number) => void
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]

export function AssignmentGrid({
  plan,
  draggingEntryId,
  selectedEntryId,
  onTapPlace,
  onClear,
  onReweight,
}: AssignmentGridProps) {
  const draggingEntry = plan.plannedMeals.find((e) => e.id === draggingEntryId)
  const selectedEntry = plan.plannedMeals.find((e) => e.id === selectedEntryId)

  function canDrop(occupants: { entry: PlannedMealEntry }[], mealType: MealType): boolean {
    return canPlaceEntryInCell(draggingEntry, mealType, occupants)
  }

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
                    const occupants = findCellAssignments(plan, person.id, day, type)
                    return (
                      <AssignmentCell
                        key={day}
                        dropId={cellDroppableId(person.id, type, day)}
                        personId={person.id}
                        mealType={type}
                        day={day}
                        available={available}
                        droppable={canDrop(occupants, type)}
                        tapEligible={!draggingEntry && canPlaceEntryInCell(selectedEntry, type, occupants)}
                        placingName={selectedEntry?.name}
                        cellLabel={`${person.name}, ${MEAL_TYPE_LABELS[type]}, ${formatDayHeader(plan.weekStartDate, day)}`}
                        occupants={occupants}
                        onClear={onClear}
                        onReweight={onReweight}
                        onTapPlace={onTapPlace}
                        plan={plan}
                      />
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
