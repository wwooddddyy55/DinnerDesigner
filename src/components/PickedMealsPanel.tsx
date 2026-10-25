import { useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { CAPACITY_EPSILON, formatServingCount, getEntryConsumedServings } from '../lib/calculations'
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

/** "Servings left" number input that keeps its own text while being edited,
 * so clearing the field to retype doesn't snap it to 0 — a value is only
 * committed when it parses as a number (the store still clamps it), and the
 * field shows the stored value again once it loses focus. */
function ServingsLeftInput({ value, max, onCommit }: { value: number; max: number; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      type="number"
      className={styles.leftoverServingsInput}
      min={0}
      max={max}
      value={draft ?? String(value)}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = Number(e.target.value)
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n)
      }}
      onBlur={() => setDraft(null)}
    />
  )
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
  const fullyPlaced = placed >= entry.totalServings - CAPACITY_EPSILON
  const overCapacity = placed > entry.totalServings + CAPACITY_EPSILON
  const servingsLeft = entry.totalServings - (entry.leftoverServingsUsed ?? 0)
  const needsPlacing = placed <= (entry.leftoverServingsUsed ?? 0) + CAPACITY_EPSILON && !fullyPlaced

  return (
    <div
      ref={setNodeRef}
      className={`card ${styles.pickedRow} ${isDragging ? styles.pickedRowDragging : ''} ${selected ? styles.pickedRowSelected : ''}`}
      onClick={() => onSelect(entry.id)}
    >
      <button
        type="button"
        className={styles.dragHandle}
        aria-label={`Drag ${entry.name} to place it`}
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
        <span
          className={`badge ${overCapacity ? styles.placedOver : fullyPlaced ? styles.placedMet : needsPlacing ? styles.placedNone : ''}`}
          title={
            overCapacity
              ? 'More servings are placed than this batch makes — usually after removing something from a shared cell. Remove a placement or use the +/− stepper to fix it.'
              : undefined
          }
        >
          {formatServingCount(placed)}/{entry.totalServings} placed
          {overCapacity ? ' — over batch size' : needsPlacing ? ' — needs placing' : fullyPlaced ? ' ✓' : ''}
        </span>
        <label className={styles.checkboxLabel} onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={entry.isLeftover ?? false}
            onChange={(e) => onSetLeftover(entry.id, e.target.checked)}
          />
          Already cooked last week (carry-over)
        </label>
        {entry.isLeftover && (
          <label className={styles.leftoverServingsLabel} onClick={(e) => e.stopPropagation()}>
            Servings left
            <ServingsLeftInput
              value={servingsLeft}
              max={entry.totalServings}
              onCommit={(n) => onSetServingsLeft(entry.id, n)}
            />
            / {entry.totalServings}
          </label>
        )}
      </div>
      <div className={styles.cardActions}>
        {!fullyPlaced && (
          <button
            type="button"
            className={`button ${selected ? '' : 'buttonSecondary'}`}
            aria-pressed={selected}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(entry.id)
            }}
          >
            {selected ? 'Choosing cell…' : 'Place'}
          </button>
        )}
        <button
          type="button"
          className="button buttonDanger"
          aria-label={`Remove ${entry.name} from this week`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove(entry.id)
          }}
        >
          Remove
        </button>
      </div>
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
        {plan.plannedMeals.length === 0 && (
          <p className={styles.emptyState}>
            Nothing picked yet. Use <strong>+ Add</strong> on a meal in <strong>Choose meals</strong>, then place
            its servings on the grid.
          </p>
        )}
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
