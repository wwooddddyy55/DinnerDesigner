import { useEffect, useState } from 'react'
import { NavBar } from './components/NavBar'
import { UndoToast } from './components/UndoToast'
import type { View } from './components/NavBar'
import { HistoryScreen } from './screens/HistoryScreen'
import { MealLibraryScreen } from './screens/MealLibraryScreen'
import { PlanBuilderScreen } from './screens/PlanBuilderScreen'
import { ShoppingListScreen } from './screens/ShoppingListScreen'
import { WeeklyPlanSetupScreen } from './screens/WeeklyPlanSetupScreen'
import { initialSync, startSyncLoop } from './lib/sync'
import { useAppStore } from './store/useAppStore'

function App() {
  const [view, setView] = useState<View>('setup')
  const [syncReady, setSyncReady] = useState(false)
  const seedMealsIfNeeded = useAppStore((s) => s.seedMealsIfNeeded)
  const activePlanId = useAppStore((s) => s.activePlanId)
  const activePlan = useAppStore((s) => s.plans.find((p) => p.id === s.activePlanId))

  // Sync must resolve before seeding, so a fresh browser never seeds the
  // built-in starter meals only to have them immediately discarded by an
  // incoming server pull (see src/lib/sync.ts). A sync failure must never
  // leave the app blank, so any error falls through to local-only mode.
  useEffect(() => {
    let cancelled = false
    let stopSyncLoop: (() => void) | undefined
    initialSync()
      .catch((err: unknown) => {
        console.error('Initial sync failed; continuing with local data', err)
        return 'no-backend' as const
      })
      .then((result) => {
        if (cancelled) return
        if (result !== 'adopted-server' && result !== 'merged') seedMealsIfNeeded()
        stopSyncLoop = startSyncLoop()
        setSyncReady(true)
      })
    return () => {
      cancelled = true
      stopSyncLoop?.()
    }
  }, [seedMealsIfNeeded])

  // The active week can disappear under these screens (deleted here or on
  // another device); fall back to Setup instead of rendering nothing.
  const shownView: View = (view === 'plan' || view === 'shopping-list') && !activePlan ? 'setup' : view

  if (!syncReady) {
    return (
      <p className="loadingState" role="status">
        Loading your meal plans…
      </p>
    )
  }

  return (
    <div>
      <NavBar current={shownView} onNavigate={setView} hasActivePlan={Boolean(activePlanId)} />
      {shownView === 'setup' && <WeeklyPlanSetupScreen onNavigate={setView} />}
      {shownView === 'library' && <MealLibraryScreen />}
      {shownView === 'plan' && activePlan && <PlanBuilderScreen plan={activePlan} />}
      {shownView === 'shopping-list' && activePlan && <ShoppingListScreen plan={activePlan} />}
      {shownView === 'history' && <HistoryScreen />}
      <UndoToast />
    </div>
  )
}

export default App
