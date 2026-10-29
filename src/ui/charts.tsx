import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { Targets } from '../lib/types'
import type { TrendPoint } from '../engine/trend'
import { daysBetween, dayShort, shortDate } from '../lib/dates'
import { kg } from '../lib/format'
import { dateTicks, dayFraction, nearestIndex, niceTicks } from './chartScale'

/** Real pixel width of the chart container, so 12px text stays 12px on a phone. */
export function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(340)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

const FS = 12
const fixed = (v: number, decimals: number) => v.toLocaleString('nl-BE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const dayLabel = (d: string) => `${dayShort(d)} ${shortDate(d)}`

/**
 * Hover with the mouse, drag with a finger, or use the arrow keys: the point closest to the pointer becomes active.
 * A finger keeps the readout after lifting (to read it); tapping elsewhere or scrolling clears it.
 */
function useScrub(xs: number[]) {
  const box = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState<number | null>(null)
  const [fromKeys, setFromKeys] = useState(false)
  const last = xs.length - 1
  const at = (i: number | null) => (i == null || last < 0 ? null : Math.max(0, Math.min(last, i)))

  useEffect(() => {
    if (active == null) return
    const away = (e: globalThis.PointerEvent) => {
      if (!box.current?.contains(e.target as Node)) setActive(null)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [active])

  const pick = (e: PointerEvent) => {
    if (!box.current || last < 0) return
    setFromKeys(false)
    setActive(nearestIndex(xs, e.clientX - box.current.getBoundingClientRect().left))
  }
  const bind = {
    ref: box,
    tabIndex: 0,
    style: { touchAction: 'pan-y' as const },
    onPointerMove: pick,
    onPointerDown: pick,
    onPointerLeave: (e: PointerEvent) => { if (e.pointerType === 'mouse') setActive(null) },
    onPointerCancel: () => setActive(null),
    onFocus: () => setActive((a) => a ?? at(last)),
    onBlur: () => setActive(null),
    onKeyDown: (e: KeyboardEvent) => {
      const step = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      if (step) setActive((a) => at((a ?? last) + step))
      else if (e.key === 'Home') setActive(at(0))
      else if (e.key === 'End') setActive(at(last))
      else if (e.key === 'Escape') return setActive(null)
      else return
      e.preventDefault()
      setFromKeys(true)
    },
  }
  return { active: at(active), fromKeys, bind }
}

/** Readout next to the crosshair, on whichever side has room. Values lead, labels follow. */
function Tooltip({ x, width, top, title, children }: { x: number; width: number; top: number; title: string; children: ReactNode }) {
  const left = x <= width / 2
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute z-10 flex flex-col gap-1 rounded-[10px] border border-line-2 bg-s3 px-2.5 py-2 shadow-[0_8px_24px_rgba(0,0,0,0.5)]"
      style={left ? { left: x + 12, top } : { right: width - x + 12, top }}
    >
      <span className="num whitespace-nowrap text-[12px] font-semibold text-ink-2">{title}</span>
      {children}
    </div>
  )
}

function TipRow({ mark, value, label }: { mark: ReactNode; value: string; label: string }) {
  return (
    <span className="flex items-center gap-2 whitespace-nowrap">
      <span className="flex w-3 shrink-0 justify-center">{mark}</span>
      <span className="num text-[15px] font-semibold text-ink">{value}</span>
      <span className="text-[12px] text-ink-3">{label}</span>
    </span>
  )
}

const LineKey = ({ color }: { color: string }) => <span className="h-0.5 w-3 rounded-full" style={{ background: color }} />
const DotKey = () => <span className="h-1.5 w-1.5 rounded-full bg-ink-3" />
const PrKey = () => <span className="h-2 w-2 rotate-45 bg-pr" />

/** Horizontal gridlines with round values on the left, dates underneath (per day, week or month, as many as fit). */
function Axes({ H, x0, x1, y, yTicks, decimals, from, to, x, padB }: {
  H: number; x0: number; x1: number; y: (v: number) => number; yTicks: number[]; decimals: number
  from: string; to: string; x: (date: string) => number; padB: number
}) {
  const ticks = dateTicks(from, to, x1 - x0)
  return (
    <g aria-hidden="true" fontSize={FS} fill="var(--color-ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {yTicks.map((t) => (
        <g key={t}>
          <line x1={x0} x2={x1} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
          <text x={x0 - 8} y={y(t) + 4} textAnchor="end">{fixed(t, decimals)}</text>
        </g>
      ))}
      {ticks.map((t) => {
        const tx = x(t.date)
        const anchor = tx < x0 + 18 ? 'start' : tx > x1 - 18 ? 'end' : 'middle'
        return <text key={t.date} x={tx} y={H - padB + 17} textAnchor={anchor}>{t.label}</text>
      })}
    </g>
  )
}

