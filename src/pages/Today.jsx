import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../ceo/ceo.css'
import { useCeo } from '../ceo/CeoStore.jsx'
import { useCalendarItems } from '../ceo/useCalendarItems.js'
import { addDays, fmtDate, fmtRange, fmtTime, nowMin, todayISO } from '../ceo/recurrence.js'
import { itemColors } from '../ceo/constants.js'
import { Checklist, ItemBadges, Progress, Tick } from '../ceo/ui.jsx'
import ItemSheet from '../ceo/ItemSheet.jsx'
import { openCapture } from '../ceo/QuickCapture.jsx'
import { PortalCard, PulseCard, SetupNeeded, StarterCard } from '../ceo/SetupCards.jsx'
import { ImportantTasks, MoneyCard } from '../ceo/LifeCards.jsx'

const live = i => i.status !== 'skipped' && !i.bumpedBy

function useMinuteClock() {
  const [, setTick] = useState(0)
  useEffect(() => { const t = setInterval(() => setTick(x => x + 1), 30000); return () => clearInterval(t) }, [])
  return nowMin()
}

export default function Today() {
  const { blocks, tasks, loading, setupNeeded, offline, toggleCheck, setOccurrence, saveTask, updateTask, error } = useCeo()
  const today = todayISO()
  const { byDate, feed } = useCalendarItems(today, addDays(today, 14))
  const now = useMinuteClock()
  const [openKey, setOpenKey] = useState(null)
  const [focus, setFocus] = useState(false)

  const items = byDate.get(today) || []
  const timed = items.filter(i => !i.allDay)
  const allDay = items.filter(i => i.allDay)
  const current = timed.find(i => live(i) && i.start <= now && now < i.end && i.status !== 'done')
    || timed.find(i => live(i) && i.start <= now && now < i.end)
  const upNext = timed.filter(i => live(i) && i.start > now).slice(0, 2)
  const ceoToday = items.filter(i => i.source === 'ceo' && live(i) && i.kind !== 'date' && !i.allDay)
  const doneToday = ceoToday.filter(i => i.status === 'done').length
  const openItem = openKey && [...byDate.values()].flat().find(i => i.key === openKey)

  const top3 = tasks.filter(t => t.focus_date === today)
  const inboxCount = tasks.filter(t => t.status === 'inbox').length

  const comingUp = useMemo(() => {
    const out = []
    for (let d = 1; d <= 14; d++) {
      const ds = addDays(today, d)
      for (const i of byDate.get(ds) || []) {
        if (i.source === 'portal' || i.source === 'bill' || i.source === 'life' || i.kind === 'date' || (i.source === 'task' && i.allDay)) out.push(i)
      }
    }
    return out.slice(0, 12)
  }, [byDate, today])

  if (setupNeeded) return <div className="c-page"><Header /><SetupNeeded /></div>

  return (
    <div className="c-page">
      <Header onFocus={() => setFocus(true)} canFocus={!!(current || upNext[0])} />
      {error && <div className="c-banner" style={{ marginBottom: 16 }}>Couldn&apos;t save a change: {error}</div>}
      {offline && (
        <div className="c-banner" style={{ marginBottom: 16 }}>
          Cloud database unreachable — everything is saving on this device and uploads automatically once the database is back.
        </div>
      )}
      {!loading && blocks.length === 0 && <div style={{ marginBottom: 20 }}><StarterCard /></div>}

      <div className="c-grid">
        <div className="c-stack">
          {/* NOW */}
          <div className="c-card ink c-now">
            {current ? <>
              <div className="c-now-bar" style={{ background: itemColors(current).color === '#0a0a0a' ? 'var(--sky)' : itemColors(current).color }} />
              <div className="c-now-time">Now · {fmtRange(current.start, current.end)} · {current.end - now} min left</div>
              <div className="c-now-title">{current.title}</div>
              {current.topic && <div style={{ color: 'var(--sky)', fontSize: 14, marginBottom: 6 }}>This week: {current.topic}</div>}
              {current.description && <div className="c-now-desc">{current.description}</div>}
              {current.checklist?.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Progress value={(current.checked?.length || 0) / current.checklist.length} />
                  <Checklist dark items={current.checklist} checked={current.checked} onToggle={id => toggleCheck(current, id)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
                {current.source === 'ceo' && (
                  <button className="c-btn c-btn-sky c-btn-sm" onClick={() => setOccurrence(current.blockId, current.occDate, { status: current.status === 'done' ? 'open' : 'done' })}>
                    {current.status === 'done' ? 'Done ✓ (undo)' : 'Mark done'}
                  </button>
                )}
                <button className="c-btn c-btn-sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} onClick={() => setFocus(true)}>Focus mode</button>
                <button className="c-btn c-btn-sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.35)' }} onClick={() => setOpenKey(current.key)}>Details</button>
              </div>
            </> : <>
              <div className="c-now-time">Now · {fmtTime(now)}</div>
              <div className="c-now-title">{upNext[0] ? 'Open time' : 'Nothing scheduled'}</div>
              <div className="c-now-desc">
                {upNext[0] ? `Next: ${upNext[0].title} at ${fmtTime(upNext[0].start)} (in ${upNext[0].start - now} min). Pick one Top 3 task or take a breath.` : 'Day is done. Phone down.'}
              </div>
            </>}
          </div>

          {/* Next up */}
          {upNext.length > 0 && (
            <div className="c-card">
              <div className="c-card-head"><div className="c-label">Up next</div></div>
              {upNext.map(i => (
                <div key={i.key} className="c-tl-row" onClick={() => setOpenKey(i.key)}>
                  <div className="c-tl-time">{fmtTime(i.start)}</div>
                  <div className="c-tl-title"><span className="c-dot" style={{ background: itemColors(i).color }} /><span className="t">{i.title}</span></div>
                  <div className="c-muted" style={{ fontSize: 12 }}>in {i.start - now} min</div>
                </div>
              ))}
            </div>
          )}

          {/* Top 3 */}
          <Top3 tasks={top3} today={today} saveTask={saveTask} updateTask={updateTask} />

          {/* Timeline */}
          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Today</div>
              <Link to="/calendar" className="c-link" style={{ fontSize: 12 }}>Open calendar →</Link>
            </div>
            {allDay.length > 0 && (
              <div style={{ padding: '10px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {allDay.map(i => (
                  <button key={i.key} className="c-chip" style={{ cursor: 'pointer', borderLeft: `3px solid ${itemColors(i).color}` }} onClick={() => setOpenKey(i.key)}>{i.title}</button>
                ))}
              </div>
            )}
            <div className="c-tl">
              {timed.length === 0 && <div className="c-empty">Nothing on the calendar today.</div>}
              {timed.map(i => {
                const isCurrent = current?.key === i.key
                const cls = ['c-tl-row', i.end <= now && !isCurrent && 'past', isCurrent && 'current', i.status === 'done' && 'done', !live(i) && 'bumped'].filter(Boolean).join(' ')
                return (
                  <div key={i.key} className={cls} onClick={() => setOpenKey(i.key)}>
                    <div className="c-tl-time">{fmtTime(i.start)}</div>
                    <div className="c-tl-title">
                      <span className="c-dot" style={{ background: itemColors(i).color }} />
                      <span className="t">{i.title}</span>
                      {i.source === 'portal' && <span className="c-chip ink" style={{ fontSize: 9 }}>RLC</span>}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <ItemBadges item={{ ...i, status: i.status === 'done' ? undefined : i.status }} />
                      {i.source === 'ceo' && live(i) && (
                        <button className="c-icon-btn" title={i.status === 'done' ? 'Mark not done' : 'Mark done'}
                          style={i.status === 'done' ? { background: 'var(--sky)', borderColor: 'var(--sky)' } : undefined}
                          onClick={e => { e.stopPropagation(); setOccurrence(i.blockId, i.occDate, { status: i.status === 'done' ? 'open' : 'done' }) }}>
                          {i.status === 'done' ? <Tick /> : ''}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <span className="c-label">Day progress</span>
                <span className="c-serif" style={{ fontSize: 26 }}>{doneToday}<span className="c-muted" style={{ fontSize: 16 }}> / {ceoToday.length}</span></span>
              </div>
              <Progress value={ceoToday.length ? doneToday / ceoToday.length : 0} />
            </div>
          </div>

          <MoneyCard />
          <ImportantTasks />
          <PulseCard />

          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Inbox</div>
              <span className={`c-chip${inboxCount ? ' sky' : ''}`}>{inboxCount} to sort</span>
            </div>
            <div className="c-card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="c-btn c-btn-sky c-btn-sm" onClick={openCapture}>+ Capture (⌘K)</button>
              <Link className="c-btn c-btn-sm" to="/inbox">Open Inbox</Link>
            </div>
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Next 14 days</div><Link to="/dates" className="c-link" style={{ fontSize: 12 }}>Dates →</Link></div>
            <div className="c-tl">
              {comingUp.length === 0 && <div className="c-empty">No appointments, deadlines or dates in the next two weeks.</div>}
              {comingUp.map(i => (
                <div key={i.key} className="c-tl-row" style={{ gridTemplateColumns: '84px 1fr' }} onClick={() => setOpenKey(i.key)}>
                  <div className="c-tl-time">{fmtDate(i.date)}</div>
                  <div className="c-tl-title">
                    <span className="c-dot" style={{ background: itemColors(i).color }} />
                    <span className="t">{i.title}{!i.allDay && <span className="c-muted"> · {fmtTime(i.start)}</span>}</span>
                    {i.unconfirmed && <span className="c-chip warn" style={{ fontSize: 9 }}>Unconfirmed</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <PortalCard feed={feed} />
          <NotificationsCard />
        </div>
      </div>

      {openItem && <ItemSheet item={openItem} onClose={() => setOpenKey(null)} />}
      {focus && <FocusMode item={current || upNext[0]} now={now} onClose={() => setFocus(false)} />}
    </div>
  )
}

function Header({ onFocus, canFocus }) {
  return (
    <div className="c-head">
      <div>
        <div className="c-eyebrow">CEO · Today</div>
        <div className="c-title">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div className="c-sub">Leadership in every deal. Loyalty in every move.</div>
      </div>
      {onFocus && (
        <div className="c-head-actions">
          <button className="c-btn" onClick={openCapture}>+ Capture</button>
          <button className="c-btn c-btn-ink" onClick={onFocus} disabled={!canFocus}>Focus mode</button>
        </div>
      )}
    </div>
  )
}

function Top3({ tasks, today, saveTask, updateTask }) {
  const [text, setText] = useState('')
  const done = tasks.filter(t => t.status === 'done').length
  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">Today&apos;s Top 3</div>
        <span className="c-label">{done}/{tasks.length}</span>
      </div>
      {tasks.map(t => (
        <div key={t.id} className="c-task" style={{ gridTemplateColumns: '22px 1fr auto' }}>
          <button className={`c-check${t.status === 'done' ? ' done' : ''}`} style={{ padding: 0, border: 0 }}
            onClick={() => updateTask(t, t.status === 'done' ? { status: 'next', completed_at: null } : { status: 'done', completed_at: new Date().toISOString() })}>
            <span className="c-box">{t.status === 'done' && <Tick />}</span>
          </button>
          <div className="c-task-title" style={t.status === 'done' ? { textDecoration: 'line-through', color: 'var(--light)' } : undefined}>{t.title}</div>
          <button className="c-btn c-btn-ghost c-btn-sm" title="Remove from Top 3" onClick={() => updateTask(t, { focus_date: null })}>✕</button>
        </div>
      ))}
      {tasks.length < 3 ? (
        <form className="c-card-body" style={{ display: 'flex', gap: 8 }} onSubmit={e => {
          e.preventDefault(); if (!text.trim()) return
          saveTask({ title: text.trim(), status: 'next', priority: 'high', focus_date: today }); setText('')
        }}>
          <input className="c-input" value={text} onChange={e => setText(e.target.value)} placeholder="Add a Top 3 task (at least one should make money)" />
          <button className="c-btn c-btn-ink">Add</button>
        </form>
      ) : (
        <div className="c-card-body c-muted" style={{ fontSize: 12 }}>Three is the limit. Everything else waits in the <Link className="c-link" to="/inbox">Inbox</Link>.</div>
      )}
    </div>
  )
}

function NotificationsCard() {
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'unsupported')
  if (perm === 'granted' || perm === 'unsupported') return null
  return (
    <div className="c-banner sky">
      <span style={{ fontSize: 13 }}>Turn on desktop reminders so blocks pop up even when this tab is in the background.</span>
      <button className="c-btn c-btn-sm c-btn-ink" onClick={() => Notification.requestPermission().then(setPerm)}>Enable</button>
    </div>
  )
}

function FocusMode({ item, now, onClose }) {
  const { toggleCheck, capture } = useCeo()
  const [thought, setThought] = useState('')
  const [saved, setSaved] = useState(false)
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!item) return null
  const started = item.start <= now
  const mins = started ? item.end - now : item.start - now
  return (
    <div className="c-focus">
      <div className="c-focus-inner">
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div className="c-eyebrow" style={{ color: 'var(--sky)' }}>Focus mode · one thing only</div>
          <button className="c-btn c-btn-sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }} onClick={onClose}>Exit</button>
        </div>
        <div className="c-focus-clock">{mins} min</div>
        <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13 }}>{started ? 'left in this block' : 'until it starts'} · {fmtRange(item.start, item.end)}</div>
        <div className="c-serif" style={{ fontSize: 40, lineHeight: 1.1, margin: '22px 0 10px' }}>{item.title}</div>
        {item.topic && <div style={{ color: 'var(--sky)', marginBottom: 10 }}>This week: {item.topic}</div>}
        <div className="ink" style={{ marginTop: 10 }}>
          {item.checklist?.length > 0 && <>
            <Progress value={(item.checked?.length || 0) / item.checklist.length} />
            <Checklist dark items={item.checklist} checked={item.checked} onToggle={id => toggleCheck(item, id)} />
          </>}
        </div>
        <form style={{ marginTop: 32 }} onSubmit={async e => {
          e.preventDefault(); if (!thought.trim()) return
          await capture(thought); setThought(''); setSaved(true); setTimeout(() => setSaved(false), 2000)
        }}>
          <div className="c-label" style={{ color: 'rgba(255,255,255,.5)', marginBottom: 8 }}>Brain wandered? Park it here and keep going.</div>
          <div className="c-capture" style={{ borderColor: 'rgba(255,255,255,.3)', background: 'transparent' }}>
            <input style={{ color: '#fff' }} value={thought} onChange={e => setThought(e.target.value)} placeholder="Type the thought, press Enter" />
            <button className="c-btn c-btn-sky" style={{ border: 0 }}>{saved ? 'Saved ✓' : 'Park it'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
