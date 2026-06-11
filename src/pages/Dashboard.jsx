import { useState, useEffect, useRef } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { formatCurrency, formatDate, today, uid } from '../utils/formatters.js'
import { PLAN_DAYS, MACRO_TARGETS } from '../data/fitnessData.js'

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
    <div style={{
      background: 'linear-gradient(135deg, var(--pink-light) 0%, #fff8fb 100%)',
      border: '1px solid var(--pink-border)',
      borderRadius: 'var(--radius)',
      padding: '18px 20px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      marginBottom: 24,
      boxShadow: '0 1px 3px rgba(223,91,142,0.08)',
    }}>
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

// ─── Weather ──────────────────────────────────────────────────────────────────
function WeatherWidget() {
  const [weather, setWeather] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res  = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.latitude}&longitude=${coords.longitude}&current=temperature_2m,weathercode,windspeed_10m&temperature_unit=fahrenheit`)
          const data = await res.json()
          setWeather(data.current)
        } catch { /* ignore */ }
        setLoading(false)
      },
      () => setLoading(false)
    )
  }, [])

  const weatherIcon = (code) => {
    if (code === 0)  return '☀️'
    if (code <= 3)   return '⛅'
    if (code <= 48)  return '🌫️'
    if (code <= 67)  return '🌧️'
    if (code <= 77)  return '❄️'
    if (code <= 82)  return '🌦️'
    return '⛈️'
  }
  const weatherDesc = (code) => {
    if (code === 0)  return 'Clear sky'
    if (code <= 3)   return 'Partly cloudy'
    if (code <= 48)  return 'Foggy'
    if (code <= 67)  return 'Rainy'
    if (code <= 77)  return 'Snowy'
    if (code <= 82)  return 'Showers'
    return 'Stormy'
  }

  return (
    <div className="card">
      <div className="card-header"><h3>Weather</h3></div>
      <div className="card-body" style={{ textAlign:'center', padding:'28px 20px' }}>
        {loading ? (
          <span className="text-muted text-sm">Detecting location…</span>
        ) : weather ? (
          <>
            <div style={{ fontSize:'2.8rem', lineHeight:1 }}>{weatherIcon(weather.weathercode)}</div>
            <div style={{ fontSize:'2rem', fontWeight:'normal', marginTop:8 }}>{weather.temperature_2m}°F</div>
            <div className="text-muted mt-8 text-sm">{weatherDesc(weather.weathercode)}</div>
            <div className="text-xs mt-4" style={{color:'var(--text-faint)'}}>Wind {weather.windspeed_10m} km/h</div>
          </>
        ) : (
          <span className="text-muted text-sm">Allow location access for weather</span>
        )}
      </div>
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
  // Share the same localStorage key as PortalProject's task board
  const [rawTasks, setTasks] = useLocalStorage('portal_tasks', [])
  const tasks = Array.isArray(rawTasks) ? rawTasks : []

  // Use refs so add() always reads the live DOM value — no stale-closure risk
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

  // Show To Do + In Progress as pending; Done as completed
  const pending = tasks.filter(t => t.status !== 'Done')
  const done    = tasks.filter(t => t.status === 'Done')

  return (
    <div className="card" style={{ height:'100%' }}>
      <div className="card-header">
        <h3>To-Do</h3>
        <span className="badge badge-pink">{pending.length} open</span>
      </div>
      <div className="card-body">
        <div style={{ display:'flex', gap:8, marginBottom:16 }}>
          <input
            ref={textRef}
            defaultValue=""
            onKeyDown={handleKey}
            placeholder="Add a task…"
            style={{ flex:1 }}
          />
          <input ref={dateRef} type="date" defaultValue={today()} style={{ width:140 }} />
          <button type="button" className="btn btn-primary btn-sm" onClick={add}>Add</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {pending.map(t => {
            const prio = PRIO_STYLE[t.priority] || PRIO_STYLE.Medium
            return (
              <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <input type="checkbox" checked={false} onChange={()=>toggle(t.id)} style={{ marginTop:3, accentColor:'var(--pink)' }} />
                <div style={{ flex:1 }}>
                  <div className="text-sm">{t.title || t.text}</div>
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
                <button onClick={()=>remove(t.id)} className="btn btn-sm btn-danger" style={{ padding:'2px 6px' }}>×</button>
              </div>
            )
          })}
          {done.length > 0 && (
            <>
              <div className="divider" />
              {done.map(t => (
                <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:8, opacity:0.45 }}>
                  <input type="checkbox" checked={true} onChange={()=>toggle(t.id)} style={{ marginTop:3, accentColor:'var(--pink)' }} />
                  <span className="text-sm" style={{ textDecoration:'line-through', flex:1 }}>{t.title || t.text}</span>
                  <button onClick={()=>remove(t.id)} className="btn btn-sm btn-danger" style={{ padding:'2px 6px' }}>×</button>
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
    </div>
  )
}

// ─── Calendar (multi-source) ──────────────────────────────────────────────────
function CalendarWidget() {
  const [localEvents,   setLocalEvents]   = useLocalStorage('dash_events', [])
  const [outlookEvents, setOutlookEvents] = useLocalStorage('dash_outlook_events', [])
  const [form,    setForm]    = useState({ title:'', date:today(), time:'', notes:'' })
  const [adding,  setAdding]  = useState(false)
  const [filter,  setFilter]  = useState('all')   // all | local | outlook
  const [icsError, setIcsError] = useState('')
  const fileRef = useRef(null)

  function saveLocal(e) {
    e.preventDefault()
    if (!form.title || !form.date) return
    setLocalEvents([...localEvents, { ...form, id:uid(), source:'local' }])
    setForm({ title:'', date:today(), time:'', notes:'' })
    setAdding(false)
  }

  function handleICS(e) {
    const file = e.target.files[0]
    if (!file) return
    setIcsError('')
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = parseICS(ev.target.result)
        if (parsed.length === 0) { setIcsError('No events found in file'); return }
        setOutlookEvents([...outlookEvents, ...parsed])
      } catch { setIcsError('Could not parse .ics file') }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const allEvents = [
    ...(filter !== 'outlook' ? localEvents   : []),
    ...(filter !== 'local'   ? outlookEvents : []),
  ]
  const upcoming = allEvents
    .filter(ev => ev.date >= today())
    .sort((a,b) => {
      const dateDiff = a.date.localeCompare(b.date)
      if (dateDiff !== 0) return dateDiff
      return (a.time || '').localeCompare(b.time || '')
    })
    .slice(0, 15)

  function removeEvent(ev) {
    if (ev.source === 'outlook') setOutlookEvents(outlookEvents.filter(e=>e.id!==ev.id))
    else setLocalEvents(localEvents.filter(e=>e.id!==ev.id))
  }

  const localCount   = localEvents.filter(e=>e.date>=today()).length
  const outlookCount = outlookEvents.filter(e=>e.date>=today()).length

  return (
    <div className="card">
      <div className="card-header">
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <h3>Calendar</h3>
          {/* Source legend */}
          <div style={{ display:'flex', gap:10, fontSize:'0.7rem', color:'var(--text-muted)' }}>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
              <SourceDot source="local" /> Personal ({localCount})
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:4 }}>
              <SourceDot source="outlook" /> Outlook ({outlookCount})
            </span>
          </div>
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center' }}>
          {/* Source filter */}
          <select
            value={filter}
            onChange={e=>setFilter(e.target.value)}
            style={{ fontSize:'0.75rem', padding:'3px 6px', border:'1px solid var(--border)', borderRadius:'var(--radius)' }}
          >
            <option value="all">All sources</option>
            <option value="local">Personal only</option>
            <option value="outlook">Outlook only</option>
          </select>

          {/* Import Outlook .ics */}
          <label
            className="btn btn-sm"
            style={{ cursor:'pointer', fontSize:'0.75rem', color:'var(--blue)' }}
            title="Import Outlook .ics file"
          >
            <input type="file" ref={fileRef} accept=".ics" onChange={handleICS} style={{ display:'none' }} />
            📥 Import .ics
          </label>

          {outlookEvents.length > 0 && (
            <button
              className="btn btn-sm btn-danger"
              style={{ fontSize:'0.75rem' }}
              title="Clear imported Outlook events"
              onClick={()=>{ if(window.confirm('Clear all imported Outlook events?')) setOutlookEvents([]) }}
            >
              Clear Outlook
            </button>
          )}

          <button className="btn btn-sm btn-primary" onClick={()=>setAdding(!adding)}>
            {adding ? 'Cancel' : '+ Event'}
          </button>
        </div>
      </div>

      <div className="card-body">
        {icsError && (
          <div style={{ color:'var(--red)', fontSize:'0.75rem', marginBottom:10 }}>{icsError}</div>
        )}

        {/* How to export from Outlook hint */}
        {outlookEvents.length === 0 && (
          <div style={{
            background:'var(--pink-light)', border:'1px solid var(--pink-border)',
            borderRadius:'var(--radius)', padding:'8px 14px',
            fontSize:'0.75rem', color:'var(--pink-text)', marginBottom:14,
          }}>
            <strong>Tip:</strong> In Outlook → Calendar → click the 3 dots → Export as .ics → import it here to see all your meetings.
          </div>
        )}

        {adding && (
          <form onSubmit={saveLocal} style={{ marginBottom:16, display:'flex', flexDirection:'column', gap:8 }}>
            <input placeholder="Event title" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required />
            <div style={{ display:'flex', gap:8 }}>
              <input type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} style={{ flex:1 }} />
              <input type="time" value={form.time} onChange={e=>setForm({...form,time:e.target.value})} style={{ flex:1 }} />
            </div>
            <input placeholder="Notes (optional)" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            <button type="submit" className="btn btn-primary btn-sm">Save</button>
          </form>
        )}

        {upcoming.length === 0 ? (
          <div className="empty-state" style={{ padding:'24px 0' }}><p>No upcoming events</p></div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {upcoming.map(ev => (
              <div key={ev.id} style={{ display:'flex', gap:12, alignItems:'flex-start' }}>
                {/* Date badge */}
                <div style={{
                  minWidth:42, textAlign:'center',
                  background: ev.source==='outlook' ? '#eff6ff' : 'var(--pink-light)',
                  borderRadius:4, padding:'4px 0', flexShrink:0,
                }}>
                  <div style={{ fontSize:'0.6rem', textTransform:'uppercase', letterSpacing:'0.05em', color: ev.source==='outlook'?'var(--blue)':'var(--pink)', marginTop:2 }}>
                    {new Date(ev.date+'T00:00:00').toLocaleDateString('en-US',{month:'short'})}
                  </div>
                  <div style={{ fontWeight:'bold', fontSize:'1.1rem', lineHeight:1.2 }}>
                    {new Date(ev.date+'T00:00:00').getDate()}
                  </div>
                </div>

                {/* Event detail */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <SourceDot source={ev.source||'local'} />
                    <span className="text-sm bold" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.title}</span>
                  </div>
                  {ev.time && <div className="text-xs text-muted" style={{paddingLeft:13}}>{ev.time}</div>}
                  {ev.notes && <div className="text-xs text-muted" style={{paddingLeft:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'100%'}}>{ev.notes}</div>}
                </div>

                <button onClick={()=>removeEvent(ev)} className="btn btn-sm btn-danger" style={{ padding:'2px 6px', flexShrink:0 }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bills Calendar Widget ────────────────────────────────────────────────────
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

function BillsCalendarWidget() {
  const [accounts] = useLocalStorage('finance_accounts', [])

  const now         = new Date()
  const year        = now.getFullYear()
  const month       = now.getMonth()
  const todayDay    = now.getDate()
  const monthName   = now.toLocaleString('default', { month: 'long' })

  const liabs = accounts.filter(a => a.isLiability && a.dueDate)

  const firstDow    = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < firstDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)
  while (cells.length % 7 !== 0) cells.push(null)

  function getDue(day) {
    return liabs.filter(a => parseInt(a.dueDate) === day)
  }

  return (
    <div className="card" style={{ marginTop: 24 }}>
      <div className="card-header">
        <h3>💳 {monthName} {year} — Bill Due Dates</h3>
        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>Recurring monthly payments</span>
      </div>
      <div style={{ padding:'12px 16px 16px' }}>
        {/* Day-of-week headers */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, marginBottom:3 }}>
          {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:'0.62rem', fontWeight:'bold', color:'var(--text-muted)', padding:'3px 0' }}>{d}</div>
          ))}
        </div>
        {/* Calendar cells */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
          {cells.map((day, i) => {
            const due      = day ? getDue(day) : []
            const isToday  = day === todayDay
            const isPast   = day !== null && day < todayDay
            const hasDue   = due.length > 0
            const soon     = hasDue && due.some(a => isDueSoon(a.dueDate))
            return (
              <div key={i} style={{
                minHeight: 52,
                padding: '4px 3px',
                borderRadius: 6,
                background: isToday ? 'var(--blue-bg)' : hasDue ? (soon ? '#fffbeb' : '#fef2f2') : day ? 'var(--surface-hover)' : 'transparent',
                border: `1px solid ${isToday ? '#93c5fd' : soon ? '#fcd34d' : hasDue ? '#fca5a5' : 'transparent'}`,
                opacity: isPast ? 0.45 : 1,
              }}>
                {day && <>
                  <div style={{
                    fontSize: '0.72rem',
                    fontWeight: isToday ? 'bold' : 'normal',
                    color: isToday ? 'var(--blue)' : hasDue ? (soon ? 'var(--amber)' : 'var(--red)') : 'var(--text)',
                    textAlign: 'center',
                    marginBottom: 2,
                  }}>{day}</div>
                  {due.map(a => (
                    <div key={a.id} title={a.name} style={{
                      fontSize: '0.58rem', color: '#fff', fontWeight: 'bold',
                      background: soon ? 'var(--amber)' : 'var(--red)',
                      borderRadius: 3, padding: '1px 3px',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.4, marginBottom: 1, textAlign: 'center',
                    }}>
                      {a.name.replace(/Chase\s*/i,'').replace(/Credit Card/i,'CC').substring(0,9)}
                    </div>
                  ))}
                </>}
              </div>
            )
          })}
        </div>
        {/* Legend */}
        {liabs.length > 0 ? (
          <div style={{ marginTop:12, display:'flex', flexWrap:'wrap', gap:6 }}>
            {liabs.map(a => {
              const soon = isDueSoon(a.dueDate)
              return (
                <div key={a.id} style={{
                  display:'flex', alignItems:'center', gap:5,
                  fontSize:'0.72rem', padding:'3px 10px',
                  background: soon ? '#fffbeb' : '#fef2f2',
                  border: `1px solid ${soon ? '#fcd34d' : '#fca5a5'}`,
                  borderRadius: 20,
                }}>
                  <span style={{ width:7, height:7, borderRadius:'50%', background: soon ? 'var(--amber)' : 'var(--red)', display:'inline-block', flexShrink:0 }} />
                  <span style={{ color:'var(--text)', fontWeight:'500' }}>{a.name}</span>
                  <span style={{ color: soon ? 'var(--amber)' : 'var(--red)', fontWeight:'bold' }}>
                    {a.dueDate ? `${dueDayOrdinal(a.dueDate)} of each month` : 'no date'}
                    {soon ? ' ⏰' : ''}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ textAlign:'center', padding:'16px 0 4px', color:'var(--text-faint)', fontSize:'0.82rem' }}>
            No bill due dates set — go to Finance → Accounts and edit a liability to set its monthly due day
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
          <div style={{ marginTop: 10, padding: '9px 12px', background: 'linear-gradient(135deg,#2c2420,#5a3530)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>🔥 Burned</div>
              <div style={{ fontWeight: 'bold', color: '#fcd34d', fontSize: '0.9rem' }}>{burned ? Math.round(burned) : '—'}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Remaining</div>
              <div style={{ fontWeight: 'bold', color: remaining < 0 ? '#f87171' : '#86efac', fontSize: '0.9rem' }}>{Math.round(remaining)}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Net Cal</div>
              <div style={{ fontWeight: 'bold', color: 'white', fontSize: '0.9rem' }}>{Math.round(net)}</div>
            </div>
          </div>
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

  const now        = new Date()
  const hour       = now.getHours()
  const greeting   = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const greetEmoji = hour < 12 ? '☀️' : hour < 17 ? '🌸' : '🌙'
  const dayNum     = now.getDate()
  const monthStr   = now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()
  const yearStr    = now.getFullYear()
  const weekday    = now.toLocaleDateString('en-US', { weekday: 'long' })
  const photo      = localStorage.getItem('profile_photo')

  return (
    <div>

      {/* ── Greeting Banner ── */}
      <div className="greeting-banner">
        <div style={{ display:'flex', alignItems:'center', gap:16 }}>
          {photo && (
            <img src={photo} alt="Royanna" style={{
              width:54, height:54, borderRadius:'50%', objectFit:'cover',
              border:'3px solid #fff', boxShadow:'0 2px 12px rgba(223,91,142,0.25)',
              flexShrink:0,
            }} />
          )}
          <div>
            <h1>{greetEmoji} {greeting}, Royanna!</h1>
            <div className="greeting-sub">
              {weekday} — here's everything happening in your world today.
            </div>
          </div>
        </div>
        <div className="date-pill">
          <div className="day">{dayNum}</div>
          <div className="month-year">{monthStr} {yearStr}</div>
        </div>
      </div>

      {/* Portal Quick Access */}
      <PortalCard />

      {/* Metrics */}
      <div className="metrics-grid">
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
        <div className="metric-card metric-card-blue">
          <div className="metric-label">⭐ Avg Credit Score</div>
          <div className={`metric-value ${avgScore?(avgScore>=700?'value-positive':avgScore>=600?'':'value-negative'):''}`}>
            {avgScore ?? '—'}
          </div>
          <div className="metric-change neutral">All 3 bureaus</div>
        </div>
        <div className="metric-card metric-card-net">
          <div className="metric-label">🏠 Active Deals</div>
          <div className="metric-value">{activeDeals}</div>
          <div className="metric-change neutral">Wholesale + Fix &amp; Flip</div>
        </div>
      </div>

      {/* Fitness Widgets */}
      <div className="section-grid" style={{ marginBottom: 24 }}>
        <TodayWorkoutWidget />
        <TodayMacrosWidget />
      </div>

      {/* Widgets */}
      <div className="section-grid">
        <WeatherWidget />
        <TodoWidget />
      </div>
      <CalendarWidget />
      <BillsCalendarWidget />
    </div>
  )
}
