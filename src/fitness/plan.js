// ─── Living fitness plan ─────────────────────────────────────────────────────
// The active plan, every previous version, and your coach profile — all synced.
// The original static plan (data/fitnessData.js) is version 1 until you replace it.
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { PLAN_DAYS, MACRO_TARGETS, BODY_STATS } from '../data/fitnessData.js'
import { today, uid } from '../utils/formatters.js'

export const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

// Day styling stays tied to the weekday so the page looks the same whatever the plan says
const STYLE = Object.fromEntries(Object.entries(PLAN_DAYS).map(([k, d]) => [k, { color: d.color, bg: d.bg, border: d.border }]))

export const ORIGINAL_PLAN = {
  id: 'original', version: 1, source: 'original',
  name: 'Postpartum transformation', goal: 'Strong, toned & confident — postpartum fat loss',
  approved_at: '2026-06-17', created_at: '2026-06-17',
  days: Object.fromEntries(Object.entries(PLAN_DAYS).map(([k, d]) => [k, {
    name: d.name, emoji: d.emoji, warmup: d.warmup, cooldown: d.cooldown, rest: Number(k) === 0,
    exercises: d.exercises.map(e => ({ ...e })),
  }])),
  targets: { ...MACRO_TARGETS },
  cardio: 'HIIT finishers Tue/Sat, incline walk Thu, walking on rest days.',
  recovery: 'Sunday rest: walk, stretch, foam roll.',
  progression: 'Weeks 1–2: form & connection · Weeks 3–4: add volume · Weeks 5–8: add load (2.5–5 lb on main lifts every 1–2 weeks).',
  nutrition: null,
  checkin_weeks: 4,
}

export const DEFAULT_PROFILE = {
  goal: '', days: [], session_minutes: 60, equipment: 'Full gym (kids club)', activity: '', height: '', age: '',
  breastfeeding: '', health: '', foods_like: '', foods_avoid: '', meals_per_day: 4, cooking: '', experience: 'Intermediate',
}

/** Plan day for a weekday, with display styling. Always returns something renderable. */
export function planDay(plan, dow) {
  const d = plan?.days?.[dow] || plan?.days?.[String(dow)] || { name: 'Rest', rest: true, exercises: [] }
  return { ...STYLE[dow], day: DOW[dow], emoji: d.emoji || (d.rest ? '🌸' : '🏋️'), warmup: '', cooldown: '', ...d, exercises: d.exercises || [] }
}

export const trainingDays = plan => WEEK_ORDER.filter(i => { const d = plan?.days?.[i]; return d && !d.rest && (d.exercises || []).length })

/** Where a day's workout checkboxes live in the Daily Log (original plan keeps the old keys) */
export const logDayKey = (plan, dow) => (plan?.id === 'original' || !plan?.id ? dow : `${plan.id}:${dow}`)

export function useFitnessPlan() {
  const [stored, setStored] = useLocalStorage('fitness_plan', null)
  const [history, setHistory] = useLocalStorage('fitness_plan_history', [])
  const plan = stored && stored.days ? stored : ORIGINAL_PLAN

  /** Replace the active plan, keeping the old one (with a progress snapshot) in history */
  function replacePlan(next, { snapshot, label } = {}) {
    const archived = { ...plan, archived_at: today(), snapshot: snapshot || null, archived_label: label || null }
    setHistory(prev => [archived, ...(Array.isArray(prev) ? prev : []).filter(p => p.id !== plan.id || p.archived_at !== archived.archived_at)])
    const v = Math.max(plan.version || 1, ...(Array.isArray(history) ? history : []).map(p => p.version || 1)) + 1
    const row = { ...next, id: uid(), version: v, approved_at: today(), created_at: next.created_at || today() }
    setStored(row)
    return row
  }
  /** Small edits to the active plan in place (swap an exercise, rename a day…) */
  function editPlan(patch) { setStored({ ...plan, ...patch, edited_at: today() }) }

  return { plan, history: Array.isArray(history) ? history : [], replacePlan, editPlan }
}

export function useFitnessProfile() {
  const [p, setP] = useLocalStorage('fitness_profile', DEFAULT_PROFILE)
  return [{ ...DEFAULT_PROFILE, ...(p || {}) }, patch => setP(prev => ({ ...DEFAULT_PROFILE, ...(prev || {}), ...patch }))]
}

// ─── Progress ────────────────────────────────────────────────────────────────
export function weighIns(logs, weekly) {
  const daily = Object.keys(logs || {}).filter(d => parseFloat(logs[d]?.weight) > 0).map(d => ({ date: d, weight: parseFloat(logs[d].weight) }))
  const wk = (Array.isArray(weekly) ? weekly : []).filter(w => parseFloat(w.weight) > 0).map(w => ({ date: w.date, weight: parseFloat(w.weight) }))
  return [...daily, ...wk].sort((a, b) => a.date.localeCompare(b.date))
}

const addDaysISO = (d, n) => { const x = new Date(d + 'T00:00:00'); x.setDate(x.getDate() + n); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}` }
export { addDaysISO }
const weeksBetween = (a, b) => Math.max(0, (new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 6048e5)

/** What happened between two dates: weight, measurements, training and eating adherence */
export function progressBetween({ logs, weekly, plan, from, to = today() }) {
  const w = weighIns(logs, weekly)
  const inRange = w.filter(x => x.date >= from && x.date <= to)
  const before = [...w].filter(x => x.date < from).pop()
  const start = before || inRange[0] || null
  const end = inRange[inRange.length - 1] || null
  const meas = (Array.isArray(weekly) ? weekly : []).filter(x => x.date >= from && x.date <= to && (x.waist || x.hips || x.thigh || x.bf))
  const firstM = meas[0], lastM = meas[meas.length - 1]
  const delta = k => (firstM && lastM && firstM !== lastM && parseFloat(firstM[k]) && parseFloat(lastM[k])) ? Math.round((parseFloat(lastM[k]) - parseFloat(firstM[k])) * 10) / 10 : null

  const days = Object.keys(logs || {}).filter(d => d >= from && d <= to)
  const trained = days.filter(d => Object.values(logs[d]?.workoutsPerDay || {}).some(v => Object.values(v || {}).some(Boolean)) || (logs[d]?.customExercises || []).some(e => e.done)).length
  const planned = Math.round(weeksBetween(from, to) * trainingDays(plan).length)
  const food = days.map(d => Object.values(logs[d]?.meals || {}).flat()).filter(f => f.length)
  const avg = k => food.length ? Math.round(food.reduce((s, f) => s + f.reduce((t, x) => t + (parseFloat(x[k]) || 0), 0), 0) / food.length) : null

  return {
    from, to, weeks: Math.round(weeksBetween(from, to) * 10) / 10,
    weight_start: start?.weight ?? null, weight_end: end?.weight ?? null,
    weight_change: start && end ? Math.round((end.weight - start.weight) * 10) / 10 : null,
    weigh_ins: inRange.length,
    waist_change: delta('waist'), hips_change: delta('hips'), thigh_change: delta('thigh'), bf_change: delta('bf'),
    workouts_logged: trained, workouts_planned: planned,
    days_food_logged: food.length, avg_calories: avg('cal'), avg_protein: avg('protein'),
  }
}

export const latestMeasurements = weekly => [...(Array.isArray(weekly) ? weekly : [])].filter(x => x.waist || x.hips || x.thigh || x.bf || x.weight).sort((a, b) => (a.date || '').localeCompare(b.date || '')).pop() || null

export { BODY_STATS }
