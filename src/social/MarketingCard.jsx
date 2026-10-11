import { Link, useNavigate } from 'react-router-dom'
import { useSocial } from './SocialStore.jsx'
import { BRANDS } from './constants.js'
import { marketingSummary } from './insights.js'
import { addDays, fmtDate, todayISO } from '../ceo/recurrence.js'

/** Today-page summary of Social HQ: priorities, upcoming posts, what needs attention */
export default function MarketingCard() {
  const { items, campaigns, toggleStep, setupNeeded } = useSocial()
  const navigate = useNavigate()
  if (setupNeeded) return null
  const today = todayISO()
  const m = marketingSummary(items, campaigns, today)
  const attention = [
    m.overduePosts.length && `${m.overduePosts.length} past publish date`,
    m.needsFootage.length && `${m.needsFootage.length} missing footage`,
    m.awaitingApproval.length && `${m.awaitingApproval.length} awaiting approval`,
    m.ready.length && `${m.ready.length} ready to publish`,
    m.proposed.length && `${m.proposed.length} campaign${m.proposed.length > 1 ? 's' : ''} proposed`,
  ].filter(Boolean)
  if (!m.steps.length && !m.upcoming.length && !attention.length && !m.ideas.length) return null
  const when = d => (d === today ? 'Today' : d === addDays(today, 1) ? 'Tomorrow' : fmtDate(d, { weekday: 'short' }))

  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">Marketing</div>
        <Link to="/social" className="c-link" style={{ fontSize: 12 }}>Social HQ →</Link>
      </div>

      <div style={{ padding: '12px 20px 4px' }} className="c-label">Today&apos;s marketing priorities</div>
      {m.steps.length === 0 && <div className="c-muted" style={{ padding: '4px 20px 12px', fontSize: 13 }}>Nothing due today.</div>}
      {m.steps.slice(0, 5).map(({ item, step }) => (
        <div key={item.id + step.key} className="c-task" style={{ padding: '9px 20px' }}>
          <button className="c-check" style={{ padding: 0, border: 0 }} onClick={() => toggleStep(item.id, step.key)} aria-label="Done"><span className="c-box" /></button>
          <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/social/post/${item.id}`)}>
            <div className="c-task-title">{step.label} — {item.title}</div>
            <div className="c-muted" style={{ fontSize: 11, marginTop: 2 }}>
              {BRANDS[item.brand].short}{step.due < today ? ' · overdue' : ''}{item.publish_date ? ` · posts ${when(item.publish_date)}` : ''}
            </div>
          </div>
          <span />
        </div>
      ))}
      {m.steps.length > 5 && <Link to="/social" className="c-link" style={{ fontSize: 12, padding: '6px 20px', display: 'block' }}>+{m.steps.length - 5} more</Link>}

      {m.upcoming.length > 0 && <>
        <div style={{ padding: '14px 20px 4px', borderTop: '1px solid var(--border)' }} className="c-label">Upcoming content</div>
        {m.upcoming.slice(0, 4).map(i => (
          <div key={i.id} className="c-tl-row" style={{ gridTemplateColumns: '84px 1fr', padding: '8px 20px' }} onClick={() => navigate(`/social/post/${i.id}`)}>
            <div className="c-tl-time">{when(i.publish_date)}</div>
            <div className="c-tl-title"><span className="c-dot" style={{ background: BRANDS[i.brand].color }} /><span className="t">{i.title}</span></div>
          </div>
        ))}
      </>}

      {attention.length > 0 && (
        <Link to="/social" style={{ display: 'block', padding: '12px 20px', borderTop: '1px solid var(--border)', textDecoration: 'none', color: 'inherit' }}>
          <div className="c-label" style={{ marginBottom: 6 }}>Needs your attention</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{attention.map(a => <span key={a} className="c-chip warn">{a}</span>)}</div>
        </Link>
      )}
    </div>
  )
}
