// Server-side Claude proxy. The Anthropic key lives only in Vercel env vars.
// The dashboard has no login (owner's choice), so requests are only accepted
// from the dashboard's own pages — this stops casual misuse, not a determined attacker.

const ALLOWED_MODELS = new Set([
  'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-1',
  // models the existing Finance / Credit Repair / Real Estate helpers use
  'claude-haiku-4-5-20251001', 'claude-opus-4-8',
])
const MAX_TOKENS = 16000

const OWN_ORIGIN = /^https:\/\/(royannadashboard\.vercel\.app|rlc-business-dashboard-[a-z0-9-]+\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/

function fromDashboard(req) {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1')
  return OWN_ORIGIN.test(origin)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!fromDashboard(req)) return res.status(403).json({ error: 'Not allowed' })

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
