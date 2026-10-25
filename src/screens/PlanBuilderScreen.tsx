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
import {
  CAPACITY_EPSILON,
  formatServingCount,
  getEntryConsumedServings,
  getEntryRemaining,
  getMealTypePicked,
  getMealTypeTarget,
  getOpenCells,
  getTodayDayIndex,
} from '../lib/calculations'
import { formatDayHeader, toIsoDate } from '../lib/date'
import { parseCellDroppableId, parsePickedEntryDraggableId } from '../lib/dragDrop'
import { getMealServedIndex, matchesMealSearch, sortMeals } from '../lib/mealSearch'
import type { MealSort } from '../lib/mealSearch'
import { offerUndo } from '../lib/undo'
import { TOUCH_LAYOUT_QUERY, useMediaQuery } from '../lib/useMediaQuery'
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

/** A short buzz on phones that support it (Android; iOS ignores it). */
function buzz(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Some webviews throw instead of ignoring it.
  }
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
  // Open on today when this week is the current one.
  const [selectedDay, setSelectedDay] = useState(
    () => getTodayDayIndex(plan.weekStartDate, toIsoDate(new Date())) ?? 0,
  )
  const [showProgressDetail, setShowProgressDetail] = useState(false)
  // Phone Pick tab: the library picker is open while picking, and folded
  // away (picked meals first) for a week that already has picks.
  const [showPicker, setShowPicker] = useState(plan.plannedMeals.length === 0)
  // Screen-reader announcement of the last placement (or why it failed).
  const [announcement, setAnnouncement] = useState('')
  // Phones, and touchscreens too short for the grid (landscape) — the same
  // query the layout's CSS uses. Only the matching layout is mounted, so the
  // picker/picked panels and grid render (and recompute) once.
  const isMobile = useMediaQuery(TOUCH_LAYOUT_QUERY)

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
    if (selectedEntryId === entryId) {
      setSelectedEntryId(null)
      return
    }
    const entry = plan.plannedMeals.find((e) => e.id === entryId)
    // A fully placed batch has nothing left to place.
    if (!entry || getEntryRemaining(plan, entry) <= CAPACITY_EPSILON) return
    setSelectedEntryId(entryId)
    setActiveMobileTab('assign')
  }

  function handleTapPlace(personId: string, mealType: MealType, day: number) {
    if (!selectedEntryId) return
    const entry = plan.plannedMeals.find((e) => e.id === selectedEntryId)
    const person = plan.people.find((p) => p.id === personId)
    const where = `${person?.name ?? ''}, ${MEAL_TYPE_LABELS[mealType]} ${formatDayHeader(plan.weekStartDate, day)}`
    if (!assignMealToCell(plan.id, selectedEntryId, personId, mealType, day)) {
      // Rejected (no servings left, cell full…): keep the selection so the
      // user can pick another cell.
      buzz([30, 40, 30])
      setAnnouncement(`Couldn't place ${entry?.name ?? 'that meal'} on ${where}.`)
      return
    }
    buzz(15)
    setAnnouncement(`Placed ${entry?.name ?? 'meal'} on ${where}.`)
    // Stay selected while the batch has servings left, so the next serving
    // is one more tap rather than a trip back to the card.
    const updated = useAppStore.getState().plans.find((p) => p.id === plan.id)
    const updatedEntry = updated?.plannedMeals.find((e) => e.id === selectedEntryId)
    if (!updated || !updatedEntry || getEntryRemaining(updated, updatedEntry) <= CAPACITY_EPSILON) {
      setSelectedEntryId(null)
    }
  }

  function handleClear(entryId: string, assignmentId: string) {
    const entry = plan.plannedMeals.find((e) => e.id === entryId)
    const assignment = entry?.assignments.find((a) => a.id === assignmentId)
    clearAssignment(plan.id, entryId, assignmentId)
    if (!entry || !assignment) return
    offerUndo(`Took ${entry.name} off ${formatDayHeader(plan.weekStartDate, assignment.day)}.`, () => {
      // Placed again through the store, so its capacity/availability checks
      // still apply if things changed in the meantime.
      assignMealToCell(plan.id, entryId, assignment.personId, assignment.mealType, assignment.day)
    })
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
  const selectedEntry = plan.plannedMeals.find((e) => e.id === selectedEntryId)
  // Picked meals with servings still to place, for the Assign tab's chips.
  const unplacedEntries = plan.plannedMeals.filter((e) => getEntryRemaining(plan, e) > CAPACITY_EPSILON)

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
      compact={isMobile}
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
    onClear: handleClear,
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
                      on the card, then click highlighted cells. Each placement uses one serving of that batch.
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
                {selectedEntry && (
                  <p className={styles.placingHint} role="status">
                    Placing <strong>{selectedEntry.name}</strong> — click highlighted cells to place its servings (it
                    stays selected until the batch is used up), or click <strong>Choosing cell…</strong> on its card to
                    stop.
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
            <div className={`stickyBar ${styles.mobileHeader}`}>
              <div className={styles.mobileTabs}>
                <button
                  type="button"
                  className={`${styles.mobileTab} ${activeMobileTab === 'pick' ? styles.mobileTabActive : ''}`}
                  aria-pressed={activeMobileTab === 'pick'}
                  onClick={() => setActiveMobileTab('pick')}
                >
                  Pick meals
                </button>
                <button
                  type="button"
                  className={`${styles.mobileTab} ${activeMobileTab === 'assign' ? styles.mobileTabActive : ''}`}
                  aria-pressed={activeMobileTab === 'assign'}
                  onClick={() => setActiveMobileTab('assign')}
                >
                  Assign
                  {unplacedEntries.length > 0 && (
                    <span className={styles.tabCount} aria-label={`, ${unplacedEntries.length} to place`}>
                      {unplacedEntries.length}
                    </span>
                  )}
                </button>
              </div>

              {activeMobileTab === 'assign' && (
                <>
                  <button
                    type="button"
                    className={styles.progressSummary}
                    aria-expanded={showProgressDetail}
                    onClick={() => setShowProgressDetail((v) => !v)}
                  >
                    <span>
                      {plan.selectedMealTypes
                        .map(
                          (type) =>
                            `${MEAL_TYPE_LABELS[type]} ${getMealTypePicked(plan, type)}/${getMealTypeTarget(plan, type)}`,
                        )
                        .join(' · ')}
                    </span>
                    <span aria-hidden="true">{showProgressDetail ? '▴' : '▾'}</span>
                  </button>

                  {selectedEntry ? (
                    <div className={styles.placingStrip}>
                      <span className={styles.placingText}>
                        Placing <strong>{selectedEntry.name}</strong> ·{' '}
                        {formatServingCount(getEntryConsumedServings(plan, selectedEntry))}/
                        {selectedEntry.totalServings} placed
                      </span>
                      <button type="button" className="button buttonSecondary" onClick={() => setSelectedEntryId(null)}>
                        Done
                      </button>
                    </div>
                  ) : (
                    <p className={styles.placingHint}>
                      {unplacedEntries.length > 0
                        ? 'Tap a meal below, then tap highlighted slots to place its servings.'
                        : plan.plannedMeals.length > 0
                          ? 'Every picked meal is fully placed.'
                          : 'Pick some meals first, on the Pick meals tab.'}
                    </p>
                  )}

                  {unplacedEntries.length > 0 && (
                    <div className={styles.entryChips} role="group" aria-label="Meal to place">
                      {unplacedEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          className={`${styles.entryChip} ${entry.id === selectedEntryId ? styles.entryChipActive : ''}`}
                          aria-pressed={entry.id === selectedEntryId}
                          onClick={() => handleSelectEntry(entry.id)}
                        >
                          {entry.name}{' '}
                          <span className={styles.entryChipCount}>
                            {formatServingCount(getEntryRemaining(plan, entry))} left
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {activeMobileTab === 'pick' &&
              (showPicker || plan.plannedMeals.length === 0 ? (
                <>
                  {plan.plannedMeals.length > 0 && (
                    <div className={styles.pickerToggleRow}>
                      <button
                        type="button"
                        className="button buttonSecondary"
                        aria-expanded
                        onClick={() => setShowPicker(false)}
                      >
                        Done adding — show picked meals first
                      </button>
                    </div>
                  )}
                  {mealPicker}
                  {pickedMeals}
                </>
              ) : (
                // A week that already has picks opens on them; the (long)
                // library picker folds away until it's wanted.
                <>
                  {pickedMeals}
                  <div className={styles.pickerToggleRow}>
                    <button
                      type="button"
                      className="button buttonSecondary"
                      aria-expanded={false}
                      onClick={() => setShowPicker(true)}
                    >
                      + Add more meals
                    </button>
                  </div>
                </>
              ))}

            {activeMobileTab === 'assign' && (
              <>
                {showProgressDetail && progressBars}
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
        <p className="srOnly" role="status" aria-live="polite">
          {announcement}
        </p>
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
