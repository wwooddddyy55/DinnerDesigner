import { useState } from 'react'
import { getShoppingList } from '../lib/calculations'
import { formatWeekLabel } from '../lib/date'
import type { WeeklyPlan } from '../types'
import styles from './ShoppingListScreen.module.css'

interface ShoppingListScreenProps {
  plan: WeeklyPlan
}

export function ShoppingListScreen({ plan }: ShoppingListScreenProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const lines = getShoppingList(plan)

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className={styles.page}>
      <h2>Shopping list — week of {formatWeekLabel(plan.weekStartDate)}</h2>
      {lines.length === 0 ? (
        <p className={styles.emptyState}>
          No meals picked yet. Add meals in the Plan Builder to generate a shopping list.
        </p>
      ) : (
        <div className={styles.list}>
          {lines.map((line) => (
            <label className={`card ${styles.row}`} key={line.key}>
              <input
                type="checkbox"
                checked={checked.has(line.key)}
                onChange={() => toggle(line.key)}
              />
              <span className={checked.has(line.key) ? styles.checked : ''}>{line.name}</span>
              <span className={styles.quantity}>
                {line.quantity} {line.unit}
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
