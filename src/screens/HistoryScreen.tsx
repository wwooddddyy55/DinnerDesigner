import { getMealStaleness, getWeekHistory } from '../lib/history'
import { formatWeekLabel } from '../lib/date'
import { useAppStore } from '../store/useAppStore'
import styles from './HistoryScreen.module.css'

export function HistoryScreen() {
  const plans = useAppStore((s) => s.plans)

  if (plans.length === 0) {
    return (
      <div className={styles.page}>
        <p className={styles.emptyState}>No weeks yet — start a weekly plan to build history.</p>
      </div>
    )
  }

  const weekHistory = getWeekHistory(plans)
  const staleness = getMealStaleness(plans)

  return (
    <div className={styles.page}>
      <section className={styles.section}>
        <h2>Weekly log</h2>
        {weekHistory.map((week) => (
          <div key={week.planId} className={styles.weekRow}>
            <h3>Week of {formatWeekLabel(week.weekStartDate)}</h3>
            {week.meals.length === 0 ? (
              <p className={styles.emptyState}>No meals picked this week.</p>
            ) : (
              <ul>
                {week.meals.map((meal) => (
                  <li key={meal.mealId}>{meal.name}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <section className={styles.section}>
        <h2>What haven't we had in a while?</h2>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Meal</th>
                <th>Last served</th>
                <th>Times served</th>
              </tr>
            </thead>
            <tbody>
              {staleness.map((meal) => (
                <tr key={meal.mealId}>
                  <td>{meal.name}</td>
                  <td>{formatWeekLabel(meal.lastServedDate)}</td>
                  <td>{meal.timesServed}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
