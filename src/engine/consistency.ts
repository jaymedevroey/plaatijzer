import type { DailyLog, Targets } from '../lib/types'
import { addDays, parseDate } from '../lib/dates'

export type Metric = 'alles' | 'training' | 'kcal' | 'eiwit' | 'slaap'
export type Level = 0 | 1 | 2 | 3 | 4

export interface DayStat {
  date: string
  workouts: { id: string; name: string; sets: number }[]
  kcal: number | null
  protein: number | null
  sleep: number | null
  weight: number | null
  /** Day goals reached / day goals that apply (kcal, eiwit, slaap, and training on a gym day or when you trained). */
  hits: number
  goals: number
  level: Record<Metric, Level>
}

export interface ConsistencyInput {
  logs: DailyLog[]
  /** Finished workouts with their local date, program-day name and number of done work sets. */
  workouts: { id: string; date: string; name: string; sets: number }[]
  targets: Targets
  gymDays: number[]
}

/** A daily value counts as reached from 95% of the target. */
const HIT = 0.95

function ratioLevel(value: number | null, target: number): Level {
  if (value == null) return 0
  const r = target > 0 ? value / target : 1
  return r >= HIT ? 4 : r >= 0.85 ? 3 : r >= 0.7 ? 2 : 1
}

function setsLevel(sets: number): Level {
  return sets <= 0 ? 0 : sets < 8 ? 1 : sets < 13 ? 2 : sets < 18 ? 3 : 4
}

/** One entry per day from `from` to `to` (inclusive), oldest first. */
export function buildDays(from: string, to: string, input: ConsistencyInput): DayStat[] {
  const logs = new Map(input.logs.filter((l) => !l.deleted).map((l) => [l.date, l]))
  const byDate = new Map<string, ConsistencyInput['workouts']>()
  for (const w of input.workouts) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])
  const t = input.targets
  const out: DayStat[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const log = logs.get(d)
    const workouts = (byDate.get(d) ?? []).map(({ id, name, sets }) => ({ id, name, sets }))
    const sets = workouts.reduce((n, w) => n + w.sets, 0)
    const kcal = log?.kcal ?? null
    const protein = log?.protein ?? null
    const sleep = log?.sleep_min ?? null
    const weight = log?.weight ?? null
    const trainingCounts = workouts.length > 0 || input.gymDays.includes(parseDate(d).getDay())
    const goals = 3 + (trainingCounts ? 1 : 0)
    const hits =
      (kcal != null && kcal >= t.kcal * HIT ? 1 : 0) +
      (protein != null && protein >= t.protein * HIT ? 1 : 0) +
      (sleep != null && sleep >= t.sleepMin * HIT ? 1 : 0) +
      (workouts.length > 0 ? 1 : 0)
    const any = workouts.length > 0 || kcal != null || protein != null || sleep != null || weight != null
    const ratio = hits / goals
    const alles: Level = !any ? 0 : ratio >= 1 ? 4 : ratio >= 0.66 ? 3 : ratio >= 0.33 ? 2 : 1
    out.push({
      date: d, workouts, kcal, protein, sleep, weight, hits, goals,
      level: { alles, training: setsLevel(sets), kcal: ratioLevel(kcal, t.kcal), eiwit: ratioLevel(protein, t.protein), slaap: ratioLevel(sleep, t.sleepMin) },
    })
  }
  return out
}

/** Days in a row with something logged or trained. The current streak may end yesterday if today is still empty. */
export function streaks(days: DayStat[], today: string): { current: number; longest: number } {
  let longest = 0
  let run = 0
  for (const d of days) {
    if (d.date > today) break
    run = d.level.alles > 0 ? run + 1 : 0
    longest = Math.max(longest, run)
  }
  let current = 0
  const past = days.filter((d) => d.date <= today)
  let i = past.length - 1
  if (i >= 0 && past[i].date === today && past[i].level.alles === 0) i--
  for (; i >= 0 && past[i].level.alles > 0; i--) current++
  return { current, longest }
}
