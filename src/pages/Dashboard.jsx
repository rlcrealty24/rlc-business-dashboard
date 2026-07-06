import { useState, useEffect, useRef } from 'react'
import { useLocalStorage, forceSyncAllToSupabase } from '../hooks/useLocalStorage.js'
import { formatCurrency, formatDate, today, uid } from '../utils/formatters.js'
import { PLAN_DAYS, MACRO_TARGETS } from '../data/fitnessData.js'
import { supabase } from '../lib/supabase.js'
import { TaskDetail } from './PortalProject.jsx'

const DEFAULT_TODOS = [
  { id: uid(), text: 'Review monthly P&L', done: false, date: today() },
  { id: uid(), text: 'Follow up on wholesale leads', done: false, date: today() },
]

// ─── ICS Parser ───────────────────────────────────────────────────────────────
function parseICS(text) {
  // Unfold continuation lines
  const unfolded = text.replace(/\r?\n[ \t]/g, '')
  const lines    = unfolded.split(/\r?\n/)

  const events = []
  let cur = null

  for (const raw of lines) {
    const colonIdx = raw.indexOf(':')
    if (colonIdx === -1) continue
    const propFull = raw.slice(0, colonIdx)
    const val      = raw.slice(colonIdx + 1).trim()
    const prop     = propFull.split(';')[0].toUpperCase()

    if (prop === 'BEGIN' && val === 'VEVENT')  { cur = {} }
    else if (prop === 'END' && val === 'VEVENT') { if (cur?.dtstart && cur?.summary) events.push(cur); cur = null }
    else if (cur) {
      if (prop === 'SUMMARY')     cur.summary     = val.replace(/\\n/g,' ').replace(/\\,/g,',').replace(/\\;/g,';')
      if (prop === 'DTSTART')     cur.dtstart     = val
      if (prop === 'DESCRIPTION') cur.description = val.replace(/\\n/g,' ').replace(/\\,/g,',').slice(0,120)
      if (prop === 'LOCATION')    cur.location    = val.replace(/\\,/g,',')
    }
  }

  return events.map(ev => {
    const raw = ev.dtstart || ''
    const nums = raw.replace(/[^0-9]/g, '')
    let date = '', time = ''

    if (nums.length >= 8) {
      if (raw.endsWith('Z') || raw.includes('T')) {
        // Datetime — convert UTC → local if Z suffix
        try {
          const iso = `${nums.slice(0,4)}-${nums.slice(4,6)}-${nums.slice(6,8)}T${nums.slice(8,10)||'00'}:${nums.slice(10,12)||'00'}:00${raw.endsWith('Z')?'Z':''}`
          const d = new Date(iso)
          date = d.toISOString().slice(0,10)
          time = d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:true})
        } catch { date = `${nums.slice(0,4)}-${nums.slice(4,6)}-${nums.slice(6,8)}` }
      } else {
        date = `${nums.slice(0,4)}-${nums.slice(4,6)}-${nums.slice(6,8)}`
      }
    }

    return {
      id:     uid(),
      title:  ev.summary || '(No title)',
      date,
      time,
      notes:  [ev.description, ev.location ? `📍 ${ev.location}` : ''].filter(Boolean).join(' — '),
      source: 'outlook',
    }
  }).filter(e => e.date)
}

// ─── Source dot ───────────────────────────────────────────────────────────────
function SourceDot({ source }) {
  const colors = { local:'var(--pink)', outlook:'#3b82f6', portal:'#8b5cf6' }
  return (
    <span style={{
      display:'inline-block', width:7, height:7, borderRadius:'50%',
      background: colors[source] || 'var(--border)',
      flexShrink:0, marginTop:5,
    }} title={source} />
  )
}

// ─── Portal Link Card ─────────────────────────────────────────────────────────
function PortalCard() {
  const [portalUrl, setPortalUrl] = useLocalStorage('portal_url', 'http://localhost:3000')
  const [editing, setEditing]     = useState(false)
  const [draft, setDraft]         = useState(portalUrl)

  function save(e) {
    e.preventDefault()
    setPortalUrl(draft.trim() || 'http://localhost:3000')
    setEditing(false)
  }

  return (
    <div className="portal-bar">
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:'1.4rem' }}>🏠</span>
        <div>
          <div style={{ fontWeight:'bold', fontSize:'0.95rem', color:'var(--pink-text)' }}>
            RLC Realty Portal
          </div>
          {editing ? (
            <form onSubmit={save} style={{ display:'flex', gap:6, marginTop:4 }}>
              <input
                value={draft}
                onChange={e=>setDraft(e.target.value)}
                style={{ fontSize:'0.75rem', padding:'2px 6px', width:220 }}
                autoFocus
              />
              <button type="submit" className="btn btn-sm btn-primary" style={{padding:'2px 8px'}}>Save</button>
              <button type="button" className="btn btn-sm" style={{padding:'2px 8px'}} onClick={()=>setEditing(false)}>Cancel</button>
            </form>
          ) : (
            <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:2, display:'flex', gap:8, alignItems:'center' }}>
              <span>{portalUrl}</span>
              <button
                onClick={()=>{ setDraft(portalUrl); setEditing(true) }}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--pink)', fontSize:'0.7rem', padding:0 }}
              >edit</button>
            </div>
          )}
        </div>
      </div>
      <a
        href={portalUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary btn-sm"
        style={{ textDecoration:'none', whiteSpace:'nowrap' }}
      >
        Open Portal →
      </a>
    </div>
  )
}

