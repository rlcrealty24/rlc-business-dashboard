import { useMemo, useState } from 'react'
import '../ceo/ceo.css'
import { useCeo } from '../ceo/CeoStore.jsx'
import { CATEGORIES, PORTAL_URL } from '../ceo/constants.js'
import { addDays, fmtDate, fmtTime, todayISO } from '../ceo/recurrence.js'
import { Modal, Tick } from '../ceo/ui.jsx'
import { useCalendarItems } from '../ceo/useCalendarItems.js'

const PRIO_ORDER = { high: 0, medium: 1, low: 2 }
const PRIOS = ['high', 'medium', 'low']

export default function Inbox() {
  const { tasks, capture, setupNeeded } = useCeo()
  const [text, setText] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [triage, setTriage] = useState(false)
  const today = todayISO()

  const inbox = tasks.filter(t => t.status === 'inbox')
  const next = tasks.filter(t => t.status === 'next')
    .sort((a, b) => (PRIO_ORDER[a.priority] ?? 3) - (PRIO_ORDER[b.priority] ?? 3) || (a.due_date || '9').localeCompare(b.due_date || '9'))
  const done = tasks.filter(t => t.status === 'done').sort((a, b) => (b.completed_at || '').localeCompare(a.completed_at || '')).slice(0, 30)
  const focusCount = tasks.filter(t => t.focus_date === today && t.status !== 'done').length

  // Open portal tasks (deal / contact tasks) — read-only, from the live feed
  const { all } = useCalendarItems(addDays(today, -30), addDays(today, 30))
  const portalTasks = useMemo(() => all.filter(i => i.source === 'portal' && i.portalType === 'task').sort((a, b) => a.date.localeCompare(b.date)), [all])

  if (setupNeeded) return <div className="c-page"><div className="c-banner">Finish the one-time setup on the Today page first.</div></div>

  return (
    <div className="c-page" style={{ maxWidth: 980 }}>
      <div className="c-head">
        <div>
          <div className="c-eyebrow">CEO · Inbox</div>
          <div className="c-title">Capture now. Decide later.</div>
          <div className="c-sub">Everything you dump here gets sorted once a day during Tomorrow Setup.</div>
        </div>
        <div className="c-head-actions">
          <button className="c-btn c-btn-ink" disabled={!inbox.length} onClick={() => setTriage(true)}>Triage {inbox.length || ''} →</button>
        </div>
      </div>

      <form className="c-capture" style={{ marginBottom: 24 }} onSubmit={e => { e.preventDefault(); if (text.trim()) { capture(text); setText('') } }}>
        <input autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="Type anything and press Enter…" />
        <button className="c-btn c-btn-sky" style={{ border: 0 }}>Capture</button>
      </form>

      <div className="c-stack">
        <Section title="Inbox" count={inbox.length} hint="Unsorted">
          {inbox.length === 0 && <div className="c-empty">Inbox zero. Nice.</div>}
          {inbox.map(t => <TaskRow key={t.id} task={t} focusCount={focusCount} />)}
        </Section>

        <Section title="Next" count={next.length} hint="Sorted by priority, then due date">
          {next.length === 0 && <div className="c-empty">Nothing queued.</div>}
          {next.map(t => <TaskRow key={t.id} task={t} focusCount={focusCount} />)}
        </Section>

        {portalTasks.length > 0 && (
          <Section title="From the RLC Portal" count={portalTasks.length} hint="Deal & contact tasks · edit in the portal">
            {portalTasks.map(i => (
              <a key={i.key} href={i.href} target="_blank" rel="noreferrer" className="c-task" style={{ textDecoration: 'none', color: 'inherit', gridTemplateColumns: '84px 1fr auto' }}>
                <span className={`c-chip${i.date < today ? ' red' : ''}`}>{i.date < today ? 'Overdue' : fmtDate(i.date, { month: 'short', day: 'numeric' })}</span>
                <span className="c-task-title">{i.title.replace(/^Task due — /, '')}</span>
                <span className="c-link" style={{ fontSize: 12 }}>Open ↗</span>
              </a>
            ))}
          </Section>
        )}

        <div>
          <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => setShowDone(s => !s)}>{showDone ? 'Hide' : 'Show'} completed ({done.length})</button>
          {showDone && (
            <div className="c-card" style={{ marginTop: 10 }}>
              {done.map(t => <TaskRow key={t.id} task={t} focusCount={focusCount} />)}
            </div>
          )}
        </div>
      </div>

      {triage && <Triage tasks={inbox} focusCount={focusCount} onClose={() => setTriage(false)} />}
      <div style={{ fontSize: 12, marginTop: 24 }} className="c-muted">Portal tasks link to <a className="c-link" href={PORTAL_URL} target="_blank" rel="noreferrer">the RLC Portal</a>.</div>
    </div>
  )
}

