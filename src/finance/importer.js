// ─── In-page statement import ────────────────────────────────────────────────
// The same steps as scripts/finance-import.mjs, run in the browser on files you pick:
// read → dedupe → classify → match transfers → check balances → save. Re-importing is safe:
// rows already saved are skipped and nothing you've edited is overwritten.
import { ACCOUNTS, accountForFile, balanceCheck, classify, merchantOf, pairTransfers, parseCsv, txnBases } from './engine.js'
import { fin } from './store.js'

const sha1 = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 20)
const r2 = n => Math.round(n * 100) / 100
const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

/** Step 1 — read the picked files and show what's in them (nothing saved) */
export async function readFiles(files, existingIds) {
  const out = []
  for (const file of files) {
    const text = await file.text()
    const { format, rows } = parseCsv(text)
    const accountId = accountForFile(file.name, format)
    out.push({ name: file.name, format, rows, accountId, existingIds })
  }
  return out
}

/** Step 2 — classify and save. `parsed` = readFiles() output with accountId confirmed per file */
export async function importParsed(parsed, { categories, rules, existing, anchors, statements }) {
  const db = fin()
  const existingById = new Map(existing.map(t => [t.id, t]))
  const fresh = new Map()
  const byAccountRows = new Map()
  const skipped = []
  for (const f of parsed) {
    const account = ACCOUNTS.find(a => a.id === f.accountId)
    if (!account) { skipped.push(`${f.name} — no account chosen`); continue }
    if (account.excluded) { skipped.push(`${f.name} — ${account.name} is excluded from reporting`); continue }
    const ids = await Promise.all(txnBases(account.id, f.rows).map(sha1))
    if (!byAccountRows.has(account.id)) byAccountRows.set(account.id, [])
    f.rows.forEach((row, i) => {
      if (fresh.has(ids[i])) return
      byAccountRows.get(account.id).push(row)
      if (existingById.has(ids[i])) return                       // already imported earlier
      const c = classify(row, account, { categories, rules })
      fresh.set(ids[i], {
        id: ids[i], account_id: account.id, date: row.date, amount: row.amount, description: row.description,
        merchant: merchantOf(row), kind: c.kind, category: c.category, scope: c.scope, status: c.status, review_reason: c.review_reason,
        counterparty: c.counterparty || null, transfer_id: null, recurring_key: null, source: f.name, bank_category: row.bankCategory || null,
        balance_after: row.balance,
      })
    })
  }
  const newRows = [...fresh.values()]

  // Transfers: match new rows against each other and against saved rows still waiting for a match
  const waiting = existing.filter(t => !t.transfer_id && (['transfer', 'owner_draw', 'owner_contribution'].includes(t.kind) || /zelle/i.test(t.description))).map(t => ({ ...t }))
  pairTransfers([...newRows, ...waiting])
  const patches = waiting.filter(t => t.transfer_id).filter(t => {
    const e = existingById.get(t.id)
    return e && !e.transfer_id && (e.status === 'review' || e.kind === 'transfer' || e.kind === 'owner_draw' || e.kind === 'owner_contribution')
  })

  // Running-balance check + month statements (accounts whose files carry a balance, e.g. Truist)
  const statementRows = []
  const lines = []
  for (const [accountId, rows] of byAccountRows) {
    const { gaps, months } = balanceCheck(rows)
    if (!months.length) continue
    const name = ACCOUNTS.find(a => a.id === accountId).name
    lines.push(gaps.length ? `${name}: ${gaps.length} day(s) don't add up` : `${name}: every day adds up ✓`)
    for (const m of months) {
      const prev = statements.find(s => s.id === `${accountId}-${m.month}`)
      const startsLate = Number(m.first.slice(8)) > 3 && prev            // file starts mid-month: keep the saved opening
      statementRows.push({
        id: `${accountId}-${m.month}`, account_id: accountId, period_start: startsLate ? prev.period_start : m.first, period_end: m.last,
        opening_balance: startsLate ? prev.opening_balance : m.open, closing_balance: m.close, computed_closing: m.close,
        status: gaps.some(g => g.date.startsWith(m.month)) ? 'off' : 'reconciled', file_name: 'running balance (CSV)',
      })
    }
  }

  // Accounts without a running balance: work back from your latest balance; self-healing adjustment if it dips below $0
  const all = [...existing.filter(t => t.source !== 'adjustment'), ...newRows]
  const adjustments = []
  for (const a of ACCOUNTS.filter(a => !a.excluded && anchors[a.id] && !byAccountRows.get(a.id)?.some(r => r.balance != null))) {
    if (!byAccountRows.has(a.id)) continue                               // only accounts in this import
    const t = all.filter(x => x.account_id === a.id)
    const anchor = anchors[a.id]
    const ms = [...new Set(t.map(x => x.date.slice(0, 7)))].sort()
    const calc = list => ms.map(m => {
      const inM = list.filter(x => x.date.startsWith(m))
      const end = inM.map(x => x.date).sort().at(-1)
      const close = r2(anchor.amount - list.filter(x => x.date > end && x.date <= anchor.date).reduce((s, x) => s + x.amount, 0))
      return { m, start: inM.map(x => x.date).sort()[0], end, close, open: r2(close - inM.reduce((s, x) => s + x.amount, 0)) }
    })
    let res = calc(t)
    const low = Math.min(0, ...res.flatMap(x => [x.open, x.close]))
    if (low < -0.5) {
      const d = new Date(`${anchor.date}T12:00:00`); d.setDate(d.getDate() - 1)
      const adj = { id: `adj-${a.id}`, account_id: a.id, date: d.toISOString().slice(0, 10), amount: r2(low), description: 'Balance adjustment — not in your bank files yet',
        merchant: 'Balance adjustment', kind: 'transfer', category: 'Balance adjustment', scope: a.scope, status: 'ok', review_reason: null, counterparty: null,
        transfer_id: null, recurring_key: null, source: 'adjustment', bank_category: null, balance_after: null,
        notes: `Added automatically so balances worked back from your ${anchor.date} balance don't dip below $0. Recalculated on every import; removed once the real transaction is in your files.` }
      adjustments.push(adj)
      res = calc([...t, adj])
      lines.push(`${a.name}: ${'$' + (-adj.amount).toFixed(2)} balance adjustment (something left the account after the last file date)`)
    } else lines.push(`${a.name}: balances work back from your ${anchor.date} balance ✓`)
    for (const x of res) statementRows.push({ id: `${a.id}-${x.m}`, account_id: a.id, period_start: x.start, period_end: x.end, opening_balance: x.open,
      closing_balance: x.close, computed_closing: x.close, status: 'derived', file_name: `worked back from your ${anchor.date} balance` })
  }

  // Save
  for (let i = 0; i < newRows.length; i += 400) must(await db.from('fin_transactions').upsert(newRows.slice(i, i + 400), { onConflict: 'id', ignoreDuplicates: true }).select('id'))
  for (const t of patches) must(await db.from('fin_transactions').update({ transfer_id: t.transfer_id, kind: t.kind, status: 'ok', review_reason: null, category: t.category }).eq('id', t.id).select('id'))
  for (const a of byAccountRows.keys()) if (!byAccountRows.get(a).some(r => r.balance != null) && anchors[a]) must(await db.from('fin_transactions').delete().eq('id', `adj-${a}`).select('id'))
  if (adjustments.length) must(await db.from('fin_transactions').upsert(adjustments).select('id'))
  if (statementRows.length) must(await db.from('fin_statements').upsert(statementRows).select('id'))

  const through = [...newRows, ...existing].map(t => t.date).sort().at(-1)
  const review = newRows.filter(t => t.status === 'review').length
  const matched = newRows.filter(t => t.transfer_id).length
  const report = [
    `${parsed.length} file(s) · ${newRows.length} new transactions${skipped.length ? ` · skipped ${skipped.length}` : ''}`,
    ...skipped.map(s => `skipped: ${s}`),
    `${review} need your review · ${matched + patches.length} transfer sides matched`,
    ...lines,
  ].join('\n')
  must(await db.from('fin_meta').upsert({ key: 'last_import', value: { at: new Date().toISOString(), through, report, from: 'page' }, updated_at: new Date().toISOString() }).select('key'))
  return { newCount: newRows.length, review, matched: matched + patches.length, lines, skipped, report }
}

/** How many rows in a file aren't saved yet (for the preview) */
export async function countNew(file, existingIds) {
  if (!file.accountId) return null
  const ids = await Promise.all(txnBases(file.accountId, file.rows).map(sha1))
  return ids.filter(id => !existingIds.has(id)).length
}
