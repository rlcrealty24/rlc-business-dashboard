// ─── Smart suggestions (Phase 5) ─────────────────────────────────────────────
// Pure rules over your own data. Suggestions are proposals only: nothing changes
// until you press the button, and anything can be dismissed or snoozed.
import { BRANDS, STAGE_INDEX, VIDEO_KINDS } from './constants.js'
import { addDays, daysBetween, fmtDate, iso as todayISOFrom, parseISO, todayISO, weekStart } from '../ceo/recurrence.js'

const RANK = { high: 0, medium: 1, low: 2 }
const done = i => (STAGE_INDEX[i.stage] ?? 0) >= STAGE_INDEX.published
const publishedOn = i => Object.values(i.versions || {}).map(v => v.published_at).filter(Boolean).sort()[0] || (done(i) ? i.publish_date : null)
const weekday = d => ![0, 6].includes(parseISO(d).getDay())

/** Next weekday on/after `from` where `brand` is under its weekly ceiling */
function nextOpenDate(items, brand, perWeek, from) {
  for (let i = 0; i < 60; i++) {
    const d = addDays(from, i)
    if (!weekday(d)) continue
    const ws = weekStart(d)
    const n = items.filter(x => !x.archived && x.brand === brand && x.publish_date && weekStart(x.publish_date) === ws && x.stage !== 'idea').length
    if (n < (perWeek[brand] ?? 1)) return d
  }
  return addDays(from, 7)
}

/**
 * Returns suggestions: { id, priority (lower = more important), title, body, action: { label, kind, ...payload } }
 * Action kinds are executed by the UI (see runSuggestion in SuggestionsCard).
 */
