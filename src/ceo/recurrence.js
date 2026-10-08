// ─── Date + recurrence engine for the CEO calendar ───────────────────────────
// Every date is a local wall-clock 'YYYY-MM-DD' string and every time is
// 'HH:MM' (or minutes from midnight), so nothing shifts across time zones.

export const pad = n => String(n).padStart(2, '0')

export function iso(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
export function parseISO(s) {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function todayISO() { return iso(new Date()) }
export function addDays(s, n) {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return iso(d)
}
export function daysBetween(a, b) {
  return Math.round((parseISO(b) - parseISO(a)) / 86400000)
}
export function weekStart(s) {
  return addDays(s, -parseISO(s).getDay())
}
export function toMin(t) {
  if (t === null || t === undefined || t === '') return null
  if (typeof t === 'number') return t
  const [h, m] = String(t).split(':').map(Number)
  return h * 60 + (m || 0)
}
export function fromMin(m) {
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`
}
export function fmtTime(t) {
  const m = toMin(t)
  if (m === null) return ''
  const h = Math.floor(m / 60) % 24
  const suffix = h >= 12 ? 'PM' : 'AM'
  const mins = m % 60
  return `${h % 12 || 12}${mins ? ':' + pad(mins) : ''} ${suffix}`
}
export function fmtRange(start, end) {
  if (start === null || start === undefined) return 'All day'
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start)
}
export function nowMin() {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export { DAY_SHORT, MONTH_SHORT }

export function fmtDate(s, opts = { weekday: 'short', month: 'short', day: 'numeric' }) {
  return parseISO(s).toLocaleDateString('en-US', opts)
}

function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 }
function lastDayOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate() }

/** nth weekday of a month (nth = -1 → last) */
export function nthWeekday(year, month, weekday, nth) {
  if (nth === -1) {
    const last = new Date(year, month + 1, 0)
    last.setDate(last.getDate() - ((last.getDay() - weekday + 7) % 7))
    return last
  }
  const first = new Date(year, month, 1)
  const offset = (weekday - first.getDay() + 7) % 7
  return new Date(year, month, 1 + offset + (nth - 1) * 7)
}

/** Does `block` have an occurrence on date `ds`? */
export function occursOn(block, ds) {
  if (ds < block.start_date) return false
  if (block.until_date && ds > block.until_date) return false
  const r = block.recurrence || { freq: 'none' }
  const d = parseISO(ds)
  const start = parseISO(block.start_date)
  switch (r.freq) {
    case 'none':
      return ds === block.start_date
    case 'daily':
      return daysBetween(block.start_date, ds) % (r.interval || 1) === 0
    case 'weekly': {
      const by = r.byDay?.length ? r.byDay : [start.getDay()]
      if (!by.includes(d.getDay())) return false
      const iv = r.interval || 1
      if (iv === 1) return true
      return (daysBetween(weekStart(block.start_date), weekStart(ds)) / 7) % iv === 0
    }
    case 'monthly':
      return d.getDate() === start.getDate()
    case 'monthly_last':
      return d.getDate() === lastDayOfMonth(d)
    case 'yearly':
      if (d.getMonth() !== start.getMonth()) return false
      if (start.getMonth() === 1 && start.getDate() === 29 && !isLeap(d.getFullYear())) return d.getDate() === 28
      return d.getDate() === start.getDate()
    case 'yearly_nth': {
      // e.g. Thanksgiving = 4th Thursday of November; Black Friday = same + 1 day
      const base = addDays(ds, -(r.offsetDays || 0))
      const b = parseISO(base)
      if (b.getMonth() !== r.month) return false
      return iso(nthWeekday(b.getFullYear(), r.month, r.weekday, r.nth)) === base
    }
    default:
      return false
  }
}

/** Next occurrence on/after `from` (searches ~13 months) */
export function nextOccurrence(block, from = todayISO()) {
  for (let i = 0; i < 400; i++) {
    const ds = addDays(from, i)
    if (block.until_date && ds > block.until_date) return null
    if (occursOn(block, ds)) return ds
  }
  return null
}

export function recurrenceLabel(block) {
  const r = block.recurrence || { freq: 'none' }
  switch (r.freq) {
    case 'none': return 'One time'
    case 'daily': return r.interval > 1 ? `Every ${r.interval} days` : 'Every day'
    case 'weekly': {
      const by = (r.byDay?.length ? r.byDay : [parseISO(block.start_date).getDay()]).slice().sort()
      const names = by.join(',') === '1,2,3,4,5' ? 'Weekdays' : by.map(i => DAY_SHORT[i]).join(', ')
      return r.interval > 1 ? `Every ${r.interval} weeks · ${names}` : names
    }
    case 'monthly': return `Monthly on the ${parseISO(block.start_date).getDate()}${ordinal(parseISO(block.start_date).getDate())}`
    case 'monthly_last': return 'Last day of every month'
    case 'yearly': return `Every year · ${fmtDate(block.start_date, { month: 'short', day: 'numeric' })}`
    case 'yearly_nth': return 'Every year (floating date)'
    default: return ''
  }
}
function ordinal(n) {
  if (n % 100 >= 11 && n % 100 <= 13) return 'th'
  return { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'
}

/** Topic for this week from a rotation list (e.g. training topics) */
export function rotationTopic(block, ds) {
  if (!block.rotation?.length) return null
  const weeks = Math.floor(daysBetween(weekStart(block.start_date), weekStart(ds)) / 7)
  return block.rotation[((weeks % block.rotation.length) + block.rotation.length) % block.rotation.length]
}

/**
 * Expand blocks into occurrences between [from, to] (inclusive), applying
 * per-occurrence overrides (moved / skipped / done / checklist ticks).
 * `overrides` is a Map keyed `${block_id}:${occ_date}`.
 */
export function expandBlocks(blocks, overrides, from, to) {
  const out = []
  const span = daysBetween(from, to)
  const byId = new Map(blocks.map(b => [b.id, b]))

  for (let i = 0; i <= span; i++) {
    const ds = addDays(from, i)
    for (const b of blocks) {
      if (!occursOn(b, ds)) continue
      const ov = overrides.get(`${b.id}:${ds}`)
      // Moved to a date outside the window → it'll be picked up below if in range
      if (ov?.new_date && (ov.new_date < from || ov.new_date > to)) continue
      out.push(makeOccurrence(b, ds, ov))
    }
  }
  // Occurrences moved INTO this window from a date outside it
  for (const ov of overrides.values()) {
    if (!ov.new_date || ov.new_date < from || ov.new_date > to) continue
    if (ov.occ_date >= from && ov.occ_date <= to) continue
    const b = byId.get(ov.block_id)
    if (b && occursOn(b, ov.occ_date)) out.push(makeOccurrence(b, ov.occ_date, ov))
  }
  return out
}

function makeOccurrence(b, occDate, ov) {
  const start = b.all_day ? null : toMin(ov?.new_start ?? b.start_time)
  const end = b.all_day ? null : toMin(ov?.new_end ?? b.end_time)
  return {
    key: `b:${b.id}:${occDate}`,
    source: 'ceo',
    block: b,
    blockId: b.id,
    occDate,
    date: ov?.new_date || occDate,
    start,
    end: end ?? (start !== null ? start + 30 : null),
    allDay: !!b.all_day,
    title: b.title,
    category: b.category,
    description: b.description,
    checklist: Array.isArray(b.checklist) ? b.checklist : [],
    checked: ov?.checked || [],
    status: ov?.status || 'open',
    moved: !!(ov?.new_date || ov?.new_start),
    note: ov?.note || '',
    topic: rotationTopic(b, occDate),
    reminders: b.reminders || [],
    protected: !!b.protected,
    unconfirmed: !!b.unconfirmed,
    location: b.location,
    meetingUrl: b.meeting_url,
    kind: b.kind,
    dateType: b.date_type,
  }
}

/**
 * Clash handling for one day's items (mutates, returns the same array).
 *  - A protected block beats an unprotected one → loser is marked `bumpedBy`.
 *  - A real appointment (portal / life event) beats an unprotected block.
 *  - Anything else that overlaps is flagged in `clashes` so it can be fixed.
 */
export function resolveClashes(items) {
  const timed = items.filter(i => !i.allDay && i.start !== null && i.status !== 'skipped')
  for (const i of items) { i.clashes = []; i.bumpedBy = null }
  timed.sort((a, b) => a.start - b.start)
  for (let x = 0; x < timed.length; x++) {
    for (let y = x + 1; y < timed.length; y++) {
      const a = timed[x], b = timed[y]
      if (b.start >= a.end) break
      if (a.bumpedBy || b.bumpedBy) continue
      const winner = clashWinner(a, b)
      if (winner) {
        const loser = winner === a ? b : a
        loser.bumpedBy = winner.title
      } else {
        a.clashes.push(b.title)
        b.clashes.push(a.title)
      }
    }
  }
  return items
}
// Rarer protected blocks outrank frequent ones: the month-end review beats the
// Sunday planning hour, which beats an everyday block.
function rarity(block) {
  const r = block.recurrence || {}
  if (['none', 'monthly', 'monthly_last', 'yearly', 'yearly_nth'].includes(r.freq)) return 0.5
  if (r.freq === 'weekly' && (r.byDay?.length || 1) === 1) return 0.25
  return 0
}
function weight(i) {
  if (i.source === 'ceo') return i.protected ? 2 + rarity(i.block) : 1
  if (i.source === 'task') return 0
  return 3 // portal appointments & life events are real commitments
}
function clashWinner(a, b) {
  const wa = weight(a), wb = weight(b)
  if (wa === wb) return null
  const real = i => i.source === 'portal' || i.source === 'life'
  // Two real commitments, or a protected block vs a real one → fix by hand
  if (real(a) && real(b)) return null
  if ((real(a) && wb >= 2) || (real(b) && wa >= 2)) return null
  return wa > wb ? a : b
}

/** Lane layout for overlapping items in a day column */
export function layoutLanes(items) {
  const sorted = items.slice().sort((a, b) => a.start - b.start || b.end - a.end)
  const groups = []
  let group = [], groupEnd = -1
  for (const it of sorted) {
    if (it.start >= groupEnd && group.length) { groups.push(group); group = []; groupEnd = -1 }
    group.push(it)
    groupEnd = Math.max(groupEnd, it.end)
  }
  if (group.length) groups.push(group)
  const pos = new Map()
  for (const g of groups) {
    const lanes = []
    for (const it of g) {
      let lane = lanes.findIndex(end => end <= it.start)
      if (lane === -1) { lane = lanes.length; lanes.push(it.end) } else lanes[lane] = it.end
      pos.set(it.key, { lane })
    }
    for (const it of g) pos.get(it.key).lanes = lanes.length
  }
  return pos
}
