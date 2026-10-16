// Commission records from the RLC portal CRM — read-only, through the portal session the
// Today page already uses. Used only to SUGGEST how a bank deposit splits; you confirm each one.
import { useEffect, useState } from 'react'
import { portal, usePortalSession } from '../ceo/portal.js'
import { DEAL_COLUMNS, mapClosedDeals } from '../social/portalData.js'

const num = (...v) => { for (const x of v) { const n = Number(x); if (x !== null && x !== undefined && x !== '' && !isNaN(n)) return n } return null }

export function useCrmCommissions() {
  const { user } = usePortalSession()
  const [state, setState] = useState({ connected: false, items: [], agents: [] })
  useEffect(() => {
    if (!user) { setState({ connected: false, items: [], agents: [] }); return }
    let cancelled = false
    ;(async () => {
      const [c, d, p] = await Promise.all([
        portal.from('commissions').select('*').limit(2000),
        portal.from('deals').select(DEAL_COLUMNS).limit(2000),
        portal.from('profiles').select('id, full_name, preferred_name, role, status'),
      ])
      if (cancelled) return
      const people = p.data || []
      const name = id => { const x = people.find(q => q.id === id); return x ? (x.preferred_name || x.full_name) : null }
      const deals = new Map(mapClosedDeals(d.data || [], people).map(x => [x.id, x]))
      const items = (c.data || []).map(r => {
        const gross = num(r.gross_commission, r.amount, r.received_amount, r.total_commission)
        const brokerageNet = num(r.brokerage_net, r.company_dollar, r.brokerage_amount, r.house_split)
        const agentAmount = num(r.agent_net, r.agent_amount, r.agent_commission, r.agent_payout, r.agent_split_amount) ?? (gross != null && brokerageNet != null ? gross - brokerageNet : null)
        const deal = deals.get(r.deal_id)
        const agent = name(r.agent_id) || deal?.agent || null
        return {
          id: r.id, amount: gross ?? 0, received: num(r.received_amount),
          date: String(r.received_date || r.paid_at || deal?.date || r.created_at || '').slice(0, 10) || null,
          agent, agentAmount, own: /royanna/i.test(agent || ''), label: deal?.label || r.title || r.property_address || 'Commission',
          status: r.status || null,
        }
      }).filter(x => x.amount)
      const agents = people.filter(x => (x.full_name || x.preferred_name) && !/inactive|deactivated/i.test(x.status || '')).map(x => x.preferred_name || x.full_name)
      setState({ connected: true, items, agents })
    })().catch(() => { if (!cancelled) setState({ connected: true, items: [], agents: [] }) })
    return () => { cancelled = true }
  }, [user])
  return state
}
