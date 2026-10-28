import { useLayoutEffect, useRef, useState } from 'react'
import type { Targets } from '../lib/types'
import type { TrendPoint } from '../engine/trend'
import { daysBetween, shortDate } from '../lib/dates'
import { kg } from '../lib/format'

/** Real pixel width of the chart container, so 12px text stays 12px on a phone. */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
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

/** Weight: faint dots for weigh-ins, accent line for the trend, shaded gain corridor from the start of the bulk. */
export function WeightChart({ points, targets, height = 180, label, color = 'var(--color-accent)' }: { points: TrendPoint[]; targets: Targets; height?: number; label: string; color?: string }) {
  const [ref, W] = useWidth()
  if (points.length < 2) return null
  const H = height
  const padL = 34, padR = 8, padT = 10, padB = 22

  const d0 = points[0].date
  const last = points[points.length - 1].date
  const span = Math.max(1, daysBetween(d0, last))
  const corridor = (date: string) => {
    const d = daysBetween(targets.startDate, date) / 7
    return [targets.startWeight + targets.weeklyGainMin * d, targets.startWeight + targets.weeklyGainMax * d] as const
  }
  const vals = points.flatMap((p) => [p.trend, p.raw ?? p.trend])
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  const pad = Math.max(0.4, (hi - lo) * 0.2)
  lo -= pad
  hi += pad
  const x = (date: string) => padL + (daysBetween(d0, date) / span) * (W - padL - padR)
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)

  const cStart = daysBetween(targets.startDate, d0) >= 0 ? d0 : targets.startDate
  const showCorridor = daysBetween(cStart, last) > 3
  const [c0lo, c0hi] = corridor(cStart)
  const [c1lo, c1hi] = corridor(last)
  const trendPath = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)} ${y(p.trend).toFixed(1)}`).join(' ')
  const ticks = niceTicks(lo, hi, 3)
  const lp = points[points.length - 1]

  return (
    <div ref={ref} className="w-full">
      <svg role="img" aria-label={label} width={W} height={H} className="block overflow-visible">
        <defs><clipPath id="wclip"><rect x={padL} y={padT} width={W - padL - padR} height={H - padT - padB} /></clipPath></defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={FS} fill="var(--color-ink-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{kg(t, 1)}</text>
          </g>
        ))}
        {showCorridor && (
          <polygon
            clipPath="url(#wclip)"
            points={`${x(cStart)},${y(c0lo)} ${x(last)},${y(c1lo)} ${x(last)},${y(c1hi)} ${x(cStart)},${y(c0hi)}`}
            fill={color} fillOpacity="0.12"
          />
        )}
        {points.filter((p) => p.raw != null).map((p) => (
          <circle key={p.date} cx={x(p.date)} cy={y(p.raw!)} r={2.5} fill="var(--color-ink-3)" fillOpacity="0.5" />
        ))}
        <path d={trendPath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(lp.date)} cy={y(lp.trend)} r={4} fill={color} />
        <text x={padL} y={H - 4} fontSize={FS} fill="var(--color-ink-3)">{shortDate(d0)}</text>
        <text x={W - padR} y={H - 4} textAnchor="end" fontSize={FS} fill="var(--color-ink-3)">{shortDate(last)}</text>
      </svg>
    </div>
  )
}

export interface E1rmPoint {
  date: string
  value: number
  pr: boolean
  best: string
}

export function E1rmChart({ points, label }: { points: E1rmPoint[]; label: string }) {
  const [ref, W] = useWidth()
  if (points.length === 0) return null
  const H = 170
  const padL = 34, padR = 14, padT = 14, padB = 22
  const vals = points.map((p) => p.value)
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  const pad = Math.max(2, (hi - lo) * 0.25)
  lo -= pad
  hi += pad
  const n = points.length
  const x = (i: number) => (n === 1 ? (W + padL - padR) / 2 : padL + (i / (n - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB)
  const ticks = niceTicks(lo, hi, 3)
  const last = points[n - 1]
  const lx = x(n - 1)
  const ly = y(last.value)

  return (
    <div ref={ref} className="w-full">
      <svg role="img" aria-label={label} width={W} height={H} className="block overflow-visible">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--color-line)" />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={FS} fill="var(--color-ink-3)">{kg(t, 0)}</text>
          </g>
        ))}
        <polyline points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} fill="none" stroke="var(--color-ink)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) =>
          p.pr ? (
            <rect key={i} x={x(i) - 5} y={y(p.value) - 5} width="10" height="10" transform={`rotate(45 ${x(i)} ${y(p.value)})`} fill="var(--color-pr)" />
          ) : (
            <circle key={i} cx={x(i)} cy={y(p.value)} r="3" fill="var(--color-ink)" />
          ),
        )}
        <text x={lx - 8} y={ly - 10} textAnchor="end" fontSize={FS} fill="var(--color-ink-2)" style={{ fontVariantNumeric: 'tabular-nums' }}>{last.best}</text>
        <text x={padL} y={H - 4} fontSize={FS} fill="var(--color-ink-3)">{shortDate(points[0].date)}</text>
        {n > 1 && <text x={W - padR} y={H - 4} textAnchor="end" fontSize={FS} fill="var(--color-ink-3)">{shortDate(last.date)}</text>}
      </svg>
    </div>
  )
}

function niceTicks(lo: number, hi: number, want: number): number[] {
  const range = hi - lo
  const raw = range / want
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 100) / 100)
  return out
}
