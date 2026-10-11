import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import '../../ceo/ceo.css'
import { live, useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, FORMATS, PLATFORMS, STAGES, STAGE_INDEX, stageLabel } from '../../social/constants.js'
import { nextStep } from '../../social/schedule.js'
import { BrandChip, PostCard, SocialNav, SocialSetupNeeded, StageChip, Tabs, platformsLabel } from '../../social/ui.jsx'
import { DAY_SHORT, MONTH_SHORT, addDays, fmtDate, iso, parseISO, todayISO, weekStart } from '../../ceo/recurrence.js'
import { toast } from '../../ceo/ui.jsx'

export default function Planner() {
  const { items, campaigns, updateItem, setupNeeded } = useSocial()
  const [params] = useSearchParams()
  const [view, setView] = useState(params.get('view') || 'pipeline')
  const [anchor, setAnchor] = useState(todayISO())
  const [brands, setBrands] = useState(() => new Set(params.get('brand') ? [params.get('brand')] : Object.keys(BRANDS)))
  const [platform, setPlatform] = useState('')
  const [format, setFormat] = useState('')
  const [agent, setAgent] = useState('')
  const [campaign, setCampaign] = useState(params.get('campaign') || '')
  const [showPrep, setShowPrep] = useState(true)
  const [stageFilter] = useState(params.get('stages')?.split(',') || null)

  const agentsInUse = [...new Set(items.map(i => i.agent_name).filter(Boolean))].sort()
  const shown = useMemo(() => live(items).filter(i =>
    brands.has(i.brand) &&
    (!platform || i.platforms?.includes(platform)) &&
    (!format || i.format === format) &&
    (!agent || i.agent_name === agent) &&
    (!campaign || i.campaign_id === campaign) &&
    (!stageFilter || stageFilter.includes(i.stage))), [items, brands, platform, format, agent, campaign, stageFilter])

  function reschedule(id, date) {
    const it = items.find(i => i.id === id)
    if (!it || it.publish_date === date) return
    updateItem(id, { publish_date: date })
    toast(`Moved to ${fmtDate(date)}`, `${it.title} — prep dates moved too`)
  }
  function restage(id, stage) {
    const it = items.find(i => i.id === id)
    if (!it || it.stage === stage) return
    updateItem(id, { stage })
  }

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>

  return (
    <div className="c-page">
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · Planner</div>
          <div className="c-title">Content planner</div>
          <div className="c-sub">Drag posts between stages or days. Moving a post moves its prep work with it.</div>
        </div>
        <div className="c-head-actions"><SocialNav /></div>
      </div>

      <div className="c-toolbar">
        <Tabs value={view} onChange={setView} tabs={[['pipeline', 'Pipeline'], ['month', 'Month'], ['week', 'Week'], ['list', 'List']]} />
        <span style={{ flex: 1 }} />
        {(view === 'month' || view === 'week') && <>
          <button className="c-btn c-btn-sm" onClick={() => setAnchor(todayISO())}>Today</button>
          <button className="c-icon-btn" onClick={() => setAnchor(view === 'month' ? iso(new Date(parseISO(anchor).getFullYear(), parseISO(anchor).getMonth() - 1, 1)) : addDays(anchor, -7))}>‹</button>
          <button className="c-icon-btn" onClick={() => setAnchor(view === 'month' ? iso(new Date(parseISO(anchor).getFullYear(), parseISO(anchor).getMonth() + 1, 1)) : addDays(anchor, 7))}>›</button>
          <span className="c-serif" style={{ fontSize: 20 }}>{view === 'month' ? parseISO(anchor).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `Week of ${fmtDate(weekStart(anchor), { month: 'short', day: 'numeric' })}`}</span>
          <label className="c-check-row" style={{ marginLeft: 8 }}><input type="checkbox" checked={showPrep} onChange={e => setShowPrep(e.target.checked)} /> Prep tasks</label>
        </>}
      </div>

      <div className="c-toolbar" style={{ gap: 6 }}>
        {Object.entries(BRANDS).map(([k, b]) => {
          const on = brands.has(k)
          return <button key={k} className="c-chip" onClick={() => { const n = new Set(brands); on ? n.delete(k) : n.add(k); setBrands(n) }}
            style={on ? { borderColor: b.color, color: b.color === '#0a0a0a' ? '#0a0a0a' : b.color, background: b.bg } : { opacity: .45 }}>
            <span className="c-dot" style={{ background: b.color }} />{b.short}</button>
        })}
        <Filter value={platform} onChange={setPlatform} label="All platforms" options={Object.entries(PLATFORMS)} />
        <Filter value={format} onChange={setFormat} label="All formats" options={Object.entries(FORMATS).map(([k, v]) => [k, v.label])} />
        {agentsInUse.length > 0 && <Filter value={agent} onChange={setAgent} label="All agents" options={agentsInUse.map(a => [a, a])} />}
        {campaigns.length > 0 && <Filter value={campaign} onChange={setCampaign} label="All campaigns" options={campaigns.map(c => [c.id, c.name])} />}
        {stageFilter && <span className="c-chip warn">Filtered: {stageFilter.map(stageLabel).join(', ')}</span>}
      </div>

      {view === 'pipeline' && <Pipeline items={shown} onDrop={restage} />}
      {view === 'month' && <Month items={shown} anchor={anchor} showPrep={showPrep} onDrop={reschedule} />}
      {view === 'week' && <Week items={shown} anchor={anchor} showPrep={showPrep} onDrop={reschedule} />}
      {view === 'list' && <List items={shown} />}
    </div>
  )
}

