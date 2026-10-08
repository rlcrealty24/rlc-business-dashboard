import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Checklist, CategoryTag, ItemBadges, Modal, Progress } from './ui.jsx'
import { useCeo } from './CeoStore.jsx'
import BlockModal from './BlockModal.jsx'
import { reminderLabel } from './constants.js'
import { fmtDate, fmtRange, recurrenceLabel } from './recurrence.js'
import { PLAN_DAYS } from '../data/fitnessData.js'

/** Detail view for any calendar item — CEO block, portal item, life event, bill or task */
export default function ItemSheet({ item, onClose }) {
  const { toggleCheck, setOccurrence, deleteBlock, splitBlock, updateTask, deleteTask } = useCeo()
  const [editing, setEditing] = useState(false)
  const [moving, setMoving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (editing) return <BlockModal initial={item.block} scopeDate={item.occDate} onClose={() => { setEditing(false); onClose() }} />

  const isCeo = item.source === 'ceo'
  const recurring = isCeo && item.block.recurrence?.freq !== 'none'
  const doneCount = item.checked?.length || 0
  const total = item.checklist?.length || 0
  const when = `${fmtDate(item.date, { weekday: 'long', month: 'long', day: 'numeric' })} · ${item.allDay ? 'All day' : fmtRange(item.start, item.end)}`
  const workout = isCeo && item.block.link === '/fitness' ? PLAN_DAYS[new Date(item.date + 'T00:00:00').getDay()] : null

  const footer = isCeo ? (
    <>
      {!confirmDelete ? (
        <button className="c-btn c-btn-danger c-btn-sm" onClick={() => setConfirmDelete(true)}>Delete…</button>
      ) : (
        <span style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginRight: 'auto' }}>
          {recurring && <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { setOccurrence(item.blockId, item.occDate, { status: 'skipped' }); onClose() }}>Just this day</button>}
          {recurring && <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { splitBlock(item.block, item.occDate, null); onClose() }}>This &amp; following</button>}
          <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { deleteBlock(item.blockId); onClose() }}>{recurring ? 'Entire series' : 'Delete'}</button>
        </span>
      )}
      {item.status === 'skipped'
        ? <button className="c-btn c-btn-sm" onClick={() => setOccurrence(item.blockId, item.occDate, { status: 'open' })}>Restore</button>
        : recurring && <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => { setOccurrence(item.blockId, item.occDate, { status: 'skipped' }); onClose() }}>Skip this one</button>}
      <button className="c-btn c-btn-sm" onClick={() => setMoving(m => !m)}>Move</button>
      <button className="c-btn c-btn-sm" onClick={() => setEditing(true)}>Edit</button>
      <button className="c-btn c-btn-sky c-btn-sm" onClick={() => setOccurrence(item.blockId, item.occDate, { status: item.status === 'done' ? 'open' : 'done' })}>
        {item.status === 'done' ? 'Mark not done' : 'Mark done'}
      </button>
    </>
  ) : item.source === 'task' ? (
    <>
      <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { deleteTask(item.task.id); onClose() }}>Delete</button>
      <button className="c-btn c-btn-sm" onClick={() => { updateTask(item.task, { scheduled_date: null, scheduled_time: null }); onClose() }}>Unschedule</button>
      <button className="c-btn c-btn-sky c-btn-sm" onClick={() => {
        const done = item.task.status !== 'done'
        updateTask(item.task, { status: done ? 'done' : 'next', completed_at: done ? new Date().toISOString() : null }); onClose()
      }}>{item.task.status === 'done' ? 'Reopen' : 'Complete'}</button>
    </>
  ) : item.href ? (
    item.href.startsWith('http')
      ? <a className="c-btn c-btn-sky c-btn-sm" href={item.href} target="_blank" rel="noreferrer">Open in RLC Portal ↗</a>
      : <Link className="c-btn c-btn-sky c-btn-sm" to={item.href} onClick={onClose}>Open</Link>
  ) : null

  return (
    <Modal eyebrow={when} title={item.title} onClose={onClose} footer={footer}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <CategoryTag item={item} />
        {isCeo && <span className="c-chip">{recurrenceLabel(item.block)}</span>}
        {isCeo && item.protected && <span className="c-chip sky">Protected</span>}
        <ItemBadges item={item} />
      </div>

      {item.topic && (
        <div className="c-banner sky"><div><div className="c-label">This week&apos;s topic</div><div className="c-serif" style={{ fontSize: 20, marginTop: 4 }}>{item.topic}</div></div></div>
      )}

      {item.source === 'portal' && (
        <div className="c-banner sky" style={{ fontSize: 12 }}>
          Lives in the RLC portal. Edit it there and the change shows here automatically — nothing is copied, so nothing can duplicate.
        </div>
      )}
      {item.bumpedBy && (
        <div className="c-banner">This block overlaps <b>{item.bumpedBy}</b>, which takes priority. Use <b>Move</b> to give it a new time, or skip it today.</div>
      )}
      {item.clashes?.length > 0 && (
        <div className="c-banner">Two things are booked at the same time: <b>{item.clashes.join(', ')}</b>. Move one of them.</div>
      )}

      {moving && isCeo && <MoveForm item={item} onDone={() => { setMoving(false); onClose() }} />}

      {total > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span className="c-label">Checklist</span><span className="c-label">{doneCount}/{total}</span>
          </div>
          <Progress value={total ? doneCount / total : 0} />
          <Checklist items={item.checklist} checked={item.checked} onToggle={id => toggleCheck(item, id)} />
        </div>
      )}

      {workout && (
        <div className="c-card" style={{ borderLeft: `3px solid ${workout.color}` }}>
          <div className="c-card-body">
            <div className="c-label">Today&apos;s workout · from Fitness</div>
            <div className="c-serif" style={{ fontSize: 18, margin: '4px 0 8px' }}>{workout.name}</div>
            {workout.exercises.map(ex => <div key={ex.name} style={{ fontSize: 13, padding: '3px 0' }}>{ex.name} <span className="c-muted">— {ex.sets}</span></div>)}
            <Link className="c-link" to="/fitness" onClick={onClose} style={{ fontSize: 12, display: 'inline-block', marginTop: 8 }}>Log it in Fitness →</Link>
          </div>
        </div>
      )}

      {item.description && <div className="c-pre">{item.description}</div>}
      {item.location && <div style={{ fontSize: 13 }}><span className="c-label">Where · </span>{item.location}</div>}
      {item.meetingUrl && <a className="c-btn c-btn-ink c-btn-sm" style={{ alignSelf: 'flex-start' }} href={item.meetingUrl} target="_blank" rel="noreferrer">Join meeting ↗</a>}
      {isCeo && item.block.link && item.block.link !== '/fitness' && (
        <Link className="c-link" to={item.block.link} onClick={onClose} style={{ fontSize: 13 }}>Open {item.block.link.replace('/', '')} →</Link>
      )}
      {item.reminders?.length > 0 && (
        <div style={{ fontSize: 12 }} className="c-muted">Reminders: {item.reminders.map(reminderLabel).join(' · ')} before</div>
      )}
    </Modal>
  )
}

