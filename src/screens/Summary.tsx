import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { PrimaryButton } from '../ui/kit'
import { IconRight, IconUp } from '../ui/icons'
import { useDays, useExercises, useFinishedWorkouts, useSettings, useWorkout } from '../data/hooks'
import { checkPr, sessionsFor, type Session } from '../data/repo'
import { nextTarget } from '../engine/progression'
import { int, kg } from '../lib/format'
import { dayShort, isoDate, shortDate, today, weekStart } from '../lib/dates'
import type { WorkoutSet } from '../lib/types'

const vol = (xs: WorkoutSet[]) => xs.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0) + (x.weight ? 0 : x.reps ?? 0), 0)

export function Summary() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useWorkout(id)
  const days = useDays()
  const exercises = useExercises()
  const finished = useFinishedWorkouts()
  const settings = useSettings()

  const exIds = useMemo(() => [...new Set(data?.sets.map((s) => s.exercise_id) ?? [])], [data?.sets])
  const history = useLiveQuery(async () => {
    const m = new Map<string, Session[]>()
    for (const e of exIds) m.set(e, await sessionsFor(e, id))
    return m
  }, [exIds.join(','), id])

  if (!data || !exercises || !history) return <div className="min-h-[100dvh]" />
  const { workout, sets } = data
  const day = days?.find((d) => d.id === workout.day_id)
  const mins = workout.finished_at ? Math.round((new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime()) / 60000) : 0
  const work = sets.filter((s) => s.kind === 'work' && s.done)
  const ws = weekStart(isoDate(new Date(workout.started_at)))
  const weekCount = (finished ?? []).filter((w) => isoDate(new Date(w.started_at)) >= ws).length

  const rows = exIds
    .map((exId) => {
      const ex = exercises.get(exId)!
      const item = day?.items.find((i) => i.exerciseId === exId)
      if (item?.section === 'prep') return null
      const mine = work.filter((s) => s.exercise_id === exId)
      if (!mine.length) return null
      const hist = history.get(exId) ?? []
      const pr = mine.map((s) => checkPr(s, hist)).find(Boolean)
      // Progress = more total work than last time (weight × reps), not just a better top set.
      const before = hist[0] ? vol(hist[0].sets.filter((s) => s.kind === 'work')) : null
      const now = vol(mine)
      const status = before == null ? null : now > before ? 'up' : now < before ? 'down' : 'same'
      const nxt = item ? nextTarget(item, ex.kind, ex.equipment, mine, settings.inventory) : null
      return { ex, mine, pr, status, nxt }
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[560px] flex-col gap-6 px-4 pb-10 safe-top lg:max-w-[1200px] lg:px-10 lg:pt-10">
      <div className="flex flex-col gap-2 pt-4 lg:pt-2">
        <h1 className="font-cond text-[56px] font-bold uppercase leading-[0.85]">{day?.name ?? 'Workout'}</h1>
        <span className="num text-[16px] text-ink-2">
          {isoDate(new Date(workout.started_at)) === today() ? 'Klaar' : `${dayShort(isoDate(new Date(workout.started_at)))} ${shortDate(isoDate(new Date(workout.started_at)))}`}
          {' · '}{mins < 1 ? '<1' : mins} min · {work.length} sets · {int(work.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0))} kg · week {weekCount}/4
        </span>
      </div>

      <ul className="grid grid-cols-1 gap-x-10 rounded-3xl bg-s1 px-4 lg:grid-cols-2 lg:px-6">
        {rows.map((r) => (
          <li key={r.ex.id} className="flex flex-col gap-1 border-t border-line py-3.5 first:border-t-0 lg:[&:nth-child(2)]:border-t-0">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-[16px] font-semibold">{r.ex.name}</span>
              {r.pr ? (
                <span className="shrink-0 rounded-md bg-pr px-1.5 py-0.5 text-[11px] font-semibold text-bg">PR</span>
              ) : r.status ? (
                <span className={`flex shrink-0 items-center gap-1 text-[13px] ${r.status === 'up' ? 'text-ink' : 'text-ink-3'}`}>
                  {r.status === 'up' && <IconUp size={12} />}
                  {r.status === 'up' ? 'meer dan vorige keer' : r.status === 'same' ? 'gelijk aan vorige keer' : 'minder dan vorige keer'}
                </span>
              ) : null}
            </div>
            <span className="num text-[14px] text-ink-2">{r.mine.map((s) => `${kg(s.weight)} × ${s.reps}`).join('  ·  ')}</span>
            {r.nxt && r.nxt.weight != null && r.nxt.kind !== 'fixed' && (
              <span className="num text-[13px] text-ink-3">Volgende keer {kg(r.nxt.weight)} × {r.nxt.reps[0]}</span>
            )}
          </li>
        ))}
      </ul>

      <PrimaryButton onClick={() => navigate('/', { replace: true })} className="lg:max-w-[360px]">
        <span>Terug</span>
        <IconRight />
      </PrimaryButton>
    </div>
  )
}
