// One merged, clash-checked list of everything on the calendar:
//   CEO blocks · RLC portal (live) · Dashboard events · bills · scheduled tasks

import { useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useCeo } from './CeoStore.jsx'
import { usePortalFeed } from './portal.js'
import { useSocial } from '../social/SocialStore.jsx'
import { BRANDS } from '../social/constants.js'
import { addDays, daysBetween, expandBlocks, parseISO, pad, resolveClashes, toMin } from './recurrence.js'

/** '10:30 AM' | '10:30' | '' → minutes or null */
function looseTime(t) {
  if (!t) return null
  const m = String(t).trim().match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)?$/i)
  if (!m) return null
  let h = Number(m[1]); const min = Number(m[2] || 0)
  if (m[3]) { h = h % 12; if (/pm/i.test(m[3])) h += 12 }
  return h * 60 + min
}

function lifeItems(events, outlook, accounts, from, to) {
  const out = []
  for (const e of [...(Array.isArray(events) ? events : []), ...(Array.isArray(outlook) ? outlook : [])]) {
    if (!e?.date || e.date < from || e.date > to) continue
    const start = looseTime(e.time)
    out.push({
      key: `l:${e.id}`, source: 'life', category: 'personal', title: e.title || 'Event',
      date: e.date, start, end: start === null ? null : start + 60, allDay: start === null,
      description: e.notes, reminders: start === null ? [] : [30],
    })
  }
  // Bills: dueDate is a day-of-month on liability accounts in Finance
  const liabs = (Array.isArray(accounts) ? accounts : []).filter(a => a.isLiability && parseInt(a.dueDate))
  if (liabs.length) {
    const first = parseISO(from)
    const months = Math.ceil(daysBetween(from, to) / 28) + 1
    for (let i = 0; i <= months; i++) {
      const y = first.getFullYear(), m = first.getMonth() + i
      const last = new Date(y, m + 1, 0).getDate()
      for (const a of liabs) {
        const d = new Date(y, m, Math.min(parseInt(a.dueDate), last))
        const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
        if (ds < from || ds > to) continue
        out.push({
          key: `bill:${a.id}:${ds}`, source: 'bill', category: 'dates', date: ds, start: null, end: null, allDay: true,
          title: `Bill due — ${a.name}${a.minPayment ? ` ($${Number(a.minPayment).toLocaleString()})` : ''}`,
          reminders: [4320], href: '/finance',
        })
      }
    }
  }
  return out
}

function taskItems(tasks, from, to) {
  const out = []
  for (const t of tasks) {
    if (t.status === 'done') continue        // completed tasks come off the calendar too
    if (t.scheduled_date && t.scheduled_date >= from && t.scheduled_date <= to) {
      const start = toMin(t.scheduled_time)
      out.push({
        key: `t:${t.id}`, source: 'task', task: t, category: t.category || 'business',
        title: t.title, date: t.scheduled_date, start, end: start === null ? null : start + (t.duration_min || 30),
        allDay: start === null, status: t.status === 'done' ? 'done' : 'open', reminders: start === null ? [] : [5],
      })
    } else if (t.due_date && t.status !== 'done' && t.due_date >= from && t.due_date <= to) {
      out.push({
        key: `td:${t.id}`, source: 'task', task: t, category: 'dates', title: `Due — ${t.title}`,
        date: t.due_date, start: null, end: null, allDay: true, status: 'open', reminders: [1440],
      })
    }
  }
  return out
}

/** Social HQ: publish dates + open prep steps (one record per post — nothing duplicated) */
function contentItems(items, from, to) {
  const out = []
  for (const i of items) {
    if (i.archived || i.stage === 'idea') continue
    const brand = BRANDS[i.brand]?.short || ''
    if (i.publish_date && i.publish_date >= from && i.publish_date <= to && !['published', 'reviewed'].includes(i.stage)) {
      const start = toMin(i.publish_time)
      out.push({
        key: `c:${i.id}`, source: 'content', category: 'content', contentId: i.id,
        title: `Post · ${brand}: ${i.title}`, date: i.publish_date, start, end: start === null ? null : start + 15, allDay: start === null,
        reminders: [1440], href: `/social/post/${i.id}`, description: i.caption || i.notes || '',
      })
    }
    for (const s of i.steps || []) {
      if (s.done || !s.due || s.due < from || s.due > to || ['publish', 'review'].includes(s.anchor)) continue
      out.push({
        key: `cs:${i.id}:${s.key}`, source: 'content', category: 'content', contentId: i.id, contentStep: s.key,
        title: `${s.label} — ${i.title}`, date: s.due, start: null, end: null, allDay: true,
        reminders: [0], href: `/social/post/${i.id}`, description: `${brand} post · ${s.items.filter(x => !x.done).map(x => x.text).join(' · ')}`,
      })
    }
  }
  return out
}

/** "Post & Engage"-style blocks only exist on days something goes live; list what's posting */
function publishDayBlocks(occurrences, social) {
  const byDate = new Map()
  for (const i of social) {
    if (i.archived || i.stage === 'idea' || !i.publish_date) continue
    if (!byDate.has(i.publish_date)) byDate.set(i.publish_date, [])
    byDate.get(i.publish_date).push(i)
  }
  return occurrences.flatMap(o => {
    if (!o.block?.recurrence?.onlyOnPublishDays) return [o]
    const posts = byDate.get(o.date)
    if (!posts) return []
    const lines = posts.map(p => `• ${BRANDS[p.brand]?.short || ''} — ${p.title}${p.platforms?.length ? ` (${p.platforms.map(x => x[0].toUpperCase() + x.slice(1)).join(' + ')})` : ''}`)
    return [{ ...o, title: `Post & Engage — ${posts.length === 1 ? BRANDS[posts[0].brand]?.handle || posts[0].title : `${posts.length} posts`}`,
      description: `Going live today:\n${lines.join('\n')}` }]
  })
}

export function useCalendarItems(from, to, { portal = true } = {}) {
  const { blocks, overrides, tasks } = useCeo()
  const [events] = useLocalStorage('dash_events', [])
  const [outlook] = useLocalStorage('dash_outlook_events', [])
  const [accounts] = useLocalStorage('finance_bills', [])   // due-day reminders only — no balances or amounts
  const feed = usePortalFeed(from, portal ? to : from)
  const { items: social } = useSocial()

  const result = useMemo(() => {
    const all = [
      ...publishDayBlocks(expandBlocks(blocks, overrides, from, to), social),
      ...(portal ? feed.items : []),
      ...lifeItems(events, outlook, accounts, from, to),
      ...taskItems(tasks, from, to),
      ...contentItems(social, from, to),
    ]
    const byDate = new Map()
    for (let i = 0; i <= daysBetween(from, to); i++) byDate.set(addDays(from, i), [])
    for (const it of all) byDate.get(it.date)?.push(it)
    for (const [, list] of byDate) {
      resolveClashes(list)
      list.sort((a, b) => (a.allDay === b.allDay ? (a.start ?? 0) - (b.start ?? 0) : a.allDay ? -1 : 1))
    }
    return { all, byDate }
  }, [blocks, overrides, tasks, events, outlook, accounts, feed.items, social, from, to, portal])

  return { ...result, feed }
}
