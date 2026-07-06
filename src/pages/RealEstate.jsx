import { useState, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatCurrency, formatDate, formatPercent, today, uid } from '../utils/formatters.js'
import { readReceipt } from '../utils/anthropic.js'

const DEAL_STATUSES = ['Lead', 'Analyzing', 'Offer Sent', 'Under Contract', 'Closed', 'Dead']
const FLIP_STATUSES = ['Acquisition', 'Rehab', 'Listed', 'Under Contract', 'Completed', 'On Hold']

const STATUS_STYLE = {
  'Lead':           { color: '#B45309',       bg: '#FFFBEB',  border: '#FDE68A', dot: '#F59E0B'  },
  'Analyzing':      { color: '#0369A1',       bg: '#E0F2FE',  border: '#7DD3FC', dot: '#0EA5E9'  },
  'Offer Sent':     { color: '#7C3AED',       bg: '#F5F3FF',  border: '#C4B5FD', dot: '#8B5CF6'  },
  'Under Contract': { color: '#0F766E',       bg: '#F0FDFA',  border: '#99F6E4', dot: '#14B8A6'  },
  'Closed':         { color: '#15803D',       bg: '#F0FDF4',  border: '#86EFAC', dot: '#22C55E'  },
  'Dead':           { color: '#9CA3AF',       bg: '#F9FAFB',  border: '#E5E7EB', dot: '#D1D5DB'  },
}

