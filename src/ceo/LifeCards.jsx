// Small Today-page cards pulled from the Life & Money pages (Finance, Tasks & Projects).
// They read the same stored data those pages use — nothing is copied.

import { Link } from 'react-router-dom'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useCeo } from './CeoStore.jsx'
import { addDays, fmtDate, pad, parseISO, todayISO } from './recurrence.js'
import { formatCurrency, parseDateSafe } from '../utils/formatters.js'

const list = v => (Array.isArray(v) ? v : [])

/** This month in/out/net + bills due in the next 14 days */
export function MoneyCard() {
  const [transactions] = useLocalStorage('finance_transactions', [])
  const [accounts] = useLocalStorage('finance_accounts', [])
  const today = todayISO()
  const monthKey = today.slice(0, 7)

  // Imported statements mix 2026-07-01 and 07/01/2026 date formats
  const dated = list(transactions).map(t => ({ t, d: parseDateSafe(t.date) })).filter(x => x.d)
  const ym = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
  const thisMonth = dated.filter(x => ym(x.d) === monthKey).map(x => x.t)
  const latest = dated.reduce((m, x) => (!m || x.d > m ? x.d : m), null)
  const income = thisMonth.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount || 0), 0)
  const expense = thisMonth.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount || 0), 0)
  const net = income - expense

  // Bills: liability accounts with a day-of-month due date
  const horizon = addDays(today, 14)
  const bills = []
  for (const a of list(accounts).filter(a => a.isLiability && parseInt(a.dueDate))) {
    for (const offset of [0, 1]) {
      const base = parseISO(today)
      const y = base.getFullYear(), m = base.getMonth() + offset
      const d = new Date(y, m, Math.min(parseInt(a.dueDate), new Date(y, m + 1, 0).getDate()))
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
      if (ds >= today && ds <= horizon) bills.push({ ...a, ds })
    }
  }
  bills.sort((x, y) => x.ds.localeCompare(y.ds))
  const overdue = list(accounts).filter(a => a.isLiability && a.paymentStatus === 'overdue')
  const billTotal = bills.reduce((s, b) => s + Number(b.minPayment || 0), 0)

  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">Money</div>
        <Link to="/finance" className="c-link" style={{ fontSize: 12 }}>Finance →</Link>
      </div>
      <div className="c-card-body" style={{ paddingBottom: 12 }}>
        <div className="c-label" style={{ marginBottom: 10 }}>
          {parseISO(today).toLocaleDateString('en-US', { month: 'long' })} so far
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <Figure label="In" value={income} color="var(--green)" />
          <Figure label="Out" value={expense} color="var(--ink)" />
          <Figure label="Net" value={net} color={net >= 0 ? 'var(--green)' : 'var(--red)'} />
        </div>
        {thisMonth.length === 0 && (
          <div className="c-muted" style={{ fontSize: 12, marginTop: 10 }}>
            No transactions this month yet{latest ? ` — last one is from ${latest.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}.{' '}
            <Link to="/finance" className="c-link">Import a statement →</Link>
          </div>
        )}
      </div>
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 20px 4px', display: 'flex', justifyContent: 'space-between' }}>
          <span className="c-label">Bills · next 14 days</span>
          {billTotal > 0 && <span className="c-label">{formatCurrency(billTotal, true)} min</span>}
        </div>
        {overdue.map(a => (
          <div key={`o${a.id}`} className="c-tl-row" style={{ gridTemplateColumns: '84px 1fr auto', cursor: 'default' }}>
            <span className="c-chip red">Overdue</span>
            <span style={{ fontSize: 14 }}>{a.name}</span>
            <span style={{ fontSize: 13 }}>{a.minPayment ? formatCurrency(a.minPayment) : ''}</span>
          </div>
        ))}
        {bills.slice(0, 4).map(b => (
          <div key={`${b.id}${b.ds}`} className="c-tl-row" style={{ gridTemplateColumns: '84px 1fr auto', cursor: 'default' }}>
            <span className="c-tl-time">{b.ds === today ? 'Today' : fmtDate(b.ds, { month: 'short', day: 'numeric' })}</span>
            <span style={{ fontSize: 14 }}>{b.name}</span>
            <span style={{ fontSize: 13 }}>{b.minPayment ? formatCurrency(b.minPayment) : ''}</span>
          </div>
        ))}
        {bills.length === 0 && overdue.length === 0 && <div className="c-empty" style={{ padding: '10px 20px 18px' }}>No bills due in the next two weeks.</div>}
        {bills.length > 4 && <div className="c-muted" style={{ fontSize: 12, padding: '6px 20px 14px' }}>+{bills.length - 4} more on the Finance page</div>}
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

/**
 * What needs attention: overdue or due within 3 days, plus anything marked High —
 * from both the Inbox and the Tasks & Projects board. Today's Top 3 are excluded
 * (they already sit at the top of the page).
 */
export function ImportantTasks() {
  const { tasks, updateTask } = useCeo()
  const [projectTasks, setProjectTasks] = useLocalStorage('portal_tasks', [])
  const today = todayISO()
  const soon = addDays(today, 3)

  const rows = [
    ...tasks
      .filter(t => t.status !== 'done' && t.focus_date !== today)
      .filter(t => t.priority === 'high' || (t.due_date && t.due_date <= soon))
      .map(t => ({ key: `c${t.id}`, title: t.title, due: t.due_date, prio: t.priority, from: 'Inbox', href: '/inbox',
        complete: () => updateTask(t, { status: 'done', completed_at: new Date().toISOString() }) })),
    ...list(projectTasks)
      .filter(t => t.status !== 'Done')
      .filter(t => t.priority === 'High' || (t.dueDate && t.dueDate <= soon))
      .map(t => ({ key: `p${t.id}`, title: t.title || t.text, due: t.dueDate, prio: t.priority, from: 'Projects', href: '/portal-project',
        complete: () => setProjectTasks(prev => list(prev).map(x => (x.id === t.id ? { ...x, status: 'Done' } : x))) })),
  ].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (PRIO_RANK[a.prio] ?? 3) - (PRIO_RANK[b.prio] ?? 3))

  return (
    <div className="c-card">
      <div className="c-card-head">
        <div className="c-card-title">Important tasks</div>
        <span className={`c-chip${rows.length ? ' sky' : ''}`}>{rows.length}</span>
      </div>
      {rows.length === 0 && <div className="c-empty">Nothing urgent or high-priority.</div>}
      {rows.slice(0, 6).map(r => (
        <div key={r.key} className="c-task">
          <button className="c-check" style={{ padding: 0, border: 0 }} onClick={r.complete} aria-label="Complete">
            <span className="c-box" />
          </button>
          <div style={{ minWidth: 0 }}>
            <div className="c-task-title">{r.title}</div>
            <div className="c-task-meta">
              {r.due && <span className={`c-chip${r.due < today ? ' red' : r.due === today ? ' warn' : ''}`}>
                {r.due < today ? 'Overdue' : r.due === today ? 'Due today' : `Due ${fmtDate(r.due, { month: 'short', day: 'numeric' })}`}
              </span>}
              {/high/i.test(r.prio || '') && <span className="c-chip c-prio-high">High</span>}
              <Link to={r.href} className="c-chip" style={{ textDecoration: 'none' }}>{r.from}</Link>
            </div>
          </div>
          <span />
        </div>
      ))}
      {rows.length > 6 && <div className="c-muted" style={{ fontSize: 12, padding: '10px 20px' }}>+{rows.length - 6} more in the Inbox and Tasks &amp; Projects</div>}
    </div>
  )
}

