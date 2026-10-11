// ─── AI content strategist (Phase 2) ─────────────────────────────────────────
// Drafts only — everything comes back for review; nothing is applied or published automatically.
import { aiCreate } from '../utils/anthropic.js'
import { BRANDS, FORMATS } from './constants.js'
import { addDays, todayISO, weekStart } from '../ceo/recurrence.js'

const MODEL = 'claude-opus-5-5'
const EFFORT = 'medium'   // enough depth for strategy, fast enough to answer in well under a minute

const VOICES = `BRAND VOICES — write each piece in the voice of the account it posts on:
- personal (@royannacarbajal, Royanna Carbajal): confident, natural, sophisticated, human. First person. Lifestyle, motherhood, Miami + Colorado life, travel, entrepreneurship, founder/broker life, real lessons. Aspirational but never showy. Real estate appears naturally as part of her life — this account is NOT an ad feed.
- rlc (@rlcrealtyco, RLC Realty Co.): modern, professional, established, polished. A growing brokerage in Florida and Colorado. Feature agents, their deals and growth — the brand must not read as being only about Royanna. "We" voice.
- leasing (@rlcrealtycoleasing, RLC Leasing): engaging, informative, lead-focused. Apartments in Miami and Denver: tours, specials, neighborhoods, rental education. Clear next step for renters.`

const STYLE = `STYLE RULES:
- Sound like a real person who closes deals, not a marketing template. Short sentences. Specific details over adjectives.
- Never use: "dream home", "look no further", "unlock", "elevate", "nestled", "game-changer", "in today's market", "let's dive in", "you won't believe", "boss babe", "hustle", "luxury living at its finest".
- Emojis: zero or one per caption, never a row of them. No hashtag walls — 3 to 6 relevant hashtags.
- Hooks must differ in angle (e.g. story, contrarian, specific number/result) — not three rewrites of one line.
- Confidentiality: never include client names, exact prices, addresses or lender details unless the notes say permission was given. Flag anything that needs permission or verification.
- Rental pricing, specials and availability must be marked "verify before posting".`

const FORMAT_KEYS = Object.entries(FORMATS).map(([k, v]) => `${k} (${v.label})`).join(', ')

function parseJSON(text) {
  const start = text.indexOf('{'), end = text.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('The AI reply was not in the expected format — try again.')
  return JSON.parse(text.slice(start, end + 1))
}

async function ask(system, user, maxTokens) {
  const msg = await aiCreate({ model: MODEL, effort: EFFORT, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  try { return parseJSON(text) } catch {
    // One retry asking for clean JSON
    const again = await aiCreate({
      model: MODEL, effort: EFFORT, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }, { role: 'assistant', content: text }, { role: 'user', content: 'Return only the JSON object, nothing else.' }],
    })
    return parseJSON((again.content || []).map(b => b.text || '').join(''))
  }
}

/** Full content plan for one post */
export async function developPost(item, extra = '') {
  const system = `You are the content strategist and scriptwriter for Royanna Carbajal — broker/owner of RLC Realty Co. (Florida + Colorado), building her personal brand, managing agents and growing RLC Leasing. She posts rarely and intentionally: quality over volume. She IS the managing broker — never tell her to check with a broker; compliance notes should say what to verify, not who to ask.

${VOICES}

${STYLE}

Return ONLY a JSON object with exactly these keys:
{
  "purpose": "the strategic purpose in 1–2 sentences",
  "recommendation": { "brand": "personal|rlc|leasing", "platforms": ["instagram","tiktok","facebook","youtube","linkedin"], "format": "<one of: ${Object.keys(FORMATS).join('|')}>", "why": "one sentence — including whether a Reel, carousel, testimonial or story fits best" },
  "hooks": ["three opening hooks, each a different angle"],
  "script": "complete natural-sounding script (or slide-by-slide copy for carousels); use line breaks",
  "shot_list": ["specific shots to film, in order"],
  "broll": ["B-roll ideas"],
  "editing": "editing and pacing instructions",
  "on_screen_text": ["on-screen text lines in order"],
  "cover": "cover / thumbnail concept",
  "captions": ["two or three caption options in the brand voice"],
  "ctas": ["two or three CTA options"],
  "hashtags": ["3–6 hashtags"],
  "checklist": ["production checklist items specific to this post"],
  "repurpose": [{ "brand": "personal|rlc|leasing", "format": "<format>", "idea": "how to reuse it" }],
  "cautions": ["permissions, verification or confidentiality flags — empty if none"]
}
Formats available: ${FORMAT_KEYS}.`

  const context = {
    title: item.title, brand: item.brand, brand_handle: BRANDS[item.brand]?.handle,
    format: item.format, platforms: item.platforms, pillar: item.pillar, objective: item.objective,
    agent: item.agent_name, collab_with: item.collab_with, notes: item.notes,
    existing: { hook: item.hook, script: item.script, caption: item.caption },
    permission_confirmed: item.permission_confirmed,
  }
  return ask(system, `Develop this post.\n\n${JSON.stringify(context, null, 2)}${extra ? `\n\nMore context from Royanna:\n${extra}` : ''}`, 16000)
}

