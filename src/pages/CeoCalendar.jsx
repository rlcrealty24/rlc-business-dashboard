import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import '../ceo/ceo.css'
import { useCeo } from '../ceo/CeoStore.jsx'
import { useCalendarItems } from '../ceo/useCalendarItems.js'
import { CATEGORIES, itemColors } from '../ceo/constants.js'
import {
  DAY_SHORT, MONTH_SHORT, addDays, fmtDate, fmtRange, fmtTime, fromMin, iso, layoutLanes, nowMin, parseISO, todayISO, weekStart,
} from '../ceo/recurrence.js'
import ItemSheet from '../ceo/ItemSheet.jsx'
import BlockModal from '../ceo/BlockModal.jsx'
import { toast } from '../ceo/ui.jsx'

const GRID_START = 5      // 5 AM
const GRID_END = 22       // 10 PM
const HOUR_PX = 52
const SNAP = 15

const SOURCES = [
  ['ceo', 'My blocks'],
  ['portal', 'RLC Portal'],
  ['life', 'Dashboard & bills'],
  ['task', 'Tasks'],
]
const sourceKey = i => (i.source === 'bill' ? 'life' : i.source)

export default function CeoCalendar() {
  const [params, setParams] = useSearchParams()
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 760
  const [view, setView] = useState(params.get('view') || (isMobile ? 'day' : 'week'))
  const [anchor, setAnchor] = useState(params.get('date') || todayISO())
  const [openKey, setOpenKey] = useState(params.get('open'))
  const [creating, setCreating] = useState(null)
  const [hidden, setHidden] = useState(() => new Set())
  const [hiddenCats, setHiddenCats] = useState(() => new Set())
  const { setupNeeded } = useCeo()

  // Visible range
  const { from, to, days } = useMemo(() => {
    if (view === 'day') return { from: anchor, to: anchor, days: [anchor] }
    if (view === 'week') {
      const s = weekStart(anchor)
      return { from: s, to: addDays(s, 6), days: Array.from({ length: 7 }, (_, i) => addDays(s, i)) }
    }
    const d = parseISO(anchor)
    const first = iso(new Date(d.getFullYear(), d.getMonth(), 1))
    const s = weekStart(first)
    const cells = Array.from({ length: 42 }, (_, i) => addDays(s, i))
    return { from: cells[0], to: cells[41], days: cells }
  }, [view, anchor])

  const { byDate, all, feed } = useCalendarItems(from, to)

  // Deep link from a reminder: ?date=…&open=…
  useEffect(() => {
    const d = params.get('date'), o = params.get('open')
    if (d) setAnchor(d)
    if (o) setOpenKey(o)
    if (d || o) setParams({}, { replace: true })
  }, [params, setParams])

  const visible = i => !hidden.has(sourceKey(i)) && (i.source === 'portal' || i.source === 'bill' || !hiddenCats.has(i.category))
  const openItem = openKey && all.find(i => i.key === openKey)

  function shift(n) {
    if (view === 'day') setAnchor(addDays(anchor, n))
    else if (view === 'week') setAnchor(addDays(anchor, 7 * n))
    else { const d = parseISO(anchor); setAnchor(iso(new Date(d.getFullYear(), d.getMonth() + n, 1))) }
  }
  const label = view === 'month'
    ? parseISO(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : view === 'week'
      ? `${fmtDate(from, { month: 'short', day: 'numeric' })} – ${fmtDate(to, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : fmtDate(anchor, { weekday: 'long', month: 'long', day: 'numeric' })

  const toggle = (set, setter, k) => { const n = new Set(set); n.has(k) ? n.delete(k) : n.add(k); setter(n) }

  return (
    <div className="c-page">
      <div className="c-head">
        <div>
          <div className="c-eyebrow">CEO · Calendar</div>
          <div className="c-title">Everything, one place</div>
          <div className="c-sub">Personal blocks in color · RLC Portal events in black · drag a block to move it, click an empty slot to add.</div>
        </div>
        <div className="c-head-actions">
          <button className="c-btn" onClick={() => setCreating({ kind: 'date', all_day: true, start_date: anchor, category: 'dates', date_type: 'event', reminders: [10080, 1440] })}>+ Date</button>
          <button className="c-btn c-btn-sky" onClick={() => setCreating({ start_date: anchor })}>+ New block</button>
        </div>
      </div>

      {setupNeeded && <div className="c-banner" style={{ marginBottom: 14 }}>Finish the one-time setup on the Today page first.</div>}

      <div className="c-toolbar">
        <button className="c-btn c-btn-sm" onClick={() => setAnchor(todayISO())}>Today</button>
        <button className="c-icon-btn" onClick={() => shift(-1)} aria-label="Previous">‹</button>
        <button className="c-icon-btn" onClick={() => shift(1)} aria-label="Next">›</button>
        <span className="c-range">{label}</span>
        <span style={{ flex: 1 }} />
        <div className="c-seg">
          {['day', 'week', 'month'].map(v => <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}>{v}</button>)}
        </div>
      </div>

      <div className="c-toolbar" style={{ gap: 6 }}>
        {SOURCES.map(([k, l]) => (
          <button key={k} className={`c-chip${hidden.has(k) ? '' : ' on'}`} onClick={() => toggle(hidden, setHidden, k)}>
            {l}{k === 'portal' && !feed.connected ? ' (not connected)' : ''}
          </button>
        ))}
        <span style={{ width: 10 }} />
        {Object.entries(CATEGORIES).map(([k, c]) => (
          <button key={k} className="c-chip" onClick={() => toggle(hiddenCats, setHiddenCats, k)}
            style={hiddenCats.has(k) ? { opacity: .45 } : { borderColor: c.color + '55', color: c.color, background: c.bg }}>
            <span className="c-dot" style={{ background: c.color }} />{c.label}
          </button>
        ))}
      </div>

      {view === 'month'
        ? <MonthView days={days} anchor={anchor} byDate={byDate} visible={visible}
            onDay={d => { setAnchor(d); setView('day') }} onOpen={setOpenKey} />
        : <TimeGrid days={days} byDate={byDate} visible={visible} onOpen={setOpenKey}
            onCreate={(date, start) => setCreating({ start_date: date, start_time: fromMin(start), end_time: fromMin(Math.min(start + 60, 24 * 60 - 1)) })}
            onDayClick={d => { setAnchor(d); setView('day') }} />}

      {openItem && <ItemSheet item={openItem} onClose={() => setOpenKey(null)} />}
      {creating && <BlockModal initial={creating} onClose={() => setCreating(null)} />}
    </div>
  )
}

// ─── Day / week time grid ────────────────────────────────────────────────────
function TimeGrid({ days, byDate, visible, onOpen, onCreate, onDayClick }) {
  const { setOccurrence, saveBlock, updateTask } = useCeo()
  const scrollRef = useRef(null)
  const drag = useRef(null)
  const [dragView, setDragView] = useState(null)   // { key, dx, dy }
  const today = todayISO()
  const now = nowMin()
  const cols = `56px repeat(${days.length}, minmax(0, 1fr))`
  const hours = Array.from({ length: GRID_END - GRID_START + 1 }, (_, i) => GRID_START + i)
  const height = (GRID_END - GRID_START) * HOUR_PX
  const y = m => ((m - GRID_START * 60) / 60) * HOUR_PX

  useEffect(() => {
    // Open the grid around "now" (or 7 AM)
    const target = days.includes(today) ? Math.max(now - 90, GRID_START * 60) : 7 * 60
    if (scrollRef.current) scrollRef.current.scrollTop = y(target)
  }, [days.length]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e, item) {
    if (e.button !== 0) return
    e.stopPropagation()
    const draggable = item.source === 'ceo' || (item.source === 'task' && item.task)
    drag.current = {
      item, x: e.clientX, y: e.clientY, moved: false, draggable,
      colW: e.currentTarget.parentElement.getBoundingClientRect().width,
    }
    if (draggable) e.currentTarget.setPointerCapture(e.pointerId)
  }
  function onPointerMove(e) {
    const d = drag.current
    if (!d || !d.draggable) return
    const dx = e.clientX - d.x, dy = e.clientY - d.y
    if (!d.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return
    d.moved = true
    const dayDelta = days.length > 1 ? Math.round(dx / d.colW) : 0
    const minDelta = Math.round((dy / HOUR_PX) * 60 / SNAP) * SNAP
    d.dayDelta = dayDelta; d.minDelta = minDelta
    setDragView({ key: d.item.key, dx: dayDelta * d.colW, dy: (minDelta / 60) * HOUR_PX })
  }
  async function onPointerUp() {
    const d = drag.current
    drag.current = null
    setDragView(null)
    if (!d) return
    if (!d.moved) { onOpen(d.item.key); return }
    if (!d.dayDelta && !d.minDelta) return
    const it = d.item
    const date = addDays(it.date, d.dayDelta || 0)
    const start = Math.max(0, it.start + (d.minDelta || 0))
    const end = Math.min(24 * 60 - 1, it.end + (d.minDelta || 0))
    if (it.source === 'task') {
      await updateTask(it.task, { scheduled_date: date, scheduled_time: fromMin(start) })
    } else if (it.block.recurrence?.freq === 'none') {
      await saveBlock({ ...it.block, start_date: date, start_time: fromMin(start), end_time: fromMin(end) })
    } else {
      await setOccurrence(it.blockId, it.occDate, { new_date: date === it.occDate ? null : date, new_start: fromMin(start), new_end: fromMin(end) })
    }
    toast(`Moved: ${it.title}`, `${fmtDate(date)} · ${fmtRange(start, end)}${it.block?.recurrence?.freq !== 'none' && it.source === 'ceo' ? ' (this day only)' : ''}`)
  }

  return (
    <div className="c-cal">
      <div className="c-cal-head" style={{ gridTemplateColumns: cols }}>
        <div />
        {days.map(d => (
          <div key={d} className={`c-cal-dayhead${d === today ? ' today' : ''}`} onClick={() => onDayClick(d)}>
            <div className="dn">{DAY_SHORT[parseISO(d).getDay()]}</div>
            <div className="dd">{parseISO(d).getDate()}</div>
          </div>
        ))}
      </div>
      <div className="c-allday" style={{ gridTemplateColumns: cols }}>
        <div className="c-label" style={{ fontSize: 9, padding: '8px 4px', textAlign: 'right' }}>All day</div>
        {days.map(d => (
          <div key={d} className="c-allday-cell">
            {(byDate.get(d) || []).filter(i => i.allDay && visible(i)).map(i => {
              const c = itemColors(i)
              return (
                <div key={i.key} className="c-pill" title={i.title} onClick={() => onOpen(i.key)}
                  style={{ background: i.source === 'portal' ? '#0a0a0a' : c.bg, color: i.source === 'portal' ? '#fff' : c.color, borderLeftColor: i.source === 'portal' ? 'var(--sky)' : c.color }}>
                  {i.unconfirmed ? '(?) ' : ''}{i.title}
                </div>
              )
            })}
          </div>
        ))}
      </div>
      <div className="c-scroll" ref={scrollRef}>
        <div className="c-grid-body" style={{ gridTemplateColumns: cols, height }}>
          <div className="c-hours">
            {hours.map(h => <div key={h} className="c-hour-lbl" style={{ top: y(h * 60) }}>{h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`}</div>)}
          </div>
          {days.map(d => {
            const items = (byDate.get(d) || []).filter(i => !i.allDay && i.start !== null && visible(i) && i.status !== 'skipped')
            const lanes = layoutLanes(items.map(i => ({ ...i, start: Math.max(i.start, GRID_START * 60), end: Math.max(i.end, i.start + 15) })))
            return (
              <div key={d} className={`c-col${d === today ? ' today' : ''}`}
                onClick={e => {
                  if (e.target !== e.currentTarget) return
                  const rect = e.currentTarget.getBoundingClientRect()
                  const m = GRID_START * 60 + Math.floor(((e.clientY - rect.top) / HOUR_PX) * 60 / SNAP) * SNAP
                  onCreate(d, m)
                }}>
                {hours.map(h => <div key={h} className="c-hline" style={{ top: y(h * 60) }} />)}
                {d === today && now >= GRID_START * 60 && now <= GRID_END * 60 && <div className="c-now-line" style={{ top: y(now) }} />}
                {items.map(i => {
                  const c = itemColors(i)
                  const { lane = 0, lanes: n = 1 } = lanes.get(i.key) || {}
                  const top = y(Math.max(i.start, GRID_START * 60))
                  const h = Math.max(18, y(Math.min(i.end, GRID_END * 60)) - top - 1)
                  const isPortal = i.source === 'portal'
                  const dv = dragView?.key === i.key ? dragView : null
                  const cls = ['c-ev', i.bumpedBy && 'bumped', i.status === 'done' && 'done', i.clashes?.length && 'clash', dv && 'dragging'].filter(Boolean).join(' ')
                  return (
                    <div key={i.key} className={cls} title={`${i.title}\n${fmtRange(i.start, i.end)}${i.bumpedBy ? `\nBumped by ${i.bumpedBy}` : ''}${i.clashes?.length ? `\nClash: ${i.clashes.join(', ')}` : ''}`}
                      onPointerDown={e => onPointerDown(e, i)} onPointerMove={onPointerMove} onPointerUp={onPointerUp}
                      onPointerCancel={() => { drag.current = null; setDragView(null) }}
                      style={{
                        top, height: h,
                        left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`,
                        background: isPortal ? '#0a0a0a' : c.bg, color: isPortal ? '#fff' : '#0a0a0a',
                        borderLeftColor: isPortal ? 'var(--sky)' : c.color,
                        borderLeftStyle: i.source === 'task' ? 'dashed' : 'solid',
                        transform: dv ? `translate(${dv.dx}px, ${dv.dy}px)` : undefined,
                        cursor: i.source === 'ceo' || i.source === 'task' ? 'grab' : 'pointer',
                      }}>
                      <div className="et">{i.status === 'done' ? '✓ ' : ''}{i.unconfirmed ? '(?) ' : ''}{i.title}</div>
                      {h > 30 && <div className="eh">{fmtTime(i.start)}{isPortal ? ' · RLC' : ''}{i.topic ? ` · ${i.topic}` : ''}</div>}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── Month ───────────────────────────────────────────────────────────────────
function MonthView({ days, anchor, byDate, visible, onDay, onOpen }) {
  const month = parseISO(anchor).getMonth()
  const today = todayISO()
  // Routine recurring blocks would drown the month view — show them as a count
  const isRoutine = i => i.source === 'ceo' && i.kind !== 'date' && ['daily', 'weekly'].includes(i.block.recurrence?.freq)
  return (
    <div className="c-cal">
      <div className="c-month" style={{ borderBottom: '1px solid var(--ink)' }}>
        {DAY_SHORT.map(d => <div key={d} className="c-cal-dayhead" style={{ cursor: 'default' }}><div className="dn">{d}</div></div>)}
      </div>
      <div className="c-month">
        {days.map(d => {
          const list = (byDate.get(d) || []).filter(i => visible(i) && i.status !== 'skipped')
          const special = list.filter(i => !isRoutine(i))
          const routine = list.length - special.length
          const other = parseISO(d).getMonth() !== month
          return (
            <div key={d} className={`c-month-cell${other ? ' other' : ''}${d === today ? ' today' : ''}`} onClick={() => onDay(d)}>
              <div className="md">{parseISO(d).getDate() === 1 ? `${MONTH_SHORT[parseISO(d).getMonth()]} 1` : parseISO(d).getDate()}</div>
              {special.slice(0, 4).map(i => {
                const c = itemColors(i)
                const isPortal = i.source === 'portal'
                return (
                  <div key={i.key} className="c-pill" title={i.title} onClick={e => { e.stopPropagation(); onOpen(i.key) }}
                    style={{ background: isPortal ? '#0a0a0a' : c.bg, color: isPortal ? '#fff' : c.color, borderLeftColor: isPortal ? 'var(--sky)' : c.color }}>
                    {!i.allDay && `${fmtTime(i.start)} `}{i.unconfirmed ? '(?) ' : ''}{i.title}
                  </div>
                )
              })}
              <div className="c-more-dots">{special.slice(0, 6).map(i => <span key={i.key} className="c-dot" style={{ background: itemColors(i).color }} />)}</div>
              {(special.length > 4 || routine > 0) && (
                <div className="c-muted" style={{ fontSize: 10, letterSpacing: '.06em' }}>
                  {special.length > 4 ? `+${special.length - 4} more · ` : ''}{routine ? `${routine} blocks` : ''}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
