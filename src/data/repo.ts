import { db, getMeta, setMeta } from './db'
import { scheduleSync } from './sync'
import { DEFAULT_SETTINGS, SEED_DAYS, SEED_EXERCISES, SETTINGS_ID } from './seed'
import type { DailyLog, DayItem, Exercise, ProgramDay, Settings, SettingsData, SyncRow, Workout, WorkoutSet } from '../lib/types'
import { e1rm } from '../engine/progression'

export const nowIso = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

/** Stamp + mark dirty + persist + schedule a sync. */
async function save<T extends SyncRow>(table: 'exercises' | 'program_days' | 'workouts' | 'sets' | 'daily_logs' | 'settings' | 'coach_reports', row: T): Promise<T> {
  const stamped = { ...row, updated_at: nowIso(), dirty: 1 as const }
  await db.table(table).put(stamped)
  scheduleSync()
  return stamped
}

export async function ensureSeed(): Promise<void> {
  await db.transaction('rw', [db.exercises, db.program_days, db.settings], async () => {
    if ((await db.program_days.count()) === 0) {
      await db.exercises.bulkPut(SEED_EXERCISES.map((e) => ({ ...e, dirty: 1 as const })))
      await db.program_days.bulkPut(SEED_DAYS.map((d) => ({ ...d, dirty: 1 as const })))
    }
    if (!(await db.settings.get(SETTINGS_ID))) {
      await db.settings.put({ id: SETTINGS_ID, data: DEFAULT_SETTINGS, updated_at: '2026-01-01T00:00:00.000Z', deleted: false, dirty: 1 })
    }
  })
  scheduleSync(0)
}

// ---------- settings ----------
export async function updateSettings(patch: (d: SettingsData) => SettingsData): Promise<void> {
  const cur = (await db.settings.get(SETTINGS_ID)) ?? { id: SETTINGS_ID, data: DEFAULT_SETTINGS, updated_at: '', deleted: false }
  await save<Settings>('settings', { ...cur, data: patch(structuredClone(cur.data)) })
}

// ---------- daily log ----------
export const logIdFor = (date: string) => `00000000-0000-4000-9000-0000${date.replaceAll('-', '')}`

export async function saveDailyLog(date: string, values: Partial<Pick<DailyLog, 'weight' | 'body_fat'>>): Promise<void> {
  const cur = await db.daily_logs.where('date').equals(date).first()
  const base: DailyLog = cur ?? { id: logIdFor(date), date, weight: null, body_fat: null, updated_at: '', deleted: false }
  await save<DailyLog>('daily_logs', { ...base, ...values, deleted: false })
}

// ---------- program ----------
export async function saveDay(day: ProgramDay): Promise<void> {
  await save<ProgramDay>('program_days', day)
}

export async function updateDayItem(dayId: string, index: number, patch: Partial<DayItem>): Promise<void> {
  const day = await db.program_days.get(dayId)
  if (!day) return
  const items = day.items.map((it, i) => (i === index ? { ...it, ...patch } : it))
  await saveDay({ ...day, items })
}

export async function saveExercise(ex: Exercise): Promise<void> {
  await save<Exercise>('exercises', ex)
}

// ---------- workouts ----------
export async function activeWorkoutId(): Promise<string | null> {
  return getMeta<string | null>('activeWorkout', null)
}

export async function startWorkout(day: ProgramDay): Promise<string> {
  const id = newId()
  const w: Workout = { id, day_id: day.id, started_at: nowIso(), finished_at: null, note: '', updated_at: '', deleted: false }
  await save<Workout>('workouts', w)
  let pos = 0
  const exercises = new Map((await db.exercises.toArray()).map((e) => [e.id, e]))
  for (const it of day.items) {
    const ex = exercises.get(it.exerciseId)
    for (let i = 0; i < it.sets; i++) {
      await save<WorkoutSet>('sets', {
        id: newId(), workout_id: id, exercise_id: it.exerciseId, position: pos++,
        kind: it.section === 'prep' ? 'warmup' : 'work',
        weight: null, reps: null, rir: null, seconds: ex?.kind === 'time' ? it.seconds ?? null : null,
        done: false, done_at: null, updated_at: '', deleted: false,
      })
    }
  }
  await setMeta('activeWorkout', id)
  return id
}

