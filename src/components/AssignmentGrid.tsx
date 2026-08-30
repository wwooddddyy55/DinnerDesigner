import { Fragment } from 'react'
import { useDroppable } from '@dnd-kit/core'
import {
  canSetAssignmentWeight,
  findCellAssignments,
  getAssignmentFraction,
  isCellAvailable,
} from '../lib/calculations'
import { formatDayHeader } from '../lib/date'
import { cellDroppableId } from '../lib/dragDrop'
import { MAX_ASSIGNMENT_WEIGHT, MAX_CELL_OCCUPANTS, MEAL_TYPE_LABELS, MIN_ASSIGNMENT_WEIGHT } from '../types'
import type { PlannedMealEntry, MealType, WeeklyPlan } from '../types'
import styles from './AssignmentGrid.module.css'

interface AssignmentGridProps {
  plan: WeeklyPlan
  draggingEntryId: string | null
  onClear: (entryId: string, assignmentId: string) => void
  onReweight: (entryId: string, assignmentId: string, weight: number) => void
}

const DAYS = [0, 1, 2, 3, 4, 5, 6]

interface CellProps {
  personId: string
  mealType: MealType
  day: number
  available: boolean
  droppable: boolean
  occupants: { entry: PlannedMealEntry; assignment: PlannedMealEntry['assignments'][number] }[]
  onClear: (entryId: string, assignmentId: string) => void
  onReweight: (entryId: string, assignmentId: string, weight: number) => void
  plan: WeeklyPlan
}

function Cell({ personId, mealType, day, available, droppable, occupants, onClear, onReweight, plan }: CellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: cellDroppableId(personId, mealType, day),
    disabled: !available || !droppable,
  })

  if (!available) {
    return <div className={`${styles.cell} ${styles.cellDisabled}`} aria-disabled="true" title="Not available" />
  }

  if (occupants.length > 0) {
    const occupantAssignments = occupants.map((o) => o.assignment)
    return (
      <div
        ref={setNodeRef}
        className={`${styles.cell} ${styles.cellFilled} ${droppable && isOver ? styles.cellOver : ''}`}
      >
        {occupants.map(({ entry, assignment }) => {
          const fraction = getAssignmentFraction(assignment, occupantAssignments)
          const canDecrease =
            assignment.weight > MIN_ASSIGNMENT_WEIGHT &&
            canSetAssignmentWeight(plan, assignment.id, assignment.weight - 1)
          const canIncrease =
            assignment.weight < MAX_ASSIGNMENT_WEIGHT &&
            canSetAssignmentWeight(plan, assignment.id, assignment.weight + 1)
          return (
            <div className={styles.occupantRow} key={assignment.id} title={entry.name}>
              <div className={styles.occupantTop}>
                <span className={styles.occupantName}>{entry.name}</span>
                <button
                  type="button"
                  className={styles.clearButton}
                  onClick={() => onClear(entry.id, assignment.id)}
                  aria-label={`Remove ${entry.name}`}
                >
                  &times;
                </button>
              </div>
              <div className={styles.occupantMeta}>
                <span className={styles.occupantFraction}>{Math.round(fraction * 100)}%</span>
                {occupants.length > 1 && (
                  <span className={styles.weightStepper}>
                    <button
                      type="button"
                      disabled={!canDecrease}
                      onClick={() => onReweight(entry.id, assignment.id, assignment.weight - 1)}
                      aria-label={`Decrease ${entry.name}'s share`}
                    >
                      &minus;
                    </button>
                    <button
                      type="button"
                      disabled={!canIncrease}
                      onClick={() => onReweight(entry.id, assignment.id, assignment.weight + 1)}
                      aria-label={`Increase ${entry.name}'s share`}
                    >
                      +
                    </button>
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cell} ${styles.cellEmpty} ${droppable && isOver ? styles.cellOver : ''}`}
    />
  )
}

export function AssignmentGrid({ plan, draggingEntryId, onClear, onReweight }: AssignmentGridProps) {
  const draggingEntry = plan.plannedMeals.find((e) => e.id === draggingEntryId)

  function canDrop(occupants: { entry: PlannedMealEntry }[], mealType: MealType): boolean {
    if (!draggingEntry || !draggingEntry.mealTypes.includes(mealType)) return false
    if (occupants.length >= MAX_CELL_OCCUPANTS) return false
    return !occupants.some((o) => o.entry.id === draggingEntry.id)
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
                      <Cell
                        key={day}
                        personId={person.id}
                        mealType={type}
                        day={day}
                        available={available}
                        droppable={canDrop(occupants, type)}
                        occupants={occupants}
                        onClear={onClear}
                        onReweight={onReweight}
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
