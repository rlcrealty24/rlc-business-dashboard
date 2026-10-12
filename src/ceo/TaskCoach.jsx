// "What to do first" — your open tasks (Inbox + Next + Tasks & Projects board) in a
// sensible order, with an AI pass that explains the order and fills your Top 3.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useCeo } from './CeoStore.jsx'
import { useCalendarItems } from './useCalendarItems.js'
import { prioritizeTasks } from '../social/ai.js'
import { addDays, fmtDate, fmtTime, nowMin, todayISO } from './recurrence.js'
import { toast } from './ui.jsx'

const RANK = { high: 0, medium: 1, low: 2 }
const MONEY = /\b(lead|leads|call|client|buyer|seller|tenant|renter|listing|showing|offer|closing|close|commission|contract|follow[- ]?up|prospect|deal|lease|referral|invoice|payment)\b/i

/** Every open task in one shape */
export function useOpenTasks() {
  const { tasks, updateTask } = useCeo()
  const [projectTasks, setProjectTasks] = useLocalStorage('portal_tasks', [])
  const list = useMemo(() => [
    ...tasks.filter(t => t.status !== 'done').map(t => ({
      key: `c:${t.id}`, title: t.title, notes: t.notes || '', priority: t.priority || null, due: t.due_date || null,
      created: (t.created_at || '').slice(0, 10), from: t.status === 'inbox' ? 'Inbox' : 'Next', focus: t.focus_date === todayISO(), raw: t,
    })),
    ...(Array.isArray(projectTasks) ? projectTasks : []).filter(t => t.status !== 'Done').map(t => ({
      key: `p:${t.id}`, title: t.title || t.text, notes: t.description || t.notes || '', priority: (t.priority || '').toLowerCase() || null,
      due: t.dueDate || null, created: t.createdAt || '', from: 'Projects', focus: false, raw: t,
    })),
  ], [tasks, projectTasks])
  return { list, updateTask, setProjectTasks }
}

/** Instant order without AI: overdue/due soon → high → money work → medium → oldest */
export function ruleOrder(list, today = todayISO()) {
  const score = t => {
    let s = 0
    if (t.due && t.due < today) s -= 100
    else if (t.due && t.due <= addDays(today, 2)) s -= 60
    else if (t.due && t.due <= addDays(today, 7)) s -= 25
    if (t.focus) s -= 40
    s += (RANK[t.priority] ?? 1.5) * 20
    if (MONEY.test(`${t.title} ${t.notes}`)) s -= 15
    return s
  }
  return [...list].sort((a, b) => score(a) - score(b) || (a.created || '').localeCompare(b.created || ''))
}

