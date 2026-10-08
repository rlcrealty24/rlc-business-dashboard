import { useMemo, useState } from 'react'
import '../ceo/ceo.css'
import { useCeo } from '../ceo/CeoStore.jsx'
import { DATE_TYPES, reminderLabel } from '../ceo/constants.js'
import { daysBetween, fmtDate, nextOccurrence, recurrenceLabel, todayISO } from '../ceo/recurrence.js'
import BlockModal from '../ceo/BlockModal.jsx'

const GROUPS = [
  ['birthday', 'Birthdays', 'Reminder 1 week out — time to buy something.'],
  ['event', 'Events', 'Reminders far enough ahead to prepare.'],
  ['deadline', 'Deadlines', 'Licenses, taxes, renewals, contracts.'],
  ['campaign', 'Campaigns', 'Launches and promotions you run.'],
  ['marketing', 'Marketing dates', 'Warnings at 6 weeks and 2 weeks — that\'s when the work happens.'],
]

export default function Dates() {
  const { blocks, setupNeeded } = useCeo()
  const [editing, setEditing] = useState(null)
  const today = todayISO()

  const dated = useMemo(() => blocks
    .filter(b => b.kind === 'date')
    .map(b => ({ b, next: nextOccurrence(b, today) }))
    .sort((x, y) => (x.next || '9999').localeCompare(y.next || '9999')), [blocks, today])

  const newDate = type => setEditing({
    kind: 'date', date_type: type, all_day: true, start_time: null, end_time: null, start_date: today,
    category: DATE_TYPES[type].category, recurrence: DATE_TYPES[type].recurrence, reminders: DATE_TYPES[type].reminders,
  })

  if (setupNeeded) return <div className="c-page"><div className="c-banner">Finish the one-time setup on the Today page first.</div></div>

  return (
    <div className="c-page" style={{ maxWidth: 1080 }}>
      <div className="c-head">
        <div>
          <div className="c-eyebrow">CEO · Dates &amp; Reminders</div>
          <div className="c-title">Never caught off guard</div>
          <div className="c-sub">Birthdays, events, deadlines and campaigns — with lead-time reminders. Not sure of a date? Mark it unconfirmed.</div>
        </div>
        <div className="c-head-actions">
          {Object.entries(DATE_TYPES).map(([k, v]) => (
            <button key={k} className={`c-btn c-btn-sm${k === 'birthday' ? ' c-btn-sky' : ''}`} onClick={() => newDate(k)}>+ {v.label}</button>
          ))}
        </div>
      </div>

      <div className="c-stack">
        {GROUPS.map(([type, title, hint]) => {
          const rows = dated.filter(d => (d.b.date_type || 'event') === type)
          return (
            <div key={type} className="c-card">
              <div className="c-card-head">
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                  <div className="c-card-title">{title}</div>
                  <span className="c-muted" style={{ fontSize: 12 }}>{hint}</span>
                </div>
                <button className="c-btn c-btn-sm c-btn-ghost" onClick={() => newDate(type)}>+ Add</button>
              </div>
              {rows.length === 0 && <div className="c-empty">None yet.</div>}
              {rows.map(({ b, next }) => {
                const inDays = next ? daysBetween(today, next) : null
                return (
                  <div key={b.id} className="c-tl-row" style={{ gridTemplateColumns: '110px 1fr auto' }} onClick={() => setEditing(b)}>
                    <div>
                      <div className="c-serif" style={{ fontSize: 18 }}>{next ? fmtDate(next, { month: 'short', day: 'numeric' }) : '—'}</div>
                      <div className="c-muted" style={{ fontSize: 11 }}>{inDays === null ? 'past' : inDays === 0 ? 'today' : `in ${inDays} day${inDays === 1 ? '' : 's'}`}</div>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        {b.title}
                        {b.unconfirmed && <span className="c-chip warn">Unconfirmed</span>}
                      </div>
                      <div className="c-muted" style={{ fontSize: 12, marginTop: 3 }}>
                        {recurrenceLabel(b)}{b.reminders?.length ? ` · reminders ${b.reminders.map(reminderLabel).join(', ')} before` : ' · no reminders'}
                      </div>
                    </div>
                    <span className={`c-chip${inDays !== null && inDays <= 14 ? ' sky' : ''}`}>{inDays !== null && inDays <= 14 ? 'Soon' : 'Edit'}</span>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      {editing && <BlockModal initial={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}
