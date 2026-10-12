// Review card for a pasted list: AI splits it into tasks, you check/edit, then add them all.
import { useEffect, useState } from 'react'
import { useCeo } from './CeoStore.jsx'
import { CATEGORIES } from './constants.js'
import { todayISO } from './recurrence.js'
import { toast } from './ui.jsx'
import { localTasks, requestReprioritize, splitIntoTasks } from './brainDump.js'

export default function BrainDumpReview({ text, onDone }) {
  const { tasks, saveTask } = useCeo()
  const [rows, setRows] = useState(null)
  const [note, setNote] = useState('')
  const [secs, setSecs] = useState(0)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let alive = true
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    const d = new Date()
    splitIntoTasks(text, {
      today: todayISO(), weekday: d.toLocaleDateString('en-US', { weekday: 'long' }),
      existing: tasks.filter(x => x.status !== 'done').map(x => x.title),
    })
      .then(r => { if (alive) { setRows(r.tasks.map(x => ({ ...x, keep: !x.duplicate_of }))); setNote(r.note) } })
      .catch(e => { if (alive) { setRows(localTasks(text).map(x => ({ ...x, keep: true }))); setNote(`AI sorting wasn't available (${e.message}) — split line by line instead. Flagged (*) items are high priority.`) } })
      .finally(() => clearInterval(t))
    return () => { alive = false; clearInterval(t) }
  }, [text]) // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const chosen = (rows || []).filter(r => r.keep && r.title.trim())

  async function addAll() {
    setSaving(true)
    for (const r of chosen) {
      await saveTask({
        title: r.title.trim(), status: 'next', priority: r.priority, due_date: r.due || null, category: r.category || null,
        duration_min: r.minutes || 15, notes: [r.notes, r.first_step && `First step: ${r.first_step}`].filter(Boolean).join('\n') || null,
      })
    }
    toast(`${chosen.length} tasks added`, 'Sorting your whole list now — see "What to do first".')
    requestReprioritize()
    setSaving(false)
    onDone(true)
  }

  return (
    <div className="c-card" style={{ borderColor: 'var(--sky)' }}>
      <div className="c-card-head" style={{ background: 'var(--sky-soft)' }}>
        <div className="c-card-title">{rows ? `${rows.length} tasks from your list` : 'Turning your list into tasks…'}</div>
        <span className="c-muted" style={{ fontSize: 12 }}>nothing is saved until you add them</span>
      </div>

      {!rows && <div className="c-card-body"><div className="c-serif" style={{ fontSize: 18 }}>Reading your list… {secs}s</div><div className="c-muted" style={{ fontSize: 12, marginTop: 4 }}>Splitting, cleaning up the wording, and setting priorities.</div></div>}

      {rows && note && <div className="c-muted" style={{ padding: '10px 20px 0', fontSize: 12, fontStyle: 'italic' }}>{note}</div>}

      {rows && rows.map((r, i) => (
        <div key={i} className="c-task" style={{ gridTemplateColumns: '22px 1fr', opacity: r.keep ? 1 : 0.5 }}>
          <input type="checkbox" checked={r.keep} onChange={e => set(i, { keep: e.target.checked })} style={{ marginTop: 10 }} aria-label="Include" />
          <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input className="c-input" value={r.title} onChange={e => set(i, { title: e.target.value })} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="c-select" style={{ width: 'auto' }} value={r.priority} onChange={e => set(i, { priority: e.target.value })}>
                {['high', 'medium', 'low'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="c-input" type="date" style={{ width: 'auto' }} value={r.due || ''} onChange={e => set(i, { due: e.target.value || null })} />
              <select className="c-select" style={{ width: 'auto' }} value={r.category || ''} onChange={e => set(i, { category: e.target.value || null })}>
                <option value="">No category</option>
                {Object.entries(CATEGORIES).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
              <span className="c-chip">~{r.minutes} min</span>
            </div>
            {r.first_step && <div className="c-muted" style={{ fontSize: 12 }}>First step: {r.first_step}</div>}
            {r.notes && <div className="c-muted" style={{ fontSize: 12 }}>{r.notes}</div>}
            {r.duplicate_of && <div style={{ fontSize: 12, color: '#b45309' }}>Looks like you already have “{r.duplicate_of}” — unchecked so it isn't added twice.</div>}
          </div>
        </div>
      ))}

      <div className="c-card-body" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', borderTop: '1px solid var(--border)' }}>
        <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => onDone(false)}>Cancel</button>
        <button className="c-btn c-btn-sky c-btn-sm" disabled={!rows || !chosen.length || saving} onClick={addAll}>
          {saving ? 'Adding…' : `Add ${chosen.length} task${chosen.length === 1 ? '' : 's'} & suggest the order`}
        </button>
      </div>
    </div>
  )
}
