// ─── Finance engine ──────────────────────────────────────────────────────────
// Pure functions shared by the statement importer (Node) and the Finance page.
// Bank CSV → normalized transactions → kind, category, scope, transfers, recurring.
import Papa from 'papaparse'
import { matchVendor } from './vendorMap.js'
import { findRecurring } from './analytics.js'

// Your accounts. Money moving between any of these is a transfer, never income or spending.
// `excluded` accounts (escrow) never appear in reports.
export const ACCOUNTS = [
  { id: 'nfcu-8634', name: 'NFCU Checking 8634', institution: 'Navy Federal', type: 'checking', last4: '8634', scope: 'personal', sort: 1 },
  { id: 'nfcu-2022', name: 'NFCU Checking 2022', institution: 'Navy Federal', type: 'checking', last4: '2022', scope: 'personal', sort: 2 },
  { id: 'nfcu-7027', name: 'NFCU Savings 7027', institution: 'Navy Federal', type: 'savings', last4: '7027', scope: 'personal', sort: 3 },
  { id: 'nfcu-amex', name: 'NFCU Amex', institution: 'Navy Federal', type: 'credit_card', last4: null, scope: 'personal', sort: 4 },
  { id: 'truist-1073', name: 'Truist RLC Operating', institution: 'Truist', type: 'checking', last4: '1073', scope: 'business', sort: 5 },
  { id: 'bofa-escrow', name: 'BofA Escrow', institution: 'Bank of America', type: 'checking', last4: null, scope: 'business', sort: 9, excluded: true },
]
// Other NFCU cards seen in transfers (a payment to them is a card payment, not spending)
const OWN_LAST4 = ['8634', '2022', '7027', '3018', '3959', '1073']

