import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import '../../ceo/ceo.css'
import { live, useSocial } from '../../social/SocialStore.jsx'
import { BRANDS } from '../../social/constants.js'
import { TEMPLATES, campaignResults } from '../../social/campaigns.js'
import { BrandChip, SocialNav, SocialSetupNeeded } from '../../social/ui.jsx'
import { Modal } from '../../ceo/ui.jsx'
import { addDays, fmtDate, parseISO, todayISO } from '../../ceo/recurrence.js'

const nextMonday = () => { const t = todayISO(); const d = parseISO(t).getDay(); return addDays(t, ((8 - d) % 7) || 7) }

export default function Campaigns() {
  const { campaigns, items, saveCampaign, setupNeeded } = useSocial()
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>

  const order = { active: 0, proposed: 1, paused: 2, done: 3 }
  const list = [...campaigns].sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9))

  return (
    <div className="c-page" style={{ maxWidth: 1080 }}>
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · Campaigns</div>
          <div className="c-title">Campaign builder</div>
          <div className="c-sub">Structured pushes with a start, an end and a goal. Leasing campaigns never change your personal or brokerage rhythm.</div>
        </div>
        <div className="c-head-actions"><SocialNav /><button className="c-btn c-btn-sky" onClick={() => setCreating(true)}>+ New campaign</button></div>
      </div>

      <div className="c-card">
        {list.length === 0 && <div className="c-empty">No campaigns yet.</div>}
        {list.map(c => {
          const posts = live(items).filter(i => i.campaign_id === c.id)
          const r = campaignResults(posts)
          const end = c.start_date && c.duration_days ? addDays(c.start_date, c.duration_days - 1) : null
          return (
            <div key={c.id} className="c-tl-row" style={{ gridTemplateColumns: '1fr auto' }} onClick={() => navigate(`/social/campaigns/${c.id}`)}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 500 }}>{c.name}</div>
                <div className="c-task-meta">
                  <BrandChip brand={c.brand} />
                  <span className={`c-chip${c.status === 'active' ? ' green' : c.status === 'proposed' ? ' warn' : ''}`}>{c.status}</span>
                  {c.start_date && <span className="c-chip">{fmtDate(c.start_date, { month: 'short', day: 'numeric' })}{end ? ` – ${fmtDate(end, { month: 'short', day: 'numeric' })}` : ''}</span>}
                  {c.duration_days && <span className="c-chip">{c.duration_days} days</span>}
                  {posts.length > 0 && <span className="c-chip">{r.posted}/{posts.length} posted</span>}
                  {r.totals.rental_leads + r.totals.inquiries > 0 && <span className="c-chip sky">{r.totals.rental_leads + r.totals.inquiries} leads/inquiries</span>}
                </div>
              </div>
              <span className="c-link" style={{ fontSize: 12 }}>Open →</span>
            </div>
          )
        })}
      </div>

      {creating && <NewCampaign onClose={() => setCreating(false)} onCreate={async c => {
        const row = await saveCampaign(c); setCreating(false); navigate(`/social/campaigns/${row.id}`)
      }} />}
      <div className="c-muted" style={{ fontSize: 12, marginTop: 14 }}>Tip: any post can join a campaign from its workspace (Details → Campaign). <Link className="c-link" to="/social/library">Content library →</Link></div>
    </div>
  )
}

function NewCampaign({ onClose, onCreate }) {
  const [tpl, setTpl] = useState('apartments')
  const [name, setName] = useState(TEMPLATES.apartments.name)
  const [subject, setSubject] = useState('')
  const [days, setDays] = useState(TEMPLATES.apartments.days)
  const [start, setStart] = useState(nextMonday())
  const [brand, setBrand] = useState(TEMPLATES.apartments.brand)
  const t = TEMPLATES[tpl]
  const pick = k => { setTpl(k); setDays(TEMPLATES[k].days); setBrand(TEMPLATES[k].brand); setName(TEMPLATES[k].name || '') }
  return (
    <Modal eyebrow="New campaign" title={name || t.label} onClose={onClose}
      footer={<><button className="c-btn c-btn-ghost" onClick={onClose}>Cancel</button>
        <button className="c-btn c-btn-sky" disabled={!name.trim()} onClick={() => onCreate({
          name: name.trim(), brand, type: t.type, status: 'proposed', start_date: start, duration_days: days,
          config: { template: tpl, subject: subject.trim() || null, cadence: t.cadence || null },
        })}>Create (stays proposed)</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
        {Object.entries(TEMPLATES).map(([k, v]) => (
          <button key={k} type="button" onClick={() => pick(k)} className="c-card" style={{ textAlign: 'left', padding: 12, cursor: 'pointer', borderColor: tpl === k ? 'var(--sky)' : undefined, boxShadow: tpl === k ? '0 0 0 1px var(--sky)' : undefined }}>
            <div style={{ fontWeight: 500, fontSize: 13 }}>{v.label}</div>
            <div className="c-muted" style={{ fontSize: 11, marginTop: 4, lineHeight: 1.4 }}>{v.description}</div>
          </button>
        ))}
      </div>
      <div className="c-field"><label className="s-field-label">Campaign name</label>
        <input className="c-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Brickell listing launch" /></div>
      {tpl !== 'apartments' && tpl !== 'custom' && (
        <div className="c-field"><label className="s-field-label">What it's about (used in post titles)</label>
          <input className="c-input" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. 137 SW Pisces Terrace / the new website / Thanksgiving" /></div>
      )}
      <div className="c-row">
        <div className="c-field"><label className="s-field-label">Brand</label>
          <select className="c-select" value={brand} onChange={e => setBrand(e.target.value)}>{Object.entries(BRANDS).map(([k, b]) => <option key={k} value={k}>{b.label}</option>)}</select></div>
        <div className="c-field"><label className="s-field-label">Starts</label>
          <input className="c-input" type="date" min={todayISO()} value={start} onChange={e => setStart(e.target.value)} /></div>
        <div className="c-field"><label className="s-field-label">Length</label>
          <select className="c-select" value={[7, 14, 30].includes(days) ? days : 'custom'} onChange={e => e.target.value !== 'custom' && setDays(Number(e.target.value))}>
            <option value={7}>7-day pilot</option><option value={14}>14 days</option><option value={30}>30 days</option><option value="custom">Custom</option>
          </select></div>
        <div className="c-field"><label className="s-field-label">Days</label>
          <input className="c-input" type="number" min="1" max="90" value={days} onChange={e => setDays(Math.max(1, Number(e.target.value) || 1))} /></div>
      </div>
      <div className="c-muted" style={{ fontSize: 12 }}>Nothing is scheduled until you press Launch inside the campaign.</div>
    </Modal>
  )
}
