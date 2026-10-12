import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '../../ceo/ceo.css'
import { live, useSocial } from '../../social/SocialStore.jsx'
import { MARKETS, FORMATS } from '../../social/constants.js'
import {
  CADENCES, TEMPLATES, apartmentPosts, autoAssign, campaignDates, campaignResults, filmingSessions, footageAssets,
  hasFootage, launchFlags, templatePosts,
} from '../../social/campaigns.js'
import { campaignCopy, reviewCampaign } from '../../social/ai.js'
import { priceLine, useLeasingListings } from '../../social/leasing.js'
import { BrandChip, SocialNav, SocialSetupNeeded, StageChip } from '../../social/ui.jsx'
import { AssetModal } from './Library.jsx'
import { toast } from '../../ceo/ui.jsx'
import { useVerifiedLeads } from '../../social/attribution.js'
import { postCode } from '../../social/tracking.js'
import { addDays, fmtDate, todayISO } from '../../ceo/recurrence.js'

export default function CampaignBuilder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { campaigns, items, assets, slots, updateCampaign, deleteCampaign, saveItem, updateItem, setupNeeded, loading } = useSocial()
  const c = campaigns.find(x => x.id === id)
  const posts = useMemo(() => live(items).filter(i => i.campaign_id === id).sort((a, b) => (a.publish_date || '').localeCompare(b.publish_date || '')), [items, id])

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  if (!c) return <div className="c-page"><div className="c-empty">{loading ? 'Loading…' : 'Campaign not found.'} <Link className="c-link" to="/social/campaigns">All campaigns</Link></div></div>

  const cfg = c.config || {}
  const template = cfg.template || (c.type === 'apartments' ? 'apartments' : 'custom')
  // Always merge onto the latest saved campaign so quick edits never overwrite each other
  const setCfg = patch => updateCampaign(c.id, {}, patch)
  const set = patch => updateCampaign(c.id, patch)
  const locked = c.status !== 'proposed'
  const end = c.start_date && c.duration_days ? addDays(c.start_date, c.duration_days - 1) : null

  async function pause() {
    const later = posts.filter(p => p.publish_date && p.publish_date > todayISO() && !['published', 'reviewed'].includes(p.stage))
    if (later.length && window.confirm(`Pause the campaign. Also take the ${later.length} upcoming post${later.length > 1 ? 's' : ''} off the calendar (they go back to ideas)?`)) {
      for (const p of later) await updateItem(p.id, { publish_date: null, stage: 'idea' })
    }
    await set({ status: 'paused' })
  }

  return (
    <div className="c-page">
      <div className="c-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="c-eyebrow">Social HQ · Campaign · {TEMPLATES[template]?.label}</div>
          <input className="c-title" defaultValue={c.name} key={c.id} onBlur={e => e.target.value.trim() && e.target.value !== c.name && set({ name: e.target.value.trim() })}
            style={{ border: 0, outline: 'none', width: '100%', background: 'transparent', padding: 0, fontFamily: 'var(--serif)' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <BrandChip brand={c.brand} />
            <span className={`c-chip${c.status === 'active' ? ' green' : c.status === 'proposed' ? ' warn' : ''}`}>{c.status}</span>
            {c.start_date && <span className="c-chip">{fmtDate(c.start_date)}{end ? ` → ${fmtDate(end)}` : ''}</span>}
          </div>
        </div>
        <div className="c-head-actions">
          <SocialNav />
          {c.status === 'active' && <button className="c-btn" onClick={pause}>Pause</button>}
          {c.status === 'paused' && <button className="c-btn" onClick={() => set({ status: 'active' })}>Resume</button>}
          {['active', 'paused'].includes(c.status) && <button className="c-btn c-btn-ghost" onClick={() => set({ status: 'done' })}>Mark done</button>}
          {c.status === 'proposed' && <button className="c-btn c-btn-danger c-btn-sm" onClick={() => { if (window.confirm(`Delete "${c.name}"? Posts already created stay as posts.`)) { deleteCampaign(c.id); navigate('/social/campaigns') } }}>Delete</button>}
        </div>
      </div>

      <div className="c-card" style={{ marginBottom: 20 }}>
        <div className="c-card-body c-row" style={{ alignItems: 'end' }}>
          <div className="c-field"><label className="s-field-label">Starts</label>
            <input className="c-input" type="date" disabled={locked} value={c.start_date || ''} onChange={e => set({ start_date: e.target.value || null })} /></div>
          <div className="c-field"><label className="s-field-label">Length (days)</label>
            <select className="c-select" disabled={locked} value={[7, 14, 30].includes(c.duration_days) ? c.duration_days : 'custom'}
              onChange={e => e.target.value !== 'custom' && set({ duration_days: Number(e.target.value) })}>
              <option value={7}>7-day pilot</option><option value={14}>14 days</option><option value={30}>30 days</option><option value="custom">Custom ({c.duration_days})</option>
            </select></div>
          {template === 'apartments' && (
            <div className="c-field"><label className="s-field-label">Cadence</label>
              <select className="c-select" disabled={locked} value={cfg.cadence || 'daily'} onChange={e => setCfg({ cadence: e.target.value })}>
                {Object.entries(CADENCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
          )}
          <div className="c-field" style={{ gridColumn: 'span 2' }}><label className="s-field-label">Goal</label>
            <input className="c-input" defaultValue={c.goal || ''} key={`g${c.id}`} onBlur={e => e.target.value !== (c.goal || '') && set({ goal: e.target.value || null })} placeholder="e.g. 20 rental inquiries" /></div>
          {locked && <div className="c-muted" style={{ fontSize: 12 }}>Dates are locked after launch — move individual posts on the planner.</div>}
        </div>
      </div>

      {template === 'apartments'
        ? <ApartmentCampaign c={c} cfg={cfg} setCfg={setCfg} set={set} posts={posts} assets={assets} slots={slots} saveItem={saveItem} updateCampaign={updateCampaign} />
        : <TemplateCampaign c={c} template={template} posts={posts} saveItem={saveItem} set={set} />}

      {posts.length > 0 && <Results c={c} posts={posts} cfg={cfg} setCfg={setCfg} />}
    </div>
  )
}

// ─── Apartment series ───────────────────────────────────────────────────────
function ApartmentCampaign({ c, cfg, setCfg, set, posts, assets, slots, saveItem, updateCampaign }) {
  const { listings, loading: listingsLoading } = useLeasingListings()
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(null)
  const [busy, setBusy] = useState('')
  const [assetFor, setAssetFor] = useState(null)
  const apartments = cfg.apartments || []
  const byKey = new Map(apartments.map(a => [a.key, a]))
  const postByRow = new Map(posts.map(p => [p.publish_date, p]))
  const filmedKeys = new Set(posts.filter(p => p.steps?.some(s => s.key === 'film' && s.done))
    .map(p => (cfg.schedule || []).find(r => r.item_id === p.id)?.aptKey).filter(Boolean))

  // Keep the schedule in step with start / length / cadence (until launch)
  const dates = useMemo(() => (c.start_date ? campaignDates(c.start_date, c.duration_days || 30, cfg.cadence || 'daily') : []),
    [c.start_date, c.duration_days, cfg.cadence])
  useEffect(() => {
    if (c.status !== 'proposed' || !dates.length) return
    const cur = cfg.schedule || []
    const same = cur.length === dates.length && cur.every((r, i) => r.date === dates[i])
    if (same) return
    const keep = cur.filter(r => r.aptKey || r.hook)
    const schedule = dates.map((d, i) => ({ key: d, date: d, ...(keep[i] ? { aptKey: keep[i].aptKey, hook: keep[i].hook, caption: keep[i].caption, on_screen_text: keep[i].on_screen_text, cta: keep[i].cta, notes: keep[i].notes } : {}) }))
    setCfg({ schedule })
  }, [dates]) // eslint-disable-line react-hooks/exhaustive-deps

  const schedule = cfg.schedule || []
  const assigned = schedule.filter(r => r.aptKey)
  const withFootage = apartments.filter(a => assigned.some(r => r.aptKey === a.key) && hasFootage(a, assets)).length
  const toFilm = new Set(assigned.filter(r => !hasFootage(byKey.get(r.aptKey) || {}, assets) && !filmedKeys.has(r.aptKey)).map(r => r.aptKey)).size
  const sessions = filmingSessions(schedule, apartments, assets, slots, filmedKeys)
  const flags = launchFlags(cfg, assets)

  const saveApts = list => setCfg({ apartments: list })
  const setCfgFn = fn => updateCampaign(c.id, {}, fn)   // fn(latestConfig) → patch
  const importListings = () => {
    const have = new Set(apartments.map(a => a.listing_id).filter(Boolean))
    const fresh = listings.filter(l => !have.has(l.id)).map(l => ({
      key: `l:${l.id}`, listing_id: l.id, source: 'listing', name: l.display_name, market: l.marketName, area: l.location || l.area,
      special: l.special || null, prices: priceLine(l), amenities: l.amenities || [], video_url: l.video_url || null,
      is_hot_deal: !!l.is_hot_deal, verified: false,
    }))
    saveApts([...apartments, ...fresh])
    toast(`${fresh.length} apartment${fresh.length === 1 ? '' : 's'} imported`, 'From your RLC Leasing site')
  }
  const updateApt = (key, patch) => setCfgFn(cur => ({ apartments: (cur.apartments || []).map(a => (a.key === key ? { ...a, ...patch } : a)) }))
  const removeApt = key => { setCfg({ apartments: apartments.filter(a => a.key !== key), schedule: schedule.map(r => (r.aptKey === key && !r.item_id ? { ...r, aptKey: null } : r)) }) }
  const setRow = (key, patch) => setCfgFn(cur => ({ schedule: (cur.schedule || []).map(r => (r.key === key ? { ...r, ...patch } : r)) }))

  async function writeCopy() {
    const rows = schedule.filter(r => r.aptKey && !r.item_id && !r.hook).map(r => ({ key: r.key, date: r.date, apt: byKey.get(r.aptKey) }))
    if (!rows.length) { toast('Nothing to write', 'Every assigned post already has a hook.'); return }
    setBusy('copy')
    try {
      const out = await campaignCopy(rows, c.name)
      const map = new Map(out.map(o => [o.key, o]))
      setCfg({ schedule: schedule.map(r => (map.has(r.key) ? { ...r, ...pickCopy(map.get(r.key)) } : r)) })
      toast(`Copy written for ${map.size} post${map.size === 1 ? '' : 's'}`, 'Review each one before launch.')
    } catch (e) { toast('Could not write copy', e.message) }
    setBusy('')
  }

  async function launch() {
    if (!window.confirm(`Launch "${c.name}"? This creates ${schedule.filter(r => r.aptKey && !r.item_id).length} posts on your plan with their filming/editing steps. Your personal and RLC accounts keep their normal rhythm.`)) return
    setBusy('launch')
    const created = []
    const filmDates = new Map(sessions.flatMap(s => s.apartments.map(a => [a.key, s.date])))
    for (const { rowKey, item } of apartmentPosts({ ...c, config: cfg }, assets, filmDates)) {
      const row = await saveItem(item)
      created.push([rowKey, row.id])
    }
    const ids = new Map(created)
    await set({ status: 'active', config: { ...cfg, schedule: schedule.map(r => (ids.has(r.key) ? { ...r, item_id: ids.get(r.key) } : r)), launched_at: new Date().toISOString() } })
    setBusy('')
    toast('Campaign launched', `${created.length} posts added — filming sessions are on your Film days.`)
  }

  return (
    <div className="c-stack">
      <div className="c-stats">
        <Stat value={schedule.length} label="Posting days" />
        <Stat value={`${assigned.length}/${schedule.length}`} label="Apartments assigned" warn={assigned.length < schedule.length} />
        <Stat value={withFootage} label="Already have footage" />
        <Stat value={toFilm} label="Tours to film" warn={toFilm > 0} />
      </div>

      <div className="c-grid">
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Schedule</div>
              {c.status === 'proposed' && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button className="c-btn c-btn-sm" disabled={!apartments.length} onClick={() => setCfg({ schedule: autoAssign(schedule, apartments, assets) })}>Auto-fill</button>
                <button className="c-btn c-btn-sm c-btn-sky" disabled={busy || !assigned.length} onClick={writeCopy}>{busy === 'copy' ? 'Writing… (1–2 min)' : 'Write hooks & captions'}</button>
              </div>}
            </div>
            {!c.start_date && <div className="c-empty">Pick a start date above.</div>}
            {schedule.map((r, n) => {
              const apt = byKey.get(r.aptKey)
              const post = r.item_id ? posts.find(p => p.id === r.item_id) : postByRow.get(r.date)
              const isOpen = open === r.key
              return (
                <div key={r.key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="c-tl-row" style={{ gridTemplateColumns: '34px 92px 1fr auto', cursor: 'default' }}>
                    <span className="c-muted" style={{ fontSize: 11 }}>{n + 1}</span>
                    <span className="c-tl-time">{fmtDate(r.date)}</span>
                    {c.status === 'proposed' && !r.item_id ? (
                      <select className="c-select" style={{ padding: '5px 8px', fontSize: 13 }} value={r.aptKey || ''} onChange={e => setRow(r.key, { aptKey: e.target.value || null })}>
                        <option value="">— choose apartment —</option>
                        {apartments.map(a => <option key={a.key} value={a.key}>{a.name} · {a.market}{hasFootage(a, assets) ? ' · footage ✓' : ''}</option>)}
                      </select>
                    ) : <span style={{ fontSize: 14 }}>{apt?.name || '—'} <span className="c-muted" style={{ fontSize: 12 }}>· {apt?.market}</span></span>}
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      {post ? <Link to={`/social/post/${post.id}`}><StageChip stage={post.stage} /></Link>
                        : apt ? <span className={`c-chip${hasFootage(apt, assets) ? ' green' : ' warn'}`}>{hasFootage(apt, assets) ? 'Footage' : 'Film'}</span> : null}
                      {r.hook && <span className="c-chip sky">Copy ✓</span>}
                      {apt && !r.item_id && <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => setOpen(isOpen ? null : r.key)}>{isOpen ? 'Close' : 'Copy'}</button>}
                    </span>
                  </div>
                  {isOpen && !r.item_id && (
                    <div style={{ padding: '0 20px 14px 146px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {[['hook', 'Hook', 2], ['on_screen_text', 'On-screen text', 2], ['caption', 'Caption', 4], ['cta', 'CTA', 1]].map(([k, l, rows]) => (
                        <div key={k} className="c-field"><label className="s-field-label">{l}</label>
                          <textarea className="c-textarea" rows={rows} style={{ minHeight: rows * 22 }} defaultValue={r[k] || ''} onBlur={e => e.target.value !== (r[k] || '') && setRow(r.key, { [k]: e.target.value || null })} /></div>
                      ))}
                      {r.notes && <div className="c-muted" style={{ fontSize: 12 }}>Verify / film: {r.notes}</div>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {c.status === 'proposed' && (
            <div className="c-card">
              <div className="c-card-head"><div className="c-card-title">Before launch</div></div>
              <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {flags.length === 0 && <div style={{ fontSize: 14, color: 'var(--green)' }}>Everything checks out.</div>}
                {flags.map((f, i) => <div key={i} className={`c-chip${f.tone ? ` ${f.tone}` : ''}`} style={{ whiteSpace: 'normal', textTransform: 'none', letterSpacing: 0, fontSize: 13, fontWeight: 400, padding: '8px 10px' }}>{f.text}</div>)}
                <button className="c-btn c-btn-ink" style={{ alignSelf: 'flex-start', marginTop: 6 }} disabled={busy || !assigned.length} onClick={launch}>
                  {busy === 'launch' ? 'Launching…' : `Launch — create ${schedule.filter(r => r.aptKey && !r.item_id).length} posts`}
                </button>
                <div className="c-muted" style={{ fontSize: 12 }}>You can launch with gaps — empty days simply stay empty.</div>
              </div>
            </div>
          )}
        </div>

        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Apartments ({apartments.length})</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="c-btn c-btn-sm" disabled={listingsLoading} onClick={importListings}>Import from leasing site ({listings.length})</button>
                <button className="c-btn c-btn-sm c-btn-sky" onClick={() => setAdding(true)}>+ Add</button>
              </div>
            </div>
            {adding && <AddApartment onCancel={() => setAdding(false)} onAdd={a => { saveApts([...apartments, a]); setAdding(false) }} />}
            {apartments.length === 0 && !adding && <div className="c-empty">Import your active listings, then add any apartments you want to feature that aren&apos;t on the site yet (e.g. Denver).</div>}
            {apartments.map(a => {
              const foot = hasFootage(a, assets) || filmedKeys.has(a.key)
              const linked = footageAssets(a, assets)
              return (
                <div key={a.key} className="c-task" style={{ gridTemplateColumns: '1fr auto' }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="c-task-title" style={{ fontWeight: 500 }}>{a.name}</div>
                    <div className="c-muted" style={{ fontSize: 12, marginTop: 2 }}>{[a.market, a.area, a.prices].filter(Boolean).join(' · ')}</div>
                    {a.special && <div style={{ fontSize: 12, marginTop: 2, color: 'var(--sky-deep)' }}>Special: {a.special}</div>}
                    <div className="c-task-meta">
                      <span className={`c-chip${foot ? ' green' : ' warn'}`}>{foot ? 'Footage on hand' : 'Needs filming'}</span>
                      {linked.length > 0 && <span className="c-chip">{linked.length} in library</span>}
                      {a.source === 'listing' && <span className="c-chip">Leasing site</span>}
                      <label className="c-check-row" style={{ fontSize: 11 }}><input type="checkbox" checked={!!a.verified} onChange={e => updateApt(a.key, { verified: e.target.checked })} /> Pricing verified</label>
                      <label className="c-check-row" style={{ fontSize: 11 }}><input type="checkbox" checked={a.footage === 'have'} onChange={e => updateApt(a.key, { footage: e.target.checked ? 'have' : null })} /> Have footage</label>
                    </div>
                  </div>
                  <div className="c-task-actions" style={{ flexDirection: 'column' }}>
                    <button className="c-btn c-btn-sm" onClick={() => setAssetFor(a)}>+ Footage link</button>
                    {!(cfg.schedule || []).some(r => r.aptKey === a.key && r.item_id) && <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => removeApt(a.key)}>Remove</button>}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Filming plan</div><span className="c-muted" style={{ fontSize: 12 }}>Batch by market on Film days</span></div>
            {sessions.length === 0 && <div className="c-empty">{assigned.length ? 'Nothing left to film.' : 'Assign apartments to see the filming plan.'}</div>}
            {sessions.map(s => {
              const editDay = slots.edit.find(d => d > s.date) || nextWeekday(s.date)
              const clash = sessions.some(o => o !== s && o.date === s.date && o.market !== s.market)
              return (
                <div key={s.date + s.market} className="c-tl-row" style={{ gridTemplateColumns: '1fr', cursor: 'default' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>{fmtDate(s.date)} · film {s.apartments.length} in {s.market}{s.late ? ' (late — film ASAP)' : ''}</div>
                    <div className="c-muted" style={{ fontSize: 12, marginTop: 3 }}>{s.apartments.map(a => a.name).join(', ')}</div>
                    <div className="c-muted" style={{ fontSize: 12 }}>Edit the batch {fmtDate(editDay)}</div>
                    {clash && <div style={{ fontSize: 12, color: '#b45309', marginTop: 3 }}>Miami and Denver are both on this day — film whichever city you&apos;re in and push the other to your next Film day there.</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      {assetFor && <AssetModal asset={{}} defaults={{ kind: 'property_video', property: assetFor.name, market: assetFor.market === 'Other' ? null : assetFor.market, brand: 'leasing', campaign_id: c.id, label: `${assetFor.name} — tour` }} onClose={() => setAssetFor(null)} />}
    </div>
  )
}

const nextWeekday = d => { let x = addDays(d, 1); while ([0, 6].includes(new Date(x + 'T00:00:00').getDay())) x = addDays(x, 1); return x }

const pickCopy = o => ({ hook: o.hook || null, caption: o.caption || null, on_screen_text: o.on_screen_text || null, cta: o.cta || null, notes: o.notes || null })

function Stat({ value, label, warn }) {
  return <div className="c-stat" style={warn ? { borderTop: '3px solid #f59e0b' } : undefined}><div className="c-stat-val">{value}</div><div className="c-stat-lbl">{label}</div></div>
}

function AddApartment({ onAdd, onCancel }) {
  const [a, setA] = useState({ name: '', market: 'Denver', area: '', prices: '', special: '', notes: '' })
  const set = p => setA(prev => ({ ...prev, ...p }))
  return (
    <form className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, background: 'var(--mist)', borderBottom: '1px solid var(--border)' }}
      onSubmit={e => { e.preventDefault(); if (!a.name.trim()) return; onAdd({ ...a, name: a.name.trim(), key: `m:${Math.random().toString(36).slice(2, 9)}`, source: 'manual', verified: false }) }}>
      <div className="c-row">
        <input className="c-input" autoFocus placeholder="Public name (e.g. Denver 3)" value={a.name} onChange={e => set({ name: e.target.value })} />
        <select className="c-select" value={a.market} onChange={e => set({ market: e.target.value })}>{MARKETS.map(m => <option key={m}>{m}</option>)}</select>
        <input className="c-input" placeholder="Neighborhood" value={a.area} onChange={e => set({ area: e.target.value })} />
      </div>
      <div className="c-row">
        <input className="c-input" placeholder="Pricing (e.g. 1BD from $1,850)" value={a.prices} onChange={e => set({ prices: e.target.value })} />
        <input className="c-input" placeholder="Special (optional)" value={a.special} onChange={e => set({ special: e.target.value })} />
      </div>
      <input className="c-input" placeholder="Notes — standout features, what to film" value={a.notes} onChange={e => set({ notes: e.target.value })} />
      <div style={{ display: 'flex', gap: 8 }}><button className="c-btn c-btn-ink c-btn-sm">Add apartment</button><button type="button" className="c-btn c-btn-ghost c-btn-sm" onClick={onCancel}>Cancel</button></div>
    </form>
  )
}

// ─── Template campaigns (listing launch, announcement, seasonal, custom) ────
function TemplateCampaign({ c, template, posts, saveItem, set }) {
  const [busy, setBusy] = useState(false)
  const preview = templatePosts(c)
  async function launch() {
    setBusy(true)
    for (const p of preview) await saveItem(p)
    await set({ status: 'active' })
    setBusy(false)
    toast('Campaign launched', `${preview.length} posts added with their prep steps.`)
  }
  return (
    <div className="c-card" style={{ marginBottom: 20 }}>
      <div className="c-card-head"><div className="c-card-title">{c.status === 'proposed' ? 'Posts this will create' : 'Posts'}</div></div>
      {c.status === 'proposed' && preview.length > 0 && (<>
        {preview.map((p, i) => (
          <div key={i} className="c-tl-row" style={{ gridTemplateColumns: '92px 1fr auto', cursor: 'default' }}>
            <span className="c-tl-time">{fmtDate(p.publish_date)}</span><span style={{ fontSize: 14 }}>{p.title}</span><span className="c-chip">{FORMATS[p.format]?.label}</span>
          </div>
        ))}
        <div className="c-card-body"><button className="c-btn c-btn-ink" disabled={busy} onClick={launch}>{busy ? 'Launching…' : `Launch — create ${preview.length} posts`}</button></div>
      </>)}
      {c.status === 'proposed' && preview.length === 0 && <div className="c-empty">Custom campaign — attach posts from each post&apos;s workspace (Details → Campaign), then press <button className="c-link" style={{ background: 'none', border: 0, cursor: 'pointer' }} onClick={() => set({ status: 'active' })}>start campaign</button>.</div>}
      {c.status !== 'proposed' && posts.map(p => (
        <Link key={p.id} to={`/social/post/${p.id}`} className="c-tl-row" style={{ gridTemplateColumns: '92px 1fr auto', textDecoration: 'none', color: 'inherit' }}>
          <span className="c-tl-time">{p.publish_date ? fmtDate(p.publish_date) : '—'}</span><span style={{ fontSize: 14 }}>{p.title}</span><StageChip stage={p.stage} />
        </Link>
      ))}
    </div>
  )
}

// ─── Results + AI review ─────────────────────────────────────────────────────
function Results({ c, posts, cfg, setCfg }) {
  const [busy, setBusy] = useState(false)
  const r = campaignResults(posts)
  const review = cfg.review
  const verified = useVerifiedLeads()
  const verifiedCount = posts.reduce((s, p) => s + (verified.byCode.get(postCode(p)) || []).length, 0)
  async function runReview() {
    setBusy(true)
    try {
      const out = await reviewCampaign({
        campaign: c.name, goal: c.goal, start: c.start_date, days: c.duration_days, today: todayISO(),
        posts: posts.map(p => ({ title: p.title, date: p.publish_date, stage: p.stage, hook: p.hook, metrics: p.metrics })),
        totals: r.totals, posted: r.posted, with_data: r.withData, verified_leads_from_tracking_links: verifiedCount,
      })
      setCfg({ review: { ...out, at: new Date().toISOString() } })
    } catch (e) { toast('Review failed', e.message) }
    setBusy(false)
  }
  const T = r.totals
  return (
    <div className="c-card" style={{ marginTop: 20 }}>
      <div className="c-card-head">
        <div className="c-card-title">Results</div>
        <button className="c-btn c-btn-sm c-btn-sky" disabled={busy || r.withData === 0} title={r.withData ? '' : 'Log views/leads on a few posts first'} onClick={runReview}>{busy ? 'Reviewing…' : 'Should I continue?'}</button>
      </div>
      <div className="c-card-body">
        <div className="c-stats">
          <Stat value={`${r.posted}/${r.total}`} label="Posted" />
          <Stat value={T.views} label="Views" />
          <Stat value={T.saves + T.shares} label="Saves + shares" />
          <Stat value={verified.connected ? verifiedCount : '—'} label="Verified leads · tracking links" />
          <Stat value={T.inquiries + T.rental_leads} label="Inquiries + rental leads (logged)" />
        </div>
        <div className="c-muted" style={{ fontSize: 12, marginTop: 10 }}>Logged numbers come from each post&apos;s Results section ({r.withData} with data); verified leads come from your CRM via each post&apos;s tracking link.</div>
        {review && (
          <div className="c-banner sky" style={{ display: 'block', marginTop: 14 }}>
            <div className="c-label" style={{ marginBottom: 6 }}>Recommendation · {review.verdict?.toUpperCase()} · {new Date(review.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
            <div style={{ fontSize: 14, lineHeight: 1.55 }}>{review.summary}</div>
            {review.changes?.length > 0 && <ul style={{ margin: '8px 0 0 18px', fontSize: 13 }}>{review.changes.map((x, i) => <li key={i}>{x}</li>)}</ul>}
            {review.best && <div style={{ fontSize: 13, marginTop: 8 }}><strong>Best:</strong> {review.best}</div>}
            {review.worst && <div style={{ fontSize: 13, marginTop: 4 }}><strong>Weakest:</strong> {review.worst}</div>}
          </div>
        )}
      </div>
    </div>
  )
}