export default function TaskCoach({ limit = 6 }) {
  const { list, updateTask, setProjectTasks } = useOpenTasks()
  const today = todayISO()
  const { byDate } = useCalendarItems(today, today, { portal: false })
  const [saved, setSaved] = useLocalStorage('task_coach', null)
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [showAll, setShowAll] = useState(false)
  useEffect(() => { if (!busy) return; const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t) }, [busy])

  const keysNow = list.map(t => t.key).sort().join('|')
  const result = saved?.date === today ? saved.result : null
  const stale = result && saved.keys !== keysNow
  const byKey = new Map(list.map(t => [t.key, t]))

  // Order to show: AI order (still-open tasks only), then anything new by rules
  const ordered = useMemo(() => {
    if (!result) return ruleOrder(list).map(t => ({ t }))
    const seen = new Set()
    const out = []
    for (const o of result.order || []) { const t = byKey.get(o.key); if (t && !seen.has(o.key)) { seen.add(o.key); out.push({ t, o }) } }
    for (const t of ruleOrder(list)) if (!seen.has(t.key)) out.push({ t, isNew: true })
    return out
  }, [result, list]) // eslint-disable-line react-hooks/exhaustive-deps

  // Brain-dump capture asks for a fresh order once its tasks are saved
  const runRef = useRef(null)
  useEffect(() => {
    const go = () => { if (!runRef.current?.busy) runRef.current?.run() }
    window.addEventListener('ceo-coach-run', go)
    return () => window.removeEventListener('ceo-coach-run', go)
  }, [])

  async function run() {
    setBusy(true); setSecs(0)
    const n = nowMin()
    const schedule = (byDate.get(today) || []).filter(i => !i.allDay && i.end > n && i.status !== 'skipped' && !i.bumpedBy)
      .map(i => `${fmtTime(i.start)}–${fmtTime(i.end)} ${i.title}`)
    try {
      const r = await prioritizeTasks({
        today, now: fmtTime(n), schedule,
        tasks: list.map(t => ({ key: t.key, title: t.title, notes: t.notes.slice(0, 200) || undefined, priority: t.priority, due: t.due, added: t.created, list: t.from })),
      })
      setSaved({ date: today, keys: keysNow, at: new Date().toISOString(), result: r })
    } catch (e) { toast('Could not prioritize', e.message) }
    setBusy(false)
  }

  async function apply() {
    const pr = new Map((result.order || []).map(o => [o.key, o.priority]))
    const top = (result.top3 || []).filter(k => byKey.has(k))
    const currentTop = list.filter(t => t.focus && !top.includes(t.key))
    if (currentTop.length && !window.confirm(`Replace today's Top 3 with the suggested ones? (${currentTop.map(t => t.title).join(', ')} will move back to your list.)`)) return
    for (const t of list.filter(t => t.key.startsWith('c:'))) {
      const patch = {}
      const p = pr.get(t.key)
      if (p && p !== t.priority) patch.priority = p
      const wantFocus = top.includes(t.key)
      if (wantFocus && !t.focus) patch.focus_date = today
      if (!wantFocus && t.focus) patch.focus_date = null
      if (t.raw.status === 'inbox' && p) patch.status = 'next'
      if (Object.keys(patch).length) await updateTask(t.raw, patch)
    }
    setProjectTasks(prev => (Array.isArray(prev) ? prev : []).map(x => {
      const p = pr.get(`p:${x.id}`)
      return p ? { ...x, priority: p[0].toUpperCase() + p.slice(1) } : x
    }))
    const onBoard = top.filter(k => k.startsWith('p:')).length
    toast('Priorities applied', onBoard
      ? `Top 3 set. ${onBoard} of your top picks ${onBoard === 1 ? 'lives' : 'live'} on Tasks & Projects — marked ★ here.`
      : 'Your Top 3 is set — start with the first one.')
  }

  runRef.current = { run, busy }
  const first = result && byKey.get(result.first?.key)
  const shown = showAll ? ordered : ordered.slice(0, limit)

  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">What to do first</div>
        <span className="c-chip">{list.length} open</span>
      </div>

      {list.length === 0 && <div className="c-empty">Your list is clear. Capture anything new with + or ⌘K.</div>}

      {list.length > 0 && !busy && (
        <div className="c-card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <button className="c-btn c-btn-sky c-btn-sm" onClick={run}>{result ? 'Re-prioritize' : 'Prioritize with AI'}</button>
          {result && !stale && <button className="c-btn c-btn-ink c-btn-sm" onClick={apply}>Apply priorities & Top 3</button>}
          {stale && <span className="c-chip warn">Your list changed — re-run for a fresh order</span>}
          {!result && <span className="c-muted" style={{ fontSize: 12 }}>Showing a quick order (deadlines → high → money work). AI adds reasons, time estimates and your Top 3.</span>}
        </div>
      )}
      {busy && <div className="c-card-body"><div className="c-serif" style={{ fontSize: 18 }}>Sorting your list… {secs}s</div><div className="c-muted" style={{ fontSize: 12, marginTop: 4 }}>Usually under a minute.</div></div>}

      {first && !busy && (
        <div style={{ padding: '16px 20px', background: 'var(--ink)', color: '#fff' }}>
          <div className="c-eyebrow" style={{ color: 'var(--sky)' }}>Start here{result.first.minutes ? ` · ~${result.first.minutes} min` : ''}</div>
          <div className="c-serif" style={{ fontSize: 22, margin: '6px 0 4px' }}>{first.title}</div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,255,.75)' }}>{result.first.why}</div>
          {result.first.first_step && <div style={{ fontSize: 13, marginTop: 8 }}>First step: <strong>{result.first.first_step}</strong></div>}
        </div>
      )}
      {result?.note && !busy && <div className="c-muted" style={{ padding: '10px 20px 0', fontSize: 12, fontStyle: 'italic' }}>{result.note}</div>}

      {!busy && shown.map(({ t, o, isNew }, n) => (
        <div key={t.key} className="c-task" style={{ gridTemplateColumns: '22px 1fr auto' }}>
          <span className="c-muted" style={{ fontSize: 12, paddingTop: 2 }}>{n + 1}</span>
          <div style={{ minWidth: 0 }}>
            <div className="c-task-title">{t.title}</div>
            {o?.why && <div className="c-muted" style={{ fontSize: 12, marginTop: 3 }}>{o.why}</div>}
            <div className="c-task-meta">
              {o?.when && <span className={`c-chip${o.when === 'today' ? ' sky' : ''}`}>{o.when}</span>}
              {o?.minutes ? <span className="c-chip">~{o.minutes} min</span> : null}
              {t.due && <span className={`c-chip${t.due < today ? ' red' : t.due <= addDays(today, 2) ? ' warn' : ''}`}>{t.due < today ? 'Overdue' : `Due ${fmtDate(t.due, { month: 'short', day: 'numeric' })}`}</span>}
              {(t.focus || result?.top3?.includes(t.key)) && <span className="c-chip sky">★ Top 3</span>}
              {isNew && <span className="c-chip">new</span>}
              <span className="c-chip">{t.from}</span>
            </div>
          </div>
          <span />
        </div>
      ))}
      {!busy && ordered.length > limit && (
        <button className="c-btn c-btn-ghost c-btn-sm" style={{ margin: '8px 20px' }} onClick={() => setShowAll(v => !v)}>{showAll ? 'Show fewer' : `Show all ${ordered.length}`}</button>
      )}
      {!busy && result?.drop?.length > 0 && (
        <div style={{ padding: '10px 20px 14px', borderTop: '1px solid var(--border)' }}>
          <div className="s-field-label">Consider dropping</div>
          {result.drop.filter(d => byKey.has(d.key)).map(d => <div key={d.key} style={{ fontSize: 13 }}>• {byKey.get(d.key).title} <span className="c-muted">— {d.why}</span></div>)}
        </div>
      )}
      <div className="c-muted" style={{ fontSize: 11, padding: '8px 20px 12px' }}>
        Includes your <Link className="c-link" to="/inbox">Inbox</Link> and <Link className="c-link" to="/portal-project">Tasks &amp; Projects</Link>.
      </div>
    </div>
  )
}
