import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { Collapsible } from '../components/Collapsible'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DayPlannerGrid } from '../components/DayPlannerGrid'
import type { View } from '../components/NavBar'
import { PersonRow } from '../components/PersonRow'
import { getMealTypeTarget } from '../lib/calculations'
import { addDays, toIsoDate, formatWeekLabel } from '../lib/date'
import { buildExport, downloadExport, parseImport } from '../lib/exportImport'
import { openSection } from '../lib/openSection'
import { dismissUndo, offerUndo } from '../lib/undo'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../types'
import type { Meal, MealType, WeeklyPlan } from '../types'
import styles from './WeeklyPlanSetupScreen.module.css'

interface WeeklyPlanSetupScreenProps {
  onNavigate: (view: View) => void
}

function sortByWeekDesc(plans: WeeklyPlan[]): WeeklyPlan[] {
  return [...plans].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
}

/** The day after the most recent week ends (i.e. its start + 7), or today
 * when there are no weeks yet — the usual "plan next week" date. */
function defaultNewWeekDate(plans: WeeklyPlan[]): string {
  const mostRecent = sortByWeekDesc(plans)[0]
  return mostRecent ? addDays(mostRecent.weekStartDate, 7) : toIsoDate(new Date())
}

export function WeeklyPlanSetupScreen({ onNavigate }: WeeklyPlanSetupScreenProps) {
  const plans = useAppStore((s) => s.plans)
  const meals = useAppStore((s) => s.meals)
  const activePlanId = useAppStore((s) => s.activePlanId)
  const startNewWeek = useAppStore((s) => s.startNewWeek)
  const setActivePlan = useAppStore((s) => s.setActivePlan)
  const setPlanMealTypes = useAppStore((s) => s.setPlanMealTypes)
  const addPerson = useAppStore((s) => s.addPerson)
  const updatePerson = useAppStore((s) => s.updatePerson)
  const removePerson = useAppStore((s) => s.removePerson)
  const setPersonAvailability = useAppStore((s) => s.setPersonAvailability)
  const replaceAllData = useAppStore((s) => s.replaceAllData)
  const deletePlan = useAppStore((s) => s.deletePlan)
  const restorePlan = useAppStore((s) => s.restorePlan)

  const [newWeekDate, setNewWeekDate] = useState(() => defaultNewWeekDate(plans))
  const [copyFromLast, setCopyFromLast] = useState(true)
  const [copyMeals, setCopyMeals] = useState(false)
  const [copyPlacements, setCopyPlacements] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingImport, setPendingImport] = useState<{ meals: Meal[]; plans: WeeklyPlan[] } | null>(null)
  const [pendingDeletePlan, setPendingDeletePlan] = useState<WeeklyPlan | null>(null)
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activePlan = plans.find((p) => p.id === activePlanId)
  const sortedPlans = sortByWeekDesc(plans)
  const mostRecentPlan = sortedPlans[0]
  const validNewWeekDate = /^\d{4}-\d{2}-\d{2}$/.test(newWeekDate)
  const duplicateWeek = plans.some((p) => p.weekStartDate === newWeekDate)

  function handleStartNewWeek() {
    if (!validNewWeekDate) return
    const copying = copyFromLast && mostRecentPlan
    startNewWeek(newWeekDate, copying ? mostRecentPlan.id : undefined, {
      copyMeals: Boolean(copying) && copyMeals,
      copyPlacements: Boolean(copying) && copyMeals && copyPlacements,
    })
    setNewWeekDate(addDays(newWeekDate, 7))
  }

  function handleExport() {
    downloadExport(buildExport(meals, plans))
  }

  function handleImportClick() {
    fileInputRef.current?.click()
  }

  async function handleImportFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      const text = await file.text()
      setPendingImport(parseImport(text))
      setImportError(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import file.')
    }
  }

  function confirmImport() {
    if (!pendingImport) return
    const previous = { meals, plans }
    replaceAllData(pendingImport)
    const imported = useAppStore.getState()
    setPendingImport(null)
    setNewWeekDate(defaultNewWeekDate(pendingImport.plans))
    const offerId = offerUndo('Imported data, replacing what was here.', () => replaceAllData(previous))
    // Restoring the whole pre-import snapshot would also erase anything edited
    // since (here, or synced in from another device), so the offer is
    // withdrawn as soon as the imported data changes.
    const unsubscribe = useAppStore.subscribe((s) => {
      if (s.meals === imported.meals && s.plans === imported.plans) return
      unsubscribe()
      dismissUndo(offerId)
    })
  }

  function handleDeletePlan(plan: WeeklyPlan) {
    const wasActive = plan.id === activePlanId
    deletePlan(plan.id)
    setPendingDeletePlan(null)
    offerUndo(`Deleted the week of ${formatWeekLabel(plan.weekStartDate)}.`, () => restorePlan(plan, wasActive))
  }

  function handleRemovePerson(plan: WeeklyPlan, personId: string) {
    const personIndex = plan.people.findIndex((p) => p.id === personId)
    const person = plan.people[personIndex]
    if (!person) return
    // Their placements live inside each picked meal; keep them to put back.
    const removedAssignments = new Map(
      plan.plannedMeals.map((e) => [e.id, e.assignments.filter((a) => a.personId === personId)]),
    )
    removePerson(plan.id, personId)
    offerUndo(`Removed ${person.name || 'person'}.`, () => {
      const current = useAppStore.getState().plans.find((p) => p.id === plan.id)
      if (!current || current.people.some((p) => p.id === personId)) return
      const people = [...current.people]
      people.splice(Math.min(personIndex, people.length), 0, person)
      restorePlan({
        ...current,
        people,
        plannedMeals: current.plannedMeals.map((entry) => ({
          ...entry,
          assignments: [...entry.assignments, ...(removedAssignments.get(entry.id) ?? [])],
        })),
      })
    })
  }

  // Each unfinished step jumps to where it's done.
  const checklist = activePlan
    ? [
        { label: 'Week started', done: true },
        {
          label: 'Meal types chosen',
          done: activePlan.selectedMealTypes.length > 0,
          action: () => openSection('setup-meal-types'),
          enabled: true,
        },
        {
          label: 'People added',
          done: activePlan.people.length > 0,
          action: () => openSection('setup-people'),
          enabled: activePlan.selectedMealTypes.length > 0,
        },
        {
          label: 'Meals picked',
          done: activePlan.plannedMeals.length > 0,
          action: () => onNavigate('plan'),
          enabled: activePlan.selectedMealTypes.length > 0 && activePlan.people.length > 0,
        },
      ]
    : []
  const readyForPlanning = Boolean(
    activePlan && activePlan.selectedMealTypes.length > 0 && activePlan.people.length > 0,
  )
  // Once a week is being edited, starting another one is the less common
  // task, so that box starts folded away (as does Data).
  const hasActiveWeek = Boolean(activePlan)

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>Week</h2>
        <div className={styles.planPicker}>
          <select
            className={styles.select}
            value={activePlanId ?? ''}
            onChange={(e) => setActivePlan(e.target.value)}
            aria-label="Week to edit"
          >
            <option value="" disabled>
              {plans.length === 0 ? 'No plans yet' : 'Select a week...'}
            </option>
            {sortedPlans.map((plan) => (
              <option key={plan.id} value={plan.id}>
                Week of {formatWeekLabel(plan.weekStartDate)}
              </option>
            ))}
          </select>
          {activePlan && (
            <button
              type="button"
              className="button buttonDanger"
              onClick={() => setPendingDeletePlan(activePlan)}
            >
              Delete week
            </button>
          )}
        </div>

        <Collapsible
          id="setup-new-week"
          title={<h3 className={styles.collapsibleTitle}>Start a new week</h3>}
          defaultOpen={!hasActiveWeek}
        >
          <div className={styles.newWeekBox}>
            <div className={styles.newWeekRow}>
              <label className={styles.fieldLabel} htmlFor="new-week-date">
                New week starting
              </label>
              <input
                id="new-week-date"
                className={styles.dateInput}
                type="date"
                value={newWeekDate}
                onChange={(e) => setNewWeekDate(e.target.value)}
              />
              <button type="button" className="button" onClick={handleStartNewWeek} disabled={!validNewWeekDate}>
                Start new week
              </button>
            </div>
            {validNewWeekDate && (
              <p className={styles.weekRange}>
                {formatWeekLabel(newWeekDate)} – {formatWeekLabel(addDays(newWeekDate, 6))}
                {duplicateWeek && ' · you already have a week starting on this date'}
              </p>
            )}
            {mostRecentPlan && (
              <div className={styles.copyOptions}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={copyFromLast}
                    onChange={(e) => setCopyFromLast(e.target.checked)}
                  />
                  Copy people, availability and meal types from the week of{' '}
                  {formatWeekLabel(mostRecentPlan.weekStartDate)}
                </label>
                {copyFromLast && (
                  <label className={`${styles.checkboxLabel} ${styles.nestedOption}`}>
                    <input type="checkbox" checked={copyMeals} onChange={(e) => setCopyMeals(e.target.checked)} />
                    Also copy its picked meals ({mostRecentPlan.plannedMeals.length})
                  </label>
                )}
                {copyFromLast && copyMeals && (
                  <label className={`${styles.checkboxLabel} ${styles.nestedOption} ${styles.nestedOption2}`}>
                    <input
                      type="checkbox"
                      checked={copyPlacements}
                      onChange={(e) => setCopyPlacements(e.target.checked)}
                    />
                    …and where they were placed on the grid
                  </label>
                )}
              </div>
            )}
          </div>
        </Collapsible>
      </section>

      {activePlan ? (
        <>
          <ol className={styles.checklist} aria-label="Setup progress">
            {checklist.map((step) => (
              <li key={step.label} className={step.done ? styles.stepDone : styles.stepTodo}>
                <span aria-hidden="true">{step.done ? '✓' : '○'}</span>{' '}
                {step.action && !step.done ? (
                  <button type="button" className={styles.stepLink} onClick={step.action} disabled={!step.enabled}>
                    {step.label}
                  </button>
                ) : (
                  step.label
                )}
                <span className="srOnly">{step.done ? ' (done)' : ' (to do)'}</span>
              </li>
            ))}
          </ol>

          <Collapsible id="setup-meal-types" title={<h3 className={styles.collapsibleTitle}>Meal types this week</h3>}>
            <div className={styles.checkboxRow}>
              {MEAL_TYPES.map((type) => (
                <label className={styles.checkboxLabel} key={type}>
                  <input
                    type="checkbox"
                    checked={activePlan.selectedMealTypes.includes(type)}
                    onChange={() => {
                      const next = activePlan.selectedMealTypes.includes(type)
                        ? activePlan.selectedMealTypes.filter((t) => t !== type)
                        : [...activePlan.selectedMealTypes, type]
                      setPlanMealTypes(activePlan.id, next as MealType[])
                    }}
                  />
                  {MEAL_TYPE_LABELS[type]}
                </label>
              ))}
            </div>
            {activePlan.selectedMealTypes.length === 0 && (
              <p>Tick at least one meal type to add people and plan their week.</p>
            )}
          </Collapsible>

          {activePlan.selectedMealTypes.length > 0 && (
            <Collapsible id="setup-people" title={<h3 className={styles.collapsibleTitle}>People</h3>}>
              <p>Add each person eating this week.</p>
              {activePlan.people.map((person, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  index={index}
                  autoFocus={person.id === focusPersonId}
                  onChange={(p) => updatePerson(activePlan.id, p)}
                  onRemove={() => handleRemovePerson(activePlan, person.id)}
                />
              ))}
              <button
                type="button"
                className="button buttonSecondary"
                onClick={() => setFocusPersonId(addPerson(activePlan.id, `Person ${activePlan.people.length + 1}`))}
              >
                + Add person
              </button>
            </Collapsible>
          )}

          {activePlan.selectedMealTypes.length > 0 && activePlan.people.length > 0 && (
            <Collapsible id="setup-day-planner" title={<h3 className={styles.collapsibleTitle}>Day planner</h3>}>
              <p>
                Mark each person available or unavailable for each meal type on each day. A
                person's weekly target for a meal type is however many days they're marked
                available (defaults to all 7 days).
              </p>
              <DayPlannerGrid
                plan={activePlan}
                onToggle={(personId, type, day, available) =>
                  setPersonAvailability(activePlan.id, personId, type, day, available)
                }
              />
            </Collapsible>
          )}

          {activePlan.selectedMealTypes.length > 0 && (
            <Collapsible id="setup-targets" title={<h3 className={styles.collapsibleTitle}>Servings targets</h3>}>
              <div className={styles.summaryGrid}>
                {activePlan.selectedMealTypes.map((type) => (
                  <div className={`card ${styles.summaryTile}`} key={type}>
                    <div className={styles.summaryLabel}>{MEAL_TYPE_LABELS[type]}</div>
                    <div className={styles.summaryValue}>
                      {getMealTypeTarget(activePlan, type)} servings
                    </div>
                  </div>
                ))}
              </div>
            </Collapsible>
          )}

          {readyForPlanning && (
            <div>
              <button type="button" className="button" onClick={() => onNavigate('plan')}>
                Next: pick meals →
              </button>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <p>
            {plans.length === 0
              ? 'Welcome! Planning a week takes four steps: start a week above, tick the meal types you’re planning, add the people eating, then pick meals in the Plan Builder. Your meal library already has a few starter meals to try.'
              : 'Pick a week above to edit it, or start a new one.'}
          </p>
        </div>
      )}

      <Collapsible
        id="setup-data"
        title={<h3 className={styles.collapsibleTitle}>Data</h3>}
        defaultOpen={!hasActiveWeek}
      >
        <p>Export your meals and plans to a JSON file, or import a previous export.</p>
        <div className={styles.dataRow}>
          <button type="button" className="button buttonSecondary" onClick={handleExport}>
            Export data
          </button>
          <button type="button" className="button buttonSecondary" onClick={handleImportClick}>
            Import data
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            hidden
            onChange={handleImportFile}
          />
        </div>
        {importError && (
          <p style={{ color: 'var(--color-danger)' }} role="alert">
            {importError}
          </p>
        )}
      </Collapsible>

      {pendingImport && (
        <ConfirmDialog
          title="Replace everything with this file?"
          message={`This replaces your ${meals.length} meals and ${plans.length} weeks with the file's ${pendingImport.meals.length} meals and ${pendingImport.plans.length} weeks, on every synced device. You can undo right afterwards.`}
          confirmLabel="Replace"
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      )}

      {pendingDeletePlan && (
        <ConfirmDialog
          title="Delete this week?"
          message={`This removes the week of ${formatWeekLabel(pendingDeletePlan.weekStartDate)}, including its people, meal picks, and assignments.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDeletePlan(null)}
          onConfirm={() => handleDeletePlan(pendingDeletePlan)}
        />
      )}
    </div>
  )
}
