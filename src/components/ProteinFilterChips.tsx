import { PROTEIN_TYPES } from '../types'
import type { ProteinType } from '../types'
import styles from './ProteinFilterChips.module.css'

interface ProteinFilterChipsProps {
  selected: ProteinType[]
  onToggle: (protein: ProteinType) => void
  onClear: () => void
}

export function ProteinFilterChips({ selected, onToggle, onClear }: ProteinFilterChipsProps) {
  return (
    <div className={styles.row}>
      {PROTEIN_TYPES.map((protein) => {
        const active = selected.includes(protein)
        return (
          <button
            key={protein}
            type="button"
            className={`${styles.chip} ${active ? styles.chipActive : ''}`}
            onClick={() => onToggle(protein)}
            aria-pressed={active}
          >
            {protein}
          </button>
        )
      })}
      {selected.length > 0 && (
        <button type="button" className={styles.chip} onClick={onClear}>
          Clear
        </button>
      )}
    </div>
  )
}
