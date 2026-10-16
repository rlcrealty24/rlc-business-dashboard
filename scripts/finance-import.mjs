#!/usr/bin/env node
// ─── Statement importer ──────────────────────────────────────────────────────
// Reads bank CSVs from your Finance folders (left exactly where they are), then
// categorizes, matches transfers, finds recurring charges, checks balances and
// saves to the private fin_* tables. Re-running is safe: rows already imported are
// skipped, and nothing you've edited in the app is overwritten.
//
//   node scripts/finance-import.mjs --dry     # report only, nothing saved
//   node scripts/finance-import.mjs           # import
//
// Needs the finance key in ~/.ceo_finance_key (created once; never committed).
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import { ACCOUNTS, parseCsv, accountForFile, merchantOf, classify, pairTransfers, markRecurring, txnIds, balanceCheck } from '../src/finance/engine.js'
import { DEFAULT_CATEGORIES } from '../src/finance/vendorMap.js'

const DRY = process.argv.includes('--dry')
const ROOTS = (process.env.FIN_ROOTS || '~/Desktop/Finance 2026').split('|').map(p => p.replace(/^~/, os.homedir()))
const URL = 'https://ynvlsbmxipmksrgaebnq.supabase.co/rest/v1'
const ANON = 'sb_publishable_8rczDgNjp2m_tLdc9jrE1Q_xzmWv2fE'
const KEY = fs.readFileSync(path.join(os.homedir(), '.ceo_finance_key'), 'utf8').trim()
const H = { apikey: ANON, Authorization: `Bearer ${ANON}`, 'x-finance-key': KEY, 'Content-Type': 'application/json' }
const hash = s => crypto.createHash('sha1').update(s).digest('hex').slice(0, 20)
const fmt = n => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

async function api(method, table, body, { query = '', prefer = '' } = {}) {
  const res = await fetch(`${URL}/${table}${query}`, { method, headers: { ...H, ...(prefer ? { Prefer: prefer } : {}) }, body: body ? JSON.stringify(body) : undefined })
  const text = await res.text()
  if (!res.ok) throw new Error(`${method} ${table}: ${res.status} ${text.slice(0, 300)}`)
  return text ? JSON.parse(text) : null
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(csv|pdf)$/i.test(e.name) && !e.name.startsWith('~$')) out.push(p)
  }
  return out
}

// ── Load categories (yours, from the dashboard) and your rules ────────────────
let categories = DEFAULT_CATEGORIES
try {
  const r = await fetch(`${URL}/dashboard_data?key=eq.finance_categories&select=value`, { headers: { apikey: ANON } }).then(r => r.json())
  if (Array.isArray(r?.[0]?.value) && r[0].value.length) categories = r[0].value
} catch {}
let rules = []
if (!DRY) rules = await api('GET', 'fin_rules', null, { query: '?select=*' }).catch(() => [])

// ── Read every CSV ────────────────────────────────────────────────────────────
const files = ROOTS.flatMap(r => walk(r))
const csvs = files.filter(f => /\.csv$/i.test(f)), pdfs = files.filter(f => /\.pdf$/i.test(f))
const all = new Map(), byAccountRows = new Map(), skipped = []
for (const file of csvs) {
  const { format, rows } = parseCsv(fs.readFileSync(file, 'utf8'))
  const accountId = accountForFile(file, format)
  const account = ACCOUNTS.find(a => a.id === accountId)
  if (!account) { skipped.push(`${path.basename(file)} — couldn't tell which account`); continue }
  if (account.excluded) { skipped.push(`${path.basename(file)} — ${account.name} is excluded from reporting`); continue }
  const ids = txnIds(account.id, rows, hash)
  rows.forEach((row, i) => {
    if (all.has(ids[i])) return                                   // overlapping files: same transaction
    const c = classify(row, account, { categories, rules })
    all.set(ids[i], {
      id: ids[i], account_id: account.id, date: row.date, amount: row.amount, description: row.description,
      merchant: merchantOf(row), kind: c.kind, category: c.category, scope: c.scope, status: c.status, review_reason: c.review_reason,
      counterparty: c.counterparty || null, transfer_id: null, recurring_key: null, source: path.basename(file), bank_category: row.bankCategory || null, balance_after: row.balance,
      _wallet: !!c.wallet,
    })
  })
  if (!byAccountRows.has(account.id)) byAccountRows.set(account.id, [])
  byAccountRows.get(account.id).push(...rows)
}
const txns = markRecurring(pairTransfers([...all.values()]))

