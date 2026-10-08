// ─── Live, read-only feed from the RLC agent portal ──────────────────────────
// The portal stays the single source of truth: nothing is copied here, so an
// edit or cancellation in the portal shows up on the CEO calendar on the next
// refresh, and nothing can duplicate.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { PORTAL_URL, PORTAL_REMINDERS } from './constants.js'
import { toMin } from './recurrence.js'

export const portal = createClient(
  'https://rmpynvmsigwpyhiparqq.supabase.co',
  'sb_publishable_CrjMrils_yUmV8s_I0QvnA_UzBEbL7f',
  {
    // '__' prefix keeps the session out of the dashboard_data cloud sync
    auth: { storageKey: '__rlc_portal_auth', persistSession: true, autoRefreshToken: true },
  },
)

const DEADLINE_FIELDS = [
  ['contract_signing_date', 'Contract signing'],
  ['contract_date', 'Contract'],
  ['inspection_date', 'Inspection'],
  ['appraisal_date', 'Appraisal'],
  ['financing_deadline', 'Financing deadline'],
  ['loan_commitment_deadline', 'Loan commitment'],
  ['earnest_money_due_date', 'Earnest money due'],
  ['title_deadline', 'Title deadline'],
  ['hoa_application_deadline', 'HOA application'],
  ['walkthrough_date', 'Walkthrough'],
  ['closing_date', 'Closing'],
  ['close_date', 'Close'],
  ['move_in_date', 'Move-in'],
]
const CLOSED_STAGES = /closed|complete|lost|cancel|dead|withdrawn/i

const timed = (date, time, minutes) => {
  const start = toMin(time)
  return { date, start, end: start === null ? null : start + minutes, allDay: start === null }
}
const range = (q, col, from, to) => q.gte(col, from).lte(col, to)
const shortAddr = d => (d.address || d.property_address || d.title || d.opportunity_name || 'Deal').split(',')[0]

async function safe(promise) {
  try {
    const { data, error } = await promise
    return error ? [] : data || []
  } catch { return [] }
}

export async function fetchPortalItems(userId, from, to) {
  const [appts, legacy, showings, listingShowings, pipelineAppts, community, deals, dealTasks, contactTasks, posts] =
    await Promise.all([
      safe(range(portal.from('appointments').select('id,title,date,start_time,end_time,contact_name,meeting_location,meeting_url,internal_notes,status').eq('agent_id', userId), 'date', from, to).neq('status', 'cancelled')),
      safe(range(portal.from('calendar_events').select('id,title,type,event_date,event_time,address,notes').eq('agent_id', userId), 'event_date', from, to)),
      safe(range(portal.from('showings').select('id,property_address,showing_date,showing_time,duration_minutes,client_name,status').eq('agent_id', userId), 'showing_date', from, to).neq('status', 'cancelled')),
      safe(range(portal.from('listing_showings').select('id,showing_date,showing_time,agent_name,brokerage_name').eq('agent_id', userId), 'showing_date', from, to)),
      safe(range(portal.from('pipeline_appointments').select('id,title,date,time,location,notes').eq('created_by', userId), 'date', from, to)),
      safe(portal.from('community_events').select('id,title,description,location,event_date').gte('event_date', from).lte('event_date', to + 'T23:59:59')),
      safe(portal.from('deals').select('id,address,property_address,title,opportunity_name,stage,' + DEADLINE_FIELDS.map(f => f[0]).join(',')).limit(1000)),
      safe(range(portal.from('deal_tasks').select('id,deal_id,title,status,due_date').eq('agent_id', userId), 'due_date', from, to)),
      safe(portal.from('contact_tasks').select('id,contact_id,title,status,due_date').eq('agent_id', userId).gte('due_date', from).lte('due_date', to + 'T23:59:59')),
      safe(portal.from('social_posts').select('id,content,platform,scheduled_at,status').eq('agent_id', userId).gte('scheduled_at', from).lte('scheduled_at', to + 'T23:59:59')),
    ])

  const items = []
  const push = (portalType, id, fields) => items.push({
    key: `p:${portalType}:${id}`, source: 'portal', portalType, category: 'brokerage',
    reminders: PORTAL_REMINDERS[portalType] ?? [], ...fields,
  })

  for (const a of appts) {
    const t = timed(a.date, a.start_time, 60)
    if (a.end_time) t.end = toMin(a.end_time)
    push('appointment', a.id, {
      ...t, title: a.title || 'Appointment',
      description: [a.contact_name && `With: ${a.contact_name}`, a.internal_notes].filter(Boolean).join('\n'),
      location: a.meeting_location, meetingUrl: a.meeting_url, href: `${PORTAL_URL}/dashboard/calendar`,
    })
  }
  for (const e of legacy) {
    push('event', e.id, {
      ...timed(e.event_date, e.event_time, 60), title: e.title, description: e.notes,
      location: e.address, href: `${PORTAL_URL}/dashboard/calendar`,
    })
  }
  for (const s of showings) {
    push('showing', s.id, {
      ...timed(s.showing_date, s.showing_time, s.duration_minutes || 30),
      title: `Showing — ${(s.property_address || '').split(',')[0]}`,
      description: s.client_name ? `Client: ${s.client_name}` : '', location: s.property_address,
      href: `${PORTAL_URL}/dashboard/showings`,
    })
  }
  for (const s of listingShowings) {
    push('showing', `l${s.id}`, {
      ...timed(s.showing_date, s.showing_time, 30), title: 'Listing showing',
      description: [s.agent_name, s.brokerage_name].filter(Boolean).join(' · '),
      href: `${PORTAL_URL}/dashboard/showings`,
    })
  }
  for (const p of pipelineAppts) {
    push('pipeline', p.id, {
      ...timed(p.date, p.time, 60), title: p.title, description: p.notes, location: p.location,
      href: `${PORTAL_URL}/dashboard/pipelines`,
    })
  }
  for (const c of community) {
    // timestamptz → local wall clock
    const d = new Date(c.event_date)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const start = d.getHours() * 60 + d.getMinutes()
    push('community', c.id, {
      date, start: start || null, end: start ? start + 60 : null, allDay: !start,
      title: `RLC Event — ${c.title}`, description: c.description, location: c.location,
      href: `${PORTAL_URL}/dashboard/community`,
    })
  }
  for (const d of deals) {
    if (CLOSED_STAGES.test(d.stage || '') && !['closing_date', 'close_date'].some(f => d[f] >= from)) continue
    for (const [field, label] of DEADLINE_FIELDS) {
      const v = d[field] && String(d[field]).slice(0, 10)
      if (!v || v < from || v > to) continue
      push('deadline', `${d.id}:${field}`, {
        date: v, start: null, end: null, allDay: true,
        title: `${label} — ${shortAddr(d)}`, href: `${PORTAL_URL}/dashboard/deals/${d.id}`,
      })
    }
  }
  for (const t of dealTasks) {
    if (/complete|done/i.test(t.status || '')) continue
    push('task', `d${t.id}`, {
      date: String(t.due_date).slice(0, 10), start: null, end: null, allDay: true,
      title: `Task due — ${t.title}`, href: `${PORTAL_URL}/dashboard/deals/${t.deal_id}`,
    })
  }
  for (const t of contactTasks) {
    if (/complete|done/i.test(t.status || '')) continue
    push('task', `c${t.id}`, {
      date: String(t.due_date).slice(0, 10), start: null, end: null, allDay: true,
      title: `Task due — ${t.title}`, href: `${PORTAL_URL}/dashboard/contacts/${t.contact_id}`,
    })
  }
  for (const p of posts) {
    const d = new Date(p.scheduled_at)
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const start = d.getHours() * 60 + d.getMinutes()
    push('post', p.id, {
      date, start, end: start + 15, allDay: false,
      title: `Scheduled post — ${(p.platform || []).join(', ')}`,
      description: p.content, href: `${PORTAL_URL}/dashboard/social`,
    })
  }
  return items
}

