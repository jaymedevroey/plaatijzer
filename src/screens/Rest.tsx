import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconCheck, IconDown } from '../ui/icons'
import { IconButton, Label, SecondaryButton } from '../ui/kit'
import { timer, useTimer } from '../state/timer'
import { prFor } from '../state/pr'
import { useActiveWorkout, useDays, useExercises, useSettings } from '../data/hooks'
import { useWakeLock } from '../lib/wakelock'
import { duration, kg } from '../lib/format'
import { sessionsFor, type Session } from '../data/repo'
import { buildGroups, ghost } from './workoutModel'
import { completeSet } from './workoutActions'

export function Rest() {
  const navigate = useNavigate()
  const { state, remaining } = useTimer()
  const active = useActiveWorkout()
  const days = useDays()
  const exercises = useExercises()
  const settings = useSettings()
  const [busy, setBusy] = useState(false)
  useWakeLock(true)

  useEffect(() => {
    if (!state && !busy) navigate('/workout', { replace: true })
  }, [state, busy, navigate])

  const exIds = useMemo(() => [...new Set(active?.sets.map((s) => s.exercise_id) ?? [])], [active?.sets])
  const history = useLiveQuery(async () => {
    const m = new Map<string, Session[]>()
    for (const id of exIds) m.set(id, await sessionsFor(id, active?.workout.id))
    return m
  }, [exIds.join(','), active?.workout.id])

  const groups = useMemo(() => {
    if (!active || !exercises || !history) return []
    const day = days?.find((d) => d.id === active.workout.day_id)
    return buildGroups(active.sets, day, exercises, history, settings.inventory)
  }, [active, exercises, history, days, settings.inventory])

  const next = useMemo(() => {
    for (const g of groups.filter((x) => x.item.section !== 'prep')) {
      const s = g.sets.find((x) => !x.done)
      if (s) {
        const work = g.sets.filter((x) => x.kind === 'work')
        return { g, s, gh: ghost(g, s), n: work.indexOf(s) + 1 }
      }
    }
    return null
  }, [groups])

  if (!state) return null
  const over = remaining <= 0
  const pct = over ? 1 : Math.max(0, remaining / state.durationSec)
  const R = 140
  const C = 2 * Math.PI * R
  const pr = prFor(state.setId)

  async function logNext() {
    if (!next || busy) return
    setBusy(true)
    const isLast = groups.every((x) => x.sets.every((s) => s.id === next.s.id || s.done))
    timer.stop()
    await completeSet(next.g, next.s, history?.get(next.g.exercise.id) ?? [], isLast)
    navigate('/workout', { replace: true })
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[480px] flex-col px-5 pb-[max(env(safe-area-inset-bottom),20px)] safe-top">
      <div className="flex items-center justify-between pt-1">
        <IconButton label="Rustscherm verkleinen" onClick={() => navigate('/workout')}><IconDown size={20} /></IconButton>
        {pr && <span className="num rounded-lg bg-pr px-2 py-1 text-[12px] font-semibold text-bg">{pr}</span>}
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="relative flex aspect-square w-full max-w-[300px] items-center justify-center">
          <svg viewBox="0 0 310 310" className="absolute inset-0 h-full w-full" aria-hidden="true">
            <circle cx="155" cy="155" r={R} fill="none" stroke="var(--color-s2)" strokeWidth="10" />
            <circle cx="155" cy="155" r={R} fill="none" stroke="var(--color-accent)" strokeWidth="10" strokeLinecap="butt"
              strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 155 155)" style={{ transition: 'stroke-dasharray 250ms linear' }} />
          </svg>
          <div role="timer" className="relative flex flex-col items-center gap-2">
            <span className={`num font-cond text-[120px] font-bold leading-[0.85] ${over ? 'text-accent' : ''}`}>
              {over ? 'GO' : duration(remaining)}
            </span>
            {!over && <span className="num text-[14px] text-ink-3">van {duration(state.durationSec)}</span>}
          </div>
        </div>
        {!over && (
          <div className="flex gap-2">
            <SecondaryButton onClick={() => timer.adjust(-15)} label="15 seconden minder" className="w-20">−15</SecondaryButton>
            <SecondaryButton onClick={() => timer.adjust(30)} label="30 seconden meer" className="w-20">+30</SecondaryButton>
          </div>
        )}
      </div>

      {next && (
        <div className="flex items-center gap-3 rounded-3xl bg-s1 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <Label>Volgende</Label>
            <span className="truncate text-[16px] font-semibold">{next.g.exercise.name}</span>
            <span className="num text-[15px] text-ink-2">
              {next.s.kind === 'warmup' ? 'Warm-up' : `Set ${next.n}`} · {next.gh.weight != null ? `${kg(next.gh.weight)} kg × ` : ''}{next.gh.reps ?? '–'}
            </span>
          </div>
          <button
            onClick={logNext}
            disabled={busy || next.gh.weight == null && next.g.exercise.kind === 'load'}
            aria-label="Deze set afvinken"
            className="press flex h-16 w-16 shrink-0 items-center justify-center rounded-[14px] bg-accent text-bg disabled:opacity-40"
          >
            <IconCheck size={26} />
          </button>
        </div>
      )}
    </div>
  )
}
