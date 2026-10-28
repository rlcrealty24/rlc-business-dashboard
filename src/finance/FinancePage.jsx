// ─── Finance ─────────────────────────────────────────────────────────────────
// Dashboard over your imported bank statements (private fin_* tables).
// Statements are imported by Claude from ~/Desktop/Finance 2026 (scripts/finance-import.mjs);
// this page is for understanding the numbers and confirming what needs you.
import { Fragment, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DEFAULT_CATEGORIES } from './vendorMap.js'
import { ACCOUNTS, KIND_LABELS } from './engine.js'
import { countNew, importParsed, readFiles } from './importer.js'
import { useCrmCommissions } from './crm.js'
import { useFinance } from './store.js'
import { useCeo } from '../ceo/CeoStore.jsx'
import { agentLedger, brokerage, byCategory, earnedOf, duplicates, findRecurring, freshness, inScope, insights, monthly, months as monthList, recurring, SPEND, topMerchants } from './analytics.js'
import { CategoriesTab, TaxTab } from '../pages/Finance.jsx'

const C_INCOME = '#2a78d6', C_SPEND = '#eb6834'    // reference palette slots 1 + 2
const SYSTEM_CATS = ['Transfer', 'Wallet transfer', 'Credit Card Payment', 'Personal Savings', 'Owner Draw/Personal Use']
const ACQ_CATS = ['Hard money loan payment', 'Property purchase / deposit', 'Rehab / construction', 'Closing costs', 'Other acquisition cost']
const KINDS = Object.keys(KIND_LABELS)
const START = '2026-01-01'
// Wide tables become stacked cards up to iPad landscape width — no sideways scrolling
const FIN_CSS = `
.fin-table td.fa-ctl select { max-width: 170px; } .fin-table td.fa-ctl input:not([type=checkbox]) { max-width: 140px; }
@media (min-width: 1301px) {
  .fin-table td.fa-ctl > div { flex-wrap: nowrap !important; }
  .fin-table td.fa-main { max-width: 180px; min-width: 0 !important; }
  .fin-table td.fa-main > .text-xs { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
}
.fin-page .card-header h3 { color: var(--text); font-weight: 700; font-family: var(--sans); letter-spacing: .06em; font-size: 0.82rem; }
@media (max-width: 1300px) {
  .fin-table thead { display: none; }
  .fin-table, .fin-table tbody { display: block; width: 100%; }
  .fin-table tr { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr) auto; grid-template-areas: "main main amt" "date acct acct" "kind cat scope" "ctl ctl ctl";
    gap: 6px 10px; padding: 12px 14px; border-bottom: 1px solid var(--border); }
  .fin-table td { display: block; padding: 0 !important; border: none !important; min-width: 0 !important; white-space: normal !important; }
  .fin-table td.fa-main { grid-area: main; font-size: 0.9rem; } .fin-table td.fa-amt { grid-area: amt; font-size: 0.95rem; }
  .fin-table td.fa-date { grid-area: date; color: var(--text-muted); font-size: 0.75rem; } .fin-table td.fa-acct { grid-area: acct; }
  .fin-table td.fa-kind { grid-area: kind; } .fin-table td.fa-cat { grid-area: cat; } .fin-table td.fa-scope { grid-area: scope; } .fin-table td.fa-ctl { grid-area: ctl; }
  .fin-table td select, .fin-table td input:not([type=checkbox]) { width: 100% !important; max-width: none !important; }
  .fin-table td.fa-ctl select, .fin-table td.fa-ctl input:not([type=checkbox]) { width: auto !important; flex: 0 1 auto; min-width: 0; max-width: 190px !important; }
  .fin-table td select.fin-flag { width: auto !important; display: inline-block; }
}`   // reporting (and reconciliation) starts January 2026
const $ = (n, cents = false) => (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
const monthName = (m, long = false) => new Date(`${m}-15T12:00:00`).toLocaleDateString('en-US', { month: long ? 'long' : 'short', year: long ? 'numeric' : '2-digit' })
const ago = d => Math.round((Date.now() - Date.parse(`${d}T12:00:00`)) / 864e5)
const fmtDay = d => new Date(`${d}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

export default function FinancePage() {
  const f = useFinance()
  const [categories, setCategories] = useLocalStorage('finance_categories', DEFAULT_CATEGORIES)
  const [scope, setScope] = useState('all')
  const [tab, setTab] = useState('dashboard')
  const [month, setMonth] = useState(null)
  const [reviewMonth, setReviewMonth] = useState(null)
  const [importing, setImporting] = useState(false)   // set when you open Review from a month on the dashboard

  const live = useMemo(() => {
    const excluded = new Set(f.accounts.filter(a => a.excluded).map(a => a.id))
    return f.txns.filter(t => !excluded.has(t.account_id) && t.date >= START)
  }, [f.txns, f.accounts])
  const ms = useMemo(() => monthList(live), [live])
  const fresh = useMemo(() => freshness(live, f.accounts.filter(a => !a.excluded && live.some(t => t.account_id === a.id))), [live, f.accounts])
  const inProgress = fresh.latest && ms.at(-1) === fresh.latest.slice(0, 7)
  const sel = month && ms.includes(month) ? month : (inProgress && ms.length > 1 ? ms.at(-2) : ms.at(-1))
  const review = live.filter(t => t.status === 'review')
  const crm = useCrmCommissions()
  const agentNames = useMemo(() => [...new Set([...crm.agents, ...f.txns.filter(t => t.kind === 'agent_payout' && t.counterparty).map(t => t.counterparty)])].sort(), [crm.agents, f.txns])
  const catNames = useMemo(() => [...new Set([...(categories || []).map(c => c.name), ...SYSTEM_CATS, ...ACQ_CATS])].sort(), [categories])

  if (f.loading) return <div className="page-header"><h1>Finance</h1><p>Loading your accounts…</p></div>
  if (f.noKey) return (
    <div>
      <div className="page-header"><h1>Finance</h1></div>
      <div className="card"><div className="card-body">
        <strong>This browser isn’t connected to your finance data.</strong>
        <p className="text-sm text-muted">Your bank data is private and only opens on your own devices. Ask Claude for this device’s one-time setup link.</p>
      </div></div>
    </div>
  )
  if (f.error) return <div className="page-header"><h1>Finance</h1><p style={{ color: 'var(--red)' }}>Couldn’t load: {f.error}</p></div>

  const TABS = [
    ['dashboard', 'Dashboard'], ['review', `Review${review.length ? ` (${review.length})` : ''}`], ['transactions', 'Transactions'],
    ['budgets', 'Budgets & Goals'], ['accounts', 'Accounts'], ['categories', 'Categories'], ['tax', 'Tax'],
  ]
  return (
    <div className="fin-page">
      <style>{FIN_CSS}</style>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1>Finance</h1>
          <p>
            {fresh.through
              ? <>Bank data through <strong>{fmtDay(fresh.through)}</strong> ({ago(fresh.through)} days ago){fresh.latest !== fresh.through && <> · some accounts through {fmtDay(fresh.latest)}</>}</>
              : 'No statements imported yet'}
            {f.meta.last_import?.at && <> · last import {fmtDay(f.meta.last_import.at.slice(0, 10))}</>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary btn-sm" onClick={() => setImporting(v => !v)}>⇪ Import statements</button>
        <div className="tabs" style={{ margin: 0 }}>
          {[['all', 'All'], ['personal', 'Personal'], ['business', 'Business']].map(([k, l]) => (
            <button key={k} className={`tab ${scope === k ? 'active' : ''}`} onClick={() => setScope(k)}>{l}</button>
          ))}
        </div>
        </div>
      </div>
      {importing && <div className="mb-16"><ImportPanel f={f} categories={categories} onClose={() => setImporting(false)} /></div>}
      {fresh.through && ago(fresh.through) > 10 && (
        <div className="card mb-16" style={{ borderLeft: '3px solid var(--amber)' }}><div className="card-body text-sm">
          The newest bank data is {ago(fresh.through)} days old — download recent-activity CSVs into <strong>Desktop › Finance 2026</strong>, then <a href="#import" onClick={e => { e.preventDefault(); setImporting(true) }}>Import statements →</a>
        </div></div>
      )}
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => { setTab(k); if (k === 'review') setReviewMonth(null) }}>{l}</button>)}</div>

      {tab === 'dashboard' && <Dashboard f={f} txns={live} scope={scope} month={sel} months={ms} setMonth={setMonth} fresh={fresh} goReview={m => { setReviewMonth(typeof m === 'string' ? m : null); setTab('review') }} />}
      {tab === 'review' && <Review f={f} txns={reviewMonth ? review.filter(t => t.date.startsWith(reviewMonth)) : review} total={review.length} month={reviewMonth} months={ms} setMonth={setReviewMonth} catNames={catNames} agents={agentNames} crm={crm.items} />}
      {tab === 'transactions' && <Transactions f={f} txns={live} scope={scope} months={ms} catNames={catNames} />}
      {tab === 'budgets' && <Budgets f={f} txns={live} scope={scope} month={sel} catNames={catNames} />}
      {tab === 'accounts' && <Accounts f={f} txns={f.txns} fresh={fresh} />}
      {tab === 'categories' && <CategoriesTab categories={categories} setCategories={setCategories} />}
      {tab === 'tax' && <TaxTab transactions={live.filter(t => (t.scope === 'business') && (t.kind === 'income' || t.kind === 'commission_in' || SPEND(t))).map(t => ({
        id: t.id, date: t.date, type: t.kind === 'income' || t.kind === 'commission_in' ? 'income' : 'expense',
        amount: t.kind === 'commission_in' ? earnedOf(t) : t.kind === 'income' ? t.amount : -t.amount,
        category: t.category, spendingType: 'business', status: 'cleared', description: t.merchant,
      }))} />}
    </div>
  )
}

// ─── Import statements (in the page) ─────────────────────────────────────────
function ImportPanel({ f, categories, onClose }) {
  const [files, setFiles] = useState([])
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [drag, setDrag] = useState(false)
  const existingIds = useMemo(() => new Set(f.txns.map(t => t.id)), [f.txns])

  async function add(list) {
    setError(null); setResult(null)
    try {
      const parsed = await readFiles([...list].filter(x => /\.csv$/i.test(x.name)), existingIds)
      for (const p of parsed) p.newCount = await countNew(p, existingIds)
      setFiles(prev => [...prev, ...parsed])
    } catch (e) { setError(e.message) }
  }
  async function setAccount(i, id) {
    const next = [...files]; next[i] = { ...next[i], accountId: id || null }
    next[i].newCount = await countNew(next[i], existingIds)
    setFiles(next)
  }
  async function run() {
    setBusy(true); setError(null)
    try {
      const r = await importParsed(files, { categories, rules: f.rules, existing: f.txns, anchors: f.meta.balances || {}, statements: f.statements })
      setResult(r); setFiles([])
      await f.reload()
    } catch (e) { setError(e.message) }
    setBusy(false)
  }
  const ready = files.length && files.every(x => x.accountId)
  const totalNew = files.reduce((s, x) => s + (x.newCount || 0), 0)
  const range = rows => { const d = rows.map(r => r.date).sort(); return d.length ? `${fmtDay(d[0])} – ${fmtDay(d.at(-1))}` : 'no rows' }

  return (
    <div className="card" style={{ borderTop: '3px solid #1c9fd0' }}>
      <div className="card-header"><h3>Import statements</h3><button className="btn btn-sm" onClick={onClose}>Close</button></div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files) }}
          style={{ border: `2px dashed ${drag ? '#1c9fd0' : 'var(--border)'}`, background: drag ? '#eef9fe' : 'var(--surface-hover)', padding: 22, textAlign: 'center', cursor: 'pointer', borderRadius: 6 }}>
          <input type="file" accept=".csv,text/csv" multiple style={{ display: 'none' }} onChange={e => { add(e.target.files); e.target.value = '' }} />
          <div style={{ fontWeight: 600 }}>Drop CSV files here, or click to choose</div>
          <div className="text-xs text-muted" style={{ marginTop: 4 }}>From Desktop › Finance 2026 — NFCU, Truist, Amex. Overlapping dates are fine; duplicates are skipped.</div>
        </label>

        {files.length > 0 && (
          <div className="table-container"><table><tbody>
            {files.map((x, i) => (
              <tr key={i}>
                <td className="text-sm" style={{ wordBreak: 'break-all' }}>{x.name}<div className="text-xs text-muted">{x.rows.length} rows · {range(x.rows)}</div></td>
                <td>
                  <select value={x.accountId || ''} onChange={e => setAccount(i, e.target.value)} style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 6px', borderColor: x.accountId ? undefined : '#b45309' }}>
                    <option value="">Which account?</option>
                    {ACCOUNTS.filter(a => !a.excluded).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </td>
                <td className="text-right text-sm">{x.newCount == null ? '—' : <strong>{x.newCount} new</strong>}</td>
                <td><button className="btn btn-sm" style={{ padding: '0 6px' }} onClick={() => setFiles(files.filter((_, j) => j !== i))}>×</button></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {files.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={!ready || busy} onClick={run}>{busy ? 'Importing…' : `Import ${totalNew} new transaction${totalNew === 1 ? '' : 's'}`}</button>
            {!ready && <span className="text-xs" style={{ color: '#b45309' }}>Pick the account for each file first.</span>}
            {ready && totalNew === 0 && <span className="text-xs text-muted">Everything in these files is already imported — importing again just re-checks balances.</span>}
          </div>
        )}
        {error && <div className="text-sm" style={{ color: 'var(--red)' }}>Couldn’t import: {error}</div>}
        {result && (
          <div className="text-sm" style={{ background: '#ecfdf3', border: '1px solid #86efac', padding: 12, borderRadius: 6, lineHeight: 1.6 }}>
            <strong>Imported {result.newCount} new transactions.</strong> {result.review ? `${result.review} need your review. ` : ''}{result.matched ? `${result.matched} transfer sides matched. ` : ''}
            {result.lines.map((l, i) => <div key={i} className="text-xs">{l}</div>)}
            {result.skipped.map((l, i) => <div key={i} className="text-xs" style={{ color: '#b45309' }}>Skipped: {l}</div>)}
            <div className="text-xs text-muted" style={{ marginTop: 4 }}>Tip: update each account’s balance on Accounts so the month-end check uses today’s number.</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────
function Dashboard({ f, txns, scope, month, months, setMonth, fresh, goReview }) {
  const series = useMemo(() => monthly(txns, scope).slice(-12), [txns, scope])
  const cur = series.find(m => m.month === month) || { income: 0, spending: 0, net: 0 }
  const prev = series.filter(m => m.month < month).slice(-3)
  const avg = k => (prev.length ? prev.reduce((s, m) => s + m[k], 0) / prev.length : null)
  const cats = useMemo(() => byCategory(txns, scope, month), [txns, scope, month])
  const merchants = useMemo(() => topMerchants(txns, scope, month), [txns, scope, month])
  const rec = useMemo(() => recurring(txns, scope, fresh.latest).filter(r => r.active), [txns, scope, fresh.latest])
  const notes = useMemo(() => insights({ txns, scope, month, budgets: f.budgets }), [txns, scope, month, f.budgets])
  const dups = useMemo(() => duplicates(txns.filter(t => inScope(t, scope))).filter(([a]) => a.date.startsWith(month)), [txns, scope, month])
  const partial = month === months.at(-1) && fresh.through && fresh.through.slice(0, 7) === month
  const review = txns.filter(t => t.status === 'review' && t.date.startsWith(month)).length
  const budgetOf = c => f.budgets.find(b => b.category === c && (b.scope === scope || b.scope === 'all' || !b.scope))
  const subs = rec.filter(r => r.subscription)

  const delta = (v, a, goodUp) => {
    if (partial) return <div className="metric-change neutral">month in progress</div>
    if (a == null || !a) return <div className="metric-change neutral">no earlier months</div>
    const p = Math.round((v / a - 1) * 100)
    const good = goodUp ? p >= 0 : p <= 0
    return <div className="metric-change" style={{ color: good ? 'var(--green)' : 'var(--red)' }}>{p >= 0 ? '▲' : '▼'} {Math.abs(p)}% vs 3-mo avg</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ margin: 0 }}>{monthName(month, true)}{partial && <span className="text-muted" style={{ fontSize: '0.9rem', fontWeight: 'normal' }}> — so far, through {fmtDay(fresh.through)}</span>}</h2>
        <select value={month} onChange={e => setMonth(e.target.value)} style={{ width: 'auto' }}>
          {[...months].reverse().map(m => <option key={m} value={m}>{monthName(m, true)}</option>)}
        </select>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
        <div className="metric-card metric-card-income"><div className="metric-label">{scope === 'business' ? 'Earned (RLC + your deals)' : 'Money earned'}</div><div className="metric-value">{$(cur.income)}</div>{delta(cur.income, avg('income'), true)}</div>
        {scope === 'personal' && <div className="metric-card metric-card-blue"><div className="metric-label">Paid yourself from RLC</div><div className="metric-value">{$(cur.draws || 0)}</div><div className="metric-change neutral">owner draws — not new earnings</div></div>}
        <div className="metric-card metric-card-expense"><div className="metric-label">Spending</div><div className="metric-value">{$(cur.spending)}</div>{delta(cur.spending, avg('spending'), false)}</div>
        <div className="metric-card metric-card-net"><div className="metric-label">Net cash flow</div><div className="metric-value" style={{ color: cur.net < 0 ? 'var(--red)' : 'var(--green)' }}>{$(cur.net)}</div><div className="metric-change neutral">{scope === 'personal' ? 'earned + draws − spending' : cur.income > 0 ? `${Math.round((cur.net / cur.income) * 100)}% of earnings kept` : '—'}</div></div>
        <div className="metric-card metric-card-pending" style={{ cursor: review ? 'pointer' : 'default' }} onClick={review ? () => goReview(month) : undefined}>
          <div className="metric-label">Needs your review</div><div className="metric-value">{review}</div><div className="metric-change neutral">{review ? 'this month · tap to review' : 'all clear this month'}</div>
        </div>
      </div>

      <NeedsAction f={f} txns={txns} />

      {scope !== 'personal' && <Brokerage f={f} txns={txns} month={month} goReview={goReview} />}

      <div className="card">
        <div className="card-header"><h3>Earned vs spending · last {series.length} months</h3><span className="text-xs text-muted">agent pass-through, owner draws and transfers excluded</span></div>
        <div className="card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series.map(m => ({ ...m, label: monthName(m.month) }))} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={48} />
              <Tooltip formatter={(v, n) => [$(v), n]} labelFormatter={(l, p) => `${l} · net ${$(p?.[0]?.payload?.net ?? 0)}`} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Earned" fill={C_INCOME} radius={[4, 4, 0, 0]} maxBarSize={24} />
              <Bar dataKey="spending" name="Spending" fill={C_SPEND} radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card-body text-xs text-muted" style={{ paddingTop: 0, display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {series.map(m => <span key={m.month}>{monthName(m.month)} net <strong style={{ color: m.net < 0 ? 'var(--red)' : 'var(--green)' }}>{$(m.net)}</strong></span>)}
        </div>
      </div>

      {notes.length + dups.length > 0 && (
        <div className="card">
          <div className="card-header"><h3>What stands out</h3></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {notes.map((n, i) => (
              <div key={i} className="text-sm" style={{ borderLeft: `3px solid ${n.level === 'warn' ? 'var(--amber)' : n.level === 'good' ? 'var(--green)' : 'var(--border)'}`, paddingLeft: 10 }}>
                <strong>{n.title}</strong> <span className="text-muted">{n.body}</span>
              </div>
            ))}
            {dups.map(([a, b]) => (
              <div key={a.id} className="text-sm" style={{ borderLeft: '3px solid var(--amber)', paddingLeft: 10 }}>
                <strong>Possible duplicate: {a.merchant} {$(-a.amount, true)}</strong> <span className="text-muted">charged {fmtDay(a.date)} and {fmtDay(b.date)} — check whether both are real.</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><h3>Spending by category</h3><span className="text-xs text-muted">{monthName(month, true)}</span></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {cats.length === 0 && <div className="text-muted text-sm">No spending this month.</div>}
            {cats.slice(0, 12).map(c => {
              const b = budgetOf(c.category), max = Math.max(cats[0].amount, b?.monthly || 0)
              return (
                <div key={c.category} title={b ? `Budget ${$(b.monthly)}` : ''}>
                  <div className="flex-between text-sm"><span>{c.category === 'Uncategorized' ? <a href="#review" onClick={e => { e.preventDefault(); goReview(month) }} style={{ color: '#b45309' }}>Not categorized yet — review →</a> : c.category}</span><span><strong>{$(c.amount)}</strong>{b && <span className="text-muted"> / {$(b.monthly)}</span>}</span></div>
                  <div style={{ position: 'relative', height: 8, background: 'var(--surface-hover)', borderRadius: 4 }}>
                    <div style={{ width: `${(c.amount / max) * 100}%`, height: 8, borderRadius: 4, background: b && c.amount > b.monthly ? 'var(--red)' : C_SPEND }} />
                    {b && <div style={{ position: 'absolute', top: -2, left: `${(b.monthly / max) * 100}%`, width: 2, height: 12, background: 'var(--text)' }} />}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Where it went</h3><span className="text-xs text-muted">top merchants</span></div>
          <div className="table-container"><table><tbody>
            {merchants.map(m => <tr key={m.merchant}><td className="text-sm">{m.merchant}</td><td className="text-xs text-muted">{m.count}×</td><td className="text-right text-sm"><strong>{$(m.amount)}</strong></td></tr>)}
          </tbody></table></div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header"><h3>Recurring bills & subscriptions</h3><span className="text-xs text-muted">{$(rec.reduce((s, r) => s + r.monthly, 0))}/mo · subscriptions {$(subs.reduce((s, r) => s + r.monthly, 0))}/mo</span></div>
          <div className="table-container"><table><tbody>
            {rec.slice(0, 20).map(r => (
              <tr key={r.key}>
                <td className="text-sm">{r.merchant}{r.subscription && <span className="badge badge-gray" style={{ marginLeft: 6 }}>sub</span>}{r.increased && <span className="badge" style={{ marginLeft: 6, background: 'var(--red-bg)', color: 'var(--red)' }}>price up</span>}<div className="text-xs text-muted">{r.category} · last {fmtDay(r.last)}</div></td>
                <td className="text-right text-sm"><strong>{$(r.typical, true)}</strong>{r.increased && <div className="text-xs" style={{ color: 'var(--red)' }}>now {$(r.lastAmount, true)}</div>}</td>
              </tr>
            ))}
            {rec.length === 0 && <tr><td className="text-muted text-sm">None found yet.</td></tr>}
          </tbody></table></div>
        </div>
        <Balances f={f} txns={f.txns} />
      </div>
    </div>
  )
}

// ─── RLC Realty: what was earned vs. what passed through to agents ───────────
function Brokerage({ f, txns, month, goReview }) {
  const last = `${month}-31`
  const m = brokerage(txns, `${month}-01`, last)
  const y = brokerage(txns, `${month.slice(0, 4)}-01-01`, last)
  const ledger = agentLedger(txns.filter(t => t.date <= last))
  const owed = ledger.reduce((s, a) => s + Math.max(0, a.balance), 0)
  const truist = accountBalances(f, f.txns).find(a => a.scope === 'business' && a.balance != null)
  const rows = [
    ['Commission deposits (gross, as the bank shows)', 'gross', false],
    ['Agents’ portions (owed to agents — not RLC’s money)', 'agentPortion', true],
    ['RLC’s split', 'rlcEarned', false],
    ['Transaction fees', 'fees', false],
    ['Other business income', 'otherIncome', false],
    ['= RLC revenue', 'revenue', false, true],
    ['Your own production (deals you closed)', 'own', false],
    ['Operating expenses', 'opex', true],
    ['= Business profit', 'profit', false, true],
    ['Paid out to agents', 'payouts', true],
    ['Owner draws (RLC → you)', 'draws', true],
    ['Owner contributions (you → RLC)', 'contributions', false],
    ['Acquisitions & investments (loans, properties — not brokerage costs)', 'acquisitions', true],
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
      <div className="card">
        <div className="card-header"><h3>RLC Realty — earned vs. passed through</h3></div>
        {y.unsplitCount > 0 && (
          <div className="card-body text-sm" style={{ background: '#fffbeb', borderBottom: '1px solid #fcd34d' }}>
            <strong>{$(y.unsplit)}</strong> in {y.unsplitCount} commission deposits isn’t split yet, so it isn’t counted as revenue. <a href="#review" onClick={e => { e.preventDefault(); goReview() }}>Split them in Review →</a>
          </div>
        )}
        <div className="table-container"><table>
          <thead><tr><th></th><th className="text-right">{monthName(month)}</th><th className="text-right">{month.slice(0, 4)} to date</th></tr></thead>
          <tbody>
            {rows.map(([label, k, minus, total]) => (
              <tr key={k} style={total ? { background: 'var(--surface-hover)' } : undefined}>
                <td className="text-sm" style={total ? { fontWeight: 700 } : undefined}>{label}</td>
                <td className="text-right text-sm" style={total ? { fontWeight: 700 } : undefined}>{m[k] ? $(minus ? -m[k] : m[k]) : '—'}</td>
                <td className="text-right text-sm" style={total ? { fontWeight: 700 } : undefined}>{y[k] ? $(minus ? -y[k] : y[k]) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="card">
          <div className="card-header"><h3>Truist: money vs. obligations</h3></div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
            <div><div className="metric-label">In the account</div><div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{truist ? $(truist.balance) : '—'}</div><div className="text-xs text-muted">{truist ? `as of ${fmtDay(truist.asOf)}` : ''}</div></div>
            <div><div className="metric-label">Owed to agents</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: owed ? '#b45309' : undefined }}>{$(owed)}</div><div className="text-xs text-muted">from splits not yet paid</div></div>
            <div><div className="metric-label">Available</div><div style={{ fontSize: '1.3rem', fontWeight: 700, color: truist && truist.balance - owed < 0 ? 'var(--red)' : 'var(--green)' }}>{truist ? $(truist.balance - owed) : '—'}</div><div className="text-xs text-muted">after agent obligations</div></div>
          </div>
          {y.unsplitCount > 0 && <div className="card-body text-xs text-muted" style={{ paddingTop: 0 }}>“Owed to agents” only counts deposits you’ve split — it will grow as you split the rest.</div>}
        </div>

        <div className="card">
          <div className="card-header"><h3>Agents: owed vs. paid</h3><span className="text-xs text-muted">all time</span></div>
          <div className="table-container"><table>
            <thead><tr><th>Agent</th><th className="text-right">Owed</th><th className="text-right">Paid</th><th className="text-right">Balance</th></tr></thead>
            <tbody>
              {ledger.length === 0 && <tr><td colSpan={4} className="text-sm text-muted">Split commission deposits and confirm payouts in Review to see each agent here.</td></tr>}
              {ledger.map(a => (
                <tr key={a.agent}>
                  <td className="text-sm">{a.agent}</td>
                  <td className="text-right text-sm">{a.owed ? $(a.owed) : '—'}</td>
                  <td className="text-right text-sm">{a.paid ? $(a.paid) : '—'}</td>
                  <td className="text-right text-sm" style={{ fontWeight: 600, color: a.balance > 0.5 ? '#b45309' : a.balance < -0.5 ? 'var(--red)' : 'var(--green)' }}>
                    {!a.owed ? <span className="text-muted" style={{ fontWeight: 400 }}>split deposits first</span> : Math.abs(a.balance) < 0.5 ? 'settled' : a.balance > 0 ? `owe ${$(a.balance)}` : `paid ${$(-a.balance)} more than split`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
          <div className="card-body text-xs text-muted">Overpaid usually means a payout whose deposit isn’t split yet, or a payout covering an older deal.</div>
        </div>
      </div>
    </div>
  )
}

/** Latest balance per account: Truist from its running balance, others from the last balance you entered */
export function accountBalances(f, txns) {
  return f.accounts.filter(a => !a.excluded).map(a => {
    const t = txns.filter(x => x.account_id === a.id && x.balance_after != null).sort((x, y) => x.date.localeCompare(y.date)).at(-1)
    const manual = f.meta.balances?.[a.id]
    if (t && (!manual || manual.date <= t.date)) return { ...a, balance: Number(t.balance_after), asOf: t.date, from: 'bank' }
    if (manual) return { ...a, balance: Number(manual.amount), asOf: manual.date, from: 'you' }
    return { ...a, balance: null }
  })
}

function Balances({ f, txns }) {
  const rows = accountBalances(f, txns)
  return (
    <div className="card">
      <div className="card-header"><h3>Account balances</h3></div>
      <div className="table-container"><table><tbody>
        {rows.map(a => (
          <tr key={a.id}>
            <td className="text-sm">{a.name}<div className="text-xs text-muted">{a.scope === 'business' ? 'Business' : 'Personal'} · {a.type?.replace('_', ' ')}</div></td>
            <td className="text-right text-sm">{a.balance == null ? <span className="text-muted">add in Accounts</span> : <><strong>{$(a.balance, true)}</strong><div className="text-xs text-muted">as of {fmtDay(a.asOf)}</div></>}</td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  )
}

// ─── Review ──────────────────────────────────────────────────────────────────
/** What an "always" rule should match: the payee for Zelle, else the merchant */
function ruleText(t) {
  const m = t.description.match(/^(.+?) PAYMENT ID/i)
  if (m) return m[1].trim().toLowerCase()
  return (t.merchant || t.description).toLowerCase().slice(0, 30)
}

const CLOSED_KEY = '__fin_review_closed'   // which Review sections you minimized — remembered on this device
function Review({ f, txns, total, month, months, setMonth, catNames, agents, crm }) {
  const [closed, setClosed] = useState(() => { try { return JSON.parse(localStorage.getItem(CLOSED_KEY)) || [] } catch { return [] } })
  const save = next => { setClosed(next); try { localStorage.setItem(CLOSED_KEY, JSON.stringify(next)) } catch {} }
  const toggle = reason => save(closed.includes(reason) ? closed.filter(r => r !== reason) : [...closed, reason])
  const acct = Object.fromEntries(f.accounts.map(a => [a.id, a]))
  const groups = useMemo(() => {
    const g = new Map()
    for (const t of txns) { const k = t.review_reason || 'Check this'; if (!g.has(k)) g.set(k, []); g.get(k).push(t) }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [txns])
  const monthBar = (
    <div className="card"><div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
      <span className="text-sm" style={{ fontWeight: 600 }}>{month ? `${monthName(month, true)}: ${txns.length} to review` : `All months: ${total} to review`}</span>
      <select value={month || ''} onChange={e => setMonth(e.target.value || null)} style={{ width: 'auto', fontSize: '0.8rem', padding: '4px 8px' }}>
        <option value="">All months</option>
        {[...months].reverse().map(m => <option key={m} value={m}>{monthName(m, true)}</option>)}
      </select>
      {month && <button className="btn btn-sm" onClick={() => setMonth(null)}>Show all months ({total})</button>}
      <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button className="btn btn-sm" onClick={() => save(groups.map(([r]) => r))}>▸ Collapse all</button>
        <button className="btn btn-sm" onClick={() => save([])}>▾ Expand all</button>
      </span>
    </div></div>
  )
  if (!txns.length) return <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{monthBar}<div className="card"><div className="card-body">{month ? `Nothing left to review in ${monthName(month, true)}. 🎉` : 'Nothing waiting — every transaction is categorized. 🎉'}</div></div></div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <datalist id="fin-agents">{agents.map(n => <option key={n} value={n} />)}</datalist>
      {monthBar}
      <div className="text-sm text-muted">Pick what each one is and press ✓. Tick <strong>Always</strong> and every matching transaction — now and in future imports — is handled the same way.</div>
      {groups.map(([reason, list]) => {
        const shut = closed.includes(reason)
        return (
          <div key={reason} className="card">
            <div className="card-header" role="button" tabIndex={0} aria-expanded={!shut} title={shut ? 'Show this section' : 'Minimize this section'}
              onClick={() => toggle(reason)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(reason) } }}
              style={{ cursor: 'pointer', userSelect: 'none', ...(shut ? { borderBottom: 'none' } : {}) }}>
              <h3 style={{ color: 'var(--text)', fontWeight: 700, fontFamily: 'var(--sans, inherit)', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span aria-hidden="true" style={{ display: 'inline-block', width: 12, transition: 'transform .15s', transform: shut ? 'rotate(-90deg)' : 'none', color: '#1c9fd0' }}>▼</span>{reason}
              </h3>
              <span className="text-xs text-muted">{list.length}</span>
            </div>
            {!shut && <>
              <div className="table-container"><table className="fin-table"><tbody>
                {list.slice(0, 50).map(t => <ReviewRow key={t.id} t={t} f={f} catNames={catNames} account={acct[t.account_id]} agents={agents} crm={crm} />)}
              </tbody></table></div>
              {list.length > 50 && <div className="card-body text-xs text-muted">+{list.length - 50} more — rules you save clear many at once.</div>}
            </>}
          </div>
        )
      })}
    </div>
  )
}

function ReviewRow({ t, f, catNames, account, agents, crm }) {
  const [d, setD] = useState({ kind: t.kind, category: t.category || '', scope: t.scope || 'personal', always: false, match: ruleText(t), notes: t.notes || '', agent: t.counterparty || '', deal: t.deal_ref || '', from: t.amount > 0 ? (t.counterparty || '') : '' })
  const [busy, setBusy] = useState(false)
  const [showNote, setShowNote] = useState(false)
  const sel = { fontSize: '0.78rem', padding: '4px 6px', width: 'auto' }
  const done = async patch => { setBusy(true); try { await f.updateTxns([t.id], { status: 'ok', review_reason: null, ...patch }) } finally { setBusy(false) } }

  async function confirm() {
    setBusy(true)
    try {
      const patch = { kind: d.kind, category: d.category || null, scope: d.scope, status: 'ok', review_reason: null, notes: d.notes || null, counterparty: d.from.trim() || d.agent || t.counterparty || null }
      if (d.always && d.match.trim()) {
        await f.addRule({ match: d.match, category: d.category, scope: d.scope, kind: d.kind })
        const ids = f.txns.filter(x => x.status === 'review' && x.description.toLowerCase().includes(d.match.trim().toLowerCase())).map(x => x.id)
        await f.updateTxns([...new Set([t.id, ...ids])], { kind: d.kind, category: d.category || null, scope: d.scope, status: 'ok', review_reason: null, ...(d.from.trim() ? { counterparty: d.from.trim() } : {}) })
        await f.updateTxns([t.id], { notes: d.notes || null, counterparty: patch.counterparty })
      } else await f.updateTxns([t.id], patch)
    } finally { setBusy(false) }
  }
  const needsCategory = !['transfer', 'commission_in', 'agent_payout', 'owner_draw', 'owner_contribution', 'acquisition', 'draw_in'].includes(d.kind)
  return (
    <tr>
      <td className="text-sm fa-date" style={{ whiteSpace: 'nowrap', verticalAlign: 'top' }}>{fmtDay(t.date)}</td>
      <td className="text-sm fa-main" style={{ minWidth: 150, verticalAlign: 'top' }}>{t.counterparty || t.merchant}<FlagMenu t={t} f={f} /><div className="text-xs text-muted" title={t.description}>{t.description.slice(0, 60)}</div>
        {account && <span className="badge" style={{ background: account.scope === 'business' ? '#eef2ff' : '#ecfdf3', color: account.scope === 'business' ? '#4338ca' : '#15803d', fontSize: '0.64rem', marginTop: 3, display: 'inline-block' }}>{account.name}</span>}</td>
      <td className="text-right text-sm fa-amt" style={{ color: t.amount > 0 ? 'var(--green)' : undefined, whiteSpace: 'nowrap', verticalAlign: 'top' }}><strong>{$(t.amount, true)}</strong></td>
      <td className="fa-ctl" style={{ verticalAlign: 'top' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={d.kind} onChange={e => setD({ ...d, kind: e.target.value })} style={{ ...sel, width: 115 }}>
            {t.amount > 0 && account?.scope !== 'business' && <option value="draw_in">Owner draw from RLC (Truist → me)</option>}
            {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          {t.amount > 0 && !['agent_payout', 'acquisition', 'commission_in'].includes(d.kind) && (
            <input placeholder="From (who / acct)" value={d.from} onChange={e => setD({ ...d, from: e.target.value })} style={{ ...sel, width: 115 }} />
          )}
          {['draw_in'].includes(d.kind) && (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => done({ kind: 'transfer', category: 'Owner draw from RLC', scope: 'personal', counterparty: d.from.trim() || 'RLC (Truist)', notes: d.notes || null })}>✓</button>
          )}
          {d.kind === 'agent_payout' && <>
            <input list="fin-agents" placeholder="Which agent?" value={d.agent} onChange={e => setD({ ...d, agent: e.target.value })} style={{ ...sel, width: 120 }} />
            <input placeholder="Deal / property" value={d.deal} onChange={e => setD({ ...d, deal: e.target.value })} style={{ ...sel, width: 125 }} />
            <input placeholder="Memo — what for" value={d.notes} onChange={e => setD({ ...d, notes: e.target.value })} style={{ ...sel, width: 125 }} />
            <button className="btn btn-sm btn-primary" disabled={busy || !d.agent.trim()} onClick={() => done({ kind: 'agent_payout', category: 'Agent Commission', scope: 'business', counterparty: d.agent.trim(), deal_ref: d.deal.trim() || null, notes: d.notes || null })}>✓</button>
          </>}
          {d.kind === 'acquisition' && <>
            <select value={ACQ_CATS.includes(d.category) ? d.category : ''} onChange={e => setD({ ...d, category: e.target.value })} style={sel}><option value="">What kind…</option>{ACQ_CATS.map(c => <option key={c}>{c}</option>)}</select>
            <input placeholder="Paid to (lender, seller…)" value={d.agent} onChange={e => setD({ ...d, agent: e.target.value })} style={{ ...sel, width: 150 }} />
            <input placeholder="Property / loan (e.g. Jose’s loan)" value={d.deal} onChange={e => setD({ ...d, deal: e.target.value })} style={{ ...sel, width: 180 }} />
            <input placeholder="Memo" value={d.notes} onChange={e => setD({ ...d, notes: e.target.value })} style={{ ...sel, width: 150 }} />
            <label className="text-xs" style={{ display: 'flex', gap: 3, alignItems: 'center', textTransform: 'none', letterSpacing: 0 }}>
              <input type="checkbox" checked={d.always} onChange={e => setD({ ...d, always: e.target.checked })} /> Always for this payee
            </label>
            <button className="btn btn-sm btn-primary" disabled={busy || !d.category} onClick={async () => {
              const patch = { kind: 'acquisition', category: d.category, scope: 'business', counterparty: d.agent.trim() || t.counterparty || null, deal_ref: d.deal.trim() || null, notes: d.notes || null }
              if (d.always && d.match.trim()) {
                await f.addRule({ match: d.match, category: d.category, scope: 'business', kind: 'acquisition' })
                const ids = f.txns.filter(x => x.status === 'review' && x.description.toLowerCase().includes(d.match.trim().toLowerCase())).map(x => x.id)
                await f.updateTxns([...new Set([t.id, ...ids])], { kind: 'acquisition', category: d.category, scope: 'business', deal_ref: patch.deal_ref, counterparty: patch.counterparty, status: 'ok', review_reason: null })
                if (d.notes) await f.updateTxns([t.id], { notes: d.notes })
              } else await done(patch)
            }}>✓</button>
          </>}
          {['owner_draw', 'owner_contribution', 'transfer'].includes(d.kind) && (
            <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => done({ kind: d.kind, category: d.kind === 'owner_draw' ? 'Owner Draw/Personal Use' : d.kind === 'owner_contribution' ? 'Owner contribution to RLC' : 'Transfer', notes: d.notes || null, ...(d.from.trim() ? { counterparty: d.from.trim() } : {}) })}>✓</button>
          )}
          {needsCategory && <>
            <select value={d.category} onChange={e => setD({ ...d, category: e.target.value })} style={{ ...sel, width: 140 }}><option value="">Category…</option>{catNames.map(c => <option key={c}>{c}</option>)}</select>
            <select value={d.scope} onChange={e => setD({ ...d, scope: e.target.value })} style={{ ...sel, width: 84 }}><option value="personal">Personal</option><option value="business">Business</option></select>
            {showNote || d.notes
              ? <input autoFocus={showNote && !d.notes} placeholder="note" value={d.notes} onChange={e => setD({ ...d, notes: e.target.value })} style={{ ...sel, width: 110 }} />
              : <button type="button" className="btn btn-sm" style={{ padding: '3px 7px' }} onClick={() => setShowNote(true)}>+ Note</button>}
            <label className="text-xs" title="Always: handle every matching transaction the same way, now and in future imports" style={{ display: 'flex', gap: 2, alignItems: 'center', textTransform: 'none', letterSpacing: 0 }}>
              <input type="checkbox" checked={d.always} onChange={e => setD({ ...d, always: e.target.checked })} />Always
            </label>
            {d.always && <input value={d.match} onChange={e => setD({ ...d, match: e.target.value })} title="Matches any description containing this" style={{ ...sel, width: 120 }} />}
            <button className="btn btn-sm btn-primary" disabled={busy || !d.category} onClick={confirm}>✓</button>
          </>}
        </div>
        {d.kind === 'commission_in' && <SplitEditor t={t} agents={agents} crm={crm} busy={busy} onSave={splits => done({ kind: 'commission_in', category: 'Commission Income', scope: 'business', splits, deal_ref: splits.find(s => s.deal_ref)?.deal_ref || null })} />}
      </td>
    </tr>
  )
}

/** Split a commission deposit: agent portion (owed), RLC's split + fees (earned), or your own deal */
function SplitEditor({ t, agents, crm, busy, onSave }) {
  const gross = Math.abs(t.amount)
  const existing = Array.isArray(t.splits) ? t.splits : []
  const [own, setOwn] = useState(existing.some(p => p.part === 'own'))
  const [agent, setAgent] = useState(existing.find(p => p.part === 'agent')?.agent || '')
  const [agentAmt, setAgentAmt] = useState(existing.find(p => p.part === 'agent')?.amount ?? '')
  const [fee, setFee] = useState(existing.find(p => p.part === 'fee')?.amount ?? '')
  const [deal, setDeal] = useState(existing.find(p => p.deal_ref)?.deal_ref || '')
  const a = own ? 0 : Number(agentAmt) || 0, fz = Number(fee) || 0
  const rest = Math.round((gross - a - fz) * 100) / 100
  const pct = p => { setOwn(false); setAgentAmt(String(Math.round(gross * p) / 100)) }
  const matches = (crm || []).filter(c => Math.abs(c.amount - gross) <= 1 && Math.abs(Date.parse(c.date || t.date) - Date.parse(t.date)) <= 45 * 864e5).slice(0, 3)
  const save = () => onSave(own
    ? [{ part: 'own', amount: Math.round((gross - fz) * 100) / 100, deal_ref: deal || null }, ...(fz ? [{ part: 'fee', amount: fz }] : [])]
    : [{ part: 'agent', amount: a, agent: agent.trim(), deal_ref: deal || null }, { part: 'brokerage', amount: rest }, ...(fz ? [{ part: 'fee', amount: fz }] : [])].filter(p => p.amount))
  const box = { fontSize: '0.78rem', padding: '4px 6px' }
  return (
    <div style={{ marginTop: 8, padding: 10, background: 'var(--surface-hover)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 560 }}>
      {matches.map(m => (
        <button key={m.id} className="btn btn-sm" style={{ textAlign: 'left', justifyContent: 'flex-start' }} onClick={() => { setOwn(m.own); setAgent(m.agent || ''); setAgentAmt(m.agentAmount != null ? String(m.agentAmount) : ''); setDeal(m.label) }}>
          From your CRM: {m.label} · {m.agent || 'agent ?'} · {m.date ? fmtDay(m.date) : ''}{m.agentAmount != null ? ` · agent ${$(m.agentAmount)}` : ''} — use this?
        </button>
      ))}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span className="text-xs text-muted">Quick split:</span>
        <button className="btn btn-sm" onClick={() => pct(90)}>Agent 90 / RLC 10</button>
        <button className="btn btn-sm" onClick={() => pct(80)}>80 / 20</button>
        <button className="btn btn-sm" onClick={() => pct(70)}>70 / 30</button>
        <button className={`btn btn-sm${own ? ' btn-primary' : ''}`} onClick={() => setOwn(o => !o)}>My own deal</button>
      </div>
      {!own && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <input list="fin-agents" placeholder="Agent" value={agent} onChange={e => setAgent(e.target.value)} style={{ ...box, width: 150 }} />
          <input type="number" placeholder="Agent's portion $" value={agentAmt} onChange={e => setAgentAmt(e.target.value)} style={{ ...box, width: 130 }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="number" placeholder="Transaction fee $ (optional)" value={fee} onChange={e => setFee(e.target.value)} style={{ ...box, width: 190 }} />
        <input placeholder="Deal / property (optional)" value={deal} onChange={e => setDeal(e.target.value)} style={{ ...box, width: 190 }} />
      </div>
      <div className="text-xs">
        {own ? <>Your production: <strong>{$(gross - fz, true)}</strong></> : <>Owed to {agent || 'agent'}: <strong>{$(a, true)}</strong> · RLC keeps: <strong style={{ color: rest < 0 ? 'var(--red)' : undefined }}>{$(rest, true)}</strong></>}
        {fz ? <> · fee {$(fz, true)}</> : null}
        <button className="btn btn-sm btn-primary" style={{ marginLeft: 8 }} disabled={busy || rest < 0 || (!own && (!agent.trim() || !a))} onClick={save}>Save split</button>
      </div>
    </div>
  )
}

// ─── Flags: "don't recognize" and refunds ────────────────────────────────────
export const FLAGS = {
  unknown: { label: 'Don’t recognize', color: '#b45309', bg: '#fffbeb' },
  refund: { label: 'Request refund', color: '#7c3aed', bg: '#f5f3ff' },
  refund_requested: { label: 'Refund requested', color: '#2563eb', bg: '#eff6ff' },
  resolved: { label: 'Resolved', color: '#15803d', bg: '#ecfdf3' },
}

/** Tag a transaction; "don't recognize" and "request refund" also drop a task in your Inbox */
function FlagMenu({ t, f }) {
  const { saveTask } = useCeo()
  const cur = f.meta.flags?.[t.id]
  async function set(flag) {
    const all = { ...(f.meta.flags || {}) }
    if (!flag) { delete all[t.id]; await f.setMeta('flags', all); return }
    const entry = { ...(cur || {}), flag, at: new Date().toISOString() }
    if ((flag === 'unknown' || flag === 'refund') && !cur?.task_id) {
      const what = `${t.counterparty || t.merchant} ${$(Math.abs(t.amount), true)} on ${fmtDay(t.date)}`
      try {
        const task = await saveTask({
          title: flag === 'refund' ? `Request refund: ${what}` : `Look into charge I don’t recognize: ${what}`,
          status: 'next', priority: flag === 'refund' ? 'high' : 'medium', category: 'finance',
          notes: `Finance → Transactions (flagged). ${t.description}`,
        })
        entry.task_id = task?.id || null
      } catch {}
    }
    await f.setMeta('flags', { ...all, [t.id]: entry })
  }
  const style = cur ? { background: FLAGS[cur.flag]?.bg, color: FLAGS[cur.flag]?.color, borderColor: FLAGS[cur.flag]?.color } : {}
  return (
    <select className="fin-flag" value={cur?.flag || ''} onChange={e => set(e.target.value)} title="Flag this transaction"
      style={{ marginLeft: 6, fontSize: '0.7rem', padding: '1px 4px', width: 'auto', maxWidth: 150, ...style }}>
      <option value="">⚑ Flag…</option>
      {Object.entries(FLAGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
      {cur && <option value="">Remove flag</option>}
    </select>
  )
}

/** Dashboard list of flagged transactions that still need something from you */
function NeedsAction({ f, txns }) {
  const flags = f.meta.flags || {}
  const byId = new Map(txns.map(t => [t.id, t]))
  const open = Object.entries(flags).filter(([, v]) => v.flag !== 'resolved').map(([id, v]) => ({ t: byId.get(id), ...v })).filter(x => x.t)
    .sort((a, b) => b.t.date.localeCompare(a.t.date))
  if (!open.length) return null
  const refundTotal = open.filter(x => x.flag !== 'unknown').reduce((s, x) => s + Math.abs(x.t.amount), 0)
  return (
    <div className="card" style={{ borderLeft: '3px solid #7c3aed' }}>
      <div className="card-header"><h3>Needs action</h3><span className="text-xs text-muted">{open.length} flagged{refundTotal ? ` · ${$(refundTotal, true)} in refunds` : ''}</span></div>
      <div className="table-container"><table className="fin-table"><tbody>
        {open.map(({ t, flag }) => (
          <tr key={t.id}>
            <td className="text-sm fa-date">{fmtDay(t.date)}</td>
            <td className="text-sm fa-main">{t.counterparty || t.merchant}<FlagMenu t={t} f={f} /></td>
            <td className="fa-acct"><span className="badge" style={{ background: FLAGS[flag]?.bg, color: FLAGS[flag]?.color }}>{FLAGS[flag]?.label}</span></td>
            <td className="text-right text-sm fa-amt"><strong>{$(t.amount, true)}</strong></td>
          </tr>
        ))}
      </tbody></table></div>
    </div>
  )
}

// ─── Transactions ────────────────────────────────────────────────────────────
function Transactions({ f, txns, scope, months, catNames }) {
  const [q, setQ] = useState({ month: '', account: '', kind: '', category: '', text: '', flag: '' })
  const [limit, setLimit] = useState(150)
  const rows = txns.filter(t => inScope(t, scope) && (!q.month || t.date.startsWith(q.month)) && (!q.account || t.account_id === q.account)
    && (!q.kind || t.kind === q.kind) && (!q.category || t.category === q.category)
    && (!q.flag || (q.flag === 'any' ? f.meta.flags?.[t.id] : f.meta.flags?.[t.id]?.flag === q.flag))
    && (!q.text || `${t.description} ${t.merchant} ${t.notes || ''}`.toLowerCase().includes(q.text.toLowerCase())))
  const total = rows.reduce((s, t) => s + t.amount, 0)
  const recIds = useMemo(() => new Set([...findRecurring(txns).values()].flat().map(t => t.id)), [txns])
  const acct = Object.fromEntries(f.accounts.map(a => [a.id, a.name]))
  const sel = { fontSize: '0.78rem', padding: '4px 6px', width: 'auto' }
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input placeholder="Search…" value={q.text} onChange={e => setQ({ ...q, text: e.target.value })} style={{ ...sel, width: 160 }} />
        <select value={q.month} onChange={e => setQ({ ...q, month: e.target.value })} style={sel}><option value="">All months</option>{[...months].reverse().map(m => <option key={m} value={m}>{monthName(m, true)}</option>)}</select>
        <select value={q.account} onChange={e => setQ({ ...q, account: e.target.value })} style={sel}><option value="">All accounts</option>{f.accounts.filter(a => !a.excluded).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select value={q.kind} onChange={e => setQ({ ...q, kind: e.target.value })} style={sel}><option value="">All types</option>{KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select>
        <select value={q.category} onChange={e => setQ({ ...q, category: e.target.value })} style={sel}><option value="">All categories</option>{catNames.map(c => <option key={c}>{c}</option>)}</select>
        <select value={q.flag} onChange={e => setQ({ ...q, flag: e.target.value })} style={sel}><option value="">Any flag</option><option value="any">Flagged</option>{Object.entries(FLAGS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <span className="text-xs text-muted">{rows.length} · net {$(total, true)}</span>
      </div>
      <div className="table-container"><table className="fin-table">
        <thead><tr><th>Date</th><th>Merchant</th><th>Account</th><th>Type</th><th>Category</th><th>P/B</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {rows.slice(0, limit).map(t => (
            <tr key={t.id}>
              <td className="text-sm fa-date" style={{ whiteSpace: 'nowrap' }}>{fmtDay(t.date)}</td>
              <td className="text-sm fa-main">{t.counterparty || t.merchant}<FlagMenu t={t} f={f} />{t.deal_ref && <div className="text-xs" style={{ color: '#4338ca' }}>{t.deal_ref}</div>}{t.status === 'review' && <span className="badge" style={{ marginLeft: 6, background: 'var(--amber-bg, #fffbeb)', color: '#b45309' }}>review</span>}{recIds.has(t.id) && <span className="badge badge-gray" style={{ marginLeft: 6 }}>recurring</span>}{t.notes && <div className="text-xs text-muted">{t.notes}</div>}</td>
              <td className="text-xs text-muted fa-acct">{acct[t.account_id]}</td>
              <td className="fa-kind"><select value={t.kind} onChange={e => f.updateTxns([t.id], { kind: e.target.value })} style={sel}>{KINDS.map(k => <option key={k} value={k}>{KIND_LABELS[k]}</option>)}</select></td>
              <td className="fa-cat"><select value={t.category || ''} onChange={e => f.updateTxns([t.id], { category: e.target.value || null, status: 'ok', review_reason: null })} style={sel}><option value="">—</option>{catNames.map(c => <option key={c}>{c}</option>)}</select></td>
              <td className="fa-scope"><select value={t.scope || 'personal'} onChange={e => f.updateTxns([t.id], { scope: e.target.value })} style={sel}><option value="personal">Personal</option><option value="business">Business</option></select></td>
              <td className="text-right text-sm fa-amt" style={{ color: t.amount > 0 ? 'var(--green)' : undefined, whiteSpace: 'nowrap' }}><strong>{$(t.amount, true)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table></div>
      {rows.length > limit && <div className="card-body"><button className="btn btn-sm" onClick={() => setLimit(l => l + 300)}>Show more ({rows.length - limit} left)</button></div>}
    </div>
  )
}

// ─── Budgets & goals ─────────────────────────────────────────────────────────
function Budgets({ f, txns, scope, month, catNames }) {
  const cats = byCategory(txns, scope, month)
  const ms = monthly(txns, scope).filter(m => m.month < month).slice(-3).map(m => m.month)
  const avgFor = c => ms.length ? Math.round(ms.reduce((s, m) => s + (byCategory(txns, scope, m).find(x => x.category === c)?.amount || 0), 0) / ms.length) : 0
  const [nb, setNb] = useState({ category: '', monthly: '' })
  const [ng, setNg] = useState({ name: '', target: '', account_id: '', target_date: '', start_amount: '' })
  const balances = accountBalances(f, f.txns)
  const budgets = f.budgets.filter(b => scope === 'all' || b.scope === scope || b.scope === 'all')
  const totalBudget = budgets.reduce((s, b) => s + Number(b.monthly), 0)
  const spentInBudget = budgets.reduce((s, b) => s + (cats.find(c => c.category === b.category)?.amount || 0), 0)
  const sel = { fontSize: '0.82rem', padding: '5px 8px' }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20, alignItems: 'start' }}>
      <div className="card">
        <div className="card-header"><h3>Monthly budgets</h3><span className="text-xs text-muted">{monthName(month, true)} · {$(spentInBudget)} of {$(totalBudget)}</span></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {budgets.length === 0 && <div className="text-sm text-muted">No budgets yet. Start with your top 3–5 spending categories — the suggested amount is your 3-month average.</div>}
          {budgets.map(b => {
            const spent = cats.find(c => c.category === b.category)?.amount || 0
            const pct = Math.min(100, (spent / b.monthly) * 100)
            return (
              <div key={b.id}>
                <div className="flex-between text-sm"><span>{b.category}</span><span><strong style={{ color: spent > b.monthly ? 'var(--red)' : undefined }}>{$(spent)}</strong> / {$(b.monthly)} <button className="btn btn-sm" style={{ padding: '0 6px' }} onClick={() => f.deleteBudget(b.id)}>×</button></span></div>
                <div style={{ height: 8, background: 'var(--surface-hover)', borderRadius: 4 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: spent > b.monthly ? 'var(--red)' : pct > 85 ? 'var(--amber)' : 'var(--green)' }} /></div>
              </div>
            )
          })}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <select value={nb.category} onChange={e => setNb({ category: e.target.value, monthly: nb.monthly || String(avgFor(e.target.value) || '') })} style={{ ...sel, flex: 1, minWidth: 160 }}>
              <option value="">Category…</option>{catNames.map(c => <option key={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="$ / month" value={nb.monthly} onChange={e => setNb({ ...nb, monthly: e.target.value })} style={{ ...sel, width: 110 }} />
            <button className="btn btn-sm btn-primary" disabled={!nb.category || !Number(nb.monthly)} onClick={() => { f.saveBudget({ id: `b-${Date.now().toString(36)}`, category: nb.category, monthly: Number(nb.monthly), scope }); setNb({ category: '', monthly: '' }) }}>Add</button>
          </div>
          {nb.category && <div className="text-xs text-muted">Your 3-month average for {nb.category}: {$(avgFor(nb.category))}</div>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Savings goals</h3></div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {f.goals.length === 0 && <div className="text-sm text-muted">Add a goal (emergency fund, taxes, a trip). Link it to an account and progress follows that account’s balance.</div>}
          {f.goals.map(g => {
            const acc = balances.find(a => a.id === g.account_id)
            const have = acc?.balance ?? Number(g.start_amount || 0)
            const pct = Math.max(0, Math.min(100, (have / g.target) * 100))
            const monthsLeft = g.target_date ? Math.max(1, Math.round((Date.parse(g.target_date) - Date.now()) / (30.4 * 864e5))) : null
            return (
              <div key={g.id}>
                <div className="flex-between text-sm"><strong>{g.name}</strong><span>{$(have)} / {$(g.target)} <button className="btn btn-sm" style={{ padding: '0 6px' }} onClick={() => f.deleteGoal(g.id)}>×</button></span></div>
                <div style={{ height: 8, background: 'var(--surface-hover)', borderRadius: 4 }}><div style={{ width: `${pct}%`, height: 8, borderRadius: 4, background: C_INCOME }} /></div>
                <div className="text-xs text-muted">{acc ? `Tracks ${acc.name}` : 'Manual amount'}{monthsLeft && have < g.target ? ` · save ${$((g.target - have) / monthsLeft)}/month to hit it by ${fmtDay(g.target_date)}` : ''}</div>
              </div>
            )
          })}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
            <input placeholder="Goal name" value={ng.name} onChange={e => setNg({ ...ng, name: e.target.value })} style={sel} />
            <input type="number" placeholder="Target $" value={ng.target} onChange={e => setNg({ ...ng, target: e.target.value })} style={sel} />
            <select value={ng.account_id} onChange={e => setNg({ ...ng, account_id: e.target.value })} style={sel}><option value="">No account (manual)</option>{balances.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
            {ng.account_id ? <span /> : <input type="number" placeholder="Saved so far $" value={ng.start_amount} onChange={e => setNg({ ...ng, start_amount: e.target.value })} style={sel} />}
            <input type="date" value={ng.target_date} onChange={e => setNg({ ...ng, target_date: e.target.value })} style={sel} />
            <button className="btn btn-sm btn-primary" disabled={!ng.name || !Number(ng.target)} onClick={() => { f.saveGoal({ id: `g-${Date.now().toString(36)}`, name: ng.name, target: Number(ng.target), account_id: ng.account_id || null, target_date: ng.target_date || null, start_amount: Number(ng.start_amount) || 0 }); setNg({ name: '', target: '', account_id: '', target_date: '', start_amount: '' }) }}>Add goal</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Accounts ────────────────────────────────────────────────────────────────
function Accounts({ f, txns, fresh }) {
  const balances = accountBalances(f, txns)
  const today = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10)
  const [edit, setEdit] = useState({})
  const [open, setOpen] = useState({})
  const st = id => f.statements.filter(s => s.account_id === id)
  const hist = f.meta.balance_history || {}

  /** Every balance you enter is kept (with its date); the latest one is the current reference point */
  async function saveBalance(id) {
    const e = edit[id] || {}
    const entry = { amount: Number(e.amount), date: e.date || today, entered_at: new Date().toISOString() }
    const list = [...(hist[id] || []).filter(x => x.date !== entry.date), entry].sort((x, y) => x.date.localeCompare(y.date))
    await f.setMeta('balance_history', { ...hist, [id]: list })
    await f.setMeta('balances', { ...(f.meta.balances || {}), [id]: { amount: list.at(-1).amount, date: list.at(-1).date } })
    setEdit({ ...edit, [id]: {} })
  }
  async function removeBalance(id, date) {
    const list = (hist[id] || []).filter(x => x.date !== date)
    await f.setMeta('balance_history', { ...hist, [id]: list })
    const rest = { ...(f.meta.balances || {}) }
    if (list.length) rest[id] = { amount: list.at(-1).amount, date: list.at(-1).date }; else delete rest[id]
    await f.setMeta('balances', rest)
  }
  /** Your entries + month-end balances from bank files or worked back — newest first */
  const historyFor = id => [
    ...(hist[id] || []).map(x => ({ date: x.date, amount: x.amount, source: 'you' })),
    ...st(id).filter(s => s.closing_balance != null).map(s => ({ date: s.period_end, amount: Number(s.closing_balance), source: s.status === 'reconciled' ? 'bank file' : 'worked back' })),
  ].sort((x, y) => y.date.localeCompare(x.date))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="table-container"><table>
          <thead><tr><th>Account</th><th>Data through</th><th>Months checked</th><th className="text-right">Balance</th><th>Add a balance</th></tr></thead>
          <tbody>
            {f.accounts.map(a => {
              const b = balances.find(x => x.id === a.id), s = st(a.id), ok = s.filter(x => x.status === 'reconciled' || x.status === 'derived').length, derived = s.some(x => x.status === 'derived')
              const h = historyFor(a.id), e = edit[a.id] || {}
              return (
                <Fragment key={a.id}>
                  <tr style={a.excluded ? { opacity: 0.55 } : undefined}>
                    <td className="text-sm"><strong>{a.name}</strong><div className="text-xs text-muted">{a.excluded ? 'Excluded from all reporting' : `${a.scope === 'business' ? 'Business' : 'Personal'} · ${a.type?.replace('_', ' ')}`}</div></td>
                    <td className="text-sm">{fresh.per[a.id] ? fmtDay(fresh.per[a.id]) : <span className="text-muted">no statements</span>}</td>
                    <td className="text-sm">{s.length ? <><span style={{ color: ok === s.length ? 'var(--green)' : 'var(--amber)' }}>{ok}/{s.length} {derived ? 'worked back from your balance' : 'balanced'}</span>{(() => {
                      const off = s.filter(x => x.status === 'off').sort((x, y) => x.id.localeCompare(y.id))
                      if (!off.length) return null
                      const low = Math.min(...off.map(x => Math.min(Number(x.opening_balance), Number(x.closing_balance))))
                      return <div className="text-xs" style={{ color: '#b45309' }}>Runs about {$(-low)} below $0 from {monthName(off[0].id.slice(-7))}{off.length > 1 ? ` to ${monthName(off.at(-1).id.slice(-7))}` : ''} — most likely one missing deposit of about {$(-low)} (a PDF statement will confirm)</div>
                    })()}</> : <span className="text-muted">{a.excluded ? '—' : 'no running balance yet — add PDFs or a balance'}</span>}</td>
                    <td className="text-right text-sm">{b?.balance != null ? <>{$(b.balance, true)}<div className="text-xs text-muted">{b.from === 'bank' ? 'from bank file' : 'entered'} · {fmtDay(b.asOf)}</div></> : '—'}
                      {h.length > 0 && <div><button className="btn btn-sm" style={{ padding: '0 6px', marginTop: 4 }} onClick={() => setOpen({ ...open, [a.id]: !open[a.id] })}>{open[a.id] ? 'Hide' : 'History'} ({h.length})</button></div>}
                    </td>
                    <td>{!a.excluded && (
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <input type="number" placeholder="$" value={e.amount ?? ''} onChange={ev => setEdit({ ...edit, [a.id]: { ...e, amount: ev.target.value } })} style={{ width: 100, fontSize: '0.78rem', padding: '4px 6px' }} />
                        <input type="date" value={e.date || today} max={today} onChange={ev => setEdit({ ...edit, [a.id]: { ...e, date: ev.target.value } })} style={{ width: 130, fontSize: '0.78rem', padding: '4px 6px' }} title="Balance as of this date" />
                        <button className="btn btn-sm" disabled={e.amount === undefined || e.amount === ''} onClick={() => saveBalance(a.id)}>Save</button>
                      </span>
                    )}</td>
                  </tr>
                  {open[a.id] && (
                    <tr><td colSpan={5} style={{ background: 'var(--surface-hover)' }}>
                      <table style={{ width: '100%', maxWidth: 560 }}><tbody>
                        {h.map((x, i) => {
                          const prev = h[i + 1]
                          return (
                            <tr key={`${x.date}${x.source}`}>
                              <td className="text-sm">{fmtDay(x.date)} {x.date.slice(0, 4)}</td>
                              <td className="text-right text-sm"><strong>{$(x.amount, true)}</strong></td>
                              <td className="text-right text-xs" style={{ color: prev ? (x.amount >= prev.amount ? 'var(--green)' : 'var(--red)') : undefined }}>{prev ? `${x.amount >= prev.amount ? '+' : ''}${$(x.amount - prev.amount, true)}` : ''}</td>
                              <td className="text-xs text-muted">{x.source === 'you' ? 'entered by you' : x.source}</td>
                              <td>{x.source === 'you' && <button className="btn btn-sm" style={{ padding: '0 6px' }} title="Remove this entry" onClick={() => removeBalance(a.id, x.date)}>×</button>}</td>
                            </tr>
                          )
                        })}
                      </tbody></table>
                    </td></tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-header"><h3>Your routine</h3></div>
        <div className="card-body text-sm" style={{ lineHeight: 1.7 }}>
          <div><strong>Weekly (2 min, optional):</strong> download “recent activity” CSVs for NFCU checking and the Amex into <strong>Desktop › Finance 2026</strong>, then press <strong>Import statements</strong> at the top. Overlaps are handled automatically.</div>
          <div><strong>Monthly:</strong> add each account’s full-month CSV and PDF statement to its folder, then press <strong>Import statements</strong> (or ask Claude). It matches transfers, categorizes and checks balances; only uncertain items land in Review.</div>
          <div><strong>Sunday review:</strong> Dashboard → Review → Budgets. Everything shows its “data through” date, so you always know how current it is.</div>
          {f.meta.last_import?.report && <details style={{ marginTop: 8 }}><summary className="text-muted">Last import report</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.72rem' }}>{f.meta.last_import.report}</pre></details>}
        </div>
      </div>
    </div>
  )
}
