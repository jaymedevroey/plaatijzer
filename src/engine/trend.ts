import { addDays, daysBetween } from '../lib/dates'

export interface TrendPoint {
  date: string
  raw: number | null
  trend: number
}

const ALPHA = 0.1

/**
 * Exponentially smoothed weight trend (Hacker's Diet style).
 * Missing days are linearly interpolated so 3–4 weigh-ins a week still give a smooth daily trend.
 */
export function weightTrend(entries: { date: string; weight: number | null }[]): TrendPoint[] {
  const ws = entries
    .filter((e): e is { date: string; weight: number } => e.weight != null)
    .sort((a, b) => a.date.localeCompare(b.date))
  if (ws.length === 0) return []

  const out: TrendPoint[] = []
  let trend = ws[0].weight
  for (let i = 0; i < ws.length; i++) {
    const cur = ws[i]
    if (i > 0) {
      const prev = ws[i - 1]
      const gap = daysBetween(prev.date, cur.date)
      for (let d = 1; d < gap; d++) {
        const interp = prev.weight + ((cur.weight - prev.weight) * d) / gap
        trend = trend + ALPHA * (interp - trend)
        out.push({ date: addDays(prev.date, d), raw: null, trend })
      }
      trend = trend + ALPHA * (cur.weight - trend)
    }
    out.push({ date: cur.date, raw: cur.weight, trend })
  }
  return out
}

export interface Rate {
  /** kg per week */
  perWeek: number
  days: number
  provisional: boolean
}

/** Weekly rate of change of the trend over the last `window` days (14 by default). */
export function weeklyRate(points: TrendPoint[], window = 14): Rate | null {
  if (points.length < 2) return null
  const last = points[points.length - 1]
  const startIdx = Math.max(0, points.length - 1 - window)
  const first = points[startIdx]
  const days = daysBetween(first.date, last.date)
  if (days < 7) return null
  return { perWeek: ((last.trend - first.trend) / days) * 7, days, provisional: days < window }
}
