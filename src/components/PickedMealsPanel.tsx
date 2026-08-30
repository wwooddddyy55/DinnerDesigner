import { useDraggable } from '@dnd-kit/core'
import { formatServingCount, getEntryConsumedServings, isEntryFullyPlaced } from '../lib/calculations'
import { pickedEntryDraggableId } from '../lib/dragDrop'
import { proteinLabel } from '../types'
import type { WeeklyPlan } from '../types'
import styles from '../screens/PlanBuilderScreen.module.css'

interface PickedMealCardProps {
  plan: WeeklyPlan
  entry: WeeklyPlan['plannedMeals'][number]
  scope: 'desktop' | 'mobile'
  selected: boolean
  onSelect: (entryId: string) => void
  onRemove: (entryId: string) => void
  onSetLeftover: (entryId: string, isLeftover: boolean) => void
  onSetServingsLeft: (entryId: string, servingsLeft: number) => void
}

function PickedMealCard({
  plan,
  entry,
  scope,
  selected,
  onSelect,
  onRemove,
  onSetLeftover,
  onSetServingsLeft,
}: PickedMealCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: pickedEntryDraggableId(scope, entry.id),
  })
  const placed = getEntryConsumedServings(plan, entry)
  const fullyPlaced = isEntryFullyPlaced(plan, entry)
  const servingsLeft = entry.totalServings - (entry.leftoverServingsUsed ?? 0)

  return (
    <div
      ref={setNodeRef}
      className={`card ${styles.pickedRow} ${isDragging ? styles.pickedRowDragging : ''} ${selected ? styles.pickedRowSelected : ''}`}
      onClick={() => onSelect(entry.id)}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label="Drag to place"
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
      >
        ⠿
      </button>
      <div className={styles.pickerInfo}>
        <strong>{entry.name}</strong>
        <span className={styles.pickerMeta}>
          {proteinLabel(entry.protein, entry.proteinCustomLabel)} · {entry.totalServings} servings/batch
        </span>
        <span className={`badge ${fullyPlaced ? styles.placedMet : ''}`}>
          {formatServingCount(placed)}/{entry.totalServings} placed
        </span>
        <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={entry.isLeftover ?? false}
            onChange={(e) => onSetLeftover(entry.id, e.target.checked)}
          />
          Leftover from last week
        </label>
        {entry.isLeftover && (
          <label className={styles.leftoverServingsLabel} onClick={(e) => e.stopPropagation()}>
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
      <button
        type="button"
        className="button buttonDanger"
        onClick={(e) => {
          e.stopPropagation()
          onRemove(entry.id)
        }}
      >
        Remove
      </button>
    </div>
  )
}

interface PickedMealsPanelProps {
  plan: WeeklyPlan
  scope: 'desktop' | 'mobile'
  selectedEntryId: string | null
  onSelect: (entryId: string) => void
  onRemove: (entryId: string) => void
  onSetLeftover: (entryId: string, isLeftover: boolean) => void
  onSetServingsLeft: (entryId: string, servingsLeft: number) => void
}

export function PickedMealsPanel({
  plan,
  scope,
  selectedEntryId,
  onSelect,
  onRemove,
  onSetLeftover,
  onSetServingsLeft,
}: PickedMealsPanelProps) {
  return (
    <div>
      <h3>Picked meals</h3>
      <div className={styles.pickedList}>
        {plan.plannedMeals.length === 0 && <p className={styles.emptyState}>Nothing picked yet.</p>}
        {plan.plannedMeals.map((entry) => (
          <PickedMealCard
            key={entry.id}
            plan={plan}
            entry={entry}
            scope={scope}
            selected={entry.id === selectedEntryId}
            onSelect={onSelect}
            onRemove={onRemove}
            onSetLeftover={onSetLeftover}
            onSetServingsLeft={onSetServingsLeft}
          />
        ))}
      </div>
    </div>
  )
}
