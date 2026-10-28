import { db, getMeta, setMeta, SYNC_TABLES, type SyncTable } from './db'
import { supabase } from './supabase'
import type { SyncRow } from '../lib/types'
import { remoteWins } from './merge'

type Status = 'idle' | 'syncing' | 'offline' | 'error'
let status: Status = 'idle'
const listeners = new Set<(s: Status) => void>()

export function onSyncStatus(fn: (s: Status) => void): () => void {
  listeners.add(fn)
  fn(status)
  return () => listeners.delete(fn)
}
function setStatus(s: Status) {
  status = s
  listeners.forEach((fn) => fn(s))
}

let running: Promise<void> | null = null
let again = false

/** Pull newer rows, then push local changes. Safe to call often; calls are coalesced. */
export function sync(): Promise<void> {
  if (running) {
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      await syncOnce()
    } while (again)
  })().finally(() => {
    running = null
  })
  return running
}

async function syncOnce() {
  if (!navigator.onLine) return setStatus('offline')
  const { data } = await supabase.auth.getSession()
  if (!data.session) return setStatus('idle')
  const uid = data.session.user.id
  setStatus('syncing')
  // Each table on its own: one bad row must not stop the others from syncing.
  let failed = false
  for (const t of SYNC_TABLES) {
    try {
      await pull(t)
      await push(t, uid)
    } catch (e) {
      failed = true
      console.error(`sync ${t} failed`, e)
    }
  }
  setStatus(failed ? (navigator.onLine ? 'error' : 'offline') : 'idle')
}

async function pull(table: SyncTable) {
  const since = await getMeta<string>(`pulled:${table}`, '1970-01-01T00:00:00Z')
  let cursor = since
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('updated_at', cursor)
      .order('updated_at', { ascending: true })
      .limit(1000)
    if (error) throw error
    if (!data?.length) break
    const tbl = db.table(table)
    await db.transaction('rw', tbl, async () => {
      for (const raw of data as (SyncRow & { user_id?: string })[]) {
        const { user_id: _ignored, ...row } = raw
        void _ignored
        const local = (await tbl.get(row.id)) as SyncRow | undefined
        if (remoteWins(row.updated_at, local)) {
          await tbl.put({ ...row, dirty: 0 })
        }
      }
    })
    cursor = (data[data.length - 1] as SyncRow).updated_at
    if (data.length < 1000) break
  }
  if (cursor !== since) await setMeta(`pulled:${table}`, cursor)
}

async function push(table: SyncTable, uid: string) {
  const tbl = db.table(table)
  const rows = (await tbl.where('dirty').equals(1).toArray()) as SyncRow[]
  if (!rows.length) return
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    const payload = chunk.map(({ dirty: _d, ...r }) => {
      void _d
      return { ...r, user_id: uid }
    })
    const { error } = await supabase.from(table).upsert(payload, { onConflict: 'user_id,id' })
    if (error) throw error
    // Clear the flag only if the row wasn't edited again while we were pushing.
    await db.transaction('rw', tbl, async () => {
      for (const r of chunk) {
        const cur = (await tbl.get(r.id)) as SyncRow | undefined
        if (cur && cur.updated_at === r.updated_at) await tbl.update(r.id, { dirty: 0 })
      }
    })
  }
}

let timer: ReturnType<typeof setTimeout> | undefined
/** Debounced sync after a local write. */
export function scheduleSync(delay = 1500) {
  clearTimeout(timer)
  timer = setTimeout(() => void sync(), delay)
}

let loopStarted = false
export function startSyncLoop() {
  void sync()
  if (loopStarted) return
  loopStarted = true
  window.addEventListener('online', () => void sync())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void sync()
  })
  setInterval(() => void sync(), 60_000)
}

/**
 * Local data belongs to one account. If a different account signs in on this device,
 * or the user logs out, wipe IndexedDB and the local timer/PR state.
 */
export async function ensureLocalOwner(userId: string): Promise<void> {
  const owner = (await db.meta.get('owner'))?.value as string | undefined
  if (owner && owner !== userId) await wipeLocal()
  await db.meta.put({ key: 'owner', value: userId })
}

export async function wipeLocal(): Promise<void> {
  db.close()
  await db.delete()
  await db.open()
  for (const k of ['plaatijzer:timer', 'plaatijzer:lastpr']) {
    try { localStorage.removeItem(k) } catch { /* ignore */ }
  }
}

/** Push what's left, then sign out and remove all local data. Returns false if unsynced rows remain. */
export async function logout(force = false): Promise<boolean> {
  await sync().catch(() => {})
  let dirty = 0
  for (const t of SYNC_TABLES) dirty += await db.table(t).where('dirty').equals(1).count()
  if (dirty > 0 && !force) return false
  await supabase.auth.signOut()
  await wipeLocal()
  return true
}
