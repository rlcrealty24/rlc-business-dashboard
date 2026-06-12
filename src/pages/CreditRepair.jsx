import { useState, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatDate, formatPercent, today, uid } from '../utils/formatters.js'
import { readCreditReport } from '../utils/anthropic.js'

const BUREAUS              = ['Equifax', 'Experian', 'TransUnion']
const DISPUTE_STATUSES     = ['Open', 'In Progress', 'Resolved', 'Closed']
const NEGATIVE_TYPES       = ['Collection', 'Late Payment', 'Charge-off', 'Bankruptcy', 'Repossession', 'Judgment', 'Tax Lien', 'Other']
const ACTION_PRIORITIES    = ['High', 'Medium', 'Low']
const CLIENT_STATUSES      = ['Active', 'On Hold', 'Completed']
const NEG_DISPUTE_STATUSES = ['Not Started', 'Letter Sent', 'Under Investigation', 'Verified by Bureau', 'Removed']

// Negative items fall off 7 yrs from DOFD (10 yrs for Ch.7 Bankruptcy)
function calcFallOff(a) {
  if (!a.dateFirstDelinquency) return null
  const d = new Date(a.dateFirstDelinquency + 'T00:00:00')
  d.setFullYear(d.getFullYear() + (a.type === 'Bankruptcy' ? 10 : 7))
  return d.toISOString().split('T')[0]
}
function fallOffLabel(dateStr) {
  if (!dateStr) return null
  const diff = (new Date(dateStr + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24 * 30.44)
  if (diff < 0) return `Fell off ${Math.abs(Math.round(diff / 12))}yr ago`
  if (diff < 1) return 'Falls off this month'
  if (diff < 12) return `Falls off in ${Math.round(diff)}mo`
  return `Falls off in ${(diff / 12).toFixed(1)}yr`
}
const NEG_DISPUTE_COLORS = {
  'Not Started':         { bg:'var(--surface-hover)', color:'var(--text-muted)',  border:'var(--border)' },
  'Letter Sent':         { bg:'#EEF2FF',              color:'#3730A3',            border:'#C7D2FE'       },
  'Under Investigation': { bg:'#FFFBEB',              color:'#92400E',            border:'#FDE68A'       },
  'Verified by Bureau':  { bg:'#FEF2F2',              color:'#991B1B',            border:'#FECACA'       },
  'Removed':             { bg:'#EDFAF4',              color:'#065F46',            border:'#6EE7B7'       },
}

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
  const [scores,    setScores]    = useLocalStorage(`credit_${cid}_scores`,    [])
  const [negatives, setNegatives] = useLocalStorage(`credit_${cid}_negatives`, [])
  const [cards,     setCards]     = useLocalStorage(`credit_${cid}_cards`,     [])
  const [form,      setForm]      = useState({ date: today(), equifax: '', experian: '', transunion: '' })

  // ── Inline row edit state ──
  const [editingScoreId, setEditingScoreId] = useState(null)
  const [editBuf,        setEditBuf]        = useState({})

  // ── Report upload state ──
  const [reportLoading, setReportLoading] = useState(false)
  const [reportError,   setReportError]   = useState('')
  const [preview,       setPreview]       = useState(null)   // extracted data before confirming
  const [importNegs,    setImportNegs]    = useState(true)
  const [importAccts,   setImportAccts]   = useState(true)
  const [previewScores, setPreviewScores] = useState({ equifax: '', experian: '', transunion: '', date: '' })
  const fileRef = useRef(null)

  function save(e) {
    e.preventDefault()
    setScores([...scores, {
      ...form, id: uid(),
      equifax:    form.equifax    ? Number(form.equifax)    : null,
      experian:   form.experian   ? Number(form.experian)   : null,
      transunion: form.transunion ? Number(form.transunion) : null,
    }])
    setForm({ date: today(), equifax: '', experian: '', transunion: '' })
  }

  async function handleReportUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setReportLoading(true)
    setReportError('')
    setPreview(null)
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const base64 = ev.target.result.split(',')[1]
        const data   = await readCreditReport(base64, file.type)
        setPreview(data)
        setPreviewScores({
          equifax:    data.equifax    ? String(data.equifax)    : '',
          experian:   data.experian   ? String(data.experian)   : '',
          transunion: data.transunion ? String(data.transunion) : '',
          date:       data.reportDate || today(),
        })
        setImportNegs(true)
        setImportAccts(true)
      } catch (err) {
        setReportError(err.message)
      }
      setReportLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function confirmImport() {
    // Save scores — store null for missing bureaus so average isn't skewed
    const eq = Number(previewScores.equifax)  || null
    const ex = Number(previewScores.experian) || null
    const tu = Number(previewScores.transunion) || null
    if (eq || ex || tu) {
      setScores(prev => [...prev, {
        id: uid(),
        date:       previewScores.date || today(),
        equifax:    eq,
        experian:   ex,
        transunion: tu,
      }])
    }
    // Import negative accounts
    if (importNegs && preview?.negatives?.length) {
      const newNegs = preview.negatives.map(n => ({
        id: uid(), addedAt: today(),
        creditor:              n.creditor              || '',
        type:                  NEGATIVE_TYPES.includes(n.type) ? n.type : 'Other',
        bureaus:               Array.isArray(n.bureaus) ? n.bureaus : [],
        balance:               n.balance != null ? String(n.balance) : '',
        status:                n.status                || '',
        dateOpened:            n.dateOpened            || '',
        dateFirstDelinquency:  n.dateFirstDelinquency  || '',
        dateLastActivity:      n.dateLastActivity      || '',
        accountNumber:         n.accountNumber         || '',
        originalCreditor:      n.originalCreditor      || '',
        address:               n.address               || '',
        city:                  n.city                  || '',
        state:                 n.state                 || '',
        zip:                   n.zip                   || '',
        phone:                 n.phone                 || '',
        disputeStatus:         'Not Started',
        lastDisputeDate:       '',
        notes:                 'Imported from credit report',
      }))
      setNegatives(prev => [...prev, ...newNegs])
    }
    // Import revolving accounts for utilization
    if (importAccts && preview?.accounts?.length) {
      const newCards = preview.accounts
        .filter(a => a.type === 'Revolving' && a.limit)
        .map(a => ({
          id: uid(),
          name:    a.name    || 'Unknown',
          balance: Number(a.balance) || 0,
          limit:   Number(a.limit)   || 0,
          bureau:  '',
        }))
      if (newCards.length) setCards(prev => [...prev, ...newCards])
    }
    setPreview(null)
  }

  const sorted  = [...scores].sort((a, b) => b.date.localeCompare(a.date))
  const latest  = sorted[0]
  const prev    = sorted[1]

  // Only average bureaus that actually have a score (ignore 0 / null)
  function calcAvg(entry) {
    if (!entry) return null
    const vals = [entry.equifax, entry.experian, entry.transunion].filter(v => v > 0)
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null
  }

  const avg     = calcAvg(latest)
  const prevAvg = calcAvg(prev)
  const change  = avg && prevAvg ? avg - prevAvg : null

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2>Credit Score Tracker</h2>
        <label
          className="btn btn-primary btn-sm"
          style={{ cursor: reportLoading ? 'wait' : 'pointer', gap: 6 }}
          title="Upload a credit report PDF or image — AI will extract scores and negative accounts"
        >
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,image/*"
            onChange={handleReportUpload}
            style={{ display: 'none' }}
            disabled={reportLoading}
          />
          {reportLoading ? '⏳ Reading report…' : '📄 Upload Credit Report'}
        </label>
      </div>

      {/* ── Report upload error ── */}
      {reportError && (
        <div style={{ background: 'var(--red-bg)', border: '1px solid #fca5a5', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--red)', marginBottom: 4, fontSize: '0.875rem' }}>Couldn't read report</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{reportError}</div>
          </div>
          <button onClick={() => setReportError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1, padding: 0 }}>×</button>
        </div>
      )}

      {/* ── Report preview / confirm modal ── */}
      {preview && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF0F3 0%, #FFE4EC 100%)',
          border: '1px solid var(--pink-border)',
          borderLeft: '4px solid var(--pink)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px 24px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--pink-text)', fontWeight: 700, marginBottom: 4 }}>✅ Report Scanned — Review &amp; Confirm</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>AI extracted the data below. Edit any field before saving.</div>
            </div>
            <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.4rem', lineHeight: 1, padding: 0 }}>×</button>
          </div>

          {/* Editable score fields */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
            <div className="form-group">
              <label>Report Date</label>
              <input type="date" value={previewScores.date} onChange={e => setPreviewScores({ ...previewScores, date: e.target.value })} style={{ background: '#fff' }} />
            </div>
            {[
              { key: 'equifax',    label: 'Equifax' },
              { key: 'experian',   label: 'Experian' },
              { key: 'transunion', label: 'TransUnion' },
            ].map(b => (
              <div key={b.key} className="form-group">
                <label>{b.label}</label>
                <input
                  type="number" min="300" max="850"
                  placeholder="not found"
                  value={previewScores[b.key]}
                  onChange={e => setPreviewScores({ ...previewScores, [b.key]: e.target.value })}
                  style={{ background: '#fff', fontWeight: previewScores[b.key] ? 700 : 400 }}
                />
              </div>
            ))}
          </div>

          {/* What else was found */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            {preview.negatives?.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#fff', border: '1px solid var(--pink-border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.83rem' }}>
                <input type="checkbox" checked={importNegs} onChange={e => setImportNegs(e.target.checked)} style={{ accentColor: 'var(--pink)' }} />
                <span>Import <strong>{preview.negatives.length}</strong> negative item{preview.negatives.length !== 1 ? 's' : ''} → Negatives tab</span>
              </label>
            )}
            {preview.accounts?.filter(a => a.type === 'Revolving' && a.limit)?.length > 0 && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 14px', background: '#fff', border: '1px solid var(--pink-border)', borderRadius: 'var(--radius)', cursor: 'pointer', fontSize: '0.83rem' }}>
                <input type="checkbox" checked={importAccts} onChange={e => setImportAccts(e.target.checked)} style={{ accentColor: 'var(--pink)' }} />
                <span>Import <strong>{preview.accounts.filter(a => a.type === 'Revolving' && a.limit).length}</strong> credit card{preview.accounts.filter(a => a.type === 'Revolving' && a.limit).length !== 1 ? 's' : ''} → Utilization tab</span>
              </label>
            )}
          </div>

          {/* Negative items preview list */}
          {importNegs && preview.negatives?.length > 0 && (
            <div style={{ background: '#fff', border: '1px solid var(--pink-border)', borderRadius: 'var(--radius)', marginBottom: 14, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', borderBottom: '1px solid var(--border-light)', fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', fontWeight: 600 }}>
                Negative Items Found
              </div>
              {preview.negatives.map((n, i) => (
                <div key={i} style={{ padding: '9px 14px', borderBottom: i < preview.negatives.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div>
                    <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>{n.creditor}</span>
                    <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>{n.type}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                    {n.balance != null && <span style={{ fontSize: '0.78rem', color: 'var(--red)', fontWeight: 600 }}>${Number(n.balance).toLocaleString()}</span>}
                    {n.bureaus?.map(b => <span key={b} style={{ fontSize: '0.62rem', background: 'var(--blue-bg)', color: 'var(--blue)', border: '1px solid #c7d2fe', borderRadius: 4, padding: '1px 5px' }}>{b.slice(0, 2)}</span>)}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={confirmImport}>✅ Save to Client Profile</button>
            <button className="btn" onClick={() => setPreview(null)}>Discard</button>
          </div>
        </div>
      )}

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

      {/* Manual log entry */}
      <div className="card mb-24">
        <div className="card-header">
          <h3>Log Scores Manually</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Fill only the bureaus you have — blanks show as —</span>
        </div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required /></div>
              <div className="form-group"><label>Equifax <span style={{color:'var(--text-faint)',fontWeight:400}}>(optional)</span></label><input type="number" min="300" max="850" placeholder="300–850" value={form.equifax} onChange={e => setForm({ ...form, equifax: e.target.value })} /></div>
              <div className="form-group"><label>Experian <span style={{color:'var(--text-faint)',fontWeight:400}}>(optional)</span></label><input type="number" min="300" max="850" placeholder="300–850" value={form.experian} onChange={e => setForm({ ...form, experian: e.target.value })} /></div>
              <div className="form-group"><label>TransUnion <span style={{color:'var(--text-faint)',fontWeight:400}}>(optional)</span></label><input type="number" min="300" max="850" placeholder="300–850" value={form.transunion} onChange={e => setForm({ ...form, transunion: e.target.value })} /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm" disabled={!form.equifax && !form.experian && !form.transunion}>Log Scores</button>
          </form>
        </div>
      </div>

      {/* History table */}
      {scores.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h3>Score History</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              Click ✏️ on any row to fill in missing bureau scores
            </span>
          </div>
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Equifax</th><th>Experian</th><th>TransUnion</th><th>Avg</th><th></th></tr></thead>
              <tbody>
                {sorted.map(s => {
                  const vals    = [s.equifax, s.experian, s.transunion].filter(v => v > 0)
                  const a       = vals.length ? Math.round(vals.reduce((x,y) => x+y,0) / vals.length) : null
                  const editing = editingScoreId === s.id

                  return editing ? (
                    // ── Inline edit row ──
                    <tr key={s.id} style={{ background: 'var(--pink-light)' }}>
                      <td>
                        <input type="date" defaultValue={s.date}
                          onChange={e => setEditBuf(b => ({ ...b, date: e.target.value }))}
                          style={{ fontSize: '0.8rem', padding: '3px 6px', width: 130 }} />
                      </td>
                      {['equifax','experian','transunion'].map(k => (
                        <td key={k}>
                          <input type="number" min="300" max="850" placeholder="—"
                            defaultValue={s[k] || ''}
                            onChange={e => setEditBuf(b => ({ ...b, [k]: e.target.value }))}
                            style={{ fontSize: '0.8rem', padding: '3px 6px', width: 70, textAlign: 'center',
                              fontWeight: 'bold', borderColor: 'var(--pink-border)' }} />
                        </td>
                      ))}
                      <td />
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-primary btn-sm" style={{ marginRight: 4 }}
                          onClick={() => {
                            setScores(scores.map(x => x.id !== s.id ? x : {
                              ...x,
                              date:       editBuf.date       ?? x.date,
                              equifax:    editBuf.equifax    !== undefined ? (editBuf.equifax    ? Number(editBuf.equifax)    : null) : x.equifax,
                              experian:   editBuf.experian   !== undefined ? (editBuf.experian   ? Number(editBuf.experian)   : null) : x.experian,
                              transunion: editBuf.transunion !== undefined ? (editBuf.transunion ? Number(editBuf.transunion) : null) : x.transunion,
                            }))
                            setEditingScoreId(null)
                            setEditBuf({})
                          }}>
                          Save
                        </button>
                        <button className="btn btn-sm" onClick={() => { setEditingScoreId(null); setEditBuf({}) }}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    // ── Normal display row ──
                    <tr key={s.id}>
                      <td>{formatDate(s.date)}</td>
                      <td className={scoreColor(s.equifax)}>{s.equifax || <span style={{color:'var(--text-faint)'}}>—</span>}</td>
                      <td className={scoreColor(s.experian)}>{s.experian || <span style={{color:'var(--text-faint)'}}>—</span>}</td>
                      <td className={scoreColor(s.transunion)}>{s.transunion || <span style={{color:'var(--text-faint)'}}>—</span>}</td>
                      <td className={`bold ${scoreColor(a)}`}>{a || <span style={{color:'var(--text-faint)',fontWeight:'normal'}}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <button className="btn btn-sm" style={{ marginRight: 4 }}
                          onClick={() => { setEditingScoreId(s.id); setEditBuf({}) }}>✏️</button>
                        <button className="btn btn-sm btn-danger"
                          onClick={() => setScores(scores.filter(x => x.id !== s.id))}>×</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {scores.length === 0 && !preview && <div className="empty-state"><p>Upload a credit report above or manually log the first scores to get started</p></div>}
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
// ── Bureau tag pill ──────────────────────────────────────────────────────────
const BUREAU_STYLE = {
  'Equifax':    { abbr: 'EQ', bg: '#EEF2FF', color: '#3730A3', border: '#C7D2FE' },
  'Experian':   { abbr: 'EX', bg: '#EDFAF4', color: '#065F46', border: '#6EE7B7' },
  'TransUnion': { abbr: 'TU', bg: '#F5F3FF', color: '#5B21B6', border: '#C4B5FD' },
}
function BureauTag({ bureau }) {
  const s = BUREAU_STYLE[bureau] || { abbr: (bureau||'').slice(0,2).toUpperCase(), bg:'var(--surface-hover)', color:'var(--text-muted)', border:'var(--border)' }
  return (
    <span title={bureau} style={{ fontSize:'0.65rem', fontWeight:700, padding:'2px 7px', borderRadius:4,
      background:s.bg, color:s.color, border:`1px solid ${s.border}`, letterSpacing:'0.02em' }}>
      {s.abbr}
    </span>
  )
}

function emptyNegForm() {
  return {
    creditor:'', type:'Collection', bureaus:[],
    balance:'', accountNumber:'', originalCreditor:'',
    dateOpened:'', dateFirstDelinquency:'', dateLastActivity:'', status:'',
    disputeStatus:'Not Started', lastDisputeDate:'',
    address:'', city:'', state:'', zip:'', phone:'',
    notes:'',
  }
}

function NegativeAccounts({ cid }) {
  const [accounts, setAccounts] = useLocalStorage(`credit_${cid}_negatives`, [])
  const [adding,   setAdding]   = useState(false)
  const [form,     setForm]     = useState(emptyNegForm())
  const [detailId, setDetailId] = useState(null)   // expanded detail card
  const [editId,   setEditId]   = useState(null)    // card in edit mode
  const [editForm, setEditForm] = useState({})

  const typeColor = { Collection:'badge-red', 'Late Payment':'badge-amber', 'Charge-off':'badge-red', Bankruptcy:'badge-red', Repossession:'badge-red', Judgment:'badge-red', 'Tax Lien':'badge-red', Other:'badge-gray' }

  function toggleBureau(b, target, setTarget) {
    const arr = target.bureaus.includes(b) ? target.bureaus.filter(x => x !== b) : [...target.bureaus, b]
    setTarget({ ...target, bureaus: arr })
  }

  function saveNew(e) {
    e.preventDefault()
    setAccounts([...accounts, { ...form, id: uid(), addedAt: today(), balance: Number(form.balance) || 0 }])
    setForm(emptyNegForm())
    setAdding(false)
  }

  function saveEdit(id) {
    setAccounts(accounts.map(a => a.id !== id ? a : { ...a, ...editForm, balance: Number(editForm.balance) || 0 }))
    setEditId(null)
  }

  function downloadLetter(a) {
    const bureauLine = (a.bureaus||[]).length ? `Reporting Bureaus: ${a.bureaus.join(', ')}\n` : ''
    const addrBlock  = [a.address, a.city && `${a.city}, ${a.state} ${a.zip}`, a.phone && `Phone: ${a.phone}`].filter(Boolean).join('\n')
    const letter = [
      'CERTIFIED MAIL — RETURN RECEIPT REQUESTED',
      '',
      new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' }),
      '',
      a.creditor,
      addrBlock,
      '',
      'To Whom It May Concern:',
      '',
      `I am writing to formally dispute the following account appearing on my credit report:`,
      '',
      `  Creditor:         ${a.creditor}`,
      a.originalCreditor ? `  Original Creditor: ${a.originalCreditor}` : '',
      a.accountNumber    ? `  Account Number:   ${a.accountNumber}` : '',
      `  Type:             ${a.type}`,
      a.balance > 0      ? `  Balance:          $${Number(a.balance).toLocaleString()}` : '',
      a.dateOpened       ? `  Date Opened:      ${formatDate(a.dateOpened)}` : '',
      bureauLine.trim()  ? `  ${bureauLine.trim()}` : '',
      '',
      'Under the Fair Credit Reporting Act (FCRA), Section 611, I have the right to dispute',
      'inaccurate or unverifiable information on my credit report. I am requesting that you',
      'investigate this item and provide verification. If this information cannot be verified,',
      'I request its immediate removal from my credit report.',
      '',
      'Please provide a written response within 30 days as required by the FCRA.',
      '',
      'Sincerely,',
      '',
      '[Your Name]',
      '[Address]',
      '[City, State, ZIP]',
      '[Phone]',
    ].filter(l => l !== undefined).join('\n')

    const blob = new Blob([letter], { type:'text/plain' })
    const url  = URL.createObjectURL(blob)
    const el   = document.createElement('a')
    el.href = url
    el.download = `dispute-${a.creditor.replace(/\s+/g,'-').toLowerCase()}.txt`
    el.click()
    URL.revokeObjectURL(url)
  }

  // ── Group accounts by creditor name (case-insensitive) ──────────────────────
  const groups = Object.values(
    accounts.reduce((acc, a) => {
      const key = (a.creditor || '').trim().toLowerCase()
      if (!acc[key]) acc[key] = []
      acc[key].push(a)
      return acc
    }, {})
  ).sort((g1, g2) => (g1[0].creditor || '').localeCompare(g2[0].creditor || ''))

  // ── Add form ─────────────────────────────────────────────────────────────────
  function NegForm({ value, onChange, onSubmit, onCancel, submitLabel }) {
    return (
      <form onSubmit={onSubmit}>
        <div className="form-row">
          <div className="form-group" style={{ gridColumn:'span 2' }}>
            <label>Creditor / Collection Agency</label>
            <input placeholder="e.g. Portfolio Recovery Associates" value={value.creditor} onChange={e => onChange({ ...value, creditor: e.target.value })} required />
          </div>
          <div className="form-group">
            <label>Type</label>
            <select value={value.type} onChange={e => onChange({ ...value, type: e.target.value })}>
              {NEGATIVE_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Balance ($)</label>
            <input type="number" step="0.01" placeholder="0.00" value={value.balance} onChange={e => onChange({ ...value, balance: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Account Number</label>
            <input placeholder="xxxx-xxxx" value={value.accountNumber||''} onChange={e => onChange({ ...value, accountNumber: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Original Creditor</label>
            <input placeholder="e.g. Capital One" value={value.originalCreditor||''} onChange={e => onChange({ ...value, originalCreditor: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Date Opened</label>
            <input type="date" value={value.dateOpened||''} onChange={e => onChange({ ...value, dateOpened: e.target.value })} />
          </div>
          <div className="form-group">
            <label style={{ display:'flex', alignItems:'center', gap:5 }}>
              Date of First Delinquency
              <span title="Used to calculate the 7-year fall-off date (FCRA)" style={{ cursor:'help', color:'var(--text-faint)', fontSize:'0.7rem' }}>ⓘ</span>
            </label>
            <input type="date" value={value.dateFirstDelinquency||''} onChange={e => onChange({ ...value, dateFirstDelinquency: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Last Activity</label>
            <input type="date" value={value.dateLastActivity||''} onChange={e => onChange({ ...value, dateLastActivity: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Account Status</label>
            <input placeholder="e.g. Unpaid, Paid, Transferred" value={value.status||''} onChange={e => onChange({ ...value, status: e.target.value })} />
          </div>
          <div className="form-group">
            <label>Dispute Status</label>
            <select value={value.disputeStatus||'Not Started'} onChange={e => onChange({ ...value, disputeStatus: e.target.value })}>
              {NEG_DISPUTE_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Last Dispute Date</label>
            <input type="date" value={value.lastDisputeDate||''} onChange={e => onChange({ ...value, lastDisputeDate: e.target.value })} />
          </div>
        </div>

        {/* Address block */}
        <div style={{ background:'var(--surface-hover)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:14 }}>
          <div style={{ fontSize:'0.68rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', fontWeight:600, marginBottom:10 }}>Creditor Contact Info</div>
          <div className="form-row" style={{ gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div className="form-group"><label>Street Address</label><input placeholder="123 Main St" value={value.address||''} onChange={e => onChange({ ...value, address: e.target.value })} /></div>
            <div className="form-group"><label>Phone</label><input placeholder="(800) 000-0000" value={value.phone||''} onChange={e => onChange({ ...value, phone: e.target.value })} /></div>
          </div>
          <div className="form-row" style={{ gridTemplateColumns:'2fr 1fr 1fr', gap:10, marginBottom:0 }}>
            <div className="form-group"><label>City</label><input placeholder="City" value={value.city||''} onChange={e => onChange({ ...value, city: e.target.value })} /></div>
            <div className="form-group"><label>State</label><input placeholder="TX" maxLength={2} value={value.state||''} onChange={e => onChange({ ...value, state: e.target.value })} /></div>
            <div className="form-group"><label>ZIP</label><input placeholder="00000" value={value.zip||''} onChange={e => onChange({ ...value, zip: e.target.value })} /></div>
          </div>
        </div>

        {/* Bureaus */}
        <div className="form-group mb-12">
          <label>Reporting Bureaus</label>
          <div style={{ display:'flex', gap:20, marginTop:8 }}>
            {BUREAUS.map(b => (
              <label key={b} style={{ display:'flex', gap:7, alignItems:'center', cursor:'pointer', fontSize:'0.875rem', textTransform:'none', letterSpacing:'normal', color:'var(--text)', fontWeight:400 }}>
                <input type="checkbox" checked={(value.bureaus||[]).includes(b)} onChange={() => toggleBureau(b, value, onChange)} />
                {b}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group mb-16">
          <label>Notes</label>
          <textarea value={value.notes||''} onChange={e => onChange({ ...value, notes: e.target.value })} placeholder="SOL date, settlement offers, dispute history, account details…" />
        </div>

        <div style={{ display:'flex', gap:8 }}>
          <button type="submit" className="btn btn-primary btn-sm">{submitLabel}</button>
          <button type="button" className="btn btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </form>
    )
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Negative Accounts</h2>
          <div style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginTop:3 }}>
            {groups.length} account{groups.length !== 1 ? 's' : ''} · {accounts.length} total entries · click any card for full details
          </div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setAdding(!adding); setForm(emptyNegForm()) }}>
          {adding ? 'Cancel' : '+ Add Account'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="card mb-24" style={{ borderColor:'var(--pink-border)' }}>
          <div className="card-header" style={{ background:'var(--pink-light)' }}>
            <h3 style={{ color:'var(--pink)' }}>New Negative Account</h3>
          </div>
          <div className="card-body">
            <NegForm value={form} onChange={setForm} onSubmit={saveNew} onCancel={() => setAdding(false)} submitLabel="Save Account" />
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state"><p>No negative accounts tracked yet</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {groups.map(group => {
            // Merge bureaus across all records in this group
            const allBureaus = [...new Set(group.flatMap(a => a.bureaus || []))]
            const primary    = group[0]
            const maxBalance = Math.max(...group.map(a => Number(a.balance) || 0))
            const isOpen     = detailId === primary.id
            const isEditing  = editId === primary.id

            return (
              <div key={primary.id} className="card" style={{ borderLeft:`4px solid ${allBureaus.length === 0 ? 'var(--border)' : allBureaus.length >= 3 ? 'var(--red)' : allBureaus.length === 2 ? 'var(--amber)' : 'var(--blue)'}`, overflow:'hidden' }}>

                {/* ── Summary row (always visible, click to expand) ── */}
                <div
                  onClick={() => { if (!isEditing) setDetailId(isOpen ? null : primary.id) }}
                  style={{ padding:'14px 18px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, background: isOpen ? 'var(--pink-light)' : 'var(--surface)', transition:'background 0.15s' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = 'var(--surface-hover)' }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'var(--surface)' }}
                >
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:5 }}>
                      <span style={{ fontWeight:700, fontSize:'0.95rem', color:'var(--heading)' }}>{primary.creditor}</span>
                      <span className={`badge ${typeColor[primary.type] || 'badge-gray'}`}>{primary.type}</span>
                      {/* Bureau tags — grouped */}
                      <div style={{ display:'flex', gap:4 }}>
                        {allBureaus.length > 0
                          ? allBureaus.map(b => <BureauTag key={b} bureau={b} />)
                          : <span style={{ fontSize:'0.68rem', color:'var(--text-faint)' }}>No bureau listed</span>
                        }
                      </div>
                      {group.length > 1 && (
                        <span style={{ fontSize:'0.65rem', color:'var(--text-muted)', background:'var(--surface-hover)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 6px' }}>
                          {group.length} entries
                        </span>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:12, flexWrap:'wrap', alignItems:'center' }}>
                      {maxBalance > 0 && <span style={{ fontSize:'0.82rem', fontWeight:700, color:'var(--red)' }}>${maxBalance.toLocaleString()}</span>}
                      {primary.dateOpened && <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>Opened {formatDate(primary.dateOpened)}</span>}
                      {(() => {
                        const fo = calcFallOff(primary)
                        if (!fo) return null
                        const label = fallOffLabel(fo)
                        const isPast = new Date(fo) < new Date()
                        return <span style={{ fontSize:'0.72rem', color: isPast ? 'var(--green)' : 'var(--amber)', fontWeight:600 }}>📅 {label}</span>
                      })()}
                      {primary.disputeStatus && primary.disputeStatus !== 'Not Started' && (() => {
                        const s = NEG_DISPUTE_COLORS[primary.disputeStatus] || NEG_DISPUTE_COLORS['Not Started']
                        return <span style={{ fontSize:'0.65rem', fontWeight:700, padding:'2px 7px', borderRadius:4, background:s.bg, color:s.color, border:`1px solid ${s.border}` }}>{primary.disputeStatus}</span>
                      })()}
                    </div>
                  </div>
                  <span style={{ color:'var(--pink)', fontSize:'0.75rem', flexShrink:0 }}>{isOpen ? '▲ Hide' : '▼ Details'}</span>
                </div>

                {/* ── Expanded detail panel ── */}
                {isOpen && !isEditing && (
                  <div style={{ borderTop:'1px solid var(--pink-border)', padding:'18px 20px', background:'#FFFBFD' }}>
                    {/* If multiple records in group, show each */}
                    {group.map((a, gi) => (
                      <div key={a.id} style={{ marginBottom: gi < group.length-1 ? 20 : 0, paddingBottom: gi < group.length-1 ? 20 : 0, borderBottom: gi < group.length-1 ? '1px dashed var(--border-light)' : 'none' }}>
                        {group.length > 1 && (
                          <div style={{ fontSize:'0.65rem', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--pink-text)', fontWeight:700, marginBottom:10 }}>
                            Entry {gi+1} — {(a.bureaus||[]).join(' · ') || 'No bureau'}
                          </div>
                        )}
                        {/* ── Fall-off / DOFD banner ── */}
                        {(() => {
                          const fo = calcFallOff(a)
                          if (!fo) return null
                          const isPast = new Date(fo) < new Date()
                          return (
                            <div style={{ display:'flex', gap:16, background: isPast ? '#EDFAF4' : '#FFFBEB', border:`1px solid ${isPast ? '#6EE7B7' : '#FDE68A'}`, borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, flexWrap:'wrap' }}>
                              <div>
                                <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color: isPast ? '#065F46' : '#92400E', fontWeight:700 }}>Date of First Delinquency</div>
                                <div style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text)', marginTop:2 }}>{formatDate(a.dateFirstDelinquency)}</div>
                              </div>
                              <div>
                                <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color: isPast ? '#065F46' : '#92400E', fontWeight:700 }}>Fall-off Date ({a.type === 'Bankruptcy' ? '10yr' : '7yr'})</div>
                                <div style={{ fontSize:'0.88rem', fontWeight:600, color: isPast ? 'var(--green)' : 'var(--amber)', marginTop:2 }}>{formatDate(fo)} — {fallOffLabel(fo)}</div>
                              </div>
                            </div>
                          )
                        })()}

                        {/* ── Dispute tracking ── */}
                        {(() => {
                          const ds = a.disputeStatus || 'Not Started'
                          const s  = NEG_DISPUTE_COLORS[ds] || NEG_DISPUTE_COLORS['Not Started']
                          return (
                            <div style={{ display:'flex', gap:16, background:s.bg, border:`1px solid ${s.border}`, borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:14, flexWrap:'wrap', alignItems:'center' }}>
                              <div>
                                <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color:s.color, fontWeight:700 }}>Dispute Status</div>
                                <div style={{ fontSize:'0.88rem', fontWeight:700, color:s.color, marginTop:2 }}>{ds}</div>
                              </div>
                              {a.lastDisputeDate && (
                                <div>
                                  <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color:s.color, fontWeight:700 }}>Last Dispute Sent</div>
                                  <div style={{ fontSize:'0.88rem', fontWeight:600, color:'var(--text)', marginTop:2 }}>{formatDate(a.lastDisputeDate)}</div>
                                </div>
                              )}
                            </div>
                          )
                        })()}

                        {/* ── All fields grid ── */}
                        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(160px,1fr))', gap:'10px 24px', marginBottom:12 }}>
                          {[
                            { label:'Creditor',               val: a.creditor },
                            { label:'Original Creditor',      val: a.originalCreditor },
                            { label:'Account Number',         val: a.accountNumber },
                            { label:'Type',                   val: a.type },
                            { label:'Balance',                val: a.balance > 0 ? `$${Number(a.balance).toLocaleString()}` : null },
                            { label:'Account Status',         val: a.status },
                            { label:'Date Opened',            val: a.dateOpened ? formatDate(a.dateOpened) : null },
                            { label:'Last Activity',          val: a.dateLastActivity ? formatDate(a.dateLastActivity) : null },
                          ].filter(f => f.val).map(f => (
                            <div key={f.label}>
                              <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-faint)', fontWeight:600 }}>{f.label}</div>
                              <div style={{ fontSize:'0.83rem', color:'var(--text)', marginTop:2 }}>{f.val}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── Contact / address block ── */}
                        {(a.address || a.phone || a.city) ? (
                          <div style={{ background:'var(--surface-hover)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:12 }}>
                            <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-faint)', fontWeight:700, marginBottom:8 }}>📍 Creditor Contact</div>
                            <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
                              {(a.address || a.city) && (
                                <div style={{ fontSize:'0.83rem', color:'var(--text)', lineHeight:1.6 }}>
                                  {a.address && <div>{a.address}</div>}
                                  {a.city && <div>{a.city}{a.state ? `, ${a.state}` : ''} {a.zip}</div>}
                                </div>
                              )}
                              {a.phone && <div style={{ fontSize:'0.83rem', color:'var(--text)' }}>📞 {a.phone}</div>}
                            </div>
                          </div>
                        ) : (
                          <div style={{ background:'var(--surface-hover)', border:'1px dashed var(--border)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:12, fontSize:'0.78rem', color:'var(--text-faint)' }}>
                            📍 No address on file — click ✏️ Edit to add. Look up on Google or check the credit report PDF.
                          </div>
                        )}

                        {/* ── Bureaus ── */}
                        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
                          <span style={{ fontSize:'0.68rem', color:'var(--text-muted)', fontWeight:600 }}>Reporting on:</span>
                          {(a.bureaus||[]).length > 0
                            ? a.bureaus.map(b => <BureauTag key={b} bureau={b} />)
                            : <span style={{ fontSize:'0.72rem', color:'var(--text-faint)' }}>—</span>
                          }
                        </div>
                        {a.notes && (
                          <div style={{ background:'var(--surface-hover)', border:'1px solid var(--border-light)', borderRadius:'var(--radius)', padding:'8px 12px', fontSize:'0.8rem', color:'var(--text-muted)', marginBottom:12, lineHeight:1.6 }}>
                            📝 {a.notes}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Action buttons */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => downloadLetter(primary)}>📄 Dispute Letter</button>
                      <button className="btn btn-sm" onClick={() => { setEditId(primary.id); setEditForm({ ...primary }) }}>✏️ Edit</button>
                      {group.map(a => (
                        <button key={a.id} className="btn btn-sm btn-danger"
                          onClick={() => { setAccounts(accounts.filter(x => x.id !== a.id)); if (group.length === 1) setDetailId(null) }}>
                          {group.length > 1 ? `🗑 Delete entry` : '🗑 Delete'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* ── Inline edit panel ── */}
                {isEditing && (
                  <div style={{ borderTop:'1px solid var(--pink-border)', padding:'18px 20px', background:'var(--pink-light)' }}>
                    <div style={{ fontWeight:600, marginBottom:16, color:'var(--pink-text)', fontSize:'0.875rem' }}>✏️ Edit Account</div>
                    <NegForm
                      value={editForm}
                      onChange={setEditForm}
                      onSubmit={e => { e.preventDefault(); saveEdit(primary.id) }}
                      onCancel={() => setEditId(null)}
                      submitLabel="Save Changes"
                    />
                  </div>
                )}
              </div>
            )
          })}
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
