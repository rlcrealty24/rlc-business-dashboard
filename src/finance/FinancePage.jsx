// ─── Finance ─────────────────────────────────────────────────────────────────
// Dashboard over your imported bank statements (private fin_* tables).
// Statements are imported by Claude from ~/Desktop/Finance 2026 (scripts/finance-import.mjs);
// this page is for understanding the numbers and confirming what needs you.
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { DEFAULT_CATEGORIES } from './vendorMap.js'
import { useFinance } from './store.js'
import { byCategory, duplicates, findRecurring, freshness, inScope, insights, monthly, months as monthList, recurring, SPEND, topMerchants } from './analytics.js'
import { CategoriesTab, TaxTab } from '../pages/Finance.jsx'

const C_INCOME = '#2a78d6', C_SPEND = '#eb6834'    // reference palette slots 1 + 2
const SYSTEM_CATS = ['Transfer', 'Wallet transfer', 'Credit Card Payment', 'Personal Savings', 'Owner Draw/Personal Use']
const KINDS = ['expense', 'income', 'refund', 'transfer']
const START = '2026-01-01'   // reporting (and reconciliation) starts January 2026
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

  const live = useMemo(() => {
    const excluded = new Set(f.accounts.filter(a => a.excluded).map(a => a.id))
    return f.txns.filter(t => !excluded.has(t.account_id) && t.date >= START)
  }, [f.txns, f.accounts])
  const ms = useMemo(() => monthList(live), [live])
  const fresh = useMemo(() => freshness(live, f.accounts.filter(a => !a.excluded && live.some(t => t.account_id === a.id))), [live, f.accounts])
  const inProgress = fresh.latest && ms.at(-1) === fresh.latest.slice(0, 7)
  const sel = month && ms.includes(month) ? month : (inProgress && ms.length > 1 ? ms.at(-2) : ms.at(-1))
  const review = live.filter(t => t.status === 'review')
  const catNames = useMemo(() => [...new Set([...(categories || []).map(c => c.name), ...SYSTEM_CATS])].sort(), [categories])

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
    <div>
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
        <div className="tabs" style={{ margin: 0 }}>
          {[['all', 'All'], ['personal', 'Personal'], ['business', 'Business']].map(([k, l]) => (
            <button key={k} className={`tab ${scope === k ? 'active' : ''}`} onClick={() => setScope(k)}>{l}</button>
          ))}
        </div>
      </div>
      {fresh.through && ago(fresh.through) > 10 && (
        <div className="card mb-16" style={{ borderLeft: '3px solid var(--amber)' }}><div className="card-body text-sm">
          The newest bank data is {ago(fresh.through)} days old — download recent-activity CSVs into <strong>Desktop › Finance 2026</strong> and ask Claude to “process my statements.”
        </div></div>
      )}
      <div className="tabs">{TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}</div>

      {tab === 'dashboard' && <Dashboard f={f} txns={live} scope={scope} month={sel} months={ms} setMonth={setMonth} fresh={fresh} goReview={() => setTab('review')} />}
      {tab === 'review' && <Review f={f} txns={review} catNames={catNames} />}
      {tab === 'transactions' && <Transactions f={f} txns={live} scope={scope} months={ms} catNames={catNames} />}
      {tab === 'budgets' && <Budgets f={f} txns={live} scope={scope} month={sel} catNames={catNames} />}
      {tab === 'accounts' && <Accounts f={f} txns={f.txns} fresh={fresh} />}
      {tab === 'categories' && <CategoriesTab categories={categories} setCategories={setCategories} />}
      {tab === 'tax' && <TaxTab transactions={live.filter(t => (t.scope === 'business') && (t.kind === 'income' || SPEND(t))).map(t => ({
        id: t.id, date: t.date, type: t.kind === 'income' ? 'income' : 'expense', amount: t.kind === 'income' ? t.amount : -t.amount,
        category: t.category, spendingType: 'business', status: 'cleared', description: t.merchant,
      }))} />}
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
        <div className="metric-card metric-card-income"><div className="metric-label">Money in</div><div className="metric-value">{$(cur.income)}</div>{delta(cur.income, avg('income'), true)}</div>
        <div className="metric-card metric-card-expense"><div className="metric-label">Spending</div><div className="metric-value">{$(cur.spending)}</div>{delta(cur.spending, avg('spending'), false)}</div>
        <div className="metric-card metric-card-net"><div className="metric-label">Net cash flow</div><div className="metric-value" style={{ color: cur.net < 0 ? 'var(--red)' : 'var(--green)' }}>{$(cur.net)}</div><div className="metric-change neutral">{cur.income > 0 ? `${Math.round((cur.net / cur.income) * 100)}% of money in kept` : '—'}</div></div>
        <div className="metric-card metric-card-pending" style={{ cursor: review ? 'pointer' : 'default' }} onClick={review ? goReview : undefined}>
          <div className="metric-label">Needs your review</div><div className="metric-value">{review}</div><div className="metric-change neutral">{review ? 'this month · tap to review' : 'all clear this month'}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3>Money in vs spending · last {series.length} months</h3><span className="text-xs text-muted">transfers between your accounts excluded</span></div>
        <div className="card-body" style={{ height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series.map(m => ({ ...m, label: monthName(m.month) }))} barGap={2} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--border)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: 'var(--border)' }} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tickFormatter={v => `$${Math.round(v / 1000)}k`} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} width={48} />
              <Tooltip formatter={(v, n) => [$(v), n]} labelFormatter={(l, p) => `${l} · net ${$(p?.[0]?.payload?.net ?? 0)}`} cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
              <Legend iconType="square" wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="income" name="Money in" fill={C_INCOME} radius={[4, 4, 0, 0]} maxBarSize={24} />
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
                  <div className="flex-between text-sm"><span>{c.category === 'Uncategorized' ? <a href="#review" onClick={e => { e.preventDefault(); goReview() }} style={{ color: '#b45309' }}>Not categorized yet — review →</a> : c.category}</span><span><strong>{$(c.amount)}</strong>{b && <span className="text-muted"> / {$(b.monthly)}</span>}</span></div>
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

