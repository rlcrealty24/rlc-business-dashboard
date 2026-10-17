// Numbers for the Finance dashboard. Transfers between your accounts never count as income or spending;
// refunds reduce spending in their category.

export const SPEND = t => t.kind === 'expense' || t.kind === 'refund' || t.kind === 'reimbursement'
const splitSum = (t, parts) => (Array.isArray(t.splits) ? t.splits : []).filter(p => parts.includes(p.part)).reduce((s, p) => s + Number(p.amount || 0), 0)
/** The part of a commission deposit that is actually RLC's / yours (agent portions are owed, not earned) */
export const earnedOf = t => splitSum(t, ['brokerage', 'fee', 'own'])
export const unsplitOf = t => (t.kind === 'commission_in' ? Math.round((t.amount - splitSum(t, ['brokerage', 'fee', 'own', 'agent'])) * 100) / 100 : 0)
const isDraw = t => t.kind === 'transfer' && t.category === 'Owner draw from RLC'
export const inScope = (t, scope) => scope === 'all' || (t.scope || 'personal') === scope
const r2 = n => Math.round(n * 100) / 100
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5)

export function months(txns) { return [...new Set(txns.map(t => t.date.slice(0, 7)))].sort() }

export function monthly(txns, scope) {
  const out = new Map()
  for (const t of txns) {
    if (!inScope(t, scope) || t.status === 'excluded') continue
    const m = t.date.slice(0, 7)
    if (!out.has(m)) out.set(m, { month: m, income: 0, spending: 0, draws: 0, unsplit: 0 })
    const row = out.get(m)
    if (t.kind === 'income') row.income += t.amount
    else if (t.kind === 'commission_in') { row.income += earnedOf(t); row.unsplit += unsplitOf(t) }
    else if (SPEND(t)) row.spending -= t.amount
    else if (scope === 'personal' && isDraw(t)) row.draws += t.amount
  }
  return [...out.values()].sort((a, b) => a.month.localeCompare(b.month)).map(r => ({ ...r, income: r2(r.income), spending: r2(r.spending), draws: r2(r.draws), unsplit: r2(r.unsplit), net: r2(r.income + r.draws - r.spending) }))
}

export function byCategory(txns, scope, month) {
  const out = new Map()
  for (const t of txns) {
    if (!SPEND(t) || !inScope(t, scope) || (month && !t.date.startsWith(month))) continue
    const k = t.category || 'Uncategorized'
    out.set(k, (out.get(k) || 0) - t.amount)
  }
  return [...out.entries()].map(([category, amount]) => ({ category, amount: r2(amount) })).filter(r => r.amount > 0.5).sort((a, b) => b.amount - a.amount)
}

export function topMerchants(txns, scope, month, n = 8) {
  const out = new Map()
  for (const t of txns) {
    if (t.kind !== 'expense' || !inScope(t, scope) || (month && !t.date.startsWith(month))) continue
    const k = t.merchant || t.description
    const r = out.get(k) || { merchant: k, amount: 0, count: 0 }
    r.amount -= t.amount; r.count++
    out.set(k, r)
  }
  return [...out.values()].map(r => ({ ...r, amount: r2(r.amount) })).sort((a, b) => b.amount - a.amount).slice(0, n)
}

/** Latest date of data per account, and overall */
export function freshness(txns, accounts) {
  const per = Object.fromEntries(accounts.map(a => [a.id, null]))
  for (const t of txns) if (!per[t.account_id] || t.date > per[t.account_id]) per[t.account_id] = t.date
  const dates = Object.values(per).filter(Boolean).sort()
  return { per, through: dates[0] || null, latest: dates.at(-1) || null }
}

const SUB_WORDS = /prime|netflix|spotify|hulu|disney|max\b|peacock|paramount|apple\.com|icloud|google|youtube|chatgpt|openai|claude|anthropic|canva|adobe|microsoft|dropbox|cognito|dotloop|monday|zillow|realtor|mls|fitness|gym|chuze|planet fit|insurance|geico|progressive|state farm|xfinity|comcast|verizon|t-mobile|at&t|spectrum|fpl|power|electric|water|rent|loan|instant ink|cribflyer|godaddy|squarespace|wix|hosting/i
const EVERYDAY = /groceries|restaurants|dining|fast food|coffee|mileage|gas|retail|general shopping|meals|entertainment/i

