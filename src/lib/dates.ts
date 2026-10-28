/** Local-date helpers. Dates are YYYY-MM-DD strings in the user's local time zone. */

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function today(): string {
  return isoDate(new Date())
}

export function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(s: string, n: number): string {
  const d = parseDate(s)
  d.setDate(d.getDate() + n)
  return isoDate(d)
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseDate(b).getTime() - parseDate(a).getTime()) / 86_400_000)
}

/** Monday of the week containing s. */
export function weekStart(s: string): string {
  const d = parseDate(s)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return isoDate(d)
}

const DAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za']
const DAYS_LONG = ['zondag', 'maandag', 'dinsdag', 'woensdag', 'donderdag', 'vrijdag', 'zaterdag']
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

export function dayShort(s: string): string {
  return DAYS[parseDate(s).getDay()]
}

export function longDate(s: string): string {
  const d = parseDate(s)
  return `${DAYS_LONG[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function shortDate(s: string): string {
  const d = parseDate(s)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}
