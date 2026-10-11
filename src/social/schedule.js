// Production steps: build them from a format, and date them backwards from the
// publish date, snapping to the Film / Edit / Schedule blocks on the CEO calendar.

import { FORMATS, STAGE_INDEX } from './constants.js'
import { addDays, expandBlocks, todayISO } from '../ceo/recurrence.js'

const uidShort = () => Math.random().toString(36).slice(2, 10)

/** Fresh steps for a format, keeping progress on steps that already exist (by key) */
export function buildSteps(format, previous = []) {
  const tpl = FORMATS[format]?.steps || []
  const prevByKey = new Map(previous.map(s => [s.key, s]))
  return tpl.map(t => {
    const prev = prevByKey.get(t.key)
    const prevItems = new Map((prev?.items || []).map(i => [i.text, i]))
    return {
      key: t.key, label: t.label, anchor: t.anchor, stage: t.stage,
      due: prev?.due || null, fixed: !!prev?.fixed, done: !!prev?.done,
      items: t.items.map(text => prevItems.get(text) || { id: uidShort(), text, done: false }),
    }
  })
}

/**
 * Production slots from the CEO calendar: the recurring content blocks
 * (e.g. "Film Content", "Edit Content", "Schedule Next Week's Posts").
 * Returns { film: [dates], edit: [dates], schedule: [dates] } for the window.
 */
export function productionSlots(blocks, overrides, from, to) {
  const pick = re => blocks.filter(b => b.kind !== 'date' && b.category === 'content' && re.test(b.title))
  const dates = list => [...new Set(expandBlocks(list, overrides, from, to)
    .filter(o => o.status !== 'skipped').map(o => o.date))].sort()
  return { film: dates(pick(/\bfilm/i)), edit: dates(pick(/\bedit/i)), schedule: dates(pick(/\bschedul/i)) }
}

const latestIn = (list, min, max) => [...list].reverse().find(d => d >= min && d <= max) || null

/** Date every non-fixed, not-done step for a publish date. */
export function dateSteps(steps, publishDate, slots) {
  if (!publishDate) return steps.map(s => (s.fixed ? s : { ...s, due: null }))
  const P = publishDate
  const today = todayISO()
  const has = a => steps.some(s => s.anchor === a)

  // Only future slots count; with short notice, steps spread over the days left
  const lo = d => (d < today ? today : d)
  const schedule = latestIn(slots.schedule, lo(addDays(P, -6)), addDays(P, -1)) || lo(addDays(P, -1))
  const edit = latestIn(slots.edit, lo(addDays(P, -9)), schedule) || lo(addDays(schedule, -1))
  const film = has('film') ? (latestIn(slots.film, lo(addDays(P, -14)), addDays(edit, -1)) || lo(addDays(edit, -1))) : null
  const gather = lo(addDays(film || edit, -2))
  const plan = lo(addDays(gather, -1))
  const approve = edit   // approve right after the edit, so scheduling day is just loading posts
  const anchors = {
    plan, gather, film, edit, approve, schedule,
    verify: addDays(P, -1), publish: P, review: addDays(P, 7),
  }
  return steps.map(s => {
    if (s.fixed || s.done) return s
    let due = anchors[s.anchor] || P
    // Saturday is family day — move prep work to Friday
    if (!['publish', 'review'].includes(s.anchor) && new Date(due + 'T00:00:00').getDay() === 6) due = addDays(due, -1)
    // Running late: anything that should already have happened lands on today (never after publish)
    if (due < today && s.anchor !== 'review') due = today > P ? P : today
    return { ...s, due }
  })
}

/** Stage implied by finished steps (never moves a post backwards) */
export function stageFromSteps(currentStage, steps) {
  let best = STAGE_INDEX[currentStage] ?? 0
  let stage = currentStage
  for (const s of steps) {
    if (!s.done) continue
    const i = STAGE_INDEX[s.stage] ?? 0
    if (i > best) { best = i; stage = s.stage }
  }
  return stage
}

export const nextStep = item => (item.steps || []).find(s => !s.done) || null
