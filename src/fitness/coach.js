// ─── AI fitness coach ────────────────────────────────────────────────────────
// Proposals only: nothing replaces your plan until you approve it.
// General fitness guidance — not medical advice.
import { aiCreate } from '../utils/anthropic.js'

const MODEL = 'claude-opus-5-5'

const COACH = `You are Royanna Carbajal's fitness and nutrition coach inside her personal dashboard. She is a busy broker/owner and mom to a one-year-old (Sophia), trains at a gym with a kids club, works in Mountain Time, and has ADHD — plans must be simple to follow, realistic for her schedule, and easy to stick to.

EVIDENCE-INFORMED RULES (follow these; explain briefly when you apply them):
- You give general fitness guidance, not medical advice. Flag anything that needs a doctor, registered dietitian or pelvic-floor physical therapist (postpartum core/pelvic-floor symptoms, pain, injuries, medical conditions, medications). If she is breastfeeding, say so in the targets and keep intake higher.
- No extreme dieting. Body recomposition = eat near maintenance or a modest deficit (about 10–20% below estimated maintenance), never crash diets, detoxes, fasting protocols or cutting food groups unless she asks for a preference. Target fat loss of at most ~0.5–1% of body weight per week. Never set calories below 1,400/day (1,800 if breastfeeding).
- Protein about 0.7–1.0 g per lb of body weight (1.6–2.2 g/kg), spread over meals. Fat at least ~25% of calories. Carbs fill the rest and support training. Macros must add up: 4×protein + 4×carbs + 9×fat ≈ calories (within 5%).
- Hypertrophy / glute growth: about 10–20 hard sets per muscle per week, glutes trained 2–3×/week with hip thrusts or bridges, squat/lunge patterns, hip hinges (RDL) and hip abduction; mostly 6–15 reps with some 15–30, 1–3 reps in reserve. Progressive overload with double progression (hit the top of the rep range on all sets → add load). Deload or lighten every 6–8 weeks or when recovery drops.
- Cardio supports, doesn't replace, lifting: daily steps (7–10k), 1–2 low-intensity sessions, little HIIT. Sleep 7+ hours when possible; recovery days are part of the plan.
- Respect her real schedule: only use the days and session length she gives. Fit training into existing calendar blocks; don't schedule on top of fixed commitments.
- Keep what is working; change what the goal, progress or preferences call for, and say why.`

function parseJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('The coach reply was not in the expected format — try again.')
  return JSON.parse(text.slice(s, e + 1))
}

async function ask(system, user, { maxTokens = 8000, effort = 'medium' } = {}) {
  const msg = await aiCreate({ model: MODEL, effort, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] })
  const text = (msg.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
  try { return parseJSON(text) } catch {
    const again = await aiCreate({
      model: MODEL, effort, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: user }, { role: 'assistant', content: text }, { role: 'user', content: 'Return only the JSON object, nothing else.' }],
    })
    return parseJSON((again.content || []).map(b => b.text || '').join(''))
  }
}

/** Step 1 — read the request, current plan and progress; say what you see and what you still need to know */
export function reviewPlan(context) {
  const system = `${COACH}

STEP 1 — REVIEW. Read her message, profile, current plan and progress. Do not write a new plan yet.
Return ONLY JSON:
{
  "assessment": ["4–7 short bullets: what is working, what doesn't fit the new goal, what progress shows"],
  "direction": "2–3 sentences: the approach you'd take for the updated plan",
  "questions": [ { "id": "q1", "question": "a specific question", "why": "why it changes the plan" } ],
  "safety": ["anything to check with a professional first — empty if nothing"]
}
Ask only questions whose answer would change the plan and that the profile/data don't already answer (e.g. current measurements, breastfeeding, days/time available, equipment, injuries, foods she likes, how training has felt). 0–6 questions.`
  return ask(system, JSON.stringify(context, null, 2), { maxTokens: 8000 })
}

/** Step 2 — the updated plan, in two calls so neither runs into the server time limit:
 *  (a) training + targets, (b) meals + grocery list built on those targets */
