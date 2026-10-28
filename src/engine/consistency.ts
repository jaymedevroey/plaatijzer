import type { DailyLog } from '../lib/types'
import { addDays, parseDate, weekStart } from '../lib/dates'

export type Metric = 'training' | 'wegen'
export type Level = 0 | 1 | 2 | 3 | 4

export interface DayStat {
  date: string
  workouts: { id: string; name: string; sets: number }[]
  weight: number | null
  gymDay: boolean
  level: Record<Metric, Level>
}

export interface ConsistencyInput {
  logs: DailyLog[]
  /** Finished workouts with their local date, program-day name and number of done work sets. */
  workouts: { id: string; date: string; name: string; sets: number }[]
  gymDays: number[]
}

/** Training colour by done work sets; a weigh-in is simply there or not. */
function setsLevel(sets: number, trained: boolean): Level {
  if (!trained) return 0
  return sets < 8 ? 1 : sets < 13 ? 2 : sets < 18 ? 3 : 4
}

/** One entry per day from `from` to `to` (inclusive), oldest first. */
export function buildDays(from: string, to: string, input: ConsistencyInput): DayStat[] {
  const weights = new Map(input.logs.filter((l) => !l.deleted && l.weight != null).map((l) => [l.date, l.weight]))
  const byDate = new Map<string, ConsistencyInput['workouts']>()
  for (const w of input.workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])
  const out: DayStat[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const workouts = (byDate.get(d) ?? []).map(({ id, name, sets }) => ({ id, name, sets }))
    const weight = weights.get(d) ?? null
    out.push({
      date: d,
      workouts,
      weight,
      gymDay: input.gymDays.includes(parseDate(d).getDay()),
      level: {
        training: setsLevel(workouts.reduce((n, w) => n + w.sets, 0), workouts.length > 0),
        wegen: weight != null ? 4 : 0,
      },
    })
  }
  return out
}

/**
 * Weeks in a row in which you trained as often as planned (`perWeek`).
 * The current week counts once it is complete; until then the streak runs up to last week.
 */
export function weekStreaks(days: DayStat[], today: string, perWeek: number): { current: number; longest: number } {
  const count = new Map<string, number>()
  for (const d of days) if (d.date <= today) count.set(weekStart(d.date), (count.get(weekStart(d.date)) ?? 0) + d.workouts.length)
  const weeks = [...count.keys()].sort()
  const thisWeek = weekStart(today)
  const met = (w: string) => (count.get(w) ?? 0) >= Math.max(1, perWeek)
  let longest = 0
  let run = 0
  for (const w of weeks) {
    run = met(w) ? run + 1 : w === thisWeek ? run : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (met(weeks[i])) current++
    else if (weeks[i] === thisWeek) continue
    else break
  }
  return { current, longest }
}