// ─── To-Do ────────────────────────────────────────────────────────────────────
const PRIO_STYLE = {
  High:   { color:'var(--red)',   label:'High'   },
  Medium: { color:'var(--amber)', label:'Med'    },
  Low:    { color:'var(--green)', label:'Low'    },
}

function TodoWidget() {
  const [rawTasks, setTasks]   = useLocalStorage('portal_tasks', [])
  const [milestones]           = useLocalStorage('portal_milestones', [])
  const [selectedTask, setSelectedTask] = useState(null)
  const tasks = Array.isArray(rawTasks) ? rawTasks : []

  const textRef = useRef(null)
  const dateRef = useRef(null)

  function add() {
    const trimmed = (textRef.current?.value ?? '').trim()
    if (!trimmed) {
      textRef.current?.focus()   // visual feedback: focus the empty input
      return
    }
    const newTask = {
      id: uid(), title: trimmed, status: 'To Do', priority: 'Medium',
      dueDate: dateRef.current?.value || today(),
      taskType: 'Personal', subtasks: [], notes: '',
      description: '', startDate: '', milestoneId: '', createdAt: today(),
    }
    setTasks(prev => [...(Array.isArray(prev) ? prev : []), newTask])
    if (textRef.current) textRef.current.value = ''
    if (dateRef.current) dateRef.current.value = today()
    textRef.current?.focus()
  }

  function handleKey(e) {
    if (e.key === 'Enter') add()
  }

  function toggle(id) {
    setTasks(prev => (Array.isArray(prev) ? prev : []).map(t =>
      t.id === id ? { ...t, status: t.status === 'Done' ? 'To Do' : 'Done' } : t
    ))
  }

  function remove(id) {
    setTasks(prev => (Array.isArray(prev) ? prev : []).filter(t => t.id !== id))
  }

  function saveTask(updated) {
    setTasks(prev => (Array.isArray(prev) ? prev : []).map(t => t.id === updated.id ? updated : t))
  }

  // Show To Do + In Progress as pending; Done as completed
  const pending = tasks.filter(t => t.status !== 'Done')
  const done    = tasks.filter(t => t.status === 'Done')

  return (
    <div className="card">
      <div className="card-header">
        <h3>To-Do</h3>
        <span className="badge badge-pink">{pending.length} open</span>
      </div>
      <div className="card-body">
        <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap' }}>
          <input
            ref={textRef}
            defaultValue=""
            onKeyDown={handleKey}
            placeholder="Add a task…"
            style={{ flex:'1 1 160px' }}
          />
          <input ref={dateRef} type="date" defaultValue={today()} style={{ flex:'0 1 130px', minWidth:0 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={add}>Add</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {pending.map(t => {
            const prio = PRIO_STYLE[t.priority] || PRIO_STYLE.Medium
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <input type="checkbox" checked={false} onChange={()=>toggle(t.id)} style={{ marginTop:3, accentColor:'var(--pink)', flexShrink:0 }} />
                <div style={{ flex:1, minWidth:0 }}>
                  <button onClick={()=>setSelectedTask(t)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', width:'100%' }}>
                    <div className="text-sm" style={{ color:'var(--text)', fontWeight:500 }}>{t.title || t.text}</div>
                  </button>
                  <div style={{ display:'flex', gap:6, marginTop:2, alignItems:'center' }}>
                    {t.status === 'In Progress' && (
                      <span style={{ fontSize:'0.65rem', fontWeight:600, color:'var(--blue)', textTransform:'uppercase', letterSpacing:'0.06em' }}>In Progress</span>
                    )}
                    {t.priority && (
                      <span style={{ fontSize:'0.65rem', fontWeight:600, color: prio.color, textTransform:'uppercase', letterSpacing:'0.06em' }}>{prio.label}</span>
                    )}
                    {t.dueDate && <span className="text-xs text-muted">{formatDate(t.dueDate)}</span>}
                  </div>
                </div>
                <button onClick={()=>remove(t.id)} className="btn btn-sm btn-danger" style={{ padding:'2px 6px', flexShrink:0 }}>×</button>
              </div>
            )
          })}
          {done.length > 0 && (
            <>
              <div className="divider" />
              {done.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:8, opacity:0.45 }}>
                  <input type="checkbox" checked={true} onChange={()=>toggle(t.id)} style={{ marginTop:3, accentColor:'var(--pink)', flexShrink:0 }} />
                  <button onClick={()=>setSelectedTask(t)} style={{ background:'none', border:'none', padding:0, cursor:'pointer', textAlign:'left', flex:1 }}>
                    <span className="text-sm" style={{ textDecoration:'line-through', color:'var(--text-muted)' }}>{t.title || t.text}</span>
                  </button>
                  <button onClick={()=>remove(t.id)} className="btn btn-sm btn-danger" style={{ padding:'2px 6px', flexShrink:0 }}>×</button>
                </div>
              ))}
            </>
          )}
          {tasks.length === 0 && (
            <div className="empty-state" style={{ padding:'24px 0' }}>
              <p>No tasks yet — add one above or create tasks in the Portal Project board.</p>
            </div>
          )}
        </div>
      </div>
      {selectedTask && (
        <TaskDetail
          task={selectedTask}
          milestones={Array.isArray(milestones) ? milestones : []}
          onSave={t => { saveTask(t); setSelectedTask(null) }}
          onDelete={id => { remove(id); setSelectedTask(null) }}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  )
}

