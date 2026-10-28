import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CardHead, Page, PrimaryButton, QuietButton, Row, SecondaryButton, Sheet } from '../ui/kit'
import { IconCheck, IconChevron, IconRight, IconUp, IconVolleyball } from '../ui/icons'
import { WeightChart } from '../ui/charts'
import { useQuickLog } from '../ui/Shell'
import { nextDay, useActiveWorkout, useAllSets, useDays, useExercises, useFinishedWorkouts, useLogs, useSettings } from '../data/hooks'
import { startWorkout } from '../data/repo'
import { nextTarget } from '../engine/progression'
import { weeklyRate, weightTrend, type Rate, type TrendPoint } from '../engine/trend'
import { weekPlan, type PlanDay } from '../engine/week'
import { addDays, dayShort, daysBetween, isoDate, longDate, parseDate, shortDate, today } from '../lib/dates'
import { int, kg } from '../lib/format'
import { unlockAudio } from '../lib/sound'
import type { DayItem, Exercise, Inventory, ProgramDay, Targets, Workout, WorkoutSet } from '../lib/types'

export function Today() {
  const navigate = useNavigate()
  const openLog = useQuickLog()
  const days = useDays()
  const finished = useFinishedWorkouts()
  const active = useActiveWorkout()
  const logs = useLogs()
  const sets = useAllSets()
  const exercises = useExercises()
  const settings = useSettings()
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [choosing, setChoosing] = useState(false)
  const starting = useRef(false)

  const t = today()
  const schedule = settings.schedule
  const plan = useMemo(() => (days && finished ? weekPlan(t, days, finished, schedule) : []), [t, days, finished, schedule])
  const history = useMemo(() => summarize(sets ?? [], finished ?? []), [sets, finished])
  const trend = useMemo(() => weightTrend(logs ?? []), [logs])
  const rate = useMemo(() => weeklyRate(trend), [trend])

  async function start(d: ProgramDay) {
    if (starting.current) return
    starting.current = true
    unlockAudio()
    await startWorkout(d)
    navigate('/workout')
  }

  if (!days || !finished || !sets || !exercises || !logs || active === undefined || !plan.length) return null

  const suggested = nextDay(days, finished)
  const day = days.find((d) => d.id === pickedId) ?? suggested
  const now = plan.find((p) => p.isToday)!
  // Today is a planned gym day without a workout yet: then the card is today's session with the orange Start.
  const gymToday = now.planned != null
  const nextDate = gymToday ? t : plan.find((p) => p.planned && !p.past)?.date ?? nextGymDay(t, schedule.gymDays)
  const recent = [...finished].reverse().slice(0, 5)
  const perWorkout = (id: string) => history.perWorkout.get(id) ?? { sets: 0, volume: 0 }

  return (
    <Page title="Vandaag" sub={longDate(t)}>
      {/* Two stacks on a wide screen (training | body); on the phone one column in the order set below. */}
      <div className="grid grid-cols-1 gap-3 lg:gap-5 xl:grid-cols-12 xl:items-start">
        <div className="contents xl:col-span-7 xl:flex xl:flex-col xl:gap-5">
          {!active && !gymToday && <StatusCard p={now} perWorkout={perWorkout} className="order-1 xl:order-none" />}
          <div className="order-2 xl:order-none">
            {active ? (
              <ActiveCard
                name={days.find((d) => d.id === active.workout.day_id)?.name ?? 'Training'}
                sets={active.sets}
                startedAt={active.workout.started_at}
                exercises={exercises}
                onContinue={() => { unlockAudio(); navigate('/workout') }}
              />
            ) : day ? (
              <NextCard
                day={day}
                date={nextDate}
                isToday={gymToday}
                picked={pickedId != null && day.id !== suggested?.id}
                exercises={exercises}
                last={history.lastByExercise}
                inv={settings.inventory}
                onStart={() => start(day)}
                onPick={() => setChoosing(true)}
              />
            ) : null}
          </div>
          {recent.length > 0 && (
            <RecentCard
              items={recent.map((w) => ({
                id: w.id,
                name: days.find((d) => d.id === w.day_id)?.name ?? 'Training',
                date: isoDate(new Date(w.started_at)),
                minutes: minutesOf(w),
                ...perWorkout(w.id),
              }))}
              total={finished.length}
              today={t}
              className="order-5 xl:order-none"
            />
          )}
        </div>

        <div className="contents xl:col-span-5 xl:flex xl:flex-col xl:gap-5">
          <BulkCard targets={settings.targets} trend={trend} rate={rate} today={t} weighedToday={logs.find((l) => l.date === t)?.weight ?? null}
            onLog={() => openLog()} className="order-3 xl:order-none" />
          <WeekCard plan={plan} perWeek={schedule.gymDays.length} className="order-4 xl:order-none" />
        </div>
      </div>

      <Sheet open={choosing} onClose={() => setChoosing(false)} label="Kies een training" title="Kies een training">
        <div className="-mx-4 flex flex-col divide-y divide-line pb-4">
          {days.map((d) => (
            <Row
              key={d.id}
              label={d.name}
              value={d.id === suggested?.id ? 'volgende' : undefined}
              onClick={() => { setPickedId(d.id); setChoosing(false) }}
            />
          ))}
        </div>
      </Sheet>
    </Page>
  )
}

