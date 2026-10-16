// Small Today-page cards pulled from the Life & Money pages (Finance).
// They read the same data those pages use — nothing is copied.

import { Link } from 'react-router-dom'
import { useFinance } from '../finance/store.js'
import { freshness, monthly, recurring } from '../finance/analytics.js'
import { addDays, fmtDate, pad, parseISO, todayISO } from './recurrence.js'
import { formatCurrency } from '../utils/formatters.js'

/** This month in/out/net from your imported statements + recurring bills expected in the next 14 days */
export function MoneyCard() {
  const f = useFinance()
  const today = todayISO()
  const live = f.txns.filter(t => !f.accounts.find(a => a.id === t.account_id)?.excluded)
  const fresh = freshness(live, f.accounts.filter(a => !a.excluded && live.some(t => t.account_id === a.id)))
  const month = fresh.latest ? fresh.latest.slice(0, 7) : today.slice(0, 7)
  const cur = monthly(live, 'all').find(m => m.month === month) || { income: 0, spending: 0, net: 0 }
  const review = live.filter(t => t.status === 'review').length

  // Next expected date of each active recurring charge ≈ last charge + 1 month
  const horizon = addDays(today, 14)
  const bills = recurring(live, 'all', fresh.latest).filter(r => r.active).map(r => {
    const d = parseISO(r.last); d.setMonth(d.getMonth() + 1)
    let ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    while (ds < today) { const x = parseISO(ds); x.setMonth(x.getMonth() + 1); ds = `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}` }
    return { ...r, ds }
  }).filter(b => b.ds <= horizon).sort((x, y) => x.ds.localeCompare(y.ds))
  const billTotal = bills.reduce((s, b) => s + b.typical, 0)

  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">Money</div>
        <Link to="/finance" className="c-link" style={{ fontSize: 12 }}>Finance →</Link>
      </div>
      <div className="c-card-body" style={{ paddingBottom: 12 }}>
        {f.noKey ? <div className="c-muted" style={{ fontSize: 13 }}>Finance isn’t connected on this browser yet.</div> : <>
          <div className="c-label" style={{ marginBottom: 10 }}>
            {parseISO(`${month}-15`).toLocaleDateString('en-US', { month: 'long' })}{fresh.latest ? ` · bank data through ${fmtDate(fresh.latest, { month: 'short', day: 'numeric' })}` : ''}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <Figure label="In" value={cur.income} color="var(--green)" />
            <Figure label="Out" value={cur.spending} color="var(--ink)" />
            <Figure label="Net" value={cur.net} color={cur.net >= 0 ? 'var(--green)' : 'var(--red)'} />
          </div>
          {review > 0 && <div style={{ fontSize: 12, marginTop: 10 }}><Link to="/finance" className="c-link">{review} transactions need your review →</Link></div>}
        </>}
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 20px 4px', display: 'flex', justifyContent: 'space-between' }}>
          <span className="c-label">Expected bills · next 14 days</span>
          {billTotal > 0 && <span className="c-label">≈ {formatCurrency(billTotal, true)}</span>}
        </div>
        {bills.slice(0, 5).map(b => (
          <div key={b.key} className="c-tl-row" style={{ gridTemplateColumns: '84px 1fr auto', cursor: 'default' }}>
            <span className="c-tl-time">{b.ds === today ? 'Today' : fmtDate(b.ds, { month: 'short', day: 'numeric' })}</span>
            <span style={{ fontSize: 14 }}>{b.merchant}</span>
            <span style={{ fontSize: 13 }}>{formatCurrency(b.typical)}</span>
          </div>
        ))}
        {bills.length === 0 && <div className="c-empty" style={{ padding: '10px 20px 18px' }}>No recurring bills expected in the next two weeks.</div>}
        {bills.length > 5 && <div className="c-muted" style={{ fontSize: 12, padding: '6px 20px 14px' }}>+{bills.length - 5} more on the Finance page</div>}
      </div>
    </div>
  )
}

function Figure({ label, value, color }) {
  return (
    <div>
      <div className="c-label">{label}</div>
      <div className="c-serif" style={{ fontSize: 22, color, marginTop: 4 }}>{formatCurrency(value, true)}</div>
    </div>
  )
}

const PRIO_RANK = { high: 0, High: 0, medium: 1, Medium: 1, low: 2, Low: 2 }
