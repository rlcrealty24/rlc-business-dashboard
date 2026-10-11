// Server-side Claude proxy. The Anthropic key lives only in Vercel env vars;
// callers must be signed in to the dashboard (Supabase session token).
const SUPABASE_URL = 'https://ynvlsbmxipmksrgaebnq.supabase.co'
const SUPABASE_ANON_KEY = 'sb_publishable_8rczDgNjp2m_tLdc9jrE1Q_xzmWv2fE'

const ALLOWED_MODELS = new Set([
  'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1',
  // models the existing Finance / Credit Repair / Real Estate helpers use
  'claude-haiku-4-5-20251001', 'claude-opus-4-8',
])
const MAX_TOKENS = 16000

async function signedIn(req) {
  const auth = req.headers.authorization || ''
  if (!auth.startsWith('Bearer ')) return false
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth },
  })
  return r.ok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!(await signedIn(req))) return res.status(401).json({ error: 'Sign in to use AI features' })

  const key = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!key) return res.status(500).json({ error: 'AI is not configured on the server' })

  const { model, max_tokens, messages, system, temperature } = req.body || {}
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: `Model not allowed: ${model}` })
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' })

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model, messages, max_tokens: Math.min(Number(max_tokens) || 1024, MAX_TOKENS),
      ...(system ? { system } : {}), ...(temperature !== undefined ? { temperature } : {}),
    }),
  })
  const data = await upstream.json().catch(() => ({}))
  if (!upstream.ok) return res.status(upstream.status).json({ error: data?.error?.message || 'AI request failed' })
  return res.status(200).json(data)
}
