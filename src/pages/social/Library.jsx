import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../../ceo/ceo.css'
import { useSocial } from '../../social/SocialStore.jsx'
import { ASSET_KINDS, BRANDS, MARKETS } from '../../social/constants.js'
import { SocialNav, SocialSetupNeeded } from '../../social/ui.jsx'
import { useLeasingListings } from '../../social/leasing.js'
import { Modal, toast } from '../../ceo/ui.jsx'
import { fmtDate } from '../../ceo/recurrence.js'

export default function Library() {
  const { assets, items, campaigns, libraryNeeded, setupNeeded } = useSocial()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState('')
  const [market, setMarket] = useState('')
  const [brand, setBrand] = useState('')
  const [editing, setEditing] = useState(null)

  const usage = useMemo(() => {
    const m = new Map()
    for (const i of items) for (const a of i.assets || []) if (a.asset_id) {
      if (!m.has(a.asset_id)) m.set(a.asset_id, []); m.get(a.asset_id).push(i)
    }
    return m
  }, [items])

  const shown = assets.filter(a =>
    (!kind || a.kind === kind) && (!market || a.market === market) && (!brand || a.brand === brand) &&
    (!q || `${a.label} ${a.property || ''} ${(a.tags || []).join(' ')} ${a.notes || ''}`.toLowerCase().includes(q.toLowerCase())))

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  return (
    <div className="c-page">
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · Content library</div>
          <div className="c-title">Everything you&apos;ve shot</div>
          <div className="c-sub">Links to your iCloud / Drive files — nothing is copied or re-uploaded. Tag once, reuse in any post.</div>
        </div>
        <div className="c-head-actions"><SocialNav /><button className="c-btn c-btn-sky" disabled={libraryNeeded} onClick={() => setEditing({})}>+ Add to library</button></div>
      </div>

      {libraryNeeded && <div className="c-banner" style={{ marginBottom: 16 }}>The library needs one more database table — run the Phase 3 SQL from chat, then refresh.</div>}

      <div className="c-toolbar" style={{ gap: 6 }}>
        <input className="c-input" style={{ maxWidth: 280 }} placeholder="Search label, property, tags…" value={q} onChange={e => setQ(e.target.value)} />
        <Sel value={kind} onChange={setKind} label="All types" options={Object.entries(ASSET_KINDS)} />
        <Sel value={market} onChange={setMarket} label="All markets" options={MARKETS.map(m => [m, m])} />
        <Sel value={brand} onChange={setBrand} label="All brands" options={Object.entries(BRANDS).map(([k, b]) => [k, b.short])} />
        <span className="c-muted" style={{ fontSize: 12 }}>{shown.length} of {assets.length}</span>
      </div>

      <div className="c-card">
        {shown.length === 0 && <div className="c-empty">{assets.length ? 'Nothing matches.' : 'Your library is empty. Add the shared link to a video or album from your phone or iCloud — e.g. “Kendall 1 tour (raw)”.'}</div>}
        {shown.map(a => {
          const used = usage.get(a.id) || []
          return (
            <div key={a.id} className="c-task" style={{ gridTemplateColumns: '1fr auto' }}>
              <div style={{ minWidth: 0 }}>
                <div className="c-task-title" style={{ fontWeight: 500 }}>
                  {a.url ? <a className="c-link" href={a.url} target="_blank" rel="noreferrer">{a.label} ↗</a> : a.label}
                </div>
                <div className="c-task-meta">
                  <span className="c-chip">{ASSET_KINDS[a.kind] || a.kind}</span>
                  {a.market && <span className="c-chip">{a.market}</span>}
                  {a.brand && <span className="c-chip">{BRANDS[a.brand]?.short}</span>}
                  {a.property && <span className="c-chip sky">{a.property}</span>}
                  {a.campaign_id && <span className="c-chip">{campaigns.find(c => c.id === a.campaign_id)?.name || 'Campaign'}</span>}
                  {(a.tags || []).map(t => <span key={t} className="c-chip">#{t}</span>)}
                  {a.taken_on && <span className="c-chip">{fmtDate(a.taken_on, { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                </div>
                {used.length > 0 && (
                  <div className="c-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Used in: {used.map((i, n) => <span key={i.id}>{n ? ', ' : ''}<Link className="c-link" to={`/social/post/${i.id}`}>{i.title}</Link></span>)}
                  </div>
                )}
              </div>
              <button className="c-btn c-btn-sm" onClick={() => setEditing(a)}>Edit</button>
            </div>
          )
        })}
      </div>
      {editing && <AssetModal asset={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function Sel({ value, onChange, label, options }) {
  return (
    <select className="c-select" style={{ width: 'auto', padding: '6px 10px', fontSize: 11 }} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{label}</option>{options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  )
}

/** Create / edit a library item. onSaved(asset) lets a post link it right away. */
export function AssetModal({ asset, onClose, onSaved, defaults = {} }) {
  const { saveAsset, deleteAsset, campaigns } = useSocial()
  const { listings } = useLeasingListings()
  const [a, setA] = useState({ kind: 'property_video', tags: [], ...defaults, ...asset })
  const [tags, setTags] = useState((a.tags || []).join(', '))
  const set = patch => setA(prev => ({ ...prev, ...patch }))
  const isNew = !asset?.id

  async function save() {
    if (!a.label?.trim()) return
    const row = await saveAsset({ ...a, label: a.label.trim(), url: a.url?.trim() || null, tags: tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean) })
    toast(isNew ? 'Added to library' : 'Saved', row.label)
    onSaved?.(row); onClose()
  }

  return (
    <Modal eyebrow={isNew ? 'Content library' : 'Edit'} title={a.label || 'New library item'} onClose={onClose}
      footer={<>
        {!isNew && <button className="c-btn c-btn-danger c-btn-sm" style={{ marginRight: 'auto' }} onClick={() => { if (window.confirm('Remove from the library? (The file itself stays where it is.)')) { deleteAsset(a.id); onClose() } }}>Remove</button>}
        <button className="c-btn c-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="c-btn c-btn-sky" disabled={!a.label?.trim()} onClick={save}>Save</button>
      </>}>
      <div className="c-field"><label className="s-field-label">What it is</label>
        <input className="c-input" autoFocus value={a.label || ''} onChange={e => set({ label: e.target.value })} placeholder="e.g. Kendall 1 — full tour (raw)" /></div>
      <div className="c-field"><label className="s-field-label">Shared link</label>
        <input className="c-input" value={a.url || ''} onChange={e => set({ url: e.target.value })} placeholder="iCloud / Google Drive / Dropbox share link" />
        <span className="c-muted" style={{ fontSize: 11 }}>On iPhone: Photos → select → Share → Copy iCloud Link.</span></div>
      <div className="c-row">
        <div className="c-field"><label className="s-field-label">Type</label>
          <select className="c-select" value={a.kind} onChange={e => set({ kind: e.target.value })}>
            {Object.entries(ASSET_KINDS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></div>
        <div className="c-field"><label className="s-field-label">Market</label>
          <select className="c-select" value={a.market || ''} onChange={e => set({ market: e.target.value || null })}>
            <option value="">—</option>{MARKETS.map(m => <option key={m}>{m}</option>)}
          </select></div>
        <div className="c-field"><label className="s-field-label">Brand</label>
          <select className="c-select" value={a.brand || ''} onChange={e => set({ brand: e.target.value || null })}>
            <option value="">Any</option>{Object.entries(BRANDS).map(([k, b]) => <option key={k} value={k}>{b.short}</option>)}
          </select></div>
      </div>
      <div className="c-row">
        <div className="c-field"><label className="s-field-label">Property / apartment</label>
          <input className="c-input" list="lib-props" value={a.property || ''} onChange={e => set({ property: e.target.value || null })} placeholder="Public name, e.g. Kendall 1" />
          <datalist id="lib-props">{listings.map(l => <option key={l.id} value={l.display_name} />)}</datalist></div>
        <div className="c-field"><label className="s-field-label">Campaign</label>
          <select className="c-select" value={a.campaign_id || ''} onChange={e => set({ campaign_id: e.target.value || null })}>
            <option value="">None</option>{campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select></div>
        <div className="c-field"><label className="s-field-label">Taken on</label>
          <input className="c-input" type="date" value={a.taken_on || ''} onChange={e => set({ taken_on: e.target.value || null })} /></div>
      </div>
      <div className="c-field"><label className="s-field-label">Tags (comma separated)</label>
        <input className="c-input" value={tags} onChange={e => setTags(e.target.value)} placeholder="pool, sunset, rooftop" /></div>
      <div className="c-field"><label className="s-field-label">Notes</label>
        <textarea className="c-textarea" rows={2} value={a.notes || ''} onChange={e => set({ notes: e.target.value })} /></div>
    </Modal>
  )
}
