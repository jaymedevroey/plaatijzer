import type { CoachCard, DailyLog, Exercise, ProgramDay, Targets, Workout, WorkoutSet } from '../lib/types'
import { addDays, daysBetween } from '../lib/dates'
import { kg, int, sleep as fmtSleep } from '../lib/format'
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

const KCAL_STEP = 150

/** What the rules need before they give advice: weigh-ins in 14 days, kcal days in 7, workouts in 7 (for volume). */
export const NEEDS = { weighIns14: 3, food7: 4, workouts7: 3 }

/** Deterministic weekly check-in. The LLM only rewrites `why`; numbers and actions come from here. */
export function coachCards(input: CoachInput): CoachCard[] {
  const { today, logs, targets } = input
  const cards: CoachCard[] = []
  const live = logs.filter((l) => !l.deleted)
  const last = (n: number) => live.filter((l) => daysBetween(l.date, today) >= 0 && daysBetween(l.date, today) < n)

  const weighIns14 = last(14).filter((l) => l.weight != null).length
  const food7 = last(7).filter((l) => l.kcal != null)

  // 1. Enough data?
  if (weighIns14 < NEEDS.weighIns14 || food7.length < NEEDS.food7) {
    cards.push({
      id: 'data',
      kind: 'data',
      title: 'Te weinig data voor kcal-advies',
      why: 'Weeg je 3× per 14 dagen en log 4 dagen per week je kcal.',
      evidence: [`${weighIns14} wegingen / 14d`, `${food7.length}/7 dagen kcal`],
      rule: 'min. 3 wegingen + 4 voedingsdagen',
      confidence: 'laag',
      status: 'open',
    })
  } else {
    // 2. Calories vs weight trend
    const trend = weightTrend(live.filter((l) => daysBetween(l.date, today) >= 0))
    const rate = weeklyRate(trend)
    if (rate) {
      const avgKcal = Math.round(food7.reduce((s, l) => s + (l.kcal ?? 0), 0) / food7.length)
      const conf = !rate.provisional && food7.length >= 6 && weighIns14 >= 6 ? 'hoog' : 'middel'
      const evidence = [
        `trend ${rate.perWeek >= 0 ? '+' : '−'}${kg(Math.abs(rate.perWeek))} kg/wk`,
        `gem. ${int(avgKcal)} kcal`,
        `${food7.length}/7 dagen gelogd`,
      ]
      if (rate.perWeek < targets.weeklyGainMin) {
        cards.push({
          id: 'kcal',
          kind: 'kcal',
          title: `Kcal naar ${int(targets.kcal + KCAL_STEP)}`,
          why: `Je komt ${kg(rate.perWeek)} kg per week bij, doel is ${kg(targets.weeklyGainMin)}–${kg(targets.weeklyGainMax)} kg.`,
          evidence,
          rule: `tempo < ${kg(targets.weeklyGainMin)} kg/wk → +${KCAL_STEP} kcal`,
          confidence: conf,
          action: { type: 'kcal', delta: KCAL_STEP },
          status: 'open',
        })
      } else if (rate.perWeek > targets.weeklyGainMax + 0.1) {
        cards.push({
          id: 'kcal',
          kind: 'kcal',
          title: `Kcal naar ${int(targets.kcal - KCAL_STEP)}`,
          why: `Je komt ${kg(rate.perWeek)} kg per week bij, sneller dan je doel.`,
          evidence,
          rule: `tempo > ${kg(targets.weeklyGainMax + 0.1)} kg/wk → −${KCAL_STEP} kcal`,
          confidence: conf,
          action: { type: 'kcal', delta: -KCAL_STEP },
          status: 'open',
        })
      } else {
        cards.push({
          id: 'kcal',
          kind: 'kcal',
          title: `Kcal ${int(targets.kcal)} houden`,
          why: `${kg(rate.perWeek)} kg per week, binnen je doelzone.`,
          evidence,
          rule: `tempo binnen ${kg(targets.weeklyGainMin)}–${kg(targets.weeklyGainMax)} → houden`,
          confidence: conf,
          status: 'open',
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

  // 5. Protein
  const prot = last(7).filter((l) => l.protein != null)
  if (prot.length >= 4) {
    const avg = Math.round(prot.reduce((s, l) => s + (l.protein ?? 0), 0) / prot.length)
    if (avg < targets.protein - 15) {
      cards.push({
        id: 'protein',
        kind: 'protein',
        title: `Eiwit gemiddeld ${avg} van ${targets.protein} g`,
        why: 'Laatste 7 dagen. Eén eiwitrijke snack of shake per dag dicht het gat.',
        evidence: [`gem. ${avg} g`, `${prot.length} dagen`],
        rule: `gemiddelde < doel − 15 g → signaleren`,
        confidence: 'hoog',
        status: 'open',
      })
    }
  }

  // 6. Sleep
  const sl = last(7).filter((l) => l.sleep_min != null)
  if (sl.length >= 4) {
    const avg = Math.round(sl.reduce((s, l) => s + (l.sleep_min ?? 0), 0) / sl.length)
    if (avg < targets.sleepMin - 60) {
      cards.push({
        id: 'sleep',
        kind: 'sleep',
        title: `Slaap gemiddeld ${fmtSleep(avg)}`,
        why: `Laatste 7 dagen, ruim onder je doel van ${fmtSleep(targets.sleepMin)}.`,
        evidence: [`gem. ${fmtSleep(avg)}`, `doel ${fmtSleep(targets.sleepMin)}`],
        rule: 'gemiddelde < doel − 1u → signaleren',
        confidence: 'hoog',
        status: 'open',
      })
    }
  }

  return cards.slice(0, 5)
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