function MoveForm({ item, onDone }) {
  const { setOccurrence, saveBlock } = useCeo()
  const pad = n => String(n).padStart(2, '0')
  const t = m => (m === null ? '' : `${pad(Math.floor(m / 60))}:${pad(m % 60)}`)
  const [date, setDate] = useState(item.date)
  const [start, setStart] = useState(t(item.start))
  const [end, setEnd] = useState(t(item.end))
  const oneOff = item.block.recurrence?.freq === 'none'

  function save() {
    if (oneOff) saveBlock({ ...item.block, start_date: date, start_time: start || null, end_time: end || null })
    else setOccurrence(item.blockId, item.occDate, { new_date: date === item.occDate ? null : date, new_start: start || null, new_end: end || null })
    onDone()
  }
  return (
    <div className="c-card" style={{ padding: 16, background: 'var(--mist)' }}>
      <div className="c-label" style={{ marginBottom: 10 }}>{oneOff ? 'Move this event' : 'Move just this occurrence'}</div>
      <div className="c-row">
        <input className="c-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
        {!item.allDay && <input className="c-input" type="time" step="300" value={start} onChange={e => setStart(e.target.value)} />}
        {!item.allDay && <input className="c-input" type="time" step="300" value={end} onChange={e => setEnd(e.target.value)} />}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        {item.moved && !oneOff && (
          <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => { setOccurrence(item.blockId, item.occDate, { new_date: null, new_start: null, new_end: null }); onDone() }}>Reset to original</button>
        )}
        <button className="c-btn c-btn-ink c-btn-sm" onClick={save}>Save move</button>
      </div>
    </div>
  )
}
