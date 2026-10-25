import { isDeepEqual } from './equal'
import { CURRENT_SCHEMA_VERSION, normalizeAppData } from './migrations'
import { useAppStore } from '../store/useAppStore'
import type { Meal, Staple, WeeklyPlan } from '../types'

export interface SyncStatePayload {
  meals: Meal[]
  plans: WeeklyPlan[]
  staples: Staple[]
  activePlanId: string | null
  hasSeededMeals: boolean
}

interface ServerState extends SyncStatePayload {
  updatedAt: number
}

/** What the NavBar's sync indicator shows. `local-only` = no backend and this
 * device has never synced (plain `npm run dev`, or a non-add-on deploy) — the
 * indicator stays hidden then. */
export type SyncStatus = 'local-only' | 'synced' | 'saving' | 'error' | 'offline'

const FETCH_TIMEOUT_MS = 5000
const PUSH_DEBOUNCE_MS = 800
const PULL_INTERVAL_MS = 30_000
const RETRY_BASE_MS = 2000
const RETRY_MAX_MS = 60_000
// Browsers refuse `keepalive` fetches with bodies over 64 KiB.
const KEEPALIVE_MAX_BYTES = 60_000
const META_STORAGE_KEY = 'dinner-designer-sync-meta'

// --- module state -----------------------------------------------------------

let backendAvailable = false
/** Server `updatedAt` of the version `base` was taken from. Sent with every
 * push so the server can reject it (409) if someone else wrote since. */
let lastSyncedAt = 0
/** The last state known to be identical on this device and the server — the
 * common ancestor for the three-way merge when a push conflicts. `null` when
 * there isn't one in memory (e.g. right after startup with unsynced edits). */
let base: SyncStatePayload | null = null
/** True while this device has local edits the server hasn't accepted yet.
 * Persisted (with `lastSyncedAt`) so unsynced edits survive a reload and are
 * merged, not discarded, on the next start. */
let dirty = false
/** Incremented on every local store change, so a push can tell whether more
 * edits landed while it was in flight. */
let changeSeq = 0
let applyingRemote = false
let pushInFlight = false
let pullInFlight = false
let debounceTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = RETRY_BASE_MS
let loopStarted = false

let status: SyncStatus = 'local-only'
const statusListeners = new Set<() => void>()

function setStatus(next: SyncStatus): void {
  if (next === status) return
  status = next
  for (const listener of statusListeners) listener()
}

export function getSyncStatus(): SyncStatus {
  return status
}

export function subscribeSyncStatus(listener: () => void): () => void {
  statusListeners.add(listener)
  return () => statusListeners.delete(listener)
}

function loadMeta(): void {
  try {
    const raw = localStorage.getItem(META_STORAGE_KEY)
    if (!raw) return
    const meta = JSON.parse(raw) as { lastSyncedAt?: unknown; dirty?: unknown }
    if (typeof meta.lastSyncedAt === 'number') lastSyncedAt = meta.lastSyncedAt
    if (typeof meta.dirty === 'boolean') dirty = meta.dirty
  } catch {
    // unreadable meta → treat as never synced, nothing dirty
  }
}

function saveMeta(): void {
  try {
    localStorage.setItem(META_STORAGE_KEY, JSON.stringify({ lastSyncedAt, dirty }))
  } catch {
    // storage full/blocked — in-memory state still drives this session
  }
}

function markDirty(value: boolean): void {
  if (dirty === value) return
  dirty = value
  saveMeta()
}

function offlineStatus(): SyncStatus {
  return lastSyncedAt > 0 ? 'offline' : 'local-only'
}

// --- transport --------------------------------------------------------------

