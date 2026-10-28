import type { DailyLog, Targets } from '../lib/types'
import { addDays, daysBetween, parseDate } from '../lib/dates'

/** Small seeded PRNG (mulberry32) so the example looks the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Made-up year for the "?voorbeeld" view of the day grid: weigh-ins that get more regular over the year,
 * two holiday weeks, trainings on most gym days. Never stored anywhere.
 */
export function sampleYear(today: string, targets: Targets, gymDays: number[], dayNames: string[]) {
  const rand = rng(20261028)
  const start = addDays(today, -370)
  const names = dayNames.length ? dayNames : ['Training']
  const logs: DailyLog[] = []
  const workouts: { id: string; date: string; name: string; sets: number }[] = []
  let rotation = 0
  for (let d = start; d <= today; d = addDays(d, 1)) {
    const i = daysBetween(start, d)
    const week = Math.floor(i / 7)
    if (week === 14 || week === 33) continue // holidays
    // weighing gets more regular over the year
    if (rand() < 0.3 + 0.5 * (i / 370)) {
      logs.push({
        id: `voorbeeld-${d}`, date: d, updated_at: '', deleted: false,
        weight: Math.round((targets.startWeight - 5 + 7 * (i / 370) + (rand() - 0.5) * 0.8) * 10) / 10,
      })
    }
    if (gymDays.includes(parseDate(d).getDay()) && rand() < 0.62 + 0.33 * (i / 370)) {
      workouts.push({ id: `voorbeeld-w-${d}`, date: d, name: names[rotation++ % names.length], sets: 14 + Math.floor(rand() * 6) })
    }
  }
  return { logs, workouts }
}
