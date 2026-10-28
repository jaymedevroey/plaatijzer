import { useMemo, useState } from 'react'
import { Card, CardHead, Page, SecondaryButton } from '../ui/kit'
import { useQuickLog } from '../ui/Shell'
import { E1rmChart, WeightChart, type E1rmPoint } from '../ui/charts'
import { useAllSets, useDays, useExercises, useFinishedWorkouts, useLogs, useSettings } from '../data/hooks'
import { ConsistencyCard } from './Consistency'
import { sampleYear } from '../data/sample'
import { weeklyRate, weightTrend } from '../engine/trend'
import { e1rm } from '../engine/progression'
import { MUSCLES, setsPerMuscle, ZONE_EXEMPT } from '../engine/volume'
import { addDays, daysBetween, isoDate, today } from '../lib/dates'
import { kg, signed } from '../lib/format'
import type { Muscle } from '../lib/types'

const RANGES = [
  { key: '1M', days: 31 },
  { key: '3M', days: 92 },
  { key: '1J', days: 366 },
  { key: 'Alles', days: 100000 },
] as const

export function Progress() {
  const logs = useLogs()
  const settings = useSettings()
  const sets = useAllSets()
  const workouts = useFinishedWorkouts()
  const exercises = useExercises()
  const programDays = useDays()
  const openLog = useQuickLog()
  const [range, setRange] = useState<(typeof RANGES)[number]['key']>('1M')
  const [exId, setExId] = useState<string | null>(null)

  const t = today()
  const tg = settings.targets
  const trend = useMemo(() => weightTrend(logs ?? []), [logs])
  const rate = useMemo(() => weeklyRate(trend), [trend])
  const days = RANGES.find((r) => r.key === range)!.days
  const shown = trend.filter((p) => daysBetween(p.date, t) <= days)
  const current = trend[trend.length - 1]?.trend

  const wById = useMemo(() => new Map((workouts ?? []).map((w) => [w.id, w])), [workouts])

  // Finished workouts for the day grid: local date, program-day name and done work sets.
  const gridWorkouts = useMemo(() => {
    const count = new Map<string, number>()
    for (const s of sets ?? []) if (s.done && s.kind === 'work' && wById.has(s.workout_id)) count.set(s.workout_id, (count.get(s.workout_id) ?? 0) + 1)
    return (workouts ?? []).map((w) => ({
      id: w.id,
      date: isoDate(new Date(w.started_at)),
      name: programDays?.find((d) => d.id === w.day_id)?.name ?? 'Training',
      sets: count.get(w.id) ?? 0,
    }))
  }, [sets, workouts, wById, programDays])

  // "?voorbeeld": the day grid with a made-up year, to see what it looks like filled. Nothing is stored.
  const preview = new URLSearchParams(location.search).has('voorbeeld')
  const sample = useMemo(
    () => (preview ? sampleYear(t, settings.targets, settings.schedule.gymDays, (programDays ?? []).map((d) => d.name)) : null),
    [preview, t, settings.targets, settings.schedule.gymDays, programDays],
  )

  // Every loaded lift with history: barbell first, then most-trained, then by name (same order on every device).
  const { allLifts, best } = useMemo(() => {
    const best = new Map<string, { weight: number | null; reps: number | null; value: number; sessions: Set<string> }>()
    if (!sets || !exercises) return { allLifts: [], best }
    const count = new Map<string, number>()
    for (const s of sets) {
      if (!(s.done && s.kind === 'work' && wById.has(s.workout_id) && s.weight)) continue
      count.set(s.exercise_id, (count.get(s.exercise_id) ?? 0) + 1)
      const v = e1rm(s.weight, s.reps) ?? 0
      const b = best.get(s.exercise_id) ?? { weight: null, reps: null, value: 0, sessions: new Set<string>() }
      b.sessions.add(s.workout_id)
      if (v > b.value) Object.assign(b, { weight: s.weight, reps: s.reps, value: v })
      best.set(s.exercise_id, b)
    }
    const rank = { barbell: 0, dumbbell: 1, cable: 2, bodyweight: 3, none: 4 }
    const allLifts = [...count.keys()]
      .map((id) => exercises.get(id))
      .filter((e): e is NonNullable<typeof e> => !!e && e.kind === 'load')
      .sort((a, b) => rank[a.equipment] - rank[b.equipment] || (count.get(b.id) ?? 0) - (count.get(a.id) ?? 0) || a.name.localeCompare(b.name))
    return { allLifts, best }
  }, [sets, exercises, wById])
  const lifts = allLifts.slice(0, 6)
  const selected = lifts.find((e) => e.id === exId) ?? lifts[0]
  // With one session per lift a line chart says nothing yet: show the first measurements instead.
  const firstOnly = allLifts.every((e) => (best.get(e.id)?.sessions.size ?? 0) < 2)

  const strength = useMemo(() => {
    if (!selected || !sets) return null
    const mine = sets.filter((s) => s.exercise_id === selected.id && s.done && s.kind === 'work' && wById.has(s.workout_id))
    const byW = new Map<string, typeof mine>()
    for (const s of mine) byW.set(s.workout_id, [...(byW.get(s.workout_id) ?? []), s])
    const sessions = [...byW.entries()].map(([wid, ss]) => ({ w: wById.get(wid)!, ss })).sort((a, b) => a.w.started_at.localeCompare(b.w.started_at))
    let best = 0
    const points: E1rmPoint[] = []
    for (const { w, ss } of sessions) {
      let top = ss[0]
      let v = 0
      for (const s of ss) {
        const e = e1rm(s.weight, s.reps) ?? 0
        if (e > v) { v = e; top = s }
      }
      if (!v) continue
      const pr = points.length > 0 && v > best + 0.01
      best = Math.max(best, v)
      points.push({ date: isoDate(new Date(w.started_at)), value: v, pr, best: `${kg(top.weight)} × ${top.reps}` })
    }
    return { points, best, first: points[0]?.value ?? 0, prs: points.filter((p) => p.pr).length }
  }, [selected, sets, wById])

  // Sets per muscle over the last 7 days (and the 7 before as a shadow).
  const vol = useMemo(() => {
    if (!sets || !exercises) return null
    const inRange = (from: string, to: string) => {
      const ids = new Set((workouts ?? []).filter((w) => { const d = isoDate(new Date(w.started_at)); return d >= from && d <= to }).map((w) => w.id))
      return setsPerMuscle(sets.filter((s) => ids.has(s.workout_id)), exercises)
    }
    return { cur: inRange(addDays(t, -6), t), prev: inRange(addDays(t, -13), addDays(t, -7)) }
  }, [sets, exercises, workouts, t])

  if (!logs || !sets || !workouts) return null
  const zone = rate ? (rate.perWeek < tg.weeklyGainMin ? 'onder doelzone' : rate.perWeek > tg.weeklyGainMax ? 'boven doelzone' : 'binnen doelzone') : null
  const weighIns = logs.filter((l) => l.weight != null).length

  return (
    <Page title="Progressie" sub={`${workouts.length} ${workouts.length === 1 ? 'training' : 'trainingen'} · ${weighIns} ${weighIns === 1 ? 'weging' : 'wegingen'}`}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:items-start lg:gap-5">
        <ConsistencyCard
          className="lg:col-span-2"
          today={t}
          logs={sample?.logs ?? logs}
          workouts={sample?.workouts ?? gridWorkouts}
          gymDays={settings.schedule.gymDays}
          preview={!!sample}
        />

        <Card className="flex flex-col gap-4">
          <div className="flex min-h-10 items-center justify-between gap-3">
            <h2 className="text-[16px] font-semibold">Gewicht</h2>
            {trend.length >= 2 && (
              <div role="group" aria-label="Periode" className="flex rounded-[10px] bg-s2 p-0.5">
                {RANGES.map((r) => (
                  <button key={r.key} aria-pressed={range === r.key} onClick={() => setRange(r.key)}
                    className={`press h-9 rounded-[8px] px-2.5 text-[13px] font-semibold ${range === r.key ? 'bg-ink text-bg' : 'text-ink-3'}`}>
                    {r.key}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="num font-cond text-[44px] font-bold leading-none">
              {kg(current ?? tg.startWeight, 1)}<span className="font-sans text-[16px] font-normal text-ink-3">&nbsp;kg{current == null ? ' · startgewicht' : ''}</span>
            </span>
            {rate && (
              <span className="num text-[14px] text-ink-2">{signed(rate.perWeek)} kg per week · {zone}</span>
            )}
          </div>
          {shown.length >= 2 ? (
            <WeightChart points={shown} targets={tg} label={`Gewichtstrend ${range}`} />
          ) : (
            <div className="flex flex-col items-start gap-3 py-4">
              <p className="text-[14px] text-ink-3">
                Na twee wegingen zie je hier je trend tegen je doelzone van +{kg(tg.weeklyGainMin)}–{kg(tg.weeklyGainMax)} kg per week. Weeg je 's ochtends, na het opstaan.
              </p>
              <SecondaryButton onClick={() => openLog()}>Gewicht loggen</SecondaryButton>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <CardHead title="Kracht" aside={firstOnly && allLifts.length ? 'eerste metingen' : undefined} />
          {firstOnly && allLifts.length > 0 ? (
            <>
              <table className="w-full border-collapse text-[15px]">
                <thead>
                  <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">
                    <th scope="col" className="pb-2 text-left font-semibold">Oefening</th>
                    <th scope="col" className="pb-2 pl-3 text-right font-semibold">Beste set</th>
                    <th scope="col" className="pb-2 pl-3 text-right font-semibold">1RM</th>
                  </tr>
                </thead>
                <tbody>
                  {allLifts.map((e) => {
                    const b = best.get(e.id)!
                    return (
                      <tr key={e.id} className="border-t border-line">
                        <td className="py-2.5 pr-3">{e.name}</td>
                        <td className="num whitespace-nowrap py-2.5 pl-3 text-right text-ink-2">{kg(b.weight)} kg × {b.reps}</td>
                        <td className="num whitespace-nowrap py-2.5 pl-3 text-right">{kg(b.value, 1)} kg</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="text-[13px] text-ink-3">1RM is geschat uit je beste set. Vanaf de tweede sessie per oefening zie je hier je lijn en je records.</p>
            </>
          ) : lifts.length > 0 && (
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [mask-image:linear-gradient(to_right,#000_calc(100%-40px),transparent)] [scrollbar-width:none] lg:-mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 lg:[mask-image:none]" role="group" aria-label="Oefening">
              {lifts.map((e) => (
                <button key={e.id} aria-pressed={selected?.id === e.id} onClick={() => setExId(e.id)}
                  className={`press h-9 shrink-0 rounded-[10px] px-3 text-[14px] font-semibold ${selected?.id === e.id ? 'bg-ink text-bg' : 'bg-s2 text-ink-2'}`}>
                  {e.name.replace(/^(Barbell|DB|Cable) /, '')}
                </button>
              ))}
            </div>
          )}
          {firstOnly ? (
            !allLifts.length && <p className="py-4 text-[14px] text-ink-3">Na je eerste training zie je hier per oefening je beste set en je geschatte 1RM.</p>
          ) : strength && strength.points.length ? (
            <>
              <div className="flex items-end justify-between gap-3">
                <span className="num font-cond text-[44px] font-bold leading-none">{kg(strength.best, 1)}<span className="font-sans text-[16px] font-normal text-ink-3">&nbsp;kg · geschat 1RM</span></span>
                {strength.points.length > 1 && (
                  <span className="num pb-1 text-[14px] text-ink-2">
                    {strength.best - strength.first >= 0 ? '+' : '−'}{kg(Math.abs(strength.best - strength.first), 1)} kg
                    {strength.prs > 0 && <span className="text-pr"> · {strength.prs} PR{strength.prs === 1 ? '' : '’s'}</span>}
                  </span>
                )}
              </div>
              <E1rmChart points={strength.points} label={`Geschatte 1RM ${selected?.name}`} />
            </>
          ) : (
            <p className="py-4 text-[14px] text-ink-3">Voor deze oefening is nog geen gewicht gelogd.</p>
          )}
        </Card>

        <Card className="flex flex-col gap-3 lg:col-span-2">
          <div className="flex flex-col gap-1">
            <CardHead title="Sets per spier" aside="doel 10–20 per week" />
            <p className="text-[13px] text-ink-3">Wit: laatste 7 dagen · donker: de 7 dagen ervoor · streepjes: 10 en 20 sets. Grijze spieren tellen niet mee voor het doel.</p>
          </div>
          {vol && (
            <div className="flex flex-col gap-2.5 lg:max-w-[760px]">
              {MUSCLES.filter((m) => !ZONE_EXEMPT.includes(m) || vol.cur[m] > 0).map((m) => (
                <VolumeRow key={m} muscle={m} cur={vol.cur[m]} prev={vol.prev[m]} exempt={ZONE_EXEMPT.includes(m)} />
              ))}
            </div>
          )}
        </Card>
      </div>
    </Page>
  )
}

function VolumeRow({ muscle, cur, prev, exempt }: { muscle: Muscle; cur: number; prev: number; exempt: boolean }) {
  const MAX = 22
  const pct = (n: number) => `${Math.min(100, (n / MAX) * 100)}%`
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)_32px] items-center gap-3">
      <span className={`text-[14px] ${exempt ? 'text-ink-3' : 'text-ink-2'}`}>{muscle.charAt(0).toUpperCase() + muscle.slice(1)}</span>
      <div className="relative h-2.5" role="img" aria-label={`${muscle}: ${kg(cur, 1)} sets, week ervoor ${kg(prev, 1)}`}>
        <span className="absolute inset-0 rounded-full bg-s2" />
        {!exempt && (
          <>
            <span className="absolute -inset-y-1 w-px bg-line-2" style={{ left: pct(10) }} aria-hidden="true" />
            <span className="absolute -inset-y-1 w-px bg-line-2" style={{ left: pct(20) }} aria-hidden="true" />
          </>
        )}
        <span className="absolute inset-y-0 left-0 rounded-full bg-s3" style={{ width: pct(prev) }} />
        <span className={`absolute inset-y-0 left-0 rounded-full ${exempt ? 'bg-ink-3' : 'bg-ink'}`} style={{ width: pct(cur) }} />
      </div>
      <span className="num text-right text-[14px] text-ink-2">{cur > 0 ? kg(cur, 1) : ''}</span>
    </div>
  )
}
