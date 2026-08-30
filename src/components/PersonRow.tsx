import type { Person } from '../types'
import styles from './PersonRow.module.css'

interface PersonRowProps {
  person: Person
  onChange: (person: Person) => void
  onRemove: () => void
}

export function PersonRow({ person, onChange, onRemove }: PersonRowProps) {
  return (
    <div className={styles.row}>
      <input
        className={styles.name}
        type="text"
        value={person.name}
        onChange={(e) => onChange({ ...person, name: e.target.value })}
        placeholder="Name"
      />
      <button type="button" className={styles.removeButton} onClick={onRemove}>
        Remove
      </button>
    </div>
  )
}
