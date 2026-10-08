// ─── CEO data store ──────────────────────────────────────────────────────────
// Blocks, per-occurrence state and tasks live in their own Supabase tables
// (one row per thing — no whole-list overwrites, so devices can't clobber or
// resurrect each other's changes). Updates are optimistic and realtime.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { uid } from './constants.js'
import { addDays } from './recurrence.js'
import { buildStarterBlocks, buildStarterDates, buildStarterTasks } from './starterSchedule.js'

const CeoContext = createContext(null)
// '__' prefix keeps this out of the dashboard_data bulk sync
const CACHE_KEY = '__ceo_cache_v1'
const LOCAL_ONLY_KEY = '__ceo_local_only'

function readCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || null } catch { return null }
}

const BLOCK_FIELDS = ['id', 'title', 'category', 'kind', 'date_type', 'start_date', 'until_date', 'all_day',
  'start_time', 'end_time', 'recurrence', 'description', 'checklist', 'rotation', 'reminders', 'location',
  'meeting_url', 'link', 'unconfirmed', 'protected']
const TASK_FIELDS = ['id', 'title', 'notes', 'priority', 'status', 'category', 'due_date', 'scheduled_date',
  'scheduled_time', 'duration_min', 'focus_date', 'completed_at', 'created_at']
const pick = (obj, fields) => Object.fromEntries(fields.filter(f => f in obj).map(f => [f, obj[f] === '' ? null : obj[f]]))
const hhmm = t => (t ? String(t).slice(0, 5) : t)
const normBlock = b => ({ ...b, start_time: hhmm(b.start_time), end_time: hhmm(b.end_time) })
const normOcc = o => ({ ...o, new_start: hhmm(o.new_start), new_end: hhmm(o.new_end) })
const normTask = t => ({ ...t, scheduled_time: hhmm(t.scheduled_time) })

