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
 * Made-up year for the "?voorbeeld" view of the day grid: logging habits that get better over the year,
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
    const habit = 0.45 + 0.5 * (i / 370)
    if (rand() < habit) {
      const around = (target: number, low: number, high: number) => target * (low + rand() * (high - low))
      logs.push({
        id: `voorbeeld-${d}`, date: d, updated_at: '', deleted: false,
        kcal: rand() < 0.9 ? Math.round(around(targets.kcal, 0.75, 1.1) / 10) * 10 : null,
        protein: rand() < 0.85 ? Math.round(around(targets.protein, 0.7, 1.15)) : null,
        sleep_min: rand() < 0.8 ? Math.round(around(targets.sleepMin, 0.78, 1.06) / 5) * 5 : null,
        weight: rand() < 0.55 ? Math.round((targets.startWeight - 5 + 7 * (i / 370) + (rand() - 0.5) * 0.8) * 10) / 10 : null,
      })
    }
    if (gymDays.includes(parseDate(d).getDay()) && rand() < 0.62 + 0.33 * (i / 370)) {
      workouts.push({ id: `voorbeeld-w-${d}`, date: d, name: names[rotation++ % names.length], sets: 14 + Math.floor(rand() * 6) })
    }
  }
  return { logs, workouts }
}