/** First gym day after `t` (the week plan only covers the current week). */
function nextGymDay(t: string, gymDays: number[]): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(t, i)
    if (gymDays.includes(parseDate(d).getDay())) return d
  }
  return addDays(t, 1)
}

const dayLabel = (d: string) => `${dayShort(d)} ${parseDate(d).getDate()}`

// ---------- today's status (not a gym day, or already trained) ----------

function StatusCard({ p, perWorkout, className = '' }: { p: PlanDay; perWorkout: (id: string) => { sets: number }; className?: string }) {
  const volley = p.volley === 'match' ? 'match' : p.volley === 'training' ? 'volleybaltraining' : null
  return (
    <section aria-label="Vandaag" className={`flex flex-col rounded-3xl bg-s1 px-2 py-1 ${className}`}>
      {p.done.map((w) => (
        <Link key={w.id} to={`/klaar/${w.id}`} className="press flex min-h-14 items-center gap-3 rounded-[14px] px-2 py-2 hover:bg-s2">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink text-bg"><IconCheck size={14} /></span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[16px]">{w.name} gedaan</span>
            <span className="num text-[13px] text-ink-3">{w.minutes} min · {perWorkout(w.id).sets} sets</span>
          </span>
          <IconChevron size={16} className="shrink-0 text-ink-3" />
        </Link>
      ))}
      {(volley || !p.done.length) && (
        <div className={`flex min-h-14 items-center gap-3 px-2 py-2 ${p.done.length ? 'border-t border-line' : ''}`}>
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-ink-2">
            {volley ? <IconVolleyball size={22} /> : <span className="h-1.5 w-1.5 rounded-full bg-line-2" />}
          </span>
          <span className="flex flex-col">
            <span className="text-[16px]">{volley ? `Vandaag ${volley}` : 'Rustdag'}</span>
            {!p.done.length && <span className="text-[13px] text-ink-3">Geen gymtraining gepland</span>}
          </span>
        </div>
      )}
    </section>
  )
}

// ---------- next / active workout ----------