/** Headline business numbers for the Today page */
export async function fetchPulse() {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString()
  const [commissions, deals, leads] = await Promise.all([
    safe(portal.from('commissions').select('status,amount,gross_commission,brokerage_net,received_amount,paid_at,received_date').limit(1000)),
    safe(portal.from('deals').select('stage,status').limit(1000)),
    safe(portal.from('leads').select('id').gte('created_at', weekAgo)),
  ])
  const amt = c => Number(c.amount ?? c.gross_commission ?? 0) || 0
  const pending = commissions.filter(c => !/paid|declin|reject|cancel/i.test(c.status || ''))
  const paidThisMonth = commissions.filter(c => (c.received_date || c.paid_at || '') >= monthStart)
  return {
    pendingCount: pending.length,
    pendingTotal: pending.reduce((s, c) => s + amt(c), 0),
    paidMonthTotal: paidThisMonth.reduce((s, c) => s + (Number(c.received_amount) || amt(c)), 0),
    activeDeals: deals.filter(d => !CLOSED_STAGES.test(d.stage || '') && !/closed|lost/i.test(d.status || '')).length,
    newLeads7d: leads.length,
  }
}

// ─── Hooks ───────────────────────────────────────────────────────────────────

export function usePortalSession() {
  const [session, setSession] = useState(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    portal.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = portal.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  const signIn = (email, password) => portal.auth.signInWithPassword({ email, password })
  const signOut = () => portal.auth.signOut()
  return { session, user: session?.user || null, ready, signIn, signOut }
}

/** Portal items for [from, to]; refreshes every 5 min and on window focus */
export function usePortalFeed(from, to) {
  const { user, ready } = usePortalSession()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [lastSync, setLastSync] = useState(null)

  const refresh = useCallback(async () => {
    if (!user) { setItems([]); return }
    setLoading(true)
    const next = await fetchPortalItems(user.id, from, to)
    setItems(next)
    setLastSync(new Date())
    setLoading(false)
  }, [user, from, to])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5 * 60 * 1000)
    window.addEventListener('focus', refresh)
    return () => { clearInterval(t); window.removeEventListener('focus', refresh) }
  }, [refresh])

  return { connected: !!user, ready, items, loading, lastSync, refresh }
}
