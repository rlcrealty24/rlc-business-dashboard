import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatDate, formatPercent, today, uid } from '../utils/formatters.js'

const BUREAUS = ['Equifax', 'Experian', 'TransUnion']
const DISPUTE_STATUSES  = ['Open', 'In Progress', 'Resolved', 'Closed']
const NEGATIVE_TYPES    = ['Collection', 'Late Payment', 'Charge-off', 'Bankruptcy', 'Repossession', 'Judgment', 'Tax Lien', 'Other']
const ACTION_PRIORITIES = ['High', 'Medium', 'Low']

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

// ─── Score Tracker ────────────────────────────────────────────────────────────
function ScoreTracker() {
  const [scores, setScores] = useLocalStorage('credit_scores', [])
  const [form, setForm]     = useState({ date:today(), equifax:'', experian:'', transunion:'' })

  function save(e) {
    e.preventDefault()
    setScores([...scores, { ...form, id:uid(), equifax:Number(form.equifax), experian:Number(form.experian), transunion:Number(form.transunion) }])
    setForm({ date:today(), equifax:'', experian:'', transunion:'' })
  }

  const latest = [...scores].sort((a,b)=>b.date.localeCompare(a.date))[0]
  const avg    = latest ? Math.round((latest.equifax + latest.experian + latest.transunion) / 3) : null
  const prev   = scores.length >= 2 ? [...scores].sort((a,b)=>b.date.localeCompare(a.date))[1] : null
  const prevAvg = prev ? Math.round((prev.equifax + prev.experian + prev.transunion) / 3) : null
  const change  = avg && prevAvg ? avg - prevAvg : null

  return (
    <div>
      <h2 className="mb-16">Credit Score Tracker</h2>

      {/* Current scores */}
      {latest && (
        <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="metric-card">
            <div className="metric-label">Average Score</div>
            <div className={`metric-value ${scoreColor(avg)}`}>{avg}</div>
            {change != null && (
              <div className={`metric-change ${change>0?'positive':change<0?'negative':'neutral'}`}>
                {change>0?'+':''}{change} from last entry
              </div>
            )}
          </div>
          {BUREAUS.map(b=>{
            const key = b.toLowerCase()
            const score = latest[key]
            const prevScore = prev?.[key]
            const diff = score && prevScore ? score - prevScore : null
            return (
              <div key={b} className="metric-card">
                <div className="metric-label">{b}</div>
                <div className={`metric-value ${scoreColor(score)}`}>{score || '—'}</div>
                {diff != null && (
                  <div className={`metric-change ${diff>0?'positive':diff<0?'negative':'neutral'}`}>
                    {diff>0?'+':''}{diff}
                  </div>
                )}
                <div className="mt-4"><span className={`badge ${scoreBadge(score)}`}>{scoreLabel(score)}</span></div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add entry */}
      <div className="card mb-24">
        <div className="card-header"><h3>Log New Scores</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} required /></div>
              <div className="form-group"><label>Equifax</label><input type="number" min="300" max="850" placeholder="300–850" value={form.equifax} onChange={e=>setForm({...form,equifax:e.target.value})} required /></div>
              <div className="form-group"><label>Experian</label><input type="number" min="300" max="850" placeholder="300–850" value={form.experian} onChange={e=>setForm({...form,experian:e.target.value})} required /></div>
              <div className="form-group"><label>TransUnion</label><input type="number" min="300" max="850" placeholder="300–850" value={form.transunion} onChange={e=>setForm({...form,transunion:e.target.value})} required /></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Log Scores</button>
          </form>
        </div>
      </div>

      {/* History */}
      {scores.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Score History</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Date</th><th>Equifax</th><th>Experian</th><th>TransUnion</th><th>Avg</th><th></th></tr></thead>
              <tbody>
                {[...scores].sort((a,b)=>b.date.localeCompare(a.date)).map(s=>{
                  const avg = Math.round((s.equifax+s.experian+s.transunion)/3)
                  return (
                    <tr key={s.id}>
                      <td>{formatDate(s.date)}</td>
                      <td className={scoreColor(s.equifax)}>{s.equifax}</td>
                      <td className={scoreColor(s.experian)}>{s.experian}</td>
                      <td className={scoreColor(s.transunion)}>{s.transunion}</td>
                      <td className={`bold ${scoreColor(avg)}`}>{avg}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={()=>setScores(scores.filter(x=>x.id!==s.id))}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {scores.length === 0 && <div className="empty-state"><p>Log your first credit scores to get started</p></div>}
    </div>
  )
}

// ─── Utilization ──────────────────────────────────────────────────────────────
function Utilization() {
  const [cards, setCards] = useLocalStorage('credit_cards', [])
  const [form, setForm]   = useState({ name:'', balance:'', limit:'', bureau:'' })

  function save(e) {
    e.preventDefault()
    setCards([...cards, { ...form, id:uid(), balance:Number(form.balance), limit:Number(form.limit) }])
    setForm({ name:'', balance:'', limit:'', bureau:'' })
  }

  const totalBalance = cards.reduce((s,c)=>s+c.balance,0)
  const totalLimit   = cards.reduce((s,c)=>s+c.limit,0)
  const overallUtil  = totalLimit ? (totalBalance/totalLimit)*100 : 0

  function utilColor(pct) {
    if (pct <= 10) return 'text-green'
    if (pct <= 30) return 'text-blue'
    if (pct <= 50) return 'text-amber'
    return 'text-red'
  }

  function updateCard(id, field, val) {
    setCards(cards.map(c=>c.id===id ? {...c,[field]:field==='name'||field==='bureau'?val:Number(val)} : c))
  }

  return (
    <div>
      <h2 className="mb-16">Credit Utilization</h2>

      <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="metric-card">
          <div className="metric-label">Overall Utilization</div>
          <div className={`metric-value ${utilColor(overallUtil)}`}>{formatPercent(overallUtil)}</div>
          <div className="metric-change neutral">Target: under 10%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Balance</div>
          <div className="metric-value">${totalBalance.toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Limit</div>
          <div className="metric-value">${totalLimit.toLocaleString()}</div>
        </div>
      </div>

      <div className="card mb-24">
        <div className="card-header"><h3>Add Credit Card</h3></div>
        <div className="card-body">
          <form onSubmit={save}>
            <div className="form-row">
              <div className="form-group"><label>Card Name</label><input placeholder="Chase Freedom" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /></div>
              <div className="form-group"><label>Current Balance</label><input type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} required /></div>
              <div className="form-group"><label>Credit Limit</label><input type="number" step="1" placeholder="0" value={form.limit} onChange={e=>setForm({...form,limit:e.target.value})} required /></div>
              <div className="form-group"><label>Bureau (optional)</label><select value={form.bureau} onChange={e=>setForm({...form,bureau:e.target.value})}><option value="">All 3</option>{BUREAUS.map(b=><option key={b}>{b}</option>)}</select></div>
            </div>
            <button type="submit" className="btn btn-primary btn-sm">Add Card</button>
          </form>
        </div>
      </div>

      {cards.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>Cards</h3></div>
          <div className="table-container">
            <table>
              <thead><tr><th>Card</th><th>Bureau</th><th>Balance</th><th>Limit</th><th>Utilization</th><th></th></tr></thead>
              <tbody>
                {cards.map(c=>{
                  const util = c.limit ? (c.balance/c.limit)*100 : 0
                  return (
                    <tr key={c.id}>
                      <td>{c.name}</td>
                      <td className="text-muted text-sm">{c.bureau||'All 3'}</td>
                      <td>
                        <input type="number" value={c.balance} onChange={e=>updateCard(c.id,'balance',e.target.value)}
                          style={{width:90,padding:'2px 6px',fontSize:'0.8125rem'}} />
                      </td>
                      <td>${c.limit.toLocaleString()}</td>
                      <td>
                        <span className={`bold ${utilColor(util)}`}>{formatPercent(util)}</span>
                        <div className="progress-bar mt-4" style={{width:100}}>
                          <div className="progress-fill" style={{width:`${Math.min(100,util)}%`,background:util>50?'var(--red)':util>30?'var(--amber)':'var(--green)'}} />
                        </div>
                      </td>
                      <td><button className="btn btn-sm btn-danger" onClick={()=>setCards(cards.filter(x=>x.id!==c.id))}>×</button></td>
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

// ─── Dispute Tracker ──────────────────────────────────────────────────────────
function DisputeTracker() {
  const [disputes, setDisputes] = useLocalStorage('credit_disputes', [])
  const [modal, setModal]       = useState(false)
  const [form, setForm]         = useState({ creditor:'', account:'', bureau:'Equifax', reason:'', status:'Open', dateOpened:today(), notes:'' })

  function save(e) {
    e.preventDefault()
    setDisputes([...disputes, { ...form, id:uid() }])
    setForm({ creditor:'', account:'', bureau:'Equifax', reason:'', status:'Open', dateOpened:today(), notes:'' })
    setModal(false)
  }

  const open    = disputes.filter(d=>d.status==='Open'||d.status==='In Progress').length
  const resolved = disputes.filter(d=>d.status==='Resolved').length

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Dispute Tracker</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setModal(true)}>+ Add Dispute</button>
      </div>

      <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(3,1fr)'}}>
        <div className="metric-card"><div className="metric-label">Total Disputes</div><div className="metric-value">{disputes.length}</div></div>
        <div className="metric-card"><div className="metric-label">Open / In Progress</div><div className="metric-value text-red">{open}</div></div>
        <div className="metric-card"><div className="metric-label">Resolved</div><div className="metric-value text-green">{resolved}</div></div>
      </div>

      {disputes.length === 0 ? (
        <div className="empty-state"><p>No disputes logged yet</p></div>
      ) : (
        <div className="card table-container">
          <table>
            <thead><tr><th>Creditor</th><th>Account</th><th>Bureau</th><th>Reason</th><th>Status</th><th>Opened</th><th></th></tr></thead>
            <tbody>
              {[...disputes].sort((a,b)=>b.dateOpened.localeCompare(a.dateOpened)).map(d=>(
                <tr key={d.id}>
                  <td className="bold">{d.creditor}</td>
                  <td className="text-muted text-sm">{d.account}</td>
                  <td><span className="badge badge-gray">{d.bureau}</span></td>
                  <td className="text-sm">{d.reason}</td>
                  <td>
                    <select value={d.status} onChange={e=>setDisputes(disputes.map(x=>x.id===d.id?{...x,status:e.target.value}:x))} style={{fontSize:'0.8125rem'}}>
                      {DISPUTE_STATUSES.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="text-muted text-xs">{formatDate(d.dateOpened)}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>setDisputes(disputes.filter(x=>x.id!==d.id))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h2>New Dispute</h2>
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Creditor</label><input placeholder="Capital One" value={form.creditor} onChange={e=>setForm({...form,creditor:e.target.value})} required /></div>
                <div className="form-group"><label>Account #</label><input placeholder="****1234" value={form.account} onChange={e=>setForm({...form,account:e.target.value})} /></div>
                <div className="form-group"><label>Bureau</label><select value={form.bureau} onChange={e=>setForm({...form,bureau:e.target.value})}>{BUREAUS.map(b=><option key={b}>{b}</option>)}</select></div>
                <div className="form-group"><label>Date Opened</label><input type="date" value={form.dateOpened} onChange={e=>setForm({...form,dateOpened:e.target.value})} /></div>
                <div className="form-group"><label>Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{DISPUTE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
              </div>
              <div className="form-group mb-16"><label>Reason for Dispute</label><textarea value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Not mine, inaccurate amount, duplicate…" required /></div>
              <div className="form-group mb-16"><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Dates sent, responses received…" /></div>
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

// ─── Negative Accounts ────────────────────────────────────────────────────────
function NegativeAccounts() {
  const [accounts, setAccounts] = useLocalStorage('credit_negatives', [])
  const [form, setForm]         = useState({ creditor:'', type:'Collection', balance:'', dateOpened:'', bureaus:[], notes:'' })
  const [adding, setAdding]     = useState(false)

  function toggleBureau(b) {
    const arr = form.bureaus.includes(b) ? form.bureaus.filter(x=>x!==b) : [...form.bureaus,b]
    setForm({...form,bureaus:arr})
  }

  function save(e) {
    e.preventDefault()
    setAccounts([...accounts, { ...form, id:uid(), balance:Number(form.balance) }])
    setForm({ creditor:'', type:'Collection', balance:'', dateOpened:'', bureaus:[], notes:'' })
    setAdding(false)
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Negative Accounts</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'+ Add Account'}</button>
      </div>

      {adding && (
        <div className="card mb-24">
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group"><label>Creditor</label><input placeholder="Creditor name" value={form.creditor} onChange={e=>setForm({...form,creditor:e.target.value})} required /></div>
                <div className="form-group"><label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{NEGATIVE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div className="form-group"><label>Balance</label><input type="number" step="0.01" placeholder="0.00" value={form.balance} onChange={e=>setForm({...form,balance:e.target.value})} /></div>
                <div className="form-group"><label>Date Opened</label><input type="date" value={form.dateOpened} onChange={e=>setForm({...form,dateOpened:e.target.value})} /></div>
              </div>
              <div className="form-group mb-8">
                <label>Reporting Bureaus</label>
                <div style={{display:'flex',gap:16,marginTop:6}}>
                  {BUREAUS.map(b=>(
                    <label key={b} style={{display:'flex',gap:6,alignItems:'center',cursor:'pointer',fontFamily:'Georgia',fontSize:'0.875rem',textTransform:'none',letterSpacing:'normal'}}>
                      <input type="checkbox" checked={form.bureaus.includes(b)} onChange={()=>toggleBureau(b)} />
                      {b}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group mb-12"><label>Notes</label><textarea value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="SOL date, settlement offers, dispute status…" /></div>
              <button type="submit" className="btn btn-primary btn-sm">Save Account</button>
            </form>
          </div>
        </div>
      )}

      {accounts.length === 0 ? (
        <div className="empty-state"><p>No negative accounts tracked yet</p></div>
      ) : (
        <div className="card table-container">
          <table>
            <thead><tr><th>Creditor</th><th>Type</th><th>Balance</th><th>Date</th><th>Bureaus</th><th>Notes</th><th></th></tr></thead>
            <tbody>
              {accounts.map(a=>(
                <tr key={a.id}>
                  <td className="bold">{a.creditor}</td>
                  <td><span className="badge badge-red">{a.type}</span></td>
                  <td className="text-red">{a.balance ? `$${Number(a.balance).toLocaleString()}` : '—'}</td>
                  <td className="text-muted text-sm">{a.dateOpened ? formatDate(a.dateOpened) : '—'}</td>
                  <td className="text-xs text-muted">{(a.bureaus||[]).join(', ')||'—'}</td>
                  <td className="text-sm" style={{maxWidth:200,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.notes||'—'}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={()=>setAccounts(accounts.filter(x=>x.id!==a.id))}>×</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Action Items ─────────────────────────────────────────────────────────────
function ActionItems() {
  const [items, setItems] = useLocalStorage('credit_actions', [])
  const [form, setForm]   = useState({ title:'', description:'', priority:'High', dueDate:'', done:false })
  const [adding, setAdding] = useState(false)

  function save(e) {
    e.preventDefault()
    setItems([...items, { ...form, id:uid(), createdAt:today() }])
    setForm({ title:'', description:'', priority:'High', dueDate:'', done:false })
    setAdding(false)
  }

  const open = items.filter(i=>!i.done)
  const done = items.filter(i=>i.done)

  const SUGGESTED = [
    { title:'Pay down cards to under 10% utilization', priority:'High', description:'Focus on highest utilization cards first' },
    { title:'Dispute inaccurate late payments', priority:'High', description:'Send certified mail to all 3 bureaus' },
    { title:'Request goodwill deletions for paid accounts', priority:'Medium', description:'Write to original creditors for late marks' },
    { title:'Become authorized user on a good account', priority:'Medium', description:'Ask family member with old, low-utilization card' },
    { title:'Open a secured credit card if needed', priority:'Low', description:'Helps build positive payment history' },
  ]

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Action Items</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'+ Add Action'}</button>
      </div>

      {adding && (
        <div className="card mb-24">
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row">
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Action Title</label><input placeholder="What needs to be done?" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /></div>
                <div className="form-group"><label>Priority</label><select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>{ACTION_PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
                <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} /></div>
                <div className="form-group" style={{gridColumn:'1/-1'}}><label>Description</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Add</button>
            </form>
          </div>
        </div>
      )}

      {/* Suggested actions */}
      {items.length === 0 && (
        <div className="card mb-24">
          <div className="card-header"><h3>Suggested Actions</h3></div>
          <div className="card-body">
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {SUGGESTED.map((s,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',padding:'8px 0',borderBottom:'1px solid var(--border-light)'}}>
                  <div>
                    <div className="text-sm bold">{s.title}</div>
                    <div className="text-xs text-muted mt-4">{s.description}</div>
                  </div>
                  <div style={{display:'flex',gap:8,alignItems:'center',marginLeft:16}}>
                    <span className={`badge ${s.priority==='High'?'badge-red':s.priority==='Medium'?'badge-amber':'badge-gray'}`}>{s.priority}</span>
                    <button className="btn btn-sm" onClick={()=>setItems([...items,{...s,id:uid(),done:false,createdAt:today(),dueDate:''}])}>Add</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {open.length > 0 && (
        <div className="card mb-16">
          <div className="card-header"><h3>Open Actions ({open.length})</h3></div>
          <div className="card-body" style={{padding:0}}>
            {open.sort((a,b)=>ACTION_PRIORITIES.indexOf(a.priority)-ACTION_PRIORITIES.indexOf(b.priority)).map(item=>(
              <div key={item.id} style={{display:'flex',gap:12,padding:'12px 20px',borderBottom:'1px solid var(--border-light)'}}>
                <input type="checkbox" checked={false} onChange={()=>setItems(items.map(x=>x.id===item.id?{...x,done:true}:x))} style={{marginTop:3}} />
                <div style={{flex:1}}>
                  <div className="flex-between">
                    <span className="bold text-sm">{item.title}</span>
                    <span className={`badge ${item.priority==='High'?'badge-red':item.priority==='Medium'?'badge-amber':'badge-gray'}`}>{item.priority}</span>
                  </div>
                  {item.description && <div className="text-xs text-muted mt-4">{item.description}</div>}
                  {item.dueDate && <div className="text-xs text-muted mt-4">Due: {formatDate(item.dueDate)}</div>}
                </div>
                <button className="btn btn-sm btn-danger" onClick={()=>setItems(items.filter(x=>x.id!==item.id))}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="card" style={{opacity:0.6}}>
          <div className="card-header"><h3>Completed ({done.length})</h3></div>
          <div className="card-body" style={{padding:0}}>
            {done.map(item=>(
              <div key={item.id} style={{display:'flex',gap:12,padding:'10px 20px',borderBottom:'1px solid var(--border-light)'}}>
                <input type="checkbox" checked={true} onChange={()=>setItems(items.map(x=>x.id===item.id?{...x,done:false}:x))} style={{marginTop:3}} />
                <span className="text-sm" style={{textDecoration:'line-through',flex:1}}>{item.title}</span>
                <button className="btn btn-sm btn-danger" onClick={()=>setItems(items.filter(x=>x.id!==item.id))}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Credit Repair Page ───────────────────────────────────────────────────────
export default function CreditRepair() {
  const [tab, setTab] = useState('scores')
  const TABS = [
    {id:'scores',    label:'Score Tracker'},
    {id:'util',      label:'Utilization'},
    {id:'disputes',  label:'Dispute Tracker'},
    {id:'negatives', label:'Negative Accounts'},
    {id:'actions',   label:'Action Items'},
  ]
  return (
    <div>
      <div className="page-header"><h1>Credit Repair</h1><p>Monitor, dispute, and improve your credit profile</p></div>
      <div className="tabs">{TABS.map(t=><button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      {tab==='scores'    && <ScoreTracker />}
      {tab==='util'      && <Utilization />}
      {tab==='disputes'  && <DisputeTracker />}
      {tab==='negatives' && <NegativeAccounts />}
      {tab==='actions'   && <ActionItems />}
    </div>
  )
}