function Section({ title, count, hint, children }) {
  return (
    <div className="c-card">
      <div className="c-card-head">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div className="c-card-title">{title}</div>
          <span className="c-muted" style={{ fontSize: 12 }}>{hint}</span>
        </div>
        <span className="c-chip">{count}</span>
      </div>
      {children}
    </div>
  )
}

function TaskRow({ task: t, focusCount }) {
  const { updateTask, deleteTask } = useCeo()
  const [scheduling, setScheduling] = useState(false)
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(t.title)
  const today = todayISO()
  const isDone = t.status === 'done'
  const focused = t.focus_date === today
  const cyclePrio = () => updateTask(t, { priority: PRIOS[(PRIOS.indexOf(t.priority) + 1) % 3], status: t.status === 'inbox' ? 'next' : t.status })

  return (
    <div className="c-task">
      <button className={`c-check${isDone ? ' done' : ''}`} style={{ padding: 0, border: 0 }} aria-label="Complete"
        onClick={() => updateTask(t, isDone ? { status: 'next', completed_at: null } : { status: 'done', completed_at: new Date().toISOString() })}>
        <span className="c-box">{isDone && <Tick />}</span>
      </button>
      <div style={{ minWidth: 0 }}>
        {editing
          ? <input className="c-input" autoFocus value={title} onChange={e => setTitle(e.target.value)}
              onBlur={() => { setEditing(false); if (title.trim() && title !== t.title) updateTask(t, { title: title.trim() }) }}
              onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }} />
          : <div className="c-task-title" onDoubleClick={() => setEditing(true)} style={isDone ? { textDecoration: 'line-through', color: 'var(--light)' } : undefined}>{t.title}</div>}
        <div className="c-task-meta">
          {t.priority && <button className={`c-chip c-prio-${t.priority}`} onClick={cyclePrio}>{t.priority}</button>}
          {focused && <span className="c-chip sky">★ Today</span>}
          {t.due_date && <span className={`c-chip${t.due_date < today && !isDone ? ' red' : ''}`}>Due {fmtDate(t.due_date, { month: 'short', day: 'numeric' })}</span>}
          {t.scheduled_date && <span className="c-chip">On calendar {fmtDate(t.scheduled_date, { month: 'short', day: 'numeric' })}{t.scheduled_time ? ` · ${fmtTime(t.scheduled_time)}` : ''}</span>}
          {t.category && CATEGORIES[t.category] && <span className="c-chip" style={{ color: CATEGORIES[t.category].color }}>{CATEGORIES[t.category].label}</span>}
        </div>
        {scheduling && <ScheduleForm task={t} onDone={() => setScheduling(false)} />}
      </div>
      {!isDone && (
        <div className="c-task-actions">
          {!t.priority && PRIOS.map(p => <button key={p} className={`c-chip c-prio-${p}`} onClick={() => updateTask(t, { priority: p, status: 'next' })}>{p[0].toUpperCase()}</button>)}
          <button className={`c-chip${focused ? ' sky' : ''}`} disabled={!focused && focusCount >= 3} title={!focused && focusCount >= 3 ? 'Top 3 is full' : 'Today\'s Top 3'}
            onClick={() => updateTask(t, { focus_date: focused ? null : today, status: t.status === 'inbox' ? 'next' : t.status })}>★</button>
          <button className="c-chip" onClick={() => setScheduling(s => !s)}>Schedule</button>
          <button className="c-chip" onClick={() => deleteTask(t.id)} aria-label="Delete">✕</button>
        </div>
      )}
    </div>
  )
}

