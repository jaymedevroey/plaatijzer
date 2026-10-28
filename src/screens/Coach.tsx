import { useEffect, useRef, useState } from 'react'
import { Card, CardHead, Empty, Meter, Page, PrimaryButton, QuietButton, SecondaryButton } from '../ui/kit'
import { IconCheck, IconPlus, IconSync } from '../ui/icons'
import { useQuickLog } from '../ui/Shell'
import { useAllSets, useCoachReports, useFinishedWorkouts, useLogs, useSettings } from '../data/hooks'
import { db } from '../data/db'
import { coachCards, NEEDS } from '../engine/coach'
import { weeklyRate, weightTrend } from '../engine/trend'
import { dayShort, daysBetween, isoDate, longDate, shortDate, today, weekStart } from '../lib/dates'
import { int, kg, signed } from '../lib/format'
import { nowIso, updateDayItem } from '../data/repo'
import { scheduleSync } from '../data/sync'
import { supabase } from '../data/supabase'
import type { CoachCard, CoachReport, DailyLog, Targets, Workout, WorkoutSet } from '../lib/types'

const PROMPT_VERSION = 'v4'
const reportId = (ws: string) => `00000000-0000-4000-a000-0000${ws.replaceAll('-', '')}`

async function generate(useAi: boolean): Promise<void> {
  const t = today()
  const [logs, workouts, sets, exercises, days, settings] = await Promise.all([
    db.daily_logs.toArray(), db.workouts.toArray(), db.sets.toArray(), db.exercises.toArray(),
    db.program_days.orderBy('position').toArray(), db.settings.toArray(),
  ])
  const targets = settings[0]?.data.targets
  if (!targets) return
  let cards = coachCards({
    today: t, logs, targets,
    workouts: workouts.filter((w) => !w.deleted), sets: sets.filter((s) => !s.deleted),
    exercises: exercises.filter((e) => !e.deleted), days: days.filter((d) => !d.deleted),
  })
  let model: string | null = null
  const explain = cards.filter((c) => c.kind !== 'data')
  if (useAi && navigator.onLine && explain.length) {
    try {
      // Only the computed facts on the cards go out. No raw logs.
      const { data, error } = await supabase.functions.invoke('coach', {
        body: { cards: explain.map(({ id, title, why, evidence, rule, confidence }) => ({ id, title, why, evidence, rule, confidence })) },
      })
      if (!error && data?.explanations) {
        const map = new Map<string, string>((data.explanations as { id: string; why: string }[]).map((e) => [e.id, e.why]))
        cards = cards.map((c) => (map.get(c.id) ? { ...c, why: map.get(c.id)! } : c))
        model = data.model ?? null
      }
    } catch {
      /* AI is optional: keep the rule-based text */
    }
  }
  const ws = weekStart(t)
  const row: CoachReport = {
    id: reportId(ws), week_start: ws, updated_at: nowIso(), deleted: false, dirty: 1,
    payload: { cards, generatedAt: nowIso(), model, promptVersion: PROMPT_VERSION },
  }
  await db.coach_reports.put(row)
  scheduleSync()
}

async function setStatus(report: CoachReport, cardId: string, status: CoachCard['status']) {
  const cards = report.payload.cards.map((c) => (c.id === cardId ? { ...c, status } : c))
  await db.coach_reports.put({ ...report, payload: { ...report.payload, cards }, updated_at: nowIso(), dirty: 1 })
  scheduleSync()
}

async function apply(card: CoachCard, delta?: number) {
  const a = card.action
  if (a?.type !== 'addSets') return // older reports can still hold actions that no longer exist
  const day = await db.program_days.get(a.dayId)
  const idx = day?.items.findIndex((i) => i.exerciseId === a.exerciseId) ?? -1
  if (day && idx >= 0) await updateDayItem(day.id, idx, { sets: day.items[idx].sets + (delta ?? a.delta) })
}

