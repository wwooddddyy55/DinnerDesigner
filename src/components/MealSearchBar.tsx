import { MEAL_SORT_LABELS } from '../lib/mealSearch'
import type { MealSort } from '../lib/mealSearch'
import styles from './MealSearchBar.module.css'

interface MealSearchBarProps {
  query: string
  onQueryChange: (query: string) => void
  sort: MealSort
  onSortChange: (sort: MealSort) => void
  /** Shown as "Showing X of Y meals" when given. */
  shownCount?: number
  totalCount?: number
}

/** Search box + sort select shared by the Meal Library and the Plan
 * Builder's "Choose meals" picker. */
export function MealSearchBar({ query, onQueryChange, sort, onSortChange, shownCount, totalCount }: MealSearchBarProps) {
  return (
    <div className={styles.bar}>
      <input
        type="search"
        className={styles.search}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search meals or ingredients"
        aria-label="Search meals or ingredients"
      />
      <select
        className={styles.sort}
        value={sort}
        onChange={(e) => onSortChange(e.target.value as MealSort)}
        aria-label="Sort meals"
      >
        {(Object.keys(MEAL_SORT_LABELS) as MealSort[]).map((key) => (
          <option key={key} value={key}>
            {MEAL_SORT_LABELS[key]}
          </option>
        ))}
      </select>
      {shownCount !== undefined && totalCount !== undefined && (
        <span className={styles.count} aria-live="polite">
          {shownCount === totalCount ? `${totalCount} meals` : `Showing ${shownCount} of ${totalCount} meals`}
        </span>
      )}
    </div>
  )
}