export function buildSuggestions({ items, campaigns, assets = [], slots, deals, listings, listingsLoaded, insights, perWeek, today = todayISO() }) {
  const library = new Map(assets.map(a => [a.id, a]))
  const live = items.filter(i => !i.archived)
  const out = []

  // 1 · Personal account gone quiet — suggest something meaningful, not filler
  const lastPersonal = live.filter(i => i.brand === 'personal').map(publishedOn).filter(Boolean).sort().pop()
  const personalSoon = live.some(i => i.brand === 'personal' && i.publish_date && i.publish_date >= today && i.publish_date <= addDays(today, 10) && !done(i))
  const quietDays = lastPersonal ? daysBetween(lastPersonal, today) : null
  if (!personalSoon && (quietDays === null || quietDays >= 14)) {
    const idea = live.filter(i => i.brand === 'personal' && i.stage === 'idea')
      .sort((a, b) => (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3) || (a.timeliness === 'timely' ? -1 : 1))[0]
    if (idea) {
      const date = nextOpenDate(live, 'personal', perWeek, addDays(today, 7))
      out.push({
        id: `quiet-personal:${today.slice(0, 7)}`, priority: 2,
        title: quietDays === null ? 'Your personal account has nothing planned' : `Personal account quiet for ${quietDays} days`,
        body: `“${idea.title}” is your strongest personal idea. Plan it for ${fmtDate(date)} — enough lead time to film it properly.`,
        action: { label: `Plan for ${fmtDate(date, { month: 'short', day: 'numeric' })}`, kind: 'plan', itemId: idea.id, date, format: idea.format || 'lifestyle_reel' },
      })
    }
  }

  // 2 · A deal just closed and has no post yet
  const used = new Set(live.flatMap(i => (i.source_ref || '').split(',').filter(Boolean)))
  for (const d of (deals || []).filter(d => d.date && d.date >= addDays(today, -21) && d.date <= today && !used.has(d.id)).slice(0, 2)) {
    out.push({
      id: `deal:${d.id}`, priority: 1,
      title: `Just ${d.kind === 'lease' ? 'leased' : 'closed'}: ${d.label}`,
      body: `${fmtDate(d.date)}. A fresh result is the easiest strong post — tell it as a story, not a “Just Sold” graphic. Saved as an idea; nothing gets scheduled.`,
      action: { label: 'Save as post idea', kind: 'deal', deal: d },
    })
  }

  // 3 · Leasing posts going out soon: price/special not verified yet
  for (const i of live.filter(i => i.brand === 'leasing' && i.publish_date && i.publish_date >= today && i.publish_date <= addDays(today, 2) && !done(i))) {
    const v = (i.steps || []).find(s => s.key === 'verify')
    if (v && !v.done) out.push({
      id: `verify:${i.id}:${i.publish_date}`, priority: 0,
      title: `Verify pricing before ${i.publish_date === today ? 'today' : fmtDate(i.publish_date)}`,
      body: `“${i.title}” goes out ${i.publish_date === today ? 'today' : fmtDate(i.publish_date)}. Confirm the price, special and availability with the leasing office.`,
      action: { label: 'Open post', kind: 'open', itemId: i.id },
    })
  }

  // 4 · Campaign apartments that changed on the leasing site
  if (listingsLoaded) {
    const active = new Map((listings || []).map(l => [l.id, l]))
    for (const c of campaigns.filter(c => ['active', 'proposed'].includes(c.status))) {
      for (const a of (c.config?.apartments || []).filter(a => a.listing_id)) {
        const upcoming = live.find(i => i.campaign_id === c.id && i.title.startsWith(a.name) && i.publish_date >= today && !done(i))
        const l = active.get(a.listing_id)
        if (!l && (upcoming || c.status === 'proposed')) out.push({
          id: `gone:${c.id}:${a.key}`, priority: 0,
          title: `${a.name} is no longer active on your leasing site`,
          body: `It's in “${c.name}”${upcoming ? ` and scheduled for ${fmtDate(upcoming.publish_date)}` : ''}. Swap in another apartment or drop it before it posts.`,
          action: { label: upcoming ? 'Open post' : 'Open campaign', kind: upcoming ? 'open' : 'campaign', itemId: upcoming?.id, campaignId: c.id },
        })
        else if (l && (l.special || '') !== (a.special || '') && (upcoming || c.status === 'proposed')) out.push({
          id: `special:${c.id}:${a.key}:${l.special || 'none'}`, priority: 1,
          title: `Special changed for ${a.name}`,
          body: `Leasing site now says: ${l.special || 'no special'}. Your campaign copy says: ${a.special || 'no special'}. Update the caption before it posts.`,
          action: { label: upcoming ? 'Open post' : 'Open campaign', kind: upcoming ? 'open' : 'campaign', itemId: upcoming?.id, campaignId: c.id },
        })
      }
    }
  }

  // 5 · Footage already in the library but the post still says "film"
  for (const i of live.filter(i => !done(i) && i.stage !== 'idea')) {
    const film = (i.steps || []).find(s => s.key === 'film')
    if (!film || film.done) continue
    const hasVideo = (i.assets || []).some(a => a.asset_id && VIDEO_KINDS.has(library.get(a.asset_id)?.kind))
    if (hasVideo) out.push({
      id: `footage:${i.id}`, priority: 3,
      title: `You may already have footage for “${i.title}”`,
      body: 'A library clip is attached to this post but filming is still open. If the clip covers it, mark filming done and skip the shoot.',
      action: { label: 'Mark filmed', kind: 'filmed', itemId: i.id },
    })
  }

  // 6 · Several shoots spread over different days → one batch day (a Film day, never a weekend)
  const shoots = live.filter(i => !done(i) && i.stage !== 'idea' && i.publish_date).flatMap(i => (i.steps || [])
    .filter(s => s.key === 'film' && !s.done && s.due && s.due >= today && s.due <= addDays(today, 10)).map(s => ({ i, s, latest: addDays(i.publish_date, -3) })))
    .filter(x => x.latest > today)   // too close to move — those are just urgent
  if (shoots.length >= 3 && new Set(shoots.map(x => x.s.due)).size >= 2) {
    const latestOk = shoots.reduce((m, x) => (x.latest < m ? x.latest : m), addDays(today, 10))
    const filmDays = (slots?.film || []).filter(d => d > today && d <= latestOk)
    let day = filmDays.pop()
    if (!day) { day = latestOk; while (day > today && !weekday(day)) day = addDays(day, -1) }
    const moving = shoots.filter(x => x.s.due !== day)
    if (day > today && moving.length >= 2) out.push({
      id: `batch:${day}:${shoots.map(x => x.i.id).sort().join(',')}`, priority: 2,
      title: `Batch ${shoots.length} shoots into one day`,
      body: `Filming is spread over ${new Set(shoots.map(x => x.s.due)).size} days. Film all of it on ${fmtDate(day)}: ${shoots.map(x => x.i.title).slice(0, 4).join(', ')}${shoots.length > 4 ? '…' : ''}. Every post still has at least 3 days before it goes out.`,
      action: { label: `Move all to ${fmtDate(day, { month: 'short', day: 'numeric' })}`, kind: 'batch', day, steps: shoots.map(x => ({ itemId: x.i.id, key: x.s.key })) },
    })
  }

  // 7 · A week with more than you said you want (campaign posts don't count)
  const scheduled = live.filter(i => i.publish_date && i.publish_date >= today && i.publish_date <= addDays(today, 28) && !done(i) && i.stage !== 'idea' && !i.campaign_id)
  const byWeek = new Map()
  for (const i of scheduled) { const k = `${weekStart(i.publish_date)}|${i.brand}`; if (!byWeek.has(k)) byWeek.set(k, []); byWeek.get(k).push(i) }
  for (const [k, list] of byWeek) {
    const [ws, brand] = k.split('|')
    const max = perWeek[brand] ?? 1
    if (list.length <= max) continue
    const move = [...list].sort((a, b) => (RANK[b.priority] ?? 3) - (RANK[a.priority] ?? 3) || (b.publish_date || '').localeCompare(a.publish_date || ''))[0]
    const date = nextOpenDate(live, brand, perWeek, addDays(ws, 7))
    out.push({
      id: `overload:${k}:${list.length}`, priority: 1,
      title: `${BRANDS[brand].short}: ${list.length} posts the week of ${fmtDate(ws, { month: 'short', day: 'numeric' })} (your max is ${max})`,
      body: `Postpone the lowest-priority one — “${move.title}” — to ${fmtDate(date)}. Its prep moves with it.`,
      action: { label: `Move to ${fmtDate(date, { month: 'short', day: 'numeric' })}`, kind: 'move', itemId: move.id, date },
    })
  }

  // 8 · Timely ideas going stale
  for (const i of live.filter(i => i.stage === 'idea' && i.timeliness === 'timely' && i.created_at && daysBetween(i.created_at.slice(0, 10), today) >= 21).slice(0, 2)) {
    out.push({
      id: `stale:${i.id}`, priority: 4,
      title: `“${i.title}” has been waiting ${daysBetween(i.created_at.slice(0, 10), today)} days`,
      body: 'It was marked timely. Plan it soon, or archive it if the moment has passed.',
      action: { label: 'Open idea', kind: 'open', itemId: i.id },
    })
  }

  // 9 · Month-end read
  const t = parseISO(today)
  const monthEnd = todayISOFrom(new Date(t.getFullYear(), t.getMonth() + 1, 0))
  if (daysBetween(today, monthEnd) <= 2 && !insights?.[today.slice(0, 7)] && live.some(i => (publishedOn(i) || '').startsWith(today.slice(0, 7)))) {
    out.push({
      id: `monthly:${today.slice(0, 7)}`, priority: 2,
      title: 'Month-end: run your monthly read',
      body: 'See which posts actually brought in business this month before planning the next one.',
      action: { label: 'Open Insights', kind: 'nav', to: '/social/insights' },
    })
  }

  // 10 · Nothing planned next week at all
  const nw = addDays(weekStart(today), 7)
  if (!live.some(i => i.publish_date && i.publish_date >= nw && i.publish_date <= addDays(nw, 6) && i.stage !== 'idea') && live.some(i => i.stage === 'idea')) {
    out.push({
      id: `empty-week:${nw}`, priority: 3,
      title: `Nothing planned for the week of ${fmtDate(nw, { month: 'short', day: 'numeric' })}`,
      body: 'That can be fine. If you want something out that week, the 30-day plan will pick the right ideas within your limits.',
      action: { label: 'Open 30-day plan', kind: 'nav', to: '/social/plan' },
    })
  }

  return out.sort((a, b) => a.priority - b.priority)
}

