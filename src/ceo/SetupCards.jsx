import { useEffect, useState } from 'react'
import sql from '../../supabase/ceo_tables.sql?raw'
import { useCeo } from './CeoStore.jsx'
import { fetchPulse, usePortalSession } from './portal.js'
import { PORTAL_URL } from './constants.js'
import { formatCurrency } from '../utils/formatters.js'

export function SetupNeeded() {
  const { reload } = useCeo()
  const [copied, setCopied] = useState(false)
  return (
    <div className="c-card">
      <div className="c-card-head"><div className="c-card-title">One-time setup</div></div>
      <div className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ fontSize: 14, lineHeight: 1.6 }}>
          Your CEO calendar needs three tables in the dashboard&apos;s Supabase project. Copy the SQL, paste it into
          <b> Supabase → SQL Editor → New query</b>, press <b>Run</b>, then come back and press <b>Check again</b>.
        </p>
        <pre style={{ background: 'var(--mist)', border: '1px solid var(--border)', padding: 14, fontSize: 11, maxHeight: 240, overflow: 'auto' }}>{sql}</pre>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="c-btn c-btn-sky" onClick={() => { navigator.clipboard.writeText(sql); setCopied(true) }}>{copied ? 'Copied ✓' : 'Copy SQL'}</button>
          <a className="c-btn" href="https://supabase.com/dashboard/project/ynvlsbmxipmksrgaebnq/sql/new" target="_blank" rel="noreferrer">Open SQL Editor ↗</a>
          <button className="c-btn c-btn-ghost" onClick={reload}>Check again</button>
        </div>
      </div>
    </div>
  )
}

export function StarterCard() {
  const { installStarter } = useCeo()
  const [busy, setBusy] = useState(false)
  return (
    <div className="c-card ink">
      <div className="c-card-body" style={{ padding: 28 }}>
        <div className="c-eyebrow" style={{ color: 'var(--sky)' }}>Start here</div>
        <div className="c-serif" style={{ fontSize: 28, margin: '8px 0 10px' }}>Load your operating schedule</div>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', lineHeight: 1.6, maxWidth: 620 }}>
          Your week, built around Sophia&apos;s routine: morning routine, gym (Mon/Tue/Fri), Baby Bounce &amp; gymnastics,
          nap-time money blocks, agent Zoom training, content planning → filming → editing → scheduling → posting,
          the Friday financial review, Sunday planning, the month-end review and a hard stop every night.
          Every block has its checklist built in, plus the six major marketing dates. You can edit any of it.
        </p>
        <button className="c-btn c-btn-sky" style={{ marginTop: 18 }} disabled={busy}
          onClick={async () => { setBusy(true); await installStarter(); setBusy(false) }}>
          {busy ? 'Loading…' : 'Load my schedule'}
        </button>
      </div>
    </div>
  )
}

export function PortalCard({ feed }) {
  const { user, ready, signIn, signOut } = usePortalSession()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  if (!ready) return null

  if (user) {
    return (
      <div className="c-card">
        <div className="c-card-head">
          <div className="c-card-title">RLC Portal</div>
          <span className="c-chip green">● Live</span>
        </div>
        <div className="c-card-body" style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div>Appointments, showings, deal deadlines, brokerage events and portal tasks show on your calendar automatically.</div>
          <div className="c-muted" style={{ fontSize: 12 }}>
            {user.email}{feed?.lastSync ? ` · synced ${feed.lastSync.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="c-btn c-btn-sm" onClick={feed?.refresh}>Refresh</button>
            <a className="c-btn c-btn-sm c-btn-ghost" href={`${PORTAL_URL}/dashboard/calendar`} target="_blank" rel="noreferrer">Portal calendar ↗</a>
            <button className="c-btn c-btn-sm c-btn-ghost" onClick={signOut}>Disconnect</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div className="c-card">
      <div className="c-card-head"><div className="c-card-title">Connect the RLC Portal</div></div>
      <form className="c-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        onSubmit={async e => {
          e.preventDefault(); setBusy(true); setErr('')
          const { error } = await signIn(email, password)
          setBusy(false)
          if (error) setErr(error.message); else setPassword('')
        }}>
        <div style={{ fontSize: 13, lineHeight: 1.5 }}>
          Sign in once with your portal login. Brokerage events then appear here live — read-only, never copied.
        </div>
        <input className="c-input" type="email" autoComplete="username" placeholder="Portal email" value={email} onChange={e => setEmail(e.target.value)} />
        <input className="c-input" type="password" autoComplete="current-password" placeholder="Portal password" value={password} onChange={e => setPassword(e.target.value)} />
        {err && <div style={{ color: 'var(--red)', fontSize: 12 }}>{err}</div>}
        <button className="c-btn c-btn-ink" disabled={busy || !email || !password}>{busy ? 'Connecting…' : 'Connect'}</button>
      </form>
    </div>
  )
}

export function PulseCard() {
  const { user } = usePortalSession()
  const [pulse, setPulse] = useState(null)
  useEffect(() => { if (user) fetchPulse().then(setPulse) }, [user])
  if (!user || !pulse) return null
  return (
    <div className="c-stats">
      <div className="c-stat"><div className="c-stat-val">{formatCurrency(pulse.paidMonthTotal, true)}</div><div className="c-stat-lbl">Received this month</div></div>
      <div className="c-stat"><div className="c-stat-val">{formatCurrency(pulse.pendingTotal, true)}</div><div className="c-stat-lbl">Owed · {pulse.pendingCount} pending</div></div>
      <div className="c-stat"><div className="c-stat-val">{pulse.activeDeals}</div><div className="c-stat-lbl">Active deals</div></div>
      <div className="c-stat"><div className="c-stat-val">{pulse.newLeads7d}</div><div className="c-stat-lbl">New leads · 7 days</div></div>
    </div>
  )
}
