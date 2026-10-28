import { useEffect, useState, type ReactNode } from 'react'
import { Label, Page, Row, Sheet } from '../ui/kit'
import { useDays, useSettings } from '../data/hooks'
import { updateSettings } from '../data/repo'
import { supabase } from '../data/supabase'
import { db } from '../data/db'
import { logout, onSyncStatus } from '../data/sync'
import { kg } from '../lib/format'
import { parseDate } from '../lib/dates'
import type { Inventory, Targets } from '../lib/types'

const ALL_PLATES = [0.5, 1.25, 2.5, 5, 10, 15, 20, 25]
const ALL_DUMBBELLS = Array.from({ length: 25 }, (_, i) => (i + 1) * 2)
const DATE_FMT = new Intl.DateTimeFormat('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' })

export function More() {
  const s = useSettings()
  const days = useDays()
  const [email, setEmail] = useState<string | null>(null)
  const [status, setStatus] = useState('idle')
  const [sheet, setSheet] = useState<'doelen' | 'homegym' | null>(null)
  useEffect(() => onSyncStatus(setStatus), [])
  useEffect(() => { void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null)) }, [])

  const inv = (p: Partial<Inventory>) => updateSettings((d) => ({ ...d, inventory: { ...d.inventory, ...p } }))
  const tgt = (p: Partial<Targets>) => updateSettings((d) => ({ ...d, targets: { ...d.targets, ...p } }))
  const t = s.targets
  const gym = s.inventory
  const span = (xs: number[]) => (xs.length ? `${kg(Math.min(...xs))}–${kg(Math.max(...xs))} kg` : 'geen')
  const doelen = () => setSheet('doelen')
  const homegym = () => setSheet('homegym')

  return (
    <Page title="Meer">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start lg:gap-5">
        <div className="flex flex-col gap-6">
          <Group title="Schema">
            {(days ?? []).map((d) => (
              <Row key={d.id} label={d.name} value={`${d.items.filter((i) => i.section === 'main').length} oefeningen`} to="/schema" />
            ))}
          </Group>
          <Group title="Homegym">
            <Row label="Stang" value={`${kg(gym.barKg)} kg`} onClick={homegym} />
            <Row label="Schijven" value={`${span(gym.plates)} · ${gym.plates.length} maten`} onClick={homegym} />
            <Row label="Dumbbells" value={span(gym.dumbbells)} onClick={homegym} />
            <Row label="Kabel" value={`${kg(gym.cableStep)} kg per stap · max ${kg(gym.cableMax)} kg`} onClick={homegym} />
          </Group>
        </div>

        <div className="flex flex-col gap-6">
          <Group title="Doelen">
            <Row label="Startgewicht" value={`${kg(t.startWeight, 1)} kg`} onClick={doelen} />
            <Row label="Doelgewicht" value={`${kg(t.goalWeight, 1)} kg`} onClick={doelen} />
            <Row label="Tempo" value={`+${kg(t.weeklyGainMin)}–${kg(t.weeklyGainMax)} kg per week`} onClick={doelen} />
          </Group>
          <Group title="Coach">
            <label className="flex min-h-14 items-center justify-between gap-4 px-4 py-2">
              <span className="flex flex-col">
                <span className="text-[16px]">AI-uitleg bij adviezen</span>
                <span className="text-[13px] text-ink-3">Alleen samenvattingen, geen ruwe logs</span>
              </span>
              <Switch checked={s.coachEnabled} onChange={(v) => updateSettings((d) => ({ ...d, coachEnabled: v }))} />
            </label>
          </Group>
          <Group title="Account">
            <div className="flex min-h-14 flex-col justify-center px-4 py-2">
              <span className="truncate text-[16px]">{email ?? 'Niet ingelogd'}</span>
              <span className="text-[13px] text-ink-3">
                {status === 'syncing' ? 'Synchroniseren…' : status === 'offline' ? 'Offline · wordt later gesynchroniseerd' : status === 'error' ? 'Sync mislukt · probeert opnieuw' : 'Gesynchroniseerd'}
              </span>
            </div>
            <Row label="Exporteer naar CSV" chevron={false} onClick={exportCsv} />
            <Row
              label="Uitloggen"
              chevron={false}
              onClick={async () => {
                if (!confirm('Uitloggen? Je data wordt van dit toestel gewist en blijft in je account.')) return
                const ok = await logout()
                if (!ok && confirm('Niet alles is gesynchroniseerd (offline?). Toch uitloggen en die wijzigingen kwijtraken?')) await logout(true)
                location.reload()
              }}
            />
          </Group>
        </div>
      </div>

      <Sheet open={sheet === 'doelen'} onClose={() => setSheet(null)} label="Doelen" title="Doelen">
        <div className="-mx-4 flex flex-col divide-y divide-line pb-4">
          <EditRow label="Doelgewicht" unit="kg" value={t.goalWeight} fmt={(n) => kg(n, 1)} onCommit={(n) => tgt({ goalWeight: n })} />
          <div className="flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="text-[16px]">Tempo per week</span>
            <span className="num flex items-center gap-1 text-[16px] text-ink-2">
              +<InlineNum value={t.weeklyGainMin} fmt={(n) => kg(n, 2)} onCommit={(n) => tgt({ weeklyGainMin: n })} label="Minimum" />
              –<InlineNum value={t.weeklyGainMax} fmt={(n) => kg(n, 2)} onCommit={(n) => tgt({ weeklyGainMax: n })} label="Maximum" />
              kg
            </span>
          </div>
          <EditRow label="Startgewicht" unit="kg" value={t.startWeight} fmt={(n) => kg(n, 1)} onCommit={(n) => tgt({ startWeight: n })} />
          <label className="relative flex min-h-14 items-center justify-between gap-3 px-4">
            <span className="text-[16px]">Start bulk</span>
            <span className="num text-[16px] text-ink-2">{DATE_FMT.format(parseDate(t.startDate))}</span>
            <input type="date" lang="nl-BE" value={t.startDate} onChange={(e) => e.target.value && tgt({ startDate: e.target.value })}
              className="absolute inset-0 opacity-0" aria-label="Start bulk" />
          </label>
        </div>
      </Sheet>

      <Sheet open={sheet === 'homegym'} onClose={() => setSheet(null)} label="Homegym" title="Homegym">
        <div className="flex flex-col gap-5 pb-4">
          <div className="-mx-4 flex flex-col divide-y divide-line">
            <EditRow label="Stang" unit="kg" value={s.inventory.barKg} fmt={(n) => kg(n)} onCommit={(n) => inv({ barKg: n })} />
            <EditRow label="Kabel per stap" unit="kg" value={s.inventory.cableStep} fmt={(n) => kg(n)} onCommit={(n) => inv({ cableStep: Math.max(0.5, n) })} />
            <EditRow label="Kabel max" unit="kg" value={s.inventory.cableMax} fmt={(n) => kg(n)} onCommit={(n) => inv({ cableMax: n })} />
          </div>
          <Chips title="Schijven (paren)" all={ALL_PLATES} have={s.inventory.plates} onChange={(plates) => inv({ plates })} />
          <Chips title="Dumbbells" all={ALL_DUMBBELLS} have={s.inventory.dumbbells} onChange={(dumbbells) => inv({ dumbbells })} />
        </div>
      </Sheet>
    </Page>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-4 text-[14px] font-semibold text-ink-2">{title}</h2>
      <div className="flex flex-col divide-y divide-line overflow-hidden rounded-3xl bg-s1">{children}</div>
    </section>
  )
}

