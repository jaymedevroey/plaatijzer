import { describe, expect, it } from 'vitest'
import type { DayItem, Exercise, Inventory, Schedule, WorkoutSet } from '../lib/types'
import { loadableWeights, nextWeight, platesPerSide, snap } from './plates'
import { e1rm, nextTarget } from './progression'
import { weeklyRate, weightTrend } from './trend'
import { setsPerMuscle } from './volume'
import { coachCards } from './coach'
import { weekPlan } from './week'
import { remoteWins } from '../data/merge'
import { buildDays, weekStreaks } from './consistency'
import { DEFAULT_SETTINGS, SEED_DAYS } from '../data/seed'
import { addDays } from '../lib/dates'

const inv: Inventory = {
  barKg: 20,
  plates: [1.25, 2.5, 5, 10, 15, 20],
  dumbbells: [2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  cableStep: 2.5,
  cableMax: 80,
}

const bench: DayItem = { exerciseId: 'b', sets: 3, repMin: 5, repMax: 8, rirMin: 1, rirMax: 3, restSec: 150, section: 'main' }

function set(reps: number, weight: number, rir: number | null = 2, extra: Partial<WorkoutSet> = {}): WorkoutSet {
  return {
    id: Math.random().toString(36), updated_at: '', deleted: false, workout_id: 'w', exercise_id: 'b',
    position: 0, kind: 'work', weight, reps, rir, seconds: null, done: true, done_at: null, ...extra,
  }
}

describe('plates', () => {
  it('loads 62,5 kg as 20 + 1,25 per side', () => {
    expect(platesPerSide(62.5, inv)).toEqual([20, 1.25])
  })
  it('returns null for an unloadable weight', () => {
    expect(platesPerSide(61, inv)).toBeNull()
  })
  it('barbell steps are 2,5 kg', () => {
    expect(nextWeight(60, 'barbell', inv)).toBe(62.5)
  })
  it('dumbbells jump to the next pair you own', () => {
    expect(nextWeight(22, 'dumbbell', inv)).toBe(24)
    expect(nextWeight(30, 'dumbbell', inv)).toBe(30)
  })
  it('cable follows the stack', () => {
    expect(nextWeight(17.5, 'cable', inv)).toBe(20)
    expect(loadableWeights('cable', inv)[0]).toBe(2.5)
  })
  it('snaps to the closest loadable weight', () => {
    expect(snap(23, 'dumbbell', inv)).toBe(22)
    expect(snap(61.4, 'barbell', inv)).toBe(62.5)
  })
})

describe('double progression', () => {
  it('first session asks you to pick', () => {
    expect(nextTarget(bench, 'load', 'barbell', [], inv).kind).toBe('first')
  })
  it('all sets at the top → next weight, reps back to bottom', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60), set(8, 60), set(8, 60)], inv)
    expect(t.kind).toBe('increase')
    expect(t.weight).toBe(62.5)
    expect(t.reps).toEqual([5, 5, 5])
    expect(t.bigJump).toBe(false)
  })
  it('not at the top → +1 rep per set, capped', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60), set(7, 60), set(6, 60)], inv)
    expect(t.kind).toBe('reps')
    expect(t.weight).toBe(60)
    expect(t.reps).toEqual([8, 8, 7])
  })
  it('RIR below target → hold', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60), set(8, 60, 0), set(8, 60)], inv)
    expect(t.kind).toBe('hold')
    expect(t.weight).toBe(60)
  })
  it('unknown RIR (not entered) does not block progression', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60, null), set(8, 60, null), set(8, 60, null)], inv)
    expect(t.kind).toBe('increase')
  })
  it('fewer sets than planned is not "at the top"', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60), set(8, 60)], inv)
    expect(t.kind).toBe('reps')
  })
  it('flags a big dumbbell jump', () => {
    const t = nextTarget({ ...bench, repMax: 12, repMin: 8 }, 'load', 'dumbbell', [set(12, 8), set(12, 8), set(12, 8)], inv)
    expect(t.weight).toBe(10)
    expect(t.bigJump).toBe(true)
  })
  it('ignores undone sets', () => {
    const t = nextTarget(bench, 'load', 'barbell', [set(8, 60, 2, { done: false })], inv)
    expect(t.kind).toBe('first')
  })
  it('e1RM uses Epley and stops above 12 reps', () => {
    expect(e1rm(62.5, 8)).toBeCloseTo(79.17, 1)
    expect(e1rm(20, 15)).toBeNull()
  })
})

