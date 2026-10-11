import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import '../../ceo/ceo.css'
import { useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, EFFORT_LABEL, FORMATS, OBJECTIVES, PLATFORMS, PRIORITIES, STAGES } from '../../social/constants.js'
import { nextStep } from '../../social/schedule.js'
import { BrandChip, DueChip, SocialNav, SocialSetupNeeded, StageChip } from '../../social/ui.jsx'
import { usePortalAgents } from '../../social/portalData.js'
import { Checklist, Progress, Tick, toast } from '../../ceo/ui.jsx'
import { fmtDate } from '../../ceo/recurrence.js'

const VERSION_STATUSES = ['draft', 'ready', 'scheduled', 'published']
const METRICS = [
  ['views', 'Views'], ['reach', 'Reach'], ['likes', 'Likes'], ['comments', 'Comments'], ['saves', 'Saves'], ['shares', 'Shares'],
  ['profile_visits', 'Profile visits'], ['link_clicks', 'Link clicks'], ['inquiries', 'Inquiries'],
  ['buyer_leads', 'Buyer leads'], ['seller_leads', 'Seller leads'], ['rental_leads', 'Rental leads'],
  ['recruit_leads', 'Recruiting inquiries'], ['appointments', 'Appointments'], ['conversions', 'Conversions'],
]

/** Text field that saves when you leave it (and on page exit) */
function Field({ label, value, onSave, rows, placeholder, type = 'text' }) {
  const [v, setV] = useState(value ?? '')
  const pending = useRef(false)
  const saveRef = useRef(onSave)
  saveRef.current = onSave
  useEffect(() => { if (!pending.current) setV(value ?? '') }, [value])
  useEffect(() => () => { if (pending.current) saveRef.current(vRef.current) }, [])
  const vRef = useRef(v); vRef.current = v
  const commit = () => { if (pending.current) { pending.current = false; onSave(v === '' ? null : v) } }
  const props = {
    className: rows ? 'c-textarea' : 'c-input', value: v, placeholder,
    onChange: e => { pending.current = true; setV(e.target.value) }, onBlur: commit,
  }
  return (
    <div className="c-field">
      {label && <label className="s-field-label">{label}</label>}
      {rows ? <textarea {...props} rows={rows} style={{ minHeight: rows * 22 }} /> : <input {...props} type={type} />}
    </div>
  )
}

