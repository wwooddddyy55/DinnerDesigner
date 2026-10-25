import styles from './ProgressBar.module.css'

interface ProgressBarProps {
  picked: number
  target: number
  label?: string
  /** Optional line under the bar, e.g. which slots are still empty. */
  detail?: string
}

export function ProgressBar({ picked, target, label, detail }: ProgressBarProps) {
  const pct = target > 0 ? Math.min(100, (picked / target) * 100) : picked > 0 ? 100 : 0
  const met = target > 0 && picked >= target
  const over = target > 0 && picked > target
  const remaining = target - picked

  let statusText: string
  let statusClass: string
  if (target === 0) {
    statusText = 'No target set'
    statusClass = styles.statusUnder
  } else if (over) {
    statusText = `${picked - target} over target`
    statusClass = styles.statusOver
  } else if (met) {
    statusText = 'Target met'
    statusClass = styles.statusMet
  } else {
    statusText = `${remaining} to go`
    statusClass = styles.statusUnder
  }

  return (
    <div className={styles.wrapper}>
      {label && (
        <div className={styles.labelRow}>
          <span>{label}</span>
        </div>
      )}
      <div className={styles.labelRow}>
        <span className={styles.count}>
          {picked} / {target} servings
        </span>
        <span className={`${styles.status} ${statusClass}`}>{statusText}</span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-label={label ? `${label} servings placed` : 'Servings placed'}
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.min(picked, target)}
        aria-valuetext={`${picked} of ${target} servings, ${statusText}`}
      >
        <div
          className={`${styles.fill} ${met ? styles.fillMet : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {detail && <div className={styles.detail}>{detail}</div>}
    </div>
  )
}