// ── Report ───────────────────────────────────────────────────────────────────
const lines = []
const say = s => { lines.push(s); console.log(s) }
say(`Files: ${csvs.length} CSV, ${pdfs.length} PDF${skipped.length ? ` · skipped ${skipped.length}` : ''}`)
skipped.forEach(s => say(`  skipped: ${s}`))
for (const a of ACCOUNTS.filter(a => !a.excluded)) {
  const t = txns.filter(x => x.account_id === a.id)
  if (!t.length) { say(`${a.name}: no statements yet`); continue }
  const ds = t.map(x => x.date).sort()
  say(`${a.name}: ${t.length} transactions, ${ds[0]} → ${ds.at(-1)}`)
}
const months = [...new Set(txns.map(t => t.date.slice(0, 7)))].sort()
say('\nMonth      Income      Spending    Net        (transfers excluded)')
for (const m of months) {
  const t = txns.filter(x => x.date.startsWith(m))
  const inc = t.filter(x => x.kind === 'income').reduce((s, x) => s + x.amount, 0)
  const spend = t.filter(x => x.kind === 'expense' || x.kind === 'refund').reduce((s, x) => s - x.amount, 0)
  say(`${m}    ${fmt(inc).padStart(10)}  ${fmt(spend).padStart(10)}  ${fmt(inc - spend).padStart(10)}`)
}
const review = txns.filter(t => t.status === 'review')
const reasons = {}
for (const t of review) reasons[t.review_reason] = (reasons[t.review_reason] || 0) + 1
say(`\nNeeds your review: ${review.length}`)
Object.entries(reasons).sort((a, b) => b[1] - a[1]).forEach(([r, n]) => say(`  ${n} × ${r}`))
const paired = txns.filter(t => t.transfer_id).length / 2
const wallet = txns.filter(t => t._wallet && t.amount < 0).reduce((s, t) => s - t.amount, 0)
say(`Transfers matched between your accounts: ${paired}`)
if (wallet) say(`Moved to Apple Cash / Cash App / PayPal: ${fmt(wallet)} (spending inside those apps isn't in your bank files)`)
const rec = new Map()
for (const t of txns.filter(t => t.recurring_key)) rec.set(t.recurring_key, t)
say(`Recurring charges found: ${rec.size}`)

