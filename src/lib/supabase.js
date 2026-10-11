import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL = 'https://ynvlsbmxipmksrgaebnq.supabase.co'
export const SUPABASE_ANON_KEY = 'sb_publishable_8rczDgNjp2m_tLdc9jrE1Q_xzmWv2fE'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  // '__' prefix keeps the login session out of the dashboard_data cloud sync
  auth: { storageKey: '__dash_auth', persistSession: true, autoRefreshToken: true },
})
