import type { DayItem, Equipment, ExerciseKind, Inventory, WorkoutSet } from '../lib/types'
import { kg } from '../lib/format'
import { nextWeight } from './plates'

export interface Target {
  /** Suggested weight for every work set (null = you pick, first session). */
  weight: number | null
  /** Suggested reps per work set. */
  reps: number[]
  rir: number
  kind: 'first' | 'increase' | 'reps' | 'hold' | 'fixed'
  reason: string
  /** Increase is more than 10%: worth a second look. */
  bigJump: boolean
}

/**
 * Double progression (deterministic):
 * - all work sets at the top of the rep range and RIR not below target → next loadable weight, reps back to the bottom
 * - any set below the RIR target → hold weight and reps
 * - otherwise → same weight, +1 rep per set (capped at the top)
 */
export function nextTarget(
  item: DayItem,
  kind: ExerciseKind,
  equipment: Equipment,
  lastWork: WorkoutSet[],
  inv: Inventory,
): Target {
  const rir = Math.round((item.rirMin + item.rirMax) / 2)
  const flat = (n: number) => Array.from({ length: item.sets }, () => n)

  if (kind === 'reps' || kind === 'time') {
    return { weight: null, reps: flat(item.repMax), rir, kind: 'fixed', reason: '', bigJump: false }
  }

  const done = lastWork.filter((s) => s.done && s.reps != null)
  if (done.length === 0) {
    return {
      weight: null,
      reps: flat(item.repMin),
      rir,
      kind: 'first',
      reason: `Eerste keer: kies een gewicht voor ${item.repMin}–${item.repMax} reps op RIR ${item.rirMin}–${item.rirMax}`,
      bigJump: false,
    }
  }

  const lastWeight = Math.max(...done.map((s) => s.weight ?? 0))
  const atTop = done.length >= item.sets && done.every((s) => (s.reps ?? 0) >= item.repMax)
  const belowRir = done.some((s) => s.rir != null && s.rir < item.rirMin)

  if (atTop && !belowRir) {
    const w = nextWeight(lastWeight, equipment, inv)
    if (w > lastWeight) {
      const delta = w - lastWeight
      return {
        weight: w,
        reps: flat(item.repMin),
        rir,
        kind: 'increase',
        reason: `+${kg(delta)} kg: vorige keer ${done.length}×${item.repMax} gehaald`,
        bigJump: lastWeight > 0 && delta / lastWeight > 0.1,
      }
    }
    return {
      weight: lastWeight,
      reps: flat(item.repMax),
      rir,
      kind: 'hold',
      reason: 'Zwaarste gewicht dat je hebt: werk naar meer reps of een trager tempo',
      bigJump: false,
    }
  }

  const lastReps = done.map((s) => s.reps ?? 0)
  if (belowRir) {
    return {
      weight: lastWeight,
      reps: flat(0).map((_, i) => lastReps[i] ?? lastReps[lastReps.length - 1]),
      rir,
      kind: 'hold',
      reason: `Zelfde als vorige keer: RIR zat onder ${item.rirMin}`,
      bigJump: false,
    }
  }

  return {
    weight: lastWeight,
    reps: flat(0).map((_, i) => Math.min((lastReps[i] ?? lastReps[lastReps.length - 1]) + 1, item.repMax)),
    rir,
    kind: 'reps',
    reason: 'Zelfde gewicht, +1 rep per set',
    bigJump: false,
  }
}

/** Epley estimated 1RM; unreliable above 12 reps, so returns null there. */
export function e1rm(weight: number | null, reps: number | null): number | null {
  if (weight == null || reps == null || reps < 1 || reps > 12 || weight <= 0) return null
  return reps === 1 ? weight : weight * (1 + reps / 30)
}
