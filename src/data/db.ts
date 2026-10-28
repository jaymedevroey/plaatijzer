import Dexie, { type Table } from 'dexie'
import type { CoachReport, DailyLog, Exercise, ProgramDay, Settings, Workout, WorkoutSet } from '../lib/types'

export interface Meta {
  key: string
  value: unknown
}

class PlaatijzerDB extends Dexie {
  exercises!: Table<Exercise, string>
  program_days!: Table<ProgramDay, string>
  workouts!: Table<Workout, string>
  sets!: Table<WorkoutSet, string>
  daily_logs!: Table<DailyLog, string>
  settings!: Table<Settings, string>
  coach_reports!: Table<CoachReport, string>
  meta!: Table<Meta, string>

  constructor() {
    super('plaatijzer')
    this.version(1).stores({
      exercises: 'id, dirty',
      program_days: 'id, position, dirty',
      workouts: 'id, started_at, finished_at, dirty',
      sets: 'id, workout_id, exercise_id, dirty',
      daily_logs: 'id, &date, dirty',
      settings: 'id, dirty',
      coach_reports: 'id, week_start, dirty',
      meta: 'key',
    })
  }
}

export const db = new PlaatijzerDB()

export const SYNC_TABLES = ['exercises', 'program_days', 'workouts', 'sets', 'daily_logs', 'settings', 'coach_reports'] as const
export type SyncTable = (typeof SYNC_TABLES)[number]

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key)
  return (row?.value as T) ?? fallback
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value })
}
