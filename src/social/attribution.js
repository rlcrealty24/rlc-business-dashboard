// Verified social leads: CRM records (RLC portal, read-only, your portal login)
// that carry a "via <platform>/<code>" tag from a Social HQ tracking link.
// Only dates, sources and codes are read — no names or contact details.
import { useEffect, useState } from 'react'
import { portal, usePortalSession } from '../ceo/portal.js'
import { parseVia } from './tracking.js'

let cache = { at: 0, leads: null }
const TTL = 2 * 60 * 1000

async function fetchVerified() {
  if (cache.leads && Date.now() - cache.at < TTL) return cache.leads
  const [leads, contacts, subs] = await Promise.all([
    portal.from('leads').select('id, created_at, source').ilike('source', '%via %').limit(1000),
    portal.from('contacts').select('id, created_at, lead_source, contact_source')
      .or('lead_source.ilike.%via %,contact_source.ilike.%via %').limit(1000),
    portal.from('form_submissions').select('id, submitted_at, data').order('submitted_at', { ascending: false }).limit(1000),
  ])
  const out = []
  const seen = new Set()
  const add = (from, at, text) => {
    for (const v of parseVia(text)) {
      // the same inquiry can land as a form submission AND a contact — count it once per hour
      const key = `${v.code}|${String(at || '').slice(0, 13)}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ ...v, at, from })
    }
  }
  for (const s of subs.data || []) add('Form submission', s.submitted_at, JSON.stringify(s.data || {}))
  for (const l of leads.data || []) add('CRM lead', l.created_at, l.source)
  for (const c of contacts.data || []) add('CRM contact', c.created_at, `${c.lead_source || ''} ${c.contact_source || ''}`)
  out.sort((a, b) => String(b.at).localeCompare(String(a.at)))
  cache = { at: Date.now(), leads: out }
  return out
}

/** { connected, loading, leads: [{code, platform, at, from}], byCode: Map<code, lead[]> } */
export function useVerifiedLeads() {
  const { user, ready } = usePortalSession()
  const [state, setState] = useState({ loading: true, leads: cache.leads || [] })
  useEffect(() => {
    if (!ready) return
    if (!user) { setState({ loading: false, leads: [] }); return }
    let cancelled = false
    fetchVerified().then(leads => { if (!cancelled) setState({ loading: false, leads }) })
      .catch(() => { if (!cancelled) setState({ loading: false, leads: [] }) })
    return () => { cancelled = true }
  }, [user, ready])
  const byCode = new Map()
  for (const l of state.leads) { if (!byCode.has(l.code)) byCode.set(l.code, []); byCode.get(l.code).push(l) }
  return { connected: !!user, ...state, byCode }
}
