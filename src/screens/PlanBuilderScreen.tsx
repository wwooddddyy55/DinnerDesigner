import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { AssignmentGrid } from '../components/AssignmentGrid'
import { MealTypeFilterChips } from '../components/MealTypeFilterChips'
import { ProgressBar } from '../components/ProgressBar'
import { ProteinFilterChips } from '../components/ProteinFilterChips'
import {
  formatServingCount,
  getEntryConsumedServings,
  getMealTypePicked,
  getMealTypeTarget,
  isEntryFullyPlaced,
} from '../lib/calculations'
import { parseCellDroppableId } from '../lib/dragDrop'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { MealType, ProteinType, WeeklyPlan } from '../types'
import styles from './PlanBuilderScreen.module.css'

interface PlanBuilderScreenProps {
  plan: WeeklyPlan
}

interface PickedMealCardProps {
  plan: WeeklyPlan
  entry: WeeklyPlan['plannedMeals'][number]
  onRemove: (entryId: string) => void
  onSetLeftover: (entryId: string, isLeftover: boolean) => void
  onSetServingsLeft: (entryId: string, servingsLeft: number) => void
}

function PickedMealCard({ plan, entry, onRemove, onSetLeftover, onSetServingsLeft }: PickedMealCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.id })
  const placed = getEntryConsumedServings(plan, entry)
  const fullyPlaced = isEntryFullyPlaced(plan, entry)
  const servingsLeft = entry.totalServings - (entry.leftoverServingsUsed ?? 0)

  return (
    <div
      ref={setNodeRef}
      className={`card ${styles.pickedRow} ${isDragging ? styles.pickedRowDragging : ''}`}
      {...attributes}
      {...listeners}
    >
      <div className={styles.pickerInfo}>
        <strong>{entry.name}</strong>
        <span className={styles.pickerMeta}>
          {proteinLabel(entry.protein, entry.proteinCustomLabel)} · {entry.totalServings} servings/batch
        </span>
        <span className={`badge ${fullyPlaced ? styles.placedMet : ''}`}>
          {formatServingCount(placed)}/{entry.totalServings} placed
        </span>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={entry.isLeftover ?? false}
            onChange={(e) => onSetLeftover(entry.id, e.target.checked)}
          />
          Leftover from last week
        </label>
        {entry.isLeftover && (
          <label className={styles.leftoverServingsLabel}>
            Servings left
            <input
              type="number"
              className={styles.leftoverServingsInput}
              min={0}
              max={entry.totalServings}
              value={servingsLeft}
              onChange={(e) => onSetServingsLeft(entry.id, Number(e.target.value))}
            />
            / {entry.totalServings}
          </label>
        )}
      </div>
      <button type="button" className="button buttonDanger" onClick={() => onRemove(entry.id)}>
        Remove
      </button>
    </div>
  )
}

