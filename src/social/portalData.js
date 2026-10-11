// Read-only portal data for Social HQ (agents, closed deals). Uses the same
// portal session as the CEO calendar; nothing is copied or written back.
import { useEffect, useState } from 'react'
import { portal, usePortalSession } from '../ceo/portal.js'

const CLOSED = /closed|complete|move-in|moved in|leased|funded|sold/i

export function usePortalAgents() {
  const { user } = usePortalSession()
  const [agents, setAgents] = useState([])
  useEffect(() => {
    if (!user) return
    portal.from('profiles').select('id, full_name, preferred_name, instagram_handle, tiktok_handle, headshot_url, photo_url, role, status')
      .order('full_name')
      .then(({ data }) => setAgents((data || []).filter(a => a.full_name)))
  }, [user])
  return { connected: !!user, agents }
}

/** Closed / completed deals with agent names, newest first */
export function useClosedDeals() {
  const { user } = usePortalSession()
  const [state, setState] = useState({ loading: true, deals: [] })
  useEffect(() => {
    if (!user) { setState({ loading: false, deals: [] }); return }
    let cancelled = false
    ;(async () => {
      const [{ data: deals }, { data: people }] = await Promise.all([
        portal.from('deals').select(DEAL_COLUMNS).limit(1000),
        portal.from('profiles').select('id, full_name, preferred_name'),
      ])
      if (cancelled) return
      const closed = mapClosedDeals(deals, people)
      setState({ loading: false, deals: closed })
    })()
    return () => { cancelled = true }
  }, [user])
  return { connected: !!user, ...state }
}

export const DEAL_COLUMNS = 'id, title, address, property_address, building_name, unit_number, stage, status, deal_type, track, type, monthly_rent, price, contract_price, close_date, closing_date, move_in_date, agent_id, owner_agent_id'

/** Raw portal deals + profiles → closed transactions with agent names, newest first */
export function mapClosedDeals(deals, people) {
  const names = new Map((people || []).map(p => [p.id, p.preferred_name || p.full_name]))
  const today = new Date().toISOString().slice(0, 10)
  return (deals || []).map(d => {
    const date = [d.close_date, d.closing_date, d.move_in_date].filter(Boolean).map(x => String(x).slice(0, 10)).sort().pop() || null
    const kind = /rent|lease/i.test(`${d.deal_type} ${d.track} ${d.type} ${d.stage}`) || d.monthly_rent ? 'lease' : 'sale'
    return {
      id: d.id, date, kind,
      label: d.building_name ? `${d.building_name}${d.unit_number ? ` #${d.unit_number}` : ''}`
    : (d.property_address || d.address || d.title || 'Transaction').split(',')[0],
      agentId: d.owner_agent_id || d.agent_id,
      agent: names.get(d.owner_agent_id || d.agent_id) || 'Unassigned',
      stage: d.stage,
      isClosed: CLOSED.test(`${d.stage} ${d.status}`) || (date && date <= today && /contract|application/i.test(d.stage || '') === false),
    }
  }).filter(d => d.isClosed).sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}
