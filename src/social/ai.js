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

/** Unique hook + caption for each apartment in a campaign (leasing voice). rows: [{key, date, apt}] */
export async function campaignCopy(rows, campaignName) {
  const system = `You write short-form apartment video copy for @rlcrealtycoleasing (RLC Leasing) — Miami and Denver rentals.

${VOICES}

${STYLE}

RULES FOR THIS SERIES ("${campaignName}"):
- Every hook must be different in angle — price, a specific feature, the neighborhood, a renter problem it solves, a special, a lifestyle moment. Never reuse an opening.
- Use only the apartment's public name exactly as given. Never invent building names, addresses, unit numbers, prices or specials.
- If pricing or a special is mentioned, the CTA/caption must work even if it changes — say "verify current specials" in the notes field, not in the caption.
- Captions: 2–4 short lines + one clear next step (DM a keyword, link in bio). One emoji at most.

Return ONLY JSON: { "posts": [ { "key": "<key as given>", "hook": "", "on_screen_text": "short lines separated by \\n", "caption": "", "cta": "", "notes": "what to verify / film for this one" } ] }`
  const user = JSON.stringify(rows.map(r => ({
    key: r.key, day: r.date, name: r.apt.name, market: r.apt.market, area: r.apt.area,
    pricing: r.apt.prices || null, special: r.apt.special || null, amenities: (r.apt.amenities || []).slice(0, 8), notes: r.apt.notes || null,
  })), null, 2)
  const out = await ask(system, user, 16000)
  return Array.isArray(out.posts) ? out.posts : []
}

/** Continue / pause / adjust, from the campaign's results so far */
export async function reviewCampaign(summary) {
  const system = `You review Royanna's social media campaigns for RLC Leasing. Be direct and practical: what the numbers say, and what to do next.
Judge by business results first (inquiries and rental leads), then saves/shares, then views. Small samples are noisy — say so when fewer than 5 posts have data.
Return ONLY JSON: { "verdict": "continue|adjust|pause", "summary": "2–3 sentences", "changes": ["specific changes to make — formats, hooks, posting days, which apartments/markets to lean into"], "best": "which post worked best and why (or empty)", "worst": "which post worked worst and why (or empty)" }`
  return ask(system, JSON.stringify(summary, null, 2), 8000)
}

/** Month-end read: what generated business, what to change */
export async function monthlyInsights(data) {
  const system = `You analyze one month of Royanna Carbajal's social media across three accounts (personal, RLC Realty, RLC Leasing).
She cares about business, not vanity metrics: verified leads (from tracking links) count most, then leads she logged, then saves/shares; views matter least.
Be specific and honest — name posts and formats. If there is too little data to conclude something, say so plainly instead of guessing.
Return ONLY JSON: { "summary": "3–4 sentences: what generated business this month and why", "keep": ["what to keep doing"], "change": ["what to stop or change"], "next_month": ["2–4 concrete content moves for next month"] }`
  return ask(system, JSON.stringify(data, null, 2), 8000)
}

export { ask as askJSON }

/** Order Royanna's open tasks: what first, in what order, what can wait or go. */
export async function prioritizeTasks({ tasks, today, now, schedule }) {
  const system = `You are Royanna Carbajal's chief of staff. She is broker/owner of RLC Realty Co. (Florida + Colorado), runs RLC Leasing and her personal brand, and is a mom to a one-year-old. She has ADHD: she jumps between tasks and loses the day to her phone, so she needs ONE clear first move and a short, honest order — not a long plan.

How to prioritize:
1. Hard deadlines and anything overdue or due within 2 days.
2. Income-producing work (leads, clients, listings, closings, commissions, follow-ups) beats admin, setup and "nice to have".
3. Things that unblock other people or other tasks.
4. Quick wins under 10 minutes can go early only if they clear a real obstacle.
Be realistic about today: she only has the open time shown in today's schedule. Put the rest in "this week" or "later". If a task looks unnecessary or duplicated, say so in "drop".

Return ONLY JSON:
{
  "first": { "key": "<task key>", "why": "one sentence", "first_step": "the very first 2-minute action", "minutes": 15 },
  "order": [ { "key": "<task key>", "why": "short reason", "minutes": 20, "priority": "high|medium|low", "when": "today|this week|later" } ],
  "top3": ["<key>", "<key>", "<key>"],
  "drop": [ { "key": "<task key>", "why": "short reason" } ],
  "note": "one short, kind, practical sentence for today"
}
"order" must include every task key exactly once (including the first one), most important first. Use only keys from the input.`
  return ask(system, JSON.stringify({ today, now, todays_remaining_schedule: schedule, tasks }, null, 2), 16000)
}
