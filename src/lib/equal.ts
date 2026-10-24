/** Structural equality for JSON-shaped data (plain objects, arrays,
 * primitives). Key order doesn't matter, and an own key whose value is
 * `undefined` counts as absent — matching how `JSON.stringify` (and therefore
 * localStorage/sync round-trips) treats it. */
export function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, i) => isDeepEqual(item, b[i]))
  }
  const aObj = a as Record<string, unknown>
  const bObj = b as Record<string, unknown>
  const aKeys = Object.keys(aObj).filter((k) => aObj[k] !== undefined)
  const bKeys = Object.keys(bObj).filter((k) => bObj[k] !== undefined)
  if (aKeys.length !== bKeys.length) return false
  return aKeys.every((k) => isDeepEqual(aObj[k], bObj[k]))
}
