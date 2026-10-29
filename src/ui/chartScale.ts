import { addDays, daysBetween, isoDate, parseDate, shortDate } from '../lib/dates'

const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']

/** Round tick values between lo and hi (steps of 1, 2 or 5 × 10ⁿ), as close to `want` ticks as possible; on a tie the finer one. */
export function niceTicks(lo: number, hi: number, want: number): { ticks: number[]; decimals: number } {
  const mag = 10 ** Math.floor(Math.log10((hi - lo) / want))
  const count = (s: number) => Math.floor(hi / s + 1e-9) - Math.ceil(lo / s - 1e-9) + 1
  const step = [1, 2, 5, 10].map((m) => m * mag).reduce((a, b) => (Math.abs(count(b) - want) < Math.abs(count(a) - want) ? b : a))
  const ticks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return { ticks, decimals: Math.max(0, -Math.floor(Math.log10(step) + 1e-9)) }
}

/**
 * Date labels that fit `width` px with at least `gap` px each: every day, every other day,
 * Mondays, every other Monday, then the first of the month (every 1, 2, 3, 6 or 12 months).
 */
export function dateTicks(from: string, to: string, width: number, gap = 56): { date: string; label: string }[] {
  const max = Math.max(2, Math.floor(width / gap))
  const series = (start: string, step: number) => {
    const out: string[] = []
    for (let d = start; d <= to; d = addDays(d, step)) out.push(d)
    return out
  }
  const monday = addDays(from, (8 - parseDate(from).getDay()) % 7)
  for (const [start, step] of [[from, 1], [from, 2], [monday, 7], [monday, 14]] as const) {
    const ds = series(start, step)
    if (ds.length <= max) return ds.map((d) => ({ date: d, label: shortDate(d) }))
  }
  const firsts: string[] = []
  const f = parseDate(from)
  for (let m = new Date(f.getFullYear(), f.getMonth() + (f.getDate() === 1 ? 0 : 1), 1); isoDate(m) <= to; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) {
    firsts.push(isoDate(m))
  }
  for (const k of [1, 2, 3, 6, 12]) {
    const ds = firsts.filter((_, i) => i % k === 0)
    if (ds.length <= max) {
      return ds.map((d) => {
        const p = parseDate(d)
        return { date: d, label: p.getMonth() === 0 ? `jan '${String(p.getFullYear()).slice(2)}` : MONTHS[p.getMonth()] }
      })
    }
  }
  return []
}

/** Index of the value in the ascending list `xs` closest to `x`. */
export function nearestIndex(xs: number[], x: number): number {
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] < x) lo = mid
    else hi = mid
  }
  return Math.abs(xs[lo] - x) <= Math.abs(xs[hi] - x) ? lo : hi
}

/** Day position of `date` between `from` and `to` (0–1); a single day sits in the middle. */
export function dayFraction(from: string, to: string, date: string): number {
  const span = daysBetween(from, to)
  return span <= 0 ? 0.5 : daysBetween(from, date) / span
}
