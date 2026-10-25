import { useState } from 'react'
import type { ReactNode } from 'react'
import styles from './Collapsible.module.css'

interface CollapsibleProps {
  /** Element id, so other controls can jump to (and open) the section. */
  id: string
  title: ReactNode
  /** Whether it starts open; after that the user's own toggling wins. */
  defaultOpen?: boolean
  children: ReactNode
}

/** A `<details>` section with a sticky, tappable heading — used to keep long
 * screens (Weekly Setup) short on a phone. Open it from elsewhere with
 * `openSection(id)` from lib/openSection.ts. */
export function Collapsible({ id, title, defaultOpen = true, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <details id={id} className={styles.section} open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary className={styles.summary}>{title}</summary>
      <div className={styles.body}>{children}</div>
    </details>
  )
}