/**
 * A measurement over time: dots for what you logged, a smoothed trend line through them, and (for weight)
 * the shaded gain corridor from the start of the bulk. Used for weight and body fat.
 */
export function TrendChart({ points, unit, decimals = 1, corridor, height = 190, label, color = 'var(--color-accent)', rawLabel = 'weging', legend = false }: {
  points: TrendPoint[]; unit: string; decimals?: number; corridor?: Targets; height?: number; label: string; color?: string; rawLabel?: string; legend?: boolean
}) {
  const [ref, W] = useWidth()
  const clip = `clip${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const H = height
  const padL = 40, padR = 10, padT = 12, padB = 26
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB
  const d0 = points[0]?.date ?? ''
  const dl = points[points.length - 1]?.date ?? ''
  const x = (date: string) => x0 + dayFraction(d0, dl, date) * (x1 - x0)
  const xs = points.map((p) => x(p.date))
  const { active, fromKeys, bind } = useScrub(xs)
  if (points.length < 2) return null

  const vals = points.flatMap((p) => [p.trend, p.raw ?? p.trend])
  const pad = Math.max(0.3, (Math.max(...vals) - Math.min(...vals)) * 0.2)
  const lo = Math.min(...vals) - pad
  const hi = Math.max(...vals) + pad
  const y = (v: number) => y0 + (1 - (v - lo) / (hi - lo)) * (y1 - y0)
  const { ticks, decimals: tickDecimals } = niceTicks(lo, hi, 4)

  const band = (date: string) => {
    const wk = daysBetween(corridor!.startDate, date) / 7
    return [corridor!.startWeight + corridor!.weeklyGainMin * wk, corridor!.startWeight + corridor!.weeklyGainMax * wk] as const
  }
  const cStart = corridor && daysBetween(corridor.startDate, d0) >= 0 ? d0 : corridor?.startDate ?? d0
  const showCorridor = !!corridor && daysBetween(cStart, dl) > 3
  const trendPath = points.map((p, i) => `${i ? 'L' : 'M'}${xs[i].toFixed(1)} ${y(p.trend).toFixed(1)}`).join(' ')
  const lp = points[points.length - 1]
  const ap = active != null ? points[active] : null
  const v = (n: number) => `${fixed(n, decimals)} ${unit}`
  const spoken = ap && `${dayLabel(ap.date)}: trend ${v(ap.trend)}${ap.raw != null ? `, ${rawLabel} ${v(ap.raw)}` : ''}`

  return (
    <div ref={ref} className="flex w-full flex-col gap-2">
      <div {...bind} role="group" aria-label={`${label}. Pijltjes links en rechts tonen de waarde per dag.`} className="relative rounded-[8px]">
        <svg role="img" aria-label={label} width={W} height={H} className="block overflow-visible">
          <defs><clipPath id={clip}><rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} /></clipPath></defs>
          <Axes H={H} x0={x0} x1={x1} y={y} yTicks={ticks} decimals={tickDecimals} from={d0} to={dl} x={x} padB={padB} />
          {showCorridor && (() => {
            const [a0, a1] = band(cStart)
            const [b0, b1] = band(dl)
            return <polygon clipPath={`url(#${clip})`} points={`${x(cStart)},${y(a0)} ${x(dl)},${y(b0)} ${x(dl)},${y(b1)} ${x(cStart)},${y(a1)}`} fill={color} fillOpacity="0.12" />
          })()}
          {points.map((p, i) => p.raw != null && <circle key={p.date} cx={xs[i]} cy={y(p.raw)} r={3} fill="var(--color-ink-3)" fillOpacity="0.8" />)}
          <path d={trendPath} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {ap ? (
            <g>
              <line x1={xs[active!]} x2={xs[active!]} y1={y0} y2={y1} stroke="var(--color-ink-3)" />
              {ap.raw != null && <circle cx={xs[active!]} cy={y(ap.raw)} r={4} fill="var(--color-ink-2)" stroke="var(--color-s1)" strokeWidth={2} />}
              <circle cx={xs[active!]} cy={y(ap.trend)} r={5} fill={color} stroke="var(--color-s1)" strokeWidth={2} />
            </g>
          ) : (
            <circle cx={xs[xs.length - 1]} cy={y(lp.trend)} r={4} fill={color} stroke="var(--color-s1)" strokeWidth={2} />
          )}
        </svg>
        {ap && (
          <Tooltip x={xs[active!]} width={W} top={y0} title={dayLabel(ap.date)}>
            <TipRow mark={<LineKey color={color} />} value={v(ap.trend)} label="trend" />
            {ap.raw != null && <TipRow mark={<DotKey />} value={v(ap.raw)} label={rawLabel} />}
          </Tooltip>
        )}
        <span className="sr-only" aria-live="polite">{fromKeys && spoken}</span>
      </div>
      {legend && (
        <div aria-hidden="true" className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-[40px] text-[12px] text-ink-3">
          <span className="flex items-center gap-1.5"><LineKey color={color} />trend</span>
          <span className="flex items-center gap-1.5"><DotKey />{rawLabel}</span>
          {showCorridor && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color, opacity: 0.3 }} />doelzone</span>}
        </div>
      )}
    </div>
  )
}

