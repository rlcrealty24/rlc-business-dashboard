import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatDate, formatPercent, today, uid } from '../utils/formatters.js'

const BUREAUS           = ['Equifax', 'Experian', 'TransUnion']
const DISPUTE_STATUSES  = ['Open', 'In Progress', 'Resolved', 'Closed']
const NEGATIVE_TYPES    = ['Collection', 'Late Payment', 'Charge-off', 'Bankruptcy', 'Repossession', 'Judgment', 'Tax Lien', 'Other']
const ACTION_PRIORITIES = ['High', 'Medium', 'Low']
const CLIENT_STATUSES   = ['Active', 'On Hold', 'Completed']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scoreColor(n) {
  if (!n) return ''
  if (n >= 750) return 'text-green'
  if (n >= 670) return 'text-blue'
  if (n >= 580) return 'text-amber'
  return 'text-red'
}
function scoreBadge(n) {
  if (!n) return 'badge-gray'
  if (n >= 750) return 'badge-green'
  if (n >= 670) return 'badge-blue'
  if (n >= 580) return 'badge-amber'
  return 'badge-red'
}
function scoreLabel(n) {
  if (!n) return '—'
  if (n >= 750) return 'Excellent'
  if (n >= 670) return 'Good'
  if (n >= 580) return 'Fair'
  return 'Poor'
}
function initials(name = '') {
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?'
}
function statusBadge(s) {
  if (s === 'Active')    return 'badge-green'
  if (s === 'Completed') return 'badge-blue'
  return 'badge-amber'
}

