import { createClient } from '@supabase/supabase-js'

// Publishable values: safe in client code. Data is protected by row-level security per user.
const URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://wmdumxnjqmtdseswgddx.supabase.co'
const KEY = import.meta.env.VITE_SUPABASE_KEY ?? 'sb_publishable_dVbbD-RkDiC8ncV0A3EuwQ_XsyvYwKt'

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
})