// ─── Days since helper ────────────────────────────────────────────────────────
function daysSince(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return Math.floor((Date.now() - d) / 86400000)
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function Overview({ deals, fixFlip }) {
  const totalAssignFees = deals.filter(d => d.status === 'Closed').reduce((s, d) => s + Number(d.assignFee || 0), 0)
  const activePipeline  = deals.filter(d => !['Closed', 'Dead'].includes(d.status)).length
  const totalRehabSpent = fixFlip.reduce((s, p) => s + Number(p.actualRehab || 0), 0)
  const activeFlips     = fixFlip.filter(p => p.status !== 'Completed').length
  const projProfit      = fixFlip.reduce((s, p) => {
    const profit = Number(p.arv || 0) - Number(p.purchasePrice || 0) - Number(p.actualRehab || 0)
    return s + (profit > 0 ? profit : 0)
  }, 0)

  const pipelineByStatus = DEAL_STATUSES.slice(0, 5).map(s => ({
    status: s,
    count: deals.filter(d => d.status === s).length,
    style: STATUS_STYLE[s],
  }))

  return (
    <div>
      {/* Top metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)', marginBottom: 24 }}>
        <div className="metric-card metric-card-blue">
          <div className="metric-label">📋 Total Deals</div>
          <div className="metric-value">{deals.length}</div>
          <div className="metric-change neutral">{activePipeline} active</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">💰 Assign Fees</div>
          <div className="metric-value value-positive">{formatCurrency(totalAssignFees, true)}</div>
          <div className="metric-change neutral">{deals.filter(d => d.status === 'Closed').length} closed</div>
        </div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">🏚️ Active Flips</div>
          <div className="metric-value">{activeFlips}</div>
          <div className="metric-change neutral">{fixFlip.length} total projects</div>
        </div>
        <div className="metric-card metric-card-expense">
          <div className="metric-label">🔨 Rehab Spent</div>
          <div className="metric-value">{formatCurrency(totalRehabSpent, true)}</div>
        </div>
        <div className="metric-card metric-card-net">
          <div className="metric-label">📈 Proj. Flip Profit</div>
          <div className="metric-value value-positive">{formatCurrency(projProfit, true)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Wholesale pipeline funnel */}
        <div className="card">
          <div className="card-header">
            <h3>Wholesale Pipeline</h3>
            <a href="#" onClick={e => { e.preventDefault() }} style={{ fontSize: '0.72rem', color: 'var(--pink)', textDecoration: 'none' }}>
              {activePipeline} active
            </a>
          </div>
          <div className="card-body" style={{ padding: '12px 20px 16px' }}>
            {pipelineByStatus.map(({ status, count, style }) => (
              <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: '0.875rem' }}>{status}</div>
                <div style={{
                  minWidth: Math.max(4, count * 28) + 'px',
                  height: 22,
                  background: style.bg,
                  border: `1px solid ${style.border}`,
                  borderRadius: 4,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.72rem', fontWeight: 700, color: style.color,
                  transition: 'min-width 0.4s',
                  padding: '0 8px',
                }}>
                  {count}
                </div>
              </div>
            ))}
            {deals.length === 0 && (
              <div className="empty-state" style={{ padding: '16px 0' }}>
                <p>No deals yet — add your first lead in the Wholesale tab</p>
              </div>
            )}
          </div>
        </div>

        {/* Fix & Flip summary */}
        <div className="card">
          <div className="card-header"><h3>Fix &amp; Flip Projects</h3></div>
          <div className="card-body" style={{ padding: '12px 20px 16px' }}>
            {fixFlip.length === 0 ? (
              <div className="empty-state" style={{ padding: '16px 0' }}>
                <p>No projects yet — add one in the Fix &amp; Flip tab</p>
              </div>
            ) : (
              fixFlip.slice(0, 4).map(p => {
                const rehabPct = p.rehabBudget ? Math.min(100, (Number(p.actualRehab || 0) / Number(p.rehabBudget)) * 100) : 0
                const profit = Number(p.arv || 0) - Number(p.purchasePrice || 0) - Number(p.actualRehab || 0)
                return (
                  <div key={p.id} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{p.address}</div>
                      <span className={`badge ${p.status === 'Completed' ? 'badge-green' : p.status === 'On Hold' ? 'badge-red' : 'badge-blue'}`} style={{ fontSize: '0.65rem', flexShrink: 0, marginLeft: 8 }}>{p.status}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 5 }}>
                      <span>Rehab: {formatCurrency(p.actualRehab || 0)} / {formatCurrency(p.rehabBudget)}</span>
                      {profit !== 0 && <span className={profit > 0 ? 'text-green' : 'text-red'}>Est. {formatCurrency(profit, true)}</span>}
                    </div>
                    <div className="progress-bar" style={{ height: 5 }}>
                      <div className="progress-fill" style={{ width: `${rehabPct}%`, background: rehabPct > 100 ? 'var(--red)' : 'var(--green)' }} />
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Recent deals table */}
      {deals.filter(d => !['Closed', 'Dead'].includes(d.status)).length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header"><h3>Active Wholesale Pipeline</h3></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Asking</th>
                  <th>Max Offer (70%)</th>
                  <th>Assign Fee</th>
                  <th>Days Active</th>
                </tr>
              </thead>
              <tbody>
                {deals
                  .filter(d => !['Closed', 'Dead'].includes(d.status))
                  .sort((a, b) => (b.dateAdded || '').localeCompare(a.dateAdded || ''))
                  .map(d => {
                    const st = STATUS_STYLE[d.status] || STATUS_STYLE['Lead']
                    const days = daysSince(d.dateAdded)
                    return (
                      <tr key={d.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{d.address}</div>
                          {d.buyerName && <div className="text-xs text-muted">Buyer: {d.buyerName}</div>}
                        </td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', background: st.bg, border: `1px solid ${st.border}`, borderRadius: 20, fontSize: '0.72rem', fontWeight: 600, color: st.color }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: st.dot, flexShrink: 0 }} />
                            {d.status}
                          </span>
                        </td>
                        <td>{d.askingPrice ? formatCurrency(d.askingPrice) : '—'}</td>
                        <td className={d.maxOffer >= 0 ? 'text-green' : 'text-red'}>{d.maxOffer != null ? formatCurrency(d.maxOffer) : '—'}</td>
                        <td>{d.assignFee ? formatCurrency(d.assignFee) : '—'}</td>
                        <td className="text-muted text-sm">{days != null ? `${days}d` : '—'}</td>
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

// ─── Deal Card ────────────────────────────────────────────────────────────────
function DealCard({ deal, onStatusChange, onEdit, onDelete }) {
  const [hov, setHov] = useState(false)
  const st    = STATUS_STYLE[deal.status] || STATUS_STYLE['Lead']
  const days  = daysSince(deal.dateAdded)
  const spread = deal.maxOffer != null && deal.askingPrice
    ? Number(deal.maxOffer) - Number(deal.askingPrice) : null

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: '#fff',
        border: `1px solid ${hov ? 'var(--pink-border)' : 'var(--border)'}`,
        borderTop: `3px solid ${st.dot}`,
        borderRadius: 12,
        padding: '12px 14px',
        boxShadow: hov ? 'var(--shadow-md)' : 'var(--shadow)',
        transition: 'all 0.15s',
        cursor: 'pointer',
        position: 'relative',
      }}
      onClick={() => onEdit(deal)}
    >
      {/* Address */}
      <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 6, lineHeight: 1.3, color: 'var(--heading)', paddingRight: 20 }}>
        {deal.address || '(No address)'}
      </div>

      {/* Delete button */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(deal.id) }}
        style={{ position: 'absolute', top: 10, right: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '0.95rem', padding: 0, lineHeight: 1 }}
      >×</button>

      {/* Key numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
        {deal.askingPrice && (
          <div style={{ background: 'var(--bg)', borderRadius: 6, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 1 }}>Asking</div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text)' }}>{formatCurrency(deal.askingPrice, true)}</div>
          </div>
        )}
        {deal.maxOffer != null && (
          <div style={{ background: spread >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', borderRadius: 6, padding: '5px 8px' }}>
            <div style={{ fontSize: '0.55rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', marginBottom: 1 }}>Max Offer</div>
            <div style={{ fontWeight: 700, fontSize: '0.82rem', color: spread >= 0 ? 'var(--green)' : 'var(--red)' }}>{formatCurrency(deal.maxOffer, true)}</div>
          </div>
        )}
      </div>

      {/* Assignment fee */}
      {deal.assignFee && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Assignment fee:</span>
          <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--green)' }}>{formatCurrency(deal.assignFee)}</span>
        </div>
      )}

      {/* Buyer */}
      {deal.buyerName && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 6 }}>
          👤 {deal.buyerName}
        </div>
      )}

      {/* Notes preview */}
      {deal.notes && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-faint)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 8 }}>
          {deal.notes}
        </div>
      )}

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <select
          value={deal.status}
          onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onStatusChange(deal.id, e.target.value) }}
          style={{
            fontSize: '0.7rem', padding: '3px 6px',
            border: `1px solid ${st.border}`, background: st.bg,
            color: st.color, borderRadius: 6, cursor: 'pointer', fontWeight: 600,
          }}
        >
          {DEAL_STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        {days != null && (
          <span style={{ fontSize: '0.62rem', color: 'var(--text-faint)' }}>{days}d ago</span>
        )}
      </div>
    </div>
  )
}

