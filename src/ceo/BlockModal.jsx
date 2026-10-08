import { useMemo, useState } from 'react'
import { Modal } from './ui.jsx'
import { useCeo } from './CeoStore.jsx'
import { CATEGORIES, DATE_TYPES, REMINDER_PRESETS, reminderLabel, uid } from './constants.js'
import { DAY_SHORT, addDays, expandBlocks, fmtDate, fmtRange, parseISO, resolveClashes, todayISO } from './recurrence.js'

const REPEATS = [
  ['none', 'Does not repeat'],
  ['daily', 'Every day'],
  ['weekdays', 'Weekdays (Mon–Fri)'],
  ['weekly', 'Weekly on…'],
  ['monthly', 'Monthly (same date)'],
  ['monthly_last', 'Last day of every month'],
  ['yearly', 'Every year'],
]

function repeatKey(r) {
  if (r?.freq === 'weekly' && [...(r.byDay || [])].sort().join(',') === '1,2,3,4,5') return 'weekdays'
  return r?.freq || 'none'
}

const toLines = list => (list || []).map(c => c.text).join('\n')
function fromLines(text, previous = []) {
  const byText = new Map(previous.map(c => [c.text.trim(), c.id]))
  return text.split('\n').map(s => s.trim()).filter(Boolean)
    .map(t => ({ id: byText.get(t) || uid().slice(0, 8), text: t }))
}

