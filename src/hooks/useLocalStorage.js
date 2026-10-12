import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase.js'

export const LOCAL_ONLY = new Set(['profile_photo', 'finance_pending_col_widths'])

// ─── Realtime ─────────────────────────────────────────────────────────────────
const listeners = new Map()
let realtimeReady = false

function richness(v) {
  if (v === null || v === undefined) return 0
  if (Array.isArray(v)) return v.length
  if (typeof v === 'object') return Object.keys(v).length
  return 1
}

function ensureRealtime() {
  if (realtimeReady) return
  realtimeReady = true
  supabase
    .channel('dashboard_realtime')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'dashboard_data' },
      ({ new: row }) => {
        const k = row?.key
        if (k && !k.startsWith('__')) listeners.get(k)?.forEach(cb => cb(row.value, row.updated_at))
      })
    .subscribe()
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeRead(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw || raw === 'null' || raw === 'undefined') return null
    return JSON.parse(raw)
  } catch { return null }
}

function safeWrite(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
}

// When this device last changed / received each key. '__' keeps it out of the sync.
const TS_KEY = '__ls_ts'
function readTs() { try { return JSON.parse(localStorage.getItem(TS_KEY)) || {} } catch { return {} } }
function getTs(key) { return readTs()[key] || null }
const newer = (a, b) => Date.parse(a) > Date.parse(b)
function setTs(key, ts) { try { localStorage.setItem(TS_KEY, JSON.stringify({ ...readTs(), [key]: ts })) } catch {} }

// Supabase queries only run when awaited/then'd — a bare .upsert() never sends.
function pushKey(key, value, ts) {
  return supabase.from('dashboard_data').upsert({ key, value, updated_at: ts }, { onConflict: 'key' })
    .then(({ error }) => { if (error) console.warn('[sync] save failed', key, error.message); return !error })
}

// ─── Bulk sync (called from Layout on every mount) ────────────────────────────
export async function bulkSync() {
  try {
    const { data: rows, error } = await supabase
      .from('dashboard_data').select('key, value, updated_at')
    if (error || !rows) return

    const remote = new Map(rows.map(r => [r.key, { value: r.value, ts: r.updated_at }]))
    const now = new Date().toISOString()
    const toPush = []

    // Check every local key
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key || key.startsWith('__') || LOCAL_ONLY.has(key)) continue
      const localVal = safeRead(key)
      if (localVal === null || localVal === undefined) continue
      const remoteEntry = remote.get(key)
      const remoteVal   = remoteEntry?.value ?? null
      const localTs     = getTs(key)
      const remoteTs    = remoteEntry?.ts || null
      // Newest change wins. Keys with no local timestamp yet (older app version) fall back to size.
      const pushIt = localTs ? (!remoteTs || newer(localTs, remoteTs)) : richness(localVal) > richness(remoteVal)
      const pullIt = localTs ? (remoteTs && newer(remoteTs, localTs)) : richness(remoteVal) > richness(localVal)

      if (pushIt) {
        toPush.push({ key, value: localVal, updated_at: localTs || now })
      } else if (pullIt) {
        safeWrite(key, remoteVal)
        setTs(key, remoteTs)
        // Notify hooks to update React state — no page reload needed
        window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key, value: remoteVal } }))
      }
    }

    // Check cloud keys that don't exist locally at all
    for (const [key, { value: remoteVal }] of remote) {
      if (key.startsWith('__') || LOCAL_ONLY.has(key)) continue
      if (localStorage.getItem(key) === null && remoteVal !== null && remoteVal !== undefined) {
        const len = richness(remoteVal)
        if (len > 0) {
          safeWrite(key, remoteVal)
          setTs(key, remote.get(key).ts)
          window.dispatchEvent(new CustomEvent('ls-sync', { detail: { key, value: remoteVal } }))
        }
      }
    }

    // Push local-richer keys in parallel
    if (toPush.length > 0) {
      await Promise.allSettled(toPush.map(row => pushKey(row.key, row.value, row.updated_at)))
    }
  } catch {}
}

// ─── Manual force-push ────────────────────────────────────────────────────────
export async function forceSyncAllToSupabase() {
  const now = new Date().toISOString()
  const jobs = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || key.startsWith('__') || LOCAL_ONLY.has(key)) continue
    const val = safeRead(key)
    if (val === null || val === undefined) continue
    jobs.push(
      supabase.from('dashboard_data')
        .upsert({ key, value: val, updated_at: now }, { onConflict: 'key' })
        .then(({ error }) => ({ key, ok: !error }))
    )
  }
  const results = await Promise.allSettled(jobs)
  const ok   = results.filter(r => r.status === 'fulfilled' && r.value?.ok).length
  const fail = results.length - ok
  return { ok, fail, total: results.length }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useLocalStorage(key, initialValue) {
  const isMountWrite = useRef(true)
  const isSyncApply  = useRef(false)

  const [value, setValue] = useState(() => safeRead(key) ?? initialValue)

  // bulkSync-driven update: applies only if incoming is richer than current state
  useEffect(() => {
    function handleSync(e) {
      if (e.detail?.key !== key) return
      const incoming = e.detail.value
      if (incoming === null || incoming === undefined) return
      isSyncApply.current = true
      setValue(incoming)
    }
    window.addEventListener('ls-sync', handleSync)
    return () => window.removeEventListener('ls-sync', handleSync)
  }, [key])

  // Realtime: only apply if incoming data is richer than what's local
  useEffect(() => {
    if (LOCAL_ONLY.has(key)) return
    ensureRealtime()
    const cb = (incomingValue, ts) => {
      if (incomingValue === null || incomingValue === undefined) return
      const localTs = getTs(key)
      if (localTs && ts && !newer(ts, localTs)) return   // our own echo, or older than what we have
      isSyncApply.current = true
      setValue(incomingValue)
      safeWrite(key, incomingValue)
      if (ts) setTs(key, ts)
    }
    if (!listeners.has(key)) listeners.set(key, new Set())
    listeners.get(key).add(cb)
    return () => listeners.get(key)?.delete(cb)
  }, [key])

  // Write to localStorage + Supabase on every user-driven change
  useEffect(() => {
    safeWrite(key, value)
    if (isMountWrite.current) { isMountWrite.current = false; return }
    if (isSyncApply.current)  { isSyncApply.current  = false; return }
    if (LOCAL_ONLY.has(key)) return
    if (value === null || value === undefined) return
    const ts = new Date().toISOString()
    setTs(key, ts)
    pushKey(key, value, ts)
  }, [key, value])

  return [value, setValue]
}