function NextCard({ day, date, isToday, picked, exercises, last, inv, onStart, onPick }: {
  day: ProgramDay; date: string; isToday: boolean; picked: boolean; exercises: Map<string, Exercise>; last: Map<string, WorkoutSet[]>
  inv: Inventory; onStart: () => void; onPick: () => void
}) {
  const main = day.items.filter((i) => i.section === 'main')
  const prep = day.items.filter((i) => i.section === 'prep')
  // Weight and "last time" columns only once there is history for this day's exercises.
  const known = main.some((it) => (last.get(it.exerciseId)?.length ?? 0) > 0)
  const when = picked ? 'Zelf gekozen' : isToday ? 'Training van vandaag' : `Volgende training · ${dayLabel(date)}`
  const th = 'pb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3'
  return (
    <section aria-labelledby="next-day" className="flex h-full flex-col gap-5 rounded-3xl bg-s1 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <h2 id="next-day" className="min-w-0 font-cond text-[44px] font-bold uppercase leading-[0.88] lg:text-[56px]">{day.name}</h2>
          <QuietButton onClick={onPick} className="-mr-2 -mt-1.5 shrink-0 text-[14px]">Andere training</QuietButton>
        </div>
        <p className="num text-[15px] leading-snug text-ink-2">
          {when}
          <span className="block text-[14px] text-ink-3">{[day.subtitle, `${main.length} oefeningen`, `~${estimateMin(day)} min`].filter(Boolean).join(' · ')}</span>
        </p>
      </div>

      <table className="w-full border-collapse text-[15px]">
        <caption className="sr-only">Oefeningen en doelen voor {day.name}</caption>
        <thead>
          <tr className="text-left">
            <th scope="col" className={th}>Oefening</th>
            {known && <th scope="col" className={`${th} pl-3 text-right`}>Kg</th>}
            <th scope="col" className={`${th} pl-3 text-right`}>{known ? 'Doel reps' : 'Doel'}</th>
            {known && <th scope="col" className={`${th} hidden pl-6 text-right lg:table-cell`}>Vorige keer</th>}
          </tr>
        </thead>
        <tbody>
          {prep.length > 0 && (
            <tr className="border-t border-line">
              <td className="py-2.5 pr-3">Warm-up &amp; plyo</td>
              {known && <td />}
              <td className="num py-2.5 pl-3 text-right text-ink-3">{prep.length} oefeningen</td>
              {known && <td className="hidden lg:table-cell" />}
            </tr>
          )}
          {main.map((it, i) => {
            const ex = exercises.get(it.exerciseId)
            if (!ex) return null
            const prev = last.get(ex.id) ?? []
            const goal = target(it, ex, prev, inv)
            return (
              <tr key={`${ex.id}-${i}`} className="border-t border-line">
                <td className="py-2.5 pr-3">{ex.name}</td>
                {known && <td className="num whitespace-nowrap py-2.5 pl-3 text-right">{goal.kg}</td>}
                <td className="num whitespace-nowrap py-2.5 pl-3 text-right text-ink-2">{goal.reps}</td>
                {known && <td className="num hidden whitespace-nowrap py-2.5 pl-6 text-right text-ink-3 lg:table-cell">{previous(prev, ex, goal.weight)}</td>}
              </tr>
            )
          })}
        </tbody>
      </table>

      {isToday || picked ? (
        <PrimaryButton onClick={onStart} className="mt-auto">
          <span>Start</span>
          <IconRight />
        </PrimaryButton>
      ) : (
        <SecondaryButton onClick={onStart} className="mt-auto w-full">Toch vandaag starten</SecondaryButton>
      )}
    </section>
  )
}