async function fetchWithTimeout(input: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

/** Fetches the server's state, or `'unchanged'` when `since` is given and the
 * server is still at that version (the server then skips sending the full
 * state, which keeps the 30s poll cheap). `null` = backend unreachable. */
async function fetchServerState(since?: number): Promise<ServerState | 'unchanged' | null> {
  try {
    // Relative, not root-absolute: under Home Assistant Ingress the app is served
    // under a path prefix, and a leading '/' would resolve against the HA host's
    // true root instead of that prefix (same issue vite.config.ts's base: './' works
    // around for asset paths — see DEPLOY.md).
    const url = since ? `api/state?since=${since}` : 'api/state'
    const res = await fetchWithTimeout(url, { cache: 'no-store' })
    if (!res.ok) return null
    const body = (await res.json()) as Partial<ServerState> & { unchanged?: unknown }
    if (typeof body.updatedAt !== 'number') return null
    // Older backends ignore `since` and always send the full state.
    if (body.unchanged === true) return body.updatedAt === since ? 'unchanged' : null
    return toServerState(body)
  } catch {
    return null
  }
}

type PushResult = { kind: 'ok'; updatedAt: number } | { kind: 'conflict'; state: ServerState } | { kind: 'error' }

async function pushServerState(payload: SyncStatePayload, baseUpdatedAt: number, keepalive = false): Promise<PushResult> {
  try {
    const body = JSON.stringify({ ...payload, schemaVersion: CURRENT_SCHEMA_VERSION, baseUpdatedAt })
    const res = await fetchWithTimeout('api/state', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: keepalive && body.length <= KEEPALIVE_MAX_BYTES,
    })
    if (res.status === 409) {
      const conflict = (await res.json()) as { state?: Partial<ServerState> }
      if (conflict.state && typeof conflict.state.updatedAt === 'number') {
        return { kind: 'conflict', state: toServerState(conflict.state) }
      }
      return { kind: 'error' }
    }
    if (!res.ok) return { kind: 'error' }
    const ok = (await res.json()) as { updatedAt: number }
    return { kind: 'ok', updatedAt: ok.updatedAt }
  } catch {
    return { kind: 'error' }
  }
}

/** Normalizes untrusted server JSON (anyone who can reach the add-on can
 * write it) into a safe, current-shape state before anything touches it. */
function toServerState(raw: Partial<ServerState>): ServerState {
  const { meals, plans, staples } = normalizeAppData(raw)
  return {
    meals,
    plans,
    staples,
    activePlanId: typeof raw.activePlanId === 'string' ? raw.activePlanId : null,
    hasSeededMeals: Boolean(raw.hasSeededMeals),
    updatedAt: raw.updatedAt ?? 0,
  }
}

// --- merge ------------------------------------------------------------------

function newer<T extends { updatedAt: string }>(local: T, server: T): T {
  // ISO timestamps compare correctly as strings; ties go to this device.
  return server.updatedAt > local.updatedAt ? server : local
}

/** Three-way merge of one id-keyed collection. Per record: if only one side
 * changed it relative to `base`, that side wins (including deletions); if
 * both changed it, the newer `updatedAt` wins; if one side deleted it and the
 * other edited it, the edit wins (never silently lose work). With no `base`
 * (unknown common ancestor) every difference is treated as "both changed",
 * so nothing either side has is dropped. */
function mergeById<T extends { id: string; updatedAt: string }>(
  baseList: T[] | null,
  localList: T[],
  serverList: T[],
): T[] {
  const baseById = new Map((baseList ?? []).map((x) => [x.id, x]))
  const localById = new Map(localList.map((x) => [x.id, x]))
  const serverById = new Map(serverList.map((x) => [x.id, x]))
  const ids = [...new Set([...serverList.map((x) => x.id), ...localList.map((x) => x.id)])]
  const merged: T[] = []
  for (const id of ids) {
    const b = baseById.get(id)
    const l = localById.get(id)
    const s = serverById.get(id)
    const inBase = baseList !== null && baseById.has(id)
    const localChanged = baseList === null ? true : !isDeepEqual(b, l)
    const serverChanged = baseList === null ? true : !isDeepEqual(b, s)

    let pick: T | undefined
    if (!localChanged) pick = s
    else if (!serverChanged) pick = l
    else if (l && s) pick = isDeepEqual(l, s) ? s : newer(l, s)
    else if (inBase) pick = l ?? s // deleted on one side, edited on the other
    else pick = l ?? s // brand new on one side only
    if (pick) merged.push(pick)
  }
  return merged
}

function mergeStates(
  baseState: SyncStatePayload | null,
  local: SyncStatePayload,
  server: SyncStatePayload,
): SyncStatePayload {
  const meals = mergeById(baseState?.meals ?? null, local.meals, server.meals)
  const plans = mergeById(baseState?.plans ?? null, local.plans, server.plans)
  const staples = mergeById(baseState?.staples ?? null, local.staples, server.staples)
  return {
    meals,
    plans,
    staples,
    activePlanId: pickActivePlanId(local.activePlanId, server.activePlanId, plans),
    hasSeededMeals: local.hasSeededMeals || server.hasSeededMeals,
  }
}

/** The active week is a per-device choice: keep this device's while it still
 * exists, falling back to the server's (e.g. on a fresh device), then to the
 * most recent week, so another device switching or deleting its week never
 * moves or blanks this one's view. */
