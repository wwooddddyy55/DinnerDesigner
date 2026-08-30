import { useDroppable } from '@dnd-kit/core'
import {
  canSetAssignmentWeight,
  getAssignmentFraction,
} from '../lib/calculations'
import { MAX_ASSIGNMENT_WEIGHT, MIN_ASSIGNMENT_WEIGHT } from '../types'
import type { PlannedMealEntry, MealType, WeeklyPlan } from '../types'
import styles from './AssignmentCell.module.css'

export interface AssignmentCellProps {
  /** dnd-kit droppable id for this cell. Two `AssignmentCell`s rendered at
   * once for the same (person, mealType, day) — e.g. the desktop grid and the
   * mobile day view, both always mounted, visibility toggled by CSS only —
   * MUST use distinct ids, or dnd-kit's shared droppable registry lets the
   * later-mounted one silently clobber the earlier one's node/rect, breaking
   * drop detection on whichever one loses. Only an id produced by
   * `cellDroppableId` (see `lib/dragDrop.ts`) is understood by `onDragEnd`. */
  dropId: string
  personId: string
  mealType: MealType
  day: number
  available: boolean
  droppable: boolean
  tapEligible: boolean
  occupants: { entry: PlannedMealEntry; assignment: PlannedMealEntry['assignments'][number] }[]
  onClear: (entryId: string, assignmentId: string) => void
  onReweight: (entryId: string, assignmentId: string, weight: number) => void
  onTapPlace: (personId: string, mealType: MealType, day: number) => void
  plan: WeeklyPlan
}

export function AssignmentCell({
  dropId,
  personId,
  mealType,
  day,
  available,
  droppable,
  tapEligible,
  occupants,
  onClear,
  onReweight,
  onTapPlace,
  plan,
}: AssignmentCellProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: !available || !droppable,
  })

  if (!available) {
    return <div className={`${styles.cell} ${styles.cellDisabled}`} aria-disabled="true" title="Not available" />
  }

  const canTap = tapEligible
  const handleTap = canTap ? () => onTapPlace(personId, mealType, day) : undefined

  if (occupants.length > 0) {
    const occupantAssignments = occupants.map((o) => o.assignment)
    return (
      <div
        ref={setNodeRef}
        className={`${styles.cell} ${styles.cellFilled} ${droppable && isOver ? styles.cellOver : ''} ${canTap ? styles.cellTapEligible : ''}`}
        onClick={handleTap}
        role={canTap ? 'button' : undefined}
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
                  onClick={(e) => {
                    e.stopPropagation()
                    onClear(entry.id, assignment.id)
                  }}
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
                      onClick={(e) => {
                        e.stopPropagation()
                        onReweight(entry.id, assignment.id, assignment.weight - 1)
                      }}
                      aria-label={`Decrease ${entry.name}'s share`}
                    >
                      &minus;
                    </button>
                    <button
                      type="button"
                      disabled={!canIncrease}
                      onClick={(e) => {
                        e.stopPropagation()
                        onReweight(entry.id, assignment.id, assignment.weight + 1)
                      }}
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
      className={`${styles.cell} ${styles.cellEmpty} ${droppable && isOver ? styles.cellOver : ''} ${canTap ? styles.cellTapEligible : ''}`}
      onClick={handleTap}
      role={canTap ? 'button' : undefined}
    />
  )
}
