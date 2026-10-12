// ─── Campaign Builder logic ──────────────────────────────────────────────────
import { addDays, parseISO, todayISO } from '../ceo/recurrence.js'
import { buildSteps } from './schedule.js'
import { VIDEO_KINDS } from './constants.js'

export const TEMPLATES = {
  apartments: {
    label: 'Apartment series', brand: 'leasing', type: 'apartments',
    description: 'One apartment video per day (or every other day) across Miami and Denver. Built for rental leads.',
    name: '30 Days, 30 Apartments — Miami + Denver', days: 30, cadence: 'daily',
  },
  listing_launch: {
    label: 'Listing launch', brand: 'rlc', type: 'listing', days: 14,
    description: 'Coming soon → tour → open house → neighborhood → update.',
    posts: [
      { offset: 0, title: 'Coming soon — {name}', format: 'carousel', objective: 'Buyer / seller leads' },
      { offset: 3, title: 'Just listed tour — {name}', format: 'apartment_tour', objective: 'Buyer / seller leads' },
      { offset: 6, title: 'Open house — {name}', format: 'story', objective: 'Buyer / seller leads' },
      { offset: 9, title: 'Neighborhood guide — {name}', format: 'carousel', objective: 'Education' },
      { offset: 13, title: 'Update — {name}', format: 'photo', objective: 'Authority & credibility' },
    ],
  },
  announcement: {
    label: 'Brokerage announcement', brand: 'rlc', type: 'announcement', days: 7,
    description: 'Teaser → reveal → behind the build.',
    posts: [
      { offset: 0, title: 'Teaser — {name}', format: 'story', objective: 'Announcement' },
      { offset: 2, title: 'Reveal — {name}', format: 'announcement', objective: 'Announcement' },
      { offset: 5, title: 'Behind the build — {name}', format: 'lifestyle_reel', objective: 'Client trust' },
    ],
  },
  seasonal: {
    label: 'Seasonal / holiday', brand: 'leasing', type: 'seasonal', days: 14,
    description: 'Warm-up post → main post → last call. Pair it with a marketing date.',
    posts: [
      { offset: 0, title: '{name} — warm-up', format: 'carousel', objective: 'Rental leads' },
      { offset: 7, title: '{name} — main post', format: 'lifestyle_reel', objective: 'Rental leads' },
      { offset: 13, title: '{name} — last call', format: 'story', objective: 'Rental leads' },
    ],
  },
  custom: { label: 'Custom', brand: 'personal', type: 'other', days: 14, description: 'Start empty and attach posts yourself.', posts: [] },
}

export const CADENCES = { daily: 'Every day', every_other: 'Every other day', weekdays: 'Weekdays only' }

export function campaignDates(start, days, cadence = 'daily') {
  const out = []
  for (let i = 0; i < days; i++) {
    const d = addDays(start, i)
    const dow = parseISO(d).getDay()
    if (cadence === 'every_other' && i % 2) continue
    if (cadence === 'weekdays' && (dow === 0 || dow === 6)) continue
    out.push(d)
  }
  return out
}

/** Does this apartment already have footage? (library video tagged with it, a listing video, or marked filmed) */
export function hasFootage(apt, assets) {
  if (apt.footage === 'have' || apt.footage === 'filmed' || apt.video_url) return true
  const name = (apt.name || '').toLowerCase()
  return assets.some(a => VIDEO_KINDS.has(a.kind) && (a.property || '').toLowerCase() === name)
}
export const footageAssets = (apt, assets) =>
  assets.filter(a => (a.property || '').toLowerCase() === (apt.name || '').toLowerCase())

/** Fill empty dates: footage on hand first, specials/hot deals next, alternating Miami and Denver */
export function autoAssign(schedule, apartments, assets) {
  const used = new Set(schedule.map(r => r.aptKey).filter(Boolean))
  const score = a => (hasFootage(a, assets) ? 0 : 10) + (a.special || a.is_hot_deal ? 0 : 1)
  const pools = {}
  for (const a of apartments.filter(a => !used.has(a.key)).sort((x, y) => score(x) - score(y))) {
    (pools[a.market || 'Other'] ||= []).push(a)
  }
  const order = Object.keys(pools).sort((a, b) => pools[b].length - pools[a].length)
  let turn = 0
  return schedule.map(r => {
    if (r.aptKey || r.item_id) return r
    for (let k = 0; k < order.length; k++) {
      const pool = pools[order[(turn + k) % order.length]]
      if (pool?.length) { turn = (turn + k + 1) % order.length; return { ...r, aptKey: pool.shift().key } }
    }
    return r
  })
}

/** Group apartments that still need filming into as few sessions as possible (Film days first, never weekends) */
export function filmingSessions(schedule, apartments, assets, slots, filmedKeys = new Set()) {
  const today = todayISO()
  const byKey = new Map(apartments.map(a => [a.key, a]))
  const weekday = d => { const w = parseISO(d).getDay(); return w !== 0 && w !== 6 }
  const sessions = []
  const seen = new Set()
  for (const r of [...schedule].sort((a, b) => a.date.localeCompare(b.date))) {
    const apt = byKey.get(r.aptKey)
    if (!apt || seen.has(apt.key) || hasFootage(apt, assets) || filmedKeys.has(apt.key)) continue
    seen.add(apt.key)
    const market = apt.market || 'Other'
    const latest = addDays(r.date, -3)   // film at least 3 days before it posts
    // Join an existing session for this market if it's still early enough
    const join = sessions.find(s => s.market === market && s.date >= today && s.date <= latest)
    if (join) { join.apartments.push(apt); continue }
    let day = [...slots.film].reverse().find(d => d >= today && d <= latest)
    if (!day) { day = latest; while (day >= today && !weekday(day)) day = addDays(day, -1) }
    const late = !day || day < today
    sessions.push({ date: late ? today : day, market, apartments: [apt], late })
  }
  return sessions.sort((a, b) => a.date.localeCompare(b.date))
}