function Filter({ value, onChange, label, options }) {
  return (
    <select className="c-select" style={{ width: 'auto', padding: '5px 10px', fontSize: 11 }} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{label}</option>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  )
}

const dragId = e => e.dataTransfer.getData('text/plain')
const startDrag = id => e => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move' }

function Pipeline({ items, onDrop }) {
  const [over, setOver] = useState(null)
  return (
    <div className="s-board">
      {STAGES.map(([k, l]) => {
        const col = items.filter(i => i.stage === k).sort((a, b) => (a.publish_date || '9').localeCompare(b.publish_date || '9'))
        return (
          <div key={k} className={`s-col${over === k ? ' drop' : ''}`}
            onDragOver={e => { e.preventDefault(); setOver(k) }} onDragLeave={() => setOver(null)}
            onDrop={e => { e.preventDefault(); setOver(null); onDrop(dragId(e), k) }}>
            <div className="s-col-head"><span className="c-label">{l}</span><span className="c-chip">{col.length}</span></div>
            <div className="s-col-body">
              {col.map(i => <PostCard key={i.id} item={i} draggable onDragStart={startDrag(i.id)} />)}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DayCell({ date, items, prep, showPrep, onDrop, other, tall }) {
  const navigate = useNavigate()
  const [over, setOver] = useState(false)
  const today = todayISO()
  return (
    <div className={`s-day${other ? ' other' : ''}${date === today ? ' today' : ''}${over ? ' drop' : ''}`} style={tall ? { minHeight: 320 } : undefined}
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onDrop(dragId(e), date) }}>
      <div className="md">{parseISO(date).getDate() === 1 ? `${MONTH_SHORT[parseISO(date).getMonth()]} 1` : parseISO(date).getDate()}</div>
      {items.map(i => {
        const b = BRANDS[i.brand]
        return tall
          ? <PostCard key={i.id} item={i} draggable onDragStart={startDrag(i.id)} />
          : <div key={i.id} className="s-pill" draggable onDragStart={startDrag(i.id)} title={i.title}
              onClick={() => navigate(`/social/post/${i.id}`)} style={{ background: b.bg, borderLeftColor: b.color }}>{i.title}</div>
      })}
      {showPrep && prep.map(({ item, step }) => (
        <div key={item.id + step.key} className={`s-prep${step.done ? ' done' : ''}`} title={`${step.label} — ${item.title}`}
          onClick={() => navigate(`/social/post/${item.id}`)}>{step.label} · {item.title}</div>
      ))}
    </div>
  )
}

function buildDays(items) {
  const pubs = new Map(), prep = new Map()
  for (const i of items) {
    if (i.publish_date) { if (!pubs.has(i.publish_date)) pubs.set(i.publish_date, []); pubs.get(i.publish_date).push(i) }
    for (const s of i.steps || []) {
      if (!s.due || ['publish', 'review'].includes(s.anchor)) continue
      if (!prep.has(s.due)) prep.set(s.due, [])
      prep.get(s.due).push({ item: i, step: s })
    }
  }
  return { pubs, prep }
}

function Month({ items, anchor, showPrep, onDrop }) {
  const d = parseISO(anchor)
  const first = iso(new Date(d.getFullYear(), d.getMonth(), 1))
  const start = weekStart(first)
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))
  const { pubs, prep } = buildDays(items)
  return (
    <div className="c-cal">
      <div className="c-month" style={{ borderBottom: '1px solid var(--ink)' }}>
        {DAY_SHORT.map(x => <div key={x} className="c-cal-dayhead" style={{ cursor: 'default' }}><div className="dn">{x}</div></div>)}
      </div>
      <div className="c-month">
        {days.map(ds => <DayCell key={ds} date={ds} items={pubs.get(ds) || []} prep={(prep.get(ds) || []).filter(p => !p.step.done)}
          showPrep={showPrep} onDrop={onDrop} other={parseISO(ds).getMonth() !== d.getMonth()} />)}
      </div>
    </div>
  )
}

function Week({ items, anchor, showPrep, onDrop }) {
  const start = weekStart(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const { pubs, prep } = buildDays(items)
  return (
    <div className="c-cal">
      <div className="c-month" style={{ borderBottom: '1px solid var(--ink)' }}>
        {days.map(ds => <div key={ds} className="c-cal-dayhead" style={{ cursor: 'default' }}><div className="dn">{DAY_SHORT[parseISO(ds).getDay()]}</div><div className="dd">{parseISO(ds).getDate()}</div></div>)}
      </div>
      <div className="c-month">
        {days.map(ds => <DayCell key={ds} date={ds} tall items={pubs.get(ds) || []} prep={prep.get(ds) || []} showPrep={showPrep} onDrop={onDrop} />)}
      </div>
    </div>
  )
}

function List({ items }) {
  const navigate = useNavigate()
  const [sort, setSort] = useState('date')
  const rows = [...items].sort((a, b) =>
    sort === 'stage' ? (STAGE_INDEX[a.stage] - STAGE_INDEX[b.stage]) :
    sort === 'brand' ? a.brand.localeCompare(b.brand) :
    (a.publish_date || '9999').localeCompare(b.publish_date || '9999'))
  return (
    <div className="c-card table-scroll" style={{ overflowX: 'auto' }}>
      <table className="s-table" style={{ minWidth: 820 }}>
        <thead><tr>
          <th onClick={() => setSort('date')} style={{ cursor: 'pointer' }}>Publish ↕</th>
          <th onClick={() => setSort('brand')} style={{ cursor: 'pointer' }}>Brand ↕</th>
          <th>Post</th><th>Format</th><th>Platforms</th>
          <th onClick={() => setSort('stage')} style={{ cursor: 'pointer' }}>Stage ↕</th>
          <th>Next action</th><th>Agent</th>
        </tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} className="c-empty">Nothing matches these filters.</td></tr>}
          {rows.map(i => {
            const ns = nextStep(i)
            return (
              <tr key={i.id} onClick={() => navigate(`/social/post/${i.id}`)}>
                <td style={{ whiteSpace: 'nowrap' }}>{i.publish_date ? fmtDate(i.publish_date) : <span className="c-muted">Unscheduled</span>}</td>
                <td><BrandChip brand={i.brand} /></td>
                <td style={{ fontWeight: 500 }}>{i.title}</td>
                <td>{FORMATS[i.format]?.label || '—'}</td>
                <td>{platformsLabel(i.platforms)}</td>
                <td><StageChip stage={i.stage} /></td>
                <td style={{ fontSize: 12 }}>{ns && i.stage !== 'idea' ? `${ns.label}${ns.due ? ` · ${fmtDate(ns.due, { month: 'short', day: 'numeric' })}` : ''}` : '—'}</td>
                <td>{i.agent_name || '—'}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
