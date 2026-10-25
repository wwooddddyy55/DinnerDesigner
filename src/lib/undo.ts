/** A single-slot "Undo" offer shown by `UndoToast` after a destructive
 * action (removing a picked meal or person, deleting a week, importing data).
 * Callers capture whatever they need *before* the action and pass a `restore`
 * that puts it back. Only the most recent action is undoable; offering a new
 * one replaces the previous offer. Kept outside the persisted store on
 * purpose — an undo offer is per-tab and never synced. */
export interface UndoOffer {
  id: number
  message: string
  restore: () => void
}

export const UNDO_TIMEOUT_MS = 8000

let current: UndoOffer | null = null
let nextId = 1
let hideTimer: ReturnType<typeof setTimeout> | undefined
const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

export function getUndoOffer(): UndoOffer | null {
  return current
}

export function subscribeUndo(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

/** Returns the offer's id, for withdrawing just this offer via `dismissUndo`. */
export function offerUndo(message: string, restore: () => void): number {
  if (hideTimer) clearTimeout(hideTimer)
  current = { id: nextId++, message, restore }
  hideTimer = setTimeout(() => dismissUndo(), UNDO_TIMEOUT_MS)
  emit()
  return current.id
}

/** Hides the current offer — or, given an `id`, only if that offer is still
 * the current one (so a newer offer isn't withdrawn by mistake). */
export function dismissUndo(id?: number): void {
  if (id !== undefined && current?.id !== id) return
  if (hideTimer) clearTimeout(hideTimer)
  hideTimer = undefined
  if (!current) return
  current = null
  emit()
}

export function runUndo(): void {
  const offer = current
  dismissUndo()
  offer?.restore()
}
