// ─── Private finance data ────────────────────────────────────────────────────
// Every request carries this device's finance key; the database returns nothing without it.
// The key arrives once via a setup link (#fk=…) and is kept in this browser only
// ('__' prefix = never copied to the cloud sync).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../lib/supabase.js'

const KEY = '__fin_key'

export function financeKey() {
  try {
    const m = window.location.hash.match(/fk=([\w-]+)/)
    if (m) {
      localStorage.setItem(KEY, m[1])
      window.history.replaceState(null, '', window.location.pathname + window.location.search)
    }
    return localStorage.getItem(KEY)
  } catch { return null }
}

let client = null
export function fin() {
  const key = financeKey()
  if (!key) return null
  if (!client) client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, storageKey: '__fin_auth' },
    global: { headers: { 'x-finance-key': key } },
  })
  return client
}

const must = ({ data, error }) => { if (error) throw new Error(error.message); return data }

/** Everything the Finance page shows, plus edits */
export function useFinance() {
  const [state, setState] = useState({ loading: true, error: null, noKey: false, accounts: [], txns: [], statements: [], rules: [], budgets: [], goals: [], meta: {} })

  const load = useCallback(async () => {
    const db = fin()
    if (!db) { setState(s => ({ ...s, loading: false, noKey: true })); return }
    try {
      const all = async table => {          // page past the 1,000-row API limit
        const out = []
        for (let from = 0; ; from += 1000) {
          const rows = must(await db.from(table).select('*').range(from, from + 999))
          out.push(...rows)
          if (rows.length < 1000) return out
        }
      }
      const [accounts, txns, statements, rules, budgets, goals, meta] = await Promise.all(
        ['fin_accounts', 'fin_transactions', 'fin_statements', 'fin_rules', 'fin_budgets', 'fin_goals', 'fin_meta'].map(all))
      if (!accounts.length && !txns.length) {
        setState(s => ({ ...s, loading: false, noKey: false, error: null, accounts, txns }))
        return
      }
      setState({
        loading: false, error: null, noKey: false,
        accounts: accounts.sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)),
        txns: txns.sort((a, b) => b.date.localeCompare(a.date)),
        statements, rules, budgets, goals, meta: Object.fromEntries(meta.map(m => [m.key, m.value])),
      })
    } catch (e) { setState(s => ({ ...s, loading: false, error: e.message })) }
  }, [])
  useEffect(() => { load() }, [load])

  /** Edit transactions (optimistic) */
  const updateTxns = useCallback(async (ids, patch) => {
    const set = new Set(ids)
    setState(s => ({ ...s, txns: s.txns.map(t => (set.has(t.id) ? { ...t, ...patch } : t)) }))
    const rows = must(await fin().from('fin_transactions').update({ ...patch, updated_at: new Date().toISOString() }).in('id', ids).select('id'))
    if (rows.length !== ids.length) load()
  }, [load])

  /** "Always do this": save a rule and apply it to every matching transaction still waiting for review */
  const addRule = useCallback(async rule => {
    const row = { id: `r-${Date.now().toString(36)}`, ...rule, match: rule.match.trim().toLowerCase() }
    must(await fin().from('fin_rules').insert(row).select('id'))
    setState(s => ({ ...s, rules: [...s.rules, row] }))
    return row
  }, [])
  const deleteRule = useCallback(async id => {
    setState(s => ({ ...s, rules: s.rules.filter(r => r.id !== id) }))
    must(await fin().from('fin_rules').delete().eq('id', id).select('id'))
  }, [])

  const saveRow = useCallback(async (table, key, row) => {
    must(await fin().from(table).upsert(row).select('id'))
    setState(s => ({ ...s, [key]: [...s[key].filter(x => x.id !== row.id), row] }))
  }, [])
  const deleteRow = useCallback(async (table, key, id) => {
    setState(s => ({ ...s, [key]: s[key].filter(x => x.id !== id) }))
    must(await fin().from(table).delete().eq('id', id).select('id'))
  }, [])
  const setMeta = useCallback(async (k, value) => {
    setState(s => ({ ...s, meta: { ...s.meta, [k]: value } }))
    must(await fin().from('fin_meta').upsert({ key: k, value, updated_at: new Date().toISOString() }).select('key'))
  }, [])

  return useMemo(() => ({
    ...state, reload: load, updateTxns, addRule, deleteRule, setMeta,
    saveBudget: b => saveRow('fin_budgets', 'budgets', b), deleteBudget: id => deleteRow('fin_budgets', 'budgets', id),
    saveGoal: g => saveRow('fin_goals', 'goals', g), deleteGoal: id => deleteRow('fin_goals', 'goals', id),
  }), [state, load, updateTxns, addRule, deleteRule, setMeta, saveRow, deleteRow])
}
