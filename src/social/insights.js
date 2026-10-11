// What needs attention — shared by Social HQ and the Today page.
import { BRANDS, STAGE_INDEX } from './constants.js'
import { addDays, todayISO, weekStart } from '../ceo/recurrence.js'

const before = (stage, target) => (STAGE_INDEX[stage] ?? 0) < STAGE_INDEX[target]
const stepDone = (i, anchor) => (i.steps || []).filter(s => s.anchor === anchor).every(s => s.done)
const hasStep = (i, anchor) => (i.steps || []).some(s => s.anchor === anchor)

export function marketingSummary(allItems, campaigns, today = todayISO()) {
  const items = allItems.filter(i => !i.archived)
  const in14 = addDays(today, 14)
  const active = items.filter(i => i.stage !== 'idea' && before(i.stage, 'published'))
  const soon = active.filter(i => i.publish_date && i.publish_date <= in14)

  const steps = active.flatMap(i => (i.steps || []).filter(s => !s.done && s.due && s.due <= today && s.anchor !== 'review')
    .map(s => ({ item: i, step: s })))
    .sort((a, b) => a.step.due.localeCompare(b.step.due) || (a.item.publish_date || '').localeCompare(b.item.publish_date || ''))

  const upcoming = active.filter(i => i.publish_date && i.publish_date >= today && i.publish_date <= addDays(today, 7))
    .sort((a, b) => a.publish_date.localeCompare(b.publish_date))

  const needsFootage = soon.filter(i => (hasStep(i, 'gather') && !stepDone(i, 'gather')) || (hasStep(i, 'film') && !stepDone(i, 'film')))
  const needsEditing = soon.filter(i => hasStep(i, 'edit') && !stepDone(i, 'edit') && (!hasStep(i, 'film') || stepDone(i, 'film')))
  const awaitingApproval = active.filter(i => i.approval === 'needs_review' || (hasStep(i, 'approve') && !stepDone(i, 'approve') && stepDone(i, 'edit')))
  const ready = active.filter(i => ['approved', 'scheduled'].includes(i.stage))
  const overduePosts = active.filter(i => i.publish_date && i.publish_date < today)
  const backlog = items.filter(i => i.is_backlog && before(i.stage, 'published'))
  const ideas = items.filter(i => i.stage === 'idea')

  // Weekly load vs. targets
  const ws = weekStart(today), we = addDays(ws, 6)
  const thisWeek = items.filter(i => i.publish_date && i.publish_date >= ws && i.publish_date <= we && i.stage !== 'idea')
  const weekByBrand = Object.fromEntries(Object.keys(BRANDS).map(b => [b, thisWeek.filter(i => i.brand === b).length]))
  const overCapacity = Object.entries(weekByBrand).filter(([b, n]) => n > BRANDS[b].perWeek[1] + (campaigns.some(c => c.status === 'active' && c.brand === b) ? 5 : 0))

  // Month progress
  const monthKey = today.slice(0, 7)
  const publishedAt = i => Object.values(i.versions || {}).map(v => v.published_at).filter(Boolean).sort()[0] || (STAGE_INDEX[i.stage] >= STAGE_INDEX.published ? i.publish_date : null)
  const publishedThisMonth = items.filter(i => (publishedAt(i) || '').startsWith(monthKey))
  const monthByBrand = Object.fromEntries(Object.keys(BRANDS).map(b => [b, publishedThisMonth.filter(i => i.brand === b).length]))
  const recent = items.filter(i => publishedAt(i)).sort((a, b) => publishedAt(b).localeCompare(publishedAt(a))).slice(0, 5)
  const lastPersonal = items.filter(i => i.brand === 'personal' && publishedAt(i)).map(publishedAt).sort().pop() || null

  const leadKeys = ['buyer_leads', 'seller_leads', 'rental_leads', 'recruit_leads', 'inquiries']
  const leadsThisMonth = publishedThisMonth.reduce((s, i) => s + leadKeys.reduce((t, k) => t + (Number(i.metrics?.[k]) || 0), 0), 0)

  return {
    steps, upcoming, needsFootage, needsEditing, awaitingApproval, ready, overduePosts, backlog, ideas,
    thisWeek, weekByBrand, overCapacity, monthByBrand, recent, lastPersonal, leadsThisMonth, publishedAt,
    proposed: campaigns.filter(c => c.status === 'proposed'), activeCampaigns: campaigns.filter(c => c.status === 'active'),
  }
}
