import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import '../../ceo/ceo.css'
import { live, useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, EFFORT_LABEL, FORMATS } from '../../social/constants.js'
import { BrandChip, SocialNav, SocialSetupNeeded, Tabs, platformsLabel } from '../../social/ui.jsx'
import { useClosedDeals } from '../../social/portalData.js'
import { fmtDate, todayISO, daysBetween } from '../../ceo/recurrence.js'
import { toast } from '../../ceo/ui.jsx'

const RANK = { high: 0, medium: 1, low: 2 }

export default function IdeaBank() {
  const [params] = useSearchParams()
  const [tab, setTab] = useState(params.get('tab') || 'ideas')
  const { setupNeeded } = useSocial()
  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  return (
    <div className="c-page" style={{ maxWidth: 1180 }}>
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · Ideas &amp; Backlog</div>
          <div className="c-title">{tab === 'ideas' ? 'Idea bank' : 'Catch-up backlog'}</div>
          <div className="c-sub">{tab === 'ideas'
            ? 'Capture in seconds. Nothing here is scheduled until you plan it.'
            : 'Months of work worth sharing — older content still counts, nothing here is urgent.'}</div>
        </div>
        <div className="c-head-actions"><SocialNav /></div>
      </div>
      <div className="c-toolbar"><Tabs value={tab} onChange={setTab} tabs={[['ideas', 'Ideas'], ['backlog', 'Backlog']]} /></div>
      {tab === 'ideas' ? <Ideas /> : <Backlog />}
    </div>
  )
}