function pickActivePlanId(local: string | null, server: string | null, plans: WeeklyPlan[]): string | null {
  const planIds = new Set(plans.map((p) => p.id))
  if (local && planIds.has(local)) return local
  if (server && planIds.has(server)) return server
  if (plans.length === 0) return null
  return plans.reduce((latest, p) => (p.weekStartDate > latest.weekStartDate ? p : latest)).id
}

/** Whether two states hold the same shared data. `activePlanId` and
 * `hasSeededMeals` are left out: they're per-device and never worth a push. */
function sameSharedData(a: SyncStatePayload, b: SyncStatePayload): boolean {
  return isDeepEqual(a.meals, b.meals) && isDeepEqual(a.plans, b.plans) && isDeepEqual(a.staples, b.staples)
}

// --- applying state -----------------------------------------------------------

function currentPayload(): SyncStatePayload {
  const { meals, plans, staples, activePlanId, hasSeededMeals } = useAppStore.getState()
  return { meals, plans, staples, activePlanId, hasSeededMeals }
}

function stripVersion(server: ServerState): SyncStatePayload {
  const { meals, plans, staples, activePlanId, hasSeededMeals } = server
  return { meals, plans, staples, activePlanId, hasSeededMeals }
}

/** Writes state into the store without it counting as a local edit (so it
 * isn't immediately pushed back — the old echo-push loop). */
function applyToStore(state: SyncStatePayload): void {
  applyingRemote = true
  try {
    useAppStore.setState(state)
  } finally {
    applyingRemote = false
  }
}

/** Reconciles the server's latest state with this device's. Without unsynced
 * local edits, simply adopts the server's. With them, merges (three-way when
 * the common ancestor is known) and leaves the result dirty so it gets
 * pushed. Returns whether the server state was adopted unchanged. */
function reconcileWith(server: ServerState): 'adopted' | 'merged' {
  const serverPayload = stripVersion(server)
  const local = currentPayload()
  // `updatedAt === 0` means the server has never been written (fresh install,
  // or its data was reset) — not that everything was deleted — so this
  // device's data must be kept and becomes the shared starting point.
  const serverReset = server.updatedAt === 0
  if (serverReset && (local.meals.length > 0 || local.plans.length > 0)) markDirty(true)
  if (!dirty) {
    applyToStore({
      ...serverPayload,
      activePlanId: pickActivePlanId(local.activePlanId, serverPayload.activePlanId, serverPayload.plans),
    })
    base = serverPayload
    lastSyncedAt = server.updatedAt
    saveMeta()
    return 'adopted'
  }
  const ancestor = serverReset ? null : (base ?? (lastSyncedAt === server.updatedAt ? serverPayload : null))
  const merged = mergeStates(ancestor, local, serverPayload)
  applyToStore(merged)
  base = serverPayload
  lastSyncedAt = server.updatedAt
  markDirty(!sameSharedData(merged, serverPayload))
  saveMeta()
  return 'merged'
}

// --- push / pull loop -----------------------------------------------------------

function scheduleRetry(): void {
  if (retryTimer) return
  retryTimer = setTimeout(() => {
    retryTimer = undefined
    void flush()
  }, retryDelay)
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
}

/** Pushes local edits if there are any. On 409 merges with the newer server
 * state and pushes the merge; on failure retries with backoff. Failed pushes
 * keep the device dirty, so a later pull merges instead of overwriting. */
async function flush(keepalive = false): Promise<void> {
  if (!backendAvailable || !dirty || pushInFlight) return
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = undefined
  }
  pushInFlight = true
  setStatus('saving')
  const seqAtPush = changeSeq
  const payload = currentPayload()
  const result = await pushServerState(payload, lastSyncedAt, keepalive)
  pushInFlight = false

  if (result.kind === 'ok') {
    base = payload
    lastSyncedAt = result.updatedAt
    retryDelay = RETRY_BASE_MS
    markDirty(changeSeq !== seqAtPush)
    saveMeta()
    if (dirty) void flush()
    else setStatus('synced')
    return
  }

  if (result.kind === 'conflict') {
    reconcileWith(result.state)
    retryDelay = RETRY_BASE_MS
    if (dirty) void flush()
    else setStatus('synced')
    return
  }

  setStatus('error')
  scheduleRetry()
}

/** Fetches the server's state and reconciles if it has changed. Also serves
 * as the reconnect probe when the backend was unreachable. */
