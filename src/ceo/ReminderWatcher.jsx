import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCalendarItems } from './useCalendarItems.js'
import { addDays, daysBetween, fmtDate, fmtTime, parseISO, todayISO } from './recurrence.js'
import { reminderLabel } from './constants.js'
import { toast } from './ui.jsx'

const FIRED_KEY = '__ceo_fired'   // '__' keeps it out of the cloud sync
const LOOKAHEAD_DAYS = 60          // covers 6-week marketing reminders

function readFired() { try { return JSON.parse(localStorage.getItem(FIRED_KEY)) || {} } catch { return {} } }
function writeFired(f) { try { localStorage.setItem(FIRED_KEY, JSON.stringify(f)) } catch {} }

function startMs(item) {
  const d = parseISO(item.date)
  const min = item.allDay || item.start === null ? 8 * 60 : item.start   // all-day reminders land at 8 AM
  d.setHours(0, min, 0, 0)
  return d.getTime()
}

/** Pops in-app (and desktop, if allowed) reminders while the dashboard is open. */
export default function ReminderWatcher() {
  const [from, setFrom] = useState(todayISO())
  const { all } = useCalendarItems(from, addDays(from, LOOKAHEAD_DAYS))
  const navigate = useNavigate()
  const itemsRef = useRef(all)
  itemsRef.current = all

  useEffect(() => {
    function tick() {
      if (todayISO() !== from) { setFrom(todayISO()); return }
      const now = Date.now()
      const fired = readFired()
      let changed = false
      for (const item of itemsRef.current) {
        if (!item.reminders?.length || item.status === 'skipped' || item.status === 'done' || item.bumpedBy) continue
        const start = startMs(item)
        for (const min of item.reminders) {
          const fireAt = start - min * 60000
          // Day-or-longer warnings stay pending until the event (shown next time the app is open);
          // short ones only within 15 minutes so stale pop-ups don't pile up
          const windowMs = min >= 1440 ? start - fireAt : 15 * 60000
          const key = `${item.key}:${min}`
          if (now < fireAt || now - fireAt > windowMs || fired[key]) continue
          fired[key] = now
          changed = true
          notify(item, min)
        }
      }
      if (changed) {
        const cutoff = now - 90 * 86400000
        for (const k of Object.keys(fired)) if (fired[k] < cutoff) delete fired[k]
        writeFired(fired)
      }
    }
    function notify(item, min) {
      const days = daysBetween(todayISO(), item.date)
      const lead = min >= 1440
        ? (days <= 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`)
        : min === 0 ? 'Starting now' : `In ${reminderLabel(min)}`
      const when = item.allDay ? fmtDate(item.date) : `${fmtDate(item.date)} · ${fmtTime(item.start)}`
      const first = item.checklist?.[0]?.text
      toast(item.title, `${when}${first ? ` — first step: ${first}` : ''}`, {
        eyebrow: lead, label: 'Open', onClick: () => navigate(`/calendar?date=${item.date}&open=${encodeURIComponent(item.key)}`),
      })
      if ('Notification' in window && Notification.permission === 'granted') {
        try {
          const n = new Notification(`${lead}: ${item.title}`, { body: when, tag: `${item.key}:${min}`, icon: '/rlc-logo.png' })
          n.onclick = () => { window.focus(); navigate(`/calendar?date=${item.date}&open=${encodeURIComponent(item.key)}`) }
        } catch {}
      }
    }
    tick()
    const t = setInterval(tick, 30000)
    return () => clearInterval(t)
  }, [from, navigate])

  return null
}