/** Suggested ~30-day plan from the idea bank. Returns { summary, posts[], held_back[] } — nothing is applied. */
export async function planMonth({ items, campaigns, slots, perWeek, lowCapacity, days = 30 }) {
  const today = todayISO()
  const end = addDays(today, days)
  const ideas = items.filter(i => !i.archived && i.stage === 'idea' && !(i.campaign_id && campaigns.find(c => c.id === i.campaign_id)?.status === 'proposed'))
  const scheduled = items.filter(i => !i.archived && i.publish_date && i.publish_date >= today && i.publish_date <= end && i.stage !== 'idea')
  const system = `You plan Royanna Carbajal's social media calendar. She is restarting after months away and wants a minimal, premium presence — never filler, never posting just because a day is empty.

${VOICES}

PLANNING RULES:
- Weekly maximums (Sunday–Saturday weeks): personal ${perWeek.personal}, rlc ${perWeek.rlc}, leasing ${perWeek.leasing}. These are ceilings, not quotas — leaving a week lighter is fine.${lowCapacity ? '\n- LOW-CAPACITY MODE: at most one heavy-effort post in any week, prefer light formats, and never more than 3 posts total in a week.' : ''}
- Prioritize: the comeback/backlog story, major announcements, agent visibility (RLC must not be only about Royanna), and lead generation. Older backlog content is still valuable but not urgent.
- Production: filming happens on these days: ${slots.film.filter(d => d >= today && d <= end).join(', ') || 'Tuesdays'}; editing on ${slots.edit.filter(d => d >= today && d <= end).join(', ') || 'Wednesdays'}. Heavy posts need a filming day at least 5 days before publishing; medium 3; light 2. The first publish date should be at least 3 days from today unless light.
- Sequence sensibly (e.g. the personal comeback before the business-results post; website reveal before portal reveal).
- Do not schedule the proposed "30 Days, 30 Apartments" campaign — it is not approved.
- Use the existing ideas by id. You may add at most 3 NEW ideas (id null) only if they clearly fill a gap.
- Dates must be between ${addDays(today, 1)} and ${end}. Saturday is family day for Royanna — avoid Saturday publishing unless leasing content is scheduled automatically.

Return ONLY JSON:
{
  "summary": "2–3 sentences on the strategy for this month",
  "posts": [{ "id": "<idea id or null>", "title": "", "brand": "personal|rlc|leasing", "format": "<format key>", "platforms": ["instagram"], "publish_date": "YYYY-MM-DD", "objective": "", "effort": "light|medium|heavy", "why": "one sentence", "depends_on": "what must exist first (footage, agent photos, permission) or empty", "assigned": "Royanna or agent name" }],
  "held_back": [{ "id": "<idea id>", "reason": "why it waits" }]
}`
  const user = JSON.stringify({
    today, horizon_end: end,
    already_scheduled: scheduled.map(i => ({ date: i.publish_date, brand: i.brand, title: i.title })),
    ideas: ideas.map(i => ({
      id: i.id, title: i.title, brand: i.brand, format: i.format, priority: i.priority, timeliness: i.timeliness,
      lead_potential: i.lead_potential, effort: i.effort, backlog: i.is_backlog, agent: i.agent_name,
      notes: (i.notes || '').slice(0, 280),
    })),
  }, null, 2)
  const plan = await ask(system, user, 16000)
  return enforcePlan(plan, { items, scheduled, perWeek, lowCapacity, today, end })
}

/** Never trust the model with limits: drop anything outside the window or over a weekly ceiling. */
export function enforcePlan(plan, { items, scheduled, perWeek, lowCapacity, today, end }) {
  const byId = new Map(items.map(i => [i.id, i]))
  const counts = new Map()   // `${week}:${brand}` → n, seeded with what's already scheduled
  const totals = new Map()
  const heavy = new Map()
  const bump = (m, k) => m.set(k, (m.get(k) || 0) + 1)
  for (const s of scheduled) { bump(counts, `${weekStart(s.publish_date)}:${s.brand}`); bump(totals, weekStart(s.publish_date)) }
  const posts = [], held = [...(plan.held_back || [])]
  const sorted = [...(plan.posts || [])].filter(p => p && p.publish_date).sort((a, b) => a.publish_date.localeCompare(b.publish_date))
  for (const p of sorted) {
    const brand = BRANDS[p.brand] ? p.brand : byId.get(p.id)?.brand || 'personal'
    const format = FORMATS[p.format] ? p.format : byId.get(p.id)?.format || null
    const wk = weekStart(p.publish_date)
    const reason =
      p.publish_date <= today || p.publish_date > end ? 'date outside the next 30 days' :
      p.id && !byId.has(p.id) ? 'unknown idea' :
      (counts.get(`${wk}:${brand}`) || 0) >= perWeek[brand] ? `over the ${BRANDS[brand].short} weekly target` :
      lowCapacity && (totals.get(wk) || 0) >= 3 ? 'low-capacity week is full' :
      lowCapacity && p.effort === 'heavy' && heavy.get(wk) ? 'already one heavy post that week' : null
    if (reason) { if (p.id) held.push({ id: p.id, reason }); continue }
    bump(counts, `${wk}:${brand}`); bump(totals, wk); if (p.effort === 'heavy') heavy.set(wk, 1)
    posts.push({ ...p, brand, format, platforms: Array.isArray(p.platforms) && p.platforms.length ? p.platforms : ['instagram'], key: Math.random().toString(36).slice(2) })
  }
  return { summary: plan.summary || '', posts, held_back: held }
}
