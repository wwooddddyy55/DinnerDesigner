import { migratePerson, migratePlannedMealEntry, useAppStore } from '../store/useAppStore'
import type { Meal, WeeklyPlan } from '../types'

export interface SyncStatePayload {
  meals: Meal[]
  plans: WeeklyPlan[]
  activePlanId: string | null
  hasSeededMeals: boolean
}

interface ServerState extends SyncStatePayload {
  updatedAt: number
}

const FETCH_TIMEOUT_MS = 3000
const PUSH_DEBOUNCE_MS = 800

let lastAppliedUpdatedAt = 0
let backendAvailable = false

async function fetchServerState(): Promise<ServerState | null> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch('/api/state', { signal: controller.signal })
    if (!res.ok) return null
    return (await res.json()) as ServerState
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

async function pushServerState(payload: SyncStatePayload): Promise<number | null> {
  try {
    const res = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { updatedAt: number }
    return body.updatedAt
  } catch {
    return null
  }
}

function currentPayload(): SyncStatePayload {
  const { meals, plans, activePlanId, hasSeededMeals } = useAppStore.getState()
  return { meals, plans, activePlanId, hasSeededMeals }
}

function adoptServerState(server: ServerState): void {
  const plans = server.plans.map((plan) => ({
    ...plan,
    people: (plan.people ?? []).map((p) => migratePerson(p)),
    plannedMeals: (plan.plannedMeals ?? []).map((entry) => migratePlannedMealEntry(entry, server.meals)),
  }))
  useAppStore.setState({
    meals: server.meals,
    plans,
    activePlanId: server.activePlanId,
    hasSeededMeals: server.hasSeededMeals,
  })
  lastAppliedUpdatedAt = server.updatedAt
}

/** Runs once on app mount, before `seedMealsIfNeeded()`. Detects whether a
 * sync backend is reachable (falling back to today's pure-localStorage
 * behavior if not — this is also what keeps `npm run dev`/`preview` working
 * with zero backend present) and reconciles this device's locally-hydrated
 * state against the server's. */
export async function initialSync(): Promise<'no-backend' | 'adopted-server' | 'seeded-server' | 'server-empty'> {
  const server = await fetchServerState()
  if (!server) {
    backendAvailable = false
    return 'no-backend'
  }
  backendAvailable = true

  if (server.updatedAt === 0) {
    const local = currentPayload()
    if (local.meals.length === 0 && local.plans.length === 0) {
      return 'server-empty'
    }
    const updatedAt = await pushServerState(local)
    if (updatedAt !== null) lastAppliedUpdatedAt = updatedAt
    return 'seeded-server'
  }

  adoptServerState(server)
  return 'adopted-server'
}

/** Starts the ongoing sync loop: pushes local changes to the server
 * (debounced) and pulls the server's latest state whenever the tab regains
 * focus. Must only be called after `initialSync()` has resolved. */
export function startSyncLoop(): void {
  if (!backendAvailable) return

  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  useAppStore.subscribe(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      void pushServerState(currentPayload()).then((updatedAt) => {
        if (updatedAt !== null) lastAppliedUpdatedAt = updatedAt
      })
    }, PUSH_DEBOUNCE_MS)
  })

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    void fetchServerState().then((server) => {
      if (server && server.updatedAt > lastAppliedUpdatedAt) {
        adoptServerState(server)
      }
    })
  })
}