function Ideas() {
  const { items, campaigns, capture, seeded, installSeed, updateItem } = useSocial()
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [brand, setBrand] = useState('personal')
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('priority')
  const [planning, setPlanning] = useState(null)

  const ideas = useMemo(() => live(items).filter(i => i.stage === 'idea' && (filter === 'all' || i.brand === filter))
    .sort((a, b) => sort === 'lead'
      ? (RANK[a.lead_potential] ?? 3) - (RANK[b.lead_potential] ?? 3)
      : sort === 'effort' ? (['light', 'medium', 'heavy'].indexOf(a.effort) - ['light', 'medium', 'heavy'].indexOf(b.effort))
      : sort === 'new' ? b.created_at.localeCompare(a.created_at)
      : (RANK[a.priority] ?? 3) - (RANK[b.priority] ?? 3)), [items, filter, sort])
  const proposed = campaigns.filter(c => c.status === 'proposed')

  return (
    <div className="c-stack">
      <form className="c-capture" onSubmit={async e => {
        e.preventDefault(); if (!text.trim()) return
        await capture(text, brand); setText(''); toast('Idea saved', BRANDS[brand].label)
      }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="e.g. Film a Reel about how I disappeared from social media but kept closing deals" />
        <select className="c-select" style={{ width: 150, border: 0, borderLeft: '1px solid var(--border)' }} value={brand} onChange={e => setBrand(e.target.value)}>
          {Object.entries(BRANDS).map(([k, b]) => <option key={k} value={k}>{b.short}</option>)}
        </select>
        <button className="c-btn c-btn-sky" style={{ border: 0 }}>Save idea</button>
      </form>

      {!seeded && (
        <div className="c-banner sky">
          <span style={{ fontSize: 13 }}>Load the 14 starter ideas from your brief (A–N): personal Reels, RLC closings & reveals, agent spotlight, apartment tours, and the proposed 30 Days, 30 Apartments campaign. Nothing gets scheduled.</span>
          <button className="c-btn c-btn-ink c-btn-sm" onClick={installSeed}>Load starter ideas</button>
        </div>
      )}

      {proposed.length > 0 && (
        <div className="c-card">
          <div className="c-card-head"><div className="c-card-title">Proposed campaigns</div><span className="c-muted" style={{ fontSize: 12 }}>Not active until you approve scope + launch date</span></div>
          {proposed.map(c => (
            <div key={c.id} className="c-tl-row" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
              <div><div style={{ fontSize: 14, fontWeight: 500 }}>{c.name}</div><div className="c-muted" style={{ fontSize: 12, marginTop: 3 }}>{c.goal}</div></div>
              <span className="c-chip">Campaign Builder — Phase 3</span>
            </div>
          ))}
        </div>
      )}

      <div className="c-toolbar" style={{ marginBottom: 0 }}>
        <Tabs value={filter} onChange={setFilter} tabs={[['all', 'All'], ...Object.entries(BRANDS).map(([k, b]) => [k, b.short])]} />
        <span style={{ flex: 1 }} />
        <select className="c-select" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }} value={sort} onChange={e => setSort(e.target.value)}>
          <option value="priority">Sort: priority</option><option value="lead">Sort: lead potential</option>
          <option value="effort">Sort: least effort</option><option value="new">Sort: newest</option>
        </select>
      </div>

      <div className="c-card">
        {ideas.length === 0 && <div className="c-empty">No ideas yet — capture one above (or press + anywhere and choose “Content idea”).</div>}
        {ideas.map(i => (
          <div key={i.id} className="c-task" style={{ gridTemplateColumns: '1fr auto' }}>
            <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => navigate(`/social/post/${i.id}`)}>
              <div className="c-task-title" style={{ fontWeight: 500 }}>{i.title}</div>
              {i.notes && <div className="c-muted" style={{ fontSize: 12, marginTop: 4, lineHeight: 1.45 }}>{i.notes.slice(0, 180)}{i.notes.length > 180 ? '…' : ''}</div>}
              <div className="c-task-meta">
                <BrandChip brand={i.brand} />
                {i.format && <span className="c-chip">{FORMATS[i.format]?.label}</span>}
                {i.platforms?.length > 0 && <span className="c-chip">{platformsLabel(i.platforms)}</span>}
                {i.priority === 'high' && <span className="c-chip c-prio-high">High</span>}
                {i.lead_potential && <span className="c-chip">Leads: {i.lead_potential}</span>}
                {i.effort && <span className="c-chip">Effort: {EFFORT_LABEL[i.effort]}</span>}
                {i.timeliness && <span className={`c-chip${i.timeliness === 'expiring' ? ' red' : i.timeliness === 'timely' ? ' warn' : ''}`}>{i.timeliness}</span>}
              </div>
              {planning === i.id && <PlanForm item={i} onDone={() => setPlanning(null)} update={updateItem} />}
            </div>
            <div className="c-task-actions" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
              <button className="c-btn c-btn-sky c-btn-sm" onClick={() => setPlanning(planning === i.id ? null : i.id)}>Plan it</button>
              <Link className="c-btn c-btn-sm" to={`/social/post/${i.id}`}>Open</Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Idea → plan: pick a publish date (and format if missing) */
function PlanForm({ item, update, onDone }) {
  const [date, setDate] = useState('')
  const [format, setFormat] = useState(item.format || '')
  return (
    <div onClick={e => e.stopPropagation()} style={{ background: 'var(--mist)', border: '1px solid var(--border)', padding: 12, marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
      <div className="c-field"><label className="s-field-label">Publish on</label>
        <input className="c-input" type="date" min={todayISO()} value={date} onChange={e => setDate(e.target.value)} /></div>
      <div className="c-field"><label className="s-field-label">Format</label>
        <select className="c-select" value={format} onChange={e => setFormat(e.target.value)}>
          <option value="">Choose…</option>{Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select></div>
      <button className="c-btn c-btn-ink c-btn-sm" disabled={!date || !format} onClick={() => {
        update(item.id, { publish_date: date, format })
        toast('Planned', `${item.title} — prep steps added to your calendar`); onDone()
      }}>Add to plan</button>
      <button className="c-btn c-btn-ghost c-btn-sm" onClick={onDone}>Cancel</button>
    </div>
  )
}

function Backlog() {
  const { items, saveItem } = useSocial()
  const navigate = useNavigate()
  const { connected, loading, deals } = useClosedDeals()
  const [picked, setPicked] = useState(() => new Set())

  // Deals already used in some post (source_ref holds deal ids)
  const used = useMemo(() => new Set(items.flatMap(i => (i.source_ref || '').split(',').filter(Boolean))), [items])
  const open = deals.filter(d => !used.has(d.id))
  const byAgent = useMemo(() => {
    const m = new Map()
    for (const d of open) { if (!m.has(d.agent)) m.set(d.agent, []); m.get(d.agent).push(d) }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [open])
  const backlogPosts = live(items).filter(i => i.is_backlog && !['published', 'reviewed'].includes(i.stage))

  async function create(list, kind) {
    const agents = [...new Set(list.map(d => d.agent))]
    const leases = list.every(d => d.kind === 'lease')
    const single = list.length === 1
    const title = single
      ? `${leases ? 'Just leased' : 'Just closed'} — ${list[0].label}`
      : kind === 'agent' ? `${agents[0]} — ${list.length} recent ${leases ? 'leases' : 'transactions'}`
      : `Recent ${leases ? 'leases' : 'transactions'} recap (${list.length})`
    const row = await saveItem({
      title, brand: 'rlc', stage: 'idea', format: single ? 'transaction_story' : 'recap_carousel',
      platforms: ['instagram', 'facebook'], pillar: kind === 'agent' ? 'Agent spotlight' : 'Transactions',
      objective: kind === 'agent' ? 'Agent visibility' : 'Authority & credibility',
      agent_name: agents.length === 1 && agents[0] !== 'Unassigned' ? agents[0] : null,
      is_backlog: true, source: 'backlog', source_ref: list.map(d => d.id).join(','), timeliness: 'evergreen',
      notes: `From the portal (internal only — confirm what's shareable):\n${list.map(d => `• ${d.label} — ${d.agent}${d.date ? `, ${fmtDate(d.date, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`).join('\n')}`,
    })
    setPicked(new Set())
    navigate(`/social/post/${row.id}`)
  }

  return (
    <div className="c-stack">
      {backlogPosts.length > 0 && (
        <div className="c-card">
          <div className="c-card-head"><div className="c-card-title">Catch-up posts</div><span className="c-chip">{backlogPosts.length}</span></div>
          {backlogPosts.map(i => (
            <div key={i.id} className="c-tl-row" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => navigate(`/social/post/${i.id}`)}>
              <div className="c-tl-title"><span className="t">{i.title}</span></div>
              <span className="c-chip">{i.publish_date ? fmtDate(i.publish_date) : 'Unscheduled'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="c-card">
        <div className="c-card-head">
          <div className="c-card-title">Unposted transactions</div>
          {picked.size > 0 && (
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="c-btn c-btn-sm" onClick={() => create(deals.filter(d => picked.has(d.id)), 'single')}>
                {picked.size === 1 ? 'Create post' : `Create recap of ${picked.size}`}
              </button>
              <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => setPicked(new Set())}>Clear</button>
            </div>
          )}
        </div>
        {!connected && <div className="c-empty">Connect the RLC Portal on the Today page to pull your closed deals here.</div>}
        {connected && loading && <div className="c-empty">Loading deals…</div>}
        {connected && !loading && open.length === 0 && <div className="c-empty">Every closed deal already has a post.</div>}
        {byAgent.map(([agent, list]) => (
          <div key={agent} style={{ borderBottom: '1px solid var(--border)' }}>
            <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{agent}</div>
                <div className="c-muted" style={{ fontSize: 12 }}>{list.length} {list.length === 1 ? 'deal' : 'deals'}{list.every(d => d.kind === 'lease') ? ' · leases' : ''}</div>
              </div>
              {list.length >= 3 && agent !== 'Unassigned' && (
                <button className="c-btn c-btn-sky c-btn-sm" onClick={() => create(list, 'agent')}>Suggested: spotlight {agent.split(' ')[0]} with all {list.length}</button>
              )}
            </div>
            {list.map(d => (
              <label key={d.id} className="c-tl-row" style={{ gridTemplateColumns: '22px 1fr auto', cursor: 'pointer' }}>
                <input type="checkbox" checked={picked.has(d.id)} onChange={() => { const n = new Set(picked); n.has(d.id) ? n.delete(d.id) : n.add(d.id); setPicked(n) }} />
                <span style={{ fontSize: 14 }}>{d.label} <span className="c-muted" style={{ fontSize: 12 }}>· {d.kind === 'lease' ? 'Lease' : 'Sale'}</span></span>
                <span className="c-muted" style={{ fontSize: 12 }}>{d.date ? `${fmtDate(d.date, { month: 'short', day: 'numeric' })} · ${Math.max(0, Math.round(daysBetween(d.date, todayISO()) / 30))} mo ago` : ''}</span>
              </label>
            ))}
          </div>
        ))}
      </div>
      <div className="c-muted" style={{ fontSize: 12 }}>Deal names and addresses stay internal. Every transaction post includes a permission check before it can be approved.</div>
    </div>
  )
}