export async function updateSet(set: WorkoutSet, patch: Partial<WorkoutSet>): Promise<WorkoutSet> {
  return save<WorkoutSet>('sets', { ...set, ...patch })
}

export async function addSet(workoutId: string, exerciseId: string, kind: 'warmup' | 'work'): Promise<void> {
  const sets = await db.sets.where('workout_id').equals(workoutId).toArray()
  const forEx = sets.filter((s) => s.exercise_id === exerciseId && !s.deleted).sort((a, b) => a.position - b.position)
  // Warm-ups go before the first work set, work sets after the last set of this exercise.
  const anchor = kind === 'warmup' ? (forEx[0]?.position ?? 0) - 0.5 : (forEx[forEx.length - 1]?.position ?? 0) + 0.5
  await save<WorkoutSet>('sets', {
    id: newId(), workout_id: workoutId, exercise_id: exerciseId, position: anchor, kind,
    weight: null, reps: null, rir: null, seconds: null, done: false, done_at: null, updated_at: '', deleted: false,
  })
}

export async function removeSet(set: WorkoutSet): Promise<void> {
  await save<WorkoutSet>('sets', { ...set, deleted: true })
}

export async function finishWorkout(workoutId: string): Promise<void> {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  const sets = await db.sets.where('workout_id').equals(workoutId).toArray()
  for (const s of sets) if (!s.done && !s.deleted) await save<WorkoutSet>('sets', { ...s, deleted: true })
  await save<Workout>('workouts', { ...w, finished_at: nowIso() })
  await setMeta('activeWorkout', null)
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const w = await db.workouts.get(workoutId)
  if (!w) return
  const sets = await db.sets.where('workout_id').equals(workoutId).toArray()
  for (const s of sets) await save<WorkoutSet>('sets', { ...s, deleted: true })
  await save<Workout>('workouts', { ...w, deleted: true })
  await setMeta('activeWorkout', null)
}

// ---------- history queries ----------
export interface Session {
  workout: Workout
  sets: WorkoutSet[]
}

/** Finished sessions that contain done work sets for this exercise, newest first. */
export async function sessionsFor(exerciseId: string, excludeWorkoutId?: string): Promise<Session[]> {
  const sets = (await db.sets.where('exercise_id').equals(exerciseId).toArray()).filter((s) => !s.deleted && s.done && s.workout_id !== excludeWorkoutId)
  const byW = new Map<string, WorkoutSet[]>()
  for (const s of sets) byW.set(s.workout_id, [...(byW.get(s.workout_id) ?? []), s])
  const workouts = (await db.workouts.bulkGet([...byW.keys()])).filter((w): w is Workout => !!w && !w.deleted && !!w.finished_at)
  return workouts
    .sort((a, b) => b.started_at.localeCompare(a.started_at))
    .map((w) => ({ workout: w, sets: (byW.get(w.id) ?? []).sort((a, b) => a.position - b.position) }))
}

export interface PrResult {
  kind: 'gewicht' | 'reps' | 'e1rm'
  label: string
}

/** Is this set a record compared to all earlier sessions? No records in your very first session. */
export function checkPr(set: WorkoutSet, history: Session[]): PrResult | null {
  if (set.weight == null || set.reps == null || history.length === 0) return null
  const prev = history.flatMap((h) => h.sets).filter((s) => s.kind === 'work' && s.reps != null)
  if (!prev.length) return null
  const maxW = Math.max(...prev.map((s) => s.weight ?? 0))
  if (set.weight > maxW) return { kind: 'gewicht', label: 'Gewicht-PR' }
  const repsAtOrAbove = prev.filter((s) => (s.weight ?? 0) >= set.weight!).map((s) => s.reps ?? 0)
  if (repsAtOrAbove.length && set.reps > Math.max(...repsAtOrAbove)) return { kind: 'reps', label: 'Rep-PR' }
  const best = Math.max(...prev.map((s) => e1rm(s.weight, s.reps) ?? 0))
  const cur = e1rm(set.weight, set.reps)
  if (cur != null && cur > best + 0.01) return { kind: 'e1rm', label: 'e1RM-PR' }
  return null
}
