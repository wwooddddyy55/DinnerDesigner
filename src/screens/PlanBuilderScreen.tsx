import { useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
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
import { getMealTypePicked, getMealTypeTarget, getOpenCells } from '../lib/calculations'
import { formatDayHeader } from '../lib/date'
import { parseCellDroppableId, parsePickedEntryDraggableId } from '../lib/dragDrop'
import { getMealServedIndex, matchesMealSearch, sortMeals } from '../lib/mealSearch'
import type { MealSort } from '../lib/mealSearch'
import { offerUndo } from '../lib/undo'
import { useMediaQuery } from '../lib/useMediaQuery'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import type { MealType, ProteinType, WeeklyPlan } from '../types'
import styles from './PlanBuilderScreen.module.css'

const MAX_OPEN_CELLS_LISTED = 4

/** "Still empty: Alex Tue 9/2, Sam Thu 9/4 and 3 more" for a progress bar. */
function describeOpenCells(plan: WeeklyPlan, mealType: MealType): string | undefined {
  const open = getOpenCells(plan, mealType)
  if (open.length === 0) return undefined
  const multiplePeople = plan.people.length > 1
  const listed = open
    .slice(0, MAX_OPEN_CELLS_LISTED)
    .map(({ person, day }) => `${multiplePeople ? `${person.name} ` : ''}${formatDayHeader(plan.weekStartDate, day)}`)
  const more = open.length - listed.length
  return `Still empty: ${listed.join(', ')}${more > 0 ? ` and ${more} more` : ''}`
}

interface PlanBuilderScreenProps {
  plan: WeeklyPlan
}

export function PlanBuilderScreen({ plan }: PlanBuilderScreenProps) {
  const meals = useAppStore((s) => s.meals)
  const plans = useAppStore((s) => s.plans)
  const restorePlan = useAppStore((s) => s.restorePlan)
  const addPlannedMeal = useAppStore((s) => s.addPlannedMeal)
  const removePlannedMeal = useAppStore((s) => s.removePlannedMeal)
  const setEntryLeftover = useAppStore((s) => s.setEntryLeftover)
  const setEntryServingsLeft = useAppStore((s) => s.setEntryServingsLeft)
  const assignMealToCell = useAppStore((s) => s.assignMealToCell)
  const clearAssignment = useAppStore((s) => s.clearAssignment)
  const setAssignmentWeight = useAppStore((s) => s.setAssignmentWeight)

  const [mealTypeFilter, setMealTypeFilter] = useState<MealType[]>([])
  const [proteinFilter, setProteinFilter] = useState<ProteinType[]>([])
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<MealSort>('least-recent')
  // Staleness is measured against weeks *before* this one, so meals already
  // picked into this week don't all read "This week" while you're picking.
  const served = useMemo(
    () => getMealServedIndex(plans.filter((p) => p.weekStartDate < plan.weekStartDate)),
    [plans, plan.weekStartDate],
  )
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
    // Space/Enter on a card's drag handle picks it up, arrow keys move it,
    // Space/Enter drops — what dnd-kit's built-in screen-reader instructions
    // on the handle promise.
    useSensor(KeyboardSensor),
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
    const index = plan.plannedMeals.findIndex((e) => e.id === entryId)
    const entry = plan.plannedMeals[index]
    removePlannedMeal(plan.id, entryId)
    setSelectedEntryId((prev) => (prev === entryId ? null : prev))
    if (!entry) return
    // Re-insert just this entry into the plan as it is *at undo time*, so any
    // other edits made in the meantime survive the undo.
    offerUndo(`Removed ${entry.name}.`, () => {
      const current = useAppStore.getState().plans.find((p) => p.id === plan.id)
      if (!current || current.plannedMeals.some((e) => e.id === entry.id)) return
      const plannedMeals = [...current.plannedMeals]
      plannedMeals.splice(Math.min(index, plannedMeals.length), 0, entry)
      restorePlan({ ...current, plannedMeals })
    })
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

  const eligibleMeals = meals.filter((meal) => meal.mealTypes.some((t) => plan.selectedMealTypes.includes(t)))
  const availableMeals = sortMeals(
    eligibleMeals.filter((meal) => {
      const eligibleTypes = meal.mealTypes.filter((t) => plan.selectedMealTypes.includes(t))
      if (mealTypeFilter.length > 0 && !eligibleTypes.some((t) => mealTypeFilter.includes(t))) return false
      if (proteinFilter.length > 0 && !proteinFilter.includes(meal.protein)) return false
      return matchesMealSearch(meal, query)
    }),
    sort,
    served,
  )

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
            detail={describeOpenCells(plan, type)}
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
      eligibleCount={eligibleMeals.length}
      served={served}
      query={query}
      onQueryChange={setQuery}
      sort={sort}
      onSortChange={setSort}
      onClearAll={() => {
        setMealTypeFilter([])
        setProteinFilter([])
        setQuery('')
      }}
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
                <details className={styles.helpBox}>
                  <summary>How placing works</summary>
                  <ul>
                    <li>
                      Drag a picked meal's ⠿ handle onto a person's day/meal cell — or click <strong>Place</strong>{' '}
                      on the card, then click a highlighted cell. Each placement uses one serving of that batch.
                    </li>
                    <li>
                      Place the same batch on several cells to eat it as leftovers across the week (lunch and
                      dinner are interchangeable).
                    </li>
                    <li>
                      Put up to 4 items in one cell to combine them (e.g. lasagna + chips); each shares the cell
                      evenly, adjustable with −/+. × removes an item and the rest rebalance.
                    </li>
                  </ul>
                </details>
                {selectedEntryId && (
                  <p className={styles.placingHint} role="status">
                    Placing <strong>{plan.plannedMeals.find((e) => e.id === selectedEntryId)?.name}</strong> — click a
                    highlighted cell, or click <strong>Choosing cell…</strong> on its card to cancel.
                  </p>
                )}
                <AssignmentGrid
                  plan={plan}
                  draggingEntryId={draggingEntryId}
                  selectedEntryId={selectedEntryId}
                  onTapPlace={handleTapPlace}
                  {...cellHandlers}
                />
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
