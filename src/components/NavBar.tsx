import { useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSyncStatus } from '../lib/sync'
import type { SyncStatus } from '../lib/sync'
import styles from './NavBar.module.css'

export type View = 'setup' | 'library' | 'plan' | 'shopping-list' | 'history'

interface NavBarProps {
  current: View
  onNavigate: (view: View) => void
  hasActivePlan: boolean
}

const TABS: { id: View; label: string; requiresPlan?: boolean }[] = [
  { id: 'setup', label: 'Weekly Setup' },
  { id: 'library', label: 'Meal Library' },
  { id: 'plan', label: 'Plan Builder', requiresPlan: true },
  { id: 'shopping-list', label: 'Shopping List', requiresPlan: true },
  { id: 'history', label: 'History' },
]

const SYNC_LABELS: Record<Exclude<SyncStatus, 'local-only'>, { text: string; title: string }> = {
  synced: { text: 'Synced', title: 'All changes are saved to the add-on and shared with your other devices.' },
  saving: { text: 'Saving…', title: 'Sending your latest changes to the add-on.' },
  error: {
    text: 'Sync error — retrying',
    title: "The add-on didn't accept the last save. Your changes are kept on this device and will be retried.",
  },
  offline: {
    text: 'Offline',
    title: "Can't reach the add-on. Changes are kept on this device and will sync when it's reachable again.",
  },
}

export function NavBar({ current, onNavigate, hasActivePlan }: NavBarProps) {
  const syncStatus = useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
  const syncLabel = syncStatus === 'local-only' ? null : SYNC_LABELS[syncStatus]
  return (
    <nav className={styles.bar}>
      <span className={styles.brand}>DinnerDesigner</span>
      {TABS.map((tab) => {
        const disabled = tab.requiresPlan && !hasActivePlan
        return (
          <button
            key={tab.id}
            type="button"
            className={`${styles.tab} ${current === tab.id ? styles.tabActive : ''}`}
            onClick={() => onNavigate(tab.id)}
            disabled={disabled}
            title={disabled ? 'Start a weekly plan first' : undefined}
          >
            {tab.label}
          </button>
        )
      })}
      {syncLabel && (
        <>
          <span className={styles.spacer} />
          <span
            className={`${styles.syncStatus} ${syncStatus === 'error' || syncStatus === 'offline' ? styles.syncStatusWarn : ''}`}
            title={syncLabel.title}
            role="status"
          >
            {syncLabel.text}
          </span>
        </>
      )}
    </nav>
  )
}
