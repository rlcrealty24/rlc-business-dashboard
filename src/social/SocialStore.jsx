// ─── Social Media HQ data: content items + campaigns ────────────────────────
// One row per post/idea. Production steps live on the post itself, so a step
// ticked on Today, the calendar or the workspace is the same checkbox.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useCeo } from '../ceo/CeoStore.jsx'
import { addDays, todayISO } from '../ceo/recurrence.js'
import { uid } from '../ceo/constants.js'
import { buildSteps, dateSteps, productionSlots, stageFromSteps } from './schedule.js'
import { seedCampaigns, seedIdeas } from './seed.js'

const Ctx = createContext(null)
const CACHE = '__social_cache_v1'

const ITEM_FIELDS = ['id', 'title', 'brand', 'platforms', 'stage', 'format', 'pillar', 'objective', 'priority', 'publish_date',
  'publish_time', 'campaign_id', 'agent_name', 'agent_ref', 'collab_with', 'hook', 'script', 'caption', 'cta', 'hashtags',
  'on_screen_text', 'shot_list', 'edit_notes', 'cover_concept', 'notes', 'steps', 'versions', 'assets', 'approval',
  'permission_confirmed', 'is_backlog', 'timeliness', 'lead_potential', 'effort', 'audience', 'source', 'source_ref',
  'metrics', 'archived', 'created_at']
const CAMPAIGN_FIELDS = ['id', 'name', 'brand', 'type', 'status', 'start_date', 'duration_days', 'goal', 'notes', 'created_at']
const pick = (o, f) => Object.fromEntries(f.filter(k => k in o).map(k => [k, o[k] === '' ? null : o[k]]))
const hhmm = t => (t ? String(t).slice(0, 5) : t)

