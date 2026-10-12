// ─── Brain dump → tasks ──────────────────────────────────────────────────────
// Paste a messy list; get clean, separate tasks back for review. Nothing is saved until you add them.
import { aiCreate } from '../utils/anthropic.js'
import { CATEGORIES } from './constants.js'

/** More than one real line = a list, not a single task */
export const isList = text => splitLines(text).length > 1

/** Plain split without AI — used as a fallback and for the instant preview count */
export function splitLines(text) {
  return String(text || '').split(/\r?\n/)
    .map(l => l.replace(/^\s*(?:[*•\-–—]+|\d+[.)])\s*/, '').trim())
    .filter(l => l.replace(/[*"”“]/g, '').trim().length > 1)
}

export function localTasks(text) {
  return splitLines(text).map(l => {
    const flagged = /\*\s*$/.test(l)
    return { title: l.replace(/\*+\s*$/, '').trim(), priority: flagged ? 'high' : 'medium', due: null, minutes: 15, category: null, notes: '', first_step: '', duplicate_of: null }
  })
}

function parseJSON(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}')
  if (s === -1 || e === -1) throw new Error('The AI reply was not in the expected format.')
  return JSON.parse(text.slice(s, e + 1))
}

export async function splitIntoTasks(text, { today, weekday, existing = [] }) {
  const system = `You turn Royanna Carbajal's quick brain dumps into clean, separate tasks. She is broker/owner of RLC Realty Co. (Florida + Colorado), runs RLC Leasing and her personal brand, manages agents, and is a mom to a one-year-old. She has ADHD and writes fast — fix spelling and shorthand, keep her meaning, never invent details.

Rules:
- One task per distinct action. Split a line that holds two actions; merge exact repeats.
- Title: short, starts with a verb, specific ("Message Armando about a no-penalty loan extension"). Keep names as written. If something is unclear, keep her wording and add a question in "notes".
- Lines starting with "*", "-", "•" or numbers are just bullets. An asterisk at the END of an item means she flagged it as important → priority "high" unless it's clearly trivial.
- Priority: high = money, clients/leads, agents, deadlines, or flagged; medium = normal; low = errands that can wait (returns are usually medium — they have return windows).
- Due date (YYYY-MM-DD) only when the text implies timing (e.g. "leads from the weekend" → today, "tomorrow", a named day). Today is ${today} (${weekday}). Otherwise null.
- minutes: realistic estimate. first_step: the first 2-minute action.
- category: one of ${Object.keys(CATEGORIES).join(', ')} (money = income-producing).
- duplicate_of: if an existing open task already covers it, put that task's exact title; otherwise null.

Return ONLY JSON:
{ "tasks": [ { "title": "", "notes": "", "priority": "high|medium|low", "due": null, "minutes": 15, "category": "", "first_step": "", "duplicate_of": null } ], "note": "one short sentence — anything she should know" }`
  const user = JSON.stringify({ brain_dump: text, existing_open_tasks: existing.slice(0, 80) }, null, 2)
  const msg = await aiCreate({ model: 'claude-opus-5-5', effort: 'low', max_tokens: 8000, system, messages: [{ role: 'user', content: user }] })
  const out = parseJSON((msg.content || []).filter(b => b.type === 'text').map(b => b.text).join(''))
  const cats = new Set(Object.keys(CATEGORIES))
  return {
    note: out.note || '',
    tasks: (out.tasks || []).filter(t => t?.title).map(t => ({
      title: String(t.title).trim(), notes: t.notes || '', first_step: t.first_step || '',
      priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
      due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : null,
      minutes: Math.max(5, Math.min(240, Number(t.minutes) || 15)),
      category: cats.has(t.category) ? t.category : null,
      duplicate_of: t.duplicate_of || null,
    })),
  }
}

/** Ask the "What to do first" card to re-run with the new tasks included */
export const requestReprioritize = () => setTimeout(() => window.dispatchEvent(new Event('ceo-coach-run')), 400)
