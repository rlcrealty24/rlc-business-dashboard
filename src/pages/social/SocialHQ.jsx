import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../../ceo/ceo.css'
import { useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, FORMATS } from '../../social/constants.js'
import { marketingSummary } from '../../social/insights.js'
import { BrandChip, DueChip, SocialNav, SocialSetupNeeded, platformsLabel } from '../../social/ui.jsx'
import { toast } from '../../ceo/ui.jsx'
import { addDays, daysBetween, fmtDate, todayISO } from '../../ceo/recurrence.js'

export default function SocialHQ() {
  const { items, campaigns, toggleStep, capture, setupNeeded, seeded } = useSocial()
  const navigate = useNavigate()
  const [idea, setIdea] = useState('')
  const [brand, setBrand] = useState('personal')
  const today = todayISO()
  const m = marketingSummary(items, campaigns, today)

  if (setupNeeded) return <div className="c-page"><Head /><SocialSetupNeeded /></div>

  const attention = [
    [m.overduePosts.length, 'past their publish date', 'stages=planned,gathering,ready_to_film,filmed,editing,review,approved,scheduled&view=list', 'red'],
    [m.needsFootage.length, 'need footage or assets (next 2 weeks)', 'stages=planned,gathering,ready_to_film', 'warn'],
    [m.needsEditing.length, 'waiting to be edited', 'stages=filmed,editing', ''],
    [m.awaitingApproval.length, 'waiting for your approval', 'stages=editing,review', 'warn'],
    [m.ready.length, 'ready to publish', 'stages=approved,scheduled', 'green'],
  ].filter(([n]) => n > 0)

  return (
    <div className="c-page">
      <Head />

      <form className="c-capture" style={{ marginBottom: 20 }} onSubmit={async e => {
        e.preventDefault(); if (!idea.trim()) return
        await capture(idea, brand); setIdea(''); toast('Idea saved', `${BRANDS[brand].label} · Idea bank`)
      }}>
        <input value={idea} onChange={e => setIdea(e.target.value)} placeholder="Capture a content idea…" />
        <select className="c-select" style={{ width: 140, border: 0, borderLeft: '1px solid var(--border)' }} value={brand} onChange={e => setBrand(e.target.value)}>
          {Object.entries(BRANDS).map(([k, b]) => <option key={k} value={k}>{b.short}</option>)}
        </select>
        <button className="c-btn c-btn-sky" style={{ border: 0 }}>Save</button>
      </form>

      {!seeded && items.length === 0 && (
        <div className="c-banner sky" style={{ marginBottom: 20 }}>
          <span style={{ fontSize: 13 }}>Start with the 14 ideas from your brief — nothing gets scheduled.</span>
          <Link className="c-btn c-btn-ink c-btn-sm" to="/social/ideas">Open Idea bank</Link>
        </div>
      )}

      <div className="c-stats" style={{ marginBottom: 20 }}>
        {Object.entries(BRANDS).map(([k, b]) => {
          const target = Math.round(b.perWeek[1] * 4.3)
          return (
            <div key={k} className="c-stat" style={{ borderTop: `3px solid ${b.color}` }}>
              <div className="c-stat-val">{m.monthByBrand[k]}<span className="c-muted" style={{ fontSize: 16 }}> / ~{target}</span></div>
              <div className="c-stat-lbl">{b.short} · published this month</div>
              <div className="c-muted" style={{ fontSize: 11, marginTop: 6 }}>{m.weekByBrand[k]} this week · target {b.perWeek[0] < 1 ? '≤1' : `${b.perWeek[0]}–${b.perWeek[1]}`}/wk</div>
            </div>
          )
        })}
        <div className="c-stat">
          <div className="c-stat-val">{m.leadsThisMonth}</div>
          <div className="c-stat-lbl">Leads from social · this month</div>
          <div className="c-muted" style={{ fontSize: 11, marginTop: 6 }}>Logged on each post (tracking links in Phase 4)</div>
        </div>
      </div>

      {m.overCapacity.length > 0 && (
        <div className="c-banner" style={{ marginBottom: 20 }}>
          Heavier than your targets this week: {m.overCapacity.map(([b, n]) => `${BRANDS[b].short} has ${n}`).join(', ')}. Consider moving the lowest-priority post to next week.
        </div>
      )}

      <div className="c-grid">
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Today&apos;s content priorities</div><span className="c-label">{m.steps.length}</span></div>
            {m.steps.length === 0 && <div className="c-empty">Nothing due today. {m.upcoming.length ? 'Everything coming up is on track.' : 'Plan an idea to get started.'}</div>}
            {m.steps.slice(0, 8).map(({ item, step }) => (
              <div key={item.id + step.key} className="c-task">
                <button className="c-check" style={{ padding: 0, border: 0 }} onClick={() => toggleStep(item.id, step.key)} aria-label="Done">
                  <span className="c-box" />
                </button>
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/social/post/${item.id}`)}>
                  <div className="c-task-title"><strong style={{ fontWeight: 500 }}>{step.label}</strong> — {item.title}</div>
                  <div className="c-task-meta"><BrandChip brand={item.brand} /><DueChip due={step.due} />
                    {item.publish_date && <span className="c-chip">Publishes {fmtDate(item.publish_date, { month: 'short', day: 'numeric' })}</span>}</div>
                </div>
                <span />
              </div>
            ))}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Coming up · 7 days</div><Link className="c-link" style={{ fontSize: 12 }} to="/social/planner?view=week">Week view →</Link></div>
            {m.upcoming.length === 0 && <div className="c-empty">No posts in the next 7 days.</div>}
            {m.upcoming.map(i => (
              <div key={i.id} className="c-tl-row" style={{ gridTemplateColumns: '92px 1fr auto' }} onClick={() => navigate(`/social/post/${i.id}`)}>
                <div className="c-tl-time">{i.publish_date === today ? 'Today' : i.publish_date === addDays(today, 1) ? 'Tomorrow' : fmtDate(i.publish_date)}</div>
                <div className="c-tl-title"><span className="c-dot" style={{ background: BRANDS[i.brand].color }} /><span className="t">{i.title}</span></div>
                <span className="c-muted" style={{ fontSize: 12 }}>{FORMATS[i.format]?.label || ''}{i.platforms?.length ? ` · ${platformsLabel(i.platforms)}` : ''}</span>
              </div>
            ))}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Recently published</div></div>
            {m.recent.length === 0 && <div className="c-empty">Nothing published yet — mark a platform “published” on a post to log it here.</div>}
            {m.recent.map(i => (
              <div key={i.id} className="c-tl-row" style={{ gridTemplateColumns: '92px 1fr auto' }} onClick={() => navigate(`/social/post/${i.id}`)}>
                <div className="c-tl-time">{fmtDate(m.publishedAt(i), { month: 'short', day: 'numeric' })}</div>
                <div className="c-tl-title"><span className="c-dot" style={{ background: BRANDS[i.brand].color }} /><span className="t">{i.title}</span></div>
                <span className="c-muted" style={{ fontSize: 12 }}>{i.metrics?.views ? `${i.metrics.views} views` : ''}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Needs your attention</div></div>
            {attention.length === 0 && <div className="c-empty">All clear.</div>}
            {attention.map(([n, label, q, tone]) => (
              <Link key={label} to={`/social/planner?${q}`} className="c-tl-row" style={{ gridTemplateColumns: '44px 1fr', textDecoration: 'none', color: 'inherit' }}>
                <span className={`c-chip${tone ? ` ${tone}` : ''}`} style={{ justifyContent: 'center' }}>{n}</span>
                <span style={{ fontSize: 14 }}>{n === 1 ? 'post' : 'posts'} {label}</span>
              </Link>
            ))}
            {m.lastPersonal && daysBetween(m.lastPersonal, today) > 14 && (
              <div className="c-tl-row" style={{ gridTemplateColumns: '44px 1fr', cursor: 'default' }}>
                <span className="c-chip" style={{ justifyContent: 'center' }}>!</span>
                <span style={{ fontSize: 14 }}>Personal account quiet for {daysBetween(m.lastPersonal, today)} days — something meaningful, not filler.</span>
              </div>
            )}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Campaigns</div></div>
            {m.activeCampaigns.length + m.proposed.length === 0 && <div className="c-empty">No campaigns yet.</div>}
            {[...m.activeCampaigns, ...m.proposed].map(c => (
              <Link key={c.id} to={`/social/planner?campaign=${c.id}&view=list`} className="c-tl-row" style={{ gridTemplateColumns: '1fr auto', textDecoration: 'none', color: 'inherit' }}>
                <span style={{ fontSize: 14 }}>{c.name}</span>
                <span className={`c-chip${c.status === 'active' ? ' green' : ''}`}>{c.status}</span>
              </Link>
            ))}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Bank</div></div>
            <Link to="/social/ideas" className="c-tl-row" style={{ gridTemplateColumns: '44px 1fr', textDecoration: 'none', color: 'inherit' }}>
              <span className="c-chip" style={{ justifyContent: 'center' }}>{m.ideas.length}</span><span style={{ fontSize: 14 }}>ideas waiting</span>
            </Link>
            <Link to="/social/ideas?tab=backlog" className="c-tl-row" style={{ gridTemplateColumns: '44px 1fr', textDecoration: 'none', color: 'inherit' }}>
              <span className="c-chip" style={{ justifyContent: 'center' }}>{m.backlog.length}</span><span style={{ fontSize: 14 }}>catch-up posts · see unposted deals</span>
            </Link>
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Coming next</div></div>
            <div className="c-card-body c-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              Now live: AI strategist on every post (open a post → Develop with AI) and the <Link className="c-link" to="/social/plan">30-day plan</Link>.<br />
              Phase 3: agent submissions, asset library, Campaign Builder.<br />
              Phase 4: tracking links, CRM lead attribution, analytics.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Head() {
  return (
    <div className="c-head">
      <div>
        <div className="c-eyebrow">Social Media HQ</div>
        <div className="c-title">Marketing, handled</div>
        <div className="c-sub">Personal · RLC Realty · RLC Leasing — quality over quantity.</div>
      </div>
      <div className="c-head-actions">
        <Link className="c-btn" to="/social/planner">Planner</Link>
        <Link className="c-btn c-btn-ink" to="/social/plan">Plan my next 30 days</Link>
        <Link className="c-btn c-btn-sky" to="/social/ideas">Ideas &amp; Backlog</Link>
      </div>
    </div>
  )
}