function Review({ f, txns, catNames }) {
  const groups = useMemo(() => {
    const g = new Map()
    for (const t of txns) { const k = t.review_reason || 'Check this'; if (!g.has(k)) g.set(k, []); g.get(k).push(t) }
    return [...g.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [txns])
  if (!txns.length) return <div className="card"><div className="card-body">Nothing waiting — every transaction is categorized. 🎉</div></div>
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="text-sm text-muted">Pick what each one is and press ✓. Tick <strong>Always</strong> and every matching transaction — now and in future imports — is handled the same way.</div>
      {groups.map(([reason, list]) => (
        <div key={reason} className="card">
          <div className="card-header"><h3>{reason}</h3><span className="text-xs text-muted">{list.length}</span></div>
          <div className="table-container"><table><tbody>
            {list.slice(0, 50).map(t => <ReviewRow key={t.id} t={t} f={f} catNames={catNames} />)}
          </tbody></table></div>
          {list.length > 50 && <div className="card-body text-xs text-muted">+{list.length - 50} more — rules you save clear many at once.</div>}
        </div>
      ))}
    </div>
  )
}

function ReviewRow({ t, f, catNames }) {
  const [d, setD] = useState({ kind: t.kind, category: t.category || '', scope: t.scope || 'personal', always: false, match: ruleText(t), notes: t.notes || '' })
  const [busy, setBusy] = useState(false)
  async function confirm() {
    setBusy(true)
    try {
      const patch = { kind: d.kind, category: d.category || null, scope: d.scope, status: 'ok', review_reason: null, notes: d.notes || null }
      if (d.always && d.match.trim()) {
        await f.addRule({ match: d.match, category: d.category, scope: d.scope, kind: d.kind })
        const ids = f.txns.filter(x => x.status === 'review' && x.description.toLowerCase().includes(d.match.trim().toLowerCase())).map(x => x.id)
        await f.updateTxns([...new Set([t.id, ...ids])], { kind: d.kind, category: d.category || null, scope: d.scope, status: 'ok', review_reason: null })
        if (d.notes) await f.updateTxns([t.id], { notes: d.notes })
      } else await f.updateTxns([t.id], patch)
    } finally { setBusy(false) }
  }
  const sel = { fontSize: '0.78rem', padding: '4px 6px', width: 'auto' }
  return (
    <tr>
      <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{fmtDay(t.date)}</td>
      <td className="text-sm" style={{ minWidth: 180 }}>{t.merchant}<div className="text-xs text-muted" title={t.description}>{t.description.slice(0, 60)}</div></td>
      <td className="text-right text-sm" style={{ color: t.amount > 0 ? 'var(--green)' : undefined, whiteSpace: 'nowrap' }}><strong>{$(t.amount, true)}</strong></td>
      <td>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={d.kind} onChange={e => setD({ ...d, kind: e.target.value })} style={sel}>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
          <select value={d.category} onChange={e => setD({ ...d, category: e.target.value })} style={sel}><option value="">Category…</option>{catNames.map(c => <option key={c}>{c}</option>)}</select>
          <select value={d.scope} onChange={e => setD({ ...d, scope: e.target.value })} style={sel}><option value="personal">Personal</option><option value="business">Business</option></select>
          <input placeholder="note (optional)" value={d.notes} onChange={e => setD({ ...d, notes: e.target.value })} style={{ ...sel, width: 120 }} />
          <label className="text-xs" style={{ display: 'flex', gap: 3, alignItems: 'center', textTransform: 'none', letterSpacing: 0 }}>
            <input type="checkbox" checked={d.always} onChange={e => setD({ ...d, always: e.target.checked })} /> Always
          </label>
          {d.always && <input value={d.match} onChange={e => setD({ ...d, match: e.target.value })} title="Matches any description containing this" style={{ ...sel, width: 120 }} />}
          <button className="btn btn-sm btn-primary" disabled={busy || (!d.category && d.kind !== 'transfer')} onClick={confirm}>✓</button>
        </div>
      </td>
    </tr>
  )
}

// ─── Transactions ────────────────────────────────────────────────────────────
function Transactions({ f, txns, scope, months, catNames }) {
  const [q, setQ] = useState({ month: '', account: '', kind: '', category: '', text: '' })
  const [limit, setLimit] = useState(150)
  const rows = txns.filter(t => inScope(t, scope) && (!q.month || t.date.startsWith(q.month)) && (!q.account || t.account_id === q.account)
    && (!q.kind || t.kind === q.kind) && (!q.category || t.category === q.category)
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
        <select value={q.kind} onChange={e => setQ({ ...q, kind: e.target.value })} style={sel}><option value="">All types</option>{KINDS.map(k => <option key={k}>{k}</option>)}</select>
        <select value={q.category} onChange={e => setQ({ ...q, category: e.target.value })} style={sel}><option value="">All categories</option>{catNames.map(c => <option key={c}>{c}</option>)}</select>
        <span className="text-xs text-muted">{rows.length} · net {$(total, true)}</span>
      </div>
      <div className="table-container"><table>
        <thead><tr><th>Date</th><th>Merchant</th><th>Account</th><th>Type</th><th>Category</th><th>P/B</th><th className="text-right">Amount</th></tr></thead>
        <tbody>
          {rows.slice(0, limit).map(t => (
            <tr key={t.id}>
              <td className="text-sm" style={{ whiteSpace: 'nowrap' }}>{fmtDay(t.date)}</td>
              <td className="text-sm">{t.merchant}{t.status === 'review' && <span className="badge" style={{ marginLeft: 6, background: 'var(--amber-bg, #fffbeb)', color: '#b45309' }}>review</span>}{recIds.has(t.id) && <span className="badge badge-gray" style={{ marginLeft: 6 }}>recurring</span>}{t.notes && <div className="text-xs text-muted">{t.notes}</div>}</td>
              <td className="text-xs text-muted">{acct[t.account_id]}</td>
              <td><select value={t.kind} onChange={e => f.updateTxns([t.id], { kind: e.target.value })} style={sel}>{KINDS.map(k => <option key={k}>{k}</option>)}</select></td>
              <td><select value={t.category || ''} onChange={e => f.updateTxns([t.id], { category: e.target.value || null, status: 'ok', review_reason: null })} style={sel}><option value="">—</option>{catNames.map(c => <option key={c}>{c}</option>)}</select></td>
              <td><select value={t.scope || 'personal'} onChange={e => f.updateTxns([t.id], { scope: e.target.value })} style={sel}><option value="personal">P</option><option value="business">B</option></select></td>
              <td className="text-right text-sm" style={{ color: t.amount > 0 ? 'var(--green)' : undefined, whiteSpace: 'nowrap' }}>{$(t.amount, true)}</td>
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
  const [edit, setEdit] = useState({})
  const st = id => f.statements.filter(s => s.account_id === id)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="card">
        <div className="table-container"><table>
          <thead><tr><th>Account</th><th>Data through</th><th>Months checked</th><th className="text-right">Balance</th><th>Set balance</th></tr></thead>
          <tbody>
            {f.accounts.map(a => {
              const b = balances.find(x => x.id === a.id), s = st(a.id), ok = s.filter(x => x.status === 'reconciled').length
              return (
                <tr key={a.id} style={a.excluded ? { opacity: 0.55 } : undefined}>
                  <td className="text-sm"><strong>{a.name}</strong><div className="text-xs text-muted">{a.excluded ? 'Excluded from all reporting' : `${a.scope === 'business' ? 'Business' : 'Personal'} · ${a.type?.replace('_', ' ')}`}</div></td>
                  <td className="text-sm">{fresh.per[a.id] ? fmtDay(fresh.per[a.id]) : <span className="text-muted">no statements</span>}</td>
                  <td className="text-sm">{s.length ? <span style={{ color: ok === s.length ? 'var(--green)' : 'var(--amber)' }}>{ok}/{s.length} balanced</span> : <span className="text-muted">{a.type === 'credit_card' || a.excluded ? '—' : 'needs PDF statements'}</span>}</td>
                  <td className="text-right text-sm">{b?.balance != null ? <>{$(b.balance, true)}<div className="text-xs text-muted">{b.from === 'bank' ? 'from bank file' : 'entered'} · {fmtDay(b.asOf)}</div></> : '—'}</td>
                  <td>{!a.excluded && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <input type="number" placeholder="$" value={edit[a.id] || ''} onChange={e => setEdit({ ...edit, [a.id]: e.target.value })} style={{ width: 100, fontSize: '0.78rem', padding: '4px 6px' }} />
                      <button className="btn btn-sm" disabled={edit[a.id] === undefined || edit[a.id] === ''} onClick={() => { f.setMeta('balances', { ...(f.meta.balances || {}), [a.id]: { amount: Number(edit[a.id]), date: new Date().toISOString().slice(0, 10) } }); setEdit({ ...edit, [a.id]: '' }) }}>Save</button>
                    </span>
                  )}</td>
                </tr>
              )
            })}
          </tbody>
        </table></div>
      </div>
      <div className="card">
        <div className="card-header"><h3>Your routine</h3></div>
        <div className="card-body text-sm" style={{ lineHeight: 1.7 }}>
          <div><strong>Weekly (2 min, optional):</strong> download “recent activity” CSVs for NFCU checking and the Amex into <strong>Desktop › Finance 2026</strong>, then tell Claude “process my statements.” Overlaps are handled automatically.</div>
          <div><strong>Monthly:</strong> add each account’s full-month CSV and PDF statement to its folder, then “process my statements.” Claude imports, matches transfers, categorizes and checks balances; only uncertain items land in Review.</div>
          <div><strong>Sunday review:</strong> Dashboard → Review → Budgets. Everything shows its “data through” date, so you always know how current it is.</div>
          {f.meta.last_import?.report && <details style={{ marginTop: 8 }}><summary className="text-muted">Last import report</summary><pre style={{ whiteSpace: 'pre-wrap', fontSize: '0.72rem' }}>{f.meta.last_import.report}</pre></details>}
        </div>
      </div>
    </div>
  )
}
