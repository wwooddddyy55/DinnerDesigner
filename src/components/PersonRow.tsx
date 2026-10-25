import { useEffect, useRef } from 'react'
import type { Person } from '../types'
import styles from './PersonRow.module.css'

interface PersonRowProps {
  person: Person
  /** 0-based position, for the name field's accessible label. */
  index: number
  /** Focus and select the name on mount — set for a just-added person so the
   * placeholder "Person N" can be typed over straight away. */
  autoFocus?: boolean
  onChange: (person: Person) => void
  onRemove: () => void
}

export function PersonRow({ person, index, autoFocus = false, onChange, onRemove }: PersonRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (autoFocus) inputRef.current?.select()
  }, [autoFocus])

  return (
    <div className={styles.row}>
      <input
        ref={inputRef}
        className={styles.name}
        type="text"
        value={person.name}
        onChange={(e) => onChange({ ...person, name: e.target.value })}
        placeholder="Name"
        aria-label={`Name of person ${index + 1}`}
      />
      <button
        type="button"
        className={styles.removeButton}
        onClick={onRemove}
        aria-label={`Remove ${person.name || `person ${index + 1}`}`}
      >
        Remove
      </button>
    </div>
  )
}