function ActiveCard({ name, sets, startedAt, exercises, onContinue }: {
  name: string; sets: WorkoutSet[]; startedAt: string; exercises: Map<string, Exercise>; onContinue: () => void
}) {
  const done = sets.filter((s) => s.done).length
  const time = new Date(startedAt).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })
  // Progress per exercise in workout order; the mobility/plyo block (warm-up sets only) is one row.
  const order: string[] = []
  for (const s of sets) if (!order.includes(s.exercise_id)) order.push(s.exercise_id)
  const own = (id: string) => sets.filter((s) => s.exercise_id === id)
  const prep = order.filter((id) => own(id).every((s) => s.kind === 'warmup'))
  const prepSets = sets.filter((s) => prep.includes(s.exercise_id))
  const rows = [
    ...(prep.length ? [{ id: 'prep', label: 'Warm-up & plyo', done: prepSets.filter((s) => s.done).length, total: prepSets.length }] : []),
    ...order.filter((id) => !prep.includes(id)).map((id) => ({
      id, label: exercises.get(id)?.name ?? 'Oefening', done: own(id).filter((s) => s.done).length, total: own(id).length,
    })),
  ]
  return (
    <section aria-labelledby="active-day" className="flex h-full flex-col gap-5 rounded-3xl bg-s1 p-4 lg:p-6">
      <div className="flex flex-col gap-2">
        <h2 id="active-day" className="font-cond text-[44px] font-bold uppercase leading-[0.88] lg:text-[56px]">{name}</h2>
        <p className="num text-[15px] text-ink-2">Bezig sinds {time} · {done} van {sets.length} sets</p>
      </div>
      <ul className="flex flex-col text-[15px]">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 border-t border-line py-2.5">
            <span className={r.done === r.total ? 'text-ink-3' : ''}>{r.label}</span>
            <span className="num flex shrink-0 items-center gap-1.5 text-ink-2">
              {r.done === r.total && <IconCheck size={14} />}
              {r.done}/{r.total}
            </span>
          </li>
        ))}
      </ul>
      <PrimaryButton onClick={onContinue} className="mt-auto">
        <span>Ga verder</span>
        <IconRight />
      </PrimaryButton>
    </section>
  )
}

/** Today's target per exercise: kg to load and reps per set ("12 · 11"); before the first session the plan's range. */
function target(it: DayItem, ex: Exercise, prev: WorkoutSet[], inv: Inventory): { kg: ReactNode; reps: string; weight: number | null } {
  const tg = nextTarget(it, ex.kind, ex.equipment, prev, inv)
  if (tg.kind === 'fixed') return { kg: '', reps: `${it.sets} sets · ${it.seconds ? `${it.seconds} s` : it.repMax}`, weight: null }
  if (tg.kind === 'first') return { kg: '', reps: `${it.sets} sets · ${it.repMin}–${it.repMax}`, weight: null }
  const w = tg.weight ?? 0
  const load = ex.kind === 'bodyweight'
    ? (w ? `+${kg(w)}` : <span className="sr-only">eigen gewicht</span>)
    : kg(w)
  return {
    kg: tg.kind === 'increase'
      ? <span className="inline-flex items-center gap-1"><IconUp size={13} className="text-ink-2" /><span className="sr-only">zwaarder:</span>{load}</span>
      : load,
    reps: tg.reps.join(' · '),
    weight: w,
  }
}

/** Last session's reps; the weight only when it differs from today's ("20 kg: 12 · 12"). */
function previous(sets: WorkoutSet[], ex: Exercise, today: number | null): string {
  if (!sets.length) return ''
  const reps = sets.map((s) => s.reps ?? 0).join(' · ')
  const ws = sets.map((s) => s.weight ?? 0)
  if (!ws.every((w) => w === ws[0])) return sets.map((s) => `${kg(s.weight)} kg × ${s.reps}`).join(' · ')
  if (ws[0] === (today ?? ws[0]) || (ex.kind === 'bodyweight' && !ws[0])) return reps
  return `${ex.kind === 'bodyweight' ? '+' : ''}${kg(ws[0])} kg: ${reps}`
}

function estimateMin(day: ProgramDay): number {
  const sec = day.items.reduce((s, i) => s + i.sets * (i.restSec + 40), 0)
  return Math.round(sec / 60 / 5) * 5
}

// ---------- bulk ----------

