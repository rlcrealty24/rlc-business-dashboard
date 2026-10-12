// Every previous plan, what it asked for and what happened while you followed it.
import { useState } from 'react'
import { fmtDate } from '../ceo/recurrence.js'
import { DOW, WEEK_ORDER, planDay, trainingDays, useFitnessPlan, progressBetween } from './plan.js'

export default function HistoryTab({ logs, weekly }) {
  const { plan, history, replacePlan } = useFitnessPlan()
  const [open, setOpen] = useState(null)
  const current = { ...plan, snapshot: progressBetween({ logs, weekly, plan, from: plan.approved_at }), current: true }
  const rows = [current, ...history]
  const sign = v => (v === null || v === undefined ? '—' : v > 0 ? `+${v}` : `${v}`)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header"><h3>Compare plans</h3><span className="text-xs text-muted">results while each plan was active</span></div>
        <div className="table-container">
          <table>
            <thead><tr><th>Plan</th><th>Dates</th><th>Days</th><th>Calories · P/C/F</th><th>Weight</th><th>Waist</th><th>Hips</th><th>Workouts</th></tr></thead>
            <tbody>
              {rows.map((p, i) => {
                const s = p.snapshot || {}
                return (
                  <tr key={(p.id || '') + i} style={{ cursor: 'pointer' }} onClick={() => setOpen(open === i ? null : i)}>
                    <td><strong>v{p.version || 1} {p.name}</strong>{p.current && <span className="badge badge-green" style={{ marginLeft: 6 }}>current</span>}<div className="text-xs text-muted">{p.goal}</div></td>
                    <td className="text-sm">{fmtDate(p.approved_at)} – {p.current ? 'now' : fmtDate(p.archived_at)}</td>
                    <td className="text-sm">{trainingDays(p).length}/wk</td>
                    <td className="text-sm">{p.targets?.cal} · {p.targets?.protein}/{p.targets?.carbs}/{p.targets?.fat}</td>
                    <td className="text-sm">{s.weight_start && s.weight_end ? `${s.weight_start} → ${s.weight_end} (${sign(s.weight_change)})` : s.weight_start ? `${s.weight_start} → no weigh-in yet` : '—'}</td>
                    <td className="text-sm">{sign(s.waist_change)}</td>
                    <td className="text-sm">{sign(s.hips_change)}</td>
                    <td className="text-sm">{s.workouts_logged ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {open !== null && rows[open] && (
        <div className="card">
          <div className="card-header">
            <h3>v{rows[open].version || 1} · {rows[open].name}</h3>
            {!rows[open].current && <button className="btn btn-sm" onClick={() => {
              if (!window.confirm(`Go back to "${rows[open].name}"? Your current plan is saved in History first.`)) return
              const { snapshot, archived_at, archived_label, id, version, ...rest } = rows[open]
              replacePlan({ ...rest, source: 'restored' }, { snapshot: current.snapshot, label: 'Replaced by restore' })
              setOpen(null)
            }}>Use this plan again</button>}
          </div>
          <div className="card-body text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8, lineHeight: 1.6 }}>
            {rows[open].request && <div className="text-muted">You asked: “{rows[open].request}”</div>}
            {rows[open].changes?.length > 0 && <div>{rows[open].changes.map((c, i) => <div key={i}>• {c}</div>)}</div>}
            {WEEK_ORDER.map(i => { const d = planDay(rows[open], i); return (
              <div key={i}><strong>{DOW[i].slice(0, 3)} — {d.name}</strong>{!d.rest && <span className="text-muted">: {d.exercises.map(e => `${e.name} ${e.sets}`).join(' · ')}</span>}</div>
            ) })}
          </div>
        </div>
      )}
      {history.length === 0 && <div className="text-sm text-muted">Previous plans appear here when you approve a new plan from the AI Coach or save a new version.</div>}
    </div>
  )
}