const parseNum = (s: string) => {
  const n = Number(s.trim().replace(',', '.'))
  return s.trim() && Number.isFinite(n) ? n : null
}

function EditRow({ label, unit, value, fmt, onCommit }: {
  label: string; unit?: string; value: number; fmt: (n: number) => string; onCommit: (n: number) => void
}) {
  return (
    <label className="flex min-h-14 items-center justify-between gap-3 px-4">
      <span className="text-[16px]">{label}</span>
      <span className="num flex items-baseline gap-1 text-[16px] text-ink-2">
        <InlineNum value={value} fmt={fmt} onCommit={onCommit} label={label} />
        {unit}
      </span>
    </label>
  )
}

function InlineNum({ value, fmt, onCommit, label }: {
  value: number; fmt: (n: number) => string; onCommit: (n: number) => void; label: string
}) {
  const [text, setText] = useState<string | null>(null)
  const shown = text ?? fmt(value)
  return (
    <input
      aria-label={label}
      inputMode="decimal"
      autoComplete="off"
      value={shown}
      onFocus={(e) => { const el = e.target; setText(fmt(value)); requestAnimationFrame(() => el.select()) }}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text != null) {
          const n = parseNum(text)
          if (n != null) onCommit(n)
        }
        setText(null)
      }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      style={{ width: `${Math.max(2, shown.length) + 0.5}ch` }}
      className="num rounded-[8px] bg-transparent text-right text-[16px] text-ink outline-none focus:bg-s2"
    />
  )
}

