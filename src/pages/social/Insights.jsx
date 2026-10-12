import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import '../../ceo/ceo.css'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { live, useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, FORMATS } from '../../social/constants.js'
import { DEFAULT_DESTINATIONS, postCode } from '../../social/tracking.js'
import { useVerifiedLeads } from '../../social/attribution.js'
import { monthlyInsights } from '../../social/ai.js'
import { BrandChip, SocialNav, SocialSetupNeeded } from '../../social/ui.jsx'
import { toast } from '../../ceo/ui.jsx'
import { pad, todayISO } from '../../ceo/recurrence.js'

const LEAD_KEYS = ['inquiries', 'buyer_leads', 'seller_leads', 'rental_leads', 'recruit_leads']
const num = (m, k) => Number(m?.[k]) || 0
const publishedOn = i => Object.values(i.versions || {}).map(v => v.published_at).filter(Boolean).sort()[0]
  || (['published', 'reviewed'].includes(i.stage) ? i.publish_date : null)

export default function Insights() {
  const { items, setupNeeded } = useSocial()
  const verified = useVerifiedLeads()
  const [month, setMonth] = useState(todayISO().slice(0, 7))
  const [saved, setSaved] = useLocalStorage('social_insights', {})
  const [settings, setSettings] = useLocalStorage('social_settings', {})
  const [busy, setBusy] = useState(false)

  const months = useMemo(() => {
    const t = new Date(); return Array.from({ length: 12 }, (_, i) => { const d = new Date(t.getFullYear(), t.getMonth() - i, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}` })
  }, [])

  const posts = useMemo(() => live(items).filter(i => (publishedOn(i) || '').startsWith(month)).map(i => {
    const v = (verified.byCode.get(postCode(i)) || []).length
    const manualLeads = LEAD_KEYS.reduce((s, k) => s + num(i.metrics, k), 0)
    return { i, verified: v, manualLeads, views: num(i.metrics, 'views'), saves: num(i.metrics, 'saves') + num(i.metrics, 'shares'),
      score: v * 100 + manualLeads * 40 + (num(i.metrics, 'saves') + num(i.metrics, 'shares')) * 2 + num(i.metrics, 'views') / 100 }
  }), [items, month, verified.byCode])

  // Verified leads that arrived this month (any post, even ones published earlier)
  const monthVerified = verified.leads.filter(l => String(l.at || '').startsWith(month)).length

  const group = key => {
    const m = new Map()
    for (const p of posts) {
      const k = key(p.i) || '—'
      if (!m.has(k)) m.set(k, { posts: 0, verified: 0, leads: 0, views: 0, saves: 0 })
      const g = m.get(k); g.posts++; g.verified += p.verified; g.leads += p.manualLeads; g.views += p.views; g.saves += p.saves
    }
    return [...m.entries()].sort((a, b) => (b[1].verified * 100 + b[1].leads * 40 + b[1].saves) - (a[1].verified * 100 + a[1].leads * 40 + a[1].saves))
  }
  const byBrand = group(i => i.brand)
  const byFormat = group(i => FORMATS[i.format]?.label)
  const byPillar = group(i => i.pillar)
  const ranked = [...posts].sort((a, b) => b.score - a.score)
  const report = saved?.[month]

  async function ask() {
    setBusy(true)
    try {
      const out = await monthlyInsights({
        month, verified_leads_this_month: monthVerified,
        posts: ranked.map(p => ({ title: p.i.title, brand: p.i.brand, format: p.i.format, pillar: p.i.pillar, objective: p.i.objective,
          published: publishedOn(p.i), hook: p.i.hook, verified_leads: p.verified, logged_leads: p.manualLeads, metrics: p.i.metrics })),
      })
      setSaved(prev => ({ ...(prev || {}), [month]: { ...out, at: new Date().toISOString() } }))
    } catch (e) { toast('Could not analyze', e.message) }
    setBusy(false)
  }

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  return (
    <div className="c-page">
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · Insights</div>
          <div className="c-title">What&apos;s actually working</div>
          <div className="c-sub">Ranked by business first — verified leads, then logged leads, then saves. Views come last.</div>
        </div>
        <div className="c-head-actions"><SocialNav />
          <select className="c-select" style={{ width: 'auto' }} value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m} value={m}>{new Date(m + '-01T00:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</option>)}
          </select>
        </div>
      </div>

      <div className="c-stats" style={{ marginBottom: 20 }}>
        <div className="c-stat"><div className="c-stat-val">{posts.length}</div><div className="c-stat-lbl">Posts published</div></div>
        <div className="c-stat" style={{ borderTop: '3px solid var(--sky)' }}><div className="c-stat-val">{verified.connected ? monthVerified : '—'}</div><div className="c-stat-lbl">Verified leads · tracking links</div></div>
        <div className="c-stat"><div className="c-stat-val">{posts.reduce((s, p) => s + p.manualLeads, 0)}</div><div className="c-stat-lbl">Leads & inquiries · logged by hand</div></div>
        <div className="c-stat"><div className="c-stat-val">{posts.reduce((s, p) => s + p.saves, 0)}</div><div className="c-stat-lbl">Saves + shares</div></div>
      </div>
      {!verified.connected && <div className="c-banner" style={{ marginBottom: 20 }}>Connect the RLC Portal on the Today page to count verified leads from your tracking links.</div>}

      <div className="c-grid">
        <div className="c-stack">
          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Posts this month</div></div>
            {ranked.length === 0 && <div className="c-empty">Nothing published this month yet. Mark a platform “published” on a post to count it here.</div>}
            {ranked.map((p, n) => (
              <Link key={p.i.id} to={`/social/post/${p.i.id}`} className="c-tl-row" style={{ gridTemplateColumns: '28px 1fr auto', textDecoration: 'none', color: 'inherit' }}>
                <span className="c-muted" style={{ fontSize: 12 }}>{n + 1}</span>
                <span style={{ minWidth: 0 }}><span style={{ fontSize: 14 }}>{p.i.title}</span>
                  <span className="c-muted" style={{ fontSize: 11, display: 'block' }}>{BRANDS[p.i.brand]?.short} · {FORMATS[p.i.format]?.label || '—'}</span></span>
                <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {p.verified > 0 && <span className="c-chip sky">{p.verified} verified</span>}
                  {p.manualLeads > 0 && <span className="c-chip">{p.manualLeads} leads</span>}
                  {p.saves > 0 && <span className="c-chip">{p.saves} saves</span>}
                  {p.views > 0 && <span className="c-chip">{p.views.toLocaleString()} views</span>}
                </span>
              </Link>
            ))}
          </div>

          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Monthly read</div>
              <button className="c-btn c-btn-sm c-btn-sky" disabled={busy || !ranked.length} onClick={ask}>{busy ? 'Analyzing…' : report ? 'Refresh' : 'Analyze this month'}</button>
            </div>
            {!report && <div className="c-empty">An honest read on what generated business and what to change — after you&apos;ve logged results on a few posts.</div>}
            {report && (
              <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.55 }}>
                <div>{report.summary}</div>
                {report.keep?.length > 0 && <div><span className="s-field-label">Keep doing</span>{report.keep.map((x, i) => <div key={i}>• {x}</div>)}</div>}
                {report.change?.length > 0 && <div><span className="s-field-label">Change</span>{report.change.map((x, i) => <div key={i}>• {x}</div>)}</div>}
                {report.next_month?.length > 0 && <div><span className="s-field-label">Next month</span>{report.next_month.map((x, i) => <div key={i}>• {x}</div>)}</div>}
                <div className="c-muted" style={{ fontSize: 11 }}>Analyzed {new Date(report.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
              </div>
            )}
          </div>
        </div>

        <div className="c-stack">
          <Breakdown title="By account" rows={byBrand} label={k => <BrandChip brand={k} />} />
          <Breakdown title="By format" rows={byFormat} />
          <Breakdown title="By topic" rows={byPillar} />

          <div className="c-card">
            <div className="c-card-head"><div className="c-card-title">Tracking link destinations</div></div>
            <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(BRANDS).map(([k, b]) => (
                <div key={k} className="c-field"><label className="s-field-label">{b.short} links go to</label>
                  <input className="c-input" defaultValue={settings?.destinations?.[k] || DEFAULT_DESTINATIONS[k]} key={k + (settings?.destinations?.[k] || '')}
                    onBlur={e => { const v = e.target.value.trim(); setSettings(s => ({ ...(s || {}), destinations: { ...(s?.destinations || {}), [k]: v || null } })) }} /></div>
              ))}
              <div className="c-muted" style={{ fontSize: 12 }}>Leads are verified when the destination site tags them with the post&apos;s code (RLC Leasing site — see setup notes).</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Breakdown({ title, rows, label }) {
  return (
    <div className="c-card">
      <div className="c-card-head"><div className="c-card-title">{title}</div></div>
      {rows.length === 0 && <div className="c-empty">—</div>}
      {rows.map(([k, g]) => (
        <div key={k} className="c-tl-row" style={{ gridTemplateColumns: '1fr auto', cursor: 'default' }}>
          <span style={{ fontSize: 14 }}>{label ? label(k) : k}</span>
          <span className="c-muted" style={{ fontSize: 12 }}>{g.posts} posts · {g.verified} verified · {g.leads} leads · {g.saves} saves</span>
        </div>
      ))}
    </div>
  )
}
