import { useEffect, useState } from 'react'
import { Sheet, PrimaryButton } from '../ui/kit'
import { IconBack, IconCheck } from '../ui/icons'
import { addDays, parseDate, today } from '../lib/dates'
import { db } from '../data/db'
import { saveDailyLog } from '../data/repo'
import { useSettings } from '../data/hooks'
import { kg } from '../lib/format'

const DATE_FMT = new Intl.DateTimeFormat('nl-BE', { weekday: 'long', day: 'numeric', month: 'long' })

/** Log your weight (and, optionally, body fat) for a day, today by default. The ± buttons start from your last values. */
export function QuickLog({ open, initialDate, onClose }: { open: boolean; initialDate?: string; onClose: () => void }) {
  const [date, setDate] = useState(today())
  const [weight, setWeight] = useState<number | null>(null)
  const [fat, setFat] = useState<number | null>(null)
  const [last, setLast] = useState<number | null>(null)
  const [lastFat, setLastFat] = useState<number | null>(null)
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
      setWeight(cur && !cur.deleted ? cur.weight : null)
      setFat(cur && !cur.deleted ? cur.body_fat ?? null : null)
      const before = (await db.daily_logs.orderBy('date').toArray()).filter((l) => !l.deleted && l.date < date)
      setLast(before.filter((l) => l.weight != null).at(-1)?.weight ?? null)
      setLastFat(before.filter((l) => l.body_fat != null).at(-1)?.body_fat ?? null)
    })()
  }, [open, date])

  const t = today()
  const dayLabel = date === t ? 'Vandaag' : date === addDays(t, -1) ? 'Gisteren' : DATE_FMT.format(parseDate(date))

  async function onSave() {
    if (saved) return
    setSaved(true)
    await saveDailyLog(date, { weight, body_fat: fat })
    setTimeout(onClose, 350)
  }

  return (
    <Sheet open={open} onClose={onClose} label="Gewicht loggen">
      <div className="flex items-center justify-between pb-2">
        <button aria-label="Vorige dag" onClick={() => setDate(addDays(date, -1))} className="press flex h-11 w-11 items-center justify-center rounded-[14px] text-ink-2">
          <IconBack size={18} />
        </button>
        <h2 className="font-cond text-[24px] font-bold uppercase leading-none">{dayLabel}</h2>
        <button aria-label="Volgende dag" disabled={date === t} onClick={() => setDate(addDays(date, 1))} className="press flex h-11 w-11 rotate-180 items-center justify-center rounded-[14px] text-ink-2 disabled:opacity-0">
          <IconBack size={18} />
        </button>
      </div>

      <Field label="Gewicht" unit="kg" value={weight} onChange={setWeight} placeholder={kg(last ?? startWeight, 1)}
        fmt={(n) => kg(n, 1)} parse={num} step={0.1} start={last ?? startWeight} decimals={1} />
      <Field label="Vet" unit="%" value={fat} onChange={setFat} placeholder={lastFat != null ? kg(lastFat, 1) : '–'}
        fmt={(n) => kg(n, 1)} parse={num} step={0.1} start={lastFat ?? 15} decimals={1} />
      <p className="pb-1 text-[13px] text-ink-3">Weeg je 's ochtends na het opstaan, voor je eet of drinkt. Vetpercentage is optioneel.</p>

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

function Field({ label, unit, value, onChange, placeholder, fmt, parse, step, start, decimals = 0 }: {
  label: string; unit: string; value: number | null; onChange: (n: number | null) => void; placeholder: string
  fmt: (n: number) => string; parse: (s: string) => number | null; step: number; start: number; decimals?: number
}) {
  const [text, setText] = useState<string | null>(null)
  const round = (n: number) => Math.round(n * 10 ** decimals) / 10 ** decimals
  const shown = text ?? (value == null ? '' : fmt(value))
  return (
    <div className="flex min-h-[68px] items-center gap-3">
      <span className="w-20 shrink-0 text-[15px] text-ink-2">{label}</span>
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
            setText(value == null ? '' : fmt(value))
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
        <span className="text-[14px] text-ink-3">{unit}</span>
      </label>
      <div className="flex gap-1.5">
        <button aria-label={`${label} omlaag`} onClick={() => onChange(round((value ?? start) - step))} className="press num h-11 w-11 rounded-[14px] bg-s2 text-[20px]">−</button>
        <button aria-label={`${label} omhoog`} onClick={() => onChange(round((value ?? start) + step))} className="press num h-11 w-11 rounded-[14px] bg-s2 text-[20px]">+</button>
      </div>
    </div>
  )
}
