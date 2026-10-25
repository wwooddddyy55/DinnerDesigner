/** Opens a collapsible section (a `Collapsible`'s `<details>`) by id, if
 * closed, and scrolls it into view — e.g. from the Weekly Setup checklist. */
export function openSection(id: string): void {
  const node = document.getElementById(id)
  if (!(node instanceof HTMLDetailsElement)) return
  node.open = true
  node.scrollIntoView({ block: 'start', behavior: 'smooth' })
}
