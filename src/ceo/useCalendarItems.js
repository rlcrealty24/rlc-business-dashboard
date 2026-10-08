// One merged, clash-checked list of everything on the calendar:
//   CEO blocks · RLC portal (live) · Dashboard events · bills · scheduled tasks

import { useMemo } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useCeo } from './CeoStore.jsx'
import { usePortalFeed } from './portal.js'
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

export function useCalendarItems(from, to, { portal = true } = {}) {
  const { blocks, overrides, tasks } = useCeo()
  const [events] = useLocalStorage('dash_events', [])
  const [outlook] = useLocalStorage('dash_outlook_events', [])
  const [accounts] = useLocalStorage('finance_accounts', [])
  const feed = usePortalFeed(from, portal ? to : from)

  const result = useMemo(() => {
    const all = [
      ...expandBlocks(blocks, overrides, from, to),
      ...(portal ? feed.items : []),
      ...lifeItems(events, outlook, accounts, from, to),
      ...taskItems(tasks, from, to),
    ]
    const byDate = new Map()
    for (let i = 0; i <= daysBetween(from, to); i++) byDate.set(addDays(from, i), [])
    for (const it of all) byDate.get(it.date)?.push(it)
    for (const [, list] of byDate) {
      resolveClashes(list)
      list.sort((a, b) => (a.allDay === b.allDay ? (a.start ?? 0) - (b.start ?? 0) : a.allDay ? -1 : 1))
    }
    return { all, byDate }
  }, [blocks, overrides, tasks, events, outlook, accounts, feed.items, from, to, portal])

  return { ...result, feed }
}
