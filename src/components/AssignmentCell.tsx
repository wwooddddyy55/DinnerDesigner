import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import type { KeyboardEvent } from 'react'
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
  /** Human-readable cell location, e.g. "Alex, Dinner, Mon 9/1", for screen
   * readers (the visual grid conveys it by position only). */
  cellLabel?: string
  /** Name of the meal currently selected for placing, for the tap target's label. */
  placingName?: string
  /** Phone layout: each occupant's −/+ share stepper stays hidden until its
   * % chip is tapped, keeping combined cells short. */
  compact?: boolean
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
  cellLabel,
  placingName,
  compact = false,
}: AssignmentCellProps) {
  const [editingShares, setEditingShares] = useState(false)
  const { isOver, setNodeRef } = useDroppable({
    id: dropId,
    disabled: !available || !droppable,
  })

  if (!available) {
    return (
      <div
        className={`${styles.cell} ${styles.cellDisabled}`}
        aria-disabled="true"
        title="Not available"
        aria-label={cellLabel ? `${cellLabel}: not available` : 'Not available'}
        role="img"
      >
        <span className={styles.unavailableText}>—</span>
      </div>
    )
  }

  const canTap = tapEligible
  const handleTap = canTap ? () => onTapPlace(personId, mealType, day) : undefined
  // Tap targets are real keyboard-operable buttons: focusable, activated by
  // Enter/Space, and labelled with where the meal will go.
  const tapProps = canTap
    ? {
        role: 'button' as const,
        tabIndex: 0,
        'aria-label': `Place ${placingName ?? 'selected meal'}${cellLabel ? ` on ${cellLabel}` : ''}`,
        onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
          if (e.target !== e.currentTarget) return
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onTapPlace(personId, mealType, day)
          }
        },
      }
    : {}

  if (occupants.length > 0) {
    const occupantAssignments = occupants.map((o) => o.assignment)
    const showSteppers = occupants.length > 1 && (!compact || editingShares)
    // A filled cell holds its own remove/reweight buttons, so it is never
    // itself the place target: a separate "+ Place here" row is, which keeps a
    // stray tap on × or −/+ from adding the selected meal too.
    return (
      <div
        ref={setNodeRef}
        className={`${styles.cell} ${styles.cellFilled} ${droppable && isOver ? styles.cellOver : ''} ${canTap ? styles.cellTapEligible : ''}`}
      >
        {occupants.map(({ entry, assignment }) => {
          const fraction = getAssignmentFraction(assignment, occupantAssignments)
          const canDecrease =
            assignment.weight > MIN_ASSIGNMENT_WEIGHT &&
            canSetAssignmentWeight(plan, assignment.id, assignment.weight - 1)
          const canIncrease =
            assignment.weight < MAX_ASSIGNMENT_WEIGHT &&
            canSetAssignmentWeight(plan, assignment.id, assignment.weight + 1)
          const percent = `${Math.round(fraction * 100)}%`
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
                {compact && occupants.length > 1 ? (
                  <button
                    type="button"
                    className={styles.shareChip}
                    aria-expanded={editingShares}
                    aria-label={`${entry.name}: ${percent} of this meal. ${editingShares ? 'Hide' : 'Adjust'} shares`}
                    onClick={(e) => {
                      e.stopPropagation()
                      setEditingShares((v) => !v)
                    }}
                  >
                    {percent} {editingShares ? '▴' : '▾'}
                  </button>
                ) : (
                  <span className={styles.occupantFraction}>{percent}</span>
                )}
                {showSteppers && (
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
        {canTap && (
          <div className={styles.placeRow} onClick={handleTap} {...tapProps}>
            + Place {placingName ?? 'here'} too
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      className={`${styles.cell} ${styles.cellEmpty} ${droppable && isOver ? styles.cellOver : ''} ${canTap ? styles.cellTapEligible : ''}`}
      onClick={handleTap}
      aria-label={canTap ? undefined : cellLabel ? `${cellLabel}: empty` : undefined}
      {...tapProps}
    >
      {canTap && <span className={styles.tapHint}>+ Place here</span>}
    </div>
  )
}
