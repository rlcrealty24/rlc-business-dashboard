import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatDate, today, uid } from '../utils/formatters.js'

const MILESTONE_STATUSES = ['Not Started', 'In Progress', 'Complete', 'Blocked']
export const TASK_STATUSES   = ['Backlog', 'To Do', 'In Progress', 'Done']
export const TASK_PRIORITIES = ['High', 'Medium', 'Low']
const UPDATE_TYPES       = ['Update', 'Feature', 'Bug Fix', 'Milestone', 'Note']

export const TASK_TYPES = [
  'Personal', 'Business', 'Real Estate', 'Finance',
  'Health & Wellness', 'Admin', 'Travel', 'Family',
  'Portal / Tech', 'Other',
]

const TYPE_STYLE = {
  'Personal':        { color:'var(--pink-text)',  bg:'var(--pink-light)',  border:'var(--pink-border)' },
  'Business':        { color:'var(--blue)',        bg:'var(--blue-bg)',     border:'#93c5fd'            },
  'Real Estate':     { color:'#0f766e',            bg:'#f0fdfa',           border:'#99f6e4'            },
  'Finance':         { color:'var(--green)',       bg:'var(--green-bg)',    border:'#86efac'            },
  'Health & Wellness':{ color:'#7c3aed',           bg:'#f5f3ff',           border:'#c4b5fd'            },
  'Admin':           { color:'var(--amber)',       bg:'var(--amber-bg)',    border:'#fcd34d'            },
  'Travel':          { color:'#0369a1',            bg:'#e0f2fe',           border:'#7dd3fc'            },
  'Family':          { color:'#be185d',            bg:'#fdf2f8',           border:'#f9a8d4'            },
  'Portal / Tech':   { color:'#4f46e5',            bg:'#eef2ff',           border:'#a5b4fc'            },
  'Other':           { color:'var(--text-muted)',  bg:'var(--surface-hover)', border:'var(--border)'   },
}

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

// ─── Type Badge ───────────────────────────────────────────────────────────────
export function TypeBadge({ type }) {
  const s = TYPE_STYLE[type] || TYPE_STYLE['Other']
  return (
    <span style={{
      display:'inline-block', padding:'2px 8px', borderRadius:20,
      fontSize:'0.7rem', background:s.bg, color:s.color,
      border:`1px solid ${s.border}`,
    }}>{type}</span>
  )
}

// ─── Timeline Bar ─────────────────────────────────────────────────────────────
export function TimelineBar({ startDate, dueDate }) {
  if (!startDate && !dueDate) return null
  const now   = new Date()
  const start = startDate ? new Date(startDate+'T00:00:00') : now
  const end   = dueDate   ? new Date(dueDate+'T00:00:00')   : null
  if (!end) return <div className="text-xs text-muted">Due: {formatDate(dueDate||startDate)}</div>

  const total   = end - start
  const elapsed = now - start
  const pct     = Math.min(100, Math.max(0, total > 0 ? (elapsed/total)*100 : 0))
  const overdue = now > end
  const daysLeft = Math.ceil((end - now) / 86400000)

  return (
    <div style={{marginTop:8}}>
      <div className="flex-between text-xs text-muted mb-4">
        <span>{startDate ? formatDate(startDate) : 'Today'}</span>
        <span className={overdue ? 'text-red bold' : daysLeft <= 3 ? 'text-amber' : ''}>
          {overdue ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today!' : `${daysLeft}d left`}
        </span>
        <span>{formatDate(dueDate)}</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{
          width:`${pct}%`,
          background: overdue ? 'var(--red)' : daysLeft <= 3 ? 'var(--amber)' : 'var(--pink)',
        }} />
      </div>
    </div>
  )
}