// ─── Score Tracker ─────────────────────────────────────────────────────────────
function ScoreTracker({ cid }) {
  const [scores, setScores] = useLocalStorage(`credit_${cid}_scores`, [])
  const [form, setForm]     = useState({ date: today(), equifax: '', experian: '', transunion: '' })

  function save(e) {
    e.preventDefault()
    setScores([...scores, { ...form, id: uid(), equifax: Number(form.equifax), experian: Number(form.experian), transunion: Number(form.transunion) }])
    setForm({ date: today(), equifax: '', experian: '', transunion: '' })
  }

  const sorted   = [...scores].sort((a, b) => b.date.localeCompare(a.date))
  const latest   = sorted[0]
  const prev     = sorted[1]
  const avg      = latest ? Math.round((latest.equifax + latest.experian + latest.transunion) / 3) : null
  const prevAvg  = prev   ? Math.round((prev.equifax + prev.experian + prev.transunion) / 3) : null
  const change   = avg && prevAvg ? avg - prevAvg : null

  return (
    <div>
      <h2 className="mb-16">Credit Score Tracker</h2>

      {/* 3 bureau cards + avg */}
      {latest && (
        <div className="metrics-grid mb-24" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className={`metric-card ${avg >= 750 ? 'metric-card-income' : avg >= 580 ? 'metric-card-pending' : 'metric-card-expense'}`}>
            <div className="metric-label">Average Score</div>
            <div className={`metric-value ${scoreColor(avg)}`}>{avg}</div>
            {change != null && (
              <div className={`metric-change ${change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral'}`}>
                {change > 0 ? '+' : ''}{change} from last entry
              </div>
            )}
          </div>
          {BUREAUS.map(b => {
            const key   = b.toLowerCase()
            const score = latest[key]
            const prev2 = prev?.[key]
            const diff  = score && prev2 ? score - prev2 : null
            const pct   = score ? ((score - 300) / 550) * 100 : 0
            return (
              <div key={b} className={`metric-card ${score >= 750 ? 'metric-card-income' : score >= 580 ? 'metric-card-pending' : 'metric-card-expense'}`}>
                <div className="metric-label">{b}</div>
                <div className={`metric-value ${scoreColor(score)}`}>{score || '—'}</div>
                {diff != null && (
                  <div className={`metric-change ${diff > 0 ? 'positive' : diff < 0 ? 'negative' : 'neutral'}`}>
                    {diff > 0 ? '+' : ''}{diff}
                  </div>
                )}
                {score && <div className="score-bar-track" style={{ marginTop: 8 }}><div className="score-bar-thumb" style={{ left: `${pct}%` }} /></div>}
                <div className="mt-4"><span className={`badge ${scoreBadge(score)}`}>{scoreLabel(score)}</span></div>
              </div>
            )
          })}
        </div>
      )}

      {/* Log new entry */}
      <div className="card mb-24">
        <div className="card-header"><h3>Log New Scores</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
              <div className="form-group"><label>Equifax</label><input type="number" min="300" max="850" placeholder="300–850" value={form.equifax} onChange={e => setForm({ ...form, equifax: e.target.value })} required /></div>
              <div className="form-group"><label>Experian</label><input type="number" min="300" max="850" placeholder="300–850" value={form.experian} onChange={e => setForm({ ...form, experian: e.target.value })} required /></div>
              <div className="form-group"><label>TransUnion</label><input type="number" min="300" max="850" placeholder="300–850" value={form.transunion} onChange={e => setForm({ ...form, transunion: e.target.value })} required /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Log Scores</button>
          </form>
        </div>
      </div>

      {/* History table */}
      {scores.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Score History</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Equifax</th><th>Experian</th><th>TransUnion</th><th>Avg</th><th></th></tr></thead>
              <tbody>
                {sorted.map(s => {
                  const a = Math.round((s.equifax + s.experian + s.transunion) / 3)
                  return (
                    <tr key={s.id}>
                      <td>{formatDate(s.date)}</td>
                      <td className={scoreColor(s.equifax)}>{s.equifax}</td>
                      <td className={scoreColor(s.experian)}>{s.experian}</td>
                      <td className={scoreColor(s.transunion)}>{s.transunion}</td>
                      <td className={`bold ${scoreColor(a)}`}>{a}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => setScores(scores.filter(x => x.id !== s.id))}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {scores.length === 0 && <div className="empty-state"><p>Log the first credit scores to get started</p></div>}
    </div>
  )
}

// ─── Utilization ───────────────────────────────────────────────────────────────
function Utilization({ cid }) {
  const [cards, setCards] = useLocalStorage(`credit_${cid}_cards`, [])
  const [form, setForm]   = useState({ name: '', balance: '', limit: '', bureau: '' })

  function save(e) {
    e.preventDefault()
    setCards([...cards, { ...form, id: uid(), balance: Number(form.balance), limit: Number(form.limit) }])
    setForm({ name: '', balance: '', limit: '', bureau: '' })
  }

  const totalBalance = cards.reduce((s, c) => s + c.balance, 0)
  const totalLimit   = cards.reduce((s, c) => s + c.limit, 0)
  const overallUtil  = totalLimit ? (totalBalance / totalLimit) * 100 : 0

  function utilColor(pct) {
    if (pct <= 10) return 'text-green'
    if (pct <= 30) return 'text-blue'
    if (pct <= 50) return 'text-amber'
    return 'text-red'
  }

  function updateCard(id, field, val) {
    setCards(cards.map(c => c.id === id ? { ...c, [field]: field === 'name' || field === 'bureau' ? val : Number(val) } : c))
  }

  return (
    <div>
      <h2 className="mb-16">Credit Utilization</h2>

      <div className="metrics-grid mb-24" style={{ gridTemplateColumns: 'repeat(3,1fr)' }}>
        <div className={`metric-card ${overallUtil <= 10 ? 'metric-card-income' : overallUtil <= 30 ? 'metric-card-blue' : overallUtil <= 50 ? 'metric-card-pending' : 'metric-card-expense'}`}>
          <div className="metric-label">Overall Utilization</div>
          <div className={`metric-value ${utilColor(overallUtil)}`}>{formatPercent(overallUtil)}</div>
          <div className="metric-change neutral">Target: under 10%</div>
          <div className="progress-bar mt-8">
            <div className="progress-fill" style={{ width: `${Math.min(100, overallUtil)}%`, background: overallUtil > 50 ? 'var(--red)' : overallUtil > 30 ? 'var(--amber)' : 'var(--green)' }} />
          </div>
        </div>
        <div className="metric-card metric-card-expense">
          <div className="metric-label">Total Balance</div>
          <div className="metric-value">${totalBalance.toLocaleString()}</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Total Limit</div>
          <div className="metric-value">${totalLimit.toLocaleString()}</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header"><h3>Add Credit Card / Account</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Card / Account Name</label><input placeholder="Chase Freedom" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
              <div className="form-group"><label>Current Balance</label><input type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} required /></div>
              <div className="form-group"><label>Credit Limit</label><input type="number" step="1" placeholder="0" value={form.limit} onChange={e => setForm({ ...form, limit: e.target.value })} required /></div>
              <div className="form-group"><label>Bureau</label><select value={form.bureau} onChange={e => setForm({ ...form, bureau: e.target.value })}><option value="">All 3</option>{BUREAUS.map(b => <option key={b}>{b}</option>)}</select></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Add Card</button>
          </form>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Cards &amp; Accounts ({cards.length})</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Card / Account</th><th>Bureau</th><th>Balance</th><th>Limit</th><th>Utilization</th><th></th></tr></thead>
              <tbody>
                {cards.map(c => {
                  const util = c.limit ? (c.balance / c.limit) * 100 : 0
                  return (
                    <tr key={c.id}>
                      <td className="bold">{c.name}</td>
                      <td className="text-muted text-sm">{c.bureau || 'All 3'}</td>
                      <td>
                        <input type="number" value={c.balance} onChange={e => updateCard(c.id, 'balance', e.target.value)}
                          style={{ width: 90, padding: '2px 6px', fontSize: '0.8125rem' }} />
                      </td>
                      <td>${c.limit.toLocaleString()}</td>
                      <td>
                        <span className={`bold ${utilColor(util)}`}>{formatPercent(util)}</span>
                        <div className="progress-bar mt-4" style={{ width: 100 }}>
                          <div className="progress-fill" style={{ width: `${Math.min(100, util)}%`, background: util > 50 ? 'var(--red)' : util > 30 ? 'var(--amber)' : 'var(--green)' }} />
                        </div>
                      </td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => setCards(cards.filter(x => x.id !== c.id))}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Dispute Tracker ───────────────────────────────────────────────────────────
function DisputeTracker({ cid }) {
  const [disputes, setDisputes] = useLocalStorage(`credit_${cid}_disputes`, [])
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ creditor: '', account: '', bureau: 'Equifax', reason: '', status: 'Open', dateOpened: today(), notes: '' })

  function save(e) {
    e.preventDefault()
    setDisputes([...disputes, { ...form, id: uid() }])
    setForm({ creditor: '', account: '', bureau: 'Equifax', reason: '', status: 'Open', dateOpened: today(), notes: '' })
    setModal(false)
  }

  const open     = disputes.filter(d => d.status === 'Open' || d.status === 'In Progress').length
  const resolved = disputes.filter(d => d.status === 'Resolved').length

  // Kanban-style columns
  const cols = [
    { label: 'Open',        key: 'Open',        color: 'var(--pink)',   bg: 'var(--pink-light)',  border: 'var(--pink-border)' },
    { label: 'In Progress', key: 'In Progress',  color: 'var(--amber)',  bg: 'var(--amber-bg)',    border: '#FCD34D' },
    { label: 'Resolved',    key: 'Resolved',     color: 'var(--green)',  bg: 'var(--green-bg)',    border: '#86EFAC' },
    { label: 'Closed',      key: 'Closed',       color: 'var(--blue)',   bg: 'var(--blue-bg)',     border: '#C7D2FE' },
  ]

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Dispute Tracker</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ Add Dispute</button>
      </div>

      <div className="metrics-grid mb-24" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="metric-card metric-card-blue"><div className="metric-label">Total Disputes</div><div className="metric-value">{disputes.length}</div></div>
        <div className="metric-card metric-card-expense"><div className="metric-label">Open</div><div className="metric-value text-red">{open}</div></div>
        <div className="metric-card metric-card-income"><div className="metric-label">Resolved</div><div className="metric-value text-green">{resolved}</div></div>
        <div className="metric-card metric-card-pending"><div className="metric-label">Win Rate</div>
          <div className="metric-value text-green">{disputes.length ? Math.round((resolved / disputes.length) * 100) : 0}%</div>
        </div>
      </div>

      {/* Kanban columns */}
      {disputes.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 24 }}>
          {cols.map(col => {
            const colItems = disputes.filter(d => d.status === col.key)
            return (
              <div key={col.key} className="card" style={{ overflow: 'hidden' }}>
                <div style={{ padding: '10px 14px', background: col.bg, borderBottom: `1px solid ${col.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{col.label}</span>
                  <span style={{ background: 'white', border: `1px solid ${col.border}`, borderRadius: 20, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700, color: col.color }}>{colItems.length}</span>
                </div>
                <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 80 }}>
                  {colItems.map(d => (
                    <div key={d.id} style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 8, padding: '10px 12px' }}>
                      <div className="bold text-sm">{d.creditor}</div>
                      {d.account && <div className="text-xs text-muted mt-4">{d.account}</div>}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                        <span className="badge badge-gray">{d.bureau}</span>
                        <select
                          value={d.status}
                          onChange={e => setDisputes(disputes.map(x => x.id === d.id ? { ...x, status: e.target.value } : x))}
                          style={{ fontSize: '0.72rem', padding: '1px 4px', border: '1px solid var(--border)', borderRadius: 6, background: 'white', cursor: 'pointer' }}
                          onClick={e => e.stopPropagation()}
                        >
                          {DISPUTE_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      {d.reason && <div className="text-xs text-muted mt-4" style={{ lineHeight: 1.4 }}>{d.reason.slice(0, 60)}{d.reason.length > 60 ? '…' : ''}</div>}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                        <span className="text-xs text-muted">{formatDate(d.dateOpened)}</span>
                        <button className="btn btn-sm btn-danger" style={{ padding: '2px 6px' }} onClick={() => setDisputes(disputes.filter(x => x.id !== d.id))}>×</button>
                      </div>
                    </div>
                  ))}
                  {colItems.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '16px 8px', color: 'var(--text-faint)', fontSize: '0.75rem', border: '1px dashed var(--border)', borderRadius: 8 }}>
                      None
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {disputes.length === 0 && <div className="empty-state mb-24"><p>No disputes yet — add one to start tracking</p></div>}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>New Dispute</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Creditor</label><input placeholder="Capital One" value={form.creditor} onChange={e => setForm({ ...form, creditor: e.target.value })} required /></div>
                <div className="form-group"><label>Account #</label><input placeholder="****1234" value={form.account} onChange={e => setForm({ ...form, account: e.target.value })} /></div>
                <div className="form-group"><label>Bureau</label><select value={form.bureau} onChange={e => setForm({ ...form, bureau: e.target.value })}>{BUREAUS.map(b => <option key={b}>{b}</option>)}</select></div>
                <div className="form-group"><label>Date Opened</label><input type="date" value={form.dateOpened} onChange={e => setForm({ ...form, dateOpened: e.target.value })} /></div>
                <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{DISPUTE_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
              </div>
              <div className="form-group mb-16"><label>Reason for Dispute</label><textarea value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Not mine, inaccurate amount, duplicate…" required /></div>
              <div className="form-group mb-16"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Dates sent, responses received…" /></div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Dispute</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Negative Accounts ─────────────────────────────────────────────────────────
function NegativeAccounts({ cid }) {
  const [accounts, setAccounts] = useLocalStorage(`credit_${cid}_negatives`, [])
  const [form, setForm]         = useState({ creditor: '', type: 'Collection', balance: '', dateOpened: '', bureaus: [], notes: '' })
  const [adding, setAdding]     = useState(false)

  function toggleBureau(b) {
    const arr = form.bureaus.includes(b) ? form.bureaus.filter(x => x !== b) : [...form.bureaus, b]
    setForm({ ...form, bureaus: arr })
  }

  function save(e) {
    e.preventDefault()
    setAccounts([...accounts, { ...form, id: uid(), balance: Number(form.balance) }])
    setForm({ creditor: '', type: 'Collection', balance: '', dateOpened: '', bureaus: [], notes: '' })
    setAdding(false)
  }

  const typeColor = { Collection: 'badge-red', 'Late Payment': 'badge-amber', 'Charge-off': 'badge-red', Bankruptcy: 'badge-red', Repossession: 'badge-red', Judgment: 'badge-red', 'Tax Lien': 'badge-red', Other: 'badge-gray' }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Negative Accounts ({accounts.length})</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Add Account'}</button>
      </div>

      {adding && (
        <div className="card mb-24" style={{ borderColor: 'var(--pink-border)' }}>
          <div className="card-header" style={{ background: 'var(--pink-light)' }}><h3 style={{ color: 'var(--pink)' }}>New Negative Account</h3></div>
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Creditor</label><input placeholder="Creditor name" value={form.creditor} onChange={e => setForm({ ...form, creditor: e.target.value })} required /></div>
                <div className="form-group"><label>Type</label><select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{NEGATIVE_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label>Balance ($)</label><input type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e => setForm({ ...form, balance: e.target.value })} /></div>
                <div className="form-group"><label>Date Opened</label><input type="date" value={form.dateOpened} onChange={e => setForm({ ...form, dateOpened: e.target.value })} /></div>
              </div>
              <div className="form-group mb-12">
                <label>Reporting Bureaus</label>
                <div style={{ display: 'flex', gap: 20, marginTop: 8 }}>
                  {BUREAUS.map(b => (
                    <label key={b} style={{ display: 'flex', gap: 7, alignItems: 'center', cursor: 'pointer', fontSize: '0.875rem', textTransform: 'none', letterSpacing: 'normal', color: 'var(--text)', fontWeight: 400 }}>
                      <input type="checkbox" checked={form.bureaus.includes(b)} onChange={() => toggleBureau(b)} />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group mb-16"><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="SOL date, settlement offers, dispute history…" /></div>
              <button type="submit" className="btn btn-primary btn-sm">Save Account</button>
            </form>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state"><p>No negative accounts tracked yet</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {accounts.map(a => (
            <div key={a.id} className="card" style={{ borderLeft: '4px solid var(--pink)' }}>
              <div className="card-body" style={{ padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span className="bold" style={{ fontSize: '1rem' }}>{a.creditor}</span>
                      <span className={`badge ${typeColor[a.type] || 'badge-gray'}`}>{a.type}</span>
                      {(a.bureaus || []).map(b => <span key={b} className="badge badge-gray">{b}</span>)}
                    </div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {a.balance > 0 && <div><div className="metric-label">Balance</div><div className="text-red bold">${Number(a.balance).toLocaleString()}</div></div>}
                      {a.dateOpened && <div><div className="metric-label">Date</div><div className="text-sm">{formatDate(a.dateOpened)}</div></div>}
                    </div>
                    {a.notes && <div className="text-xs text-muted mt-8" style={{ lineHeight: 1.5 }}>{a.notes}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => {
                        const letter = `CERTIFIED MAIL\n\n${new Date().toLocaleDateString()}\n\nTo Whom It May Concern,\n\nI am writing to formally dispute the following account appearing on my credit report:\n\nCreditor: ${a.creditor}\nType: ${a.type}\n${a.balance > 0 ? `Balance: $${Number(a.balance).toLocaleString()}\n` : ''}${a.dateOpened ? `Date Opened: ${formatDate(a.dateOpened)}\n` : ''}\nI am requesting verification of this account as required under the Fair Credit Reporting Act (FCRA). If this information cannot be verified, I request its immediate removal from my credit report.\n\nSincerely,\n[Your Name]\n[Address]\n[City, State, ZIP]`
                        const blob = new Blob([letter], { type: 'text/plain' })
                        const url  = URL.createObjectURL(blob)
                        const a2   = document.createElement('a')
                        a2.href = url
                        a2.download = `dispute-letter-${a.creditor.replace(/\s+/g, '-').toLowerCase()}.txt`
                        a2.click()
                        URL.revokeObjectURL(url)
                      }}
                    >📄 Dispute Letter</button>
                    <button className="btn btn-sm btn-danger" onClick={() => setAccounts(accounts.filter(x => x.id !== a.id))}>×</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Action Items ──────────────────────────────────────────────────────────────
function ActionItems({ cid }) {
  const [items, setItems] = useLocalStorage(`credit_${cid}_actions`, [])
  const [form, setForm]   = useState({ title: '', description: '', priority: 'High', dueDate: '', done: false })
  const [adding, setAdding] = useState(false)

  function save(e) {
    e.preventDefault()
    setItems([...items, { ...form, id: uid(), createdAt: today() }])
    setForm({ title: '', description: '', priority: 'High', dueDate: '', done: false })
    setAdding(false)
  }

  const open = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  const SUGGESTED = [
    { title: 'Pay down cards to under 10% utilization', priority: 'High', description: 'Focus on highest utilization cards first' },
    { title: 'Dispute inaccurate late payments', priority: 'High', description: 'Send certified mail to all 3 bureaus' },
    { title: 'Request goodwill deletions for paid accounts', priority: 'Medium', description: 'Write to original creditors for late marks' },
    { title: 'Become authorized user on a good account', priority: 'Medium', description: 'Ask family member with old, low-utilization card' },
    { title: 'Open a secured credit card if needed', priority: 'Low', description: 'Helps build positive payment history' },
  ]

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Action Items</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Add Action'}</button>
      </div>

      {adding && (
        <div className="card mb-24">
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Action Title</label><input placeholder="What needs to be done?" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required /></div>
                <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{ACTION_PRIORITIES.map(p => <option key={p}>{p}</option>)}</select></div>
                <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} /></div>
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Description / Notes</label><textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Add Action</button>
            </form>
          </div>
        </div>
      )}

      {items.length === 0 && (
        <div className="card mb-24">
          <div className="card-header"><h3>💡 Suggested Actions</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {SUGGESTED.map((s, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 20px', borderBottom: i < SUGGESTED.length - 1 ? '1px solid var(--border-light)' : 'none' }}>
                <div>
                  <div className="text-sm bold">{s.title}</div>
                  <div className="text-xs text-muted mt-4">{s.description}</div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 16, flexShrink: 0 }}>
                  <span className={`badge ${s.priority === 'High' ? 'badge-red' : s.priority === 'Medium' ? 'badge-amber' : 'badge-gray'}`}>{s.priority}</span>
                  <button className="btn btn-sm" onClick={() => setItems([...items, { ...s, id: uid(), done: false, createdAt: today(), dueDate: '' }])}>Add</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div className="card mb-16">
          <div className="card-header"><h3>Open Actions</h3><span className="badge badge-pink">{open.length}</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {open.sort((a, b) => ACTION_PRIORITIES.indexOf(a.priority) - ACTION_PRIORITIES.indexOf(b.priority)).map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--border-light)' }}>
                <input type="checkbox" checked={false} onChange={() => setItems(items.map(x => x.id === item.id ? { ...x, done: true } : x))} style={{ marginTop: 3 }} />
                <div style={{ flex: 1 }}>
                  <div className="flex-between">
                    <span className="bold text-sm">{item.title}</span>
                    <span className={`badge ${item.priority === 'High' ? 'badge-red' : item.priority === 'Medium' ? 'badge-amber' : 'badge-gray'}`}>{item.priority}</span>
                  </div>
                  {item.description && <div className="text-xs text-muted mt-4">{item.description}</div>}
                  {item.dueDate && <div className="text-xs text-muted mt-4">Due: {formatDate(item.dueDate)}</div>}
                </div>
                <button className="btn btn-sm btn-danger" onClick={() => setItems(items.filter(x => x.id !== item.id))}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="card" style={{ opacity: 0.6 }}>
          <div className="card-header"><h3>Completed</h3><span className="badge badge-green">{done.length}</span></div>
          <div className="card-body" style={{ padding: 0 }}>
            {done.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--border-light)' }}>
                <input type="checkbox" checked={true} onChange={() => setItems(items.map(x => x.id === item.id ? { ...x, done: false } : x))} style={{ marginTop: 3 }} />
                <span className="text-sm" style={{ textDecoration: 'line-through', flex: 1 }}>{item.title}</span>
                <button className="btn btn-sm btn-danger" onClick={() => setItems(items.filter(x => x.id !== item.id))}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Client Summary Row (mini score snapshot) ──────────────────────────────────
function ClientScoreSummary({ cid }) {
  const [scores] = useLocalStorage(`credit_${cid}_scores`, [])
  const [disputes] = useLocalStorage(`credit_${cid}_disputes`, [])
  const [negatives] = useLocalStorage(`credit_${cid}_negatives`, [])

  const latest = [...scores].sort((a, b) => b.date.localeCompare(a.date))[0]
  const avg    = latest ? Math.round((latest.equifax + latest.experian + latest.transunion) / 3) : null
  const openD  = disputes.filter(d => d.status === 'Open' || d.status === 'In Progress').length

  return { avg, openD, negCount: negatives.length }
}

// ─── Client Card ───────────────────────────────────────────────────────────────
function ClientCard({ client, selected, onSelect }) {
  const [scores]   = useLocalStorage(`credit_${client.id}_scores`, [])
  const [disputes] = useLocalStorage(`credit_${client.id}_disputes`, [])
  const [negatives]= useLocalStorage(`credit_${client.id}_negatives`, [])

  const latest = [...scores].sort((a, b) => b.date.localeCompare(a.date))[0]
  const avg    = latest ? Math.round((latest.equifax + latest.experian + latest.transunion) / 3) : null
  const openD  = disputes.filter(d => d.status === 'Open' || d.status === 'In Progress').length

  return (
    <div
      onClick={() => onSelect(client.id)}
      style={{
        background: selected ? 'var(--pink-light)' : '#fff',
        border: selected ? '2px solid var(--pink)' : '2px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
        cursor: 'pointer',
        minWidth: 160,
        transition: 'all 0.15s',
        boxShadow: selected ? '0 4px 16px rgba(232,84,122,0.15)' : 'var(--shadow)',
        position: 'relative',
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: 'linear-gradient(135deg, #E8547A, #C73D63)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'white', fontWeight: 700, fontSize: '1rem',
        marginBottom: 10,
        boxShadow: '0 2px 8px rgba(232,84,122,0.25)',
      }}>
        {initials(client.name)}
      </div>

      <div className="bold" style={{ fontSize: '0.88rem', color: 'var(--heading)', marginBottom: 4 }}>{client.name}</div>
      <span className={`badge ${statusBadge(client.status)}`} style={{ marginBottom: 8, display: 'inline-block' }}>{client.status}</span>

      {/* Score + stats */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
        {avg ? (
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Avg Score</div>
            <div className={`bold ${scoreColor(avg)}`} style={{ fontSize: '1.1rem' }}>{avg}</div>
          </div>
        ) : (
          <div style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>No scores yet</div>
        )}
        {openD > 0 && (
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Disputes</div>
            <div className="bold text-red" style={{ fontSize: '1rem' }}>{openD}</div>
          </div>
        )}
        {negatives.length > 0 && (
          <div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Negatives</div>
            <div className="bold text-amber" style={{ fontSize: '1rem' }}>{negatives.length}</div>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: 'var(--pink)' }} />
      )}
    </div>
  )
}

// ─── Add / Edit Client Modal ───────────────────────────────────────────────────
function ClientModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || { name: '', phone: '', email: '', notes: '', status: 'Active', startDate: today() })

  function handleSubmit(e) {
    e.preventDefault()
    if (!form.name.trim()) return
    onSave(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <h2>{initial ? 'Edit Client' : 'Add New Client'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Full Name *</label>
              <input placeholder="Client full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required autoFocus />
            </div>
            <div className="form-group"><label>Phone</label><input placeholder="(555) 000-0000" value={form.phone || ''} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="form-group"><label>Email</label><input type="email" placeholder="email@example.com" value={form.email || ''} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div className="form-group"><label>Start Date</label><input type="date" value={form.startDate || today()} onChange={e => setForm({ ...form, startDate: e.target.value })} /></div>
            <div className="form-group"><label>Status</label><select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{CLIENT_STATUSES.map(s => <option key={s}>{s}</option>)}</select></div>
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Notes (optional)</label>
              <textarea placeholder="Goals, circumstances, referral source…" value={form.notes || ''} onChange={e => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{initial ? 'Save Changes' : 'Add Client'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Credit Repair Page ────────────────────────────────────────────────────────
export default function CreditRepair() {
  const [clients, setClients]       = useLocalStorage('credit_clients', [])
  const [selectedId, setSelectedId] = useLocalStorage('credit_selected_client', null)
  const [tab, setTab]               = useState('scores')
  const [addModal, setAddModal]     = useState(false)
  const [editModal, setEditModal]   = useState(null) // client object

  const client = clients.find(c => c.id === selectedId) || null

  const TABS = [
    { id: 'scores',    label: '📊 Scores' },
    { id: 'util',      label: '💳 Utilization' },
    { id: 'disputes',  label: '⚖️ Disputes' },
    { id: 'negatives', label: '🚩 Negatives' },
    { id: 'actions',   label: '✅ Actions' },
  ]

  function addClient(form) {
    const newClient = { ...form, id: uid(), createdAt: today() }
    setClients([...clients, newClient])
    setSelectedId(newClient.id)
    setAddModal(false)
  }

  function saveEdit(form) {
    setClients(clients.map(c => c.id === editModal.id ? { ...c, ...form } : c))
    setEditModal(null)
  }

  function deleteClient(id) {
    if (!window.confirm('Delete this client and all their data?')) return
    setClients(clients.filter(c => c.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // Summary stats for header
  const activeCount    = clients.filter(c => c.status === 'Active').length
  const completedCount = clients.filter(c => c.status === 'Completed').length

  return (
    <div>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Credit Repair</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {clients.length} client{clients.length !== 1 ? 's' : ''} · {activeCount} active · {completedCount} completed
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ New Client</button>
      </div>

      {/* ── Client cards row ── */}
      {clients.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '52px 24px', marginBottom: 24 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>👤</div>
          <h2 style={{ marginBottom: 8, color: 'var(--heading)' }}>No clients yet</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.9rem' }}>Add your first client to start tracking their credit repair journey</p>
          <button className="btn btn-primary" onClick={() => setAddModal(true)}>+ Add First Client</button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
          {clients.map(c => (
            <ClientCard
              key={c.id}
              client={c}
              selected={selectedId === c.id}
              onSelect={id => { setSelectedId(id === selectedId ? null : id); setTab('scores') }}
            />
          ))}
        </div>
      )}

      {/* ── Selected client workspace ── */}
      {client ? (
        <div key={client.id}>
          {/* Client header bar */}
          <div style={{
            background: 'linear-gradient(135deg, #FFF0F3 0%, #FFE4EC 100%)',
            border: '1px solid var(--pink-border)',
            borderLeft: '4px solid var(--pink)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px 22px',
            marginBottom: 20,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 46, height: 46, borderRadius: '50%',
                background: 'linear-gradient(135deg, #E8547A, #C73D63)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 700, fontSize: '1.1rem',
                flexShrink: 0,
              }}>
                {initials(client.name)}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--heading)' }}>{client.name}</span>
                  <span className={`badge ${statusBadge(client.status)}`}>{client.status}</span>
                </div>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {client.phone && <span className="text-xs text-muted">📞 {client.phone}</span>}
                  {client.email && <span className="text-xs text-muted">✉️ {client.email}</span>}
                  {client.startDate && <span className="text-xs text-muted">📅 Since {formatDate(client.startDate)}</span>}
                  {client.notes && <span className="text-xs text-muted" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {client.notes}</span>}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm" onClick={() => setEditModal(client)}>✏️ Edit</button>
              <button className="btn btn-sm btn-danger" onClick={() => deleteClient(client.id)}>🗑 Delete</button>
              <button className="btn btn-sm" onClick={() => setSelectedId(null)}>✕ Close</button>
            </div>
          </div>

          {/* Tabs */}
          <div className="tabs">
            {TABS.map(t => (
              <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Tab content — key forces clean remount on client switch */}
          <div key={`${client.id}-${tab}`}>
            {tab === 'scores'    && <ScoreTracker     cid={client.id} />}
            {tab === 'util'      && <Utilization       cid={client.id} />}
            {tab === 'disputes'  && <DisputeTracker    cid={client.id} />}
            {tab === 'negatives' && <NegativeAccounts  cid={client.id} />}
            {tab === 'actions'   && <ActionItems       cid={client.id} />}
          </div>
        </div>
      ) : (
        clients.length > 0 && (
          <div className="card" style={{ textAlign: 'center', padding: '44px 24px' }}>
            <div style={{ fontSize: '2rem', marginBottom: 10 }}>👆</div>
            <p style={{ color: 'var(--text-muted)' }}>Select a client above to open their workspace</p>
          </div>
        )
      )}

      {/* Modals */}
      {addModal  && <ClientModal onSave={addClient} onClose={() => setAddModal(false)} />}
      {editModal && <ClientModal initial={editModal} onSave={saveEdit} onClose={() => setEditModal(null)} />}
    </div>
  )
}