function ScheduleForm({ task, onDone }) {
  const { updateTask } = useCeo()
  const [date, setDate] = useState(task.scheduled_date || todayISO())
  const [time, setTime] = useState(task.scheduled_time || '')
  const [due, setDue] = useState(task.due_date || '')
  const [dur, setDur] = useState(task.duration_min || 30)
  return (
    <div style={{ background: 'var(--mist)', border: '1px solid var(--border)', padding: 12, marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="c-row">
        <div className="c-field"><label className="c-label">Do it on</label><input className="c-input" type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div className="c-field"><label className="c-label">At (optional)</label><input className="c-input" type="time" step="300" value={time} onChange={e => setTime(e.target.value)} /></div>
        <div className="c-field"><label className="c-label">Minutes</label><input className="c-input" type="number" min="5" step="5" value={dur} onChange={e => setDur(Number(e.target.value))} /></div>
        <div className="c-field"><label className="c-label">Due (optional)</label><input className="c-input" type="date" value={due} onChange={e => setDue(e.target.value)} /></div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="c-btn c-btn-ghost c-btn-sm" onClick={onDone}>Cancel</button>
        <button className="c-btn c-btn-ink c-btn-sm" onClick={() => {
          updateTask(task, { scheduled_date: date || null, scheduled_time: time || null, due_date: due || null, duration_min: dur, status: task.status === 'inbox' ? 'next' : task.status })
          onDone()
        }}>Put on calendar</button>
      </div>
    </div>
  )
}

/** One item at a time: do today / next / schedule / delete. Built for a busy brain. */
function Triage({ tasks, focusCount, onClose }) {
  const { updateTask, deleteTask } = useCeo()
  const [queue] = useState(() => tasks.map(t => t.id))
  const [idx, setIdx] = useState(0)
  const [scheduling, setScheduling] = useState(false)
  const all = useCeo().tasks
  const t = all.find(x => x.id === queue[idx])
  const next = () => { setScheduling(false); setIdx(i => i + 1) }
  const today = todayISO()

  if (!t || idx >= queue.length) {
    return (
      <Modal eyebrow="Triage" title="Inbox sorted ✓" onClose={onClose} footer={<button className="c-btn c-btn-sky" onClick={onClose}>Done</button>}>
        <div style={{ fontSize: 14 }}>Everything has a home. Back to the plan.</div>
      </Modal>
    )
  }
  return (
    <Modal eyebrow={`Triage · ${idx + 1} of ${queue.length}`} title={t.title} onClose={onClose}>
      <div className="c-label">What is this?</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        <button className="c-btn c-btn-sky" disabled={focusCount >= 3} onClick={() => { updateTask(t, { status: 'next', priority: 'high', focus_date: today }); next() }}>
          ★ Top 3 today{focusCount >= 3 ? ' (full)' : ''}
        </button>
        <button className="c-btn" onClick={() => { updateTask(t, { status: 'next', priority: 'high' }); next() }}>Next · High</button>
        <button className="c-btn" onClick={() => { updateTask(t, { status: 'next', priority: 'medium' }); next() }}>Next · Medium</button>
        <button className="c-btn" onClick={() => { updateTask(t, { status: 'next', priority: 'low' }); next() }}>Someday · Low</button>
        <button className="c-btn" onClick={() => setScheduling(true)}>Schedule it…</button>
        <button className="c-btn" onClick={() => { updateTask(t, { status: 'done', completed_at: new Date().toISOString() }); next() }}>Already done</button>
        <button className="c-btn c-btn-danger" onClick={() => { deleteTask(t.id); next() }}>Delete</button>
        <button className="c-btn c-btn-ghost" onClick={next}>Skip</button>
      </div>
      {scheduling && <ScheduleForm task={t} onDone={next} />}
    </Modal>
  )
}
