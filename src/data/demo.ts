import { db } from './db'
import { SEED_DAYS, SEED_EXERCISES } from './seed'
import { addDays, today } from '../lib/dates'
import type { DailyLog, Workout, WorkoutSet } from '../lib/types'

/**
 * Dev-only test data. `?demo` = four weeks of plausible history, `?demo=start` = one workout today
 * and nothing logged (a brand-new account after its first session), `?demo=leeg` = only the plan.
 */
let started = false
export async function seedDemo(mode: string | null): Promise<void> {
  if (started) return
  started = true
  if (mode === 'leeg' || (await db.workouts.count()) > 0) return
  const t = today()
  if (mode === 'start') return seedFirstSession(t)
  const logs: DailyLog[] = []
  for (let i = 27; i >= 0; i--) {
    const date = addDays(t, -i)
    const day = 27 - i
    if (![0, 2, 3, 5].includes(day % 7)) continue
    logs.push({
      id: `00000000-0000-4000-9000-0000${date.replaceAll('-', '')}`, date,
      weight: Math.round((70.8 + day * 0.04 + Math.sin(day * 1.7) * 0.35) * 10) / 10,
      updated_at: new Date().toISOString(), deleted: false,
    })
  }
  await db.daily_logs.bulkPut(logs)

  const ex = new Map(SEED_EXERCISES.map((e) => [e.id, e]))
  const start: Record<string, number> = {}
  const gymOffsets = [-27, -25, -23, -21, -20, -18, -16, -14, -13, -11, -9, -7, -6, -4, -2]
  const workouts: Workout[] = []
  const sets: WorkoutSet[] = []
  gymOffsets.forEach((off, n) => {
    const day = SEED_DAYS[n % SEED_DAYS.length]
    const date = addDays(t, off)
    const id = crypto.randomUUID()
    const started = new Date(`${date}T18:30:00`)
    workouts.push({ id, day_id: day.id, started_at: started.toISOString(), finished_at: new Date(started.getTime() + 68 * 60000).toISOString(), note: '', updated_at: new Date().toISOString(), deleted: false })
    let pos = 0
    for (const it of day.items) {
      const e = ex.get(it.exerciseId)!
      const base = e.equipment === 'barbell' ? (e.name.includes('Bench') ? 55 : e.name.includes('Row') ? 50 : e.name.includes('Romanian') ? 60 : 45)
        : e.equipment === 'dumbbell' ? (e.muscles_primary[0] === 'zij-delts' ? 8 : e.muscles_primary[0] === 'biceps' ? 12 : 20)
        : e.equipment === 'cable' ? 15 : 0
      const k = (start[e.id] = (start[e.id] ?? -1) + 1)
      const w = e.kind === 'load' ? base + Math.floor(k / 2) * (e.equipment === 'barbell' ? 2.5 : 2) : e.kind === 'bodyweight' ? 0 : null
      for (let s = 0; s < it.sets; s++) {
        sets.push({
          id: crypto.randomUUID(), workout_id: id, exercise_id: e.id, position: pos++,
          kind: it.section === 'prep' ? 'warmup' : 'work',
          weight: w, reps: it.section === 'prep' ? it.repMax : Math.min(it.repMax, it.repMin + (k % 2) * 2 + (s === 0 ? 1 : 0)),
          rir: it.section === 'prep' ? null : 2, seconds: e.kind === 'time' ? 30 : null,
          done: true, done_at: started.toISOString(), updated_at: new Date().toISOString(), deleted: false,
        })
      }
    }
  })
  await db.workouts.bulkPut(workouts)
  await db.sets.bulkPut(sets)
}

/** One finished workout today (first program day), nothing else: the state of a brand-new account. */
async function seedFirstSession(t: string): Promise<void> {
  const day = SEED_DAYS[0]
  const ex = new Map(SEED_EXERCISES.map((e) => [e.id, e]))
  const started = new Date(`${t}T17:10:00`)
  const id = crypto.randomUUID()
  const stamp = new Date().toISOString()
  const load: Record<string, number> = { barbell: 50, dumbbell: 16, cable: 20 }
  const sets: WorkoutSet[] = []
  let pos = 0
  for (const it of day.items) {
    const e = ex.get(it.exerciseId)!
    const w = e.kind === 'load' ? (e.muscles_primary[0] === 'zij-delts' ? 8 : e.muscles_primary[0] === 'biceps' ? 10 : load[e.equipment] ?? 0) : 0
    for (let s = 0; s < it.sets; s++) {
      sets.push({
        id: crypto.randomUUID(), workout_id: id, exercise_id: e.id, position: pos++, kind: 'work',
        weight: w, reps: it.repMin + (s === 0 ? 1 : 0), rir: null, seconds: null,
        done: true, done_at: started.toISOString(), updated_at: stamp, deleted: false,
      })
    }
  }
  await db.workouts.put({ id, day_id: day.id, started_at: started.toISOString(), finished_at: new Date(started.getTime() + 52 * 60000).toISOString(), note: '', updated_at: stamp, deleted: false })
  await db.sets.bulkPut(sets)
}
