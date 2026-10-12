import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatDate, today, uid } from '../utils/formatters.js'

const MILESTONE_STATUSES = ['Not Started', 'In Progress', 'Complete', 'Blocked']
const UPDATE_TYPES       = ['Update', 'Feature', 'Bug Fix', 'Milestone', 'Note']

const DEFAULT_MILESTONES = [
  { id:'m1', title:'Phase 1 — Foundation', description:'Next.js scaffold, auth, navigation, section pages', status:'Complete',    dueDate:'2026-05-01', progress:100 },
  { id:'m2', title:'Phase 2 — Core Features', description:'Finance, real estate, credit repair, AI integration', status:'In Progress', dueDate:'2026-06-15', progress:30  },
  { id:'m3', title:'Phase 3 — Data Persistence', description:'Supabase integration, real-time sync, user accounts', status:'Not Started', dueDate:'2026-07-31', progress:0   },
  { id:'m4', title:'Phase 4 — Polish & Launch', description:'Mobile responsiveness, performance, documentation', status:'Not Started', dueDate:'2026-09-01', progress:0   },
]

const DEFAULT_UPDATES = [
  { id:'u1', date:'2026-05-18', type:'Milestone', content:'Phase 1 complete: Next.js 14 + Supabase scaffold deployed with login, dashboard, and 5 section pages.' },
  { id:'u2', date:'2026-05-24', type:'Feature', content:'Migrated to React + Vite. Added Finance, Real Estate, Credit Repair, and Portal Project modules with full localStorage persistence.' },
]

// ─── Milestones ───────────────────────────────────────────────────────────────
function Milestones() {
  const [milestones, setMilestones] = useLocalStorage('portal_milestones', DEFAULT_MILESTONES)
  const [modal, setModal]           = useState(false)
  const [editing, setEditing]       = useState(null)
  const [form, setForm]             = useState({ title:'', description:'', status:'Not Started', dueDate:'', progress:0 })

  function openEdit(m) { setEditing(m.id); setForm({ title:m.title, description:m.description, status:m.status, dueDate:m.dueDate, progress:m.progress }); setModal(true) }
  function save(e) {
    e.preventDefault()
    if (editing) setMilestones(milestones.map(m=>m.id===editing?{...m,...form,progress:Number(form.progress)}:m))
    else         setMilestones([...milestones,{...form,id:uid(),progress:Number(form.progress)}])
    setModal(false); setEditing(null)
    setForm({ title:'', description:'', status:'Not Started', dueDate:'', progress:0 })
  }

  const complete    = milestones.filter(m=>m.status==='Complete').length
  const inProgress  = milestones.filter(m=>m.status==='In Progress').length
  const overallPct  = milestones.length ? Math.round(milestones.reduce((s,m)=>s+Number(m.progress||0),0)/milestones.length) : 0

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Milestones</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>{setEditing(null);setForm({title:'',description:'',status:'Not Started',dueDate:'',progress:0});setModal(true)}}>+ Add Milestone</button>
      </div>
      <div className="metrics-grid mb-24" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
        <div className="metric-card"><div className="metric-label">Total</div><div className="metric-value">{milestones.length}</div></div>
        <div className="metric-card"><div className="metric-label">Complete</div><div className="metric-value text-green">{complete}</div></div>
        <div className="metric-card"><div className="metric-label">In Progress</div><div className="metric-value text-blue">{inProgress}</div></div>
        <div className="metric-card"><div className="metric-label">Overall</div><div className="metric-value">{overallPct}%</div><div className="progress-bar mt-8"><div className="progress-fill" style={{width:`${overallPct}%`}} /></div></div>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {milestones.map((m,i)=>(
          <div key={m.id} className="card">
            <div className="card-body">
              <div className="flex-between">
                <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                  <div style={{minWidth:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',background:m.status==='Complete'?'var(--green)':m.status==='In Progress'?'var(--blue)':m.status==='Blocked'?'var(--red)':'var(--border)',color:m.status==='Not Started'?'var(--text-muted)':'white',fontSize:'0.8rem',fontWeight:'bold',flexShrink:0,marginTop:2}}>{i+1}</div>
                  <div>
                    <div className="bold">{m.title}</div>
                    {m.description&&<div className="text-sm text-muted mt-4">{m.description}</div>}
                    <div className="flex-gap mt-8">
                      <span className={`badge ${m.status==='Complete'?'badge-green':m.status==='In Progress'?'badge-blue':m.status==='Blocked'?'badge-red':'badge-gray'}`}>{m.status}</span>
                      {m.dueDate&&<span className="text-xs text-muted">Due {formatDate(m.dueDate)}</span>}
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:8,alignItems:'center',flexShrink:0,marginLeft:16}}>
                  <span className="text-sm text-muted">{m.progress}%</span>
                  <button className="btn btn-sm" onClick={()=>openEdit(m)}>Edit</button>
                  <button className="btn btn-sm btn-danger" onClick={()=>setMilestones(milestones.filter(x=>x.id!==m.id))}>×</button>
                </div>
              </div>
              <div className="progress-bar mt-12"><div className="progress-fill" style={{width:`${m.progress}%`,background:m.status==='Blocked'?'var(--red)':m.status==='Complete'?'var(--green)':'var(--pink)'}} /></div>
            </div>
          </div>
        ))}
        {milestones.length===0&&<div className="empty-state"><p>No milestones yet</p></div>}
      </div>
      {modal&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setModal(false)}>
          <div className="modal">
            <h2>{editing?'Edit Milestone':'New Milestone'}</h2>
            <form onSubmit={save}>
              <div className="form-group mb-12"><label>Title</label><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required /></div>
              <div className="form-group mb-12"><label>Description</label><textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} /></div>
              <div className="form-row">
                <div className="form-group"><label>Status</label><select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}>{MILESTONE_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e=>setForm({...form,dueDate:e.target.value})} /></div>
                <div className="form-group"><label>Progress %</label><input type="number" min="0" max="100" value={form.progress} onChange={e=>setForm({...form,progress:e.target.value})} /></div>
              </div>
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

