import { useId } from 'react'
import { useDialog } from '../lib/useDialog'
import styles from './ConfirmDialog.module.css'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useDialog<HTMLDivElement>(onCancel)
  const titleId = useId()
  const messageId = useId()
  return (
    <div className={styles.overlay}>
      <div
        ref={dialogRef}
        className={styles.box}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
      >
        <h3 id={titleId}>{title}</h3>
        <p id={messageId}>{message}</p>
        <div className={styles.footer}>
          {/* Cancel gets initial focus so a stray Enter never confirms a destructive action. */}
          <button type="button" className="button buttonSecondary" onClick={onCancel} data-autofocus>
            Cancel
          </button>
          <button type="button" className="button buttonDanger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