function Chips({ title, all, have, onChange }: { title: string; all: number[]; have: number[]; onChange: (v: number[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <Label>{title}</Label>
      <div className="flex flex-wrap gap-1.5">
        {all.map((p) => {
          const on = have.includes(p)
          return (
            <button key={p} aria-pressed={on}
              onClick={() => onChange(on ? have.filter((x) => x !== p) : [...have, p].sort((a, b) => a - b))}
              className={`press num h-10 min-w-11 rounded-[10px] px-2.5 text-[14px] font-semibold ${on ? 'bg-ink text-bg' : 'bg-s2 text-ink-3'}`}>
              {kg(p)}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer absolute inset-0 z-10 cursor-pointer opacity-0" />
      <span className={`h-7 w-12 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-s3'}`} aria-hidden="true" />
      <span className={`absolute top-0.5 h-6 w-6 rounded-full transition-transform ${checked ? 'translate-x-[22px] bg-bg' : 'translate-x-0.5 bg-ink-3'}`} aria-hidden="true" />
    </span>
  )
}

async function exportCsv() {
  const [sets, workouts, exercises, logs] = await Promise.all([db.sets.toArray(), db.workouts.toArray(), db.exercises.toArray(), db.daily_logs.toArray()])
  const w = new Map(workouts.map((x) => [x.id, x]))
  const e = new Map(exercises.map((x) => [x.id, x]))
  const rows = [['datum', 'oefening', 'type', 'gewicht', 'reps', 'rir']]
  for (const s of sets.filter((x) => x.done && !x.deleted).sort((a, b) => (a.done_at ?? '').localeCompare(b.done_at ?? ''))) {
    const wo = w.get(s.workout_id)
    if (!wo || wo.deleted) continue
    rows.push([wo.started_at.slice(0, 10), e.get(s.exercise_id)?.name ?? '', s.kind, String(s.weight ?? ''), String(s.reps ?? ''), String(s.rir ?? '')])
  }
  rows.push([], ['datum', 'gewicht'])
  for (const l of logs.filter((x) => !x.deleted && x.weight != null).sort((a, b) => a.date.localeCompare(b.date))) {
    rows.push([l.date, String(l.weight)])
  }
  // Neutralise spreadsheet formulas in text cells, then quote where needed.
  const cell = (c: string) => {
    const safe = /^[=+\-@\t\r]/.test(c) && Number.isNaN(Number(c)) ? `'${c}` : c
    return /[",;\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe
  }
  const csv = rows.map((r) => r.map(cell).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `plaatijzer-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