async function pull(): Promise<void> {
  if (pullInFlight || pushInFlight) return
  pullInFlight = true
  try {
    const syncedAtStart = lastSyncedAt
    const server = await fetchServerState(syncedAtStart)
    if (!server) {
      backendAvailable = false
      setStatus(offlineStatus())
      return
    }
    backendAvailable = true
    // A push can start (and land) while this GET is in flight. Its response is
    // then older than what this device already has, and reconciling with it
    // would revert the push — so drop it; the next pull fetches fresh state.
    if (pushInFlight || lastSyncedAt !== syncedAtStart) return
    if (server !== 'unchanged' && server.updatedAt !== lastSyncedAt) reconcileWith(server)
    // Unchanged server + local edits (e.g. made while it was unreachable):
    // `lastSyncedAt` is still the right base, so a plain push is accepted.
    if (dirty) await flush()
    else setStatus('synced')
  } finally {
    pullInFlight = false
  }
}

/** Runs once on app mount, before `seedMealsIfNeeded()`. Detects whether a
 * sync backend is reachable (falling back to pure-localStorage behavior if
 * not — this is also what keeps `npm run dev`/`preview` working with zero
 * backend present) and reconciles this device's locally-hydrated state
 * against the server's: adopting it when this device has no unsynced edits,
 * merging when it does. */
export async function initialSync(): Promise<'no-backend' | 'adopted-server' | 'merged' | 'seeded-server' | 'server-empty'> {
  loadMeta()
  const server = await fetchServerState()
  if (!server || server === 'unchanged') {
    backendAvailable = false
    setStatus(offlineStatus())
    return 'no-backend'
  }
  backendAvailable = true

  if (server.updatedAt === 0) {
    const local = currentPayload()
    if (local.meals.length === 0 && local.plans.length === 0) return 'server-empty'
    reconcileWith(server)
    await flush()
    return 'seeded-server'
  }

  const result = reconcileWith(server)
  if (dirty) await flush()
  else setStatus('synced')
  return result === 'adopted' ? 'adopted-server' : 'merged'
}

/** Starts the ongoing sync loop: pushes local changes (debounced, retried on
 * failure), flushes pending changes when the tab is hidden, and pulls the
 * server's latest state on focus/visibility, when the network comes back, and
 * every 30s while visible. Keeps probing for the backend if it was
 * unreachable at startup. Must only be called after `initialSync()` has
 * resolved; idempotent. Returns a cleanup function. */
export function startSyncLoop(): () => void {
  if (loopStarted) return () => {}
  loopStarted = true

  // Anything already in the store that the server doesn't have yet (e.g.
  // starter meals seeded just now into an empty server) goes up immediately,
  // so a second fresh device adopts it instead of seeding its own copies.
  if (backendAvailable && lastSyncedAt === 0) {
    const local = currentPayload()
    if (local.meals.length > 0 || local.plans.length > 0) {
      markDirty(true)
      void flush()
    }
  }

  const unsubscribe = useAppStore.subscribe((state, prev) => {
    if (applyingRemote) return
    // Switching weeks (activePlanId) is per-device; only shared data is pushed.
    if (state.meals === prev.meals && state.plans === prev.plans && state.staples === prev.staples) return
    changeSeq++
    markDirty(true)
    if (!backendAvailable) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = undefined
      void flush()
    }, PUSH_DEBOUNCE_MS)
  })

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') {
      // Don't let the debounce window swallow an edit made just before the
      // tab is closed or backgrounded.
      void flush(true)
    } else {
      void pull()
    }
  }
  function onPageHide() {
    void flush(true)
  }
  function onFocusOrOnline() {
    void pull()
  }

  document.addEventListener('visibilitychange', onVisibilityChange)
  window.addEventListener('pagehide', onPageHide)
  window.addEventListener('focus', onFocusOrOnline)
  window.addEventListener('online', onFocusOrOnline)
  const interval = setInterval(() => {
    if (document.visibilityState === 'visible') void pull()
  }, PULL_INTERVAL_MS)

  return () => {
    unsubscribe()
    document.removeEventListener('visibilitychange', onVisibilityChange)
    window.removeEventListener('pagehide', onPageHide)
    window.removeEventListener('focus', onFocusOrOnline)
    window.removeEventListener('online', onFocusOrOnline)
    clearInterval(interval)
    if (debounceTimer) clearTimeout(debounceTimer)
    if (retryTimer) clearTimeout(retryTimer)
    debounceTimer = undefined
    retryTimer = undefined
    loopStarted = false
  }
}