export default function BlockModal({ initial, scopeDate, onClose }) {
  const { blocks, overrides, saveBlock, splitBlock, deleteBlock } = useCeo()
  const isNew = !blocks.some(b => b.id === initial?.id)
  const isDate = initial?.kind === 'date'

  const [b, setB] = useState(() => ({
    title: '', category: isDate ? 'dates' : 'business', kind: 'block', start_date: todayISO(), until_date: null,
    all_day: isDate, start_time: isDate ? null : '09:00', end_time: isDate ? null : '10:00',
    recurrence: { freq: 'none' }, description: '', checklist: [], rotation: null,
    reminders: isDate ? [10080] : [5], location: '', meeting_url: '', link: null,
    unconfirmed: false, protected: false, ...initial,
  }))
  const [checkText, setCheckText] = useState(() => initial?.checklist?.length ? toLines(initial.checklist)
    : isNew && isDate ? (DATE_TYPES[initial?.date_type]?.checklist || []).join('\n') : '')
  const [rotationText, setRotationText] = useState((initial?.rotation || []).join('\n'))
  const [scope, setScope] = useState('all')       // all | following
  const [saving, setSaving] = useState(false)
  const set = patch => setB(prev => ({ ...prev, ...patch }))
  const rk = repeatKey(b.recurrence)
  const recurring = (initial?.recurrence?.freq || 'none') !== 'none'

  function setRepeat(key) {
    const startDow = parseISO(b.start_date).getDay()
    const map = {
      none: { freq: 'none' }, daily: { freq: 'daily' }, weekdays: { freq: 'weekly', byDay: [1, 2, 3, 4, 5] },
      weekly: { freq: 'weekly', byDay: b.recurrence?.byDay?.length ? b.recurrence.byDay : [startDow] },
      monthly: { freq: 'monthly' }, monthly_last: { freq: 'monthly_last' }, yearly: { freq: 'yearly' },
    }
    set({ recurrence: map[key] })
  }
  function toggleDay(d) {
    const by = new Set(b.recurrence.byDay || [])
    by.has(d) ? by.delete(d) : by.add(d)
    set({ recurrence: { ...b.recurrence, byDay: [...by].sort() } })
  }
  function toggleReminder(min) {
    const r = new Set(b.reminders || [])
    r.has(min) ? r.delete(min) : r.add(min)
    set({ reminders: [...r].sort((x, y) => y - x) })
  }

  const draft = useMemo(() => ({
    ...b,
    id: b.id || 'draft',
    checklist: fromLines(checkText, initial?.checklist),
    rotation: rotationText.trim() ? rotationText.split('\n').map(s => s.trim()).filter(Boolean) : null,
  }), [b, checkText, rotationText, initial])

  // Clash preview for the next 3 weeks
  const clashes = useMemo(() => {
    if (draft.all_day || !draft.start_time || !draft.end_time || !draft.title) return []
    const from = draft.start_date > todayISO() ? draft.start_date : todayISO()
    const to = addDays(from, 20)
    const others = blocks.filter(x => x.id !== draft.id)
    const occ = expandBlocks([...others, draft], overrides, from, to)
    const byDate = new Map()
    for (const o of occ) { if (!byDate.has(o.date)) byDate.set(o.date, []); byDate.get(o.date).push(o) }
    const found = []
    for (const [date, list] of byDate) {
      resolveClashes(list)
      for (const o of list) {
        if (o.blockId === draft.id && o.clashes.length) found.push({ date, text: `Clashes with ${o.clashes.join(', ')}`, kind: 'clash' })
        else if (o.blockId === draft.id && o.bumpedBy) found.push({ date, text: `Gives way to ${o.bumpedBy}`, kind: 'bump' })
        else if (o.blockId !== draft.id && o.bumpedBy === draft.title) found.push({ date, text: `Takes over ${o.title} (${fmtRange(o.start, o.end)})`, kind: 'bump' })
      }
    }
    return found.sort((x, y) => x.date.localeCompare(y.date)).slice(0, 6)
  }, [draft, blocks, overrides])

  async function save() {
    if (!draft.title.trim()) return
    setSaving(true)
    const row = { ...draft, id: draft.id === 'draft' ? uid() : draft.id }
    if (row.all_day) { row.start_time = null; row.end_time = null }
    if (!isNew && recurring && scope === 'following' && scopeDate) await splitBlock(initial, scopeDate, row)
    else await saveBlock(row)
    setSaving(false)
    onClose(row)
  }

  const presets = REMINDER_PRESETS.filter(p => (b.all_day ? p.min >= 1440 : true))
  const extraReminders = (b.reminders || []).filter(m => !presets.some(p => p.min === m))

  return (
    <Modal
      eyebrow={isNew ? (isDate ? 'New date' : 'New block') : 'Edit'}
      title={b.title || (isDate ? 'Birthday, event or deadline' : 'Untitled block')}
      onClose={() => onClose(null)}
      footer={<>
        {!isNew && !scopeDate && (
          <button className="c-btn c-btn-danger c-btn-sm" style={{ marginRight: 'auto' }}
            onClick={() => { if (window.confirm(`Delete "${initial.title}"${recurring ? ' and every repeat' : ''}?`)) { deleteBlock(initial.id); onClose(null) } }}>
            Delete
          </button>
        )}
        <button className="c-btn c-btn-ghost" onClick={() => onClose(null)}>Cancel</button>
        <button className="c-btn c-btn-sky" onClick={save} disabled={saving || !b.title.trim()}>{saving ? 'Saving…' : 'Save'}</button>
      </>}
    >
      <div className="c-field">
        <label className="c-label">Title</label>
        <input className="c-input" autoFocus value={b.title} onChange={e => set({ title: e.target.value })}
          placeholder={isDate ? 'e.g. Mom\'s birthday' : 'e.g. Lead Gen & Prospecting'} />
      </div>

      <div className="c-row">
        {isDate && (
          <div className="c-field">
            <label className="c-label">Type</label>
            <select className="c-select" value={b.date_type || 'event'} onChange={e => {
              const t = DATE_TYPES[e.target.value]
              set({ date_type: e.target.value, category: t.category, recurrence: t.recurrence, reminders: t.reminders })
              if (isNew) setCheckText((t.checklist || []).join('\n'))
            }}>
              {Object.entries(DATE_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        )}
        <div className="c-field">
          <label className="c-label">Category</label>
          <select className="c-select" value={b.category} onChange={e => set({ category: e.target.value })}>
            {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div className="c-field">
          <label className="c-label">{rk === 'none' || isDate ? 'Date' : 'Starts'}</label>
          <input className="c-input" type="date" value={b.start_date} onChange={e => set({ start_date: e.target.value })} />
        </div>
      </div>

      <div className="c-row">
        <label className="c-check-row" style={{ alignSelf: 'end', paddingBottom: 10 }}>
          <input type="checkbox" checked={b.all_day} onChange={e => set({ all_day: e.target.checked, start_time: e.target.checked ? null : '09:00', end_time: e.target.checked ? null : '10:00' })} /> All day
        </label>
        {!b.all_day && <>
          <div className="c-field">
            <label className="c-label">Start</label>
            <input className="c-input" type="time" step="300" value={b.start_time || ''} onChange={e => set({ start_time: e.target.value })} />
          </div>
          <div className="c-field">
            <label className="c-label">End</label>
            <input className="c-input" type="time" step="300" value={b.end_time || ''} onChange={e => set({ end_time: e.target.value })} />
          </div>
        </>}
      </div>

      <div className="c-row">
        <div className="c-field">
          <label className="c-label">Repeat</label>
          {b.recurrence.freq === 'yearly_nth'
            ? <div className="c-input" style={{ background: 'var(--mist)' }}>Every year (floating date, e.g. Thanksgiving)</div>
            : <select className="c-select" value={rk} onChange={e => setRepeat(e.target.value)}>
                {REPEATS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>}
        </div>
        {rk !== 'none' && (
          <div className="c-field">
            <label className="c-label">Ends (optional)</label>
            <input className="c-input" type="date" value={b.until_date || ''} onChange={e => set({ until_date: e.target.value || null })} />
          </div>
        )}
      </div>
      {rk === 'weekly' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DAY_SHORT.map((d, i) => (
            <button key={d} type="button" className={`c-chip${b.recurrence.byDay?.includes(i) ? ' on' : ''}`} onClick={() => toggleDay(i)}>{d}</button>
          ))}
        </div>
      )}

      <div className="c-field">
        <label className="c-label">Checklist — one item per line</label>
        <textarea className="c-textarea" style={{ minHeight: 130 }} value={checkText} onChange={e => setCheckText(e.target.value)}
          placeholder={isDate ? 'Buy a gift\nCard\nCall on the day' : 'Open the CRM\nCall 10 prospects\nLog numbers'} />
      </div>

      <div className="c-field">
        <label className="c-label">Notes / agenda</label>
        <textarea className="c-textarea" value={b.description || ''} onChange={e => set({ description: e.target.value })} />
      </div>

      <div className="c-field">
        <label className="c-label">Reminders (before start{b.all_day ? ', at 8 AM' : ''})</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {presets.map(p => (
            <button key={p.min} type="button" className={`c-chip${b.reminders?.includes(p.min) ? ' on' : ''}`} onClick={() => toggleReminder(p.min)}>{p.label}</button>
          ))}
          {extraReminders.map(m => (
            <button key={m} type="button" className="c-chip on" onClick={() => toggleReminder(m)}>{reminderLabel(m)} ✕</button>
          ))}
          <CustomReminder onAdd={toggleReminder} />
        </div>
      </div>

      <details>
        <summary className="c-label" style={{ cursor: 'pointer', padding: '4px 0' }}>More options</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
          <div className="c-row">
            <div className="c-field">
              <label className="c-label">Location</label>
              <input className="c-input" value={b.location || ''} onChange={e => set({ location: e.target.value })} />
            </div>
            <div className="c-field">
              <label className="c-label">Meeting link (Zoom)</label>
              <input className="c-input" value={b.meeting_url || ''} onChange={e => set({ meeting_url: e.target.value })} placeholder="https://zoom.us/j/…" />
            </div>
          </div>
          <div className="c-field">
            <label className="c-label">Weekly rotating topic — one per line (optional)</label>
            <textarea className="c-textarea" value={rotationText} onChange={e => setRotationText(e.target.value)} placeholder={'Sales strategies\nLead generation\nContracts'} />
          </div>
          <label className="c-check-row">
            <input type="checkbox" checked={b.protected} onChange={e => set({ protected: e.target.checked })} />
            Protected time — wins over flexible blocks when they overlap
          </label>
          <label className="c-check-row">
            <input type="checkbox" checked={b.unconfirmed} onChange={e => set({ unconfirmed: e.target.checked })} />
            Date not confirmed — show UNCONFIRMED on it
          </label>
        </div>
      </details>

      {clashes.length > 0 && (
        <div className="c-banner">
          <div>
            <div className="c-label" style={{ color: '#92400e', marginBottom: 6 }}>Schedule check — next 3 weeks</div>
            {clashes.map((c, i) => (
              <div key={i} style={{ fontSize: 13 }}>{c.kind === 'clash' ? '⚠︎' : '↪︎'} {fmtDate(c.date)} — {c.text}</div>
            ))}
          </div>
        </div>
      )}

      {!isNew && recurring && scopeDate && (
        <div className="c-field">
          <label className="c-label">Apply changes to</label>
          <div className="c-seg" style={{ alignSelf: 'flex-start' }}>
            <button type="button" className={scope === 'all' ? 'on' : ''} onClick={() => setScope('all')}>Every occurrence</button>
            <button type="button" className={scope === 'following' ? 'on' : ''} onClick={() => setScope('following')}>From {fmtDate(scopeDate, { month: 'short', day: 'numeric' })} on</button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function CustomReminder({ onAdd }) {
  const [n, setN] = useState('')
  const [unit, setUnit] = useState('1440')
  return (
    <span style={{ display: 'inline-flex', gap: 4 }}>
      <input className="c-input" style={{ width: 64, padding: '4px 8px', fontSize: 12 }} type="number" min="1" placeholder="#" value={n} onChange={e => setN(e.target.value)} />
      <select className="c-select" style={{ width: 92, padding: '4px 8px', fontSize: 12 }} value={unit} onChange={e => setUnit(e.target.value)}>
        <option value="1">min</option><option value="60">hours</option><option value="1440">days</option><option value="10080">weeks</option>
      </select>
      <button type="button" className="c-chip" onClick={() => { if (Number(n) > 0) { onAdd(Number(n) * Number(unit)); setN('') } }}>Add</button>
    </span>
  )
}
