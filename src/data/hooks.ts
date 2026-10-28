import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db'
import { DEFAULT_SETTINGS, SETTINGS_ID } from './seed'
import type { CoachReport, DailyLog, Exercise, ProgramDay, SettingsData, Workout, WorkoutSet } from '../lib/types'

export function useSettings(): SettingsData {
  const s = useLiveQuery(() => db.settings.get(SETTINGS_ID), [])
  return s ? { ...DEFAULT_SETTINGS, ...s.data } : DEFAULT_SETTINGS
}

export function useDays(): ProgramDay[] | undefined {
  return useLiveQuery(async () => (await db.program_days.orderBy('position').toArray()).filter((d) => !d.deleted), [])
}

export function useExercises(): Map<string, Exercise> | undefined {
  return useLiveQuery(async () => new Map((await db.exercises.toArray()).filter((e) => !e.deleted).map((e) => [e.id, e])), [])
}

export function useLogs(): DailyLog[] | undefined {
  return useLiveQuery(async () => (await db.daily_logs.orderBy('date').toArray()).filter((l) => !l.deleted), [])
}

export function useFinishedWorkouts(): Workout[] | undefined {
  return useLiveQuery(
    async () => (await db.workouts.orderBy('started_at').toArray()).filter((w) => !w.deleted && !!w.finished_at),
    [],
  )
}

export function useAllSets(): WorkoutSet[] | undefined {
  return useLiveQuery(async () => (await db.sets.toArray()).filter((s) => !s.deleted), [])
}

export function useActiveWorkout(): { workout: Workout; sets: WorkoutSet[] } | null | undefined {
  return useLiveQuery(async () => {
    const id = (await db.meta.get('activeWorkout'))?.value as string | null | undefined
    if (!id) return null
    const workout = await db.workouts.get(id)
    if (!workout || workout.deleted || workout.finished_at) return null
    const sets = (await db.sets.where('workout_id').equals(id).toArray())
      .filter((s) => !s.deleted)
      .sort((a, b) => a.position - b.position)
    return { workout, sets }
  }, [])
}

export function useWorkout(id: string | undefined): { workout: Workout; sets: WorkoutSet[] } | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null
    const workout = await db.workouts.get(id)
    if (!workout) return null
    const sets = (await db.sets.where('workout_id').equals(id).toArray()).filter((s) => !s.deleted).sort((a, b) => a.position - b.position)
    return { workout, sets }
  }, [id])
}

export function useCoachReports(): CoachReport[] | undefined {
  return useLiveQuery(async () => (await db.coach_reports.orderBy('week_start').reverse().toArray()).filter((r) => !r.deleted), [])
}

export { nextDay } from '../engine/week'
