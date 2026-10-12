import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useSocial } from './SocialStore.jsx'
import { useClosedDeals } from './portalData.js'
import { useLeasingListings } from './leasing.js'
import { buildSuggestions } from './suggestions.js'
import { toast } from '../ceo/ui.jsx'
import { addDays, fmtDate, todayISO } from '../ceo/recurrence.js'

const MAX_SHOWN = 5   // never a wall of nagging

export function useSuggestions() {
  const social = useSocial()
  const { deals } = useClosedDeals()
  const { listings, loading: listingsLoading, error: listingsError } = useLeasingListings()
  const [settings] = useLocalStorage('social_settings', {})
  const [insights] = useLocalStorage('social_insights', {})
  const [dismissed, setDismissed] = useLocalStorage('social_dismissed', {})
  const navigate = useNavigate()
  const today = todayISO()
  const perWeek = { personal: 1, rlc: 2, leasing: 2, ...(settings?.perWeek || {}) }

  const all = useMemo(() => buildSuggestions({
    items: social.items, campaigns: social.campaigns, assets: social.assets, slots: social.slots, deals,
    listings, listingsLoaded: !listingsLoading && !listingsError, insights, perWeek, today,
  }), [social.items, social.campaigns, social.assets, social.slots, deals, listings, listingsLoading, listingsError, insights, settings, today]) // eslint-disable-line react-hooks/exhaustive-deps

  const visible = all.filter(s => { const d = dismissed?.[s.id]; return !d || (d !== 'forever' && d <= today) })
  const mark = (id, value) => setDismissed(prev => {
    // keep the store small: drop expired snoozes
    const next = Object.fromEntries(Object.entries(prev || {}).filter(([, v]) => v === 'forever' || v > today))
    return { ...next, [id]: value }
  })

  async function run(s) {
    const a = s.action
    switch (a.kind) {
      case 'plan': await social.updateItem(a.itemId, { publish_date: a.date, format: a.format }); toast('Planned', `${fmtDate(a.date)} — prep steps are on your calendar`); break
      case 'deal': {
        const row = await social.saveItem({
          title: `${a.deal.kind === 'lease' ? 'Just leased' : 'Just closed'} — ${a.deal.label}`, brand: 'rlc', stage: 'idea', format: 'transaction_story',
          platforms: ['instagram', 'facebook'], pillar: 'Transactions', objective: 'Authority & credibility', priority: 'high',
          timeliness: 'timely', lead_potential: 'high', source: 'deal', source_ref: a.deal.id,
          notes: `Closed ${fmtDate(a.deal.date)} (internal — confirm what's shareable).`,
        })
        toast('Saved as an idea', 'Open it and press Develop with AI to turn it into a story')
        navigate(`/social/post/${row.id}`); break
      }
      case 'filmed': await social.toggleStep(a.itemId, 'film'); toast('Marked filmed', 'Next up: editing'); break
      case 'batch': for (const st of a.steps) await social.setStepDate(st.itemId, st.key, a.day); toast('Shoots batched', `All on ${fmtDate(a.day)}`); break
      case 'move': await social.updateItem(a.itemId, { publish_date: a.date }); toast('Moved', `${fmtDate(a.date)} — prep moved too`); break
      case 'open': navigate(`/social/post/${a.itemId}`); return
      case 'campaign': navigate(`/social/campaigns/${a.campaignId}`); return
      case 'nav': navigate(a.to); return
      default: return
    }
    mark(s.id, 'forever')   // handled
  }

  return {
    suggestions: visible.slice(0, MAX_SHOWN), total: visible.length, run,
    dismiss: s => mark(s.id, 'forever'), snooze: s => { mark(s.id, addDays(today, 7)); toast('Snoozed', 'Back in a week if it still applies') },
  }
}

export default function SuggestionsCard({ compact = false }) {
  const { suggestions, total, run, dismiss, snooze } = useSuggestions()
  if (!suggestions.length) return compact ? null : (
    <div className="c-card"><div className="c-card-head"><div className="c-card-title">Suggestions</div></div><div className="c-empty">Nothing to suggest right now. You&apos;re on track.</div></div>
  )
  const list = compact ? suggestions.slice(0, 1) : suggestions
  return (
    <div className="c-card" style={{ borderColor: 'var(--sky)' }}>
      <div className="c-card-head" style={{ background: 'var(--sky-soft)' }}>
        <div className="c-card-title">{compact ? 'Suggestion' : 'Suggestions'}</div>
        <span className="c-muted" style={{ fontSize: 12 }}>{total > list.length ? `${list.length} of ${total} · ` : ''}nothing changes until you click</span>
      </div>
      {list.map(s => (
        <div key={s.id} style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14, fontWeight: 500 }}>{s.title}</div>
          <div className="c-muted" style={{ fontSize: 13, marginTop: 3, lineHeight: 1.5 }}>{s.body}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <button className="c-btn c-btn-sky c-btn-sm" onClick={() => run(s)}>{s.action.label}</button>
            <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => snooze(s)}>Snooze 7 days</button>
            <button className="c-btn c-btn-ghost c-btn-sm" onClick={() => dismiss(s)}>Dismiss</button>
          </div>
        </div>
      ))}
    </div>
  )
}
