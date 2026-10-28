import { useEffect, useState } from 'react'
import { Sheet } from '../ui/kit'
import { IconBackspace, IconCheck } from '../ui/icons'
import type { Equipment, Inventory } from '../lib/types'
import { nextWeight, platesPerSide, prevWeight } from '../engine/plates'
import { kg } from '../lib/format'
import { tap } from '../lib/sound'
import type { Draft } from './workoutActions'

export type Field = 'weight' | 'reps'

// Plate colours, desaturated so they sit inside the palette.
const PLATE_COLOR: Record<string, string> = {
  '25': '#A85550', '20': '#4E6290', '15': '#A8914F', '10': '#507A60', '5': '#BDBDC2', '2.5': '#8E5A56', '1.25': '#8E8E94', '0.5': '#6B6B70',
}

/**
 * Set entry. One primary action: Afvinken. Reps can be picked from chips around the target,
 * which saves and logs in one tap. RIR is optional and only stored when tapped.
 */
export function Keypad({ open, title, previous, equipment, bodyweight, inv, initial, targetReps, initialField, onSave, onComplete, onClose }: {
  open: boolean
  title: string
  previous: string | null
  equipment: Equipment
  bodyweight: boolean
  inv: Inventory
  initial: Draft
  targetReps: number | null
  initialField: Field
  onSave: (d: Draft) => void
  onComplete: (d: Draft) => void
  onClose: () => void
}) {
  const [d, setD] = useState<Draft>(initial)
  const [field, setField] = useState<Field>(initialField)
  const [buf, setBuf] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setD(initial)
      setField(initialField)
      setBuf(null)
    }
    // Reset only when the sheet opens for a (new) set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const value = d[field]
  const display = buf ?? (value == null ? '–' : field === 'weight' ? kg(value) : String(value))

  function press(key: string) {
    tap()
    let s = buf ?? ''
    if (key === 'back') s = s.slice(0, -1)
    else if (key === ',') {
      if (field !== 'weight' || s.includes(',')) return
      s = (s || '0') + ','
    } else s = (s + key).replace(/^0+(?=\d)/, '')
    if (field === 'reps' && s.length > 2) return
    if (field === 'weight' && s.replace(',', '').length > 5) return
    setBuf(s)
    const n = s === '' ? null : Number(s.replace(',', '.'))
    setD({ ...d, [field]: n != null && Number.isFinite(n) ? n : null })
  }

  function step(dir: 1 | -1) {
    tap()
    setBuf(null)
    if (field === 'weight') {
      const cur = d.weight ?? 0
      setD({ ...d, weight: dir > 0 ? nextWeight(cur, equipment, inv) : prevWeight(cur, equipment, inv) })
    } else setD({ ...d, reps: Math.max(0, (d.reps ?? 0) + dir) })
  }

  function go(f: Field) {
    setField(f)
    setBuf(null)
  }

  // Physical keyboard on desktop: digits, comma/point, Backspace, arrows to step, ←/→ to switch, Enter to log.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (/^[0-9]$/.test(e.key)) press(e.key)
      else if (e.key === ',' || e.key === '.') press(',')
      else if (e.key === 'Backspace') press('back')
      else if (e.key === 'ArrowUp') step(1)
      else if (e.key === 'ArrowDown') step(-1)
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') go(field === 'weight' ? 'reps' : 'weight')
      else if (e.key === 'Enter') onComplete(d)
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const stepLabel = field === 'weight' ? kg(Math.max(0.5, nextWeight(d.weight ?? 0, equipment, inv) - (d.weight ?? 0))) : '1'
  const plates = equipment === 'barbell' && d.weight != null ? platesPerSide(d.weight, inv) : null
  const t = targetReps ?? d.reps ?? 8
  const chips = Array.from({ length: 6 }, (_, i) => t - 3 + i).filter((n) => n > 0)

  return (
    <Sheet open={open} onClose={() => { onSave(d); onClose() }} label={`${title} invoeren`}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-baseline justify-between gap-3 px-1">
          <span className="min-w-0 truncate text-[16px] font-semibold">{title}</span>
          {previous && <span className="num shrink-0 text-[13px] text-ink-3">vorige {previous}</span>}
        </div>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Veld">
          {(['weight', 'reps'] as Field[]).map((f) => (
            <button
              key={f}
              aria-pressed={field === f}
              onClick={() => go(f)}
              className={`press flex flex-col items-center gap-1 rounded-[14px] py-3 ${field === f ? 'bg-s3' : 'bg-s2'}`}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{f === 'weight' ? (bodyweight ? 'Extra kg' : 'Kg') : 'Reps'}</span>
              <span className={`num font-cond font-bold leading-none ${field === f ? 'text-[56px] text-ink' : 'text-[40px] text-ink-2'}`} aria-live="polite">
                {field === f ? display : d[f] == null ? '–' : f === 'weight' ? kg(d[f]) : d[f]}
              </span>
            </button>
          ))}
        </div>

        {field === 'reps' ? (
          <div className="grid grid-cols-6 gap-1.5" role="group" aria-label="Snel reps kiezen en afvinken">
            {chips.map((n) => (
              <button
                key={n}
                onClick={() => onComplete({ ...d, reps: n })}
                aria-label={`${n} reps, afvinken`}
                className={`press num h-12 rounded-[14px] text-[18px] font-semibold ${n === t ? 'bg-ink text-bg' : 'bg-s2 text-ink'}`}
              >
                {n}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button aria-label={`Min ${stepLabel} kilo`} onClick={() => step(-1)} className="press num h-12 w-16 rounded-[14px] bg-s2 text-[15px] font-semibold">−{stepLabel}</button>
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
              {plates ? (
                <>
                  <Barbell plates={plates} />
                  <span className="num truncate text-[12px] text-ink-3">{plates.length ? plates.map((p) => kg(p)).join(' + ') : 'lege stang'}</span>
                </>
              ) : equipment === 'barbell' && d.weight != null ? (
                <span className="text-[12px] text-ink-3">niet laadbaar</span>
              ) : null}
            </div>
            <button aria-label={`Plus ${stepLabel} kilo`} onClick={() => step(1)} className="press num h-12 w-16 rounded-[14px] bg-s2 text-[15px] font-semibold">+{stepLabel}</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-1.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', 'back'].map((k) => (
            <button
              key={k}
              onClick={() => press(k)}
              disabled={k === ',' && field !== 'weight'}
              aria-label={k === 'back' ? 'Wissen' : undefined}
              className="press num flex h-[50px] items-center justify-center rounded-[14px] bg-s2 text-[22px] font-medium disabled:opacity-25"
            >
              {k === 'back' ? <IconBackspace size={24} /> : k}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-[12px] text-ink-3">Reps over (optioneel)</span>
          <div className="grid grid-cols-5 gap-1.5" role="group" aria-label="Reps in reserve">
            {[0, 1, 2, 3, 4].map((n) => (
              <button
                key={n}
                aria-pressed={d.rir === n}
                onClick={() => setD({ ...d, rir: d.rir === n ? null : n })}
                className={`press num h-10 rounded-[14px] text-[15px] font-semibold ${d.rir === n ? 'bg-ink text-bg' : 'bg-s2 text-ink-2'}`}
              >
                {n === 4 ? '4+' : n}
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => onComplete(d)} className="press flex h-14 items-center justify-between rounded-[14px] bg-accent px-5 font-cond text-[20px] font-bold uppercase text-bg">
          <span>Afvinken</span><IconCheck />
        </button>
      </div>
    </Sheet>
  )
}

function Barbell({ plates }: { plates: number[] }) {
  const h = (p: number) => Math.max(12, Math.min(30, 8 + p * 1.1))
  const widths = plates.map((p) => (p >= 10 ? 7 : p >= 5 ? 6 : 4))
  let xr = 72
  let xl = 48
  const right = plates.map((p, i) => { const x = xr; xr += widths[i] + 1.5; return { x, p, w: widths[i] } })
  const left = plates.map((p, i) => { xl -= widths[i] + 1.5; return { x: xl, p, w: widths[i] } })
  return (
    <svg width="120" height="32" viewBox="0 0 120 32" className="shrink-0" role="img" aria-label={`Per kant: ${plates.map((p) => kg(p)).join(', ')} kilo`}>
      <rect x="0" y="14.5" width="120" height="3" rx="1.5" fill="#5A5B60" />
      <rect x="47" y="10" width="3" height="12" rx="1" fill="#8E8E94" />
      <rect x="70" y="10" width="3" height="12" rx="1" fill="#8E8E94" />
      {[...left, ...right].map(({ x, p, w }, i) => (
        <rect key={i} x={x} y={16 - h(p) / 2} width={w} height={h(p)} rx="1.5" fill={PLATE_COLOR[String(p)] ?? '#8E8E94'} />
      ))}
    </svg>
  )
}
