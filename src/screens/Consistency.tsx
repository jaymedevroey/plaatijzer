import { useMemo, useState, type KeyboardEvent } from 'react'
import { CardHead, QuietButton } from '../ui/kit'
import { useWidth } from '../ui/charts'
import { useQuickLog } from '../ui/Shell'
import { buildDays, weekStreaks, type DayStat, type Level, type Metric } from '../engine/consistency'
import { addDays, dayShort, parseDate, weekStart } from '../lib/dates'
import { kg } from '../lib/format'
import type { DailyLog } from '../lib/types'

const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: 'training', label: 'Training', color: 'var(--color-accent)' },
  { key: 'wegen', label: 'Wegen', color: 'var(--color-ink)' },
]
const MIX = [0, 28, 48, 72, 100]
// Empty days one step lighter than the card, so the grid stays visible before there is any data.
const fill = (color: string, level: Level) => (level === 0 ? 'var(--color-s3)' : `color-mix(in srgb, ${color} ${MIX[level]}%, var(--color-s3))`)

const GAP = 3
const LABEL = 26
const MIN_CELL = 11
const MAX_CELL = 18
const MAX_WEEKS = 53
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec']
const ROW_LABEL = ['ma', '', 'wo', '', 'vr', '', '']

const dayLabel = (d: string) => `${dayShort(d)} ${parseDate(d).getDate()} ${MONTHS[parseDate(d).getMonth()]}`