describe('weight trend', () => {
  it('interpolates missing days and smooths', () => {
    const t = weightTrend([
      { date: '2026-10-05', weight: 64 },
      { date: '2026-10-07', weight: 65 },
    ])
    expect(t.map((p) => p.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07'])
    expect(t[1].raw).toBeNull()
    expect(t[2].trend).toBeGreaterThan(64)
    expect(t[2].trend).toBeLessThan(65)
  })
  it('a steady +0,3 kg/wk gain reads as ~+0,3 after enough days', () => {
    const entries = Array.from({ length: 60 }, (_, i) => {
      const d = new Date(2026, 8, 1 + i)
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      return { date, weight: 70 + (0.3 / 7) * i }
    })
    const rate = weeklyRate(weightTrend(entries))
    expect(rate?.perWeek).toBeCloseTo(0.3, 1)
    expect(rate?.provisional).toBe(false)
  })
  it('needs a week of data', () => {
    expect(weeklyRate(weightTrend([{ date: '2026-10-01', weight: 70 }, { date: '2026-10-03', weight: 70.2 }]))).toBeNull()
  })
  it('is rounded to what the screens show, so 0,247 judges as 0,25', () => {
    const rate = weeklyRate([{ date: '2026-10-01', raw: 70, trend: 70 }, { date: '2026-10-15', raw: 70.5, trend: 70.494 }])
    expect(rate?.perWeek).toBe(0.25)
  })
})

describe('volume', () => {
  it('counts primary 1 and secondary 0,5, only done work sets', () => {
    const ex: Exercise = {
      id: 'b', name: 'Bench', kind: 'load', equipment: 'barbell', muscles_primary: ['borst'],
      muscles_secondary: ['triceps', 'voor-delts'], updated_at: '', deleted: false,
    }
    const v = setsPerMuscle([set(8, 60), set(8, 60), set(8, 60, 2, { kind: 'warmup' }), set(8, 60, 2, { done: false })], new Map([['b', ex]]))
    expect(v.borst).toBe(2)
    expect(v.triceps).toBe(1)
  })
})

describe('week plan', () => {
  // Tuesday 27 Oct 2026; local times so the test does not depend on the time zone.
  // Example schedule: gym ma/wo/vr, a team training on Tuesday and a match on Sunday.
  const schedule: Schedule = { gymDays: [1, 3, 5], volley: { 2: 'training', 0: 'match' } }
  const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).toISOString()
  const workout = (dayIdx: number, d: number) => ({
    id: `w${d}`, day_id: SEED_DAYS[dayIdx].id, started_at: at(d, 17), finished_at: at(d, 18), note: '', updated_at: '', deleted: false,
  })
  const label = (p: ReturnType<typeof weekPlan>[number]) =>
    p.done.map((x) => `✓${x.name}`).join('') || p.planned || (p.skipped ? 'skip' : '') || p.volley || 'rust'

  it('trained on a team-training day: the rotation fills the coming gym days', () => {
    const plan = weekPlan('2026-10-27', SEED_DAYS, [workout(0, 27)], schedule)
    expect(plan.map(label)).toEqual(['skip', '✓Upper', 'Lower', 'rust', 'Full body', 'rust', 'match'])
    expect(plan[1].volley).toBe('training')
    expect(plan[1].done[0].minutes).toBe(60)
  })
  it('a new account starts the rotation at the first program day', () => {
    expect(weekPlan('2026-10-27', SEED_DAYS, [], schedule).map(label)).toEqual(['skip', 'training', 'Upper', 'rust', 'Lower', 'rust', 'match'])
  })
  it('today is a gym day without a workout: today gets the next day', () => {
    const plan = weekPlan('2026-10-28', SEED_DAYS, [workout(1, 26)], schedule)
    expect(plan[2].isToday).toBe(true)
    expect(plan[2].planned).toBe('Full body')
    expect(plan[0].done[0].name).toBe('Lower')
  })
})

describe('sync merge', () => {
  it('the server row wins when there is no local change', () => {
    expect(remoteWins('2026-01-01T00:00:00+00:00')).toBe(true)
    expect(remoteWins('2026-01-01T00:00:00+00:00', { dirty: 0, updated_at: '2026-05-01T00:00:00.000Z' })).toBe(true)
  })
  it('compares instants, not strings: same moment in two formats is not "older"', () => {
    expect(remoteWins('2026-01-01T00:00:00+00:00', { dirty: 1, updated_at: '2026-01-01T00:00:00.000Z' })).toBe(true)
  })
  it('a newer local change is kept until it is pushed', () => {
    expect(remoteWins('2026-01-01T00:00:00+00:00', { dirty: 1, updated_at: '2026-01-02T08:00:00.000Z' })).toBe(false)
  })
})

describe('coach', () => {
  const base = {
    today: '2026-11-01', targets: DEFAULT_SETTINGS.targets, workouts: [], sets: [], exercises: [], days: [],
  }
  // 21 daily weigh-ins ending on `today`, gaining `perWeek` kg per week
  const weighIns = (perWeek: number) => Array.from({ length: 21 }, (_, i) => ({
    id: String(i), updated_at: '', deleted: false, date: `2026-10-${String(11 + i).padStart(2, '0')}`, weight: 64 + (perWeek / 7) * i,
  }))
  const food = (perWeek: number) => coachCards({ ...base, logs: weighIns(perWeek) }).find((c) => c.kind === 'food')

  it('asks for more weigh-ins when there are too few', () => {
    const cards = coachCards({ ...base, logs: weighIns(0).slice(-2) })
    expect(cards[0].kind).toBe('data')
    expect(cards.some((c) => c.kind === 'food')).toBe(false)
  })
  it('flat weight → eat ± 150 kcal more, as advice without an action', () => {
    const card = food(0)
    expect(card?.title).toBe('Eet wat meer')
    expect(card?.why).toMatch(/^Je gewicht staat stil.*150 kcal extra/)
    expect(card?.action).toBeUndefined()
    expect(card?.confidence).toBe('hoog')
  })
  it('losing weight reads as losing, not as a negative gain', () => {
    expect(food(-0.6)?.why).toMatch(/^Je valt [\d,]+ kg per week af/)
  })
  it('inside the zone → keep eating like now', () => {
    expect(food(0.4)?.title).toBe('Eten zit goed')
  })
  it('well above the zone → eat a bit less', () => {
    expect(food(1.4)?.title).toBe('Eet iets minder')
  })
})

describe('consistency', () => {
  const log = (date: string, weight: number | null = 70) => ({ id: date, updated_at: '', deleted: false, date, weight })
  const w = (date: string, sets = 15) => ({ id: `w-${date}`, date, name: 'Upper', sets })
  // ma 26 okt t/m zo 1 nov 2026; gym ma/wo/vr
  const input = (logs: ReturnType<typeof log>[], workouts: ReturnType<typeof w>[] = []) => ({ logs, workouts, gymDays: [1, 3, 5] })

  it('an empty week is level 0 everywhere and no streak', () => {
    const days = buildDays('2026-10-26', '2026-11-01', input([]))
    expect(days).toHaveLength(7)
    expect(days.every((d) => d.level.training === 0 && d.level.wegen === 0)).toBe(true)
    expect(weekStreaks(days, '2026-11-01', 3)).toEqual({ current: 0, longest: 0 })
  })
  it('training colour follows done work sets; a weigh-in is there or not', () => {
    const days = buildDays('2026-10-26', '2026-10-30', input(
      [log('2026-10-26'), log('2026-10-27', null)],
      [w('2026-10-26', 5), w('2026-10-27', 10), w('2026-10-28', 15), w('2026-10-29', 18)],
    ))
    expect(days.map((d) => d.level.training)).toEqual([1, 2, 3, 4, 0])
    expect(days.map((d) => d.level.wegen)).toEqual([4, 0, 0, 0, 0])
    expect(days.map((d) => d.gymDay)).toEqual([true, false, true, false, true])
  })
  it('two workouts on one day add up', () => {
    const [d] = buildDays('2026-10-26', '2026-10-26', input([], [w('2026-10-26', 8), { ...w('2026-10-26', 8), id: 'w2' }]))
    expect(d.workouts).toHaveLength(2)
    expect(d.level.training).toBe(3)
  })
  it('week streak counts weeks with enough trainings; the running week does not break it', () => {
    const days = (workouts: ReturnType<typeof w>[]) => buildDays('2026-10-05', '2026-10-28', input([], workouts))
    const three = (mon: string) => [w(mon), w(addDays(mon, 2)), w(addDays(mon, 4))]
    // weeks of 5/10 (1 training), 12/10 (3), 19/10 (3), 26/10 (running, 1 so far)
    const ok = days([w('2026-10-05'), ...three('2026-10-12'), ...three('2026-10-19'), w('2026-10-26')])
    expect(weekStreaks(ok, '2026-10-28', 3)).toEqual({ current: 2, longest: 2 })
    // the running week already has enough → it counts
    const now = days([...three('2026-10-19'), w('2026-10-26'), w('2026-10-27'), w('2026-10-28')])
    expect(weekStreaks(now, '2026-10-28', 3)).toEqual({ current: 2, longest: 2 })
    // a missed week in between resets the current streak
    const broken = days([...three('2026-10-05'), ...three('2026-10-12'), w('2026-10-26')])
    expect(weekStreaks(broken, '2026-10-28', 3)).toEqual({ current: 0, longest: 2 })
  })
})
