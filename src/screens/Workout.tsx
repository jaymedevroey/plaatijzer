import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { IconBack, IconCheck, IconClose, IconDots, IconUp } from '../ui/icons'
import { IconButton, Label, PrimaryButton, QuietButton, SecondaryButton, Sheet } from '../ui/kit'
import { useActiveWorkout, useDays, useExercises, useSettings } from '../data/hooks'
import { addSet, discardWorkout, finishWorkout, removeSet, sessionsFor, updateSet, type Session } from '../data/repo'
import { buildGroups, ghost, previousSet, type Group } from './workoutModel'
import { completeSet, undoSet } from './workoutActions'
import { Keypad, type Field } from './Keypad'
import { timer, useTimer } from '../state/timer'
import { useWakeLock } from '../lib/wakelock'
import { duration, kg } from '../lib/format'
import { unlockAudio } from '../lib/sound'
import type { WorkoutSet } from '../lib/types'

export function Workout() {
  const navigate = useNavigate()
  const active = useActiveWorkout()
  const days = useDays()
  const exercises = useExercises()
  const settings = useSettings()
  const [openId, setOpenId] = useState<string | null>(null)
  const [pad, setPad] = useState<{ setId: string; field: Field } | null>(null)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [why, setWhy] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [flash, setFlash] = useState<{ setId: string; label: string } | null>(null)
  const { state: t, remaining } = useTimer()
  useWakeLock(!!active)

  useEffect(() => {
    if (active === null) navigate('/', { replace: true })
  }, [active, navigate])

  const exIds = useMemo(() => [...new Set(active?.sets.map((s) => s.exercise_id) ?? [])], [active?.sets])
  const history = useLiveQuery(async () => {
    const m = new Map<string, Session[]>()
    for (const id of exIds) m.set(id, await sessionsFor(id, active?.workout.id))
    return m
  }, [exIds.join(','), active?.workout.id])

  const day = days?.find((d) => d.id === active?.workout.day_id)
  const groups = useMemo(
    () => (active && exercises && history ? buildGroups(active.sets, day, exercises, history, settings.inventory) : []),
    [active, day, exercises, history, settings.inventory],
  )

  if (!active || !exercises || !history) return <div className="min-h-[100dvh]" />

  const prep = groups.filter((g) => g.item.section === 'prep')
  const main = groups.filter((g) => g.item.section !== 'prep')
  const prepDone = prep.every((g) => g.done)
  const allDone = groups.every((g) => g.done)
  const current = prepDone ? (main.find((g) => g.exercise.id === openId && !g.done) ?? main.find((g) => !g.done)) : undefined
  const nextAfter = (g: Group | undefined) => (g ? main.slice(main.indexOf(g) + 1).find((x) => !x.done) : undefined)

  async function complete(g: Group, set: WorkoutSet, draft?: Parameters<typeof completeSet>[4]) {
    const isLast = groups.every((x) => x.sets.every((s) => s.id === set.id || s.done))
    const label = await completeSet(g, set, history?.get(g.exercise.id) ?? [], isLast, draft)
    if (label) {
      setFlash({ setId: set.id, label })
      setTimeout(() => setFlash(null), 1800)
    }
  }

  async function completePrep(g: Group) {
    unlockAudio()
    if (g.done) {
      for (const s of g.sets) await undoSet(s)
      return
    }
    for (const s of g.sets.filter((x) => !x.done)) {
      await updateSet(s, { reps: s.reps ?? g.item.repMax, done: true, done_at: new Date().toISOString() })
    }
  }

  async function finish() {
    if (closing) return
    setClosing(true)
    timer.stop()
    await finishWorkout(active!.workout.id)
    navigate(`/klaar/${active!.workout.id}`, { replace: true })
  }

  const padSet = pad ? active.sets.find((s) => s.id === pad.setId) : undefined
  const padGroup = padSet ? groups.find((g) => g.exercise.id === padSet.exercise_id) : undefined
  const menuGroup = groups.find((g) => g.exercise.id === menuFor)
  const whyGroup = groups.find((g) => g.exercise.id === why)

  // Next set for the rest pill.
  const nextSetInfo = (() => {
    const g = current
    if (!g) return null
    const s = g.sets.find((x) => !x.done)
    if (!s) return null
    const gh = ghost(g, s)
    const n = g.sets.filter((x) => x.kind === 'work').indexOf(s) + 1
    return `${s.kind === 'warmup' ? 'Warm-up' : `Set ${n}`} · ${gh.weight != null ? `${kg(gh.weight)} × ` : ''}${gh.reps ?? ''}`
  })()

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-[560px] flex-col gap-4 px-4 pb-36 safe-top">
      <header className="flex items-center justify-between gap-3 pt-1">
        <IconButton label="Terug naar Vandaag" onClick={() => navigate('/')}><IconBack size={20} /></IconButton>
        <div className="flex min-w-0 flex-col items-center">
          <h1 className="truncate font-cond text-[20px] font-bold uppercase leading-none">{day?.name ?? 'Workout'}</h1>
          <Elapsed since={active.workout.started_at} />
        </div>
        <SecondaryButton onClick={() => setFinishing(true)} className="px-3.5">Klaar</SecondaryButton>
      </header>

      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${main.length + (prep.length ? 1 : 0)}, minmax(0, 1fr))` }} aria-hidden="true">
        {prep.length > 0 && <span className={`h-1 rounded-full ${prepDone ? 'bg-ink' : 'bg-ink-3'}`} />}
        {main.map((g) => (
          <span key={g.exercise.id} className={`h-1 rounded-full ${g.done ? 'bg-ink' : g === current ? 'bg-ink-3' : 'bg-line'}`} />
        ))}
      </div>

      {prep.length > 0 && (prepDone ? (
        <CollapsedList groups={[]} prepDone prepCount={prep.length} onOpen={() => {}} next={undefined} />
      ) : (
        <section className="flex flex-col rounded-3xl bg-s1 p-4" aria-label="Warm-up en plyo">
          <h2 className="pb-2 font-cond text-[24px] font-bold leading-none">Warm-up & plyo</h2>
          <ul className="flex flex-col divide-y divide-line">
            {prep.map((g) => (
              <li key={g.exercise.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex min-w-0 flex-col">
                  <span className={`truncate text-[16px] ${g.done ? 'text-ink-3 line-through decoration-ink-3/60' : ''}`}>{g.exercise.name}</span>
                  <span className="num text-[13px] text-ink-3">
                    {g.item.sets} × {g.exercise.kind === 'time' ? `${g.item.seconds ?? 30} s` : g.item.repMax}{g.item.perSide ? ' per kant' : ''}
                  </span>
                </div>
                <CheckButton done={g.done} big={false} onClick={() => completePrep(g)} label={`${g.exercise.name} afvinken`} />
              </li>
            ))}
          </ul>
        </section>
      ))}

      {main.filter((g) => g.done).length > 0 && (
        <CollapsedList groups={main.filter((g) => g.done)} onOpen={(id) => setOpenId(id)} next={undefined} />
      )}

      {current && (
        <ExerciseCard
          key={current.exercise.id}
          g={current}
          flashId={flash?.setId ?? null}
          onComplete={(s) => complete(current, s)}
          onUndo={(s) => undoSet(s)}
          onEdit={(s, field) => setPad({ setId: s.id, field })}
          onMenu={() => setMenuFor(current.exercise.id)}
          onWhy={() => setWhy(current.exercise.id)}
        />
      )}

      {main.filter((g) => !g.done && g !== current).length > 0 && (
        <CollapsedList groups={main.filter((g) => !g.done && g !== current)} onOpen={(id) => setOpenId(id)} next={nextAfter(current)} />
      )}

      {allDone && (
        <PrimaryButton onClick={finish} disabled={closing}>
          <span>Afronden</span><IconCheck />
        </PrimaryButton>
      )}

      <span role="status" className="sr-only">{flash?.label ?? ''}</span>

      {t && <TimerPill remaining={remaining} total={t.durationSec} next={nextSetInfo} onOpen={() => navigate('/rust')} />}

      {padSet && padGroup && (
        <Keypad
          open
          title={`${padSet.kind === 'warmup' ? 'Warm-up' : `Set ${padGroup.sets.filter((s) => s.kind === 'work').indexOf(padSet) + 1}`} · ${padGroup.exercise.name}`}
          previous={(() => { const p = previousSet(padGroup, padSet); return p ? `${kg(p.weight)} × ${p.reps}` : null })()}
          equipment={padGroup.exercise.equipment}
          bodyweight={padGroup.exercise.kind === 'bodyweight'}
          inv={settings.inventory}
          initial={{
            weight: padSet.weight ?? ghost(padGroup, padSet).weight ?? previousSet(padGroup, padSet)?.weight ?? null,
            reps: padSet.reps ?? ghost(padGroup, padSet).reps,
            rir: padSet.rir,
          }}
          targetReps={ghost(padGroup, padSet).reps}
          initialField={pad!.field}
          onSave={(d) => void updateSet(padSet, d)}
          onComplete={(d) => {
            setPad(null)
            void complete(padGroup, padSet, d)
          }}
          onClose={() => setPad(null)}
        />
      )}

      <Sheet open={!!menuGroup} onClose={() => setMenuFor(null)} label="Oefening" title={menuGroup?.exercise.name}>
        {menuGroup && (
          <div className="-mx-4 flex flex-col divide-y divide-line pb-4">
            <MenuItem onClick={() => { void addSet(active.workout.id, menuGroup.exercise.id, 'work'); setMenuFor(null) }}>Set toevoegen</MenuItem>
            <MenuItem onClick={() => { void addSet(active.workout.id, menuGroup.exercise.id, 'warmup'); setMenuFor(null) }}>Warm-up set toevoegen</MenuItem>
            {(() => {
              const last = [...menuGroup.sets].reverse().find((s) => !s.done)
              return last && menuGroup.sets.length > 1 ? (
                <MenuItem onClick={() => { void removeSet(last); setMenuFor(null) }}>Laatste open set verwijderen</MenuItem>
              ) : null
            })()}
            <MenuItem onClick={() => { setWhy(menuGroup.exercise.id); setMenuFor(null) }}>Waarom dit doel?</MenuItem>
          </div>
        )}
      </Sheet>

      <Sheet open={!!whyGroup} onClose={() => setWhy(null)} label="Waarom dit doel" title={whyGroup?.exercise.name}>
        {whyGroup && (
          <div className="flex flex-col gap-3 pb-4 text-[16px] leading-relaxed text-ink-2">
            <p className="text-ink">{whyGroup.target.reason || 'Vast schema voor deze oefening.'}</p>
            {whyGroup.last && (
              <p className="num">Vorige keer: {whyGroup.last.sets.filter((s) => s.kind === 'work').map((s) => `${kg(s.weight)} × ${s.reps}`).join(' · ')}</p>
            )}
            <p className="text-[14px] text-ink-3">
              Haal je alle sets aan de top van {whyGroup.item.repMin}–{whyGroup.item.repMax} reps, dan gaat het gewicht één stap omhoog en begin je weer onderaan. Anders eerst +1 rep.
            </p>
          </div>
        )}
      </Sheet>

      <Sheet open={finishing} onClose={() => setFinishing(false)} label="Workout afronden" title="Workout afronden?">
        <div className="flex flex-col gap-3 pb-4">
          <p className="text-[15px] text-ink-2">
            {active.sets.filter((s) => !s.done).length === 0
              ? 'Alle sets zijn afgevinkt.'
              : `${active.sets.filter((s) => !s.done).length} open sets worden weggelaten.`}
          </p>
          <PrimaryButton onClick={finish} disabled={closing}><span>Afronden</span><IconCheck /></PrimaryButton>
          <div className="grid grid-cols-2 gap-2">
            <SecondaryButton onClick={() => setFinishing(false)}>Verder trainen</SecondaryButton>
            <QuietButton
              className="justify-center"
              onClick={async () => {
                if (!confirm('Deze workout weggooien?')) return
                timer.stop()
                await discardWorkout(active.workout.id)
                navigate('/', { replace: true })
              }}
            >
              Weggooien
            </QuietButton>
          </div>
        </div>
      </Sheet>
    </div>
  )
}

function Elapsed({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(i)
  }, [])
  return <span className="num mt-1 text-[13px] text-ink-3">{duration((now - new Date(since).getTime()) / 1000)}</span>
}

function MenuItem({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return <button onClick={onClick} className="press min-h-14 px-4 text-left text-[16px] hover:bg-s2/60">{children}</button>
}

function ExerciseCard({ g, flashId, onComplete, onUndo, onEdit, onMenu, onWhy }: {
  g: Group
  flashId: string | null
  onComplete: (s: WorkoutSet) => void
  onUndo: (s: WorkoutSet) => void
  onEdit: (s: WorkoutSet, field: Field) => void
  onMenu: () => void
  onWhy: () => void
}) {
  const activeId = g.sets.find((s) => !s.done)?.id
  const showReason = g.target.kind === 'increase' || g.target.kind === 'first' || g.target.bigJump
  const bw = g.exercise.kind === 'bodyweight'
  const fmtW = (w: number | null) => (w == null ? '–' : bw ? (w ? `+${kg(w)}` : 'LG') : kg(w))

  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-s1 p-4" aria-label={g.exercise.name}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="break-words font-cond text-[26px] font-bold leading-[1] [text-wrap:balance]">{g.exercise.name}</h2>
          <span className="num text-[14px] text-ink-3">{g.item.sets} × {g.item.repMin}–{g.item.repMax} · rust {duration(g.item.restSec)}</span>
        </div>
        <IconButton label="Opties voor deze oefening" onClick={onMenu}><IconDots size={20} /></IconButton>
      </div>

      {showReason && (
        <button onClick={onWhy} className="flex items-center gap-1.5 self-start text-left text-[14px] text-ink-2">
          {g.target.kind === 'increase' && <IconUp size={14} className="shrink-0" />}
          {g.target.kind === 'increase' && g.target.weight != null
            ? `${kg(g.target.weight)} kg vandaag${g.target.bigJump ? ' · grote sprong' : ''}`
            : g.target.kind === 'first' ? 'Eerste keer: kies een gewicht' : g.target.reason}
        </button>
      )}

      <ol className="flex flex-col gap-1">
        {g.sets.map((s) => {
          const gh = ghost(g, s)
          const n = g.sets.filter((x) => x.kind === 'work').indexOf(s) + 1
          const tag = s.kind === 'warmup' ? 'W' : String(n)
          const name = s.kind === 'warmup' ? 'Warm-up' : `Set ${n}`
          const w = s.weight ?? gh.weight
          const r = s.reps ?? gh.reps

          if (s.done) {
            return (
              <li key={s.id} className={`flex h-11 items-center gap-3 rounded-[14px] px-3 ${s.id === flashId ? 'anim-pr' : ''}`}>
                <span className="num w-5 text-[13px] text-ink-3">{tag}</span>
                <span className="num flex-1 text-[16px] text-ink-2">{fmtW(s.weight)}{bw && !s.weight ? '' : ' kg'} × {s.reps}{s.rir != null ? <span className="text-ink-3"> · {s.rir} over</span> : null}</span>
                <CheckButton done big={false} onClick={() => onUndo(s)} label={`${name} ongedaan maken`} />
              </li>
            )
          }

          if (s.id === activeId) {
            return (
              <li key={s.id} className="relative flex h-[76px] items-center gap-2 overflow-hidden rounded-[14px] bg-s2 pl-4 pr-2">
                <span className="absolute inset-y-0 left-0 w-[3px] bg-accent" aria-hidden="true" />
                <span className="num w-5 text-[13px] text-ink-3">{tag}</span>
                <button onClick={() => onEdit(s, 'weight')} aria-label={`${name} gewicht: ${w == null ? 'kiezen' : fmtW(w)}`} className="press flex min-w-0 items-baseline gap-1 rounded-[10px] px-2 py-1">
                  <span className={`num font-cond text-[32px] font-bold leading-none ${s.weight == null && w == null ? 'text-ink-3' : ''}`}>{w == null ? 'kies' : fmtW(w)}</span>
                  {w != null && !(bw && !w) && <span className="text-[13px] text-ink-3">kg</span>}
                </button>
                <span className="text-[18px] text-ink-3" aria-hidden="true">×</span>
                <button onClick={() => onEdit(s, 'reps')} aria-label={`${name} reps: ${r ?? 'kiezen'}`} className="press flex items-baseline rounded-[10px] px-2 py-1">
                  <span className="num font-cond text-[32px] font-bold leading-none">{r ?? '–'}</span>
                </button>
                <span className="flex-1" />
                <CheckButton done={false} big onClick={() => (w == null && !bw ? onEdit(s, 'weight') : onComplete(s))} label={`${name} afvinken`} />
              </li>
            )
          }

          return (
            <li key={s.id}>
              <button onClick={() => onEdit(s, 'weight')} className="flex h-11 w-full items-center gap-3 rounded-[14px] px-3 text-left">
                <span className="num w-5 text-[13px] text-ink-3">{tag}</span>
                <span className="num text-[16px] text-ink-3">{w == null ? '–' : `${fmtW(w)}${bw && !w ? '' : ' kg'}`} × {r ?? '–'}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

function CheckButton({ done, big, onClick, label }: { done: boolean; big: boolean; onClick: () => void; label: string }) {
  if (big) {
    return (
      <button aria-label={label} onClick={onClick} className="press flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-accent text-bg hover:bg-accent-hi">
        <IconCheck size={24} />
      </button>
    )
  }
  return (
    <button
      aria-label={label}
      aria-pressed={done}
      onClick={onClick}
      className={`press flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] ${done ? 'text-ink-3' : 'bg-s2 text-ink-2'}`}
    >
      <span className={done ? 'anim-pop' : ''}><IconCheck size={18} /></span>
    </button>
  )
}

function CollapsedList({ groups, onOpen, next, prepDone = false, prepCount = 0 }: {
  groups: Group[]; onOpen: (id: string) => void; next: Group | undefined; prepDone?: boolean; prepCount?: number
}) {
  return (
    <ul className="flex flex-col divide-y divide-line rounded-3xl bg-s1">
      {prepDone && (
        <li className="flex h-12 items-center justify-between px-4 text-[14px] text-ink-3">
          <span>Warm-up & plyo</span>
          <span className="num flex items-center gap-1.5">{prepCount} <IconCheck size={14} /></span>
        </li>
      )}
      {groups.map((g) => {
        const work = g.sets.filter((s) => s.kind === 'work' && s.done)
        const top = work.reduce<number>((m, s) => Math.max(m, s.weight ?? 0), 0)
        return (
          <li key={g.exercise.id}>
            <button onClick={() => onOpen(g.exercise.id)} className="flex h-12 w-full items-center justify-between gap-3 px-4 text-left text-[14px]">
              <span className={`truncate ${g.done ? 'text-ink-3' : 'text-ink-2'}`}>{g.exercise.name}</span>
              <span className="num flex shrink-0 items-center gap-1.5 text-ink-3">
                {g.done ? (
                  <>{work.length} × {top ? kg(top) : 'LG'} <IconCheck size={14} /><span className="sr-only">klaar</span></>
                ) : g === next ? (
                  <Label>volgende</Label>
                ) : null}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function TimerPill({ remaining, total, next, onOpen }: { remaining: number; total: number; next: string | null; onOpen: () => void }) {
  const over = remaining <= 0
  const pct = over ? 1 : Math.max(0, remaining / total)
  const c = 2 * Math.PI * 16
  return (
    <div
      className={`fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),12px)] z-30 mx-auto flex h-16 max-w-[528px] items-center gap-2 rounded-3xl pl-3 pr-2 ${
        over ? 'bg-accent text-bg' : 'border border-white/[0.06] bg-[rgba(22,22,25,0.94)] backdrop-blur-xl'
      }`}
    >
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left" aria-label={`Rustscherm openen, ${over ? 'rust voorbij' : `${duration(remaining)} resterend`}`}>
        {!over && (
          <svg width="38" height="38" viewBox="0 0 38 38" aria-hidden="true" className="shrink-0">
            <circle cx="19" cy="19" r="16" fill="none" stroke="var(--color-line)" strokeWidth="3.5" />
            <circle cx="19" cy="19" r="16" fill="none" stroke="var(--color-accent)" strokeWidth="3.5" strokeLinecap="butt"
              strokeDasharray={`${pct * c} ${c}`} transform="rotate(-90 19 19)" />
          </svg>
        )}
        <span className="num font-cond text-[32px] font-bold leading-none">{over ? 'GO' : duration(remaining)}</span>
        {next && <span className={`num truncate text-[13px] ${over ? 'text-bg/80' : 'text-ink-2'}`}>{next}</span>}
      </button>
      {!over && (
        <button onClick={() => timer.adjust(30)} aria-label="30 seconden meer" className="press num h-11 rounded-[14px] bg-s3 px-3 text-[14px] font-semibold">+30</button>
      )}
      <button onClick={() => timer.stop()} aria-label="Rusttimer sluiten" className={`press flex h-11 w-11 items-center justify-center rounded-[14px] ${over ? 'bg-bg/15' : 'bg-s3'}`}>
        <IconClose size={18} />
      </button>
    </div>
  )
}
