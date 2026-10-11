// Daily Vercel cron: touches the database so Supabase's free tier doesn't pause it.
const SUPABASE_URL = 'https://ynvlsbmxipmksrgaebnq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_8rczDgNjp2m_tLdc9jrE1Q_xzmWv2fE'

export default async function handler(req, res) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  res.status(r.ok ? 200 : 502).json({ ok: r.ok, status: r.status, at: new Date().toISOString() })
}