export async function buildPlan(context, onStep = () => {}) {
  onStep(1)
  const training = await ask(`${COACH}

STEP 2A — WRITE THE UPDATED TRAINING PLAN AND TARGETS using her message, answers, profile, current plan and progress.
Return ONLY JSON:
{
  "name": "short plan name, e.g. 'Recomp — Glute Focus'",
  "goal": "one line",
  "summary": "2–3 sentences in plain language",
  "changes": ["what changed from her current plan and why — 4–10 bullets"],
  "days": {
    "0": { "name": "Rest & Recovery", "emoji": "🌸", "rest": true, "warmup": "", "cooldown": "", "exercises": [ { "name": "Walk", "sets": "30 min", "tip": "" } ] },
    "1": { "name": "Glutes & Hamstrings A", "emoji": "🍑", "rest": false, "warmup": "...", "cooldown": "...", "exercises": [ { "name": "Barbell Hip Thrust", "sets": "4 × 8–10", "tip": "form cue + load/RIR guidance", "swap": "alternative if busy/unavailable" } ] },
    "...": "all seven keys 0–6 (0 = Sunday). Non-training days: rest true, optional light activity as exercises."
  },
  "progression": "how to progress week to week, when to deload",
  "cardio": "steps + cardio plan",
  "recovery": "sleep, rest days, mobility",
  "targets": { "cal": 0, "protein": 0, "carbs": 0, "fat": 0, "fiber": 25, "water_oz": 90 },
  "targets_why": "how you got these numbers (estimated maintenance, adjustment, protein per lb)",
  "checkin_weeks": 4,
  "safety": ["general-guidance reminders and anything to clear with a professional"]
}`, JSON.stringify(context, null, 2), { maxTokens: 24000 })
  const plan = enforceSafety(training, context)

  onStep(2)
  try {
    const nutrition = await ask(`${COACH}

STEP 2B — WRITE THE MEAL PLAN for these exact daily targets: ${JSON.stringify(plan.targets)}.
Return ONLY JSON:
{
  "strategy": "2–4 sentences: how to eat on this plan, flexible not strict",
  "meals": [ { "meal": "Breakfast", "options": [ { "name": "Greek yogurt bowl", "portions": "1 cup (227 g) nonfat Greek yogurt, ½ cup berries, 30 g granola", "cal": 0, "protein": 0, "carbs": 0, "fat": 0 } ] } ],
  "grocery": [ { "section": "Protein", "items": ["2 lb chicken breast"] } ],
  "prep": "a 45–60 min weekly prep plan"
}
One entry per meal she eats per day (use her meals_per_day; snacks count), 2–3 realistic options each, simple foods she likes and none she avoids, portions in household measures plus grams, honest macros per option. Picking any one option per meal should land within ~10% of the daily targets. The grocery list covers one week.`,
      JSON.stringify({ profile: context.profile, answers: context.answers, message: context.message, training_days: Object.values(plan.days).filter(d => !d.rest).map(d => d.name) }, null, 2),
      { maxTokens: 16000, effort: 'low' })
    plan.nutrition = nutrition
  } catch (e) {
    plan.nutrition = null
    plan.safety = [...plan.safety, `The meal plan didn't finish (${e.message}). Approve without it, or try building again.`]
  }
  return plan
}

/** Belt and braces on the numbers, whatever the model returned */
export function enforceSafety(plan, context = {}) {
  const notes = [...(plan.safety || [])]
  const t = { ...(plan.targets || {}) }
  const floor = /^y/i.test(context?.profile?.breastfeeding || '') ? 1800 : 1400
  const num = k => Math.round(Number(t[k]) || 0)
  t.cal = num('cal'); t.protein = num('protein'); t.carbs = num('carbs'); t.fat = num('fat')
  if (t.cal && t.cal < floor) { notes.push(`Calories raised to ${floor} — the coach won't go lower than that.`); t.cal = floor }
  if (t.cal) {
    const minFat = Math.round((t.cal * 0.25) / 9)
    if (t.fat < minFat) t.fat = minFat
    const carbs = Math.round((t.cal - t.protein * 4 - t.fat * 9) / 4)
    if (Math.abs(carbs - t.carbs) > 10) t.carbs = Math.max(50, carbs)   // keep the macros adding up to the calories
  }
  const days = {}
  for (let i = 0; i < 7; i++) {
    const d = plan.days?.[i] || plan.days?.[String(i)] || { name: 'Rest', rest: true, exercises: [] }
    days[i] = { ...d, exercises: (d.exercises || []).filter(e => e && e.name).map(e => ({ name: e.name, sets: e.sets || '', tip: e.tip || '', ...(e.swap ? { swap: e.swap } : {}) })) }
  }
  return { ...plan, days, targets: t, safety: notes, checkin_weeks: Number(plan.checkin_weeks) || 4 }
}