// ─── Update Log ───────────────────────────────────────────────────────────────
function UpdateLog() {
  const [updates, setUpdates] = useLocalStorage('portal_updates', DEFAULT_UPDATES)
  const [form, setForm]       = useState({ date:today(), type:'Update', content:'' })
  const [adding, setAdding]   = useState(false)

  function save(e) {
    e.preventDefault()
    if (!form.content.trim()) return
    setUpdates([{...form,id:uid()},...updates])
    setForm({ date:today(), type:'Update', content:'' })
    setAdding(false)
  }

  const typeColor = t => ({ Feature:'badge-green', 'Bug Fix':'badge-red', Milestone:'badge-blue', Update:'badge-gray', Note:'badge-amber' }[t]||'badge-gray')

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Update Log</h2>
        <button className="btn btn-primary btn-sm" onClick={()=>setAdding(!adding)}>{adding?'Cancel':'+ Log Update'}</button>
      </div>
      {adding && (
        <div className="card mb-24">
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row mb-12">
                <div className="form-group"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} /></div>
                <div className="form-group"><label>Type</label><select value={form.type} onChange={e=>setForm({...form,type:e.target.value})}>{UPDATE_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              </div>
              <div className="form-group mb-12"><label>Update</label><textarea value={form.content} onChange={e=>setForm({...form,content:e.target.value})} placeholder="What was done, decided, or discovered?" required style={{minHeight:90}} /></div>
              <button type="submit" className="btn btn-primary btn-sm">Save</button>
            </form>
          </div>
        </div>
      )}
      {updates.length===0 ? (
        <div className="empty-state"><p>No updates yet</p></div>
      ) : (
        <div style={{display:'flex',flexDirection:'column',gap:0}}>
          {[...updates].sort((a,b)=>b.date.localeCompare(a.date)).map((u,i,arr)=>{
            const prev=arr[i+1]
            const showYear=!prev||new Date(prev.date+'T00:00:00').getFullYear()!==new Date(u.date+'T00:00:00').getFullYear()
            return (
              <div key={u.id}>
                {showYear&&<div style={{padding:'16px 0 8px',color:'var(--text-muted)',fontSize:'0.75rem',textTransform:'uppercase',letterSpacing:'0.1em',borderTop:i>0?'1px solid var(--border-light)':'none',marginTop:i>0?8:0}}>{new Date(u.date+'T00:00:00').getFullYear()}</div>}
                <div style={{display:'flex',gap:16,paddingBottom:16,marginBottom:16,borderBottom:'1px solid var(--border-light)'}}>
                  <div style={{minWidth:90,paddingTop:2}}>
                    <div className="text-sm bold">{new Date(u.date+'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</div>
                    <span className={`badge ${typeColor(u.type)}`} style={{marginTop:4}}>{u.type}</span>
                  </div>
                  <p className="text-sm" style={{flex:1,whiteSpace:'pre-wrap'}}>{u.content}</p>
                  <button className="btn btn-sm btn-danger" onClick={()=>setUpdates(updates.filter(x=>x.id!==u.id))}>×</button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Portal Project Page ──────────────────────────────────────────────────────
export default function PortalProject() {
  const [tab, setTab] = useState('milestones')
  const TABS = [
    {id:'milestones', label:'Milestones'  },
    {id:'updates',    label:'Update Log'  },
  ]
  return (
    <div>
      <div className="page-header"><h1>Projects</h1><p>Big-picture milestones and progress notes</p></div>
      <div className="card mb-16" style={{ borderLeft: '3px solid #1c9fd0' }}><div className="card-body text-sm">
        Looking for a task? All tasks live in one list — your <Link to="/inbox" style={{ color: '#1c9fd0', fontWeight: 'bold' }}>Inbox</Link>. What to do next is on <Link to="/today" style={{ color: '#1c9fd0', fontWeight: 'bold' }}>Today</Link>.
      </div></div>
      <div className="tabs">{TABS.map(t=><button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      {tab==='milestones' && <Milestones />}
      {tab==='updates'    && <UpdateLog />}
    </div>
  )
}