export function SocialProvider({ children }) {
  const { blocks, overrides } = useCeo()
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE)) } catch { return null } })()
  const [items, setItems] = useState(cache?.items || [])
  const [campaigns, setCampaigns] = useState(cache?.campaigns || [])
  const [loading, setLoading] = useState(!cache)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([
      supabase.from('content_items').select('*').order('created_at'),
      supabase.from('content_campaigns').select('*').order('created_at'),
    ])
    const err = a.error || b.error
    if (err) {
      if (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message)) setSetupNeeded(true)
      else setError(err.message)
      setLoading(false); return
    }
    setSetupNeeded(false); setError(null)
    setItems(a.data.map(i => ({ ...i, publish_time: hhmm(i.publish_time) })))
    setCampaigns(b.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    const reload = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 400) }
    const ch = supabase.channel('social_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_campaigns' }, reload)
      .subscribe()
    window.addEventListener('focus', reload)
    return () => { supabase.removeChannel(ch); window.removeEventListener('focus', reload) }
  }, [load])

  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(CACHE, JSON.stringify({ items, campaigns })) } catch {}
  }, [items, campaigns, loading])

  // Film / Edit / Schedule slots from the CEO calendar, ~10 weeks around today
  const slots = useMemo(
    () => productionSlots(blocks, overrides, addDays(todayISO(), -30), addDays(todayISO(), 120)),
    [blocks, overrides])

  const write = useCallback(async q => {
    const { error: err } = await q
    if (err) { setError(err.message); load() }
    return !err
  }, [load])

  /** Normalize steps/stage for an item after any change */
  const prepare = useCallback((item, prev) => {
    let next = { ...item }
    const formatChanged = next.format !== prev?.format
    if (next.format && (formatChanged || !next.steps?.length)) next.steps = buildSteps(next.format, next.steps || [])
    if (!next.format) next.steps = next.steps || []
    const dateChanged = next.publish_date !== prev?.publish_date
    if (formatChanged || dateChanged || next.steps.some(s => !s.due && next.publish_date)) {
      next.steps = dateSteps(next.steps, next.publish_date, slots)
    }
    // Getting a date moves an idea into the plan
    if (next.publish_date && next.stage === 'idea') next.stage = 'planned'
    next.stage = stageFromSteps(next.stage, next.steps)
    return next
  }, [slots])

  const saveItem = useCallback(async (item) => {
    const prev = items.find(i => i.id === item.id)
    const row = pick(prepare({
      brand: 'personal', platforms: ['instagram'], stage: 'idea', priority: 'medium', steps: [], versions: {}, assets: [],
      metrics: {}, approval: 'draft', permission_confirmed: false, is_backlog: false, archived: false,
      created_at: new Date().toISOString(), ...prev, ...item, id: item.id || uid(),
    }, prev), ITEM_FIELDS)
    setItems(list => (prev ? list.map(i => (i.id === row.id ? row : i)) : [...list, row]))
    await write(supabase.from('content_items').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [items, prepare, write])

  const updateItem = useCallback((id, patch) => {
    const cur = items.find(i => i.id === id)
    return cur ? saveItem({ ...cur, ...patch }) : null
  }, [items, saveItem])

  const deleteItem = useCallback(async id => {
    setItems(list => list.filter(i => i.id !== id))
    await write(supabase.from('content_items').delete().eq('id', id))
  }, [write])

  /** Tick one checklist item, or a whole step (stepItemId null) */
  const toggleStep = useCallback((id, stepKey, itemId = null) => {
    const cur = items.find(i => i.id === id)
    if (!cur) return
    const steps = cur.steps.map(s => {
      if (s.key !== stepKey) return s
      if (itemId) {
        const its = s.items.map(x => (x.id === itemId ? { ...x, done: !x.done } : x))
        return { ...s, items: its, done: its.length > 0 && its.every(x => x.done) }
      }
      const done = !s.done
      return { ...s, done, items: s.items.map(x => ({ ...x, done })) }
    })
    return saveItem({ ...cur, steps })
  }, [items, saveItem])

  /** Change a single step's date (stays put on future reschedules) */
  const setStepDate = useCallback((id, stepKey, due) => {
    const cur = items.find(i => i.id === id)
    if (!cur) return
    return saveItem({ ...cur, steps: cur.steps.map(s => (s.key === stepKey ? { ...s, due, fixed: !!due } : s)) })
  }, [items, saveItem])

  const duplicate = useCallback((id, overrides = {}) => {
    const cur = items.find(i => i.id === id)
    if (!cur) return null
    return saveItem({
      ...cur, id: uid(), title: overrides.title || `${cur.title} (copy)`, stage: 'idea', publish_date: null,
      steps: buildSteps(overrides.format || cur.format), versions: {}, metrics: {}, approval: 'draft',
      source: 'duplicate', source_ref: cur.id, created_at: new Date().toISOString(), ...overrides,
    })
  }, [items, saveItem])

  const capture = useCallback((title, brand = 'personal', extra = {}) =>
    saveItem({ title: title.trim(), brand, stage: 'idea', source: 'idea', ...extra }), [saveItem])

  const saveCampaign = useCallback(async c => {
    const row = pick({ status: 'proposed', brand: 'leasing', created_at: new Date().toISOString(), ...c, id: c.id || uid() }, CAMPAIGN_FIELDS)
    setCampaigns(list => (list.some(x => x.id === row.id) ? list.map(x => (x.id === row.id ? row : x)) : [...list, row]))
    await write(supabase.from('content_campaigns').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [write])

  const seeded = items.some(i => i.source === 'seed')
  const installSeed = useCallback(async () => {
    const camps = seedCampaigns()
    const ideas = seedIdeas(camps).map(i => pick(prepare({ ...i, versions: {}, assets: [], metrics: {}, approval: 'draft',
      permission_confirmed: false, archived: false, created_at: new Date().toISOString() }, null), ITEM_FIELDS))
    setCampaigns(list => [...list, ...camps]); setItems(list => [...list, ...ideas])
    await write(supabase.from('content_campaigns').insert(camps.map(c => pick(c, CAMPAIGN_FIELDS))))
    await write(supabase.from('content_items').insert(ideas))
  }, [prepare, write])

  const value = {
    items, campaigns, loading, setupNeeded, error, setError, reload: load, slots,
    saveItem, updateItem, deleteItem, toggleStep, setStepDate, duplicate, capture, saveCampaign, seeded, installSeed,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSocial() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useSocial must be inside <SocialProvider>')
  return v
}

/** Live (non-archived) items helpers */
export const live = items => items.filter(i => !i.archived)
export const openSteps = items => live(items).flatMap(i =>
  (i.steps || []).filter(s => !s.done && s.due).map(s => ({ item: i, step: s })))
