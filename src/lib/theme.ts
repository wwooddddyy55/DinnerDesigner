/** Light/dark theme preference. "auto" follows the OS/browser
 * (`prefers-color-scheme`); the manual choices exist because Home
 * Assistant's own dark theme doesn't reach the add-on's Ingress iframe, so a
 * dark HA dashboard would otherwise still show a light panel. Stored per
 * browser in localStorage (it's a device preference, not synced data) and
 * applied as `data-theme` on <html>, which global.css keys its tokens off. */
export type ThemePreference = 'auto' | 'light' | 'dark'

const STORAGE_KEY = 'dinner-designer-theme'

export const THEME_LABELS: Record<ThemePreference, string> = {
  auto: 'Theme: auto',
  light: 'Theme: light',
  dark: 'Theme: dark',
}

export function getThemePreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'auto') return stored
  } catch {
    // storage blocked — fall through to auto
  }
  return 'auto'
}

export function applyThemePreference(pref: ThemePreference): void {
  const root = document.documentElement
  if (pref === 'auto') delete root.dataset.theme
  else root.dataset.theme = pref
}

export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, pref)
  } catch {
    // storage blocked — still applies for this page view
  }
  applyThemePreference(pref)
}

export function nextThemePreference(pref: ThemePreference): ThemePreference {
  return pref === 'auto' ? 'light' : pref === 'light' ? 'dark' : 'auto'
}