export default function PostWorkspace() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { items, campaigns, updateItem, toggleStep, setStepDate, duplicate, deleteItem, setupNeeded, loading } = useSocial()
  const { agents } = usePortalAgents()
  const item = items.find(i => i.id === id)
  const [openSteps, setOpenSteps] = useState({})

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  if (!item) return <div className="c-page"><div className="c-empty">{loading ? 'Loading…' : 'Post not found.'} <Link className="c-link" to="/social">Back to Social HQ</Link></div></div>

  const set = patch => updateItem(item.id, patch)
  const b = BRANDS[item.brand] || BRANDS.personal
  const ns = nextStep(item)
  const doneCount = (item.steps || []).filter(s => s.done).length
  const versions = item.versions || {}
  const metrics = item.metrics || {}
  const needsPermission = ['transaction_story', 'recap_carousel', 'agent_spotlight'].includes(item.format) || item.brand === 'rlc'

  return (
    <div className="c-page">
      <div className="c-head">
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="c-eyebrow">Social HQ · Post workspace</div>
          <input className="c-title" defaultValue={item.title} key={item.id}
            onBlur={e => e.target.value.trim() && e.target.value !== item.title && set({ title: e.target.value.trim() })}
            style={{ border: 0, outline: 'none', width: '100%', background: 'transparent', padding: 0, fontFamily: 'var(--serif)' }} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <BrandChip brand={item.brand} />
            <StageChip stage={item.stage} />
            {item.format && <span className="c-chip">{FORMATS[item.format]?.label}</span>}
            {item.publish_date && <span className="c-chip ink">Publishes {fmtDate(item.publish_date)}{item.publish_time ? ` · ${item.publish_time}` : ''}</span>}
            {item.is_backlog && <span className="c-chip warn">Backlog</span>}
            <span className={`c-chip${item.approval === 'approved' ? ' green' : item.approval === 'needs_review' ? ' warn' : ''}`}>
              {item.approval === 'needs_review' ? 'Needs review' : item.approval === 'approved' ? 'Approved' : 'Draft'}
            </span>
          </div>
        </div>
        <div className="c-head-actions">
          <SocialNav />
        </div>
      </div>

      {ns && ns.due && item.stage !== 'idea' && (
        <div className="c-banner sky" style={{ marginBottom: 18 }}>
          <div>
            <div className="c-label">Next action · {ns.due < new Date().toISOString().slice(0, 10) ? 'overdue' : fmtDate(ns.due)}</div>
            <div className="c-serif" style={{ fontSize: 20, margin: '4px 0' }}>{ns.label}</div>
            <div style={{ fontSize: 13, color: 'var(--mid)' }}>{ns.items.filter(x => !x.done).slice(0, 3).map(x => x.text).join(' · ')}</div>
          </div>
          <button className="c-btn c-btn-ink c-btn-sm" onClick={() => toggleStep(item.id, ns.key)}>Mark step done</button>
        </div>
      )}
      {item.stage === 'idea' && (
        <div className="c-banner" style={{ marginBottom: 18 }}>
          This is still an idea. Pick a format and a publish date to turn it into a plan — the production checklist and prep dates fill in automatically.
        </div>
      )}

      <div className="s-two">
        {/* ── Left: production + creative ── */}
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Production</div>
              {item.steps?.length > 0 && <span className="c-label">{doneCount}/{item.steps.length} steps</span>}
            </div>
            {!item.format && <div className="c-empty">Choose a format (right) to generate the production checklist.</div>}
            {item.steps?.length > 0 && (
              <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Progress value={doneCount / item.steps.length} />
                {item.steps.map(s => {
                  const open = openSteps[s.key] ?? (ns?.key === s.key)
                  const itemsDone = s.items.filter(x => x.done).length
                  return (
                    <div key={s.key} className={`s-step${s.done ? ' done' : ''}${ns?.key === s.key ? ' next' : ''}`}>
                      <div className="s-step-head" onClick={() => setOpenSteps(o => ({ ...o, [s.key]: !open }))}>
                        <button className={`c-check${s.done ? ' done' : ''}`} style={{ padding: 0, border: 0 }} aria-label="Step done"
                          onClick={e => { e.stopPropagation(); toggleStep(item.id, s.key) }}>
                          <span className="c-box">{s.done && <Tick />}</span>
                        </button>
                        <div>
                          <div className="s-step-label" style={{ fontSize: 14 }}>{s.label}</div>
                          <div className="c-muted" style={{ fontSize: 11 }}>{itemsDone}/{s.items.length}{s.fixed ? ' · date pinned' : ''}</div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={e => e.stopPropagation()}>
                          <DueChip due={s.due} done={s.done} />
                          <input type="date" className="c-input" style={{ width: 140, padding: '5px 8px', fontSize: 12 }} value={s.due || ''}
                            onChange={e => setStepDate(item.id, s.key, e.target.value || null)} title="Change this step's date" />
                        </div>
                      </div>
                      {open && (
                        <div className="s-step-items">
                          <Checklist items={s.items} checked={s.items.filter(x => x.done).map(x => x.id)} onToggle={xid => toggleStep(item.id, s.key, xid)} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Creative</div><span className="c-muted" style={{ fontSize: 12 }}>AI drafts arrive in Phase 2</span></div>
            <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Hook" value={item.hook} onSave={v => set({ hook: v })} rows={2} placeholder="First line / first 2 seconds" />
              <Field label="Script" value={item.script} onSave={v => set({ script: v })} rows={8} />
              <Field label="Caption" value={item.caption} onSave={v => set({ caption: v })} rows={5} />
              <div className="c-row">
                <Field label="CTA" value={item.cta} onSave={v => set({ cta: v })} />
                <Field label="Hashtags" value={item.hashtags} onSave={v => set({ hashtags: v })} />
              </div>
              <Field label="On-screen text" value={item.on_screen_text} onSave={v => set({ on_screen_text: v })} rows={3} />
              <Field label="Shot list" value={item.shot_list} onSave={v => set({ shot_list: v })} rows={5} placeholder="One shot per line" />
              <Field label="Editing instructions" value={item.edit_notes} onSave={v => set({ edit_notes: v })} rows={3} />
              <Field label="Cover / thumbnail concept" value={item.cover_concept} onSave={v => set({ cover_concept: v })} rows={2} />
              <Field label="Notes" value={item.notes} onSave={v => set({ notes: v })} rows={4} />
            </div>
          </div>
        </div>

        {/* ── Right: details ── */}
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Details</div></div>
            <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="c-row">
                <div className="c-field"><label className="s-field-label">Brand</label>
                  <select className="c-select" value={item.brand} onChange={e => set({ brand: e.target.value, pillar: null })}>
                    {Object.entries(BRANDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
                <div className="c-field"><label className="s-field-label">Format</label>
                  <select className="c-select" value={item.format || ''} onChange={e => {
                    if (doneCount && !window.confirm('Change format? Steps with the same name keep their progress; the rest are replaced.')) return
                    set({ format: e.target.value || null })
                  }}>
                    <option value="">Choose…</option>
                    {Object.entries(FORMATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select></div>
              </div>
              <div className="c-field"><label className="s-field-label">Platforms</label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(PLATFORMS).map(([k, l]) => {
                    const on = item.platforms?.includes(k)
                    return <button key={k} className={`c-chip${on ? ' on' : ''}`}
                      onClick={() => set({ platforms: on ? item.platforms.filter(p => p !== k) : [...(item.platforms || []), k] })}>{l}</button>
                  })}
                </div></div>
              <div className="c-row">
                <div className="c-field"><label className="s-field-label">Publish date</label>
                  <input className="c-input" type="date" value={item.publish_date || ''} onChange={e => {
                    set({ publish_date: e.target.value || null })
                    if (e.target.value) toast('Rescheduled', 'Prep dates moved to match.')
                  }} /></div>
                <div className="c-field"><label className="s-field-label">Time</label>
                  <input className="c-input" type="time" step="300" value={item.publish_time || ''} onChange={e => set({ publish_time: e.target.value || null })} /></div>
              </div>
              <div className="c-row">
                <div className="c-field"><label className="s-field-label">Stage</label>
                  <select className="c-select" value={item.stage} onChange={e => set({ stage: e.target.value })}>
                    {STAGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select></div>
                <div className="c-field"><label className="s-field-label">Priority</label>
                  <select className="c-select" value={item.priority} onChange={e => set({ priority: e.target.value })}>
                    {PRIORITIES.map(p => <option key={p}>{p}</option>)}
                  </select></div>
              </div>
              <div className="c-row">
                <div className="c-field"><label className="s-field-label">Pillar</label>
                  <select className="c-select" value={item.pillar || ''} onChange={e => set({ pillar: e.target.value || null })}>
                    <option value="">—</option>{b.pillars.map(p => <option key={p}>{p}</option>)}
                  </select></div>
                <div className="c-field"><label className="s-field-label">Objective</label>
                  <select className="c-select" value={item.objective || ''} onChange={e => set({ objective: e.target.value || null })}>
                    <option value="">—</option>{OBJECTIVES.map(o => <option key={o}>{o}</option>)}
                  </select></div>
              </div>
              <div className="c-field"><label className="s-field-label">Campaign</label>
                <select className="c-select" value={item.campaign_id || ''} onChange={e => set({ campaign_id: e.target.value || null })}>
                  <option value="">None</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}{c.status === 'proposed' ? ' (proposed)' : ''}</option>)}
                </select></div>
              <div className="c-row">
                <div className="c-field"><label className="s-field-label">Agent</label>
                  <input className="c-input" list="agent-list" defaultValue={item.agent_name || ''} key={`a${item.id}`}
                    onBlur={e => {
                      const v = e.target.value.trim()
                      if (v === (item.agent_name || '')) return
                      const match = agents.find(a => a.full_name === v || a.preferred_name === v)
                      set({ agent_name: v || null, agent_ref: match?.id || null })
                    }} placeholder={agents.length ? 'Pick or type' : 'Agent name'} />
                  <datalist id="agent-list">{agents.map(a => <option key={a.id} value={a.preferred_name || a.full_name} />)}</datalist>
                </div>
                <Field label="Collab with" value={(item.collab_with || []).join(', ')}
                  onSave={v => set({ collab_with: v ? v.split(',').map(s => s.trim()).filter(Boolean) : null })} placeholder="@handle, @handle" />
              </div>
            </div>
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Planning</div></div>
            <div className="c-card-body c-row">
              <Select label="Timeliness" value={item.timeliness} options={['timely', 'evergreen', 'expiring']} onChange={v => set({ timeliness: v })} />
              <Select label="Lead potential" value={item.lead_potential} options={['low', 'medium', 'high']} onChange={v => set({ lead_potential: v })} />
              <Select label="Effort" value={item.effort} options={Object.keys(EFFORT_LABEL)} onChange={v => set({ effort: v })} />
              <label className="c-check-row" style={{ alignSelf: 'end', paddingBottom: 10 }}>
                <input type="checkbox" checked={!!item.is_backlog} onChange={e => set({ is_backlog: e.target.checked })} /> Backlog / catch-up
              </label>
            </div>
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Approval</div></div>
            <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="c-seg" style={{ alignSelf: 'flex-start' }}>
                {[['draft', 'Draft'], ['needs_review', 'Needs review'], ['approved', 'Approved']].map(([k, l]) => (
                  <button key={k} className={item.approval === k ? 'on' : ''} onClick={() => set({ approval: k })}>{l}</button>
                ))}
              </div>
              {needsPermission && (
                <label className="c-check-row">
                  <input type="checkbox" checked={!!item.permission_confirmed} onChange={e => set({ permission_confirmed: e.target.checked })} />
                  Client / agent permission confirmed — no confidential details
                </label>
              )}
              {needsPermission && !item.permission_confirmed && item.approval === 'approved' && (
                <div className="c-banner" style={{ fontSize: 12 }}>Approved, but permission isn&apos;t confirmed yet.</div>
              )}
            </div>
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Platforms</div><span className="c-muted" style={{ fontSize: 12 }}>Manual publishing</span></div>
            {(item.platforms || []).length === 0 && <div className="c-empty">Pick at least one platform above.</div>}
            {(item.platforms || []).map(p => {
              const v = versions[p] || {}
              const setV = patch => set({ versions: { ...versions, [p]: { ...v, ...patch } } })
              return (
                <div key={p} style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <strong style={{ fontSize: 13 }}>{PLATFORMS[p] || p}</strong>
                    <select className="c-select" style={{ width: 130, padding: '5px 8px', fontSize: 12 }} value={v.status || 'draft'}
                      onChange={e => setV({ status: e.target.value, ...(e.target.value === 'published' && !v.published_at ? { published_at: new Date().toISOString().slice(0, 10) } : {}) })}>
                      {VERSION_STATUSES.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="c-btn c-btn-sm" onClick={() => { navigator.clipboard.writeText([v.caption || item.caption, item.hashtags].filter(Boolean).join('\n\n')); toast('Caption copied', PLATFORMS[p]) }}>Copy caption</button>
                    {v.url && <a className="c-btn c-btn-sm c-btn-ghost" href={v.url} target="_blank" rel="noreferrer">Open post ↗</a>}
                  </div>
                  <Field value={v.caption} onSave={val => setV({ caption: val })} rows={2} placeholder={`${PLATFORMS[p]} caption (blank = main caption)`} />
                  <Field value={v.url} onSave={val => setV({ url: val })} placeholder="Live link after publishing" />
                </div>
              )
            })}
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Assets</div><span className="c-muted" style={{ fontSize: 12 }}>iCloud / Drive links</span></div>
            <Assets item={item} set={set} />
          </div>

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Results</div>
              <select className="c-select" style={{ width: 150, padding: '4px 8px', fontSize: 12 }} value={metrics.source || 'manual'}
                onChange={e => set({ metrics: { ...metrics, source: e.target.value } })}>
                <option value="manual">Entered by hand</option><option value="estimated">Estimated</option><option value="verified">Verified (tracked link / form)</option>
              </select>
            </div>
            <div className="c-card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {METRICS.map(([k, l]) => (
                <div key={k} className="c-field">
                  <label className="s-field-label" style={{ fontSize: 9 }}>{l}</label>
                  <input className="c-input" type="number" min="0" style={{ padding: '6px 8px' }} defaultValue={metrics[k] ?? ''} key={`${item.id}${k}`}
                    onBlur={e => { const n = e.target.value === '' ? null : Number(e.target.value); if (n !== (metrics[k] ?? null)) set({ metrics: { ...metrics, [k]: n } }) }} />
                </div>
              ))}
            </div>
          </div>

          <div className="c-card">
            <div className="c-card-body" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="c-btn c-btn-sm" onClick={async () => { const c = await duplicate(item.id); if (c) navigate(`/social/post/${c.id}`) }}>Duplicate</button>
              <select className="c-select" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }} value="" onChange={async e => {
                const brand = e.target.value; if (!brand) return
                const c = await duplicate(item.id, { brand, title: `${item.title} — for ${BRANDS[brand].short}`, pillar: null })
                if (c) navigate(`/social/post/${c.id}`)
              }}>
                <option value="">Repurpose for…</option>
                {Object.entries(BRANDS).filter(([k]) => k !== item.brand).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
              <button className="c-btn c-btn-sm c-btn-ghost" onClick={() => { set({ archived: !item.archived }); toast(item.archived ? 'Restored' : 'Archived', item.title) }}>
                {item.archived ? 'Restore' : 'Archive'}
              </button>
              <button className="c-btn c-btn-sm c-btn-danger" onClick={() => { if (window.confirm(`Delete "${item.title}"?`)) { deleteItem(item.id); navigate('/social') } }}>Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }) {
  return (
    <div className="c-field"><label className="s-field-label">{label}</label>
      <select className="c-select" value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">—</option>{options.map(o => <option key={o}>{o}</option>)}
      </select></div>
  )
}

function Assets({ item, set }) {
  const [label, setLabel] = useState('')
  const [url, setUrl] = useState('')
  const assets = item.assets || []
  return (
    <div>
      {assets.map((a, i) => (
        <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
          <a className="c-link" href={a.url} target="_blank" rel="noreferrer" style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.label || a.url}</a>
          <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => set({ assets: assets.filter((_, j) => j !== i) })}>✕</button>
        </div>
      ))}
      <form className="c-card-body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} onSubmit={e => {
        e.preventDefault(); if (!url.trim()) return
        set({ assets: [...assets, { label: label.trim() || null, url: url.trim() }] }); setLabel(''); setUrl('')
      }}>
        <input className="c-input" style={{ flex: '1 1 120px' }} placeholder="What it is (e.g. Miami B-roll)" value={label} onChange={e => setLabel(e.target.value)} />
        <input className="c-input" style={{ flex: '2 1 180px' }} placeholder="Shared iCloud / Drive link" value={url} onChange={e => setUrl(e.target.value)} />
        <button className="c-btn c-btn-sm">Add</button>
      </form>
    </div>
  )
}
