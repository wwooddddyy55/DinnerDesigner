import { useState } from 'react'
import type { FocusEvent } from 'react'
import {
  formatQuantity,
  formatShoppingListText,
  getLeftoverEntries,
  getShoppingList,
  splitStaples,
} from '../lib/calculations'
import type { ShoppingListLine } from '../lib/calculations'
import { copyToClipboard } from '../lib/clipboard'
import { formatWeekLabel } from '../lib/date'
import { useNavigate } from '../lib/navigation'
import { offerUndo } from '../lib/undo'
import { useWakeLock } from '../lib/useWakeLock'
import { useAppStore } from '../store/useAppStore'
import { stapleKey } from '../types'
import type { WeeklyPlan } from '../types'
import styles from './ShoppingListScreen.module.css'

interface ShoppingListScreenProps {
  plan: WeeklyPlan
}

function lineText(line: ShoppingListLine): string {
  return `${formatQuantity(line.quantity)}${line.unit ? ` ${line.unit}` : ''}`
}

export function ShoppingListScreen({ plan }: ShoppingListScreenProps) {
  const navigate = useNavigate()
  const staples = useAppStore((s) => s.staples)
  const addStaple = useAppStore((s) => s.addStaple)
  const removeStaple = useAppStore((s) => s.removeStaple)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [hideChecked, setHideChecked] = useState(false)
  const [includeLeftovers, setIncludeLeftovers] = useState(false)
  const [copied, setCopied] = useState(false)
  const [copyFallback, setCopyFallback] = useState<string | null>(null)
  const allLines = getShoppingList(plan, { includeLeftovers })
  const { toBuy: lines, staples: stapleLines } = splitStaples(allLines, staples)
  const stapleLineById = new Map(stapleLines.map((l) => [stapleKey(l.name), l]))
  const leftoverEntries = getLeftoverEntries(plan)
  const checkedCount = lines.filter((l) => checked.has(l.key)).length
  const visibleLines = hideChecked ? lines.filter((l) => !checked.has(l.key)) : lines
  // In the shop, the phone shouldn't dim and lock between items.
  useWakeLock(lines.length > 0)

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleAlwaysHave(line: ShoppingListLine) {
    addStaple(line.name)
    offerUndo(`${line.name} is left off the list from now on.`, () => removeStaple(stapleKey(line.name)))
  }

  function handlePutBack(id: string, name: string) {
    removeStaple(id)
    offerUndo(`${name} is back on the list.`, () => addStaple(name))
  }

  async function handleCopy() {
    // Copy what's still to buy; if everything is ticked, copy the whole list.
    const remaining = lines.filter((l) => !checked.has(l.key))
    const text = formatShoppingListText(remaining.length > 0 ? remaining : lines)
    if (await copyToClipboard(text)) {
      setCopyFallback(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setCopyFallback(text)
    }
  }

  function handleFallbackFocus(e: FocusEvent<HTMLTextAreaElement>) {
    e.target.select()
  }

  return (
    <div className={styles.page}>
      <h2>Shopping list — week of {formatWeekLabel(plan.weekStartDate)}</h2>

      {leftoverEntries.length > 0 && (
        <div className={`card ${styles.notice}`}>
          <p>
            {includeLeftovers ? 'Including' : 'Not including'} {leftoverEntries.length}{' '}
            {leftoverEntries.length === 1 ? 'meal' : 'meals'} already cooked last week:{' '}
            {leftoverEntries.map((e) => e.name).join(', ')}.
          </p>
          <label className={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={includeLeftovers}
              onChange={(e) => setIncludeLeftovers(e.target.checked)}
            />
            Include their ingredients anyway
          </label>
        </div>
      )}

      {lines.length === 0 ? (
        plan.plannedMeals.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No meals picked yet. Add meals in the Plan Builder to generate a shopping list.</p>
            <button type="button" className="button" onClick={() => navigate('plan')}>
              Go to Plan Builder
            </button>
          </div>
        ) : (
          <p className={styles.emptyState}>
            {stapleLines.length > 0
              ? 'Nothing to buy — everything this week is something you always have.'
              : 'Nothing to buy — the picked meals have no ingredients listed (or were all cooked last week).'}
          </p>
        )
      ) : (
        <>
          <div className={`stickyBar ${styles.stickyTools}`}>
            <div className={styles.toolbar}>
              <span className={styles.progress} aria-live="polite">
                {checkedCount} of {lines.length} items ticked
              </span>
              <label className={styles.toggleLabel}>
                <input type="checkbox" checked={hideChecked} onChange={(e) => setHideChecked(e.target.checked)} />
                Hide ticked
              </label>
              <button type="button" className="button buttonSecondary" onClick={handleCopy}>
                {copied ? 'Copied!' : 'Copy list as text'}
              </button>
            </div>
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label="Items ticked"
              aria-valuemin={0}
              aria-valuemax={lines.length}
              aria-valuenow={checkedCount}
            >
              <div className={styles.progressFill} style={{ width: `${(checkedCount / lines.length) * 100}%` }} />
            </div>
          </div>

          {copyFallback !== null && (
            <>
              <label className={styles.fallbackLabel} htmlFor="shopping-copy-fallback">
                Couldn't copy automatically — select the text below and copy it (Ctrl/Cmd+C)
              </label>
              <textarea
                id="shopping-copy-fallback"
                className={styles.fallbackText}
                value={copyFallback}
                readOnly
                autoFocus
                onFocus={handleFallbackFocus}
                rows={Math.min(10, copyFallback.split('\n').length)}
              />
            </>
          )}

          <div className={styles.list}>
            {visibleLines.length === 0 && <p className={styles.emptyState}>Everything's ticked off. Nice!</p>}
            {visibleLines.map((line) => (
              <div className={`card ${styles.row}`} key={line.key}>
                <label className={styles.rowLabel}>
                  <input type="checkbox" checked={checked.has(line.key)} onChange={() => toggle(line.key)} />
                  <span className={styles.itemText}>
                    <span className={`${styles.itemLine} ${checked.has(line.key) ? styles.checked : ''}`}>
                      <span className={styles.itemName}>{line.name}</span>
                      <span className={styles.quantity}>{lineText(line)}</span>
                    </span>
                    <span className={styles.sources}>for {line.sources.join(', ')}</span>
                  </span>
                </label>
                <button
                  type="button"
                  className={`button buttonSecondary ${styles.alwaysHave}`}
                  onClick={() => handleAlwaysHave(line)}
                  aria-label={`Always have ${line.name}: leave it off the list from now on`}
                >
                  Always have
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {staples.length > 0 && (
        <details className={`card ${styles.staples}`}>
          <summary>
            Always have ({staples.length}){stapleLines.length > 0 && ` · ${stapleLines.length} used this week`}
          </summary>
          <p className={styles.staplesHint}>
            Left off the list and the copied text for every week. Put one back when you run out.
          </p>
          <ul className={styles.stapleList}>
            {staples.map((staple) => {
              const line = stapleLineById.get(staple.id)
              return (
                <li key={staple.id} className={styles.stapleRow}>
                  <span className={styles.itemText}>
                    <span className={styles.itemName}>{staple.name}</span>
                    {line && <span className={styles.sources}>{lineText(line)} this week</span>}
                  </span>
                  <button
                    type="button"
                    className="button buttonSecondary"
                    onClick={() => handlePutBack(staple.id, staple.name)}
                    aria-label={`Put ${staple.name} back on the list`}
                  >
                    Put back
                  </button>
                </li>
              )
            })}
          </ul>
        </details>
      )}
    </div>
  )
}