/** Pre-launch problems worth fixing */
export function launchFlags(config, assets) {
  const flags = []
  const rows = config.schedule || []
  const apts = config.apartments || []
  const empty = rows.filter(r => !r.aptKey).length
  if (empty) flags.push({ tone: 'red', text: `${empty} date${empty > 1 ? 's have' : ' has'} no apartment yet — add ${empty} more apartment${empty > 1 ? 's' : ''} or shorten the campaign.` })
  const counts = {}
  for (const r of rows) if (r.aptKey) counts[r.aptKey] = (counts[r.aptKey] || 0) + 1
  const dupes = Object.values(counts).filter(n => n > 1).length
  if (dupes) flags.push({ tone: 'warn', text: `${dupes} apartment${dupes > 1 ? 's are' : ' is'} scheduled more than once.` })
  const noFootage = apts.filter(a => rows.some(r => r.aptKey === a.key) && !hasFootage(a, assets)).length
  if (noFootage) flags.push({ tone: 'warn', text: `${noFootage} apartment${noFootage > 1 ? 's need' : ' needs'} a tour filmed — see the filming plan.` })
  const noCopy = rows.filter(r => r.aptKey && !r.hook).length
  if (noCopy) flags.push({ tone: '', text: `${noCopy} post${noCopy > 1 ? 's have' : ' has'} no hook/caption yet — generate them or write your own.` })
  const unverified = apts.filter(a => rows.some(r => r.aptKey === a.key) && !a.verified).length
  if (unverified) flags.push({ tone: '', text: `${unverified} apartment${unverified > 1 ? 's' : ''} without verified pricing/special — each post also re-checks the day before it goes out.` })
  return flags
}

/** Content items to create at launch (apartment series) */
export function apartmentPosts(campaign, assets, filmDates = new Map()) {
  const cfg = campaign.config || {}
  const byKey = new Map((cfg.apartments || []).map(a => [a.key, a]))
  return (cfg.schedule || []).filter(r => r.aptKey && !r.item_id).map(r => {
    const apt = byKey.get(r.aptKey)
    const footage = hasFootage(apt, assets)
    const filmOn = filmDates.get(r.aptKey)
    const steps = buildSteps('apartment_tour').map(s => {
      if (s.key !== 'film') return s
      if (footage) return { ...s, done: true, items: s.items.map(x => ({ ...x, done: true })) }
      // Same day as the batch filming session in the campaign's filming plan
      return filmOn ? { ...s, due: filmOn, fixed: true } : s
    })
    return {
      rowKey: r.key,
      item: {
        title: `${apt.name} — apartment tour`, brand: 'leasing', format: 'apartment_tour', platforms: ['instagram', 'tiktok'],
        campaign_id: campaign.id, publish_date: r.date, stage: 'planned', objective: 'Rental leads', effort: 'medium',
        pillar: apt.market === 'Denver' ? 'Denver rentals' : apt.market === 'Miami' ? 'Miami rentals' : 'Apartment tours',
        hook: r.hook || null, caption: r.caption || null, cta: r.cta || null, on_screen_text: r.on_screen_text || null,
        steps, source: 'campaign', source_ref: campaign.id,
        assets: footageAssets(apt, assets).map(a => ({ asset_id: a.id })),
        notes: [`${apt.name}${apt.area ? ` · ${apt.area}` : ''} · ${apt.market || ''}`, apt.prices && `Pricing: ${apt.prices}`,
          apt.special && `Special: ${apt.special}`, apt.notes, 'Verify pricing, special and availability before publishing.'].filter(Boolean).join('\n'),
      },
    }
  })
}

/** Posts for template campaigns (non-apartment) */
export function templatePosts(campaign) {
  const tpl = TEMPLATES[campaign.config?.template] || TEMPLATES.custom
  const start = campaign.start_date || todayISO()
  const name = campaign.config?.subject || campaign.name
  return (tpl.posts || []).map(p => ({
    title: p.title.replace('{name}', name), brand: campaign.brand, format: p.format, objective: p.objective,
    platforms: ['instagram'], campaign_id: campaign.id, publish_date: addDays(start, p.offset), stage: 'planned',
    source: 'campaign', source_ref: campaign.id,
  }))
}

/** Results across the campaign's posts */
export function campaignResults(items) {
  const keys = ['views', 'saves', 'shares', 'inquiries', 'rental_leads', 'buyer_leads', 'seller_leads', 'appointments']
  const totals = Object.fromEntries(keys.map(k => [k, 0]))
  let posted = 0, withData = 0
  for (const i of items) {
    if (['published', 'reviewed'].includes(i.stage) || Object.values(i.versions || {}).some(v => v.status === 'published')) posted++
    if (keys.some(k => i.metrics?.[k] != null)) withData++
    for (const k of keys) totals[k] += Number(i.metrics?.[k]) || 0
  }
  return { totals, posted, withData, total: items.length }
}
