import type { DayItem, Exercise, Inventory, ProgramDay, WorkoutSet } from '../lib/types'
import { nextTarget, type Target } from '../engine/progression'
import type { Session } from '../data/repo'

export interface Group {
  exercise: Exercise
  item: DayItem
  sets: WorkoutSet[]
  /** Last finished session for this exercise (null = first time). */
  last: Session | null
  target: Target
  done: boolean
}

const fallbackItem = (exerciseId: string): DayItem => ({
  exerciseId, sets: 3, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSec: 120, section: 'main',
})

/** Group the workout's sets per exercise, in workout order, with targets from history. */
export function buildGroups(
  sets: WorkoutSet[],
  day: ProgramDay | undefined,
  exercises: Map<string, Exercise>,
  history: Map<string, Session[]>,
  inv: Inventory,
): Group[] {
  const order: string[] = []
  for (const s of sets) if (!order.includes(s.exercise_id)) order.push(s.exercise_id)
  return order
    .map((exId) => {
      const exercise = exercises.get(exId)
      if (!exercise) return null
      const item = day?.items.find((i) => i.exerciseId === exId) ?? fallbackItem(exId)
      const last = history.get(exId)?.[0] ?? null
      const target = nextTarget(item, exercise.kind, exercise.equipment, last?.sets.filter((s) => s.kind === 'work') ?? [], inv)
      const own = sets.filter((s) => s.exercise_id === exId)
      return { exercise, item, sets: own, last, target, done: own.length > 0 && own.every((s) => s.done) }
    })
    .filter((g): g is Group => g !== null)
}

/** Index of a work set among the work sets of its exercise. */
export function workIndex(g: Group, set: WorkoutSet): number {
  return g.sets.filter((s) => s.kind === 'work').findIndex((s) => s.id === set.id)
}

/** Ghost values shown in an empty row: the target for work sets. */
export function ghost(g: Group, set: WorkoutSet): { weight: number | null; reps: number | null; rir: number | null } {
  if (set.kind === 'warmup') {
    if (g.item.section === 'prep') return { weight: null, reps: g.item.repMax, rir: null }
    return { weight: null, reps: null, rir: null }
  }
  const i = Math.max(0, workIndex(g, set))
  // Once you've done a set today, the next ones default to the weight you actually used.
  const usedToday = g.sets.filter((s) => s.kind === 'work' && s.done && s.weight != null && s.position < set.position).pop()
  return {
    weight: usedToday?.weight ?? g.target.weight ?? (g.exercise.kind === 'bodyweight' ? 0 : null),
    reps: g.target.reps[i] ?? g.target.reps[g.target.reps.length - 1] ?? null,
    rir: g.target.kind === 'fixed' ? null : g.target.rir,
  }
}

/** The matching set from last session (same kind, same index), for the VORIGE column. */
export function previousSet(g: Group, set: WorkoutSet): WorkoutSet | null {
  if (!g.last) return null
  const same = g.last.sets.filter((s) => s.kind === set.kind)
  const mine = g.sets.filter((s) => s.kind === set.kind)
  return same[mine.findIndex((s) => s.id === set.id)] ?? null
}

export function volume(sets: WorkoutSet[]): number {
  return sets.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0)
}
