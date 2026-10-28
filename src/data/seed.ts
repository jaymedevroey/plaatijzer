import type { DayItem, Exercise, ExerciseKind, Equipment, Muscle, ProgramDay, SettingsData } from '../lib/types'
import { today } from '../lib/dates'

/**
 * A neutral starter program and defaults for a brand-new account. Your own program, targets and week
 * schedule live in your account (Supabase) and replace these on the first sync; they are not in this code.
 * Seed rows use fixed IDs so two devices seed the same rows and sync merges them instead of duplicating.
 */

const EPOCH = '2026-01-01T00:00:00.000Z'
const uid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

export const SETTINGS_ID = uid(9000)

function ex(n: number, name: string, kind: ExerciseKind, equipment: Equipment, primary: Muscle[], secondary: Muscle[] = []): Exercise {
  return { id: uid(n), name, kind, equipment, muscles_primary: primary, muscles_secondary: secondary, updated_at: EPOCH, deleted: false }
}

export const SEED_EXERCISES: Exercise[] = [
  ex(1, 'Barbell Bench Press', 'load', 'barbell', ['borst'], ['triceps', 'voor-delts']),
  ex(2, 'Barbell Row', 'load', 'barbell', ['rug'], ['achter-delts', 'biceps']),
  ex(3, 'Pull-Ups', 'bodyweight', 'bodyweight', ['rug'], ['biceps']),
  ex(4, 'Seated DB Shoulder Press', 'load', 'dumbbell', ['voor-delts'], ['zij-delts', 'triceps']),
  ex(5, 'DB Lateral Raises', 'load', 'dumbbell', ['zij-delts']),
  ex(6, 'DB Biceps Curl', 'load', 'dumbbell', ['biceps']),
  ex(7, 'Cable Triceps Pushdown', 'load', 'cable', ['triceps']),
  ex(8, 'Ankle Mobility', 'reps', 'none', []),
  ex(9, 'Hip Mobility', 'reps', 'none', []),
  ex(10, 'Goblet Squat Hold', 'time', 'none', []),
  ex(11, 'Barbell Back Squat', 'load', 'barbell', ['quads'], ['bilspieren']),
  ex(12, 'Romanian Deadlift', 'load', 'barbell', ['hamstrings'], ['bilspieren']),
  ex(13, 'DB Walking Lunges', 'load', 'dumbbell', ['quads'], ['bilspieren']),
  ex(14, 'Standing DB Calf Raises', 'load', 'dumbbell', ['kuiten']),
  ex(15, 'Hanging Knee Raises', 'bodyweight', 'bodyweight', ['core']),
  ex(16, 'Incline DB Press', 'load', 'dumbbell', ['borst'], ['voor-delts', 'triceps']),
  ex(17, 'One-Arm DB Row', 'load', 'dumbbell', ['rug'], ['biceps']),
  ex(18, 'Goblet Squat', 'load', 'dumbbell', ['quads'], ['bilspieren']),
  ex(19, 'Cable Face Pulls', 'load', 'cable', ['achter-delts'], ['rug']),
  ex(20, 'DB Hammer Curl', 'load', 'dumbbell', ['biceps']),
  ex(21, 'Overhead Cable Triceps Extension', 'load', 'cable', ['triceps']),
]

function it(n: number, sets: number, repMin: number, repMax: number, restSec: number, opts: Partial<DayItem> = {}): DayItem {
  return { exerciseId: uid(n), sets, repMin, repMax, rirMin: 1, rirMax: 3, restSec, section: 'main', ...opts }
}
const prep = (n: number, sets: number, reps: number, extra: Partial<DayItem> = {}): DayItem =>
  ({ exerciseId: uid(n), sets, repMin: reps, repMax: reps, rirMin: 0, rirMax: 0, restSec: 30, section: 'prep', ...extra })

export const SEED_DAYS: ProgramDay[] = [
  {
    id: uid(1001), position: 1, name: 'Upper', subtitle: 'Borst, rug, schouders', updated_at: EPOCH, deleted: false,
    items: [it(1, 3, 6, 10, 150), it(2, 3, 6, 10, 150), it(3, 2, 6, 10, 120), it(4, 2, 8, 12, 120), it(5, 3, 12, 20, 75), it(6, 2, 10, 15, 75), it(7, 2, 10, 15, 75)],
  },
  {
    id: uid(1002), position: 2, name: 'Lower', subtitle: 'Mobiliteit, benen, core', updated_at: EPOCH, deleted: false,
    items: [
      prep(8, 2, 10, { perSide: true }), prep(9, 2, 8), prep(10, 2, 0, { seconds: 30 }),
      it(11, 3, 6, 10, 180), it(12, 3, 8, 10, 150), it(13, 2, 10, 12, 120), it(14, 3, 12, 20, 60), it(15, 2, 10, 15, 60),
    ],
  },
  {
    id: uid(1003), position: 3, name: 'Full body', subtitle: 'Volume', updated_at: EPOCH, deleted: false,
    items: [it(16, 3, 8, 12, 120), it(17, 3, 8, 12, 90), it(18, 2, 10, 15, 90), it(19, 2, 12, 15, 75), it(20, 2, 10, 15, 75), it(21, 2, 10, 15, 75)],
  },
]

export const DEFAULT_SETTINGS: SettingsData = {
  inventory: {
    barKg: 20,
    plates: [1.25, 2.5, 5, 10, 20],
    dumbbells: Array.from({ length: 15 }, (_, i) => (i + 1) * 2),
    cableStep: 2.5,
    cableMax: 70,
  },
  targets: {
    weeklyGainMin: 0.25,
    weeklyGainMax: 0.5,
    goalWeight: 75,
    startWeight: 70,
    startDate: today(),
  },
  schedule: { gymDays: [1, 3, 5], volley: {} },
  coachEnabled: true,
}
