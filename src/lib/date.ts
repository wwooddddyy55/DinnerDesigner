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

// The device's locale decides weekday names and day/month order, the same as
// `formatWeekLabel` above. Created once: formatters are costly to build and
// the day grids format dozens of labels per render.
const weekdayFormat = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
const dayMonthFormat = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' })

export function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

/** The two halves of a day grid column header, in the device's locale: e.g.
 * `{ weekday: 'Mon', date: '9/1' }` in the US, `{ weekday: 'Mo.', date: '1.9.' }`
 * in Germany. Kept apart so narrow layouts can stack them. */
export function formatDayHeaderParts(weekStartDate: string, day: number): { weekday: string; date: string } {
  const [year, month, date] = addDays(weekStartDate, day).split('-').map(Number)
  const d = new Date(year, month - 1, date)
  return { weekday: weekdayFormat.format(d), date: dayMonthFormat.format(d) }
}

/** Short header label for a day grid column, e.g. "Mon 9/1". */
export function formatDayHeader(weekStartDate: string, day: number): string {
  const { weekday, date } = formatDayHeaderParts(weekStartDate, day)
  return `${weekday} ${date}`
}
