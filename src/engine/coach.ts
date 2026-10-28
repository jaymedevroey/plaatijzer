import type { CoachCard, DailyLog, Exercise, ProgramDay, Targets, Workout, WorkoutSet } from '../lib/types'
import { addDays, daysBetween } from '../lib/dates'
import { kg } from '../lib/format'
import { weightTrend, weeklyRate } from './trend'
import { setsPerMuscle, ZONE_EXEMPT } from './volume'
import { e1rm } from './progression'

export interface CoachInput {
  today: string
  logs: DailyLog[]
  targets: Targets
  workouts: Workout[]
  sets: WorkoutSet[]
  exercises: Exercise[]
  days: ProgramDay[]
}

/** About 150 kcal a day shifts the weekly gain by roughly 0,1 kg. Advice only: food is not logged. */
const KCAL_STEP = 150

/** What the rules need before they give advice: weigh-ins in 14 days, workouts in 7 (for volume). */
export const NEEDS = { weighIns14: 3, workouts7: 3 }

/** Deterministic weekly check-in. The LLM only rewrites `why`; numbers and actions come from here. */
export function coachCards(input: CoachInput): CoachCard[] {
  const { today, logs, targets } = input
  const cards: CoachCard[] = []
  const live = logs.filter((l) => !l.deleted)
  const weighIns14 = live.filter((l) => l.weight != null && daysBetween(l.date, today) >= 0 && daysBetween(l.date, today) < 14).length

  // 1. Enough weigh-ins for a trend?
  if (weighIns14 < NEEDS.weighIns14) {
    cards.push({
      id: 'data',
      kind: 'data',
      title: 'Te weinig wegingen voor eetadvies',
      why: `Weeg je minstens ${NEEDS.weighIns14}× per 14 dagen.`,
      evidence: [`${weighIns14} wegingen / 14d`],
      rule: `min. ${NEEDS.weighIns14} wegingen in 14 dagen`,
      confidence: 'laag',
      status: 'open',
    })
  } else {
    // 2. Eating, judged by the weight trend alone
    const trend = weightTrend(live.filter((l) => daysBetween(l.date, today) >= 0))
    const rate = weeklyRate(trend)
    if (rate) {
      const { perWeek } = rate
      const conf = !rate.provisional && weighIns14 >= 6 ? 'hoog' : 'middel'
      const evidence = [`trend ${perWeek >= 0 ? '+' : '−'}${kg(Math.abs(perWeek))} kg/wk`, `${weighIns14} wegingen / 14d`]
      const zone = `${kg(targets.weeklyGainMin)}–${kg(targets.weeklyGainMax)} kg`
      if (perWeek < targets.weeklyGainMin) {
        const pace = perWeek > 0.02 ? `Je komt ${kg(perWeek)} kg per week bij` : perWeek < -0.02 ? `Je valt ${kg(-perWeek)} kg per week af` : 'Je gewicht staat stil'
        cards.push({
          id: 'food', kind: 'food', title: 'Eet wat meer',
          why: `${pace}, doel is +${zone} per week. Eet elke dag ± ${KCAL_STEP} kcal extra.`,
          evidence, rule: `tempo < ${kg(targets.weeklyGainMin)} kg/wk → ± ${KCAL_STEP} kcal per dag meer`, confidence: conf, status: 'open',
        })
      } else if (perWeek > targets.weeklyGainMax + 0.1) {
        cards.push({
          id: 'food', kind: 'food', title: 'Eet iets minder',
          why: `Je komt ${kg(perWeek)} kg per week bij, sneller dan je doel van ${zone}. Eet elke dag ± ${KCAL_STEP} kcal minder.`,
          evidence, rule: `tempo > ${kg(targets.weeklyGainMax + 0.1)} kg/wk → ± ${KCAL_STEP} kcal per dag minder`, confidence: conf, status: 'open',
        })
      } else {
        cards.push({
          id: 'food', kind: 'food', title: 'Eten zit goed',
          why: `Je komt ${kg(perWeek)} kg per week bij, ${perWeek > targets.weeklyGainMax ? 'net boven' : 'binnen'} je doel van ${zone}. Eet zoals nu.`,
          evidence, rule: `tempo binnen ${zone} → zo houden`, confidence: conf, status: 'open',
        })
      }
    }
  }

  // 3. Stalled lifts (3 sessions without a better e1RM)
  const exById = new Map(input.exercises.map((e) => [e.id, e]))
  const doneWorkouts = input.workouts
    .filter((w) => w.finished_at && !w.deleted)
    .sort((a, b) => a.started_at.localeCompare(b.started_at))
  const workoutOrder = new Map(doneWorkouts.map((w, i) => [w.id, i]))
  const byExercise = new Map<string, Map<string, number>>()
  for (const s of input.sets) {
    if (!s.done || s.kind !== 'work' || s.deleted || !workoutOrder.has(s.workout_id)) continue
    const v = e1rm(s.weight, s.reps)
    if (v == null) continue
    const m = byExercise.get(s.exercise_id) ?? new Map<string, number>()
    m.set(s.workout_id, Math.max(m.get(s.workout_id) ?? 0, v))
    byExercise.set(s.exercise_id, m)
  }
  for (const [exId, perWorkout] of byExercise) {
    const series = [...perWorkout.entries()]
      .sort((a, b) => (workoutOrder.get(a[0]) ?? 0) - (workoutOrder.get(b[0]) ?? 0))
      .map(([, v]) => v)
    if (series.length < 4) continue
    const before = Math.max(...series.slice(0, -3))
    const recent = Math.max(...series.slice(-3))
    if (recent <= before + 0.01) {
      const ex = exById.get(exId)
      if (!ex) continue
      cards.push({
        id: `stall-${exId}`,
        kind: 'stall',
        title: `${ex.name} staat stil`,
        why: 'Check slaap en eten, of zak één stap en bouw opnieuw op.',
        evidence: [`beste e1RM ${kg(before, 1)} kg`, `laatste 3: max ${kg(recent, 1)} kg`],
        rule: '3 sessies zonder hogere e1RM → signaleren',
        confidence: 'middel',
        status: 'open',
      })
    }
  }

  // 4. Volume per muscle in the last 7 days (only once you trained at least 3 times)
  const weekAgo = addDays(today, -6)
  const recentWorkouts = doneWorkouts.filter((w) => w.started_at.slice(0, 10) >= weekAgo)
  if (recentWorkouts.length >= NEEDS.workouts7) {
    const ids = new Set(recentWorkouts.map((w) => w.id))
    const vol = setsPerMuscle(input.sets.filter((s) => ids.has(s.workout_id)), exById)
    const low = (Object.entries(vol) as [keyof typeof vol, number][])
      .filter(([m, n]) => !ZONE_EXEMPT.includes(m) && n < 10)
      .sort((a, b) => a[1] - b[1])
    for (const [muscle, n] of low.slice(0, 1)) {
      // Find an isolation slot for that muscle that still has room.
      let found: { dayId: string; exerciseId: string; dayName: string; sets: number; name: string } | null = null
      for (const day of input.days) {
        for (const it of day.items) {
          const ex = exById.get(it.exerciseId)
          if (!ex || it.section !== 'main' || ex.kind !== 'load') continue
          if (ex.muscles_primary.length === 1 && ex.muscles_primary[0] === muscle && it.sets < 5) {
            if (!found || it.sets < found.sets) found = { dayId: day.id, exerciseId: ex.id, dayName: day.name, sets: it.sets, name: ex.name }
          }
        }
      }
      if (!found) continue
      cards.push({
        id: `volume-${muscle}`,
        kind: 'volume',
        title: `${cap(muscle)}: +2 sets op ${found.dayName}`,
        why: `${kg(n, 1)} sets in 7 dagen (doel 10–20). ${found.name}: van ${found.sets} naar ${found.sets + 2} sets.`,
        evidence: [`${kg(n, 1)} sets/wk`, `${recentWorkouts.length} trainingen`],
        rule: 'volume < 10 sets → +2 op een isolatie-oefening',
        confidence: 'middel',
        action: { type: 'addSets', dayId: found.dayId, exerciseId: found.exerciseId, delta: 2 },
        status: 'open',
      })
    }
  }

  return cards.slice(0, 5)
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