export interface E1rmPoint {
  date: string
  value: number
  pr: boolean
  best: string
}

/** Estimated 1RM per session on a real time axis; records as cyan diamonds. */
export function E1rmChart({ points, label }: { points: E1rmPoint[]; label: string }) {
  const [ref, W] = useWidth()
  const H = 190
  const padL = 40, padR = 16, padT = 16, padB = 26
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB
  const d0 = points[0]?.date ?? ''
  const dl = points[points.length - 1]?.date ?? ''
  const x = (date: string) => x0 + dayFraction(d0, dl, date) * (x1 - x0)
  const xs = points.map((p) => x(p.date))
  const { active, fromKeys, bind } = useScrub(xs)
  if (points.length === 0) return null

  const vals = points.map((p) => p.value)
  const pad = Math.max(2, (Math.max(...vals) - Math.min(...vals)) * 0.25)
  const lo = Math.min(...vals) - pad
  const hi = Math.max(...vals) + pad
  const y = (v: number) => y0 + (1 - (v - lo) / (hi - lo)) * (y1 - y0)
  const { ticks, decimals } = niceTicks(lo, hi, 4)
  const n = points.length
  const last = points[n - 1]
  const ap = active != null ? points[active] : null
  const spoken = ap && `${dayLabel(ap.date)}: geschat 1RM ${kg(ap.value, 1)} kg, beste set ${ap.best} kg${ap.pr ? ', record' : ''}`

  return (
    <div ref={ref} className="flex w-full flex-col gap-2">
      <div {...bind} role="group" aria-label={`${label}. Pijltjes links en rechts tonen elke sessie.`} className="relative rounded-[8px]">
        <svg role="img" aria-label={label} width={W} height={H} className="block overflow-visible">
          <Axes H={H} x0={x0} x1={x1} y={y} yTicks={ticks} decimals={decimals} from={d0} to={dl} x={x} padB={padB} />
          {ap && <line x1={xs[active!]} x2={xs[active!]} y1={y0} y2={y1} stroke="var(--color-ink-3)" />}
          <polyline points={points.map((p, i) => `${xs[i]},${y(p.value)}`).join(' ')} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => {
            const big = i === active
            return p.pr ? (
              <rect key={i} x={xs[i] - (big ? 7 : 5)} y={y(p.value) - (big ? 7 : 5)} width={big ? 14 : 10} height={big ? 14 : 10}
                transform={`rotate(45 ${xs[i]} ${y(p.value)})`} fill="var(--color-pr)" stroke="var(--color-s1)" strokeWidth={2} />
            ) : (
              <circle key={i} cx={xs[i]} cy={y(p.value)} r={big ? 6 : 4} fill="var(--color-ink)" stroke="var(--color-s1)" strokeWidth={2} />
            )
          })}
          {!ap && (
            <text x={xs[n - 1] - 8} y={y(last.value) - 12} textAnchor="end" fontSize={FS} fill="var(--color-ink-2)" style={{ fontVariantNumeric: 'tabular-nums' }}>{last.best}</text>
          )}
        </svg>
        {ap && (
          <Tooltip x={xs[active!]} width={W} top={y0} title={dayLabel(ap.date)}>
            <TipRow mark={<span className="h-1.5 w-1.5 rounded-full bg-ink" />} value={`${kg(ap.value, 1)} kg`} label="geschat 1RM" />
            <TipRow mark={null} value={`${ap.best.replace(' × ', ' kg × ')}`} label="beste set" />
            {ap.pr && <TipRow mark={<PrKey />} value="PR" label="nieuw record" />}
          </Tooltip>
        )}
        <span className="sr-only" aria-live="polite">{fromKeys && spoken}</span>
      </div>
      {points.some((p) => p.pr) && (
        <div aria-hidden="true" className="flex items-center gap-1.5 pl-[40px] text-[12px] text-ink-3"><PrKey />record</div>
      )}
    </div>
  )
}
