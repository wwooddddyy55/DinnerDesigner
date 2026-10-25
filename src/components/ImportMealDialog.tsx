import { useId, useState } from 'react'
import type { FocusEvent } from 'react'
import { MEAL_IMPORT_PROMPT_TEMPLATE, parseMealDrafts } from '../lib/mealImport'
import type { MealDraft } from '../lib/mealImport'
import { copyToClipboard } from '../lib/clipboard'
import { useDialog } from '../lib/useDialog'
import { MEAL_TYPE_LABELS, proteinLabel } from '../types'
import styles from './ImportMealDialog.module.css'

interface ImportMealDialogProps {
  onCancel: () => void
  /** One meal parsed: opened in `MealForm` for review before saving. */
  onImported: (draft: MealDraft) => void
  /** Several meals parsed (a JSON array): the user ticks which to keep here,
   * and they're added straight to the library. */
  onImportedMany: (drafts: MealDraft[]) => void
}

export function ImportMealDialog({ onCancel, onImported, onImportedMany }: ImportMealDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPromptFallback, setShowPromptFallback] = useState(false)
  const [drafts, setDrafts] = useState<MealDraft[] | null>(null)
  const [included, setIncluded] = useState<Set<number>>(new Set())
  const dialogRef = useDialog<HTMLDivElement>(onCancel)
  const titleId = useId()

  function handleParse() {
    try {
      const parsed = parseMealDrafts(text)
      setError(null)
      if (parsed.length === 1) {
        onImported(parsed[0])
      } else {
        setDrafts(parsed)
        setIncluded(new Set(parsed.map((_, i) => i)))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that JSON.')
    }
  }

  function toggleIncluded(index: number) {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  async function handleCopyPrompt() {
    if (await copyToClipboard(MEAL_IMPORT_PROMPT_TEMPLATE)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setShowPromptFallback(true)
    }
  }

  function handlePromptFallbackFocus(e: FocusEvent<HTMLTextAreaElement>) {
    e.target.select()
  }

  return (
    <div className={styles.overlay}>
      <div ref={dialogRef} className={styles.box} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <div className={styles.sheetHeader}>
          <h2 id={titleId}>Import recipe</h2>
          <button type="button" className={styles.closeButton} onClick={onCancel} aria-label="Close">
            &times;
          </button>
        </div>
        {drafts ? (
          <>
            <p className={styles.hint}>
              Found {drafts.length} meals. Untick any you don't want, then add the rest to your library — you can
              edit each one there afterwards.
            </p>
            <ul className={styles.draftList}>
              {drafts.map((draft, index) => (
                <li key={index}>
                  <label className={styles.draftRow}>
                    <input type="checkbox" checked={included.has(index)} onChange={() => toggleIncluded(index)} />
                    <span>
                      <strong>{draft.name}</strong>
                      <span className={styles.draftMeta}>
                        {proteinLabel(draft.protein, draft.proteinCustomLabel)} · {draft.servingsPerBatch} servings ·{' '}
                        {draft.mealTypes.map((t) => MEAL_TYPE_LABELS[t]).join(', ')} · {draft.ingredients.length}{' '}
                        ingredients
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className={styles.footer}>
              <button type="button" className="button buttonSecondary" onClick={() => setDrafts(null)}>
                Back
              </button>
              <button
                type="button"
                className="button"
                disabled={included.size === 0}
                onClick={() => onImportedMany(drafts.filter((_, i) => included.has(i)))}
              >
                Add {included.size} {included.size === 1 ? 'meal' : 'meals'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className={styles.hint}>
              Paste a recipe link or its text into any Claude chat along with the prompt below, then
              paste the JSON it replies with here. Several recipes at once work too — the chat replies
              with a list you can review before adding.
            </p>
            <button type="button" className="button buttonSecondary" onClick={handleCopyPrompt}>
              {copied ? 'Copied!' : 'Copy chat prompt'}
            </button>

            {showPromptFallback && (
              <>
                <label className={styles.label} htmlFor="import-prompt-fallback">
                  Couldn't copy automatically — select the text below and copy it (Ctrl/Cmd+C)
                </label>
                <textarea
                  id="import-prompt-fallback"
                  className={styles.textarea}
                  value={MEAL_IMPORT_PROMPT_TEMPLATE}
                  readOnly
                  autoFocus
                  onFocus={handlePromptFallbackFocus}
                  rows={4}
                />
              </>
            )}

            <label className={styles.label} htmlFor="import-json">
              Recipe JSON
            </label>
            <textarea
              id="import-json"
              className={styles.textarea}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder='{ "name": "...", "mealTypes": ["dinner"], ... }'
              rows={10}
            />

            {error && (
              <p className={styles.errorText} role="alert">
                {error}
              </p>
            )}

            <div className={styles.footer}>
              <button type="button" className="button buttonSecondary" onClick={onCancel}>
                Cancel
              </button>
              <button type="button" className="button" onClick={handleParse} disabled={text.trim().length === 0}>
                Parse
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
