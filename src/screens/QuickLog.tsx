import { useEffect, useState } from 'react'
import { Sheet, PrimaryButton } from '../ui/kit'
import { IconBack, IconCheck } from '../ui/icons'
import { addDays, parseDate, today } from '../lib/dates'
import { db } from '../data/db'
import { saveDailyLog } from '../data/repo'
import { useSettings } from '../data/hooks'
import { kg, sleep as fmtSleep } from '../lib/format'

interface Values {
  weight: number | null
  kcal: number | null
  protein: number | null
  sleep_min: number | null
}
const EMPTY: Values = { weight: null, kcal: null, protein: null, sleep_min: null }
const DATE_FMT = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

export function QuickLog({ open, initialDate, onClose }: { open: boolean; initialDate?: string; onClose: () => void }) {
  const [date, setDate] = useState(today())
  const [v, setV] = useState<Values>(EMPTY)
  const [last, setLast] = useState<Values>(EMPTY)
  const [saved, setSaved] = useState(false)
  const startWeight = useSettings().targets.startWeight

  useEffect(() => {
    if (open) {
      setDate(initialDate ?? today())
      setSaved(false)
    }
  }, [open, initialDate])

  useEffect(() => {
    if (!open) return
    void (async () => {
      const cur = await db.daily_logs.where('date').equals(date).first()
      setV({ weight: cur?.weight ?? null, kcal: cur?.kcal ?? null, protein: cur?.protein ?? null, sleep_min: cur?.sleep_min ?? null })
      const all = (await db.daily_logs.orderBy('date').toArray()).filter((l) => !l.deleted && l.date < date).reverse()
      const pick = <K extends keyof Values>(k: K) => (all.find((l) => l[k] != null)?.[k] ?? null) as Values[K]
      setLast({ weight: pick('weight'), kcal: pick('kcal'), protein: pick('protein'), sleep_min: pick('sleep_min') })
    })()
  }, [open, date])

  const set = (k: keyof Values) => (n: number | null) => setV((p) => ({ ...p, [k]: n }))
  const t = today()
  const dayLabel = date === t ? 'Vandaag' : date === addDays(t, -1) ? 'Gisteren' : DATE_FMT.format(parseDate(date))

  async function onSave() {
    if (saved) return
    setSaved(true)
    await saveDailyLog(date, v)
    setTimeout(onClose, 350)
  }

  return (
    <Sheet open={open} onClose={onClose} label="Loggen">
      <div className="flex items-center justify-between pb-2">
        <button aria-label="Vorige dag" onClick={() => setDate(addDays(date, -1))} className="press flex h-11 w-11 items-center justify-center rounded-[14px] text-ink-2">
          <IconBack size={18} />
        </button>
        <h2 className="font-cond text-[24px] font-bold uppercase leading-none">{dayLabel}</h2>
        <button aria-label="Volgende dag" disabled={date === t} onClick={() => setDate(addDays(date, 1))} className="press flex h-11 w-11 rotate-180 items-center justify-center rounded-[14px] text-ink-2 disabled:opacity-0">
          <IconBack size={18} />
        </button>
      </div>

      <div className="flex flex-col divide-y divide-line">
        <Field label="Gewicht" unit="kg" value={v.weight} onChange={set('weight')} placeholder={kg(last.weight ?? startWeight, 1)}
          fmt={(n) => kg(n, 1)} parse={num} step={0.1} start={last.weight ?? startWeight} decimals={1} />
        <Field label="Kcal" unit="kcal" value={v.kcal} onChange={set('kcal')} placeholder={last.kcal != null ? String(last.kcal) : '–'} fmt={String} parse={num} color="var(--color-kcal)" />
        <Field label="Eiwit" unit="g" value={v.protein} onChange={set('protein')} placeholder={last.protein != null ? String(last.protein) : '–'} fmt={String} parse={num} color="var(--color-protein)" />
        <Field label="Slaap" unit="" value={v.sleep_min} onChange={set('sleep_min')} placeholder={last.sleep_min != null ? fmtSleep(last.sleep_min) : '8u00'}
          fmt={fmtSleep} editFmt={(m) => kg(m / 60, 2)} parse={parseSleep} step={15} start={last.sleep_min ?? 480} color="var(--color-sleep)" />
      </div>

      <div className="pb-2 pt-4">
        <PrimaryButton onClick={onSave} disabled={saved}>
          <span>{saved ? 'Bewaard' : 'Bewaren'}</span>
          <IconCheck />
        </PrimaryButton>
      </div>
    </Sheet>
  )
}

function num(s: string): number | null {
  const t = s.trim().replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

function parseSleep(s: string): number | null {
  const t = s.trim().replace('u', ':').replace('h', ':')
  if (!t) return null
  if (t.includes(':')) {
    const [h, m] = t.split(':').map((x) => Number(x || 0))
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null
  }
  const n = Number(t.replace(',', '.'))
  return Number.isFinite(n) ? Math.round(n * 60) : null
}

function Field({ label, unit, value, onChange, placeholder, fmt, editFmt, parse, step, start, color, decimals = 0 }: {
  label: string; unit: string; value: number | null; onChange: (n: number | null) => void; placeholder: string
  fmt: (n: number) => string; editFmt?: (n: number) => string; parse: (s: string) => number | null
  step?: number; start?: number; color?: string; decimals?: number
}) {
  const [text, setText] = useState<string | null>(null)
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
  const shown = text ?? (value == null ? '' : fmt(value))
  return (
    <div className="flex min-h-[68px] items-center gap-3">
      <span className="flex w-20 shrink-0 items-center gap-2 text-[15px] text-ink-2">
        {color && <span className="h-2 w-2 rounded-full" style={{ background: color }} aria-hidden="true" />}
        {label}
      </span>
      <label className="flex min-w-0 flex-1 items-baseline gap-1.5">
        <span className="sr-only">{label}</span>
        <input
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          value={shown}
          placeholder={placeholder}
          onFocus={(e) => {
            const el = e.target
            setText(value == null ? '' : (editFmt ?? fmt)(value))
            requestAnimationFrame(() => el.select())
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text != null) {
              const n = parse(text)
              onChange(n == null ? null : round(n))
            }
            setText(null)
          }}
          style={{ width: `${Math.max(3, (shown || placeholder).length) + 0.5}ch` }}
          className="num min-w-0 bg-transparent font-cond text-[30px] font-bold leading-tight outline-none placeholder:text-ink-3/60"
        />
        {unit && <span className="text-[14px] text-ink-3">{unit}</span>}
      </label>
      {step != null && start != null && (
        <div className="flex gap-1.5">
          <button aria-label={`${label} omlaag`} onClick={() => onChange(round((value ?? start) - step))} className="press num h-11 w-11 rounded-[14px] bg-s2 text-[20px]">−</button>
          <button aria-label={`${label} omhoog`} onClick={() => onChange(round((value ?? start) + step))} className="press num h-11 w-11 rounded-[14px] bg-s2 text-[20px]">+</button>
        </div>
      )}
    </div>
  )
}