// ─── Deal Edit Modal ──────────────────────────────────────────────────────────
function DealModal({ deal, onSave, onClose }) {
  const [form, setForm] = useState(deal || {
    address: '', askingPrice: '', arv: '', repairCost: '', status: 'Lead',
    assignFee: '', buyerName: '', closeDate: '', notes: '',
  })

  const rule70 = (arv, repairs) => arv && repairs ? (Number(arv) * 0.70 - Number(repairs)) : null

  function save(e) {
    e.preventDefault()
    const maxOffer = rule70(form.arv, form.repairCost)
    onSave({ ...form, maxOffer: maxOffer ?? form.maxOffer, id: form.id || uid(), dateAdded: form.dateAdded || today() })
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h2 style={{ marginBottom: 20 }}>{form.id ? 'Edit Deal' : 'Add Wholesale Deal'}</h2>
        <form onSubmit={save}>
          <div className="form-row">
            <div className="form-group" style={{ gridColumn: '1/-1' }}>
              <label>Address</label>
              <input placeholder="123 Main St, City, ST" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required />
            </div>
            <div className="form-group"><label>Asking Price</label><input type="number" step="1" placeholder="0" value={form.askingPrice} onChange={e => setForm({ ...form, askingPrice: e.target.value })} /></div>
            <div className="form-group"><label>ARV</label><input type="number" step="1" placeholder="0" value={form.arv} onChange={e => setForm({ ...form, arv: e.target.value })} /></div>
            <div className="form-group"><label>Repair Cost (Est.)</label><input type="number" step="1" placeholder="0" value={form.repairCost} onChange={e => setForm({ ...form, repairCost: e.target.value })} /></div>
            <div className="form-group"><label>Assign Fee (Target)</label><input type="number" step="1" placeholder="0" value={form.assignFee} onChange={e => setForm({ ...form, assignFee: e.target.value })} /></div>
            <div className="form-group"><label>Buyer Name</label><input placeholder="Cash buyer" value={form.buyerName} onChange={e => setForm({ ...form, buyerName: e.target.value })} /></div>
            <div className="form-group"><label>Est. Close Date</label><input type="date" value={form.closeDate} onChange={e => setForm({ ...form, closeDate: e.target.value })} /></div>
            <div className="form-group">
              <label>Status</label>
              <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                {DEAL_STATUSES.map(s => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {form.arv && form.repairCost && (
            <div style={{ background: 'var(--green-bg)', border: '1px solid var(--green)', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 12 }}>
              <span style={{ fontSize: '0.875rem' }}>70% Rule Max Offer: </span>
              <strong style={{ color: 'var(--green)', fontSize: '1rem' }}>
                {formatCurrency(Number(form.arv) * 0.70 - Number(form.repairCost))}
              </strong>
            </div>
          )}

          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Seller motivation, condition, timeline…" />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Deal</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Wholesale Tracker (Kanban) ───────────────────────────────────────────────
function WholesaleTracker() {
  const [deals, setDeals] = useLocalStorage('re_wholesale', [])
  const [modal, setModal] = useState(false)
  const [editDeal, setEditDeal] = useState(null)
  const [viewClosed, setViewClosed] = useState(false)

  function updateStatus(id, status) {
    setDeals(deals.map(d => d.id === id ? { ...d, status } : d))
  }

  function saveEdit(updated) {
    if (updated.id && deals.find(d => d.id === updated.id)) {
      setDeals(deals.map(d => d.id === updated.id ? updated : d))
    } else {
      setDeals([...deals, updated])
    }
  }

  function deleteDeal(id) {
    if (window.confirm('Remove this deal?')) {
      setDeals(deals.filter(d => d.id !== id))
    }
  }

  // Active pipeline columns (excluding Closed/Dead — shown separately)
  const PIPELINE_COLS = ['Lead', 'Analyzing', 'Offer Sent', 'Under Contract']
  const activeCols    = PIPELINE_COLS.map(s => ({ status: s, style: STATUS_STYLE[s], cards: deals.filter(d => d.status === s) }))
  const closedDeals   = deals.filter(d => d.status === 'Closed')
  const deadDeals     = deals.filter(d => d.status === 'Dead')

  return (
    <div>
      {/* Header */}
      <div className="flex-between mb-16">
        <div>
          <h2>Wholesale Deal Tracker</h2>
          <p className="text-sm text-muted mt-4">Drag statuses on each card to move them through the pipeline</p>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => { setEditDeal(null); setModal(true) }}>+ Add Deal</button>
      </div>

      {/* Summary metrics */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="metric-card metric-card-blue">
          <div className="metric-label">Total Deals</div>
          <div className="metric-value">{deals.length}</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Closed / Assigned</div>
          <div className="metric-value value-positive">{closedDeals.length}</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Assign Fees Earned</div>
          <div className="metric-value value-positive">
            {formatCurrency(closedDeals.reduce((s, d) => s + Number(d.assignFee || 0), 0), true)}
          </div>
        </div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">Active Pipeline</div>
          <div className="metric-value">{deals.filter(d => !['Closed', 'Dead'].includes(d.status)).length}</div>
        </div>
      </div>

      {deals.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🏘️</div>
          <p>No deals yet — add your first lead above</p>
        </div>
      ) : (
        <>
          {/* Pipeline kanban — 4 active status columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
            {activeCols.map(({ status, style, cards }) => (
              <div key={status}>
                {/* Column header */}
                <div style={{
                  padding: '8px 14px', marginBottom: 10, borderRadius: 'var(--radius)',
                  background: style.bg, border: `1px solid ${style.border}`,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: style.dot, flexShrink: 0 }} />
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: style.color }}>{status}</span>
                  </div>
                  <span style={{ background: 'white', border: `1px solid ${style.border}`, borderRadius: 20, padding: '1px 8px', fontSize: '0.68rem', fontWeight: 700, color: style.color }}>
                    {cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {cards.map(d => (
                    <DealCard
                      key={d.id}
                      deal={d}
                      onStatusChange={updateStatus}
                      onEdit={deal => { setEditDeal(deal); setModal(true) }}
                      onDelete={deleteDeal}
                    />
                  ))}
                  {cards.length === 0 && (
                    <div style={{ padding: '20px 14px', color: 'var(--text-faint)', fontSize: '0.75rem', textAlign: 'center', border: '1.5px dashed var(--border)', borderRadius: 10 }}>
                      Empty
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Closed & Dead section (collapsible) */}
          {(closedDeals.length > 0 || deadDeals.length > 0) && (
            <div className="card">
              <div
                onClick={() => setViewClosed(!viewClosed)}
                className="card-header"
                style={{ cursor: 'pointer', userSelect: 'none' }}
              >
                <h3>
                  <span style={{ marginRight: 8, color: 'var(--text-faint)' }}>{viewClosed ? '▲' : '▼'}</span>
                  Closed &amp; Dead Deals ({closedDeals.length + deadDeals.length})
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ background: STATUS_STYLE.Closed.bg, border: `1px solid ${STATUS_STYLE.Closed.border}`, color: STATUS_STYLE.Closed.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700 }}>
                    {closedDeals.length} closed
                  </span>
                  <span style={{ background: STATUS_STYLE.Dead.bg, border: `1px solid ${STATUS_STYLE.Dead.border}`, color: STATUS_STYLE.Dead.color, borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 700 }}>
                    {deadDeals.length} dead
                  </span>
                </div>
              </div>
              {viewClosed && (
                <div className="card-body">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                    {[...closedDeals, ...deadDeals].map(d => (
                      <DealCard key={d.id} deal={d} onStatusChange={updateStatus} onEdit={deal => { setEditDeal(deal); setModal(true) }} onDelete={deleteDeal} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Add / Edit modal */}
      {modal && (
        <DealModal
          deal={editDeal}
          onSave={saveEdit}
          onClose={() => { setModal(false); setEditDeal(null) }}
        />
      )}
    </div>
  )
}

// ─── Fix & Flip Tracker ───────────────────────────────────────────────────────
function FixFlip() {
  const [projects, setProjects] = useLocalStorage('re_fixflip', [])
  const [modal, setModal]       = useState(false)
  const [selected, setSelected] = useState(null)
  const [form, setForm]         = useState({
    address: '', purchasePrice: '', rehabBudget: '', arv: '', status: 'Acquisition',
    purchaseDate: '', targetSaleDate: '', notes: '',
  })
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError]     = useState('')
  const fileRef = useRef(null)

  function save(e) {
    e.preventDefault()
    setProjects([...projects, { ...form, id: uid(), actualRehab: 0, receipts: [], expenses: [] }])
    setForm({ address: '', purchasePrice: '', rehabBudget: '', arv: '', status: 'Acquisition', purchaseDate: '', targetSaleDate: '', notes: '' })
    setModal(false)
  }

  const proj = selected ? projects.find(p => p.id === selected) : null

  function updateProj(updated) {
    setProjects(projects.map(p => p.id === updated.id ? updated : p))
  }

  async function handleReceipt(e) {
    const file = e.target.files[0]
    if (!file || !proj) return
    setReceiptLoading(true)
    setReceiptError('')
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const base64 = ev.target.result.split(',')[1]
        const mime   = file.type
        const data   = await readReceipt(base64, mime)
        const receipt = { id: uid(), ...data, fileName: file.name, addedAt: today() }
        const updated = {
          ...proj,
          receipts:    [...(proj.receipts || []), receipt],
          actualRehab: (proj.actualRehab || 0) + Number(data.total || 0),
        }
        updateProj(updated)
      } catch (err) {
        setReceiptError(err.message)
      }
      setReceiptLoading(false)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Fix &amp; Flip Projects</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>+ New Project</button>
      </div>

      {!selected ? (
        <>
          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card metric-card-blue"><div className="metric-label">Total Projects</div><div className="metric-value">{projects.length}</div></div>
            <div className="metric-card metric-card-pending"><div className="metric-label">Active</div><div className="metric-value">{projects.filter(p => p.status !== 'Completed').length}</div></div>
            <div className="metric-card metric-card-expense">
              <div className="metric-label">Total Rehab Spent</div>
              <div className="metric-value">{formatCurrency(projects.reduce((s, p) => s + Number(p.actualRehab || 0), 0), true)}</div>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>🔨</div>
              <p>No fix &amp; flip projects yet</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {projects.map(p => {
                const roi = p.arv && p.purchasePrice
                  ? ((Number(p.arv) - Number(p.purchasePrice) - Number(p.actualRehab || 0)) / Number(p.purchasePrice) * 100)
                  : null
                const rehabPct = p.rehabBudget
                  ? Math.min(100, (Number(p.actualRehab || 0) / Number(p.rehabBudget)) * 100)
                  : 0
                return (
                  <div key={p.id} className="card">
                    <div className="card-body">
                      <div className="flex-between">
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.address}</div>
                          <div className="text-xs text-muted mt-4">
                            Purchase: {formatCurrency(p.purchasePrice)} · ARV: {formatCurrency(p.arv)} · Budget: {formatCurrency(p.rehabBudget)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span className={`badge ${p.status === 'Completed' ? 'badge-green' : p.status === 'On Hold' ? 'badge-red' : 'badge-blue'}`}>{p.status}</span>
                          <button className="btn btn-sm" onClick={() => setSelected(p.id)}>View</button>
                          <button className="btn btn-sm btn-danger" onClick={() => setProjects(projects.filter(x => x.id !== p.id))}>×</button>
                        </div>
                      </div>
                      <div style={{ marginTop: 12 }}>
                        <div className="flex-between text-xs text-muted mb-4">
                          <span>Rehab: {formatCurrency(p.actualRehab || 0)} / {formatCurrency(p.rehabBudget)}</span>
                          <span>{rehabPct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width: `${rehabPct}%`, background: rehabPct > 100 ? 'var(--red)' : 'var(--green)' }} />
                        </div>
                      </div>
                      {roi != null && (
                        <div className="mt-8 text-xs">
                          Est. ROI: <strong className={roi >= 0 ? 'text-green' : 'text-red'}>{formatPercent(roi)}</strong>
                          <span className="text-muted"> · Est. Profit: </span>
                          <strong className={roi >= 0 ? 'text-green' : 'text-red'}>
                            {formatCurrency(Number(p.arv) - Number(p.purchasePrice) - Number(p.actualRehab || 0))}
                          </strong>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : proj ? (
        <div>
          <button className="btn btn-sm mb-16" onClick={() => setSelected(null)}>← Back to Projects</button>
          <div className="flex-between mb-16">
            <h2>{proj.address}</h2>
            <select value={proj.status} onChange={e => updateProj({ ...proj, status: e.target.value })}>
              {FLIP_STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="metrics-grid" style={{ marginBottom: 24 }}>
            <div className="metric-card"><div className="metric-label">Purchase Price</div><div className="metric-value">{formatCurrency(proj.purchasePrice)}</div></div>
            <div className="metric-card"><div className="metric-label">Rehab Budget</div><div className="metric-value">{formatCurrency(proj.rehabBudget)}</div></div>
            <div className="metric-card">
              <div className="metric-label">Rehab Spent</div>
              <div className={`metric-value ${Number(proj.actualRehab) > Number(proj.rehabBudget) ? 'value-negative' : ''}`}>{formatCurrency(proj.actualRehab || 0)}</div>
            </div>
            <div className="metric-card"><div className="metric-label">ARV</div><div className="metric-value">{formatCurrency(proj.arv)}</div></div>
          </div>

          {/* Receipt upload */}
          <div className="card mb-24">
            <div className="card-header flex-between">
              <h3>📄 Receipts</h3>
              <label className="btn btn-sm btn-primary" style={{ cursor: 'pointer' }}>
                <input type="file" ref={fileRef} accept="image/*,application/pdf" onChange={handleReceipt} style={{ display: 'none' }} />
                {receiptLoading ? '⏳ Reading…' : '+ Upload Receipt (img or PDF)'}
              </label>
            </div>
            <div className="card-body">
              {receiptError && <div className="text-xs text-red mb-8">{receiptError}</div>}
              {(proj.receipts || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                  <div style={{ fontSize: '2rem', marginBottom: 6 }}>📸</div>
                  No receipts yet. Upload a photo to extract data with AI.
                </div>
              ) : (
                <div className="table-container">
                <table>
                  <thead><tr><th>Vendor</th><th>Date</th><th>Category</th><th>Total</th><th>File</th><th></th></tr></thead>
                  <tbody>
                    {proj.receipts.map(r => (
                      <tr key={r.id}>
                        <td>{r.vendor || '—'}</td>
                        <td>{r.date || '—'}</td>
                        <td><span className="badge badge-gray">{r.category || '—'}</span></td>
                        <td style={{ color: 'var(--red)', fontWeight: 600 }}>{formatCurrency(r.total)}</td>
                        <td className="text-xs text-muted">{r.fileName}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={() => {
                            const updated = { ...proj, receipts: proj.receipts.filter(x => x.id !== r.id), actualRehab: Number(proj.actualRehab) - Number(r.total || 0) }
                            updateProj(updated)
                          }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <h2>New Fix &amp; Flip Project</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{ gridColumn: '1/-1' }}><label>Address</label><input placeholder="123 Main St" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} required /></div>
                <div className="form-group"><label>Purchase Price</label><input type="number" step="1" placeholder="0" value={form.purchasePrice} onChange={e => setForm({ ...form, purchasePrice: e.target.value })} /></div>
                <div className="form-group"><label>Rehab Budget</label><input type="number" step="1" placeholder="0" value={form.rehabBudget} onChange={e => setForm({ ...form, rehabBudget: e.target.value })} /></div>
                <div className="form-group"><label>ARV</label><input type="number" step="1" placeholder="0" value={form.arv} onChange={e => setForm({ ...form, arv: e.target.value })} /></div>
                <div className="form-group"><label>Purchase Date</label><input type="date" value={form.purchaseDate} onChange={e => setForm({ ...form, purchaseDate: e.target.value })} /></div>
                <div className="form-group"><label>Target Sale Date</label><input type="date" value={form.targetSaleDate} onChange={e => setForm({ ...form, targetSaleDate: e.target.value })} /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                    {FLIP_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{ marginBottom: 12 }}><label>Notes</label><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Deal Analyzer ────────────────────────────────────────────────────────────
function DealAnalyzer() {
  const [vals, setVals] = useState({
    arv: '', purchasePrice: '', rehabCost: '', holdingCosts: '',
    closingCosts: '', agentFees: '', loanAmount: '', interestRate: '',
    loanMonths: '', rentalRent: '', rentalExpenses: '', rentalVacancy: '10',
  })
  const v = n => Number(vals[n]) || 0

  const maxOffer70   = v('arv') * 0.70 - v('rehabCost')
  const totalCost    = v('purchasePrice') + v('rehabCost') + v('holdingCosts') + v('closingCosts') + v('agentFees')
  const grossProfit  = v('arv') - totalCost
  const roi          = totalCost ? (grossProfit / (v('purchasePrice') + v('rehabCost'))) * 100 : 0
  const dealScore    = grossProfit > 30000 && roi > 20 ? 'Strong Buy' : grossProfit > 15000 && roi > 10 ? 'Buy' : grossProfit > 0 ? 'Marginal' : 'Pass'
  const scoreColors  = { 'Strong Buy': 'badge-green', 'Buy': 'badge-blue', 'Marginal': 'badge-amber', 'Pass': 'badge-red' }

  const monthlyInterest = v('loanAmount') * (v('interestRate') / 100 / 12)
  const totalInterest   = monthlyInterest * v('loanMonths')
  const cashNeeded      = v('purchasePrice') - v('loanAmount') + v('rehabCost')

  const noi        = (v('rentalRent') * (1 - v('rentalVacancy') / 100)) - v('rentalExpenses')
  const cashOnCash = cashNeeded ? (noi * 12 / cashNeeded) * 100 : 0
  const capRate    = v('arv') ? (noi * 12 / v('arv')) * 100 : 0

  const field = (key, label, placeholder = '0') => (
    <div className="form-group">
      <label>{label}</label>
      <input type="number" step="any" placeholder={placeholder}
        value={vals[key]} onChange={e => setVals({ ...vals, [key]: e.target.value })} />
    </div>
  )

  return (
    <div>
      <h2 className="mb-16">Deal Analyzer</h2>
      <div className="section-grid">
        <div>
          <div className="card mb-16">
            <div className="card-header"><h3>Property Values</h3></div>
            <div className="card-body">
              <div className="form-row">
                {field('arv', 'After Repair Value (ARV)')}
                {field('purchasePrice', 'Purchase Price')}
                {field('rehabCost', 'Rehab Cost')}
                {field('holdingCosts', 'Holding Costs')}
                {field('closingCosts', 'Closing Costs')}
                {field('agentFees', 'Agent Fees')}
              </div>
            </div>
          </div>

          <div className="card mb-16">
            <div className="card-header"><h3>Financing</h3></div>
            <div className="card-body">
              <div className="form-row">
                {field('loanAmount', 'Loan Amount')}
                {field('interestRate', 'Interest Rate %', '12')}
                {field('loanMonths', 'Loan Term (months)', '6')}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Rental Analysis (Buy &amp; Hold)</h3></div>
            <div className="card-body">
              <div className="form-row">
                {field('rentalRent', 'Monthly Rent')}
                {field('rentalExpenses', 'Monthly Expenses')}
                {field('rentalVacancy', 'Vacancy Rate %', '10')}
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          <div className="card mb-16">
            <div className="card-header flex-between">
              <h3>Flip Analysis</h3>
              <span className={`badge ${scoreColors[dealScore]}`}>{dealScore}</span>
            </div>
            <div className="card-body">
              <table>
                <tbody>
                  <tr><td>Max Offer (70% Rule)</td><td className={`text-right bold ${maxOffer70 >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(maxOffer70)}</td></tr>
                  <tr><td>Total All-In Cost</td><td className="text-right">{formatCurrency(totalCost)}</td></tr>
                  <tr><td>Gross Profit</td><td className={`text-right bold ${grossProfit >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(grossProfit)}</td></tr>
                  <tr><td>ROI</td><td className={`text-right bold ${roi >= 0 ? 'text-green' : 'text-red'}`}>{formatPercent(roi)}</td></tr>
                  <tr><td style={{ paddingTop: 8 }}>Total Interest Paid</td><td className="text-right text-red">{formatCurrency(totalInterest)}</td></tr>
                  <tr><td>Cash Needed</td><td className="text-right">{formatCurrency(cashNeeded)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Rental Analysis</h3></div>
            <div className="card-body">
              <table>
                <tbody>
                  <tr><td>Net Operating Income (mo.)</td><td className={`text-right bold ${noi >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(noi)}</td></tr>
                  <tr><td>Annual NOI</td><td className={`text-right ${noi >= 0 ? 'text-green' : 'text-red'}`}>{formatCurrency(noi * 12)}</td></tr>
                  <tr><td>Cap Rate</td><td className={`text-right bold ${capRate >= 8 ? 'text-green' : capRate >= 5 ? '' : 'text-red'}`}>{formatPercent(capRate)}</td></tr>
                  <tr><td>Cash-on-Cash Return</td><td className={`text-right bold ${cashOnCash >= 8 ? 'text-green' : ''}`}>{formatPercent(cashOnCash)}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Real Estate Page ─────────────────────────────────────────────────────────
export default function RealEstate() {
  const [tab,     setTab]     = useState('overview')
  const [deals]   = useLocalStorage('re_wholesale', [])
  const [fixFlip] = useLocalStorage('re_fixflip',   [])

  const TABS = [
    { id: 'overview',  label: '📊 Overview'    },
    { id: 'wholesale', label: '🏘️ Wholesale'   },
    { id: 'fixflip',   label: '🔨 Fix & Flip'  },
    { id: 'analyzer',  label: '🧮 Analyzer'    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Real Estate</h1>
        <p>Deal tracking, project management, and analysis</p>
      </div>
      <div className="tabs">
        {TABS.map(t => (
          <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'overview'  && <Overview deals={deals} fixFlip={fixFlip} />}
      {tab === 'wholesale' && <WholesaleTracker />}
      {tab === 'fixflip'   && <FixFlip />}
      {tab === 'analyzer'  && <DealAnalyzer />}
    </div>
  )
}
