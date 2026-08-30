import { useEffect, useState } from 'react'
import { NavBar } from './components/NavBar'
import type { View } from './components/NavBar'
import { HistoryScreen } from './screens/HistoryScreen'
import { MealLibraryScreen } from './screens/MealLibraryScreen'
import { PlanBuilderScreen } from './screens/PlanBuilderScreen'
import { ShoppingListScreen } from './screens/ShoppingListScreen'
import { WeeklyPlanSetupScreen } from './screens/WeeklyPlanSetupScreen'
import { useAppStore } from './store/useAppStore'

function App() {
  const [view, setView] = useState<View>('setup')
  const seedMealsIfNeeded = useAppStore((s) => s.seedMealsIfNeeded)
  const activePlanId = useAppStore((s) => s.activePlanId)
  const activePlan = useAppStore((s) => s.plans.find((p) => p.id === s.activePlanId))

  useEffect(() => {
    seedMealsIfNeeded()
  }, [seedMealsIfNeeded])

  return (
    <div>
      <NavBar current={view} onNavigate={setView} hasActivePlan={Boolean(activePlanId)} />
      {view === 'setup' && <WeeklyPlanSetupScreen />}
      {view === 'library' && <MealLibraryScreen />}
      {view === 'plan' && activePlan && <PlanBuilderScreen plan={activePlan} />}
      {view === 'shopping-list' && activePlan && <ShoppingListScreen plan={activePlan} />}
      {view === 'history' && <HistoryScreen />}
    </div>
  )
}

export default App
