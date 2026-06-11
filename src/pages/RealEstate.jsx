import { useState, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatCurrency, formatDate, formatPercent, today, uid } from '../utils/formatters.js'
import { readReceipt } from '../utils/anthropic.js'

const DEAL_STATUSES  = ['Lead', 'Analyzing', 'Offer Sent', 'Under Contract', 'Closed', 'Dead']
const FLIP_STATUSES  = ['Acquisition', 'Rehab', 'Listed', 'Under Contract', 'Completed', 'On Hold']

// ─── Wholesale Tracker ────────────────────────────────────────────────────────
function WholesaleTracker() {
  const [deals, setDeals] = useLocalStorage('re_wholesale', [])
  const [modal, setModal] = useState(false)
  const [form, setForm]   = useState({
    address:'', askingPrice:'', arv:'', repairCost:'', status:'Lead',
    assignFee:'', buyerName:'', closeDate:'', notes:'',
  })

  const rule70 = (arv, repairs) => arv && repairs ? (Number(arv)*0.70 - Number(repairs)) : null

  function save(e) {
    e.preventDefault()
    const maxOffer = rule70(form.arv, form.repairCost)
    setDeals([...deals, { ...form, id:uid(), maxOffer, dateAdded:today() }])
    setForm({ address:'', askingPrice:'', arv:'', repairCost:'', status:'Lead', assignFee:'', buyerName:'', closeDate:'', notes:'' })
    setModal(false)
  }

  function updateStatus(id, status) {
    setDeals(deals.map(d => d.id===id ? {...d,status} : d))
  }

  const grouped = DEAL_STATUSES.reduce((acc,s)=>({ ...acc, [s]: deals.filter(d=>d.status===s) }),{})

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Wholesale Deal Tracker</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ Add Deal</button>
      </div>

      {/* Summary */}
      <div className="metrics-grid" style={{ marginBottom:24 }}>
        <div className="metric-card metric-card-blue"><div className="metric-label">Total Deals</div><div className="metric-value">{deals.length}</div></div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Closed / Assigned</div>
          <div className="metric-value text-green">{deals.filter(d=>d.status==='Closed').length}</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">Assign Fees Earned</div>
          <div className="metric-value text-green">
            {formatCurrency(deals.filter(d=>d.status==='Closed').reduce((s,d)=>s+Number(d.assignFee||0),0),true)}
          </div>
        </div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">Active Pipeline</div>
          <div className="metric-value">{deals.filter(d=>!['Closed','Dead'].includes(d.status)).length}</div>
        </div>
      </div>

      {/* Kanban-style list */}
      {deals.length === 0 ? (
        <div className="empty-state"><p>No deals yet. Add your first lead.</p></div>
      ) : (
        <div className="card table-container">
          <table>
            <thead><tr>
              <th>Address</th><th>Asking</th><th>ARV</th><th>Max Offer (70%)</th>
              <th>Assign Fee</th><th>Status</th><th>Date</th><th></th>
            </tr></thead>
            <tbody>
              {[...deals].sort((a,b)=>b.dateAdded?.localeCompare(a.dateAdded)).map(d=>{
                const spread = d.maxOffer && d.askingPrice ? d.maxOffer - Number(d.askingPrice) : null
                return (
                  <tr key={d.id}>
                    <td>
                      <div className="bold text-sm">{d.address}</div>
                      {d.buyerName && <div className="text-xs text-muted">Buyer: {d.buyerName}</div>}
                      {d.notes && <div className="text-xs text-muted" style={{maxWidth:200,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{d.notes}</div>}
                    </td>
                    <td>{d.askingPrice ? formatCurrency(d.askingPrice) : '—'}</td>
                    <td>{d.arv ? formatCurrency(d.arv) : '—'}</td>
                    <td>
                      {d.maxOffer != null ? (
                        <>
                          <span className={spread>=0?'text-green':'text-red'}>{formatCurrency(d.maxOffer)}</span>
                          {spread != null && (
                            <div className={`text-xs ${spread>=0?'text-green':'text-red'}`}>
                              {spread>=0?'Spread:':''}{formatCurrency(Math.abs(spread))} {spread>=0?'profit':'over'}
                            </div>
                          )}
                        </>
                      ) : '—'}
                    </td>
                    <td>{d.assignFee ? formatCurrency(d.assignFee) : '—'}</td>
                    <td>
                      <select value={d.status} onChange={e=>updateStatus(d.id,e.target.value)} style={{fontSize:'0.8125rem',padding:'2px 4px'}}>
                        {DEAL_STATUSES.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="text-muted text-xs">{formatDate(d.dateAdded)}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={()=>setDeals(deals.filter(x=>x.id!==d.id))}>×</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h2>Add Wholesale Deal</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{gridColumn:'1/-1'}}>
                  <label>Address</label>
                  <input placeholder="123 Main St, City, ST" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} required />
                </div>
                <div className="form-group"><label>Asking Price</label><input type="number" step="1" placeholder="0" value={form.askingPrice} onChange={e=>setForm({...form,askingPrice:e.target.value})} /></div>
                <div className="form-group"><label>ARV</label><input type="number" step="1" placeholder="0" value={form.arv} onChange={e=>setForm({...form,arv:e.target.value})} /></div>
                <div className="form-group"><label>Repair Cost (Est.)</label><input type="number" step="1" placeholder="0" value={form.repairCost} onChange={e=>setForm({...form,repairCost:e.target.value})} /></div>
                <div className="form-group"><label>Assign Fee (Target)</label><input type="number" step="1" placeholder="0" value={form.assignFee} onChange={e=>setForm({...form,assignFee:e.target.value})} /></div>
                <div className="form-group"><label>Buyer Name</label><input placeholder="Cash buyer" value={form.buyerName} onChange={e=>setForm({...form,buyerName:e.target.value})} /></div>
                <div className="form-group"><label>Est. Close Date</label><input type="date" value={form.closeDate} onChange={e=>setForm({...form,closeDate:e.target.value})} /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                    {DEAL_STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {form.arv && form.repairCost && (
                <div style={{background:'var(--green-bg)',border:'1px solid var(--green)',borderRadius:'var(--radius)',padding:'10px 14px',marginBottom:12}}>
                  <span className="text-sm">70% Rule Max Offer: </span>
                  <strong className="text-green">{formatCurrency(Number(form.arv)*0.70 - Number(form.repairCost))}</strong>
                </div>
              )}
              <div className="form-group" style={{marginBottom:12}}>
                <label>Notes</label>
                <textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Seller motivation, condition, timeline…" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Deal</button>
              </div>
            </form>
          </div>
        </div>
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
    address:'', purchasePrice:'', rehabBudget:'', arv:'', status:'Acquisition',
    purchaseDate:'', targetSaleDate:'', notes:'',
  })
  const [receiptLoading, setReceiptLoading] = useState(false)
  const [receiptError, setReceiptError]     = useState('')
  const fileRef = useRef(null)

  function save(e) {
    e.preventDefault()
    setProjects([...projects, { ...form, id:uid(), actualRehab:0, receipts:[], expenses:[] }])
    setForm({ address:'', purchasePrice:'', rehabBudget:'', arv:'', status:'Acquisition', purchaseDate:'', targetSaleDate:'', notes:'' })
    setModal(false)
  }

  const proj = selected ? projects.find(p=>p.id===selected) : null

  function updateProj(updated) {
    setProjects(projects.map(p=>p.id===updated.id ? updated : p))
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
        const receipt = { id:uid(), ...data, fileName:file.name, addedAt:today() }
        const updated = {
          ...proj,
          receipts: [...(proj.receipts||[]), receipt],
          actualRehab: (proj.actualRehab||0) + Number(data.total||0),
        }
        updateProj(updated)
      } catch(err) {
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
        <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ New Project</button>
      </div>

      {!selected ? (
        <>
          <div className="metrics-grid" style={{marginBottom:24}}>
            <div className="metric-card metric-card-blue"><div className="metric-label">Total Projects</div><div className="metric-value">{projects.length}</div></div>
            <div className="metric-card metric-card-pending"><div className="metric-label">Active</div><div className="metric-value">{projects.filter(p=>p.status!=='Completed').length}</div></div>
            <div className="metric-card metric-card-expense">
              <div className="metric-label">Total Rehab Spent</div>
              <div className="metric-value">{formatCurrency(projects.reduce((s,p)=>s+Number(p.actualRehab||0),0),true)}</div>
            </div>
          </div>

          {projects.length === 0 ? (
            <div className="empty-state"><p>No fix &amp; flip projects yet</p></div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {projects.map(p=>{
                const roi = p.arv && p.purchasePrice ? ((Number(p.arv)-Number(p.purchasePrice)-Number(p.actualRehab||0))/Number(p.purchasePrice)*100) : null
                const rehabPct = p.rehabBudget ? Math.min(100,(Number(p.actualRehab||0)/Number(p.rehabBudget))*100) : 0
                return (
                  <div key={p.id} className="card">
                    <div className="card-body">
                      <div className="flex-between">
                        <div>
                          <div className="bold">{p.address}</div>
                          <div className="text-xs text-muted mt-4">
                            Purchase: {formatCurrency(p.purchasePrice)} · ARV: {formatCurrency(p.arv)} · Budget: {formatCurrency(p.rehabBudget)}
                          </div>
                        </div>
                        <div style={{display:'flex',gap:8,alignItems:'center'}}>
                          <span className={`badge ${p.status==='Completed'?'badge-green':p.status==='On Hold'?'badge-red':'badge-blue'}`}>{p.status}</span>
                          <button className="btn btn-sm" onClick={()=>setSelected(p.id)}>View</button>
                          <button className="btn btn-sm btn-danger" onClick={()=>setProjects(projects.filter(x=>x.id!==p.id))}>×</button>
                        </div>
                      </div>
                      <div className="mt-12">
                        <div className="flex-between text-xs text-muted mb-4">
                          <span>Rehab: {formatCurrency(p.actualRehab||0)} / {formatCurrency(p.rehabBudget)}</span>
                          <span>{rehabPct.toFixed(0)}%</span>
                        </div>
                        <div className="progress-bar"><div className="progress-fill" style={{width:`${rehabPct}%`,background:rehabPct>100?'var(--red)':'var(--green)'}} /></div>
                      </div>
                      {roi != null && (
                        <div className="mt-8 text-xs">
                          Est. ROI: <strong className={roi>=0?'text-green':'text-red'}>{formatPercent(roi)}</strong>
                          <span className="text-muted"> · Est. Profit: </span>
                          <strong className={roi>=0?'text-green':'text-red'}>{formatCurrency(Number(p.arv)-Number(p.purchasePrice)-Number(p.actualRehab||0))}</strong>
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
          <button className="btn btn-sm mb-16" onClick={()=>setSelected(null)}>← Back to Projects</button>
          <div className="flex-between mb-16">
            <h2>{proj.address}</h2>
            <select value={proj.status} onChange={e=>updateProj({...proj,status:e.target.value})}>
              {FLIP_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>

          <div className="metrics-grid" style={{marginBottom:24}}>
            <div className="metric-card"><div className="metric-label">Purchase Price</div><div className="metric-value">{formatCurrency(proj.purchasePrice)}</div></div>
            <div className="metric-card"><div className="metric-label">Rehab Budget</div><div className="metric-value">{formatCurrency(proj.rehabBudget)}</div></div>
            <div className="metric-card"><div className="metric-label">Rehab Spent</div><div className={`metric-value ${Number(proj.actualRehab)>Number(proj.rehabBudget)?'value-negative':''}`}>{formatCurrency(proj.actualRehab||0)}</div></div>
            <div className="metric-card"><div className="metric-label">ARV</div><div className="metric-value">{formatCurrency(proj.arv)}</div></div>
          </div>

          {/* Receipt upload */}
          <div className="card mb-24">
            <div className="card-header flex-between">
              <h3>Receipts</h3>
              <label className="btn btn-sm" style={{cursor:'pointer'}}>
                <input type="file" ref={fileRef} accept="image/*" onChange={handleReceipt} style={{display:'none'}} />
                {receiptLoading ? 'Reading…' : '+ Upload Receipt'}
              </label>
            </div>
            <div className="card-body">
              {receiptError && <div className="text-xs text-red mb-8">{receiptError}</div>}
              {(proj.receipts||[]).length === 0 ? (
                <div className="text-muted text-sm">No receipts yet. Upload a photo to extract data with AI.</div>
              ) : (
                <table>
                  <thead><tr><th>Vendor</th><th>Date</th><th>Category</th><th>Total</th><th>File</th><th></th></tr></thead>
                  <tbody>
                    {proj.receipts.map(r=>(
                      <tr key={r.id}>
                        <td>{r.vendor||'—'}</td>
                        <td>{r.date||'—'}</td>
                        <td><span className="badge badge-gray">{r.category||'—'}</span></td>
                        <td className="text-red">{formatCurrency(r.total)}</td>
                        <td className="text-xs text-muted">{r.fileName}</td>
                        <td>
                          <button className="btn btn-sm btn-danger" onClick={()=>{
                            const updated = {...proj,receipts:proj.receipts.filter(x=>x.id!==r.id),actualRehab:Number(proj.actualRehab)-Number(r.total||0)}
                            updateProj(updated)
                          }}>×</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h2>New Fix &amp; Flip Project</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Address</label><input placeholder="123 Main St" value={form.address} onChange={e=>setForm({...form,address:e.target.value})} required /></div>
                <div className="form-group"><label>Purchase Price</label><input type="number" step="1" placeholder="0" value={form.purchasePrice} onChange={e=>setForm({...form,purchasePrice:e.target.value})} /></div>
                <div className="form-group"><label>Rehab Budget</label><input type="number" step="1" placeholder="0" value={form.rehabBudget} onChange={e=>setForm({...form,rehabBudget:e.target.value})} /></div>
                <div className="form-group"><label>ARV</label><input type="number" step="1" placeholder="0" value={form.arv} onChange={e=>setForm({...form,arv:e.target.value})} /></div>
                <div className="form-group"><label>Purchase Date</label><input type="date" value={form.purchaseDate} onChange={e=>setForm({...form,purchaseDate:e.target.value})} /></div>
                <div className="form-group"><label>Target Sale Date</label><input type="date" value={form.targetSaleDate} onChange={e=>setForm({...form,targetSaleDate:e.target.value})} /></div>
                <div className="form-group"><label>Status</label>
                  <select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>
                    {FLIP_STATUSES.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:12}}><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} /></div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={()=>setModal(false)}>Cancel</button>
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
    arv:'', purchasePrice:'', rehabCost:'', holdingCosts:'',
    closingCosts:'', agentFees:'', loanAmount:'', interestRate:'',
    loanMonths:'', rentalRent:'', rentalExpenses:'', rentalVacancy:'10',
  })
  const v = n => Number(vals[n]) || 0

  const maxOffer70   = v('arv') * 0.70 - v('rehabCost')
  const totalCost    = v('purchasePrice') + v('rehabCost') + v('holdingCosts') + v('closingCosts') + v('agentFees')
  const grossProfit  = v('arv') - totalCost
  const roi          = totalCost ? (grossProfit / (v('purchasePrice') + v('rehabCost'))) * 100 : 0
  const dealScore    = grossProfit > 30000 && roi > 20 ? 'Strong Buy' : grossProfit > 15000 && roi > 10 ? 'Buy' : grossProfit > 0 ? 'Marginal' : 'Pass'
  const scoreColors  = { 'Strong Buy':'badge-green', 'Buy':'badge-blue', 'Marginal':'badge-amber', 'Pass':'badge-red' }

  const monthlyInterest = v('loanAmount') * (v('interestRate')/100/12)
  const totalInterest   = monthlyInterest * v('loanMonths')
  const cashNeeded      = v('purchasePrice') - v('loanAmount') + v('rehabCost')

  const noi         = (v('rentalRent') * (1 - v('rentalVacancy')/100)) - v('rentalExpenses')
  const cashOnCash  = cashNeeded ? (noi * 12 / cashNeeded) * 100 : 0
  const capRate     = v('arv') ? (noi * 12 / v('arv')) * 100 : 0

  const field = (key, label, placeholder='0') => (
    <div className="form-group">
      <label>{label}</label>
      <input type="number" step="any" placeholder={placeholder}
        value={vals[key]} onChange={e=>setVals({...vals,[key]:e.target.value})} />
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
                {field('arv','After Repair Value (ARV)')}
                {field('purchasePrice','Purchase Price')}
                {field('rehabCost','Rehab Cost')}
                {field('holdingCosts','Holding Costs')}
                {field('closingCosts','Closing Costs')}
                {field('agentFees','Agent Fees')}
              </div>
            </div>
          </div>

          <div className="card mb-16">
            <div className="card-header"><h3>Financing</h3></div>
            <div className="card-body">
              <div className="form-row">
                {field('loanAmount','Loan Amount')}
                {field('interestRate','Interest Rate %','12')}
                {field('loanMonths','Loan Term (months)','6')}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>Rental Analysis (Buy &amp; Hold)</h3></div>
            <div className="card-body">
              <div className="form-row">
                {field('rentalRent','Monthly Rent')}
                {field('rentalExpenses','Monthly Expenses')}
                {field('rentalVacancy','Vacancy Rate %','10')}
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
                  <tr><td>Max Offer (70% Rule)</td><td className={`text-right bold ${maxOffer70>=0?'text-green':'text-red'}`}>{formatCurrency(maxOffer70)}</td></tr>
                  <tr><td>Total All-In Cost</td><td className="text-right">{formatCurrency(totalCost)}</td></tr>
                  <tr><td>Gross Profit</td><td className={`text-right bold ${grossProfit>=0?'text-green':'text-red'}`}>{formatCurrency(grossProfit)}</td></tr>
                  <tr><td>ROI</td><td className={`text-right bold ${roi>=0?'text-green':'text-red'}`}>{formatPercent(roi)}</td></tr>
                  <tr><td style={{paddingTop:8}}>Total Interest Paid</td><td className="text-right text-red">{formatCurrency(totalInterest)}</td></tr>
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
                  <tr><td>Net Operating Income (mo.)</td><td className={`text-right bold ${noi>=0?'text-green':'text-red'}`}>{formatCurrency(noi)}</td></tr>
                  <tr><td>Annual NOI</td><td className={`text-right ${noi>=0?'text-green':'text-red'}`}>{formatCurrency(noi*12)}</td></tr>
                  <tr><td>Cap Rate</td><td className={`text-right bold ${capRate>=8?'text-green':capRate>=5?'':'text-red'}`}>{formatPercent(capRate)}</td></tr>
                  <tr><td>Cash-on-Cash Return</td><td className={`text-right bold ${cashOnCash>=8?'text-green':''}`}>{formatPercent(cashOnCash)}</td></tr>
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
  const [tab, setTab] = useState('wholesale')
  const TABS = [
    {id:'wholesale',label:'Wholesale Deals'},
    {id:'fixflip',  label:'Fix & Flip'},
    {id:'analyzer', label:'Deal Analyzer'},
  ]
  return (
    <div>
      <div className="page-header"><h1>Real Estate</h1><p>Deal tracking, project management, and analysis</p></div>
      <div className="tabs">{TABS.map(t=><button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      {tab==='wholesale' && <WholesaleTracker />}
      {tab==='fixflip'   && <FixFlip />}
      {tab==='analyzer'  && <DealAnalyzer />}
    </div>
  )
}
