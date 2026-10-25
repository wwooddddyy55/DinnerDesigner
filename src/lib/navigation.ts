import { createContext, useContext } from 'react'

export type View = 'setup' | 'library' | 'plan' | 'shopping-list' | 'history'

/** Switches the top-level screen. Provided once by `App`, so any screen or
 * component can link to another screen (e.g. an empty state's "Open Meal
 * Library" button) without threading a callback through every prop list. */
export const NavigateContext = createContext<(view: View) => void>(() => {})

export function useNavigate(): (view: View) => void {
  return useContext(NavigateContext)
}
