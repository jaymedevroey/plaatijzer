import confetti from 'canvas-confetti'
import { checkPr, updateSet, type Session } from '../data/repo'
import { timer } from '../state/timer'
import { rememberPr } from '../state/pr'
import { tap, unlockAudio } from '../lib/sound'
import { kg } from '../lib/format'
import type { WorkoutSet } from '../lib/types'
import { ghost, type Group } from './workoutModel'

export interface Draft {
  weight: number | null
  reps: number | null
  rir: number | null
}

/**
 * Log a set. Weight and reps fall back to the target; RIR is only stored when the user entered it
 * (never invented), so the progression rule "RIR below target → hold" only fires on real data.
 * Starts the rest timer for main sets and returns a PR label if this set is a record.
 */
export async function completeSet(
  g: Group,
  set: WorkoutSet,
  history: Session[],
  isLastOfWorkout: boolean,
  draft?: Partial<Draft>,
): Promise<string | null> {
  unlockAudio()
  tap()
  const gh = ghost(g, set)
  const saved = await updateSet(set, {
    weight: draft?.weight ?? set.weight ?? gh.weight,
    reps: draft?.reps ?? set.reps ?? gh.reps,
    rir: draft?.rir !== undefined ? draft.rir : set.rir,
    done: true,
    done_at: new Date().toISOString(),
  })

  let label: string | null = null
  if (set.kind === 'work') {
    const pr = checkPr(saved, history)
    if (pr) {
      label = `${pr.label} · ${kg(saved.weight)} × ${saved.reps}`
      rememberPr(saved.id, label)
      void confetti({
        particleCount: 50, spread: 60, origin: { y: 0.45 }, disableForReducedMotion: true,
        colors: ['#6FE7FF', '#EBEBEB'], scalar: 0.8, ticks: 140,
      })
    }
  }

  const isPrep = g.item.section === 'prep'
  if (!isPrep && !isLastOfWorkout) timer.start(g.item.restSec, g.exercise.name, saved.id)
  return label
}

export async function undoSet(set: WorkoutSet): Promise<void> {
  tap()
  await updateSet(set, { done: false, done_at: null })
}
