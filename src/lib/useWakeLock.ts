import { useEffect } from 'react'

/** Keeps the screen on while the calling component is mounted (and `active`),
 * re-acquiring the lock when the tab becomes visible again — the browser
 * releases it whenever the page is hidden. Does nothing where the Screen
 * Wake Lock API is missing, which includes plain-HTTP pages (it needs a
 * secure context), so the add-on's direct port simply goes without. */
export function useWakeLock(active = true): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return
    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    async function acquire() {
      if (document.visibilityState !== 'visible' || sentinel) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) {
          void lock.release()
          return
        }
        sentinel = lock
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null
        })
      } catch {
        // Denied (battery saver, permissions policy, an iframe without
        // allow="screen-wake-lock"): the screen just dims as usual.
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release()
      sentinel = null
    }
  }, [active])
}
