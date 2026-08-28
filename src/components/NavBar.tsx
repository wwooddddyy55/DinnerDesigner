import styles from './NavBar.module.css'

export type View = 'setup' | 'library' | 'plan' | 'shopping-list'

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
]

export function NavBar({ current, onNavigate, hasActivePlan }: NavBarProps) {
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
    </nav>
  )
}
