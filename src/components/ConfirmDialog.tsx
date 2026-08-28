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
  return (
    <div className={styles.overlay}>
      <div className={styles.box}>
        <h3>{title}</h3>
        <p>{message}</p>
        <div className={styles.footer}>
          <button type="button" className="button buttonSecondary" onClick={onCancel}>
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