// ─── Calendar helpers ─────────────────────────────────────────────────────────
function dueDayOrdinal(n) {
  n = parseInt(n)
  if (!n) return ''
  const s = n===1||n===21||n===31?'st':n===2||n===22?'nd':n===3||n===23?'rd':'th'
  return `${n}${s}`
}
function isDueSoon(dueDay) {
  const n = parseInt(dueDay)
  if (!n || n < 1 || n > 31) return false
  const now   = new Date()
  const thisM = new Date(now.getFullYear(), now.getMonth(),     n)
  const nextM = new Date(now.getFullYear(), now.getMonth() + 1, n)
  const target = thisM >= now ? thisM : nextM
  return (target - now) / 86400000 <= 7
}

// ─── Calendar (monthly grid with events + bills) ──────────────────────────────
function CalendarWidget() {
  const [localEvents,   setLocalEvents]   = useLocalStorage('dash_events', [])
  const [outlookEvents, setOutlookEvents] = useLocalStorage('dash_outlook_events', [])
  const [accounts]                        = useLocalStorage('finance_accounts', [])
  const [icsError,    setIcsError]    = useState('')
  const [selectedDay, setSelectedDay] = useState(null)
  const [addForm,     setAddForm]     = useState(null)
  const fileRef = useRef(null)

  const now0 = new Date()
  const [viewYear,  setViewYear]  = useState(now0.getFullYear())
  const [viewMonth, setViewMonth] = useState(now0.getMonth())

  const isCurrentMonth = viewYear === now0.getFullYear() && viewMonth === now0.getMonth()
  const todayDay       = now0.getDate()
  const monthName      = new Date(viewYear, viewMonth, 1).toLocaleString('default', { month: 'long' })
  const firstDow       = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth    = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
    setSelectedDay(null); setAddForm(null)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
    setSelectedDay(null); setAddForm(null)
  }

  function dayStr(day) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  const allEvents = [...(Array.isArray(localEvents)?localEvents:[]), ...(Array.isArray(outlookEvents)?outlookEvents:[])]
  const liabs     = (Array.isArray(accounts) ? accounts : []).filter(a => a.isLiability && a.dueDate)

  const getEventsForDay = (day) => allEvents.filter(e => e.date === dayStr(day))
  const getBillsForDay  = (day) => liabs.filter(a => parseInt(a.dueDate) === day)

  function handleICS(e) {
    const file = e.target.files[0]; if (!file) return
    setIcsError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseICS(ev.target.result)
        if (!parsed.length) { setIcsError('No events found'); return }
        setOutlookEvents(prev => [...(Array.isArray(prev)?prev:[]), ...parsed])
      } catch { setIcsError('Could not parse .ics file') }
    }
    reader.readAsText(file); e.target.value = ''
  }

  function saveEvent(e) {
    e.preventDefault()
    if (!addForm?.title?.trim()) return
    setLocalEvents(prev => [...(Array.isArray(prev)?prev:[]), { id:uid(), title:addForm.title.trim(), date:dayStr(selectedDay), time:addForm.time||'', notes:addForm.notes||'', source:'local' }])
    setAddForm(null)
  }

  function removeEvent(ev) {
    if (ev.source === 'outlook') setOutlookEvents(prev => (Array.isArray(prev)?prev:[]).filter(e=>e.id!==ev.id))
    else setLocalEvents(prev => (Array.isArray(prev)?prev:[]).filter(e=>e.id!==ev.id))
  }

  const selEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const selBills  = selectedDay ? getBillsForDay(selectedDay)  : []
  const selLabel  = selectedDay ? new Date(dayStr(selectedDay)+'T00:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : ''

  return (
    <div className="card">
      <div className="card-header">
        <h3>Calendar</h3>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          <label className="btn btn-sm" style={{ cursor:'pointer', fontSize:'0.72rem', color:'var(--blue)' }} title="Import Outlook .ics">
            <input type="file" ref={fileRef} accept=".ics" onChange={handleICS} style={{ display:'none' }} />
            📥 Import .ics
          </label>
          {outlookEvents.length > 0 && (
            <button className="btn btn-sm btn-danger" style={{ fontSize:'0.72rem' }}
              onClick={()=>{ if(window.confirm('Clear all imported Outlook events?')) setOutlookEvents([]) }}>
              Clear Outlook
            </button>
          )}
        </div>
      </div>

      <div className="card-body" style={{ padding:'12px 14px' }}>
        {icsError && <div style={{ color:'var(--red)', fontSize:'0.75rem', marginBottom:8 }}>{icsError}</div>}

        {/* Month navigation */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <button onClick={prevMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'var(--text-muted)', padding:'2px 10px', lineHeight:1 }}>‹</button>
          <span style={{ fontWeight:700, fontSize:'0.92rem' }}>{monthName} {viewYear}</span>
          <button onClick={nextMonth} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'1.2rem', color:'var(--text-muted)', padding:'2px 10px', lineHeight:1 }}>›</button>
        </div>

        {/* Day-of-week headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:3 }}>
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map((d,i) => (
            <div key={i} style={{ textAlign:'center', fontSize:'0.6rem', fontWeight:700, color:'var(--text-muted)', padding:'2px 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
          {cells.map((day, i) => {
            const events      = day ? getEventsForDay(day) : []
            const bills       = day ? getBillsForDay(day)  : []
            const isToday     = isCurrentMonth && day === todayDay
            const isPast      = isCurrentMonth && day !== null && day < todayDay
            const isSelected  = day === selectedDay
            const hasBillSoon = bills.some(a => isDueSoon(a.dueDate))
            const hasItems    = events.length > 0 || bills.length > 0
            return (
              <div key={i}
                onClick={() => { if (!day) return; setSelectedDay(day === selectedDay ? null : day); setAddForm(null) }}
                style={{
                  minHeight:50, padding:'3px 2px', borderRadius:6,
                  cursor: day ? 'pointer' : 'default',
                  background: isSelected ? 'var(--pink-light)' : isToday ? 'var(--blue-bg)' : day ? 'var(--surface-hover)' : 'transparent',
                  border: `1px solid ${isSelected ? 'var(--pink-border)' : isToday ? '#93c5fd' : 'transparent'}`,
                  opacity: isPast && !hasItems ? 0.45 : 1,
                  transition: 'background 0.1s',
                }}>
                {day && (
                  <>
                    <div style={{ fontSize:'0.72rem', fontWeight: isToday ? 800 : 'normal', color: isToday ? 'var(--blue)' : 'var(--text)', textAlign:'center', marginBottom:2 }}>{day}</div>
                    <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                      {events.slice(0,2).map(ev => (
                        <div key={ev.id} style={{ fontSize:'0.54rem', background: ev.source==='outlook'?'#dbeafe':'var(--pink-light)', color: ev.source==='outlook'?'#1d4ed8':'var(--pink)', borderRadius:2, padding:'1px 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, lineHeight:1.4 }}>
                          {ev.title}
                        </div>
                      ))}
                      {events.length > 2 && <div style={{ fontSize:'0.5rem', color:'var(--text-faint)', textAlign:'center' }}>+{events.length-2} more</div>}
                      {bills.slice(0,1).map(a => (
                        <div key={a.id} style={{ fontSize:'0.54rem', background: hasBillSoon?'#fffbeb':'#fef2f2', color: hasBillSoon?'#b45309':'var(--red)', borderRadius:2, padding:'1px 3px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontWeight:600, lineHeight:1.4 }}>
                          💳 {a.name.replace(/Chase\s*/i,'').replace(/Credit Card/i,'CC').substring(0,8)}
                        </div>
                      ))}
                      {bills.length > 1 && <div style={{ fontSize:'0.5rem', color:'var(--red)', textAlign:'center' }}>+{bills.length-1}</div>}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {/* Selected day detail panel */}
        {selectedDay && (
          <div style={{ marginTop:12, padding:'10px 12px', background:'var(--pink-light)', border:'1px solid var(--pink-border)', borderRadius:'var(--radius)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
              <span style={{ fontSize:'0.82rem', fontWeight:700 }}>{selLabel}</span>
              <button className="btn btn-sm btn-primary" style={{ fontSize:'0.7rem', padding:'2px 8px' }}
                onClick={() => setAddForm(addForm ? null : { title:'', time:'', notes:'' })}>
                {addForm ? 'Cancel' : '+ Add Event'}
              </button>
            </div>
            {addForm && (
              <form onSubmit={saveEvent} style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                <input placeholder="Event title" value={addForm.title} onChange={e=>setAddForm({...addForm,title:e.target.value})} required autoFocus style={{ fontSize:'0.82rem' }} />
                <div style={{ display:'flex', gap:6 }}>
                  <input type="time" value={addForm.time} onChange={e=>setAddForm({...addForm,time:e.target.value})} style={{ flex:1, fontSize:'0.82rem' }} />
                  <input placeholder="Notes (optional)" value={addForm.notes} onChange={e=>setAddForm({...addForm,notes:e.target.value})} style={{ flex:2, fontSize:'0.82rem' }} />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ alignSelf:'flex-end' }}>Save</button>
              </form>
            )}
            {selBills.map(a => (
              <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid var(--pink-border)' }}>
                <span style={{ fontSize:'0.78rem' }}>💳</span>
                <span style={{ flex:1, fontSize:'0.78rem', fontWeight:600 }}>{a.name}</span>
                <span style={{ fontSize:'0.72rem', color: isDueSoon(a.dueDate)?'var(--amber)':'var(--red)', fontWeight:700 }}>
                  Due {dueDayOrdinal(a.dueDate)}{isDueSoon(a.dueDate)?' ⏰':''}
                </span>
              </div>
            ))}
            {selEvents.map(ev => (
              <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom:'1px solid var(--pink-border)' }}>
                <SourceDot source={ev.source||'local'} />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:'0.78rem', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</div>
                  {ev.time  && <div style={{ fontSize:'0.68rem', color:'var(--text-muted)' }}>{ev.time}</div>}
                  {ev.notes && <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.notes}</div>}
                </div>
                {ev.source !== 'outlook' && (
                  <button onClick={()=>removeEvent(ev)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'1rem', padding:'0 2px', lineHeight:1 }}>×</button>
                )}
              </div>
            ))}
            {selEvents.length === 0 && selBills.length === 0 && !addForm && (
              <div style={{ fontSize:'0.78rem', color:'var(--text-muted)' }}>No events — click + Add Event</div>
            )}
          </div>
        )}

        {!selectedDay && allEvents.length === 0 && (
          <div style={{ marginTop:10, fontSize:'0.72rem', color:'var(--text-faint)', textAlign:'center' }}>
            Click any day to add an event · or import your Outlook .ics above
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Today's Workout Widget ───────────────────────────────────────────────────
function TodayWorkoutWidget() {
  const [logs, setLogs] = useLocalStorage('fitness_logs', {})
  const dateKey  = today()
  const dayIdx   = new Date().getDay()
  const planDay  = PLAN_DAYS[dayIdx]
  const log      = logs[dateKey] || {}
  // Support both new (workoutsPerDay) and old (workouts) log format
  const currentWorkouts = (log.workoutsPerDay || {})[dayIdx] || log.workouts || {}
  const completed = Object.values(currentWorkouts).filter(Boolean).length
  const total     = planDay.exercises.length

  function toggleEx(i) {
    const cur = (log.workoutsPerDay || {})[dayIdx] || log.workouts || {}
    const updated = {
      ...log,
      workoutsPerDay: { ...(log.workoutsPerDay || {}), [dayIdx]: { ...cur, [i]: !cur[i] } }
    }
    setLogs({ ...logs, [dateKey]: updated })
  }

  return (
    <div className="card" style={{ borderLeft: `3px solid ${planDay.color}`, overflow: 'hidden' }}>
      <div className="card-header" style={{ background: planDay.bg, borderBottom: `1px solid ${planDay.border}` }}>
        <div>
          <div style={{ fontSize: '0.62rem', color: planDay.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {planDay.emoji} Today's Workout
          </div>
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: 2 }}>{planDay.name}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ background: 'white', color: planDay.color, border: `1px solid ${planDay.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 'bold' }}>
            {completed}/{total} done
          </span>
          <a href="/fitness" style={{ fontSize: '0.72rem', color: planDay.color, textDecoration: 'none', opacity: 0.75 }}>Full plan →</a>
        </div>
      </div>
      <div className="card-body" style={{ padding: '12px 16px' }}>
        {planDay.warmup && (
          <div style={{ marginBottom: 10, padding: '7px 10px', background: 'var(--bg)', borderRadius: 6, fontSize: '0.72rem', color: 'var(--text-muted)', borderLeft: `2px solid ${planDay.border}` }}>
            <strong style={{ color: planDay.color }}>Warm-Up: </strong>{planDay.warmup}
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {planDay.exercises.map((ex, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: currentWorkouts[i] ? planDay.bg : 'var(--surface-hover)', borderRadius: 6, border: `1px solid ${currentWorkouts[i] ? planDay.border : 'var(--border-light)'}`, cursor: 'pointer', transition: 'background 0.15s' }}>
              <input type="checkbox" checked={!!currentWorkouts[i]} onChange={() => toggleEx(i)} style={{ accentColor: planDay.color, width: 14, height: 14, flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: '0.82rem', fontWeight: currentWorkouts[i] ? 'normal' : 'bold', textDecoration: currentWorkouts[i] ? 'line-through' : 'none', color: currentWorkouts[i] ? 'var(--text-muted)' : 'var(--text)' }}>
                {ex.name}
              </span>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-faint)', flexShrink: 0 }}>{ex.sets}</span>
            </label>
          ))}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: 12 }}>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${total > 0 ? (completed / total) * 100 : 0}%`, background: planDay.color, transition: 'width 0.3s' }} />
          </div>
          <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)', marginTop: 4, textAlign: 'right' }}>
            {completed === total && total > 0 ? '🎉 Workout complete!' : `${total - completed} exercises remaining`}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Today's Macros Widget ────────────────────────────────────────────────────
function TodayMacrosWidget() {
  const [logs] = useLocalStorage('fitness_logs', {})
  const dateKey = today()
  const log     = logs[dateKey] || { meals: { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] }, totalBurned: '' }

  const allFood = Object.values(log.meals || {}).flat()
  const totals  = {
    cal:     allFood.reduce((s, f) => s + (parseFloat(f.cal)     || 0), 0),
    protein: allFood.reduce((s, f) => s + (parseFloat(f.protein) || 0), 0),
    carbs:   allFood.reduce((s, f) => s + (parseFloat(f.carbs)   || 0), 0),
    fat:     allFood.reduce((s, f) => s + (parseFloat(f.fat)     || 0), 0),
    fiber:   allFood.reduce((s, f) => s + (parseFloat(f.fiber)   || 0), 0),
    sugar:   allFood.reduce((s, f) => s + (parseFloat(f.sugar)   || 0), 0),
  }
  const burned    = parseFloat(log.totalBurned) || 0
  const net       = totals.cal - burned
  const remaining = MACRO_TARGETS.cal - net

  const macroRows = [
    { label: 'Calories', value: totals.cal,     target: MACRO_TARGETS.cal,     color: 'var(--pink)' },
    { label: 'Protein',  value: totals.protein, target: MACRO_TARGETS.protein, color: 'var(--blue)' },
    { label: 'Carbs',    value: totals.carbs,   target: MACRO_TARGETS.carbs,   color: 'var(--amber)' },
    { label: 'Fat',      value: totals.fat,     target: MACRO_TARGETS.fat,     color: 'var(--green)' },
    { label: 'Fiber',    value: totals.fiber,   target: 25,                    color: '#8b5cf6' },
    { label: 'Sugar',    value: totals.sugar,   target: 50,                    color: '#ec4899' },
  ]

  return (
    <div className="card">
      <div className="card-header" style={{ background: 'var(--pink-light)', borderBottom: '1px solid var(--pink-border)' }}>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--pink-text)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🍽️ Today's Nutrition</div>
          <div style={{ fontWeight: 'bold', fontSize: '0.9rem', marginTop: 2 }}>
            {allFood.length > 0 ? `${Math.round(totals.cal)} eaten · ${Math.round(remaining)} remaining` : 'Macro Progress'}
          </div>
        </div>
        <a href="/fitness" style={{ fontSize: '0.72rem', color: 'var(--pink-text)', textDecoration: 'none', opacity: 0.75 }}>Log food →</a>
      </div>
      <div className="card-body">
        {allFood.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.6rem', marginBottom: 6 }}>🍽️</div>
            <div className="text-sm">No food logged yet today</div>
            <a href="/fitness" style={{ fontSize: '0.78rem', color: 'var(--pink)', marginTop: 4, display: 'block' }}>+ Log your meals →</a>
          </div>
        ) : (
          macroRows.map(m => {
            const v    = Math.round(m.value * 10) / 10
            const pct  = Math.min(100, m.target > 0 ? (v / m.target) * 100 : 0)
            const over = v > m.target * 1.1
            const good = v >= m.target * 0.82 && !over
            return (
              <div key={m.label} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{m.label}</span>
                  <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: over ? 'var(--red)' : good ? m.color : 'var(--text)' }}>
                    {v} <span style={{ fontWeight: 'normal', color: 'var(--text-faint)', fontSize: '0.65rem' }}>/ {m.target}</span>
                  </span>
                </div>
                <div className="progress-bar" style={{ height: 5 }}>
                  <div className="progress-fill" style={{ width: `${pct}%`, background: over ? 'var(--red)' : good ? m.color : 'var(--border)', transition: 'width 0.4s' }} />
                </div>
              </div>
            )
          })
        )}
        {(totals.cal > 0 || burned > 0) && (
          <div style={{ marginTop: 10, padding: '9px 14px', background: 'var(--pink-light)', border: '1px solid var(--pink-border)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>🔥 Burned</div>
              <div style={{ fontWeight: 'bold', color: 'var(--amber)', fontSize: '0.9rem' }}>{burned ? Math.round(burned) : '—'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Remaining</div>
              <div style={{ fontWeight: 'bold', color: remaining < 0 ? 'var(--red)' : 'var(--green)', fontSize: '0.9rem' }}>{Math.round(remaining)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net Cal</div>
              <div style={{ fontWeight: 'bold', color: 'var(--heading)', fontSize: '0.9rem' }}>{Math.round(net)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Finance Snapshot Widget ─────────────────────────────────────────────────
function FinanceSnapshotWidget({ transactions }) {
  const income  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
  const expense = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
  const net     = income - expense

  // Build last-6-month bar chart data
  const months = []
  for (let i = 5; i >= 0; i--) {
    const d   = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const lbl = d.toLocaleDateString('en-US',{month:'short'})
    const amt = transactions
      .filter(t=>t.type==='expense' && (t.date||'').startsWith(key))
      .reduce((s,t)=>s+Number(t.amount),0)
    months.push({ key, lbl, amt })
  }
  const maxAmt = Math.max(...months.map(m=>m.amt), 1)

  return (
    <div className="card">
      <div className="card-header">
        <h3>💰 Finance</h3>
        <a href="/finance" style={{ fontSize:'0.72rem', color:'var(--pink)', textDecoration:'none', fontWeight:500 }}>View Finance →</a>
      </div>
      <div className="card-body" style={{ padding:'14px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
          <div style={{ textAlign:'center' }}>
            <div className="metric-label">Income</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--green)' }}>{formatCurrency(income,true)}</div>
          </div>
          <div style={{ textAlign:'center', borderLeft:'1px solid var(--border-light)', borderRight:'1px solid var(--border-light)' }}>
            <div className="metric-label">Expenses</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--pink)' }}>{formatCurrency(expense,true)}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div className="metric-label">Net</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color: net>=0?'var(--green)':'var(--red)' }}>{formatCurrency(net,true)}</div>
          </div>
        </div>
        {/* 6-bar spending chart */}
        <div style={{ display:'flex', alignItems:'flex-end', gap:6, height:56 }}>
          {months.map(m => (
            <div key={m.key} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
              <div style={{
                width:'100%', background: m.amt>0?'var(--pink)':'var(--border-light)',
                borderRadius:'4px 4px 0 0',
                height: `${Math.max(4, (m.amt/maxAmt)*44)}px`,
                transition:'height 0.4s',
                opacity: m.amt>0?1:0.4,
              }} />
              <div style={{ fontSize:'0.6rem', color:'var(--text-muted)', textAlign:'center' }}>{m.lbl}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Real Estate Summary Widget ───────────────────────────────────────────────
function RealEstateWidget({ deals, fixFlip }) {
  const activeW   = deals.filter(d=>!['Closed','Dead'].includes(d.status)).length
  const pipeline  = deals.filter(d=>d.status==='Under Contract'||d.status==='Marketing').length
  const projProfit = deals.reduce((s,d)=>s+Number(d.fee||d.assignmentFee||0),0)
  return (
    <div className="card" style={{ marginTop:18 }}>
      <div className="card-header">
        <h3>🏠 Real Estate</h3>
        <a href="/real-estate" style={{ fontSize:'0.72rem', color:'var(--pink)', textDecoration:'none', fontWeight:500 }}>View deals →</a>
      </div>
      <div className="card-body" style={{ padding:'14px 18px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          <div style={{ textAlign:'center' }}>
            <div className="metric-label">Active Flips</div>
            <div style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--purple)' }}>{fixFlip.filter(p=>p.status!=='Completed').length}</div>
          </div>
          <div style={{ textAlign:'center', borderLeft:'1px solid var(--border-light)', borderRight:'1px solid var(--border-light)' }}>
            <div className="metric-label">Wholesale</div>
            <div style={{ fontSize:'1.3rem', fontWeight:700, color:'var(--blue)' }}>{activeW}</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div className="metric-label">Proj. Profit</div>
            <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--green)' }}>{formatCurrency(projProfit,true)}</div>
          </div>
        </div>
        {(deals.length===0 && fixFlip.length===0) && (
          <div style={{ textAlign:'center', padding:'12px 0 4px', color:'var(--text-faint)', fontSize:'0.8rem' }}>
            No active deals — <a href="/real-estate" style={{color:'var(--pink)'}}>add one →</a>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Quick Links Widget ───────────────────────────────────────────────────────
function QuickLinksWidget() {
  const [portalUrl] = useLocalStorage('portal_url', 'http://localhost:3000')
  const links = [
    { emoji:'🏠', label:'RLC Portal',    href: portalUrl, external: true },
    { emoji:'💰', label:'Finance',       href:'/finance' },
    { emoji:'🏡', label:'Real Estate',   href:'/real-estate' },
    { emoji:'⭐', label:'Credit Repair', href:'/credit-repair' },
    { emoji:'✅', label:'Tasks',         href:'/portal-project' },
  ]
  return (
    <div style={{ padding:'0 0 18px' }}>
      <div className="quick-links-grid" style={{ gridTemplateColumns:'repeat(5,1fr)' }}>
        {links.map(l => (
          <a
            key={l.href}
            href={l.href}
            className="quick-link-card"
            {...(l.external ? { target:'_blank', rel:'noopener noreferrer' } : {})}
          >
            <span style={{ fontSize:'1.1rem' }}>{l.emoji}</span>
            <span style={{ fontSize:'0.82rem' }}>{l.label}</span>
          </a>
        ))}
      </div>
    </div>
  )
}

// ─── Data Sync Widget ─────────────────────────────────────────────────────────
function DataSyncWidget() {
  const [msg, setMsg]         = useState(null)
  const [pushing, setPushing] = useState(false)

  async function pushToCloud() {
    setPushing(true)
    setMsg(null)
    const { ok, fail, total } = await forceSyncAllToSupabase()
    setPushing(false)
    if (total === 0) {
      setMsg({ ok: false, text: 'No local data found to upload.' })
    } else if (fail === 0) {
      setMsg({ ok: true, text: `✅ Uploaded ${ok} keys to cloud. Open on any device to see your data.` })
    } else {
      setMsg({ ok: false, text: `⚠️ ${ok} of ${total} keys uploaded. ${fail} failed.` })
    }
    setTimeout(() => setMsg(null), 10000)
  }

  return (
    <div className="card mb-20" style={{ borderColor: 'var(--pink-border)' }}>
      <div className="card-header" style={{ background: '#FFF5F7' }}>
        <h3 style={{ color: 'var(--pink-text)' }}>☁️ Cloud Sync</h3>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
          Data auto-syncs across all devices via Supabase
        </span>
      </div>
      <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={pushToCloud} disabled={pushing}
          style={{ opacity: pushing ? 0.7 : 1 }}>
          {pushing ? '⏳ Uploading...' : '☁️ Push All Data to Cloud Now'}
        </button>
        {msg && (
          <span style={{
            fontSize: '0.78rem', padding: '5px 12px', borderRadius: 'var(--radius)',
            color: msg.ok ? 'var(--green)' : 'var(--red)',
            background: msg.ok ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${msg.ok ? '#86efac' : '#fca5a5'}`,
          }}>
            {msg.text}
          </span>
        )}
        {!msg && !pushing && (
          <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>
            Click once to upload your existing data. After that, all changes sync automatically.
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [transactions] = useLocalStorage('finance_transactions', [])
  const [creditScores] = useLocalStorage('credit_scores', [])
  const [deals]        = useLocalStorage('re_wholesale', [])
  const [fixFlip]      = useLocalStorage('re_fixflip', [])

  const totalIncome  = transactions.filter(t=>t.type==='income').reduce((s,t)=>s+Number(t.amount),0)
  const totalExpense = transactions.filter(t=>t.type==='expense').reduce((s,t)=>s+Number(t.amount),0)
  const netIncome    = totalIncome - totalExpense

  const latestScore = creditScores.length
    ? [...creditScores].sort((a,b)=>b.date.localeCompare(a.date))[0]
    : null
  const avgScore = latestScore
    ? Math.round((latestScore.equifax + latestScore.experian + latestScore.transunion) / 3)
    : null

  const activeDeals = [
    ...deals.filter(d=>!['Closed','Dead'].includes(d.status)),
    ...fixFlip.filter(p=>p.status!=='Completed'),
  ].length

  // Live clock
  const [tick, setTick] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setTick(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Weather in header (with city)
  const [headerWeather, setHeaderWeather] = useState(null)
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async ({ coords }) => {
        try {
          const [weatherRes, geoRes] = await Promise.all([
            fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weathercode&temperature_unit=fahrenheit`).then(r => r.json()),
            fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`).then(r => r.json()),
          ])
          const city  = geoRes.city || geoRes.locality || geoRes.principalSubdivision || ''
          const state = geoRes.principalSubdivisionCode?.replace(/^US-/, '') ?? ''
          setHeaderWeather({
            temp: Math.round(weatherRes.current.temperature_2m),
            code: weatherRes.current.weathercode,
            city: city && state ? `${city}, ${state}` : city || state,
          })
        } catch { /* ignore */ }
      },
      () => {}
    )
  }, [])

  const weatherIcon = (code) => {
    if (!code && code !== 0) return '🌡️'
    if (code === 0)  return '☀️'
    if (code <= 3)   return '⛅'
    if (code <= 48)  return '🌫️'
    if (code <= 67)  return '🌧️'
    if (code <= 77)  return '❄️'
    if (code <= 82)  return '🌦️'
    return '⛈️'
  }

  const now        = tick
  const hour       = now.getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌸' : '🌙'
  const dayNum     = now.getDate()
  const monthStr   = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const yearStr    = now.getFullYear()
  const weekday    = now.toLocaleDateString('en-US', { weekday: 'long' })
  const timeStr    = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  const photo      = localStorage.getItem('profile_photo')

  return (
    <div>

      {/* ── SECTION 1: Greeting Banner ── */}
      <div className="greeting-banner">
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {/* Profile photo / initials — larger */}
          <div style={{
            width:76, height:76, borderRadius:'50%', overflow:'hidden', flexShrink:0,
            background:'linear-gradient(135deg,#E8547A,#C73D63)',
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'3px solid #fff', boxShadow:'0 4px 16px rgba(232,84,122,0.25)',
          }}>
            {photo
              ? <img src={photo} alt="Profile" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : <span style={{ color:'#fff', fontWeight:700, fontSize:'1.5rem' }}>RC</span>
            }
          </div>
          <div>
            <h1>{greetEmoji} {greeting}, Royanna!</h1>
            {/* Inline date · time · weather row */}
            <div style={{ display:'flex', alignItems:'center', flexWrap:'wrap', gap:'0 8px', marginTop:4, fontSize:'0.85rem', color:'var(--text-muted)' }}>
              <span>{weekday}, {monthStr} {dayNum}</span>
              <span style={{ color:'var(--border)' }}>·</span>
              <span style={{ fontWeight:700, color:'var(--text)' }}>{timeStr}</span>
              {headerWeather && (
                <>
                  <span style={{ color:'var(--border)' }}>·</span>
                  <span>{weatherIcon(headerWeather.code)} {headerWeather.temp}°F</span>
                  {headerWeather.city && <span style={{ color:'var(--text-faint)' }}>{headerWeather.city}</span>}
                </>
              )}
            </div>
            {/* Mini stat chips */}
            <div className="banner-chips">
              <div className="banner-chip">
                <span className="chip-label">Net</span>
                <span className={`chip-value ${netIncome>=0?'positive':'negative'}`}>{formatCurrency(netIncome,true)}</span>
              </div>
              <div className="banner-chip">
                <span className="chip-label">Expenses</span>
                <span className="chip-value negative">{formatCurrency(totalExpense,true)}</span>
              </div>
              <div className="banner-chip">
                <span className="chip-label">Deals</span>
                <span className="chip-value">{activeDeals}</span>
              </div>
              <div className="banner-chip">
                <span className="chip-label">Score</span>
                <span className={`chip-value ${avgScore?(avgScore>=700?'positive':avgScore>=600?'':'negative'):''}`}>{avgScore ?? '—'}</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── SECTION 2: Quick Links ── */}
      <QuickLinksWidget />

      {/* ── SECTION 3: 5 Metric Cards ── */}
      <div className="metrics-grid mb-20" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        <div className={`metric-card ${netIncome>=0?'metric-card-income':'metric-card-expense'}`}>
          <div className="metric-label">💰 Net Income</div>
          <div className={`metric-value ${netIncome>=0?'value-positive':'value-negative'}`}>{formatCurrency(netIncome,true)}</div>
          <div className="metric-change neutral">{transactions.length} transactions</div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">📈 Total Revenue</div>
          <div className="metric-value value-positive">{formatCurrency(totalIncome,true)}</div>
        </div>
        <div className="metric-card metric-card-expense">
          <div className="metric-label">📉 Total Expenses</div>
          <div className="metric-value value-negative">{formatCurrency(totalExpense,true)}</div>
        </div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">⭐ Avg Credit Score</div>
          <div className={`metric-value ${avgScore?(avgScore>=700?'value-positive':avgScore>=600?'':'value-negative'):''}`}>{avgScore ?? '—'}</div>
          <div className="metric-change neutral">All 3 bureaus</div>
        </div>
        <div className="metric-card metric-card-net">
          <div className="metric-label">🏠 Active Deals</div>
          <div className="metric-value">{activeDeals}</div>
          <div className="metric-change neutral">Wholesale + Flip</div>
        </div>
      </div>

      {/* ── SECTION 4: 3-column main content ── */}
      <div className="three-col" style={{alignItems:'start'}}>

        {/* LEFT: Fitness */}
        <div>
          <TodayWorkoutWidget />
          <div style={{ marginTop:18 }}>
            <TodayMacrosWidget />
          </div>
        </div>

        {/* MIDDLE: To-Do + Calendar */}
        <div>
          <TodoWidget />
          <div style={{ marginTop:18 }}>
            <CalendarWidget />
          </div>
        </div>

        {/* RIGHT: Finance + Real Estate */}
        <div>
          <FinanceSnapshotWidget transactions={transactions} />
          <RealEstateWidget deals={deals} fixFlip={fixFlip} />
        </div>

      </div>

    </div>
  )
}