/** Charges that come about once a month at a steady amount, 3+ months running → merchant key → charges */
export function findRecurring(txns) {
  const groups = new Map()
  for (const t of txns) {
    if (t.kind !== 'expense') continue
    const k = (t.merchant || '').toLowerCase()
    if (!k) continue
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(t)
  }
  const out = new Map()
  for (const [k, list] of groups) {
    const months = new Set(list.map(t => t.date.slice(0, 7)))
    if (months.size < 3) continue
    if (EVERYDAY.test(list[0].category || '') && !SUB_WORDS.test(k)) continue
    const amts = list.map(t => Math.abs(t.amount)).sort((a, b) => a - b)
    const mid = amts[Math.floor(amts.length / 2)]
    const steady = list.filter(t => Math.abs(Math.abs(t.amount) - mid) <= Math.max(3, mid * 0.15))
    const steadyMonths = new Set(steady.map(t => t.date.slice(0, 7)))
    if (steadyMonths.size < 3 || steady.length / steadyMonths.size > 1.5 || steady.length < list.length * 0.6) continue
    out.set(k, steady)
  }
  return out
}

/** Repeating charges (subscriptions, bills): typical amount, last charge, price changes, still active? */
export function recurring(txns, scope, dataEnd) {
  return [...findRecurring(txns.filter(t => inScope(t, scope))).values()].map(list => {
    list.sort((a, b) => a.date.localeCompare(b.date))
    const amts = list.map(t => -t.amount)
    const typical = [...amts].sort((a, b) => a - b)[Math.floor(amts.length / 2)]
    const last = list.at(-1)
    return {
      key: (last.merchant || '').toLowerCase(), merchant: last.merchant, category: last.category, scope: last.scope,
      typical: r2(typical), last: last.date, lastAmount: r2(-last.amount), count: list.length,
      monthly: r2(typical), active: dataEnd ? daysBetween(last.date, dataEnd) <= 45 : true,
      increased: -last.amount > typical * 1.1 + 1,
      subscription: typical <= 150 && (/subscription|canva|adobe|chatgpt|cognito/i.test(last.category || '') || SUB_WORDS.test(last.merchant || '')),
    }
  }).sort((a, b) => b.monthly - a.monthly)
}

/** Possible duplicate charges: same merchant + amount within 3 days, not a known recurring charge */
export function duplicates(txns) {
  const out = []
  const rec = new Set([...findRecurring(txns).values()].flat().map(t => t.id))
  const list = txns.filter(t => t.kind === 'expense' && !rec.has(t.id)).sort((a, b) => a.date.localeCompare(b.date))
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && daysBetween(list[i].date, list[j].date) <= 3; j++) {
    const a = list[i], b = list[j]
    if (a.merchant === b.merchant && a.amount === b.amount && a.account_id === b.account_id && Math.abs(a.amount) >= 5) out.push([a, b])
  }
  return out
}