export function Coach() {
  const reports = useCoachReports()
  const settings = useSettings()
  const logs = useLogs()
  const finished = useFinishedWorkouts()
  const sets = useAllSets()
  const openLog = useQuickLog()
  const [busy, setBusy] = useState(false)
  const t = today()
  const latest = reports?.[0]
  // A report from this week written with older texts is redone once, so the copy matches the app.
  const thisWeek = latest?.week_start === weekStart(t) && latest.payload.promptVersion === PROMPT_VERSION
  const auto = useRef(false)

  async function run() {
    setBusy(true)
    try {
      await generate(settings.coachEnabled)
    } finally {
      setBusy(false)
    }
  }

  // The weekly check-in makes itself: no button to find.
  useEffect(() => {
    if (reports && !thisWeek && !auto.current) {
      auto.current = true
      void run()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, thisWeek])

  const cards = latest?.payload.cards ?? []
  const food = cards.find((c) => c.kind === 'food')
  const actions = cards.filter((c) => c.action && c.status === 'open')
  // The live checklist below replaces the stored "not enough data" card.
  const info = cards.filter((c) => c.kind !== 'data' && c.kind !== 'food' && (!c.action || c.status !== 'open'))

  if (!logs || !finished || !sets) return null
  const needs = coachNeeds(logs, finished, t)
  const missing = needs.some((n) => n.have < n.need)

  return (
    <Page
      title="Coach"
      sub={`Check-in voor de week van ${longDate(weekStart(t)).replace(/^\S+ /, '')}`}
      aside={
        <QuietButton onClick={run} disabled={busy} className="-mr-2 shrink-0 text-[14px]">
          <IconSync size={16} />
          {busy ? 'Bezig…' : 'Vernieuwen'}
        </QuietButton>
      }
    >
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12 xl:items-start lg:gap-5">
        <div className="flex flex-col gap-3 xl:col-span-7 lg:gap-5">
          {missing && <NeedsCard needs={needs} targets={settings.targets} perWeek={settings.schedule.gymDays.length} primary={!food && actions.length === 0} onLog={() => openLog()} />}

          {!latest || (busy && !thisWeek) ? (
            <Card><Empty>Check-in wordt gemaakt…</Empty></Card>
          ) : (
            <>
              {food && (
                <Card as="article" className="flex flex-col gap-1">
                  <h2 className="text-[18px] font-semibold">{food.title}</h2>
                  <p className="text-[15px] text-ink-2">{food.why}</p>
                </Card>
              )}

              {actions.map((c) => <ActionCard key={c.id} card={c} report={latest} />)}

              {info.length > 0 && (
                <Card className="flex flex-col gap-3">
                  <CardHead title={food || actions.length ? 'Overige adviezen' : 'Adviezen'} />
                  <ul className="flex flex-col gap-2.5">
                    {info.map((c) => (
                      <li key={c.id} className="flex flex-col gap-0.5">
                        <span className="flex items-center gap-2 text-[16px]">
                          {c.status === 'accepted' && <IconCheck size={14} className="text-ink-3" />}
                          {c.title}
                        </span>
                        {c.status === 'open' && <span className="text-[14px] text-ink-3">{c.why}</span>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {!missing && !food && actions.length === 0 && info.length === 0 && <Card><Empty>Niets aan te passen deze week.</Empty></Card>}
            </>
          )}
        </div>

        <WeekStats className="xl:col-span-5" logs={logs} finished={finished} sets={sets} targets={settings.targets} perWeek={settings.schedule.gymDays.length} today={t} />
      </div>
    </Page>
  )
}

interface Need { id: 'wegen' | 'training'; label: string; have: number; need: number; period: string }

/** Live version of the coach's data thresholds, so you see what is missing and how far you are. */
function coachNeeds(logs: DailyLog[], finished: Workout[], t: string): Need[] {
  const within = (d: string, n: number) => daysBetween(d, t) >= 0 && daysBetween(d, t) < n
  return [
    { id: 'wegen', label: 'Wegingen', have: logs.filter((l) => l.weight != null && within(l.date, 14)).length, need: NEEDS.weighIns14, period: 'laatste 14 dagen' },
    { id: 'training', label: 'Trainingen', have: finished.filter((w) => within(isoDate(new Date(w.started_at)), 7)).length, need: NEEDS.workouts7, period: 'laatste 7 dagen' },
  ]
}

/** Until the rules have enough data: the plan is the advice, and this is what is still missing. */
function NeedsCard({ needs, targets: tg, perWeek, primary, onLog }: { needs: Need[]; targets: Targets; perWeek: number; primary: boolean; onLog: () => void }) {
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <CardHead title="Startadvies: volg je plan" />
        <p className="num text-[15px] text-ink-2">
          Train {perWeek}× per week en kom {kg(tg.weeklyGainMin)}–{kg(tg.weeklyGainMax)} kg per week bij.
        </p>
        <p className="text-[14px] text-ink-3">De coach stuurt bij zodra dit binnen is:</p>
      </div>
      <ul className="flex flex-col gap-3.5">
        {needs.map((n) => {
          const ok = n.have >= n.need
          return (
            <li key={n.id} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3">
                <span className="flex items-center gap-2 text-[15px]">
                  {ok && <IconCheck size={14} className="text-ink-2" />}
                  {n.label}
                  <span className="text-[13px] text-ink-3">{n.period}</span>
                </span>
                <span className="num text-[14px] text-ink-2">{Math.min(n.have, n.need)} van {n.need}</span>
              </span>
              <Meter value={n.have} max={n.need} color={ok ? 'var(--color-ink-3)' : 'var(--color-ink)'} />
            </li>
          )
        })}
      </ul>
      {needs.some((n) => n.id === 'wegen' && n.have < n.need) && (primary ? (
        <PrimaryButton onClick={onLog}><span>Gewicht loggen</span><IconPlus /></PrimaryButton>
      ) : (
        <SecondaryButton onClick={onLog} className="self-start">Gewicht loggen</SecondaryButton>
      ))}
    </Card>
  )
}

/** This week (Monday to today) in numbers, next to the targets. */
function WeekStats({ logs, finished, sets, targets: tg, perWeek, today: t, className = '' }: {
  logs: DailyLog[]; finished: Workout[]; sets: WorkoutSet[]; targets: Targets; perWeek: number; today: string; className?: string
}) {
  const ws = weekStart(t)
  const week = logs.filter((l) => l.date >= ws && l.date <= t)
  const ids = new Set(finished.filter((w) => isoDate(new Date(w.started_at)) >= ws).map((w) => w.id))
  const work = sets.filter((s) => ids.has(s.workout_id) && s.done && s.kind === 'work')
  const weighIns = week.filter((l) => l.weight != null)
  const last = weighIns.at(-1)
  const trend = weightTrend(logs)
  const rate = weeklyRate(trend)
  const rows: { label: string; value: string; sub: string }[] = [
    { label: 'Trainingen', value: `${ids.size}`, sub: `van ${perWeek}` },
    { label: 'Werksets', value: int(work.length), sub: `${int(work.reduce((s, x) => s + (x.weight ?? 0) * (x.reps ?? 0), 0))} kg volume` },
    { label: 'Wegingen', value: `${weighIns.length}`, sub: last?.weight != null ? `laatste ${kg(last.weight, 1)} kg` : 'nog geen deze week' },
    {
      label: 'Gewicht (trend)',
      value: trend.length ? `${kg(trend[trend.length - 1].trend, 1)} kg` : '–',
      sub: rate ? `${signed(rate.perWeek)} kg per week · doel +${kg(tg.weeklyGainMin)}–${kg(tg.weeklyGainMax)} kg` : `doel +${kg(tg.weeklyGainMin)}–${kg(tg.weeklyGainMax)} kg per week`,
    },
  ]
  return (
    <Card className={`flex flex-col gap-2 ${className}`}>
      <CardHead title="Deze week" aside={`ma ${shortDate(ws)} – ${dayShort(t)} ${shortDate(t)}`} />
      <dl className="flex flex-col divide-y divide-line">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 py-3">
            <dt className="text-[15px] text-ink-2">{r.label}</dt>
            <dd className="flex flex-col items-end gap-0.5">
              <span className={`num font-cond text-[22px] font-bold leading-none ${r.value === '–' ? 'text-line-2' : ''}`}>{r.value}</span>
              <span className="num text-right text-[12px] text-ink-3">{r.sub}</span>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  )
}

function ActionCard({ card, report }: { card: CoachCard; report: CoachReport }) {
  const [adjusting, setAdjusting] = useState(false)
  const [delta, setDelta] = useState(card.action?.delta ?? 0)
  const [pending, setPending] = useState(false)

  const accept = async (d?: number) => {
    if (pending) return
    setPending(true)
    await apply(card, d)
    await setStatus(report, card.id, 'accepted')
  }

  return (
    <Card as="article" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-[18px] font-semibold">{card.title}</h2>
        <p className="text-[15px] text-ink-2">{card.why}</p>
        {card.confidence === 'laag' && <span className="text-[13px] text-ink-3">weinig data</span>}
      </div>
      {adjusting ? (
        <div className="flex items-center gap-2">
          <button aria-label="Minder" onClick={() => setDelta(delta - 1)} className="press h-11 w-11 rounded-[14px] bg-s2 text-[18px]">−</button>
          <span className="num flex-1 text-center font-cond text-[24px] font-bold">{delta > 0 ? '+' : ''}{delta} sets</span>
          <button aria-label="Meer" onClick={() => setDelta(delta + 1)} className="press h-11 w-11 rounded-[14px] bg-s2 text-[18px]">+</button>
          <button onClick={() => accept(delta)} disabled={pending} className="press h-11 rounded-[14px] bg-accent px-4 text-[15px] font-semibold text-bg">Opslaan</button>
        </div>
      ) : (
        <>
          <PrimaryButton onClick={() => accept()} disabled={pending}><span>Accepteren</span><IconCheck /></PrimaryButton>
          <div className="flex justify-center gap-2">
            <QuietButton onClick={() => setAdjusting(true)}>Aanpassen</QuietButton>
            <QuietButton onClick={() => setStatus(report, card.id, 'dismissed')}>Negeren</QuietButton>
          </div>
        </>
      )}
    </Card>
  )
}
