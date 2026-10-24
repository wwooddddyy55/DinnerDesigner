/** Normalizes a user- or import-supplied recipe link to an absolute http(s)
 * URL, or returns `undefined` if it isn't one. A bare `example.com/recipe`
 * (no scheme) is treated as https. Anything else — `javascript:`, `data:`,
 * `blob:`, `file:`, garbage — is rejected, so a pasted/imported/synced
 * `sourceUrl` can never become a dangerous `<a href>`. */
export function toSafeHttpUrl(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  if (trimmed.length === 0) return undefined
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  try {
    const url = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return undefined
    if (!url.hostname) return undefined
    return url.href
  } catch {
    return undefined
  }
}
