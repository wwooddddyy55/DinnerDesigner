import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { DayPlannerGrid } from '../components/DayPlannerGrid'
import { PersonRow } from '../components/PersonRow'
import { getMealTypeTarget } from '../lib/calculations'
import { toIsoDate, formatWeekLabel } from '../lib/date'
import { buildExport, downloadExport, parseImport } from '../lib/exportImport'
import { useAppStore } from '../store/useAppStore'
import { MEAL_TYPES, MEAL_TYPE_LABELS } from '../types'
import type { MealType, WeeklyPlan } from '../types'
import styles from './WeeklyPlanSetupScreen.module.css'

export function WeeklyPlanSetupScreen() {
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

  const [newWeekDate, setNewWeekDate] = useState(() => toIsoDate(new Date()))
  const [copyFromLast, setCopyFromLast] = useState(true)
  const [importError, setImportError] = useState<string | null>(null)
  const [pendingDeletePlan, setPendingDeletePlan] = useState<WeeklyPlan | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activePlan = plans.find((p) => p.id === activePlanId)
  const sortedPlans = [...plans].sort((a, b) => b.weekStartDate.localeCompare(a.weekStartDate))
  const mostRecentPlan = sortedPlans[0]

  function handleStartNewWeek() {
    startNewWeek(newWeekDate, copyFromLast ? mostRecentPlan?.id : undefined)
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
      const data = parseImport(text)
      replaceAllData(data)
      setImportError(null)
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Failed to import file.')
    }
  }

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>Weekly plan</h2>
        <div className={styles.planPicker}>
          <select
            className={styles.select}
            value={activePlanId ?? ''}
            onChange={(e) => setActivePlan(e.target.value)}
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

        <div className={styles.newWeekRow}>
          <input
            className={styles.dateInput}
            type="date"
            value={newWeekDate}
            onChange={(e) => setNewWeekDate(e.target.value)}
          />
          {mostRecentPlan && (
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={copyFromLast}
                onChange={(e) => setCopyFromLast(e.target.checked)}
              />
              Copy people from last week
            </label>
          )}
          <button type="button" className="button" onClick={handleStartNewWeek}>
            Start new week
          </button>
        </div>
      </section>

      {activePlan ? (
        <>
          <section className={styles.section}>
            <h3>Meal types this week</h3>
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
          </section>

          {activePlan.selectedMealTypes.length > 0 && (
            <section className={styles.section}>
              <h3>People</h3>
              <p>Add each person eating this week.</p>
              {activePlan.people.map((person) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  onChange={(p) => updatePerson(activePlan.id, p)}
                  onRemove={() => removePerson(activePlan.id, person.id)}
                />
              ))}
              <button
                type="button"
                className="button buttonSecondary"
                onClick={() => addPerson(activePlan.id, `Person ${activePlan.people.length + 1}`)}
              >
                + Add person
              </button>
            </section>
          )}

          {activePlan.selectedMealTypes.length > 0 && activePlan.people.length > 0 && (
            <section className={styles.section}>
              <h3>Day planner</h3>
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
            </section>
          )}

          {activePlan.selectedMealTypes.length > 0 && (
            <section className={styles.section}>
              <h3>Servings targets</h3>
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
            </section>
          )}
        </>
      ) : (
        <p className={styles.emptyState}>
          Start a new week above to set meal types, people, and servings targets.
        </p>
      )}

      <section className={styles.section}>
        <h3>Data</h3>
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
        {importError && <p style={{ color: 'var(--color-danger)' }}>{importError}</p>}
      </section>

      {pendingDeletePlan && (
        <ConfirmDialog
          title="Delete this week?"
          message={`This permanently removes the week of ${formatWeekLabel(pendingDeletePlan.weekStartDate)}, including its people, meal picks, and assignments.`}
          confirmLabel="Delete"
          onCancel={() => setPendingDeletePlan(null)}
          onConfirm={() => {
            deletePlan(pendingDeletePlan.id)
            setPendingDeletePlan(null)
          }}
        />
      )}
    </div>
  )
}
