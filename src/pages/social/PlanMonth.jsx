import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../../ceo/ceo.css'
import { useLocalStorage } from '../../hooks/useLocalStorage.js'
import { useSocial } from '../../social/SocialStore.jsx'
import { BRANDS, EFFORT_LABEL, FORMATS, PLATFORMS } from '../../social/constants.js'
import { planMonth } from '../../social/ai.js'
import { BrandChip, SocialNav, SocialSetupNeeded } from '../../social/ui.jsx'
import { fmtDate, todayISO } from '../../ceo/recurrence.js'
import { toast } from '../../ceo/ui.jsx'

const DEFAULTS = { perWeek: { personal: 1, rlc: 2, leasing: 2 }, lowCapacity: false }

export default function PlanMonth() {
  const { items, campaigns, slots, updateItem, saveItem, setupNeeded } = useSocial()
  const navigate = useNavigate()
  const [settings, setSettings] = useLocalStorage('social_settings', DEFAULTS)
  const [plan, setPlan] = useLocalStorage('social_last_plan', null)
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState(() => new Set())
  const perWeek = { ...DEFAULTS.perWeek, ...(settings?.perWeek || {}) }
  const lowCapacity = !!settings?.lowCapacity

  useEffect(() => { if (plan?.posts) setPicked(new Set(plan.posts.filter(p => !p.applied).map(p => p.key))) }, [plan?.createdAt]) // eslint-disable-line
  useEffect(() => { if (!busy) return; const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t) }, [busy])

  async function generate() {
    setBusy(true); setSecs(0); setErr('')
    try {
      const r = await planMonth({ items, campaigns, slots, perWeek, lowCapacity })
      setPlan({ ...r, createdAt: new Date().toISOString(), settings: { perWeek, lowCapacity } })
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const editPost = (key, patch) => setPlan(p => ({ ...p, posts: p.posts.map(x => (x.key === key ? { ...x, ...patch } : x)) }))

  async function approve(keys) {
    const chosen = plan.posts.filter(p => keys.has(p.key) && !p.applied)
    for (const p of chosen) {
      const base = { publish_date: p.publish_date, platforms: p.platforms.filter(x => PLATFORMS[x]) }
      if (p.format) base.format = p.format
      const existing = p.id && items.find(i => i.id === p.id)
      if (existing) await updateItem(p.id, { ...base, objective: existing.objective || p.objective || null, effort: existing.effort || p.effort || null })
      else await saveItem({ title: p.title, brand: p.brand, ...base, objective: p.objective || null, effort: p.effort || null, source: 'ai_plan', notes: p.why })
    }
    setPlan(pl => ({ ...pl, posts: pl.posts.map(x => (keys.has(x.key) ? { ...x, applied: true } : x)) }))
    toast(`${chosen.length} post${chosen.length === 1 ? '' : 's'} added to your plan`, 'Prep steps are on your calendar now.')
  }

  if (setupNeeded) return <div className="c-page"><SocialSetupNeeded /></div>
  const pending = plan?.posts?.filter(p => !p.applied) || []

  return (
    <div className="c-page" style={{ maxWidth: 1180 }}>
      <div className="c-head">
        <div>
          <div className="c-eyebrow">Social HQ · 30-day plan</div>
          <div className="c-title">Your next 30 days</div>
          <div className="c-sub">A suggested plan from your idea bank. Nothing is scheduled until you approve it.</div>
        </div>
        <div className="c-head-actions"><SocialNav /></div>
      </div>

      <div className="c-card" style={{ marginBottom: 20 }}>
        <div className="c-card-body" style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          {Object.entries(BRANDS).map(([k, b]) => (
            <div key={k} className="c-field" style={{ width: 150 }}>
              <label className="s-field-label">{b.short} · max / week</label>
              <input className="c-input" type="number" min="0" max="7" value={perWeek[k]}
                onChange={e => setSettings(s => ({ ...DEFAULTS, ...(s || {}), perWeek: { ...perWeek, [k]: Math.max(0, Number(e.target.value) || 0) } }))} />
            </div>
          ))}
          <label className="c-check-row" style={{ paddingBottom: 10 }}>
            <input type="checkbox" checked={lowCapacity} onChange={e => setSettings(s => ({ ...DEFAULTS, ...(s || {}), perWeek, lowCapacity: e.target.checked }))} />
            Light-week mode (max 3 posts a week, one heavy piece)
          </label>
          <span style={{ flex: 1 }} />
          <button className="c-btn c-btn-sky" disabled={busy} onClick={generate}>{plan ? 'Generate a new plan' : 'Generate my plan'}</button>
        </div>
        {busy && <div className="c-card-body" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="c-serif" style={{ fontSize: 18 }}>Planning your month… {secs}s</div>
          <div className="c-muted" style={{ fontSize: 12, marginTop: 4 }}>Usually 1–2 minutes — it weighs every idea, your weekly limits and your Tuesday/Wednesday production days. Keep this page open.</div>
        </div>}
        {err && <div className="c-banner" style={{ margin: 16 }}>{err}</div>}
      </div>

      {plan && !busy && (
        <div className="c-stack">
          <div className="c-banner sky" style={{ display: 'block' }}>
            <div className="c-label" style={{ marginBottom: 6 }}>Strategy · drafted {new Date(plan.createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
            <div style={{ fontSize: 14, lineHeight: 1.6 }}>{plan.summary}</div>
          </div>

          <div className="c-card">
            <div className="c-card-head">
              <div className="c-card-title">Suggested posts</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="c-btn c-btn-sm" disabled={!picked.size} onClick={() => approve(picked)}>Approve selected ({[...picked].filter(k => pending.some(p => p.key === k)).length})</button>
                <button className="c-btn c-btn-ink c-btn-sm" disabled={!pending.length} onClick={() => approve(new Set(pending.map(p => p.key)))}>Approve all</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="s-table" style={{ minWidth: 900 }}>
                <thead><tr><th></th><th>Publish</th><th>Account</th><th>Post</th><th>Format</th><th>Effort</th><th>Why · depends on</th></tr></thead>
                <tbody>
                  {plan.posts.map(p => (
                    <tr key={p.key} style={p.applied ? { opacity: .55 } : undefined}>
                      <td>{p.applied ? <span className="c-chip green">Added</span> :
                        <input type="checkbox" checked={picked.has(p.key)} onChange={() => { const n = new Set(picked); n.has(p.key) ? n.delete(p.key) : n.add(p.key); setPicked(n) }} />}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.applied ? fmtDate(p.publish_date) : <input className="c-input" type="date" min={todayISO()} style={{ width: 150, padding: '5px 8px' }} value={p.publish_date} onChange={e => editPost(p.key, { publish_date: e.target.value })} />}
                      </td>
                      <td><BrandChip brand={p.brand} /></td>
                      <td style={{ fontWeight: 500, cursor: p.id ? 'pointer' : 'default' }} onClick={() => p.id && navigate(`/social/post/${p.id}`)}>
                        {p.title}{!p.id && <span className="c-chip sky" style={{ marginLeft: 6 }}>New idea</span>}
                        <div className="c-muted" style={{ fontSize: 11, fontWeight: 400 }}>{p.platforms.map(x => PLATFORMS[x] || x).join(' + ')}{p.assigned ? ` · ${p.assigned}` : ''}</div>
                      </td>
                      <td>{FORMATS[p.format]?.label || '—'}</td>
                      <td>{EFFORT_LABEL[p.effort] || '—'}</td>
                      <td style={{ fontSize: 12, maxWidth: 340 }}>{p.why}{p.depends_on ? <div className="c-muted" style={{ marginTop: 4 }}>Needs: {p.depends_on}</div> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {plan.held_back?.length > 0 && (
            <div className="c-card">
              <div className="c-card-head"><div className="c-card-title">Waiting for later</div></div>
              {plan.held_back.map((h, i) => (
                <div key={i} className="c-tl-row" style={{ gridTemplateColumns: '1fr', cursor: h.id ? 'pointer' : 'default' }} onClick={() => h.id && navigate(`/social/post/${h.id}`)}>
                  <div><div style={{ fontSize: 14 }}>{items.find(x => x.id === h.id)?.title || 'Idea'}</div><div className="c-muted" style={{ fontSize: 12, marginTop: 2 }}>{h.reason}</div></div>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="c-btn" onClick={() => navigate('/social/planner?view=month')}>See it on the planner →</button>
          </div>
        </div>
      )}
    </div>
  )
}
