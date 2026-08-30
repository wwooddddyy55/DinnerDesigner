export function toIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatWeekLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** Weekday abbreviation indexed by `Date.getDay()` (0=Sun..6=Sat). */
export const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** Short header label for a day grid column, e.g. "Mon 9/1". */
export function formatDayHeader(weekStartDate: string, day: number): string {
  const [year, month, date] = addDays(weekStartDate, day).split('-').map(Number)
  const weekday = WEEKDAY_LABELS[new Date(year, month - 1, date).getDay()]
  return `${weekday} ${month}/${date}`
}
