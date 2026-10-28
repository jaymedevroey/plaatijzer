import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './data/supabase'
import { ensureLocalOwner, sync, startSyncLoop } from './data/sync'
import { ensureSeed } from './data/repo'
import { Shell } from './ui/Shell'
import { Today } from './screens/Today'
import { Workout } from './screens/Workout'
import { Rest } from './screens/Rest'
import { Summary } from './screens/Summary'
import { Progress } from './screens/Progress'
import { Coach } from './screens/Coach'
import { More } from './screens/More'
import { Schema } from './screens/Schema'
import { Login } from './screens/Login'

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [ready, setReady] = useState(false)
  const [demo, setDemo] = useState(false)

  useEffect(() => {
    // Dev-only demo mode for testing screens without an account: http://localhost:5173/plaatijzer/?demo (=start, =leeg)
    if (import.meta.env.DEV && location.search.includes('demo')) {
      void (async () => {
        await ensureSeed()
        const { seedDemo } = await import('./data/demo')
        await seedDemo(new URLSearchParams(location.search).get('demo'))
        setSession(null)
        setReady(true)
        setDemo(true)
      })()
      return
    }
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    let cancelled = false
    void (async () => {
      await ensureLocalOwner(session.user.id)
      // Pull first so a second device doesn't seed over existing data, then seed if still empty.
      await sync().catch(() => {})
      await ensureSeed()
      if (!cancelled) setReady(true)
      startSyncLoop()
    })()
    return () => { cancelled = true }
  }, [session])

  if (!demo) {
    if (session === undefined) return null
    if (!session) return <Login />
    if (!ready) return <div className="min-h-[100dvh]" />
  } else if (!ready) return null

  return (
    <HashRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/rust" element={<Rest />} />
          <Route path="/klaar/:id" element={<Summary />} />
          <Route path="/progressie" element={<Progress />} />
          <Route path="/coach" element={<Coach />} />
          <Route path="/meer" element={<More />} />
          <Route path="/schema" element={<Schema />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Shell>
    </HashRouter>
  )
}
