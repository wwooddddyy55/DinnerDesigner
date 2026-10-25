import { useCallback, useSyncExternalStore } from 'react'

/** Live `window.matchMedia(query).matches`, re-rendering when it flips. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches)
}

/** When the Plan Builder uses its phone layout (2 tabs, one day at a time,
 * tap-to-place): narrow screens, plus touchscreens too short for the full
 * grid (a phone in landscape). CSS blocks styling that layout use the same
 * media query list — keep them in step. */
export const TOUCH_LAYOUT_QUERY = '(max-width: 700px), (pointer: coarse) and (max-height: 500px)'