const statements = []
for (const [accountId, rows] of byAccountRows) {
  const { gaps, months: ms } = balanceCheck(rows)
  if (!ms.length) continue
  say(`\n${ACCOUNTS.find(a => a.id === accountId).name} balance check: ${gaps.length ? `${gaps.length} day(s) don't add up` : 'every day adds up ✓'}`)
  gaps.slice(0, 5).forEach(g => say(`  ${g.date}: off by ${fmt(g.diff)}`))
  for (const m of ms) statements.push({
    id: `${accountId}-${m.month}`, account_id: accountId, period_start: m.first, period_end: m.last,
    opening_balance: m.open, closing_balance: m.close, computed_closing: m.close,
    status: gaps.some(g => g.date.startsWith(m.month)) ? 'off' : 'reconciled', file_name: 'running balance (CSV)',
  })
}
if (pdfs.length) say(`\nPDF statements found: ${pdfs.length} (used for month-end balance checks)`)

// Accounts without a running balance (NFCU): work month-end balances back from the balance you gave
let anchors = {}
try { anchors = (await api('GET', 'fin_meta', null, { query: '?key=eq.balances&select=value' }))?.[0]?.value || {} } catch {}
for (const a of ACCOUNTS.filter(a => !a.excluded && anchors[a.id] && !statements.some(s => s.account_id === a.id))) {
  const t = txns.filter(x => x.account_id === a.id)
  if (!t.length) continue
  const anchor = anchors[a.id]
  const ms = [...new Set(t.map(x => x.date.slice(0, 7)))].sort()
  const after = end => t.filter(x => x.date > end && x.date <= anchor.date).reduce((s, x) => s + x.amount, 0)
  let low = null
  for (const m of ms) {
    const inMonth = t.filter(x => x.date.startsWith(m))
    const end = inMonth.map(x => x.date).sort().at(-1)
    const close = Math.round((anchor.amount - after(end)) * 100) / 100
    const open = Math.round((close - inMonth.reduce((s, x) => s + x.amount, 0)) * 100) / 100
    if (low === null || Math.min(open, close) < low.v) low = { m, v: Math.min(open, close) }
    statements.push({ id: `${a.id}-${m}`, account_id: a.id, period_start: inMonth.map(x => x.date).sort()[0], period_end: end,
      opening_balance: open, closing_balance: close, computed_closing: close, status: Math.min(open, close) < -50 ? 'off' : 'derived',
      file_name: `worked back from your ${anchor.date} balance` })
  }
  say(`${a.name}: balances worked back from ${fmt(anchor.amount)} on ${anchor.date}${low && low.v < -50 ? ` — goes negative in ${low.m} (${fmt(low.v)}), so a transaction may be missing` : ' ✓'}`)
}

if (DRY) { console.log('\nDry run — nothing saved.'); process.exit(0) }

// ── Save ─────────────────────────────────────────────────────────────────────
await api('POST', 'fin_accounts', ACCOUNTS.map(({ id, name, institution, type, last4, scope, sort, excluded }) => ({ id, name, institution, type, last4, scope, sort, excluded: !!excluded })), { prefer: 'resolution=ignore-duplicates,return=minimal' })
const rows = txns.map(({ _wallet, ...t }) => t)
for (let i = 0; i < rows.length; i += 400) await api('POST', 'fin_transactions', rows.slice(i, i + 400), { prefer: 'resolution=ignore-duplicates,return=minimal' })
// Rows already saved: re-apply the latest rules — but only to rows you haven't touched in the app
const existing = []
for (let from = 0; ; from += 1000) {     // the API returns at most 1,000 rows per request
  const page = await api('GET', 'fin_transactions', null, { query: `?select=id,created_at,updated_at&order=id&offset=${from}&limit=1000` })
  existing.push(...page)
  if (page.length < 1000) break
}
const untouched = new Set(existing.filter(r => Date.parse(r.updated_at) - Date.parse(r.created_at) < 2000).map(r => r.id))
const FIELDS = ['kind', 'category', 'scope', 'status', 'review_reason', 'counterparty', 'transfer_id', 'merchant']
let updated = 0
for (const t of rows.filter(t => untouched.has(t.id))) {
  await api('PATCH', 'fin_transactions', Object.fromEntries(FIELDS.map(k => [k, t[k] ?? null])), { query: `?id=eq.${t.id}`, prefer: 'return=minimal' })
  updated++
}
if (updated) console.log(`Re-checked ${updated} untouched transactions against the latest rules.`)
if (statements.length) await api('POST', 'fin_statements', statements, { prefer: 'resolution=merge-duplicates,return=minimal' })
await api('POST', 'fin_meta', [{ key: 'last_import', value: { at: new Date().toISOString(), through: txns.map(t => t.date).sort().at(-1), report: lines.join('\n') } }], { prefer: 'resolution=merge-duplicates,return=minimal' })
console.log(`\nSaved: ${rows.length} transactions checked, ${statements.length} statement months.`)
