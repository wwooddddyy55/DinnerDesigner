const CLIPBOARD_TIMEOUT_MS = 1500

/**
 * Copies text to the clipboard, working around the Clipboard API's secure-context
 * requirement (it's unavailable over plain HTTP, e.g. the Home Assistant add-on
 * reached by local IP). Falls back to the legacy `execCommand('copy')` path, which
 * still works in insecure contexts when triggered by a user gesture.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      // Some embedded browsers (e.g. app webviews) leave a permission-less
      // write pending forever; treat that as a failure so callers can show
      // their manual-copy fallback instead of appearing to do nothing.
      await Promise.race([
        navigator.clipboard.writeText(text),
        new Promise((_, reject) => setTimeout(() => reject(new Error('clipboard timeout')), CLIPBOARD_TIMEOUT_MS)),
      ])
      return true
    } catch {
      // fall through to the legacy fallback below
    }
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()

  let succeeded = false
  try {
    succeeded = document.execCommand('copy')
  } catch {
    succeeded = false
  }

  document.body.removeChild(textarea)
  return succeeded
}
