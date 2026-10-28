import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { Link, NavLink, useLocation, useSearchParams } from 'react-router-dom'
import { IconChart, IconCoach, IconGrid, IconMore, IconPlus } from './icons'
import { QuickLog } from '../screens/QuickLog'
import { onSyncStatus } from '../data/sync'

const QuickLogCtx = createContext<(date?: string) => void>(() => {})
export const useQuickLog = () => useContext(QuickLogCtx)

const TABS = [
  { to: '/', label: 'Vandaag', Icon: IconGrid },
  { to: '/progressie', label: 'Progressie', Icon: IconChart },
  { to: '/coach', label: 'Coach', Icon: IconCoach },
  { to: '/meer', label: 'Meer', Icon: IconMore },
]

export function Shell({ children }: { children: ReactNode }) {
  const [logDate, setLogDate] = useState<string | null>(null)
  const [params, setParams] = useSearchParams()
  const loc = useLocation()
  const [sync, setSync] = useState('idle')
  useEffect(() => onSyncStatus(setSync), [])

  useEffect(() => {
    if (params.get('log') === '1') {
      setLogDate('')
      params.delete('log')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const open = (date?: string) => setLogDate(date ?? '')
  // While training the app is fullscreen everywhere; the summary is fullscreen on the phone only.
  const training = loc.pathname.startsWith('/workout') || loc.pathname.startsWith('/rust')
  const fullscreen = training || loc.pathname.startsWith('/klaar')

  return (
    <QuickLogCtx.Provider value={open}>
      <div className="min-h-[100dvh] lg:flex">
        {!training && (
          <nav aria-label="Hoofdnavigatie" className="hidden lg:flex sticky top-0 h-[100dvh] w-[248px] shrink-0 flex-col gap-1 border-r border-[#1F2023] px-5 py-8">
            <Link to="/" translate="no" className="mb-7 px-3 font-cond text-[26px] font-bold uppercase">
              Plaatijzer<span className="text-accent">.</span>
            </Link>
            {TABS.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `press flex items-center gap-3 rounded-[14px] px-3 py-3 text-[15px] font-semibold ${isActive ? 'bg-s1 text-ink [&_svg]:text-accent' : 'text-ink-2 hover:bg-s1'}`
                }
              >
                <Icon size={19} />
                {label}
              </NavLink>
            ))}
            <button onClick={() => open()} className="press mt-4 flex items-center gap-3 rounded-[14px] border border-line-2 px-3 py-3 text-[15px] font-semibold hover:bg-s1">
              <IconPlus size={19} /> Loggen
            </button>
            <span aria-live="polite" className="mt-auto px-3 text-[12px] text-ink-3">{syncLabel(sync)}</span>
          </nav>
        )}

        <main id="main" className={`min-w-0 flex-1 ${fullscreen ? '' : 'pb-36 lg:pb-12'}`}>{children}</main>

        {!fullscreen && (
          <>
          <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-0 z-20 h-28 bg-gradient-to-t from-bg via-bg/90 to-transparent lg:hidden" />
          <nav aria-label="Hoofdnavigatie" className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),12px)] z-30 grid h-16 grid-cols-5 items-center rounded-3xl border border-white/[0.06] bg-[rgba(22,22,25,0.94)] backdrop-blur-xl lg:hidden">
            {TABS.slice(0, 2).map((t) => <Tab key={t.to} {...t} />)}
            <button
              aria-label="Snel loggen"
              onClick={() => open()}
              className="press mx-auto flex h-12 w-12 items-center justify-center rounded-[14px] bg-s3 text-ink ring-1 ring-line-2"
            >
              <IconPlus />
            </button>
            {TABS.slice(2).map((t) => <Tab key={t.to} {...t} />)}
          </nav>
          </>
        )}
      </div>
      <QuickLog open={logDate !== null} initialDate={logDate || undefined} onClose={() => setLogDate(null)} />
    </QuickLogCtx.Provider>
  )
}

function Tab({ to, label, Icon }: (typeof TABS)[number]) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold ${isActive ? 'text-ink [&_svg]:text-accent' : 'text-ink-3'}`
      }
    >
      <Icon />
      {label}
    </NavLink>
  )
}

function syncLabel(s: string) {
  return s === 'syncing' ? 'Synchroniseren…' : s === 'offline' ? 'Offline · wordt later gesynchroniseerd' : s === 'error' ? 'Sync mislukt · probeert opnieuw' : 'Gesynchroniseerd'
}
