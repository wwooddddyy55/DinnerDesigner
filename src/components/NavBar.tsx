import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { View } from '../lib/navigation'
import { getSyncStatus, subscribeSyncStatus } from '../lib/sync'
import type { SyncStatus } from '../lib/sync'
import { THEME_LABELS, getThemePreference, nextThemePreference, setThemePreference } from '../lib/theme'
import styles from './NavBar.module.css'

interface NavBarProps {
  current: View
  onNavigate: (view: View) => void
  hasActivePlan: boolean
}

/** `short` is shown instead of `label` on phones, so all five tabs fit. */
const TABS: { id: View; label: string; short: string; requiresPlan?: boolean }[] = [
  { id: 'setup', label: 'Weekly Setup', short: 'Setup' },
  { id: 'library', label: 'Meal Library', short: 'Meals' },
  { id: 'plan', label: 'Plan Builder', short: 'Plan', requiresPlan: true },
  { id: 'shopping-list', label: 'Shopping List', short: 'Shop', requiresPlan: true },
  { id: 'history', label: 'History', short: 'History' },
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
  const [theme, setTheme] = useState(getThemePreference)
  // The sync explanation is a tap-to-show line, not just a hover tooltip, so
  // it's reachable on touchscreens.
  const [showSyncInfo, setShowSyncInfo] = useState(false)
  const activeTabRef = useRef<HTMLButtonElement>(null)

  // Keep the current tab in view if the tab strip ever has to scroll.
  useEffect(() => {
    activeTabRef.current?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' })
  }, [current])

  function cycleTheme() {
    const next = nextThemePreference(theme)
    setThemePreference(next)
    setTheme(next)
  }

  return (
    <>
      <nav className={styles.bar}>
        <span className={styles.brand}>DinnerDesigner</span>
        <div className={styles.tabs}>
          {TABS.map((tab) => {
            const disabled = tab.requiresPlan && !hasActivePlan
            return (
              <button
                key={tab.id}
                ref={current === tab.id ? activeTabRef : undefined}
                type="button"
                className={`${styles.tab} ${current === tab.id ? styles.tabActive : ''}`}
                aria-current={current === tab.id ? 'page' : undefined}
                aria-label={tab.label}
                onClick={() => onNavigate(tab.id)}
                disabled={disabled}
                title={disabled ? 'Start a weekly plan first' : undefined}
              >
                <span className={styles.longLabel}>{tab.label}</span>
                <span className={styles.shortLabel} aria-hidden="true">
                  {tab.short}
                </span>
              </button>
            )
          })}
        </div>
        <span className={styles.spacer} />
        {syncLabel && (
          <button
            type="button"
            className={`${styles.syncStatus} ${syncStatus === 'error' || syncStatus === 'offline' ? styles.syncStatusWarn : ''}`}
            title={syncLabel.title}
            aria-expanded={showSyncInfo}
            onClick={() => setShowSyncInfo((v) => !v)}
          >
            <span role="status">{syncLabel.text}</span>
          </button>
        )}
        <button
          type="button"
          className={styles.themeButton}
          onClick={cycleTheme}
          title="Switch between automatic, light and dark theme"
        >
          {THEME_LABELS[theme]}
        </button>
      </nav>
      {syncLabel && showSyncInfo && <p className={styles.planHint}>{syncLabel.title}</p>}
      {!hasActivePlan && (
        <p className={styles.planHint}>Plan Builder and Shopping List unlock once you start a week on Weekly Setup.</p>
      )}
    </>
  )
}
