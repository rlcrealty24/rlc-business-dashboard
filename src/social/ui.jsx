import { Link, useNavigate } from 'react-router-dom'
import { BRANDS, FORMATS, PLATFORMS, stageLabel } from './constants.js'
import { nextStep } from './schedule.js'
import { fmtDate, todayISO } from '../ceo/recurrence.js'

export function BrandChip({ brand, short = true }) {
  const b = BRANDS[brand] || BRANDS.personal
  return (
    <span className="c-chip" style={{ color: b.color === '#0a0a0a' ? '#0a0a0a' : b.color, borderColor: b.color + '55', background: b.bg }}>
      <span className="c-dot" style={{ background: b.color }} />{short ? b.short : b.label}
    </span>
  )
}

export function StageChip({ stage }) {
  const tone = { idea: '', published: ' green', reviewed: ' green', approved: ' sky', scheduled: ' sky', review: ' warn' }[stage] || ''
  return <span className={`c-chip${tone}`}>{stageLabel(stage)}</span>
}

export const platformsLabel = list => (list || []).map(p => PLATFORMS[p] || p).join(' + ')

/** "Due today", "Overdue", "Thu Oct 15" */
export function DueChip({ due, done }) {
  if (!due) return null
  const t = todayISO()
  if (!done && due < t) return <span className="c-chip red">Overdue</span>
  if (due === t) return <span className="c-chip warn">Today</span>
  return <span className="c-chip">{fmtDate(due)}</span>
}

/** Compact post card used in the pipeline, lists and day cells */
export function PostCard({ item, draggable, onDragStart, compact }) {
  const navigate = useNavigate()
  const b = BRANDS[item.brand] || BRANDS.personal
  const ns = nextStep(item)
  return (
    <div className="s-card" draggable={draggable} onDragStart={onDragStart}
      onClick={() => navigate(`/social/post/${item.id}`)} style={{ borderLeftColor: b.color }}>
      <div className="s-card-title">{item.title}</div>
      {!compact && (
        <div className="s-card-meta">
          <span>{b.short}</span>
          {item.format && <span>· {FORMATS[item.format]?.label}</span>}
          {item.publish_date && <span>· {fmtDate(item.publish_date, { month: 'short', day: 'numeric' })}</span>}
        </div>
      )}
      {ns && item.stage !== 'idea' && (
        <div className="s-card-next">Next: {ns.label}{ns.due && ns.due < todayISO() ? ' · overdue' : ''}</div>
      )}
    </div>
  )
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="c-seg" style={{ flexWrap: 'wrap' }}>
      {tabs.map(([k, l]) => <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>)}
    </div>
  )
}

export function SocialSetupNeeded() {
  return (
    <div className="c-banner" style={{ marginBottom: 16 }}>
      Social HQ needs its database tables. Run the Phase 0 + 1 SQL in Supabase (it was pasted in chat), then refresh.
    </div>
  )
}

export function SocialNav() {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12, letterSpacing: '.12em', textTransform: 'uppercase' }}>
      <Link className="c-link" to="/social">HQ</Link>
      <Link className="c-link" to="/social/planner">Planner</Link>
      <Link className="c-link" to="/social/ideas">Ideas &amp; Backlog</Link>
      <Link className="c-link" to="/social/plan">30-day plan</Link>
      <Link className="c-link" to="/social/campaigns">Campaigns</Link>
      <Link className="c-link" to="/social/library">Library</Link>
    </div>
  )
}