function BulkCard({ targets: tg, trend, rate, today: t, weighedToday, onLog, className = '' }: {
  targets: Targets; trend: TrendPoint[]; rate: Rate | null; today: string; weighedToday: number | null; onLog: () => void; className?: string
}) {
  const now = trend.at(-1)?.trend ?? null
  const cur = now ?? tg.startWeight
  const span = tg.goalWeight - tg.startWeight
  const pct = span > 0 ? Math.min(1, Math.max(0, (cur - tg.startWeight) / span)) : 0
  const elapsed = daysBetween(tg.startDate, t)
  const left = Math.max(0, tg.goalWeight - cur)
  const own = rate && rate.perWeek > 0.05 ? rate.perWeek : null
  const pace = own ?? (tg.weeklyGainMin + tg.weeklyGainMax) / 2
  return (
    <section aria-labelledby="bulk" className={`flex flex-col gap-4 rounded-3xl bg-s1 p-4 lg:p-5 ${className}`}>
      <CardHead title={<span id="bulk">Bulk</span>} aside={elapsed >= 0 ? `week ${Math.floor(elapsed / 7) + 1}` : `start ${shortDate(tg.startDate)}`} />
      <div className="flex items-baseline gap-2">
        <span className="num font-cond text-[40px] font-bold leading-none">{kg(cur, 1)}</span>
        <span className="text-[14px] text-ink-3">kg{now == null ? ' · start' : ''}</span>
        <IconRight size={16} className="mx-1 translate-y-[1px] self-center text-ink-3" />
        <span className="num font-cond text-[26px] font-bold leading-none text-ink-2">{kg(tg.goalWeight, 1)}</span>
        <span className="text-[14px] text-ink-3">kg doel</span>
      </div>
      {trend.length >= 2 && (
        <WeightChart points={trend.filter((p) => daysBetween(p.date, t) <= 92)} targets={tg} height={150} color="var(--color-ink)" label="Gewichtstrend laatste 3 maanden" />
      )}
      <div className="relative h-2 rounded-full bg-s3" role="img" aria-label={`${Math.round(pct * 100)}% van ${kg(tg.startWeight, 1)} naar ${kg(tg.goalWeight, 1)} kg`}>
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink" style={{ width: `${Math.max(pct * 100, 1.5)}%` }} />
      </div>
      <p className="num text-[14px] text-ink-2">
        {left > 0
          ? `Nog ${kg(left, 1)} kg · ~${Math.max(1, Math.round(left / pace))} weken ${own ? `aan je tempo van ${kg(own, 2)}` : `aan ${kg(pace, 2)}`} kg per week`
          : 'Doelgewicht gehaald'}
        {now == null && <span className="block text-ink-3">Weeg je 's ochtends; na twee wegingen zie je je trend.</span>}
      </p>
      <div className="flex items-center justify-between gap-3 border-t border-line pt-3">
        <span className="num text-[14px] text-ink-2">{weighedToday != null ? `Vandaag ${kg(weighedToday, 1)} kg` : 'Vandaag nog niet gewogen'}</span>
        <SecondaryButton onClick={onLog} className="shrink-0">{weighedToday != null ? 'Aanpassen' : 'Gewicht loggen'}</SecondaryButton>
      </div>
    </section>
  )
}

// ---------- week ----------

function WeekCard({ plan, perWeek, className = '' }: { plan: PlanDay[]; perWeek: number; className?: string }) {
  const done = plan.reduce((n, p) => n + p.done.length, 0)
  return (
    <section className={`flex flex-col gap-3 rounded-3xl bg-s1 p-4 lg:p-5 ${className}`}>
      <CardHead title="Deze week" aside={`${done} van ${perWeek} trainingen`} />
      <ol className="-mx-2 flex flex-col">
        {plan.map((p) => <WeekDay key={p.date} p={p} />)}
      </ol>
    </section>
  )
}

function WeekDay({ p }: { p: PlanDay }) {
  const done = p.done[0]
  const volley = p.volley === 'match' ? 'Match' : p.volley === 'training' ? 'Volleybal' : null
  const label = done ? p.done.map((d) => d.name).join(' + ') : p.planned ?? volley ?? (p.skipped ? 'Geen training' : 'Rust')
  const extra = done && volley ? `+ ${volley.toLowerCase()}` : null
  const detail = done ? `${done.minutes} min` : p.planned ? (p.isToday ? 'vandaag' : 'gepland') : null
  const cls = `grid w-full grid-cols-[52px_28px_minmax(0,1fr)_auto] items-center gap-3 rounded-[14px] px-2 py-2 text-left ${p.isToday ? 'bg-s2' : ''}`
  const body = (
    <>
      <span className={`num text-[13px] ${p.isToday ? 'font-semibold text-ink' : 'text-ink-3'}`}>{dayLabel(p.date)}</span>
      <Mark p={p} />
      <span className={`min-w-0 text-[15px] leading-snug ${done ? 'text-ink' : p.planned ? 'text-ink-2' : 'text-ink-3'}`}>
        {label}
        {extra && <span className="text-ink-3"> {extra}</span>}
      </span>
      {detail && <span className="num text-[13px] text-ink-3">{detail}</span>}
    </>
  )
  return (
    <li aria-current={p.isToday ? 'date' : undefined}>
      {done ? (
        <Link to={`/klaar/${done.id}`} className={`press hover:bg-s2 ${cls}`} aria-label={`${label} op ${dayLabel(p.date)}, ${done.minutes} minuten: samenvatting openen`}>
          {body}
        </Link>
      ) : (
        <div className={cls}>{body}</div>
      )}
    </li>
  )
}

function Mark({ p }: { p: PlanDay }) {
  if (p.done.length) {
    return <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink text-bg"><IconCheck size={14} /></span>
  }
  if (p.planned) return <span className="h-7 w-7 rounded-full border-[1.5px] border-line-2" aria-hidden="true" />
  if (p.volley) return <span className="flex h-7 w-7 items-center justify-center text-ink-3"><IconVolleyball size={20} /></span>
  return <span className="flex h-7 w-7 items-center justify-center" aria-hidden="true"><span className="h-1.5 w-1.5 rounded-full bg-line-2" /></span>
}

// ---------- recent ----------

interface RecentItem { id: string; name: string; date: string; minutes: number; sets: number; volume: number }

function RecentCard({ items, total, today: t, className = '' }: { items: RecentItem[]; total: number; today: string; className?: string }) {
  const when = (d: string) => (d === t ? 'vandaag' : d === addDays(t, -1) ? 'gisteren' : `${dayShort(d)} ${shortDate(d)}`)
  return (
    <section className={`flex flex-col gap-2 rounded-3xl bg-s1 p-4 lg:p-5 ${className}`}>
      <CardHead title="Recente trainingen" aside={total > items.length ? `${total} in totaal` : undefined} />
      <ul className="-mx-2 flex flex-col">
        {items.map((r) => (
          <li key={r.id}>
            <Link to={`/klaar/${r.id}`} className="press grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 rounded-[14px] px-2 py-2.5 text-left hover:bg-s2">
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px]">{r.name}</span>
                <span className="num text-[13px] text-ink-3">{when(r.date)} · {r.minutes} min</span>
              </span>
              <span className="flex flex-col items-end">
                <span className="num text-[15px] text-ink-2">{r.sets} sets</span>
                <span className="num text-[13px] text-ink-3">{int(r.volume)} kg volume</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

// ---------- data ----------

function minutesOf(w: Workout): number {
  return w.finished_at ? Math.round((Date.parse(w.finished_at) - Date.parse(w.started_at)) / 60000) : 0
}

/** One pass over all sets: the last session's work sets per exercise, and sets + volume per workout. */
function summarize(sets: WorkoutSet[], finished: Workout[]) {
  const order = new Map(finished.map((w, i) => [w.id, i]))
  const latest = new Map<string, { i: number; sets: WorkoutSet[] }>()
  const perWorkout = new Map<string, { sets: number; volume: number }>()
  for (const s of sets) {
    const i = order.get(s.workout_id)
    if (i == null || !s.done || s.kind !== 'work') continue
    const pw = perWorkout.get(s.workout_id) ?? { sets: 0, volume: 0 }
    pw.sets++
    pw.volume += (s.weight ?? 0) * (s.reps ?? 0)
    perWorkout.set(s.workout_id, pw)
    const cur = latest.get(s.exercise_id)
    if (!cur || i > cur.i) latest.set(s.exercise_id, { i, sets: [s] })
    else if (i === cur.i) cur.sets.push(s)
  }
  const lastByExercise = new Map([...latest].map(([id, v]) => [id, v.sets.sort((a, b) => a.position - b.position)]))
  return { lastByExercise, perWorkout }
}
