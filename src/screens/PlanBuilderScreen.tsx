import { useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core'
import { AssignmentDayView } from '../components/AssignmentDayView'
import { AssignmentGrid } from '../components/AssignmentGrid'
import { MealPickerPanel } from '../components/MealPickerPanel'
import { PickedMealsPanel } from '../components/PickedMealsPanel'
import { ProgressBar } from '../components/ProgressBar'
import { getMealTypePicked, getMealTypeTarget } from '../lib/calculations'
import { parseCellDroppableId, parsePickedEntryDraggableId } from '../lib/dragDrop'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { MealType, ProteinType, WeeklyPlan } from '../types'
import styles from './PlanBuilderScreen.module.css'

interface PlanBuilderScreenProps {
  plan: WeeklyPlan
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
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null)
  const [activeMobileTab, setActiveMobileTab] = useState<'pick' | 'assign'>('pick')
  const [selectedDay, setSelectedDay] = useState(0)
  // Same breakpoint as the rest of the app's CSS. Only the matching layout is
  // mounted, so the picker/picked panels and grid render (and recompute) once.
  const isMobile = useMediaQuery('(max-width: 700px)')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // Delay + tolerance lets a normal swipe still scroll the grid; only a
    // press-and-hold starts a drag, so touch scrolling isn't hijacked.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
  )

  function handleDragStart(event: DragStartEvent) {
    setDraggingEntryId(parsePickedEntryDraggableId(String(event.active.id)))
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingEntryId(null)
    if (!event.over) return
    const { personId, mealType, day } = parseCellDroppableId(String(event.over.id))
    const entryId = parsePickedEntryDraggableId(String(event.active.id))
    assignMealToCell(plan.id, entryId, personId, mealType, day)
  }

  function handleSelectEntry(entryId: string) {
    setSelectedEntryId((prev) => {
      const next = prev === entryId ? null : entryId
      if (next) setActiveMobileTab('assign')
      return next
    })
  }

  function handleTapPlace(personId: string, mealType: MealType, day: number) {
    if (!selectedEntryId) return
    assignMealToCell(plan.id, selectedEntryId, personId, mealType, day)
    setSelectedEntryId(null)
  }

  function handleRemove(entryId: string) {
    removePlannedMeal(plan.id, entryId)
    setSelectedEntryId((prev) => (prev === entryId ? null : prev))
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

  const progressBars = (
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
  )

  const scope = isMobile ? 'mobile' : 'desktop'

  const mealPicker = (
    <MealPickerPanel
      plan={plan}
      availableMeals={availableMeals}
      mealTypeFilter={mealTypeFilter}
      proteinFilter={proteinFilter}
      onToggleMealType={toggleMealType}
      onToggleProtein={toggleProtein}
      onClearMealTypeFilter={() => setMealTypeFilter([])}
      onClearProteinFilter={() => setProteinFilter([])}
      onAdd={(meal) => addPlannedMeal(plan.id, meal)}
    />
  )

  const pickedMeals = (
    <PickedMealsPanel
      plan={plan}
      scope={scope}
      selectedEntryId={selectedEntryId}
      onSelect={handleSelectEntry}
      onRemove={handleRemove}
      onSetLeftover={(entryId, isLeftover) => setEntryLeftover(plan.id, entryId, isLeftover)}
      onSetServingsLeft={(entryId, servingsLeft) => setEntryServingsLeft(plan.id, entryId, servingsLeft)}
    />
  )

  const cellHandlers = {
    onClear: (entryId: string, assignmentId: string) => clearAssignment(plan.id, entryId, assignmentId),
    onReweight: (entryId: string, assignmentId: string, weight: number) =>
      setAssignmentWeight(plan.id, entryId, assignmentId, weight),
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className={styles.page}>
        <h2>Plan builder</h2>

        {!isMobile && (
          <div className={styles.layout}>
            <div className={styles.sidebar}>{mealPicker}</div>

            <div className={styles.main}>
              {progressBars}
              {pickedMeals}

              <div className={styles.assignmentSection}>
                <h3>Assignment grid</h3>
                <p className={styles.emptyState}>
                  Drag a picked meal card onto a person's day/meal cell to place a serving. A cell can
                  hold up to 4 combined items (e.g. lasagna + chips) — drop another card onto an
                  already-filled cell to add it; each item's share of its own batch shrinks to fit
                  evenly by default, adjustable with the +/− stepper. Click an item's × to remove it —
                  the rest rebalance automatically.
                </p>
                <AssignmentGrid plan={plan} draggingEntryId={draggingEntryId} {...cellHandlers} />
              </div>
            </div>
          </div>
        )}

        {isMobile && (
          <div>
            <div className={styles.mobileTabs}>
              <button
                type="button"
                className={`${styles.mobileTab} ${activeMobileTab === 'pick' ? styles.mobileTabActive : ''}`}
                onClick={() => setActiveMobileTab('pick')}
              >
                Pick meals
              </button>
              <button
                type="button"
                className={`${styles.mobileTab} ${activeMobileTab === 'assign' ? styles.mobileTabActive : ''}`}
                onClick={() => setActiveMobileTab('assign')}
              >
                Assign
              </button>
            </div>

            {activeMobileTab === 'pick' && (
              <>
                {mealPicker}
                {pickedMeals}
              </>
            )}

            {activeMobileTab === 'assign' && (
              <>
                {progressBars}
                <p className={styles.emptyState}>
                  {selectedEntryId
                    ? 'Tap a highlighted cell to place the selected meal.'
                    : "Tap a picked meal on the \"Pick meals\" tab to select it, then come back here and tap a cell."}
                </p>
                <AssignmentDayView
                  plan={plan}
                  day={selectedDay}
                  onDayChange={setSelectedDay}
                  selectedEntryId={selectedEntryId}
                  onTapPlace={handleTapPlace}
                  {...cellHandlers}
                />
              </>
            )}
          </div>
        )}
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
