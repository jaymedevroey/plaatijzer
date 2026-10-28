export type ExerciseKind = 'load' | 'bodyweight' | 'reps' | 'time'
export type Equipment = 'barbell' | 'dumbbell' | 'cable' | 'bodyweight' | 'none'
export type Muscle =
  | 'borst' | 'rug' | 'zij-delts' | 'voor-delts' | 'achter-delts' | 'biceps' | 'triceps'
  | 'quads' | 'hamstrings' | 'bilspieren' | 'kuiten' | 'core'

/** Fields every synced row has. */
export interface SyncRow {
  id: string
  updated_at: string
  deleted: boolean
  /** 1 = has local changes not yet pushed. Never sent to the server. */
  dirty?: 0 | 1
}

export interface Exercise extends SyncRow {
  name: string
  kind: ExerciseKind
  equipment: Equipment
  muscles_primary: Muscle[]
  muscles_secondary: Muscle[]
}

export interface DayItem {
  exerciseId: string
  sets: number
  repMin: number
  repMax: number
  rirMin: number
  rirMax: number
  restSec: number
  /** warmup = mobility/plyo block, not counted for volume or progression */
  section: 'prep' | 'main'
  note?: string
  /** For kind 'time': target seconds per set. */
  seconds?: number
  perSide?: boolean
}

export interface ProgramDay extends SyncRow {
  position: number
  name: string
  subtitle: string
  items: DayItem[]
}

export interface Workout extends SyncRow {
  day_id: string | null
  started_at: string
  finished_at: string | null
  note: string
}

export interface WorkoutSet extends SyncRow {
  workout_id: string
  exercise_id: string
  position: number
  kind: 'warmup' | 'work'
  weight: number | null
  reps: number | null
  rir: number | null
  seconds: number | null
  done: boolean
  done_at: string | null
}

export interface DailyLog extends SyncRow {
  /** YYYY-MM-DD */
  date: string
  weight: number | null
  kcal: number | null
  protein: number | null
  sleep_min: number | null
}

export interface Inventory {
  barKg: number
  /** Plate weights in kg that you own (as pairs). */
  plates: number[]
  /** Dumbbell weights available, in kg. */
  dumbbells: number[]
  /** Cable stack increment in kg. */
  cableStep: number
  cableMax: number
}

export interface Targets {
  kcal: number
  protein: number
  sleepMin: number
  weeklyGainMin: number
  weeklyGainMax: number
  goalWeight: number
  startWeight: number
  startDate: string
}

/** Week rhythm, per account (Date.getDay(): 0 = zondag). Volleyball/match days are shown, not planned. */
export interface Schedule {
  gymDays: number[]
  volley: Partial<Record<number, 'training' | 'match'>>
}

export interface SettingsData {
  inventory: Inventory
  targets: Targets
  schedule: Schedule
  coachEnabled: boolean
}

export interface Settings extends SyncRow {
  data: SettingsData
}

export type Confidence = 'hoog' | 'middel' | 'laag'

export interface CoachCard {
  id: string
  kind: 'kcal' | 'protein' | 'volume' | 'stall' | 'sleep' | 'data'
  title: string
  why: string
  evidence: string[]
  rule: string
  confidence: Confidence
  /** A change that can be applied with one tap, if any. */
  action?: { type: 'kcal'; delta: number } | { type: 'addSets'; dayId: string; exerciseId: string; delta: number }
  status: 'open' | 'accepted' | 'dismissed'
}

export interface CoachReport extends SyncRow {
  week_start: string
  payload: { cards: CoachCard[]; generatedAt: string; model: string | null; promptVersion: string }
}