const iso = s => {
  const m = String(s || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  return /^\d{4}-\d{2}-\d{2}/.test(s || '') ? s.slice(0, 10) : null
}
const money = s => {
  const t = String(s ?? '').trim()
  if (!t) return null
  const neg = /^\(.*\)$/.test(t) || t.startsWith('-')
  const n = parseFloat(t.replace(/[()$,\s-]/g, ''))
  return isNaN(n) ? null : (neg ? -n : n)
}
const r2 = n => Math.round(n * 100) / 100

/** Read one bank CSV. Returns { format, rows } — rows already signed (+ in, − out). */
export function parseCsv(text) {
  const { data, meta } = Papa.parse(text.replace(/^﻿/, ''), { header: true, skipEmptyLines: true })
  const f = meta.fields || []
  if (f.includes('Credit Debit Indicator')) {          // Navy Federal (checking, savings, credit cards)
    return {
      format: 'nfcu',
      rows: data.map(r => ({
        date: iso(r['Transaction Date']) || iso(r['Posting Date']), posted: iso(r['Posting Date']),
        amount: r2((money(r.Amount) || 0) * (/credit/i.test(r['Credit Debit Indicator']) ? 1 : -1)),
        description: (r.Description || '').trim(), bankType: r.type || '', bankCategory: r.Category || '',
        merchantHint: '', balance: null, card: r['Card Ending'] || '',
      })).filter(r => r.date && r.amount),
    }
  }
  if (f.includes('Full description')) {               // Truist
    return {
      format: 'truist',
      rows: data.map(r => ({
        date: iso(r['Transaction Date']) || iso(r['Posted Date']), posted: iso(r['Posted Date']),
        amount: r2(money(r.Amount) || 0), description: (r['Full description'] || '').trim(),
        bankType: r['Transaction Type'] || '', bankCategory: r['Category name'] || '',
        merchantHint: (r['Merchant name'] || '').trim(), balance: money(r['Daily Posted Balance']),
      })).filter(r => r.date && r.amount),
    }
  }
  // Generic fallback: Date / Description / Amount (or Debit + Credit)
  const pick = (r, ...names) => { for (const n of f) if (names.some(x => n.toLowerCase().includes(x))) return r[n]; return '' }
  return {
    format: 'generic',
    rows: data.map(r => {
      const amt = money(pick(r, 'amount'))
      const debit = money(pick(r, 'debit')), credit = money(pick(r, 'credit'))
      return {
        date: iso(pick(r, 'transaction date', 'date')), posted: iso(pick(r, 'post', 'date')),
        amount: r2(amt ?? ((credit || 0) - Math.abs(debit || 0))), description: String(pick(r, 'description', 'payee', 'name')).trim(),
        bankType: '', bankCategory: String(pick(r, 'category')), merchantHint: '', balance: money(pick(r, 'balance')),
      }
    }).filter(r => r.date && r.amount),
  }
}

/** Which account a file belongs to — from the folder/file name first, then the format */
export function accountForFile(path, format) {
  const p = path.toLowerCase()
  if (/escrow|bofa|bank of america/.test(p)) return 'bofa-escrow'
  if (/truist|acct_1073|1073/.test(p) || format === 'truist') return 'truist-1073'
  if (/amex|american express|3018|3959/.test(p)) return 'nfcu-amex'
  for (const a of ACCOUNTS) if (a.last4 && p.includes(a.last4)) return a.id
  if (/saving/.test(p)) return 'nfcu-7027'
  return null
}

/** Short, readable merchant name from a bank description */
export function merchantOf(row) {
  if (row.merchantHint) return row.merchantHint
  let d = row.description
    .replace(/\b(DEBIT CARD (PURCHASE|RECURRING PYMT|RETURN)|POS PURCHASE|PURCHASE|RECURRING|PAYMENT ID \S+.*$)/gi, '')
    .replace(/^(Payment to|Paid to|DEBIT-DC \d+ \S+)\s*/i, '')
    .replace(/\b\d{2}-\d{2}\b.*$/, '')            // Truist "03-01 CITY ST 7987 …"
    .replace(/[#*]\s*\d+/g, '').replace(/\s{2,}/g, ' ').trim()
  if (!d) d = row.description
  return d.length > 40 ? d.slice(0, 40).trim() : d.replace(/\b\w/g, c => c.toUpperCase()).replace(/\B\w+/g, w => w.toLowerCase())
}

export const SUB_BUSINESS = /canva|chatgpt|openai|anthropic|claude\.ai|adobe|cognito|coffee ?(&|and) ?contracts|dotloop|monday\.com|cribflyer|godaddy|squarespace|wix\.com|webflow|microsoft|google ?workspace|gsuite|zoom\.us|zoom subscription|calendly|higgsfield|merchant bankcard|anytime mailbox|docusign|showingtime|kvcore|follow ?up ?boss|mailchimp|hubspot|notion|dropbox|slack/
export const SUB_PERSONAL = /hulu|netflix|prime video|primevideo|amazon prime|spotify|disney|hbo|max\.com|peacock|paramount|youtube premium|apple\.com\/bill|icloud|walmart ?(plus|\+)|boost membership|audible|kindle unlimited/

// Bank's own category → your category (used when no rule matches)
const BANK_CATEGORY = {
  'general merchandise': 'Retail & General Shopping', 'restaurants/dining': 'Restaurants/Dining Out', 'gasoline/fuel': 'Mileage/Gas',
  'electronics': 'Retail & General Shopping', 'travel': 'Travel - Transportation', 'groceries': 'Groceries', 'dues and subscriptions': 'Subscriptions',
  'cable/satellite services': 'Home & Household', 'entertainment': 'Entertainment & Fun',
  'printing': 'Printing/Branding', 'service charges/fees': 'Bank Service Fees', 'hobbies': 'Entertainment & Fun', 'personal care': 'Beauty/Haircare',
  'clothing/shoes': 'Retail & General Shopping', 'healthcare/medical': 'Health & Wellness', 'home improvement': 'Home & Household',
  'utilities': 'Home & Household', 'telephone services': 'Home & Household', 'postage and shipping': 'Supplies',
  // Truist
  'office supplies & equipment': 'Supplies', 'food & catering': 'Meals (Business-Related)', 'vehicle expenses': 'Mileage/Gas',
  'travel expenses': 'Travel - Transportation', 'taxes & fees': 'Bank Service Fees', 'charitable giving': 'Other',  'wellness & welfare': 'Health & Wellness', 'professional & legal services': 'Accounting/Professional Fees',
}

/**
 * Classify one row → { kind, category, scope, status, review_reason }
 * kind: income | expense | refund | transfer
 *   business-only: commission_in (gross commission deposit — revenue only once split),
 *   agent_payout (pays down what's owed to an agent — never an expense),
 *   owner_draw / owner_contribution (you ↔ RLC — never revenue, expense or new earnings),
 *   reimbursement (money paying back a cost — not income),
 *   acquisition (property / loan / rehab money — tracked apart from brokerage costs and everyday spending)
 */
export const KIND_LABELS = {
  income: 'Income', expense: 'Expense', refund: 'Refund', transfer: 'Transfer (own accounts)',
  commission_in: 'Commission deposit (gross)', agent_payout: 'Agent payout', owner_draw: 'Owner draw (RLC → you)',
  owner_contribution: 'Owner contribution (you → RLC)', reimbursement: 'Reimbursement',
  acquisition: 'Acquisition / investment (loans, properties)',
}
/** Payee/payer name from a Truist Zelle line: "ARMANDO PAYMENT ID …" → "Armando" */
export function counterpartyOf(desc) {
  const m = String(desc || '').match(/^(.+?) PAYMENT ID/i)
  return m ? m[1].trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase()) : null
}
export function classify(row, account, { categories, rules = [] }) {
  const d = row.description.toLowerCase()
  const catKind = name => categories.find(c => c.name === name)?.kind
  const out = (kind, category, extra = {}) => {
    const k = catKind(category)
    const scope = extra.scope || (k === 'business' ? 'business' : k === 'personal' ? 'personal' : account.scope)
    return { kind, category: category || null, scope, status: 'ok', review_reason: null, ...extra }
  }
  const review = (kind, category, reason, extra = {}) => out(kind, category, { status: 'review', review_reason: reason, ...extra })

  // 1. Your own rules always win
  const rule = rules.find(r => r.match && d.includes(r.match.toLowerCase()))
  if (rule) return out(rule.kind || (row.amount > 0 ? 'income' : 'expense'), rule.category, rule.scope ? { scope: rule.scope } : {})

  // 2. You ↔ RLC (owner draws and contributions) — never revenue, expense or new earnings
  const isMe = /royanna|royanba|nfcu personal/.test(d)
  if (account.scope === 'business' && isMe) {
    if (row.amount < 0) return out('owner_draw', 'Owner Draw/Personal Use', { scope: 'business' })
    if (/reversal/.test(d)) return out('owner_draw', 'Owner Draw/Personal Use', { scope: 'business', review_reason: null })   // a draw that bounced back
    return out('owner_contribution', 'Owner contribution to RLC', { scope: 'business' })
  }
  if (account.scope !== 'business' && /cash app\W*royanna/.test(d)) return out('transfer', 'Wallet transfer', { wallet: true })

  // 3. Money moving between your own accounts
  const ownLast4 = (d.match(/-(\d{4})\b/) || [])[1]
  if (/transfer (to|from) credit card/.test(d)) return out('transfer', 'Credit Card Payment')
  if (/transfer (to|from) (checking|savings|shares)/.test(d) && (!ownLast4 || OWN_LAST4.includes(ownLast4)) && !/tfr (fr|to) other|trf to other/.test(d))
    return out('transfer', /saving/.test(d) ? 'Personal Savings' : 'Transfer')
  const m = (row.merchantHint || '').toLowerCase()
  if (/(apple cash|cash app|paypal|venmo)/.test(d) && (/transfer|instant|add money|cash out|deposit/.test(d) || /^(apple cash|cash app|paypal|venmo)$/.test(m || d.trim())))
    return out('transfer', 'Wallet transfer', { wallet: true })
  if (/^cash app \w/.test(m || d)) return review(row.amount > 0 ? 'income' : 'expense', null, row.amount > 0 ? 'Cash App received — who from, and what for?' : 'Cash App payment to a person — what for?')
  if (/reversal|claims adj/.test(d) && row.amount > 0) return out('refund', 'Other Refund / Credit')

  // 4. Business account: commissions in, agents paid out — split/confirm, never assume
  if (account.scope === 'business') {
    const who = counterpartyOf(row.description)
    if (row.amount > 0 && (/^(mobile )?deposit\b|wire|amli|wynd|westminster|yardi|residential|apartment|coupa|realpage|entrata|title|closing|escrow/.test(d) || /deposit/i.test(row.bankType || '')))
      return review('commission_in', 'Commission Income', 'Commission deposit — split it between agent, RLC and you', { scope: 'business' })
    if (row.amount > 0 && who) return review('income', null, 'Zelle received on Truist — commission, agent fee or reimbursement?', { scope: 'business', counterparty: who })
    if (row.amount < 0 && who) return review('agent_payout', 'Agent Commission', 'Paid out from Truist — agent commission payout?', { scope: 'business', counterparty: who })
    if (row.amount < 0 && /bus online ach settlement/.test(d)) return review('agent_payout', 'Agent Commission', 'ACH batch — which agent(s) was this paid to?', { scope: 'business' })
    if (row.amount < 0 && /return deposit item|returned item/.test(d)) return review('commission_in', 'Commission Income', 'A deposited check came back — which deposit was it?', { scope: 'business' })
  }

  // 5. Zelle — people, not stores: needs you to say what it was
  if (/zelle/.test(d)) {
    if (row.amount > 0) return review('income', null, 'Zelle received — who from, and what for?')
    return review('expense', null, 'Zelle sent — who to, and what for?', account.scope === 'business' ? { scope: 'business' } : {})
  }

  // 4. Money in
  if (row.amount > 0) {
    const bc = (row.bankCategory || '').toLowerCase()
    if (/daily cap|no charge|less than \$5|fee (refund|reversal)/.test(d) || (bc === 'taxes & fees')) return out('refund', 'Bank Service Fees')
    if (/return|refund|credit adj|reversal/.test(d) || (row.bankType === 'POS' && !/deposit/.test(d)) || (BANK_CATEGORY[bc] && !/deposit/.test(bc)))
      return out('refund', matchVendor(row.description, [], {}, categories)?.cat?.name || 'Other Refund / Credit')
    if (/investment income|dividend/.test(row.bankCategory.toLowerCase()) || /dividend/.test(d)) return out('income', 'Other Income', { scope: 'personal' })
    if (/paycheck|salary|payroll/.test(row.bankCategory.toLowerCase() + d)) return out('income', 'Personal Income / Salary', { scope: 'personal' })
    if (account.scope === 'business') return review('income', null, 'Business deposit — what was this?')
    return review('income', 'Other Income', 'Money in — what was this?')
  }

  // 5. Spending
  if (/chuze|planet fitness|la fitness|24 hour fitness|crunch fitness|orangetheory|gym/.test(d)) return out('expense', 'Health & Wellness', { scope: 'personal' })
  // Subscriptions: one category; the vendor decides business vs personal
  if (SUB_BUSINESS.test(d)) return out('expense', 'Subscriptions', { scope: 'business' })
  if (SUB_PERSONAL.test(d)) return out('expense', 'Subscriptions', { scope: 'personal' })
  if (/association of realtors|realtor association|board of realtors/.test(d)) return out('expense', 'MLS Dues', { scope: 'business' })
  if (/parkreceipts|parking|parkmobile|park mobile|spothero/.test(d)) return out('expense', 'Public Parking')
  if ((row.bankCategory || '').toLowerCase() === 'online services') return review('expense', null, 'Online payment — what was this?')
  const vendor = matchVendor(row.description, [], {}, categories)?.cat?.name
  if (vendor) return out('expense', vendor)
  if (/realtor association|board of realtors|mls/.test(d)) return out('expense', 'MLS Dues', { scope: 'business' })
  if (/regulatory|sunbiz|dbpr|division of real estate|license/.test(d)) return out('expense', 'Licenses & Permits', { scope: 'business' })
  const bank = BANK_CATEGORY[(row.bankCategory || '').toLowerCase()]
  if (bank) {
    const r = out('expense', bank)
    if (account.scope === 'business' && catKind(bank) === 'personal') return { ...r, status: 'review', review_reason: 'Personal-looking purchase on the business account' }
    return r
  }
  return review('expense', null, 'Unknown merchant — pick a category')
}

/** Match money leaving one of your accounts with the same amount arriving in another within 4 days */
export function pairTransfers(txns) {
  const days = (a, b) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5
  const OWNER = ['owner_draw', 'owner_contribution']
  const open = txns.filter(t => !t.transfer_id && (t.kind === 'transfer' || OWNER.includes(t.kind) || /zelle/i.test(t.description)))
  const used = new Set()
  for (const out of open.filter(t => t.amount < 0)) {
    const match = open.find(t => t.amount > 0 && !used.has(t.id) && t.account_id !== out.account_id && Math.abs(t.amount + out.amount) < 0.005 && days(t.date, out.date) <= 4)
    if (!match) continue
    used.add(match.id); used.add(out.id)
    const id = `tr-${out.id.slice(0, 10)}`
    const owner = [out, match].find(t => OWNER.includes(t.kind))?.kind
    for (const t of [out, match]) {
      if (OWNER.includes(t.kind)) Object.assign(t, { transfer_id: id, status: 'ok', review_reason: null })
      else Object.assign(t, {
        transfer_id: id, kind: 'transfer', status: 'ok', review_reason: null,
        category: owner === 'owner_draw' ? 'Owner draw from RLC' : owner === 'owner_contribution' ? 'Owner contribution to RLC' : (t.kind === 'transfer' && t.category) || 'Transfer',
      })
    }
  }
  return txns
}

/** Mark charges that recur about monthly at a steady amount (same rule as the dashboard) */
export function markRecurring(txns) {
  for (const [k, list] of findRecurring(txns)) for (const t of list) t.recurring_key = k
  return txns
}

/** Stable id: the same transaction imported twice (overlapping files) lands on the same row */
export function txnIds(accountId, rows, hash) {
  const seen = new Map()
  return rows.map(r => {
    const base = `${accountId}|${r.posted || r.date}|${r.amount.toFixed(2)}|${r.description}`
    const n = (seen.get(base) || 0) + 1
    seen.set(base, n)
    return hash(`${base}|${n}`)
  })
}

/** Running-balance check (Truist): each day's balance change must equal that day's transactions */
export function balanceCheck(rows) {
  const byDay = new Map()
  for (const r of rows) if (r.balance != null) {
    const k = r.posted || r.date
    if (!byDay.has(k)) byDay.set(k, { sum: 0, balance: r.balance })
    byDay.get(k).sum += r.amount
    byDay.get(k).balance = r.balance
  }
  const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  const gaps = []
  for (let i = 1; i < days.length; i++) {
    const diff = r2(days[i][1].balance - days.at(i - 1)[1].balance - days[i][1].sum)
    if (Math.abs(diff) >= 0.01) gaps.push({ date: days[i][0], diff })
  }
  const months = new Map()
  for (const [d, v] of days) {
    const m = d.slice(0, 7)
    if (!months.has(m)) months.set(m, { first: d, open: r2(v.balance - v.sum), close: v.balance, last: d })
    Object.assign(months.get(m), { close: v.balance, last: d })
  }
  return { gaps, months: [...months.entries()].map(([month, v]) => ({ month, ...v })) }
}
