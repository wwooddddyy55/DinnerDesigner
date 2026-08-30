import { useState } from 'react'
import { MEAL_IMPORT_PROMPT_TEMPLATE, parseMealDraft } from '../lib/mealImport'
import type { MealDraft } from '../lib/mealImport'
import styles from './ImportMealDialog.module.css'

interface ImportMealDialogProps {
  onCancel: () => void
  onImported: (draft: MealDraft) => void
}

export function ImportMealDialog({ onCancel, onImported }: ImportMealDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function handleParse() {
    try {
      const draft = parseMealDraft(text)
      setError(null)
      onImported(draft)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not parse that JSON.')
    }
  }

  async function handleCopyPrompt() {
    await navigator.clipboard.writeText(MEAL_IMPORT_PROMPT_TEMPLATE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <h2>Import recipe</h2>
        <p className={styles.hint}>
          Paste a recipe link or its text into any Claude chat along with the prompt below, then
          paste the JSON it replies with here.
        </p>
        <button type="button" className="button buttonSecondary" onClick={handleCopyPrompt}>
          {copied ? 'Copied!' : 'Copy chat prompt'}
        </button>

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

        {error && <p className={styles.errorText}>{error}</p>}

        <div className={styles.footer}>
          <button type="button" className="button buttonSecondary" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="button" onClick={handleParse} disabled={text.trim().length === 0}>
            Parse
          </button>
        </div>
      </div>
    </div>
  )
}