// ─── Task Detail Modal ────────────────────────────────────────────────────────
export function TaskDetail({ task, milestones, onSave, onDelete, onClose }) {
  const [t, setT] = useState({ ...task, subtasks: task.subtasks || [], notes: task.notes || '', startDate: task.startDate || '', taskType: task.taskType || 'Personal' })
  const [newSub, setNewSub] = useState('')

  function addSubtask(e) {
    e.preventDefault()
    if (!newSub.trim()) return
    setT({ ...t, subtasks: [...t.subtasks, { id:uid(), text:newSub.trim(), done:false }] })
    setNewSub('')
  }
  function toggleSub(id)  { setT({ ...t, subtasks: t.subtasks.map(s=>s.id===id?{...s,done:!s.done}:s) }) }
  function removeSub(id)  { setT({ ...t, subtasks: t.subtasks.filter(s=>s.id!==id) }) }

  const doneSubs  = t.subtasks.filter(s=>s.done).length
  const totalSubs = t.subtasks.length
  const prio      = t.priority
  const typeStyle = TYPE_STYLE[t.taskType] || TYPE_STYLE['Other']

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{maxWidth:680}}>
        {/* Header */}
        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:20}}>
          <div style={{flex:1,paddingRight:12}}>
            <input
              value={t.title}
              onChange={e=>setT({...t,title:e.target.value})}
              style={{fontSize:'1.1rem',fontWeight:'bold',border:'none',background:'none',width:'100%',padding:0,outline:'none',fontFamily:'Georgia,serif',color:'var(--text)'}}
              placeholder="Task title"
            />
            <div style={{display:'flex',gap:6,marginTop:8,flexWrap:'wrap'}}>
              <TypeBadge type={t.taskType} />
              <span className={`badge ${prio==='High'?'badge-red':prio==='Medium'?'badge-amber':'badge-gray'}`}>{prio} priority</span>
              <span className={`badge ${t.status==='Done'?'badge-green':t.status==='In Progress'?'badge-blue':'badge-gray'}`}>{t.status}</span>
              {totalSubs>0 && <span className="badge badge-gray">{doneSubs}/{totalSubs} subtasks</span>}
            </div>
          </div>
          <button onClick={onClose} style={{background:'none',border:'none',fontSize:'1.3rem',cursor:'pointer',color:'var(--text-muted)',padding:4}}>×</button>
        </div>

        {/* Fields */}
        <div className="form-row" style={{marginBottom:12}}>
          <div className="form-group">
            <label>Task Type</label>
            <select value={t.taskType} onChange={e=>setT({...t,taskType:e.target.value})}>
              {TASK_TYPES.map(tp=><option key={tp}>{tp}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Status</label>
            <select value={t.status} onChange={e=>setT({...t,status:e.target.value})}>
              {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Priority</label>
            <select value={t.priority} onChange={e=>setT({...t,priority:e.target.value})}>
              {TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Milestone</label>
            <select value={t.milestoneId||''} onChange={e=>setT({...t,milestoneId:e.target.value})}>
              <option value="">None</option>
              {milestones.map(m=><option key={m.id} value={m.id}>{m.title.split('—')[0].trim()}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Start Date</label>
            <input type="date" value={t.startDate} onChange={e=>setT({...t,startDate:e.target.value})} />
          </div>
          <div className="form-group">
            <label>Due Date</label>
            <input type="date" value={t.dueDate||''} onChange={e=>setT({...t,dueDate:e.target.value})} />
          </div>
        </div>

        {/* Timeline */}
        {(t.startDate || t.dueDate) && (
          <div style={{background:typeStyle.bg,border:`1px solid ${typeStyle.border}`,borderRadius:'var(--radius)',padding:'10px 14px',marginBottom:12}}>
            <TimelineBar startDate={t.startDate} dueDate={t.dueDate} />
          </div>
        )}

        {/* Description */}
        <div className="form-group mb-12">
          <label>Description</label>
          <textarea value={t.description||''} onChange={e=>setT({...t,description:e.target.value})} placeholder="What needs to be done?" style={{minHeight:72}} />
        </div>

        {/* Subtasks */}
        <div style={{marginBottom:16}}>
          <label style={{display:'block',marginBottom:8}}>Subtasks</label>
          <form onSubmit={addSubtask} style={{display:'flex',gap:8,marginBottom:8}}>
            <input value={newSub} onChange={e=>setNewSub(e.target.value)} placeholder="Add a subtask…" style={{flex:1}} />
            <button type="submit" className="btn btn-sm btn-primary">Add</button>
          </form>
          {t.subtasks.length>0 && (
            <div style={{border:'1px solid var(--border)',borderRadius:'var(--radius)',overflow:'hidden'}}>
              {totalSubs>0 && (
                <div style={{padding:'6px 12px',background:'var(--surface-hover)',borderBottom:'1px solid var(--border-light)'}}>
                  <div className="progress-bar" style={{height:4}}>
                    <div className="progress-fill" style={{width:`${(doneSubs/totalSubs)*100}%`,background:'var(--pink)'}} />
                  </div>
                  <div className="text-xs text-muted mt-4">{doneSubs} of {totalSubs} complete</div>
                </div>
              )}
              {t.subtasks.map(s=>(
                <div key={s.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',borderBottom:'1px solid var(--border-light)',background:s.done?'var(--surface-hover)':''}}>
                  <input type="checkbox" checked={s.done} onChange={()=>toggleSub(s.id)} style={{accentColor:'var(--pink)',flexShrink:0}} />
                  <span style={{flex:1,fontSize:'0.875rem',textDecoration:s.done?'line-through':'none',color:s.done?'var(--text-muted)':'var(--text)'}}>{s.text}</span>
                  <button onClick={()=>removeSub(s.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:'0.9rem',padding:0}}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Notes */}
        <div className="form-group mb-16">
          <label>Notes</label>
          <textarea value={t.notes} onChange={e=>setT({...t,notes:e.target.value})} placeholder="Context, links, blockers…" style={{minHeight:60}} />
        </div>

        <div className="modal-footer">
          <button className="btn btn-sm btn-danger" onClick={()=>{onDelete(task.id);onClose()}}>Delete Task</button>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary btn-sm" onClick={()=>{onSave(t);onClose()}}>Save Changes</button>
        </div>
      </div>
    </div>
  )
}

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

// ─── Task Board ───────────────────────────────────────────────────────────────
function TaskBoard() {
  const [tasks, setTasks]     = useLocalStorage('portal_tasks', [])
  const [milestones]          = useLocalStorage('portal_milestones', DEFAULT_MILESTONES)
  const [detailTask, setDet]  = useState(null)  // task being viewed
  const [newForm, setNewForm] = useState(null)   // quick-add open?
  const [filterType, setFT]   = useState('all')
  const [filterStatus, setFS] = useState('all')
  const [quickForm, setQF]    = useState({ title:'', taskType:'Personal', status:'To Do', priority:'Medium', milestoneId:'', dueDate:'' })

  function saveNew(e) {
    e.preventDefault()
    if (!quickForm.title.trim()) return
    setTasks([...tasks,{...quickForm,id:uid(),subtasks:[],notes:'',description:'',startDate:'',createdAt:today()}])
    setQF({ title:'', taskType:'Personal', status:'To Do', priority:'Medium', milestoneId:'', dueDate:'' })
    setNewForm(false)
  }

  function saveDetail(updated) {
    setTasks(tasks.map(t=>t.id===updated.id?updated:t))
  }

  function deleteTask(id) { setTasks(tasks.filter(t=>t.id!==id)) }

  const shown = tasks
    .filter(t=>filterType==='all'||t.taskType===filterType)
    .filter(t=>filterStatus==='all'||t.status===filterStatus)

  const byStatus = TASK_STATUSES.reduce((acc,s)=>({...acc,[s]:shown.filter(t=>t.status===s)}),{})

  const statusBg       = { 'Done':'var(--green-bg)', 'In Progress':'var(--blue-bg)', 'To Do':'var(--pink-light)', 'Backlog':'var(--surface-hover)' }
  const statusColor    = { 'Done':'var(--green)', 'In Progress':'var(--blue)', 'To Do':'var(--pink)', 'Backlog':'var(--text-muted)' }
  const statusBorder   = { 'Done':'#86efac', 'In Progress':'#c7d2fe', 'To Do':'var(--pink-border)', 'Backlog':'var(--border)' }

  return (
    <div>
      <div className="flex-between mb-16">
        <h2>Tasks</h2>
        <div className="flex-gap" style={{flexWrap:'wrap'}}>
          <select value={filterType} onChange={e=>setFT(e.target.value)} style={{fontSize:'0.8rem',padding:'4px 8px'}}>
            <option value="all">All Types</option>
            {TASK_TYPES.map(t=><option key={t}>{t}</option>)}
          </select>
          <select value={filterStatus} onChange={e=>setFS(e.target.value)} style={{fontSize:'0.8rem',padding:'4px 8px'}}>
            <option value="all">All Statuses</option>
            {TASK_STATUSES.map(s=><option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-primary btn-sm" onClick={()=>setNewForm(!newForm)}>{newForm?'Cancel':'+ Add Task'}</button>
        </div>
      </div>

      {/* Quick add form */}
      {newForm && (
        <div className="card mb-16" style={{borderColor:'var(--pink-border)'}}>
          <div className="card-body">
            <form onSubmit={saveNew}>
              <div className="form-row">
                <div className="form-group" style={{gridColumn:'span 2'}}><label>Task Title</label><input value={quickForm.title} onChange={e=>setQF({...quickForm,title:e.target.value})} placeholder="What needs to get done?" required autoFocus /></div>
                <div className="form-group">
                  <label>Type</label>
                  <select value={quickForm.taskType} onChange={e=>setQF({...quickForm,taskType:e.target.value})}>
                    {TASK_TYPES.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="form-group"><label>Priority</label><select value={quickForm.priority} onChange={e=>setQF({...quickForm,priority:e.target.value})}>{TASK_PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></div>
                <div className="form-group"><label>Status</label><select value={quickForm.status} onChange={e=>setQF({...quickForm,status:e.target.value})}>{TASK_STATUSES.map(s=><option key={s}>{s}</option>)}</select></div>
                <div className="form-group"><label>Due Date</label><input type="date" value={quickForm.dueDate} onChange={e=>setQF({...quickForm,dueDate:e.target.value})} /></div>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button type="submit" className="btn btn-primary btn-sm">Add Task</button>
                <button type="button" className="btn btn-sm" onClick={()=>setNewForm(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Kanban columns */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        {TASK_STATUSES.map(status=>(
          <div key={status}>
            <div style={{padding:'8px 14px',marginBottom:10,borderRadius:'var(--radius)',background:statusBg[status],border:`1px solid ${statusBorder[status]}`,fontSize:'0.74rem',textTransform:'uppercase',letterSpacing:'0.08em',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:600,color:statusColor[status]}}>{status}</span>
              <span style={{background:'white',border:`1px solid ${statusBorder[status]}`,borderRadius:20,padding:'1px 8px',fontSize:'0.68rem',fontWeight:700,color:statusColor[status]}}>{byStatus[status].length}</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {byStatus[status].map(t=>{
                const ms      = milestones.find(m=>m.id===t.milestoneId)
                const tStyle  = TYPE_STYLE[t.taskType] || TYPE_STYLE['Other']
                const subs    = t.subtasks?.length || 0
                const doneSub = t.subtasks?.filter(s=>s.done).length || 0
                const overdue = t.dueDate && new Date(t.dueDate+'T00:00:00') < new Date() && t.status !== 'Done'

                return (
                  <div
                    key={t.id}
                    className="card"
                    style={{ cursor:'pointer', borderLeft:`3px solid ${tStyle.border}` }}
                    onClick={()=>setDet(t)}
                  >
                    <div className="card-body" style={{padding:'11px 13px'}}>
                      <div className="text-sm bold" style={{marginBottom:6,lineHeight:1.3}}>{t.title}</div>

                      {/* Type + Priority */}
                      <div className="flex-gap" style={{flexWrap:'wrap',marginBottom:6}}>
                        <TypeBadge type={t.taskType||'Other'} />
                        <span className={`badge ${t.priority==='High'?'badge-red':t.priority==='Medium'?'badge-amber':'badge-gray'}`} style={{fontSize:'0.65rem'}}>{t.priority}</span>
                      </div>

                      {/* Meta row */}
                      <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                        {ms && <span className="text-xs text-muted">{ms.title.split('—')[0].trim()}</span>}
                        {subs > 0 && <span className="text-xs text-muted">{doneSub}/{subs} ✓</span>}
                        {t.dueDate && (
                          <span className={`text-xs ${overdue?'text-red bold':''}`}>
                            {overdue ? '⚠ ' : ''}{formatDate(t.dueDate)}
                          </span>
                        )}
                      </div>

                      {/* Subtask bar */}
                      {subs > 0 && (
                        <div className="progress-bar mt-6" style={{height:3}}>
                          <div className="progress-fill" style={{width:`${(doneSub/subs)*100}%`,background:'var(--pink)'}} />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              {byStatus[status].length===0&&<div style={{padding:'16px',color:'var(--text-faint)',fontSize:'0.75rem',textAlign:'center',border:'1px dashed var(--border)',borderRadius:'var(--radius)'}}>Empty</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Task Detail Modal */}
      {detailTask && (
        <TaskDetail
          task={tasks.find(t=>t.id===detailTask.id)||detailTask}
          milestones={milestones}
          onSave={saveDetail}
          onDelete={deleteTask}
          onClose={()=>setDet(null)}
        />
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
  const [tab, setTab] = useState('tasks')
  const TABS = [
    {id:'tasks',      label:'Task Board'  },
    {id:'milestones', label:'Milestones'  },
    {id:'updates',    label:'Update Log'  },
  ]
  return (
    <div>
      <div className="page-header"><h1>Tasks &amp; Projects</h1><p>Personal, business, and life tasks — all in one place</p></div>
      <div className="tabs">{TABS.map(t=><button key={t.id} className={`tab ${tab===t.id?'active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}</div>
      {tab==='tasks'      && <TaskBoard />}
      {tab==='milestones' && <Milestones />}
      {tab==='updates'    && <UpdateLog />}
    </div>
  )
}
