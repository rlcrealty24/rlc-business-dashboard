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
const CAMPAIGN_FIELDS = ['id', 'name', 'brand', 'type', 'status', 'start_date', 'duration_days', 'goal', 'notes', 'config', 'created_at']
const ASSET_FIELDS = ['id', 'label', 'url', 'kind', 'brand', 'market', 'property', 'campaign_id', 'tags', 'notes', 'taken_on', 'created_at']
const pick = (o, f) => Object.fromEntries(f.filter(k => k in o).map(k => [k, o[k] === '' ? null : o[k]]))
const hhmm = t => (t ? String(t).slice(0, 5) : t)

export function SocialProvider({ children }) {
  const { blocks, overrides } = useCeo()
  const cache = (() => { try { return JSON.parse(localStorage.getItem(CACHE)) } catch { return null } })()
  const [items, setItems] = useState(cache?.items || [])
  const [campaigns, setCampaigns] = useState(cache?.campaigns || [])
  const [assets, setAssets] = useState(cache?.assets || [])
  const [libraryNeeded, setLibraryNeeded] = useState(false)   // Phase 3 SQL not run yet
  const [loading, setLoading] = useState(!cache)
  const [setupNeeded, setSetupNeeded] = useState(false)
  const [error, setError] = useState(null)
  const timer = useRef(null)
  const itemsRef = useRef(items); itemsRef.current = items
  const campaignsRef = useRef(campaigns); campaignsRef.current = campaigns

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
    setCampaigns(b.data.map(c => ({ ...c, config: c.config || {} })))
    setLoading(false)
    // Library lives in its own table; missing table must not break the rest of Social HQ
    const lib = await supabase.from('content_assets').select('*').order('created_at', { ascending: false })
    if (lib.error) setLibraryNeeded(true)
    else { setLibraryNeeded(false); setAssets(lib.data) }
  }, [])

  useEffect(() => {
    load()
    const reload = () => { clearTimeout(timer.current); timer.current = setTimeout(load, 400) }
    const ch = supabase.channel('social_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_items' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_campaigns' }, reload)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'content_assets' }, reload)
      .subscribe()
    window.addEventListener('focus', reload)
    return () => { supabase.removeChannel(ch); window.removeEventListener('focus', reload) }
  }, [load])

  useEffect(() => {
    if (loading) return
    try { localStorage.setItem(CACHE, JSON.stringify({ items, campaigns, assets })) } catch {}
  }, [items, campaigns, assets, loading])

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
    const prev = itemsRef.current.find(i => i.id === item.id)
    const row = pick(prepare({
      brand: 'personal', platforms: ['instagram'], stage: 'idea', priority: 'medium', steps: [], versions: {}, assets: [],
      metrics: {}, approval: 'draft', permission_confirmed: false, is_backlog: false, archived: false,
      created_at: new Date().toISOString(), ...prev, ...item, id: item.id || uid(),
    }, prev), ITEM_FIELDS)
    itemsRef.current = prev ? itemsRef.current.map(i => (i.id === row.id ? row : i)) : [...itemsRef.current, row]
    setItems(itemsRef.current)
    await write(supabase.from('content_items').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [items, prepare, write])

  const updateItem = useCallback((id, patch) => {
    const cur = itemsRef.current.find(i => i.id === id)
    return cur ? saveItem({ ...cur, ...patch }) : null
  }, [items, saveItem])

  const deleteItem = useCallback(async id => {
    setItems(list => list.filter(i => i.id !== id))
    await write(supabase.from('content_items').delete().eq('id', id))
  }, [write])

  /** Tick one checklist item, or a whole step (stepItemId null) */
  const toggleStep = useCallback((id, stepKey, itemId = null) => {
    const cur = itemsRef.current.find(i => i.id === id)
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
    const cur = itemsRef.current.find(i => i.id === id)
    if (!cur) return
    return saveItem({ ...cur, steps: cur.steps.map(s => (s.key === stepKey ? { ...s, due, fixed: !!due } : s)) })
  }, [items, saveItem])

  const duplicate = useCallback((id, overrides = {}) => {
    const cur = itemsRef.current.find(i => i.id === id)
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
    const cl = campaignsRef.current
    campaignsRef.current = cl.some(x => x.id === row.id) ? cl.map(x => (x.id === row.id ? row : x)) : [...cl, row]
    setCampaigns(campaignsRef.current)
    await write(supabase.from('content_campaigns').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [write])

  /** Patch a campaign (and/or its config) on top of the latest saved version */
  const updateCampaign = useCallback((id, patch = {}, configPatch = null) => {
    const cur = campaignsRef.current.find(c => c.id === id)
    if (!cur) return null
    const base = { ...(cur.config || {}), ...(patch.config || {}) }
    const extra = typeof configPatch === 'function' ? configPatch(base) : configPatch
    return saveCampaign({ ...cur, ...patch, config: extra ? { ...base, ...extra } : base })
  }, [saveCampaign])

  const deleteCampaign = useCallback(async id => {
    setCampaigns(list => list.filter(c => c.id !== id))
    await write(supabase.from('content_campaigns').delete().eq('id', id))
  }, [write])

  // ── Library ──────────────────────────────────────────────────────────────
  const saveAsset = useCallback(async a => {
    const row = pick({ kind: 'photo', tags: [], created_at: new Date().toISOString(), ...a, id: a.id || uid() }, ASSET_FIELDS)
    setAssets(list => (list.some(x => x.id === row.id) ? list.map(x => (x.id === row.id ? row : x)) : [row, ...list]))
    await write(supabase.from('content_assets').upsert({ ...row, updated_at: new Date().toISOString() }))
    return row
  }, [write])
  const deleteAsset = useCallback(async id => {
    setAssets(list => list.filter(a => a.id !== id))
    // unlink from posts that reference it
    for (const i of items.filter(i => (i.assets || []).some(x => x.asset_id === id))) {
      await saveItem({ ...i, assets: i.assets.filter(x => x.asset_id !== id) })
    }
    await write(supabase.from('content_assets').delete().eq('id', id))
  }, [items, saveItem, write])

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
    saveItem, updateItem, deleteItem, toggleStep, setStepDate, duplicate, capture, saveCampaign, updateCampaign, deleteCampaign, seeded, installSeed,
    assets, libraryNeeded, saveAsset, deleteAsset,
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