export function CeoProvider({ children }) {
  const cache = readCache()
  const [blocks, setBlocks] = useState(cache?.blocks || [])
  const [occRows, setOccRows] = useState(cache?.occ || [])
  const [tasks, setTasks] = useState(cache?.tasks || [])
  const [loading, setLoading] = useState(!cache)
  const [setupNeeded, setSetupNeeded] = useState(false)   // tables not created yet
  const [error, setError] = useState(null)
  const reloadTimer = useRef(null)

  const [offline, setOffline] = useState(false)          // cloud unreachable → this device only
  const live = useRef(false)

  const load = useCallback(async () => {
    let b, o, t
    try {
      ;[b, o, t] = await Promise.all([
        supabase.from('ceo_blocks').select('*').order('created_at'),
        supabase.from('ceo_occurrences').select('*'),
        supabase.from('ceo_tasks').select('*').order('created_at', { ascending: false }),
      ])
    } catch (e) { b = { error: { message: String(e) } } }
    const err = b.error || o?.error || t?.error
    if (err) {
      if (err.code === '42P01' || /does not exist|schema cache/i.test(err.message)) setSetupNeeded(true)
      else if (/fetch|network|ENOTFOUND|Load failed/i.test(err.message)) {
        // Database unreachable: keep working from this device; upload when it's back
        setOffline(true)
        try { localStorage.setItem(LOCAL_ONLY_KEY, '1') } catch {}
      } else setError(err.message)
      setLoading(false)
      return
    }
    setSetupNeeded(false)
    setOffline(false)
    setError(null)
    const local = readCache()
    const serverEmpty = !b.data.length && !t.data.length
    if (serverEmpty && localStorage.getItem(LOCAL_ONLY_KEY) && (local?.blocks?.length || local?.tasks?.length)) {
      // First time the cloud is reachable: push what was built on this device
      await supabase.from('ceo_blocks').upsert(local.blocks.map(x => pick(x, BLOCK_FIELDS)))
      await supabase.from('ceo_occurrences').upsert(local.occ || [], { onConflict: 'block_id,occ_date' })
      await supabase.from('ceo_tasks').upsert(local.tasks.map(x => pick(x, TASK_FIELDS)))
      localStorage.removeItem(LOCAL_ONLY_KEY)
      setLoading(false)
      return
    }
    localStorage.removeItem(LOCAL_ONLY_KEY)
    setBlocks(b.data.map(normBlock)); setOccRows(o.data.map(normOcc)); setTasks(t.data.map(normTask))
    setLoading(false)
    live.current = true
  }, [])

  // Keep a device copy of everything (instant load, and the offline fallback)
  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ blocks, occ: occRows, tasks })) } catch {}
  }, [blocks, occRows, tasks, loading])

  useEffect(() => {
    load()
    const reload = () => { clearTimeout(reloadTimer.current); reloadTimer.current = setTimeout(load, 400) }
    const ch = supabase.channel('ceo_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_blocks' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_occurrences' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ceo_tasks' }, reload)
    // Only open the realtime socket once the database has answered
    const sub = setInterval(() => { if (live.current) { ch.subscribe(); clearInterval(sub) } }, 1000)
    window.addEventListener('focus', reload)
    return () => { clearInterval(sub); supabase.removeChannel(ch); window.removeEventListener('focus', reload) }
  }, [load])

  const overrides = useMemo(() => new Map(occRows.map(r => [`${r.block_id}:${r.occ_date}`, r])), [occRows])

  // Run a write; on failure reload the truth from the server and surface it
  const write = useCallback(async (query) => {
    if (offline) return true            // saved on this device; uploads when the cloud is back
    const { error: err } = await query
    if (err) { setError(err.message); load() }
    return !err
  }, [load, offline])

  // ── Blocks ────────────────────────────────────────────────────────────────
  const saveBlock = useCallback(async (block) => {
    const row = pick({ ...block, id: block.id || uid() }, BLOCK_FIELDS)
    setBlocks(prev => {
      const i = prev.findIndex(x => x.id === row.id)
      return i === -1 ? [...prev, row] : prev.map(x => (x.id === row.id ? { ...x, ...row } : x))
    })
    await write(supabase.from('ceo_blocks').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [write])

  const deleteBlock = useCallback(async (id) => {
    setBlocks(prev => prev.filter(b => b.id !== id))
    setOccRows(prev => prev.filter(o => o.block_id !== id))
    await write(supabase.from('ceo_blocks').delete().eq('id', id))
  }, [write])

  /** End a series the day before `fromDate` and start a copy (with changes) on `fromDate` */
  const splitBlock = useCallback(async (block, fromDate, changes) => {
    const until = addDays(fromDate, -1)
    if (fromDate <= block.start_date) return saveBlock({ ...block, ...changes })
    await saveBlock({ ...block, until_date: until })
    if (changes === null) return null   // "delete this and following"
    return saveBlock({ ...block, ...changes, id: uid(), start_date: fromDate })
  }, [saveBlock])

  // ── Occurrence state ──────────────────────────────────────────────────────
  const setOccurrence = useCallback(async (blockId, occDate, patch) => {
    const key = `${blockId}:${occDate}`
    const existing = overrides.get(key)
    const row = {
      ...(existing || { id: uid(), block_id: blockId, occ_date: occDate, checked: [], status: 'open' }),
      ...patch,
      updated_at: new Date().toISOString(),
    }
    setOccRows(prev => (existing ? prev.map(o => (o.id === existing.id ? row : o)) : [...prev, row]))
    await write(supabase.from('ceo_occurrences').upsert(row, { onConflict: 'block_id,occ_date' }))
  }, [overrides, write])

  const toggleCheck = useCallback((item, checkId) => {
    const set = new Set(item.checked || [])
    set.has(checkId) ? set.delete(checkId) : set.add(checkId)
    const checked = [...set]
    const allDone = item.checklist.length > 0 && item.checklist.every(c => set.has(c.id))
    const status = allDone ? 'done' : item.status === 'done' ? 'open' : item.status
    return setOccurrence(item.blockId, item.occDate, { checked, status })
  }, [setOccurrence])

  // ── Tasks ─────────────────────────────────────────────────────────────────
  const saveTask = useCallback(async (task) => {
    const row = pick({ status: 'inbox', created_at: new Date().toISOString(), duration_min: 30, ...task, id: task.id || uid() }, TASK_FIELDS)
    setTasks(prev => {
      const i = prev.findIndex(x => x.id === row.id)
      return i === -1 ? [row, ...prev] : prev.map(x => (x.id === row.id ? { ...x, ...row } : x))
    })
    await write(supabase.from('ceo_tasks').upsert(row))
    return row
  }, [write])

  const updateTask = useCallback((task, patch) => saveTask({ ...task, ...patch }), [saveTask])

  const deleteTask = useCallback(async (id) => {
    setTasks(prev => prev.filter(t => t.id !== id))
    await write(supabase.from('ceo_tasks').delete().eq('id', id))
  }, [write])

  const capture = useCallback((title) => saveTask({ title: title.trim(), status: 'inbox' }), [saveTask])

  // ── Starter schedule ──────────────────────────────────────────────────────
  const installStarter = useCallback(async () => {
    const newBlocks = [...buildStarterBlocks(), ...buildStarterDates()]
    const newTasks = buildStarterTasks()
    setBlocks(prev => [...prev, ...newBlocks])
    setTasks(prev => [...newTasks, ...prev])
    const ok1 = await write(supabase.from('ceo_blocks').insert(newBlocks.map(b => pick(b, BLOCK_FIELDS))))
    const ok2 = await write(supabase.from('ceo_tasks').insert(newTasks.map(t => pick(t, TASK_FIELDS))))
    return ok1 && ok2
  }, [write])

  const value = {
    blocks, overrides, tasks, loading, setupNeeded, offline, error, setError, reload: load,
    saveBlock, deleteBlock, splitBlock, setOccurrence, toggleCheck,
    saveTask, updateTask, deleteTask, capture, installStarter,
  }
  return <CeoContext.Provider value={value}>{children}</CeoContext.Provider>
}

export function useCeo() {
  const ctx = useContext(CeoContext)
  if (!ctx) throw new Error('useCeo must be used inside <CeoProvider>')
  return ctx
}