export function PlanBuilderScreen({ plan }: PlanBuilderScreenProps) {
  const meals = useAppStore((s) => s.meals)
  const addPlannedMeal = useAppStore((s) => s.addPlannedMeal)
  const removePlannedMeal = useAppStore((s) => s.removePlannedMeal)
  const setEntryLeftover = useAppStore((s) => s.setEntryLeftover)
  const setEntryServingsLeft = useAppStore((s) => s.setEntryServingsLeft)
  const assignMealToCell = useAppStore((s) => s.assignMealToCell)
  const clearAssignment = useAppStore((s) => s.clearAssignment)
  const setAssignmentWeight = useAppStore((s) => s.setAssignmentWeight)

  const [mealTypeFilter, setMealTypeFilter] = useState<MealType[]>([])
  const [proteinFilter, setProteinFilter] = useState<ProteinType[]>([])
  const [draggingEntryId, setDraggingEntryId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Delay + tolerance lets a normal swipe still scroll the grid; only a
    // press-and-hold starts a drag, so touch scrolling isn't hijacked.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingEntryId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingEntryId(null)
    if (!event.over) return
    const { personId, mealType, day } = parseCellDroppableId(String(event.over.id))
    assignMealToCell(plan.id, String(event.active.id), personId, mealType, day)
  }

  if (plan.selectedMealTypes.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyState}>
          Select at least one meal type on the Weekly Setup screen to start building a plan.
        </p>
      </div>
    )
  }

  const availableMeals = meals.filter((meal) => {
    const eligibleTypes = meal.mealTypes.filter((t) => plan.selectedMealTypes.includes(t))
    if (eligibleTypes.length === 0) return false
    if (mealTypeFilter.length > 0 && !eligibleTypes.some((t) => mealTypeFilter.includes(t))) return false
    if (proteinFilter.length > 0 && !proteinFilter.includes(meal.protein)) return false
    return true
  })

  function toggleMealType(type: MealType) {
    setMealTypeFilter((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  function toggleProtein(protein: ProteinType) {
    setProteinFilter((prev) =>
      prev.includes(protein) ? prev.filter((p) => p !== protein) : [...prev, protein],
    )
  }

  const draggingEntry = plan.plannedMeals.find((e) => e.id === draggingEntryId)

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.page}>
        <h2>Plan builder</h2>

        <div className={styles.layout}>
          <div className={styles.sidebar}>
            <h3>Choose meals</h3>
            <MealTypeFilterChips
              types={plan.selectedMealTypes}
              selected={mealTypeFilter}
              onToggle={toggleMealType}
              onClear={() => setMealTypeFilter([])}
            />
            <ProteinFilterChips
              selected={proteinFilter}
              onToggle={toggleProtein}
              onClear={() => setProteinFilter([])}
            />
            <div className={styles.pickerList}>
              {availableMeals.length === 0 && (
                <p className={styles.emptyState}>
                  No meals match this meal type / protein filter yet.
                </p>
              )}
              {availableMeals.map((meal) => (
                <div className={`card ${styles.pickerRow}`} key={meal.id}>
                  <div className={styles.pickerInfo}>
                    <strong>{meal.name}</strong>
                    <span className={styles.pickerMeta}>
                      {proteinLabel(meal.protein, meal.proteinCustomLabel)} ·{' '}
                      {meal.servingsPerBatch} servings/batch ·{' '}
                      {meal.mealTypes
                        .filter((t) => plan.selectedMealTypes.includes(t))
                        .map((t) => MEAL_TYPE_LABELS[t])
                        .join(', ')}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="button buttonSecondary"
                    onClick={() => addPlannedMeal(plan.id, meal)}
                  >
                    + Add
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.main}>
            <div className={`card ${styles.progressCard}`}>
              <div className={styles.progressRow}>
                {plan.selectedMealTypes.map((type) => (
                  <ProgressBar
                    key={type}
                    picked={getMealTypePicked(plan, type)}
                    target={getMealTypeTarget(plan, type)}
                    label={MEAL_TYPE_LABELS[type]}
                  />
                ))}
              </div>
            </div>

            <div>
              <h3>Picked meals</h3>
              <div className={styles.pickedList}>
                {plan.plannedMeals.length === 0 && (
                  <p className={styles.emptyState}>Nothing picked yet.</p>
                )}
                {plan.plannedMeals.map((entry) => (
                  <PickedMealCard
                    key={entry.id}
                    plan={plan}
                    entry={entry}
                    onRemove={(entryId) => removePlannedMeal(plan.id, entryId)}
                    onSetLeftover={(entryId, isLeftover) => setEntryLeftover(plan.id, entryId, isLeftover)}
                    onSetServingsLeft={(entryId, servingsLeft) =>
                      setEntryServingsLeft(plan.id, entryId, servingsLeft)
                    }
                  />
                ))}
              </div>
            </div>

            <div className={styles.assignmentSection}>
              <h3>Assignment grid</h3>
              <p className={styles.emptyState}>
                Drag a picked meal card onto a person's day/meal cell to place a serving. A cell can
                hold up to 4 combined items (e.g. lasagna + chips) — drop another card onto an
                already-filled cell to add it; each item's share of its own batch shrinks to fit
                evenly by default, adjustable with the +/− stepper. Click an item's × to remove it —
                the rest rebalance automatically.
              </p>
              <AssignmentGrid
                plan={plan}
                draggingEntryId={draggingEntryId}
                onClear={(entryId, assignmentId) => clearAssignment(plan.id, entryId, assignmentId)}
                onReweight={(entryId, assignmentId, weight) =>
                  setAssignmentWeight(plan.id, entryId, assignmentId, weight)
                }
              />
            </div>
          </div>
        </div>
      </div>
      <DragOverlay>
        {draggingEntry && (
          <div className={`card ${styles.pickedRow} ${styles.pickedRowOverlay}`}>
            <div className={styles.pickerInfo}>
              <strong>{draggingEntry.name}</strong>
              <span className={styles.pickerMeta}>
                {proteinLabel(draggingEntry.protein, draggingEntry.proteinCustomLabel)} ·{' '}
                {draggingEntry.totalServings} servings/batch
              </span>
            </div>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
