import { useState } from 'react'
import type { FocusEvent } from 'react'
import { MEAL_IMPORT_PROMPT_TEMPLATE, parseMealDraft } from '../lib/mealImport'
import type { MealDraft } from '../lib/mealImport'
import { copyToClipboard } from '../lib/clipboard'
import styles from './ImportMealDialog.module.css'

interface ImportMealDialogProps {
  onCancel: () => void
  onImported: (draft: MealDraft) => void
}

export function ImportMealDialog({ onCancel, onImported }: ImportMealDialogProps) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showPromptFallback, setShowPromptFallback] = useState(false)

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
      <div className={styles.box}>
        <h2>Import recipe</h2>
        <p className={styles.hint}>
          Paste a recipe link or its text into any Claude chat along with the prompt below, then
          paste the JSON it replies with here.
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
