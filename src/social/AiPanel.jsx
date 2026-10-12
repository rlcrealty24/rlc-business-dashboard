import { useEffect, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useSocial } from './SocialStore.jsx'
import { developPost } from './ai.js'
import { BRANDS, FORMATS, PLATFORMS } from './constants.js'
import { toast } from '../ceo/ui.jsx'

const list = v => (Array.isArray(v) ? v : v ? [v] : [])

/** AI strategist for one post. Drafts are saved per post; nothing is applied until you click. */
export default function AiPanel({ item }) {
  const { updateItem, capture } = useSocial()
  const [drafts, setDrafts] = useLocalStorage('social_ai_drafts', {})
  const [extra, setExtra] = useState('')
  const [busy, setBusy] = useState(false)
  const [secs, setSecs] = useState(0)
  const [err, setErr] = useState('')
  const saved = drafts?.[item.id]
  const d = saved?.draft

  useEffect(() => {
    if (!busy) return
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [busy])

  async function run() {
    setBusy(true); setSecs(0); setErr('')
    try {
      const draft = await developPost(item, extra.trim())
      setDrafts(prev => ({ ...(prev || {}), [item.id]: { draft, at: new Date().toISOString(), extra: extra.trim() } }))
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }

  const set = patch => { updateItem(item.id, patch); toast('Added to the post', Object.keys(patch).join(', ').replace(/_/g, ' ')) }
  const fillEmpty = () => {
    const patch = {}
    if (!item.hook && d.hooks?.[0]) patch.hook = d.hooks[0]
    if (!item.script && d.script) patch.script = d.script
    if (!item.caption && d.captions?.[0]) patch.caption = d.captions[0]
    if (!item.cta && d.ctas?.[0]) patch.cta = d.ctas[0]
    if (!item.hashtags && d.hashtags?.length) patch.hashtags = list(d.hashtags).join(' ')
    if (!item.shot_list && (d.shot_list?.length || d.broll?.length))
      patch.shot_list = [...list(d.shot_list), ...list(d.broll).map(b => `B-roll: ${b}`)].join('\n')
    if (!item.on_screen_text && d.on_screen_text?.length) patch.on_screen_text = list(d.on_screen_text).join('\n')
    if (!item.edit_notes && d.editing) patch.edit_notes = d.editing
    if (!item.cover_concept && d.cover) patch.cover_concept = d.cover
    if (!Object.keys(patch).length) { toast('Nothing to fill', 'Every creative field already has content.'); return }
    set(patch)
  }

  return (
    <div className="c-card" style={{ borderColor: 'var(--sky)' }}>
      <div className="c-card-head" style={{ background: 'var(--sky-soft)' }}>
        <div>
          <div className="c-card-title">AI strategist</div>
          <div className="c-muted" style={{ fontSize: 12, marginTop: 2 }}>Drafts in the {BRANDS[item.brand]?.label} voice — you review and choose what to use.</div>
        </div>
        {d && !busy && <button className="c-btn c-btn-sm" onClick={run}>Regenerate</button>}
      </div>

      {!d && !busy && (
        <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <textarea className="c-textarea" rows={3} value={extra} onChange={e => setExtra(e.target.value)}
            placeholder="Anything I should know? e.g. “Just closed a difficult transaction after the first lender denied the buyer — client OK'd the story, not their name.”" />
          <button className="c-btn c-btn-sky" style={{ alignSelf: 'flex-start' }} onClick={run}>Develop with AI</button>
          <div className="c-muted" style={{ fontSize: 12 }}>Purpose, best account & format, 3 hooks, script, shot list, B-roll, editing, on-screen text, cover, captions, CTAs, hashtags, checklist and repurposing ideas.</div>
        </div>
      )}
      {busy && <div className="c-card-body"><div className="c-serif" style={{ fontSize: 18 }}>Thinking it through… {secs}s</div><div className="c-muted" style={{ fontSize: 12, marginTop: 4 }}>Usually under a minute. You can keep working — leave this page open.</div></div>}
      {err && <div className="c-banner" style={{ margin: 16 }}>{err}</div>}

      {d && !busy && (
        <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="c-btn c-btn-ink c-btn-sm" onClick={fillEmpty}>Fill empty fields</button>
            <span className="c-muted" style={{ fontSize: 12 }}>Drafted {new Date(saved.at).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
          </div>

          <Section label="Purpose">{d.purpose}</Section>

          {d.recommendation && (
            <Section label="Recommendation" action={<button className="c-btn c-btn-sm" onClick={() => {
              const r = d.recommendation
              const patch = {}
              if (BRANDS[r.brand] && r.brand !== item.brand) patch.brand = r.brand
              if (FORMATS[r.format] && r.format !== item.format) patch.format = r.format
              const plats = list(r.platforms).filter(p => PLATFORMS[p])
              if (plats.length) patch.platforms = plats
              if (!Object.keys(patch).length) { toast('Already matches', 'Brand, format and platforms are already set this way.'); return }
              set(patch)
            }}>Apply</button>}>
              <strong>{BRANDS[d.recommendation.brand]?.label || d.recommendation.brand}</strong> · {FORMATS[d.recommendation.format]?.label || d.recommendation.format} · {list(d.recommendation.platforms).map(p => PLATFORMS[p] || p).join(' + ')}
              <div className="c-muted" style={{ marginTop: 4 }}>{d.recommendation.why}</div>
            </Section>
          )}

          {list(d.cautions).length > 0 && (
            <div className="c-banner" style={{ display: 'block' }}>
              <div className="c-label" style={{ color: '#92400e', marginBottom: 6 }}>Before you post</div>
              {list(d.cautions).map((c, i) => <div key={i} style={{ fontSize: 13, marginTop: 3 }}>• {c}</div>)}
            </div>
          )}

          <Options label="Hooks" options={list(d.hooks)} onUse={v => set({ hook: v })} />
          <Section label="Script" action={<button className="c-btn c-btn-sm" onClick={() => set({ script: d.script })}>Use</button>}>
            <div className="c-pre" style={{ color: 'var(--ink)' }}>{d.script}</div>
          </Section>
          <Options label="Captions" options={list(d.captions)} onUse={v => set({ caption: v })} pre />
          <Options label="CTAs" options={list(d.ctas)} onUse={v => set({ cta: v })} />
          <Section label="Hashtags" action={<button className="c-btn c-btn-sm" onClick={() => set({ hashtags: list(d.hashtags).join(' ') })}>Use</button>}>
            {list(d.hashtags).join(' ')}
          </Section>
          <Section label="Shot list & B-roll" action={<button className="c-btn c-btn-sm" onClick={() => set({ shot_list: [...list(d.shot_list), ...list(d.broll).map(b => `B-roll: ${b}`)].join('\n') })}>Use</button>}>
            {list(d.shot_list).map((s, i) => <div key={i}>{i + 1}. {s}</div>)}
            {list(d.broll).length > 0 && <div className="c-muted" style={{ marginTop: 6 }}>B-roll: {list(d.broll).join(' · ')}</div>}
          </Section>
          <Section label="On-screen text" action={<button className="c-btn c-btn-sm" onClick={() => set({ on_screen_text: list(d.on_screen_text).join('\n') })}>Use</button>}>
            {list(d.on_screen_text).map((s, i) => <div key={i}>“{s}”</div>)}
          </Section>
          <Section label="Editing & pacing" action={<button className="c-btn c-btn-sm" onClick={() => set({ edit_notes: d.editing })}>Use</button>}>{d.editing}</Section>
          <Section label="Cover concept" action={<button className="c-btn c-btn-sm" onClick={() => set({ cover_concept: d.cover })}>Use</button>}>{d.cover}</Section>
          {list(d.checklist).length > 0 && (
            <Section label="Production checklist" action={<button className="c-btn c-btn-sm" onClick={() => set({ notes: [item.notes, 'Production checklist:', ...list(d.checklist).map(c => `• ${c}`)].filter(Boolean).join('\n') })}>Add to notes</button>}>
              {list(d.checklist).map((c, i) => <div key={i}>☐ {c}</div>)}
            </Section>
          )}
          {list(d.repurpose).length > 0 && (
            <Section label="Repurpose it">
              {list(d.repurpose).map((r, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <span><strong>{BRANDS[r.brand]?.short || r.brand}</strong> · {FORMATS[r.format]?.label || r.format} — {r.idea}</span>
                  <button className="c-btn c-btn-sm c-btn-ghost" onClick={async () => {
                    await capture(r.idea, BRANDS[r.brand] ? r.brand : item.brand, { format: FORMATS[r.format] ? r.format : null, notes: `Repurposed from: ${item.title}`, source_ref: item.id })
                    toast('Saved to Idea bank', r.idea.slice(0, 60))
                  }}>Save as idea</button>
                </div>
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ label, action, children }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span className="s-field-label" style={{ margin: 0 }}>{label}</span>{action}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.55 }}>{children}</div>
    </div>
  )
}

function Options({ label, options, onUse, pre }) {
  if (!options.length) return null
  return (
    <div>
      <span className="s-field-label">{label}</span>
      {options.map((o, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, justifyContent: 'space-between', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 14, lineHeight: 1.5, whiteSpace: pre ? 'pre-wrap' : 'normal' }}>{o}</span>
          <button className="c-btn c-btn-sm" onClick={() => onUse(o)}>Use</button>
        </div>
      ))}
    </div>
  )
}
