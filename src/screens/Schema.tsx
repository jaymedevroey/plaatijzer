import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Label, PrimaryButton, QuietButton, Sheet } from '../ui/kit'
import { IconBack, IconDown } from '../ui/icons'
import { useDays, useExercises } from '../data/hooks'
import { newId, saveDay, saveExercise } from '../data/repo'
import { duration } from '../lib/format'
import { MUSCLES } from '../engine/volume'
import type { DayItem, Equipment, Exercise, ExerciseKind, Muscle, ProgramDay } from '../lib/types'

export function Schema() {
  const navigate = useNavigate()
  const days = useDays()
  const exercises = useExercises()
  const [openDay, setOpenDay] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ dayId: string; index: number } | null>(null)
  const [adding, setAdding] = useState<ProgramDay | null>(null)
  const wide = useWide()
  if (!days || !exercises) return null

  const update = (day: ProgramDay, items: DayItem[]) => saveDay({ ...day, items })
  const eDay = editing ? days.find((d) => d.id === editing.dayId) : undefined
  const eItem = eDay && editing ? eDay.items[editing.index] : undefined

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4 px-4 safe-top lg:max-w-[1200px] lg:px-10 lg:pt-10">
      <div className="flex items-center gap-3 pt-2">
        <IconButton label="Terug" onClick={() => navigate('/meer')}><IconBack size={20} /></IconButton>
        <h1 className="font-cond text-[32px] font-bold uppercase leading-none">Schema</h1>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start lg:gap-5">
        {days.map((day) => {
          // On a wide screen every day is open: the whole program at a glance.
          const open = wide || openDay === day.id
          return (
            <section key={day.id} className="overflow-hidden rounded-3xl bg-s1">
              <button onClick={() => setOpenDay(open ? null : day.id)} disabled={wide} className="flex w-full items-center justify-between gap-3 p-4 text-left" aria-expanded={open}>
                <span className="flex flex-col gap-0.5">
                  <span className="font-cond text-[24px] font-bold uppercase leading-none">{day.name}</span>
                  <span className="text-[14px] text-ink-3">{day.subtitle}</span>
                </span>
                <IconDown className={`shrink-0 text-ink-3 motion-safe:transition-transform lg:hidden ${open ? 'rotate-180' : ''}`} />
              </button>
              {open && (
                <ul className="flex flex-col divide-y divide-line border-t border-line">
                  {day.items.map((it, i) => {
                    const ex = exercises.get(it.exerciseId)
                    return (
                      <li key={`${it.exerciseId}-${i}`}>
                        <button onClick={() => setEditing({ dayId: day.id, index: i })} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-2 text-left">
                          <span className={`min-w-0 truncate text-[15px] ${it.section === 'prep' ? 'text-ink-3' : ''}`}>{ex?.name ?? 'Onbekend'}</span>
                          <span className="num shrink-0 text-[14px] text-ink-3">
                            {it.sets} × {it.section === 'prep' ? (it.seconds ? `${it.seconds}s` : it.repMax) : `${it.repMin}–${it.repMax}`} · {duration(it.restSec)}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                  <li><QuietButton onClick={() => setAdding(day)} className="px-4">+ Oefening</QuietButton></li>
                </ul>
              )}
            </section>
          )
        })}
      </div>

      <Sheet open={!!eItem} onClose={() => setEditing(null)} label="Oefening aanpassen" title={eItem ? exercises.get(eItem.exerciseId)?.name : ''}>
        {eDay && eItem && editing && (() => {
          const patch = (p: Partial<DayItem>) => update(eDay, eDay.items.map((x, j) => (j === editing.index ? { ...x, ...p } : x)))
          const move = (dir: -1 | 1) => {
            const items = [...eDay.items]
            const j = editing.index + dir
            if (j < 0 || j >= items.length) return
            ;[items[editing.index], items[j]] = [items[j], items[editing.index]]
            void update(eDay, items)
            setEditing({ dayId: eDay.id, index: j })
          }
          return (
            <div className="flex flex-col gap-4 pb-4">
              <div className="-mx-4 flex flex-col divide-y divide-line">
                <Stepper label="Sets" value={eItem.sets} onChange={(v) => patch({ sets: Math.max(1, v) })} />
                {eItem.section === 'main' ? (
                  <>
                    <Stepper label="Reps min" value={eItem.repMin} onChange={(v) => patch({ repMin: Math.max(1, v), repMax: Math.max(v, eItem.repMax) })} />
                    <Stepper label="Reps max" value={eItem.repMax} onChange={(v) => patch({ repMax: Math.max(v, eItem.repMin) })} />
                  </>
                ) : (
                  <Stepper label="Reps" value={eItem.repMax} onChange={(v) => patch({ repMin: Math.max(1, v), repMax: Math.max(1, v) })} />
                )}
                <Stepper label="Rust" value={eItem.restSec} step={15} fmt={duration} onChange={(v) => patch({ restSec: Math.max(15, v) })} />
              </div>
              {eItem.section === 'main' && (
                <details className="rounded-[14px] bg-s2 px-4">
                  <summary className="flex min-h-12 cursor-pointer items-center text-[15px] text-ink-2">Geavanceerd</summary>
                  <div className="-mx-4 flex flex-col divide-y divide-line pb-1">
                    <Stepper label="RIR min" value={eItem.rirMin} onChange={(v) => patch({ rirMin: Math.max(0, v), rirMax: Math.max(v, eItem.rirMax) })} />
                    <Stepper label="RIR max" value={eItem.rirMax} onChange={(v) => patch({ rirMax: Math.max(v, eItem.rirMin) })} />
                  </div>
                </details>
              )}
              <div className="flex flex-wrap gap-1">
                <QuietButton onClick={() => move(-1)} disabled={editing.index === 0}>Omhoog</QuietButton>
                <QuietButton onClick={() => move(1)} disabled={editing.index === eDay.items.length - 1}>Omlaag</QuietButton>
                <QuietButton
                  className="ml-auto"
                  onClick={() => {
                    if (!confirm('Uit deze dag verwijderen?')) return
                    void update(eDay, eDay.items.filter((_, j) => j !== editing.index))
                    setEditing(null)
                  }}
                >
                  Verwijderen
                </QuietButton>
              </div>
            </div>
          )
        })()}
      </Sheet>

      <AddExercise
        day={adding}
        exercises={[...exercises.values()]}
        onClose={() => setAdding(null)}
        onPick={async (exId) => {
          if (!adding) return
          await update(adding, [...adding.items, { exerciseId: exId, sets: 2, repMin: 8, repMax: 12, rirMin: 1, rirMax: 3, restSec: 90, section: 'main' }])
          setAdding(null)
        }}
      />
    </div>
  )
}

function Stepper({ label, value, onChange, step = 1, fmt = String }: { label: string; value: number; onChange: (v: number) => void; step?: number; fmt?: (n: number) => string }) {
  return (
    <div className="flex min-h-14 items-center justify-between gap-3 px-4">
      <span className="text-[16px]">{label}</span>
      <div className="flex items-center gap-2">
        <button aria-label={`${label} min`} onClick={() => onChange(value - step)} className="press h-10 w-10 rounded-[12px] bg-s2 text-[18px]">−</button>
        <span className="num w-12 text-center text-[16px] font-semibold" aria-live="polite">{fmt(value)}</span>
        <button aria-label={`${label} plus`} onClick={() => onChange(value + step)} className="press h-10 w-10 rounded-[12px] bg-s2 text-[18px]">+</button>
      </div>
    </div>
  )
}

function AddExercise({ day, exercises, onClose, onPick }: { day: ProgramDay | null; exercises: Exercise[]; onClose: () => void; onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [kind, setKind] = useState<ExerciseKind>('load')
  const [equipment, setEquipment] = useState<Equipment>('dumbbell')
  const [muscle, setMuscle] = useState<Muscle>('borst')
  const list = exercises.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <Sheet open={!!day} onClose={onClose} label="Oefening toevoegen" title={`Toevoegen aan ${day?.name ?? ''}`}>
      <div className="flex flex-col gap-3 pb-4">
        {!creating ? (
          <>
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Zoek oefening…" aria-label="Zoek oefening" autoComplete="off" enterKeyHint="search"
              className="h-12 rounded-[14px] bg-s2 px-4 text-[16px] outline-none placeholder:text-ink-3" />
            <ul className="-mx-4 flex max-h-[45dvh] flex-col divide-y divide-line overflow-y-auto">
              {list.map((e) => (
                <li key={e.id}><button onClick={() => onPick(e.id)} className="min-h-12 w-full px-4 text-left text-[16px]">{e.name}</button></li>
              ))}
            </ul>
            <QuietButton onClick={() => { setCreating(true); setName(q) }}>+ Nieuwe oefening</QuietButton>
          </>
        ) : (
          <form
            className="flex flex-col gap-3"
            onSubmit={async (e) => {
              e.preventDefault()
              if (!name.trim()) return
              const id = newId()
              await saveExercise({ id, name: name.trim().slice(0, 60), kind, equipment, muscles_primary: kind === 'load' || kind === 'bodyweight' ? [muscle] : [], muscles_secondary: [], updated_at: '', deleted: false })
              setCreating(false)
              onPick(id)
            }}
          >
            <label className="flex flex-col gap-1.5">
              <Label>Naam</Label>
              <input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} className="h-12 rounded-[14px] bg-s2 px-4 text-[16px] outline-none" />
            </label>
            <Select label="Type" value={kind} onChange={(v) => setKind(v as ExerciseKind)} options={[['load', 'Gewicht'], ['bodyweight', 'Lichaamsgewicht'], ['reps', 'Alleen reps'], ['time', 'Tijd']]} />
            <Select label="Materiaal" value={equipment} onChange={(v) => setEquipment(v as Equipment)} options={[['barbell', 'Stang'], ['dumbbell', 'Dumbbells'], ['cable', 'Kabel'], ['bodyweight', 'Lichaamsgewicht'], ['none', 'Geen']]} />
            <Select label="Hoofdspier" value={muscle} onChange={(v) => setMuscle(v as Muscle)} options={MUSCLES.map((m) => [m, m.charAt(0).toUpperCase() + m.slice(1)])} />
            <PrimaryButton type="submit"><span>Toevoegen</span></PrimaryButton>
          </form>
        )}
      </div>
    </Sheet>
  )
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[][] }) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <span className="relative">
        <select value={value} onChange={(e) => onChange(e.target.value)} className="h-12 w-full appearance-none rounded-[14px] bg-s2 px-4 text-[16px] outline-none">
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <IconDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-3" />
      </span>
    </label>
  )
}

/** True from 1024 px: the desktop layout. */
function useWide(): boolean {
  const query = '(min-width: 1024px)'
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const m = window.matchMedia(query)
    const on = () => setWide(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return wide
}