/** GitHub-style grid: one square per day, coloured by training (work sets) or by weigh-ins. */
export function ConsistencyCard({ today: t, logs, workouts, gymDays, preview = false, className = '' }: {
  today: string
  /** Showing made-up example data: no logging from here, and a way back to your own data. */
  preview?: boolean
  logs: DailyLog[]
  workouts: { id: string; date: string; name: string; sets: number }[]
  gymDays: number[]
  className?: string
}) {
  const [ref, width] = useWidth()
  const [metric, setMetric] = useState<Metric>('training')
  const [selected, setSelected] = useState(t)
  const [hover, setHover] = useState<string | null>(null)
  const openLog = useQuickLog()

  // Size from the real width: the whole year on a wide screen, as many weeks as fit on a phone.
  const avail = width - LABEL
  let cell = Math.floor(avail / MAX_WEEKS) - GAP
  let weeks = MAX_WEEKS
  if (cell < MIN_CELL) {
    cell = MIN_CELL
    weeks = Math.max(4, Math.floor((avail + GAP) / (MIN_CELL + GAP)))
  }
  cell = Math.min(cell, MAX_CELL)

  const first = addDays(weekStart(t), -7 * (weeks - 1))
  const days = useMemo(() => buildDays(first, t, { logs, workouts, gymDays }), [first, t, logs, workouts, gymDays])
  const byDate = useMemo(() => new Map(days.map((d) => [d.date, d])), [days])
  const { current, longest } = useMemo(() => weekStreaks(days, t, gymDays.length), [days, t, gymDays.length])
  const trainings = days.reduce((n, d) => n + d.workouts.length, 0)
  const weighIns = days.filter((d) => d.weight != null).length
  const color = METRICS.find((m) => m.key === metric)!.color
  const shown = byDate.get(hover ?? selected) ?? byDate.get(t)!

  // Month label above the first week of each month, skipped when it would collide with the previous one.
  const mondays = Array.from({ length: weeks }, (_, i) => addDays(first, 7 * i))
  let lastLabel = -3
  const monthLabels = mondays.map((m, i) => {
    const month = parseDate(m).getMonth()
    const starts = i === 0 ? parseDate(m).getDate() <= 7 : month !== parseDate(mondays[i - 1]).getMonth()
    if (!starts || i - lastLabel < 3) return ''
    lastLabel = i
    return MONTHS[month]
  })

  function move(e: KeyboardEvent<HTMLButtonElement>, date: string) {
    const step = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 }[e.key]
    if (!step) return
    e.preventDefault()
    let next = addDays(date, step)
    if (next < first) next = first
    if (next > t) next = t
    setSelected(next)
    ref.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus()
  }

  return (
    <section aria-labelledby="consistency" className={`flex flex-col gap-4 rounded-3xl bg-s1 p-4 lg:p-5 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <CardHead title={<span id="consistency">Consistentie</span>} />
          <p className="num text-[13px] text-ink-3">
            {trainings} {trainings === 1 ? 'training' : 'trainingen'} · {current} {current === 1 ? 'week' : 'weken'} op rij {gymDays.length}× getraind · langste {longest} · {weighIns} {weighIns === 1 ? 'weging' : 'wegingen'}
          </p>
          {preview && (
            <p className="text-[13px] text-ink-2">
              Voorbeeld met verzonnen data, niet jouw gegevens.{' '}
              <a href={location.pathname + location.hash} className="font-semibold text-ink underline underline-offset-2">Toon mijn raster</a>
            </p>
          )}
        </div>
        <div role="group" aria-label="Kleur volgens" className="flex rounded-[10px] bg-s2 p-0.5">
          {METRICS.map((m) => (
            <button key={m.key} aria-pressed={metric === m.key} onClick={() => setMetric(m.key)}
              className={`press h-9 rounded-[8px] px-2.5 text-[13px] font-semibold ${metric === m.key ? 'bg-ink text-bg' : 'text-ink-3 hover:text-ink-2'}`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={ref} className="w-full" onMouseLeave={() => setHover(null)}>
        <div
          role="group"
          aria-label={`Dagen van ${dayLabel(first)} tot ${dayLabel(t)}; pijltjestoetsen om te bewegen`}
          style={{
            display: 'grid',
            gridTemplateColumns: `${LABEL - GAP}px repeat(${weeks}, ${cell}px)`,
            gridTemplateRows: `14px repeat(7, ${cell}px)`,
            gap: GAP,
          }}
        >
          <span />
          {monthLabels.map((l, i) => (
            <span key={`m${i}`} aria-hidden="true" className="overflow-visible whitespace-nowrap text-[11px] leading-[14px] text-ink-3">{l}</span>
          ))}
          {ROW_LABEL.map((label, r) => [
            <span key={`r${r}`} aria-hidden="true" className="text-[11px] leading-none text-ink-3" style={{ lineHeight: `${cell}px` }}>{label}</span>,
            ...mondays.map((m) => {
              const date = addDays(m, r)
              const day = byDate.get(date)
              if (!day) return <span key={date} aria-hidden="true" />
              const isSel = date === selected
              return (
                <button
                  key={date}
                  data-date={date}
                  tabIndex={isSel ? 0 : -1}
                  aria-label={`${dayLabel(day.date)}: ${summary(day)}`}
                  aria-pressed={isSel}
                  onClick={() => setSelected(date)}
                  onFocus={() => setSelected(date)}
                  onMouseEnter={() => setHover(date)}
                  onKeyDown={(e) => move(e, date)}
                  className="rounded-[3px] transition-[background-color] duration-200"
                  style={{
                    background: fill(color, day.level[metric]),
                    outline: isSel ? '2px solid var(--color-ink)' : date === t ? '1px solid var(--color-ink-3)' : undefined,
                    outlineOffset: isSel ? 1 : 0,
                  }}
                />
              )
            }),
          ])}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" aria-live="polite">
          <span className="num text-[14px] font-semibold">{dayLabel(shown.date)}</span>
          <span className="num text-[14px] text-ink-2">{summary(shown)}</span>
          {!preview && <QuietButton onClick={() => openLog(shown.date)} className="-ml-2 text-[14px]">Gewicht loggen</QuietButton>}
        </div>
        <div className="flex items-center gap-1.5 text-[12px] text-ink-3" aria-hidden="true">
          {metric === 'wegen' ? (
            <>
              <span className="h-3 w-3 rounded-[3px]" style={{ background: fill(color, 0) }} />
              niet gewogen
              <span className="ml-2 h-3 w-3 rounded-[3px]" style={{ background: fill(color, 4) }} />
              gewogen
            </>
          ) : (
            <>
              minder sets
              {[0, 1, 2, 3, 4].map((l) => (
                <span key={l} className="h-3 w-3 rounded-[3px]" style={{ background: fill(color, l as Level) }} />
              ))}
              meer
            </>
          )}
        </div>
      </div>
    </section>
  )
}

/** "Upper A, 17 sets · 71,4 kg", or what kind of day it was. */
function summary(d: DayStat): string {
  const parts = [...d.workouts.map((w) => `${w.name}, ${w.sets} sets`), d.weight != null ? `${kg(d.weight, 1)} kg` : null].filter(Boolean)
  if (parts.length) return parts.join(' · ')
  return d.gymDay ? 'gymdag, geen training' : 'geen gymdag'
}
