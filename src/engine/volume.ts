import type { Exercise, Muscle, WorkoutSet } from '../lib/types'

export const MUSCLES: Muscle[] = [
  'borst', 'rug', 'zij-delts', 'voor-delts', 'achter-delts', 'biceps', 'triceps',
  'quads', 'hamstrings', 'bilspieren', 'kuiten', 'core',
]

/** Legs, core and front delts are trained lightly or indirectly in this setup: no 10–20 zone for them. */
export const ZONE_EXEMPT: Muscle[] = ['quads', 'hamstrings', 'bilspieren', 'kuiten', 'core', 'voor-delts']

/** Weekly sets per muscle: a direct set counts 1, a secondary set 0.5. Only done work sets count. */
export function setsPerMuscle(sets: WorkoutSet[], exercises: Map<string, Exercise>): Record<Muscle, number> {
  const out = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<Muscle, number>
  for (const s of sets) {
    if (!s.done || s.kind !== 'work' || s.deleted) continue
    const ex = exercises.get(s.exercise_id)
    if (!ex || ex.kind === 'reps' || ex.kind === 'time') continue
    for (const m of ex.muscles_primary) out[m] += 1
    for (const m of ex.muscles_secondary) out[m] += 0.5
  }
  return out
}
