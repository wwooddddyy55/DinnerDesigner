import { useSyncExternalStore } from 'react'
import { dismissUndo, getUndoOffer, runUndo, subscribeUndo } from '../lib/undo'
import styles from './UndoToast.module.css'

/** Bottom-of-screen "Removed X. [Undo]" toast for the most recent destructive
 * action (see `lib/undo.ts`). Rendered once, from `App.tsx`. */
export function UndoToast() {
  const offer = useSyncExternalStore(subscribeUndo, getUndoOffer)
  return (
    <div className={styles.region} role="status" aria-live="polite">
      {offer && (
        <div className={styles.toast} key={offer.id}>
          <span className={styles.message}>{offer.message}</span>
          <button type="button" className={styles.undoButton} onClick={runUndo}>
            Undo
          </button>
          <button type="button" className={styles.closeButton} onClick={() => dismissUndo()} aria-label="Dismiss">
            &times;
          </button>
        </div>
      )}
    </div>
  )
}
