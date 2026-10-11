import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import '../ceo/ceo.css'

/** Everything behind a login. Only Royanna has an account (sign-ups get disabled in Supabase). */
export default function AuthGate({ children }) {
  const [session, setSession] = useState(undefined)   // undefined = still checking
  const [recovery, setRecovery] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  if (recovery) return <Shell><NewPassword onDone={() => setRecovery(false)} /></Shell>
  if (!session) return <Shell><SignIn /></Shell>
  return children
}

function Shell({ children }) {
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      background: 'linear-gradient(rgba(10,10,10,.78), rgba(10,10,10,.78)), #0a0a0a',
    }}>
      <div style={{ background: '#fff', padding: '44px 40px', width: '100%', maxWidth: 400 }}>
        <img src="/rlc-logo.png" alt="RLC Realty Co." style={{ display: 'block', height: 52, margin: '0 auto 22px' }} />
        <div className="c-serif" style={{ fontSize: 26, textAlign: 'center' }}>CEO Command Center</div>
        <div className="c-label" style={{ textAlign: 'center', margin: '8px 0 28px', letterSpacing: '.22em' }}>Private · Sign in</div>
        {children}
      </div>
    </div>
  )
}

function SignIn() {
  const [mode, setMode] = useState('signin')   // signin | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    let error, info
    if (mode === 'signin') ({ error } = await supabase.auth.signInWithPassword({ email, password }))
    else if (mode === 'signup') {
      ;({ error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } }))
      info = 'Check your email to confirm your account, then sign in.'
    } else {
      ;({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin }))
      info = 'If that email has an account, a reset link is on its way.'
    }
    setBusy(false)
    setMsg(error ? { err: error.message } : info ? { ok: info } : null)
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="c-label">Email</label>
      <input className="c-input" type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} required />
      {mode !== 'reset' && <>
        <label className="c-label">Password</label>
        <input className="c-input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          minLength={mode === 'signup' ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} required />
      </>}
      {msg?.err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{msg.err}</div>}
      {msg?.ok && <div style={{ color: 'var(--green)', fontSize: 13 }}>{msg.ok}</div>}
      <button className="c-btn c-btn-sky" style={{ padding: 15, marginTop: 6 }} disabled={busy}>
        {busy ? '…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create my account' : 'Send reset link'}
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 6 }}>
        {mode !== 'signin'
          ? <button type="button" className="c-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => { setMode('signin'); setMsg(null) }}>Back to sign in</button>
          : <button type="button" className="c-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => { setMode('reset'); setMsg(null) }}>Forgot password?</button>}
        {mode === 'signin' && (
          <button type="button" className="c-link" style={{ background: 'none', border: 0, cursor: 'pointer', padding: 0 }} onClick={() => { setMode('signup'); setMsg(null) }}>First time? Create account</button>
        )}
      </div>
    </form>
  )
}

function NewPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  return (
    <form onSubmit={async e => {
      e.preventDefault()
      const { error } = await supabase.auth.updateUser({ password })
      if (error) setErr(error.message); else onDone()
    }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label className="c-label">New password</label>
      <input className="c-input" type="password" autoComplete="new-password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} required />
      {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      <button className="c-btn c-btn-sky" style={{ padding: 15 }}>Save password</button>
    </form>
  )
}