/** Plain-language observations from the numbers — no AI needed */
export function insights({ txns, scope, month, budgets }) {
  const out = []
  const ms = monthly(txns, scope)
  const i = ms.findIndex(m => m.month === month)
  const cur = ms[i], prev = ms.slice(Math.max(0, i - 3), i)
  if (!cur) return out
  const avg = k => prev.length ? prev.reduce((s, m) => s + m[k], 0) / prev.length : null
  const avgSpend = avg('spending')
  if (avgSpend && cur.spending > avgSpend * 1.15) out.push({ level: 'warn', title: `Spending is ${Math.round((cur.spending / avgSpend - 1) * 100)}% above your 3-month average`, body: `$${Math.round(cur.spending).toLocaleString()} vs about $${Math.round(avgSpend).toLocaleString()}.` })
  if (avgSpend && cur.spending < avgSpend * 0.85) out.push({ level: 'good', title: `Spending is ${Math.round((1 - cur.spending / avgSpend) * 100)}% below your 3-month average`, body: 'Nice — keep it there.' })
  if (cur.net < 0) out.push({ level: 'warn', title: `You spent $${Math.round(-cur.net).toLocaleString()} more than came in`, body: 'Negative cash flow this month.' })

  // Category jumps
  const now = byCategory(txns, scope, month)
  const before = prev.map(m => byCategory(txns, scope, m.month))
  for (const c of now.slice(0, 8)) {
    const hist = before.map(list => list.find(x => x.category === c.category)?.amount || 0)
    const a = hist.length ? hist.reduce((s, x) => s + x, 0) / hist.length : 0
    if (a > 50 && c.amount > a * 1.5) out.push({ level: 'warn', title: `${c.category}: $${Math.round(c.amount)} this month`, body: `About $${Math.round(a)} in a usual month.` })
  }
  // Budgets
  for (const b of budgets.filter(b => b.scope === scope || b.scope === 'all' || scope === 'all')) {
    const spent = now.find(c => c.category === b.category)?.amount || 0
    if (spent > b.monthly) out.push({ level: 'warn', title: `Over budget: ${b.category}`, body: `$${Math.round(spent)} of $${Math.round(b.monthly)}.` })
  }
  // Wallets (money that leaves the tracked accounts)
  const wallet = txns.filter(t => t.date.startsWith(month) && t.category === 'Wallet transfer' && t.amount < 0 && inScope(t, scope)).reduce((s, t) => s - t.amount, 0)
  if (wallet > 100) out.push({ level: 'info', title: `$${Math.round(wallet)} moved to Apple Cash / Cash App / PayPal`, body: 'What you buy inside those apps isn’t in your bank files, so real spending is higher than shown.' })
  // Eating out
  const dining = now.filter(c => /restaurant|dining|fast food|coffee|meals/i.test(c.category)).reduce((s, c) => s + c.amount, 0)
  if (dining > 300) out.push({ level: 'info', title: `$${Math.round(dining)} on eating out and coffee`, body: 'A common place to save — even cutting a third saves about $' + Math.round(dining / 3) + ' a month.' })
  return out
}

// ─── RLC Realty: brokerage view ──────────────────────────────────────────────
/** Commission accounting for a period: gross in, owed to agents, earned by RLC, your production, costs, draws */
export function brokerage(txns, from, to) {
  const inP = t => t.date >= from && t.date <= to && t.scope === 'business'
  const r = { gross: 0, agentPortion: 0, rlcEarned: 0, fees: 0, own: 0, otherIncome: 0, unsplit: 0, unsplitCount: 0, payouts: 0, opex: 0, draws: 0, contributions: 0, acquisitions: 0 }
  for (const t of txns.filter(inP)) {
    if (t.kind === 'commission_in') {
      r.gross += t.amount
      r.agentPortion += splitSum(t, ['agent']); r.rlcEarned += splitSum(t, ['brokerage']); r.fees += splitSum(t, ['fee']); r.own += splitSum(t, ['own'])
      const u = unsplitOf(t); if (Math.abs(u) >= 0.01) { r.unsplit += u; r.unsplitCount++ }
    } else if (t.kind === 'income') r.otherIncome += t.amount
    else if (t.kind === 'agent_payout') r.payouts -= t.amount
    else if (SPEND(t)) r.opex -= t.amount
    else if (t.kind === 'owner_draw') r.draws -= t.amount
    else if (t.kind === 'owner_contribution') r.contributions += t.amount
    else if (t.kind === 'acquisition') r.acquisitions -= t.amount
  }
  for (const k of Object.keys(r)) r[k] = r2(r[k])
  r.revenue = r2(r.rlcEarned + r.fees + r.otherIncome)
  r.profit = r2(r.revenue + r.own - r.opex)
  return r
}

/** What each agent was owed (their split of deposits) vs what they were paid — all time */
export function agentLedger(txns) {
  const norm = n => (n || 'Unassigned').trim()
  const key = n => norm(n).toLowerCase()
  const map = new Map()
  const row = n => { const k = key(n); if (!map.has(k)) map.set(k, { agent: norm(n), owed: 0, paid: 0, last: null }); return map.get(k) }
  for (const t of txns) {
    if (t.kind === 'commission_in') for (const p of (t.splits || []).filter(p => p.part === 'agent')) { const a = row(p.agent); a.owed += Number(p.amount || 0); a.last = t.date > (a.last || '') ? t.date : a.last }
    if (t.kind === 'agent_payout') { const a = row(t.counterparty); a.paid -= t.amount; a.last = t.date > (a.last || '') ? t.date : a.last }
  }
  return [...map.values()].map(a => ({ ...a, owed: r2(a.owed), paid: r2(a.paid), balance: r2(a.owed - a.paid) })).sort((a, b) => b.balance - a.balance || b.paid - a.paid)
}
