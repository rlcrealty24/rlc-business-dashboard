// Server-side Claude proxy. The Anthropic key lives only in Vercel env vars.
// The dashboard has no login (owner's choice), so requests are only accepted
// from the dashboard's own pages — this stops casual misuse, not a determined attacker.
import Anthropic from '@anthropic-ai/sdk'

const ALLOWED_MODELS = new Set([
  'claude-opus-5-5', 'claude-sonnet-5-5', 'claude-haiku-5-5', 'claude-fable-5-1',
  // models the existing Finance / Credit Repair / Real Estate helpers use
  'claude-haiku-4-5-20251001', 'claude-opus-4-8',
])
// Server-side refusal fallback ("default" routing) is supported on these
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-sonnet-5-5', 'claude-fable-5-1'])
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])
const MAX_TOKENS = 32000

const OWN_ORIGIN = /^https:\/\/(royannadashboard\.vercel\.app|rlc-business-dashboard-[a-z0-9-]+\.vercel\.app)$|^http:\/\/localhost(:\d+)?$/

function fromDashboard(req) {
  const origin = req.headers.origin || (req.headers.referer || '').replace(/^(https?:\/\/[^/]+).*$/, '$1')
  return OWN_ORIGIN.test(origin)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!fromDashboard(req)) return res.status(403).json({ error: 'Not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'AI is not configured on the server' })

  const { model, max_tokens, messages, system, effort } = req.body || {}
  if (!ALLOWED_MODELS.has(model)) return res.status(400).json({ error: `Model not allowed: ${model}` })
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({ error: 'messages required' })

  const client = new Anthropic({ apiKey, timeout: 280_000, maxRetries: 1 })
  const params = {
    model, messages, max_tokens: Math.min(Number(max_tokens) || 4096, MAX_TOKENS),
    ...(system ? { system } : {}),
    ...(EFFORTS.has(effort) ? { output_config: { effort } } : {}),
  }
  try {
    const msg = FALLBACK_MODELS.has(model)
      // If the model declines, the API retries on a fallback model in the same call
      ? await client.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
      : await client.messages.create(params)
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'Claude declined this request — try rephrasing it.' })
    if (msg.stop_reason === 'max_tokens') return res.status(502).json({ error: 'The AI ran out of room before finishing — try again.' })
    return res.status(200).json(msg)
  } catch (e) {
    const status = e?.status && e.status >= 400 && e.status < 600 ? e.status : 502
    return res.status(status).json({ error: e?.error?.error?.message || e?.message || 'AI request failed' })
  }
}
