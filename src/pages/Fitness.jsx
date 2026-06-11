import { useState, useRef, useEffect } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { today, uid, formatDate } from '../utils/formatters.js'
import { PLAN_DAYS, MACRO_TARGETS, MEALS_LIST, TIPS, BODY_STATS, searchFoodDB } from '../data/fitnessData.js'

// ─── USDA FoodData Central Search ─────────────────────────────────────────────
// Free API — get your own key at https://api.nal.usda.gov/api-key-signup.html
// Add VITE_USDA_API_KEY=your_key to .env for unlimited requests.
// Falls back to DEMO_KEY (30 req/hr) if no key is set.
const NUTRIENT_MAP = {
  'Energy':                       'cal',
  'Protein':                      'protein',
  'Carbohydrate, by difference':  'carbs',
  'Total lipid (fat)':            'fat',
  'Fiber, total dietary':         'fiber',
  'Sugars, total including NLEA': 'sugar',
  'Sugars, Total':                'sugar',
  'Total Sugars':                 'sugar',
}

async function searchUSDA(query) {
  const apiKey = import.meta.env.VITE_USDA_API_KEY || 'DEMO_KEY'
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?query=${encodeURIComponent(query)}&pageSize=25&dataType=Branded,Foundation,SR%20Legacy&api_key=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`USDA API returned HTTP ${res.status}`)
  const { foods = [] } = await res.json()

  const r1 = v => Math.round((v || 0) * 10) / 10

  return foods
    .map(food => {
      // Collect raw nutrient values (values are per 100g for non-Branded; per serving for Branded)
      const raw = {}
      for (const n of (food.foodNutrients || [])) {
        const k = NUTRIENT_MAP[n.nutrientName]
        if (k && raw[k] === undefined) raw[k] = n.value ?? 0
      }

      // Determine serving label and scale factor
      const isBranded = food.dataType === 'Branded'
      let servingLabel = '100g'
      let scale = 1

      if (food.servingSize && food.servingSizeUnit) {
        const unit = food.servingSizeUnit.toLowerCase().trim()
        const sz   = food.servingSize
        servingLabel = `${sz}${unit}`
        // Branded: nutrients already reflect that serving; Foundation/SR: per 100g → scale
        if (!isBranded && (unit === 'g' || unit === 'ml')) scale = sz / 100
      }

      // Title-case the all-caps USDA descriptions
      const name = food.description
        .toLowerCase()
        .replace(/\b\w/g, c => c.toUpperCase())
        .slice(0, 60)

      return {
        name,
        servingSize: servingLabel,
        cal:     Math.round((raw.cal     || 0) * scale),
        protein: r1((raw.protein || 0) * scale),
        carbs:   r1((raw.carbs   || 0) * scale),
        fat:     r1((raw.fat     || 0) * scale),
        fiber:   r1((raw.fiber   || 0) * scale),
        sugar:   r1((raw.sugar   || 0) * scale),
        _src: 'usda',
      }
    })
    .filter(f => f.cal > 0)
    .slice(0, 20)
}

function emptyLog() {
  return {
    workoutsPerDay:  {},   // { [planDayIdx]: { [exIdx]: bool } }
    customExercises: [],   // [{ id, name, sets, done }]
    totalBurned:     '',
    meals:           { Breakfast: [], Lunch: [], Dinner: [], Snacks: [] },
    notes:           '',
    workoutDayIdx:   null, // null = use today's actual day
  }
}

// ─── Shared Components ────────────────────────────────────────────────────────
function MacroBar({ label, value, target, color }) {
  const pct  = Math.min(100, target > 0 ? (value / target) * 100 : 0)
  const over = value > target * 1.1
  const good = value >= target * 0.82 && !over
  return (
    <div style={{ marginBottom: 10 }}>
      <div className="flex-between" style={{ marginBottom: 3 }}>
        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ fontSize: '0.82rem', fontWeight: 'bold', color: over ? 'var(--red)' : good ? color : 'var(--text)' }}>
          {Math.round(value)} <span style={{ fontWeight: 'normal', color: 'var(--text-faint)' }}>/ {target}</span>
        </span>
      </div>
      <div className="progress-bar" style={{ height: 7 }}>
        <div className="progress-fill" style={{ width: `${pct}%`, background: over ? 'var(--red)' : good ? color : 'var(--border)', transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────
function Overview() {
  return (
    <div>
      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg, #FFF0F3 0%, #FFE4EC 60%, #FFF5F7 100%)', borderRadius: 16, padding: '24px 30px', marginBottom: 24, border: '1px solid var(--pink-border)', boxShadow: '0 2px 16px rgba(232,84,122,0.07)' }}>
        <div style={{ fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, fontWeight: 600 }}>
          Postpartum Transformation — 6–8 Week Plan
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: 4, color: 'var(--pink)' }}>Strong, Toned &amp; Confident 🌸</h1>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Glute &amp; Body Recomposition · 5×/week · −18.8 lbs goal</div>
      </div>

      {/* Body comp stats */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 24 }}>
        <div className="metric-card metric-card-expense">
          <div className="metric-label">🏁 Start Weight</div>
          <div className="metric-value">148.8 <span style={{ fontSize: '1rem' }}>lb</span></div>
        </div>
        <div className="metric-card metric-card-income">
          <div className="metric-label">🎯 Goal Weight</div>
          <div className="metric-value text-green">130 <span style={{ fontSize: '1rem' }}>lb</span></div>
          <div className="metric-change neutral">−18.8 lbs total</div>
        </div>
        <div className="metric-card metric-card-pending">
          <div className="metric-label">📊 Body Fat</div>
          <div className="metric-value">42.6<span style={{ fontSize: '1rem' }}>%</span></div>
          <div className="metric-change neutral">63.4 lb fat mass</div>
        </div>
        <div className="metric-card metric-card-blue">
          <div className="metric-label">💪 Muscle Mass</div>
          <div className="metric-value">46.5 <span style={{ fontSize: '1rem' }}>lb</span></div>
          <div className="metric-change neutral">Goal: preserve + grow</div>
        </div>
      </div>

      <div className="section-grid">
        {/* Macro targets */}
        <div className="card">
          <div className="card-header"><h3>Daily Macro Targets</h3></div>
          <div className="card-body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { val: '1,400', unit: 'cal',  label: 'Calories',  note: '~500 deficit from TDEE', bg: '#FCE4EC', border:'#F4A0B5', color:'#C73D63' },
                { val: '145',   unit: 'g',    label: 'Protein',   note: '~1.7g per lb lean mass', bg: '#E3F2FD', border:'#BBDEFB', color:'#1565C0' },
                { val: '130',   unit: 'g',    label: 'Carbs',     note: 'Timed around workouts',  bg: '#FFF3E0', border:'#FFD9A0', color:'#B45309' },
                { val: '42',    unit: 'g',    label: 'Fat',       note: 'Avocado, olive oil, nuts',bg: '#F3E8FF', border:'#D9B8FF', color:'#7C3AED' },
              ].map(m => (
                <div key={m.label} style={{ background: m.bg, border: `1.5px solid ${m.border}`, borderRadius: 12, padding: '16px 14px', textAlign: 'center', color: m.color }}>
                  <div style={{ fontSize: '1.7rem', fontWeight: 'bold', lineHeight: 1 }}>{m.val}<span style={{ fontSize: '0.9rem', fontWeight: 400 }}>{m.unit}</span></div>
                  <div style={{ fontSize: '0.65rem', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4, opacity: 0.85 }}>{m.label}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.65, marginTop: 2 }}>{m.note}</div>
                </div>
              ))}
            </div>
            <div style={{ padding: '10px 14px', background: 'var(--pink-light)', borderRadius: 8, border: '1px solid var(--pink-border)', fontSize: '0.8rem', color: 'var(--pink-text)' }}>
              🤱 <strong>Still breastfeeding?</strong> Add +350 cal (protein + carbs) to these targets.
            </div>
          </div>
        </div>

        {/* Meal timing */}
        <div className="card">
          <div className="card-header"><h3>Meal Timing</h3></div>
          <div className="card-body" style={{ padding: 0 }}>
            {[
              { time: '7:00–8:00 AM',        meal: 'Breakfast',           macros: '~320 cal · 35g P · 25g C · 8g F' },
              { time: '10:30–11:00 AM',       meal: 'Mid-Morning Snack',   macros: '~180 cal · 20g P · 12g C · 5g F' },
              { time: '1:00–2:00 PM',         meal: 'Lunch',               macros: '~380 cal · 40g P · 35g C · 10g F' },
              { time: '30 min pre-workout',   meal: 'Pre-Workout Snack',   macros: '~150 cal · 15g P · 20g C · 3g F' },
              { time: 'Post-Workout',         meal: 'Post-Workout Meal',   macros: '~320 cal · 30g P · 38g C · 6g F' },
            ].map((t, i, arr) => (
              <div key={i} style={{ padding: '11px 20px', borderBottom: i < arr.length - 1 ? '1px solid var(--border-light)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--pink-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 2 }}>{t.time}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{t.meal}</div>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{t.macros}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Science note */}
      <div className="card">
        <div className="card-body" style={{ background: 'linear-gradient(135deg,#fdf7f4,#fef0f6)', borderRadius: 'var(--radius)' }}>
          <p className="text-sm" style={{ lineHeight: 1.8, color: 'var(--text-muted)' }}>
            <strong style={{ color: 'var(--text)' }}>Your TDEE:</strong> ~1,850–1,950 cal/day with 5 gym days/week. The 1,400 target creates a ~500 cal deficit for ~2 lbs/week loss.{' '}
            <strong style={{ color: 'var(--text)' }}>Key priority:</strong> protect every ounce of that 46.5 lbs of muscle while losing fat. Protein is set relative to lean mass, not total weight.
            You can realistically reach <strong style={{ color: 'var(--green)' }}>~34–36% body fat</strong> at goal weight — a major transformation in how you look and feel. 🌸
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Tab: Workout Plan ────────────────────────────────────────────────────────
function WorkoutPlanTab() {
  const todayDow = new Date().getDay()
  const [open, setOpen] = useState(new Set([todayDow]))

  function toggle(d) {
    setOpen(prev => { const n = new Set(prev); n.has(d) ? n.delete(d) : n.add(d); return n })
  }

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>5-Day Training Split</h2>
          <p className="text-sm text-muted mt-4">Weeks 1–2: form &amp; connection · Weeks 3–4: add volume · Weeks 5–8: increase load progressively</p>
        </div>
      </div>

      {[1, 2, 3, 4, 5, 6, 0].map(dayNum => {
        const d       = PLAN_DAYS[dayNum]
        const isOpen  = open.has(dayNum)
        const isToday = todayDow === dayNum
        return (
          <div key={dayNum} className="card mb-12" style={{ borderLeft: `3px solid ${isToday ? d.color : 'transparent'}`, overflow: 'hidden' }}>
            <div onClick={() => toggle(dayNum)} style={{ padding: '14px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isOpen ? d.bg : 'var(--surface)', transition: 'background 0.15s' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: '1.4rem' }}>{d.emoji}</span>
                <div>
                  <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: d.color }}>{d.day}</div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{d.name}</div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isToday && <span style={{ background: d.bg, color: d.color, border: `1px solid ${d.border}`, borderRadius: 20, padding: '2px 10px', fontSize: '0.68rem', fontWeight: 'bold' }}>Today</span>}
                <span style={{ color: 'var(--text-faint)', fontSize: '0.78rem' }}>{d.exercises.length} ex</span>
                <span style={{ color: d.color, fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
              </div>
            </div>

            {isOpen && (
              <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${d.border}` }}>
                {d.warmup && (
                  <div style={{ margin: '14px 0 10px', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, borderLeft: `3px solid ${d.border}`, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: d.color }}>Warm-Up: </strong>{d.warmup}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {d.exercises.map((ex, i) => (
                    <div key={i} style={{ padding: '12px 16px', background: 'var(--surface-hover)', borderRadius: 8, border: `1px solid ${d.border}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: ex.tip ? 6 : 0 }}>
                        <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{ex.name}</div>
                        <span style={{ background: 'var(--pink-light)', color: 'var(--pink-text)', border: '1px solid var(--pink-border)', padding: '2px 10px', borderRadius: 20, fontSize: '0.68rem', flexShrink: 0 }}>{ex.sets}</span>
                      </div>
                      {ex.tip && <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>{ex.tip}</p>}
                    </div>
                  ))}
                </div>
                {d.cooldown && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, borderLeft: `3px solid ${d.border}`, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <strong style={{ color: d.color }}>Cool Down: </strong>{d.cooldown}
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Serving-unit helpers ─────────────────────────────────────────────────────
// Parse fractions typed by the user: "1/2" → 0.5, "1 1/2" → 1.5, "3/4" → 0.75
function parseFraction(str) {
  const s = String(str ?? '').trim()
  if (!s) return 0
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3])
  const frac = s.match(/^(\d+)\/(\d+)$/)
  if (frac) return Number(frac[1]) / Number(frac[2])
  return parseFloat(s) || 0
}

// Pull grams out of labels like "1 cup (234g)", "4 oz (113g)", "100g", "240ml"
function extractGrams(label) {
  const s = String(label ?? '')
  const inParen = s.match(/\((\d+(?:\.\d+)?)\s*(?:g|ml)\)/i)
  if (inParen) return parseFloat(inParen[1])
  const bare = s.match(/^(\d+(?:\.\d+)?)\s*(?:g|ml)$/i)
  if (bare) return parseFloat(bare[1])
  return null
}

// Pull grams-per-1-cup from labels like "1 cup (234g)", "1/2 cup (117g)", "3/4 cup (170g)"
function extractGramsPerCup(label) {
  const s = String(label ?? '')
  const m = s.match(/^([\d.\/ ]+)\s*cups?\s*\((\d+(?:\.\d+)?)\s*g\)/i)
  if (!m) return null
  const cups = parseFraction(m[1].trim())
  const grams = parseFloat(m[2])
  return cups && grams ? grams / cups : null
}

// ─── Food Search Modal ────────────────────────────────────────────────────────
function FoodModal({ meal, onClose, onAdd }) {
  const [query,       setQuery]       = useState('')
  const [results,     setResults]     = useState([])
  const [loading,     setLoading]     = useState(false)
  const [err,         setErr]         = useState('')
  const [selected,      setSelected]      = useState(null)
  const [servingInput,  setServingInput]  = useState('1')   // text so fractions work
  const [servingUnit,   setServingUnit]   = useState('serving') // 'serving'|'g'|'oz'|'cup'
  // multi-ingredient manual builder
  const [manualName,  setManualName]  = useState('')
  const [manualRows,  setManualRows]  = useState([])
  const inputRef = useRef(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const isManualMode = manualRows.length > 0

  // Derived serving values
  const gPerServ  = selected ? extractGrams(selected.servingSize) : null
  const gPerCup   = selected ? extractGramsPerCup(selected.servingSize) : null
  const rawAmt    = parseFraction(servingInput)
  const servingQty =
    servingUnit === 'g'   && gPerServ            ? rawAmt / gPerServ :
    servingUnit === 'oz'  && gPerServ            ? (rawAmt * 28.3495) / gPerServ :
    servingUnit === 'cup' && gPerCup && gPerServ ? (rawAmt * gPerCup) / gPerServ :
    rawAmt

  async function search() {
    if (!query.trim()) return
    setLoading(true); setErr(''); setResults([]); setSelected(null)

    // ── 1. Built-in curated database (instant) shown first ───────────────────
    const localHits = searchFoodDB(query).map(f => ({ ...f, _src: 'db' }))

    // ── 2. USDA FoodData Central in parallel ─────────────────────────────────
    let usdaHits = []
    try {
      usdaHits = await searchUSDA(query)
    } catch (e) {
      console.error('[USDA Search]', e)
    }

    // Merge: curated first, then USDA (deduplicated by name prefix)
    const seen = new Set(localHits.map(f => f.name.toLowerCase().slice(0, 20)))
    const deduped = usdaHits.filter(f => !seen.has(f.name.toLowerCase().slice(0, 20)))
    const merged = [...localHits, ...deduped]

    if (merged.length > 0) {
      setResults(merged)
    } else {
      setErr('No results found — try a simpler search term, or add this food manually below.')
    }
    setLoading(false)
  }

  function scale(food, qty) {
    const q = parseFloat(qty) || 1
    return {
      cal:     Math.round((food.cal     || 0) * q),
      protein: Math.round((food.protein || 0) * q * 10) / 10,
      carbs:   Math.round((food.carbs   || 0) * q * 10) / 10,
      fat:     Math.round((food.fat     || 0) * q * 10) / 10,
      fiber:   Math.round((food.fiber   || 0) * q * 10) / 10,
      sugar:   Math.round((food.sugar   || 0) * q * 10) / 10,
    }
  }

  function confirmAdd() {
    if (!selected) return
    const qty = parseFloat(servingQty) || 1
    const s   = scale(selected, qty)
    onAdd({
      id: uid(), name: selected.name,
      servingSize: selected.servingSize, servingQty: qty,
      calPer: selected.cal, proteinPer: selected.protein,
      carbsPer: selected.carbs, fatPer: selected.fat,
      fiberPer: selected.fiber || 0, sugarPer: selected.sugar || 0,
      ...s,
    })
    onClose()
  }

  // ── Manual multi-ingredient builder ────────────────────────────────────────
  function openManual() {
    setSelected(null); setResults([]); setErr('')
    setManualName('')
    setManualRows([{ id: uid(), name: '', cal: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '' }])
  }

  function closeManual() {
    setManualRows([]); setManualName('')
  }

  function updateRow(id, field, val) {
    setManualRows(rows => rows.map(r => r.id === id ? { ...r, [field]: val } : r))
  }

  function addRow() {
    setManualRows(rows => [...rows, { id: uid(), name: '', cal: '', protein: '', carbs: '', fat: '', fiber: '', sugar: '' }])
  }

  function removeRow(id) {
    setManualRows(rows => {
      const next = rows.filter(r => r.id !== id)
      return next.length > 0 ? next : []
    })
  }

  const manualTotals = manualRows.reduce((acc, r) => ({
    cal:     acc.cal     + (parseFloat(r.cal)     || 0),
    protein: acc.protein + (parseFloat(r.protein) || 0),
    carbs:   acc.carbs   + (parseFloat(r.carbs)   || 0),
    fat:     acc.fat     + (parseFloat(r.fat)     || 0),
    fiber:   acc.fiber   + (parseFloat(r.fiber)   || 0),
    sugar:   acc.sugar   + (parseFloat(r.sugar)   || 0),
  }), { cal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 })

  function saveManual() {
    const t = manualTotals
    onAdd({
      id: uid(),
      name: manualName.trim() || 'Custom Entry',
      servingSize: '1 serving', servingQty: 1,
      calPer: t.cal, proteinPer: t.protein, carbsPer: t.carbs,
      fatPer: t.fat, fiberPer: t.fiber, sugarPer: t.sugar,
      ...t,
    })
    onClose()
  }

  const preview = selected ? scale(selected, servingQty) : null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>
            {isManualMode ? '✏️ Build Custom Entry' : `Add to ${meal}`}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* ── Search (hidden in manual mode) ── */}
        {!isManualMode && (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input ref={inputRef} value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && search()}
                placeholder='e.g. "2 scrambled eggs", "1 cup oatmeal", "Big Mac"'
                style={{ flex: 1 }} />
              <button className="btn btn-primary btn-sm" onClick={search} disabled={loading} style={{ whiteSpace: 'nowrap' }}>
                {loading ? '…' : '🔍 Search'}
              </button>
            </div>
            {err && <div style={{ fontSize: '0.78rem', color: 'var(--red)', marginBottom: 10 }}>{err}</div>}
          </>
        )}

        {/* ── Results list ── */}
        {!isManualMode && results.length > 0 && !selected && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 260, overflowY: 'auto', marginBottom: 12 }}>
            {results.map((r, i) => (
              <button key={i} onClick={() => { setSelected(r); setServingInput('1'); setServingUnit('serving') }}
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'Georgia,serif', textAlign: 'left', width: '100%', transition: 'border-color 0.12s, background 0.12s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='var(--pink)'; e.currentTarget.style.background='var(--pink-light)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.background='var(--bg)' }}>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{r.name}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span>per {r.servingSize} · F:{r.fiber||0}g · S:{r.sugar||0}g</span>
                    <span style={{
                      background: r._src === 'usda' ? '#eff6ff' : '#f0fdf4',
                      color:      r._src === 'usda' ? '#1d4ed8' : '#15803d',
                      border:     `1px solid ${r._src === 'usda' ? '#93c5fd' : '#86efac'}`,
                      borderRadius: 4, padding: '0px 5px', fontSize: '0.6rem', fontWeight: 'bold', letterSpacing: '0.04em',
                    }}>
                      {r._src === 'usda' ? 'USDA' : '✓ curated'}
                    </span>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--pink-text)' }}>{r.cal} cal</div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>P:{r.protein}g C:{r.carbs}g F:{r.fat}g</div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── Serving adjuster (search result selected) ── */}
        {selected && !isManualMode && (
          <div>
            {/* Food name chip */}
            <div style={{ padding: '10px 14px', background: 'var(--pink-light)', borderRadius: 8, border: '1px solid var(--pink-border)', marginBottom: 12 }}>
              <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{selected.name}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--pink-text)', marginTop: 3 }}>
                {selected.cal} cal · {selected.servingSize}
              </div>
            </div>

            {/* Unit pills */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {[
                { key: 'serving', label: 'serving' },
                ...(gPerServ  ? [{ key: 'g',   label: 'grams' }] : []),
                ...(gPerServ  ? [{ key: 'oz',  label: 'oz'    }] : []),
                ...(gPerCup && gPerServ ? [{ key: 'cup', label: 'cups' }] : []),
              ].map(u => (
                <button key={u.key}
                  onClick={() => { setServingUnit(u.key); setServingInput('1') }}
                  style={{
                    padding: '3px 12px', borderRadius: 20, border: '1px solid', cursor: 'pointer',
                    fontSize: '0.72rem', fontFamily: 'Georgia,serif',
                    background:   servingUnit === u.key ? 'var(--pink)'   : 'transparent',
                    color:        servingUnit === u.key ? '#fff'           : 'var(--text-muted)',
                    borderColor:  servingUnit === u.key ? 'var(--pink)'   : 'var(--border)',
                    transition: 'all 0.12s',
                  }}>
                  {u.label}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', flexShrink: 0 }}>Amount:</span>
              <input
                type="text"
                value={servingInput}
                onChange={e => setServingInput(e.target.value)}
                placeholder={servingUnit === 'serving' ? '1 or 1/2' : servingUnit === 'cup' ? '1/2' : '100'}
                style={{ width: 80, textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}
              />
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {servingUnit === 'serving' && `× ${selected.servingSize}`}
                {servingUnit === 'g'       && 'grams'}
                {servingUnit === 'oz'      && 'ounces'}
                {servingUnit === 'cup'     && 'cups'}
              </span>
              {/* Show gram equivalent when not already in servings */}
              {servingUnit !== 'serving' && rawAmt > 0 && (
                <span style={{ fontSize: '0.68rem', color: 'var(--text-faint)', flexShrink: 0 }}>
                  ≈ {
                    servingUnit === 'g'   ? `${rawAmt}g` :
                    servingUnit === 'oz'  ? `${Math.round(rawAmt * 28.35)}g` :
                    gPerCup ? `${Math.round(rawAmt * gPerCup)}g` : ''
                  }
                </span>
              )}
            </div>

            {preview && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 16 }}>
                {[
                  { label:'Cal',     val: preview.cal,     color:'var(--pink-text)' },
                  { label:'Protein', val: preview.protein, color:'var(--blue)' },
                  { label:'Carbs',   val: preview.carbs,   color:'var(--amber)' },
                  { label:'Fat',     val: preview.fat,     color:'var(--green)' },
                  { label:'Fiber',   val: preview.fiber,   color:'#8b5cf6' },
                  { label:'Sugar',   val: preview.sugar,   color:'#ec4899' },
                ].map(m => (
                  <div key={m.label} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg)', borderRadius: 8, border: '1px solid var(--border-light)' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '1.05rem', color: m.color, lineHeight: 1 }}>{m.val}</div>
                    <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{m.label}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="modal-footer" style={{ padding: 0, margin: 0, border: 'none' }}>
              <button className="btn" onClick={() => setSelected(null)}>← Back</button>
              <button className="btn btn-primary" onClick={confirmAdd}>Add to {meal}</button>
            </div>
          </div>
        )}

        {/* ── Multi-ingredient manual builder ── */}
        {isManualMode && (
          <div>
            {/* Entry name */}
            <input
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder="Entry name (e.g. My Morning Coffee)"
              style={{ width: '100%', marginBottom: 14, fontWeight: 'bold', fontSize: '0.95rem', padding: '8px 10px', boxSizing: 'border-box' }}
            />

            {/* Headers + rows in one flat grid so they always stay aligned */}
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 250, marginBottom: 8 }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(90px,1fr) 42px 46px 46px 42px 42px 42px 20px',
                columnGap: 4, rowGap: 5,
                alignItems: 'center',
                minWidth: 380,
              }}>
                {/* Header row */}
                {['Ingredient', 'Cal', 'Pro g', 'Carb g', 'Fat g', 'Fib g', 'Sug g', ''].map((h, i) => (
                  <span key={`h${i}`} style={{ fontSize: '0.57rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', textAlign: i === 0 ? 'left' : 'center', paddingBottom: 2 }}>{h}</span>
                ))}
                {/* Data rows — flat in the same grid */}
                {manualRows.map(row => (
                  <>
                    <input key={`${row.id}-name`}
                      value={row.name}
                      onChange={e => updateRow(row.id, 'name', e.target.value)}
                      placeholder="e.g. Oat milk"
                      style={{ fontSize: '0.8rem', padding: '5px 7px', minWidth: 0 }}
                    />
                    {['cal','protein','carbs','fat','fiber','sugar'].map(k => (
                      <input key={`${row.id}-${k}`} type="number" min="0" step="0.5"
                        value={row[k]}
                        onChange={e => updateRow(row.id, k, e.target.value)}
                        placeholder="0"
                        style={{ textAlign: 'center', fontSize: '0.78rem', padding: '5px 2px', minWidth: 0 }}
                      />
                    ))}
                    <button key={`${row.id}-del`} onClick={() => removeRow(row.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '1.1rem', padding: 0, textAlign: 'center', lineHeight: 1 }}>×</button>
                  </>
                ))}
              </div>
            </div>

            {/* Add row */}
            <button onClick={addRow} style={{
              width: '100%', padding: '7px', marginBottom: 12,
              border: '1.5px dashed var(--pink-border)', background: 'var(--pink-light)',
              borderRadius: 'var(--radius)', cursor: 'pointer',
              fontSize: '0.78rem', color: 'var(--pink-text)', fontFamily: 'Georgia,serif',
            }}>
              + Add Ingredient
            </button>

            {/* Totals row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 6, marginBottom: 14, padding: '10px 12px', background: 'var(--pink-light)', borderRadius: 8, border: '1px solid var(--pink-border)' }}>
              {[
                { label:'Cal',     val: Math.round(manualTotals.cal),                color:'var(--pink-text)' },
                { label:'Protein', val: Math.round(manualTotals.protein * 10) / 10,  color:'var(--blue)' },
                { label:'Carbs',   val: Math.round(manualTotals.carbs * 10) / 10,    color:'var(--amber)' },
                { label:'Fat',     val: Math.round(manualTotals.fat * 10) / 10,      color:'var(--green)' },
                { label:'Fiber',   val: Math.round(manualTotals.fiber * 10) / 10,    color:'#8b5cf6' },
                { label:'Sugar',   val: Math.round(manualTotals.sugar * 10) / 10,    color:'#ec4899' },
              ].map(m => (
                <div key={m.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontWeight: 'bold', fontSize: '1rem', color: m.color, lineHeight: 1 }}>{m.val}</div>
                  <div style={{ fontSize: '0.57rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 3 }}>{m.label}</div>
                </div>
              ))}
            </div>

            <div className="modal-footer" style={{ padding: 0, margin: 0, border: 'none' }}>
              <button className="btn" onClick={closeManual}>← Back</button>
              <button className="btn btn-primary" onClick={saveManual}
                disabled={!manualName.trim()}>
                Save to {meal}
              </button>
            </div>
          </div>
        )}

        {/* ── "Enter macros manually" link ── */}
        {!selected && !isManualMode && results.length === 0 && !loading && (
          <div style={{ textAlign: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
            <button onClick={openManual} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', fontFamily: 'Georgia,serif', textDecoration: 'underline' }}>
              Enter macros manually →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Meal Section ─────────────────────────────────────────────────────────────
function MealSection({ meal, emoji, foods, onAddClick, onRemove, onUpdateServing, onUpdateField }) {
  const [open, setOpen] = useState(true)
  const mealCal     = foods.reduce((s, f) => s + (parseFloat(f.cal)     || 0), 0)
  const mealProtein = foods.reduce((s, f) => s + (parseFloat(f.protein) || 0), 0)
  const mealCarbs   = foods.reduce((s, f) => s + (parseFloat(f.carbs)   || 0), 0)
  const mealFat     = foods.reduce((s, f) => s + (parseFloat(f.fat)     || 0), 0)

  return (
    <div className="card mb-12" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div onClick={() => setOpen(!open)} style={{ padding: '11px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: open ? 'var(--surface-hover)' : 'var(--surface)', transition: 'background 0.15s', borderBottom: open ? '1px solid var(--border-light)' : 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>{emoji}</span>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '0.875rem' }}>{meal}</div>
            {foods.length > 0 && (
              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: 1 }}>
                P:{Math.round(mealProtein)}g · C:{Math.round(mealCarbs)}g · F:{Math.round(mealFat)}g
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 'bold', color: 'var(--pink-text)', fontSize: '0.95rem' }}>
            {foods.length > 0 ? `${Math.round(mealCal)} cal` : <span style={{ color: 'var(--text-faint)', fontWeight: 'normal', fontSize: '0.78rem' }}>empty</span>}
          </span>
          <span style={{ color: 'var(--text-faint)', fontSize: '0.75rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '10px 16px 14px' }}>
          {/* Column headers */}
          {foods.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 58px 50px 48px 48px 48px 48px 48px 26px', gap: 4, paddingBottom: 6, marginBottom: 4, borderBottom: '1px solid var(--border-light)' }}>
              {['Food', 'Serving', 'Cal', 'Pro', 'Carb', 'Fat', 'Fiber', 'Sugar', ''].map((h, i) => (
                <span key={i} style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-faint)', textAlign: i > 0 ? 'center' : 'left' }}>{h}</span>
              ))}
            </div>
          )}

          {/* Food rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {foods.map(food => (
              <div key={food.id} style={{ display: 'grid', gridTemplateColumns: '1fr 58px 50px 48px 48px 48px 48px 48px 26px', gap: 4, alignItems: 'center', padding: '5px 4px', borderRadius: 6, background: 'var(--surface-hover)', border: '1px solid var(--border-light)' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.82rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{food.name || '—'}</div>
                  {food.servingSize && <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginTop: 1 }}>per {food.servingSize}</div>}
                </div>
                <input type="number" min="0.25" step="0.25" value={food.servingQty || 1}
                  onChange={e => onUpdateServing(meal, food.id, e.target.value)}
                  style={{ textAlign: 'center', fontSize: '0.78rem', padding: '3px 4px' }} />
                {['cal','protein','carbs','fat','fiber','sugar'].map(k => (
                  <input key={k} type="number" min="0" step="0.1"
                    value={Math.round((parseFloat(food[k]) || 0) * 10) / 10}
                    onChange={e => onUpdateField(meal, food.id, k, e.target.value)}
                    style={{ textAlign: 'center', fontSize: '0.78rem', padding: '3px 2px', width: '100%' }} />
                ))}
                <button onClick={() => onRemove(meal, food.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '1.1rem', padding: 0, textAlign: 'center', lineHeight: 1 }}>×</button>
              </div>
            ))}
          </div>

          <button onClick={onAddClick} style={{
            width: '100%', marginTop: foods.length > 0 ? 10 : 4,
            padding: '8px', border: '1.5px dashed var(--pink-border)',
            background: 'var(--pink-light)', borderRadius: 'var(--radius)',
            cursor: 'pointer', fontSize: '0.78rem', color: 'var(--pink-text)',
            fontFamily: 'Georgia,serif', transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background='#fce7f3'; e.currentTarget.style.borderColor='var(--pink)' }}
          onMouseLeave={e => { e.currentTarget.style.background='var(--pink-light)'; e.currentTarget.style.borderColor='var(--pink-border)' }}>
            + Add Food to {meal}
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Daily Log ───────────────────────────────────────────────────────────
function DailyLogTab({ logs, setLogs }) {
  const dateKey    = today()
  const log        = logs[dateKey] || emptyLog()
  const activeDayIdx = log.workoutDayIdx ?? new Date().getDay()
  const planDay    = PLAN_DAYS[activeDayIdx]
  const [addingTo,   setAddingTo]   = useState(null)
  const [showAddEx,  setShowAddEx]  = useState(false)
  const exNameRef = useRef(null)
  const exSetsRef = useRef(null)

  function updateLog(patch) {
    setLogs({ ...logs, [dateKey]: { ...log, ...patch } })
  }

  // ── Totals across all meals ──
  const allFood = Object.values(log.meals || {}).flat()
  const totals  = {
    cal:     allFood.reduce((s, f) => s + (parseFloat(f.cal)     || 0), 0),
    protein: allFood.reduce((s, f) => s + (parseFloat(f.protein) || 0), 0),
    carbs:   allFood.reduce((s, f) => s + (parseFloat(f.carbs)   || 0), 0),
    fat:     allFood.reduce((s, f) => s + (parseFloat(f.fat)     || 0), 0),
    fiber:   allFood.reduce((s, f) => s + (parseFloat(f.fiber)   || 0), 0),
    sugar:   allFood.reduce((s, f) => s + (parseFloat(f.sugar)   || 0), 0),
  }
  const burned    = parseFloat(log.totalBurned) || 0
  const netCal    = totals.cal - burned
  const remaining = MACRO_TARGETS.cal - netCal
  const currentWorkouts = (log.workoutsPerDay || {})[activeDayIdx] || {}
  const completedCount  = Object.values(currentWorkouts).filter(Boolean).length
                        + (log.customExercises || []).filter(e => e.done).length
  const totalExCount    = planDay.exercises.length + (log.customExercises || []).length

  // ── Food helpers ──
  function addFood(meal, food) {
    const cur = log.meals[meal] || []
    updateLog({ meals: { ...log.meals, [meal]: [...cur, food] } })
  }
  function removeFood(meal, id) {
    updateLog({ meals: { ...log.meals, [meal]: (log.meals[meal] || []).filter(f => f.id !== id) } })
  }
  function updateServing(meal, id, qty) {
    const q = parseFloat(qty) || 1
    updateLog({
      meals: {
        ...log.meals,
        [meal]: (log.meals[meal] || []).map(f => {
          if (f.id !== id) return f
          // Use stored per-serving values if available; fall back to dividing current by old qty
          const base = (k) => f[`${k}Per`] !== undefined ? f[`${k}Per`] : (parseFloat(f[k]) || 0) / (f.servingQty || 1)
          return {
            ...f, servingQty: q,
            cal:     Math.round(base('cal') * q),
            protein: Math.round(base('protein') * q * 10) / 10,
            carbs:   Math.round(base('carbs') * q * 10) / 10,
            fat:     Math.round(base('fat') * q * 10) / 10,
            fiber:   Math.round(base('fiber') * q * 10) / 10,
            sugar:   Math.round(base('sugar') * q * 10) / 10,
          }
        }),
      },
    })
  }
  function updateField(meal, id, field, value) {
    const v = parseFloat(value) || 0
    updateLog({
      meals: {
        ...log.meals,
        [meal]: (log.meals[meal] || []).map(f => {
          if (f.id !== id) return f
          const qty = f.servingQty || 1
          // Update the displayed value AND the per-serving base so serving-qty math stays correct
          return { ...f, [field]: v, [`${field}Per`]: Math.round((v / qty) * 100) / 100 }
        }),
      },
    })
  }

  function toggleEx(i) {
    const cur = (log.workoutsPerDay || {})[activeDayIdx] || {}
    updateLog({
      workoutsPerDay: { ...(log.workoutsPerDay || {}), [activeDayIdx]: { ...cur, [i]: !cur[i] } }
    })
  }

  function toggleCustomEx(id) {
    updateLog({
      customExercises: (log.customExercises || []).map(e => e.id === id ? { ...e, done: !e.done } : e)
    })
  }

  function addCustomEx(name, sets) {
    if (!name.trim()) return
    updateLog({
      customExercises: [...(log.customExercises || []), { id: uid(), name: name.trim(), sets: sets.trim(), done: false }]
    })
  }

  function removeCustomEx(id) {
    updateLog({ customExercises: (log.customExercises || []).filter(e => e.id !== id) })
  }

  const MEAL_CONFIG = [
    { name: 'Breakfast', emoji: '🌅' },
    { name: 'Lunch',     emoji: '☀️'  },
    { name: 'Dinner',    emoji: '🌙'  },
    { name: 'Snacks',    emoji: '🍎'  },
  ]

  // Macro config with fiber/sugar targets
  const NUTRIENT_TARGETS = [
    { key: 'cal',     label: 'Calories', target: MACRO_TARGETS.cal,     unit: '',  color: '#E8547A',     bgColor: '#FCE4EC' },
    { key: 'protein', label: 'Protein',  target: MACRO_TARGETS.protein, unit: 'g', color: '#2B80C4',     bgColor: '#E8F4FD' },
    { key: 'carbs',   label: 'Carbs',    target: MACRO_TARGETS.carbs,   unit: 'g', color: '#D4820A',     bgColor: '#FFF3E0' },
    { key: 'fat',     label: 'Fat',      target: MACRO_TARGETS.fat,     unit: 'g', color: '#7C3AED',     bgColor: '#F3E8FF' },
    { key: 'fiber',   label: 'Fiber',    target: 25,                    unit: 'g', color: '#2D9E6B',     bgColor: '#E8F5E9' },
    { key: 'sugar',   label: 'Sugar',    target: 50,                    unit: 'g', color: '#C73D63',     bgColor: '#FCE4EC' },
  ]

  return (
    <div>
      {/* ── Daily Calorie + Macro Summary Banner ── */}
      <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>

        {/* Header row */}
        <div style={{ padding: '14px 20px 12px', background: 'linear-gradient(135deg, var(--pink-light) 0%, #fff8fb 100%)', borderBottom: '1px solid var(--pink-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ color: 'var(--pink-text)', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 'bold' }}>
              🍽️ Daily Nutrition — {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {allFood.length} items logged
          </div>
        </div>

        <div style={{ padding: '16px 20px' }}>
          {/* 5 calorie columns */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 0, marginBottom: 14 }}>
            {[
              { label: 'Goal',      val: MACRO_TARGETS.cal,      sub: 'cal target',    textColor: 'var(--text-muted)',  valColor: 'var(--text)' },
              { label: 'Eaten',     val: Math.round(totals.cal), sub: 'from food',      textColor: 'var(--pink-text)',   valColor: 'var(--pink-text)' },
              { label: 'Burned',    val: Math.round(burned),     sub: 'exercise',       textColor: 'var(--amber)',       valColor: 'var(--amber)' },
              { label: 'Remaining', val: Math.round(remaining),  sub: remaining < 0 ? 'over goal' : 'left today', textColor: remaining < 0 ? 'var(--red)' : 'var(--green)', valColor: remaining < 0 ? 'var(--red)' : 'var(--green)' },
              { label: 'Net',       val: Math.round(netCal),     sub: 'eaten − burned', textColor: 'var(--text-muted)',  valColor: 'var(--text)' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center', padding: '0 8px', borderRight: i < 4 ? '1px solid var(--border-light)' : 'none' }}>
                <div style={{ fontSize: '0.58rem', textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text-faint)', marginBottom: 5, fontWeight: 'bold' }}>{item.label}</div>
                <div style={{ fontSize: '1.55rem', fontWeight: 'bold', color: item.valColor, lineHeight: 1 }}>{item.val}</div>
                <div style={{ fontSize: '0.6rem', color: item.textColor, marginTop: 4 }}>{item.sub}</div>
              </div>
            ))}
          </div>

          {/* Calorie progress bar */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Calorie Progress</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 'bold', color: totals.cal > MACRO_TARGETS.cal ? 'var(--red)' : 'var(--pink-text)' }}>
                {Math.round((totals.cal / MACRO_TARGETS.cal) * 100)}%
              </span>
            </div>
            <div className="progress-bar" style={{ height: 8, borderRadius: 4 }}>
              <div style={{
                height: '100%', borderRadius: 4, transition: 'width 0.4s',
                background: totals.cal > MACRO_TARGETS.cal ? 'var(--red)' : 'linear-gradient(90deg, var(--pink), var(--pink-dark))',
                width: `${Math.min(100, (totals.cal / MACRO_TARGETS.cal) * 100)}%`,
              }} />
            </div>
          </div>

          {/* 6 macro pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 8 }}>
            {NUTRIENT_TARGETS.map(m => {
              const eaten = totals[m.key] || 0
              const rem   = Math.round((m.target - eaten) * 10) / 10
              const over  = rem < 0
              const pct   = Math.min(100, (eaten / m.target) * 100)
              return (
                <div key={m.key} style={{ background: over ? 'var(--red-bg)' : m.bgColor, border: `1px solid ${over ? '#fecaca' : 'var(--border-light)'}`, borderRadius: 8, padding: '10px 6px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1rem', fontWeight: 'bold', color: over ? 'var(--red)' : m.color, lineHeight: 1 }}>
                    {over ? `+${Math.abs(rem)}` : rem}{m.unit}
                  </div>
                  <div style={{ fontSize: '0.58rem', color: over ? 'var(--red)' : 'var(--text-muted)', margin: '3px 0 6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {m.label} {over ? 'over' : 'left'}
                  </div>
                  <div style={{ height: 3, background: 'var(--border-light)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: over ? 'var(--red)' : m.color, width: `${pct}%`, transition: 'width 0.4s', borderRadius: 2 }} />
                  </div>
                  <div style={{ fontSize: '0.55rem', color: 'var(--text-faint)', marginTop: 3 }}>{Math.round(eaten * 10) / 10} / {m.target}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20 }}>

        {/* ── Left: Workout + Notes ── */}
        <div>
          <div className="card mb-12" style={{ borderLeft: `3px solid ${planDay.color}`, overflow: 'hidden' }}>
            <div className="card-header" style={{ background: planDay.bg, borderBottom: `1px solid ${planDay.border}` }}>
              <div>
                <div style={{ fontSize: '0.6rem', color: planDay.color, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {planDay.emoji} {planDay.day}
                </div>
                <div style={{ fontWeight: 'bold', fontSize: '0.875rem', marginTop: 1 }}>{planDay.name}</div>
              </div>
              <span style={{ background: 'white', color: planDay.color, border: `1px solid ${planDay.border}`, borderRadius: 20, padding: '2px 9px', fontSize: '0.68rem', fontWeight: 'bold', flexShrink: 0 }}>
                {completedCount}/{totalExCount}
              </span>
            </div>
            <div className="card-body" style={{ padding: '10px 14px' }}>

              {/* ── Day picker ── */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {[0,1,2,3,4,5,6].map(i => {
                  const d = PLAN_DAYS[i]
                  return (
                    <button key={i} onClick={() => updateLog({ workoutDayIdx: i })}
                      style={{
                        padding: '3px 8px', borderRadius: 20, border: '1px solid',
                        fontSize: '0.62rem', cursor: 'pointer', fontFamily: 'Georgia,serif',
                        background:  activeDayIdx === i ? d.color   : 'transparent',
                        color:       activeDayIdx === i ? '#fff'    : 'var(--text-muted)',
                        borderColor: activeDayIdx === i ? d.color   : 'var(--border)',
                        transition: 'all 0.12s',
                      }}>
                      {d.day.slice(0, 3)}
                    </button>
                  )
                })}
              </div>

              {/* ── Plan exercises ── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {planDay.exercises.map((ex, i) => (
                  <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: currentWorkouts[i] ? planDay.bg : 'var(--surface-hover)', borderRadius: 6, border: `1px solid ${currentWorkouts[i] ? planDay.border : 'var(--border-light)'}`, cursor: 'pointer', transition: 'background 0.12s' }}>
                    <input type="checkbox" checked={!!currentWorkouts[i]} onChange={() => toggleEx(i)} style={{ accentColor: planDay.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.78rem', textDecoration: currentWorkouts[i] ? 'line-through' : 'none', color: currentWorkouts[i] ? 'var(--text-muted)' : 'var(--text)' }}>{ex.name}</span>
                    <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', flexShrink: 0 }}>{ex.sets}</span>
                  </label>
                ))}

                {/* ── Custom exercises ── */}
                {(log.customExercises || []).map(ex => (
                  <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: ex.done ? '#f0fdf4' : 'var(--surface-hover)', borderRadius: 6, border: `1px solid ${ex.done ? '#86efac' : 'var(--border-light)'}`, transition: 'background 0.12s' }}>
                    <input type="checkbox" checked={!!ex.done} onChange={() => toggleCustomEx(ex.id)} style={{ accentColor: '#22c55e', flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '0.78rem', textDecoration: ex.done ? 'line-through' : 'none', color: ex.done ? 'var(--text-muted)' : 'var(--text)' }}>{ex.name}</span>
                    {ex.sets && <span style={{ fontSize: '0.6rem', color: 'var(--text-faint)', flexShrink: 0 }}>{ex.sets}</span>}
                    <button onClick={() => removeCustomEx(ex.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-faint)', fontSize: '1rem', padding: 0, lineHeight: 1, flexShrink: 0 }}>×</button>
                  </div>
                ))}
              </div>

              {/* ── Add custom exercise ── */}
              {showAddEx ? (
                <div style={{ display: 'flex', gap: 5, marginTop: 8, alignItems: 'center' }}>
                  <input ref={exNameRef} placeholder="Exercise name" autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') { addCustomEx(exNameRef.current?.value || '', exSetsRef.current?.value || ''); if (exNameRef.current) exNameRef.current.value = ''; if (exSetsRef.current) exSetsRef.current.value = ''; exNameRef.current?.focus() } }}
                    style={{ flex: 1, fontSize: '0.8rem', padding: '5px 8px' }} />
                  <input ref={exSetsRef} placeholder="Sets (e.g. 3×12)"
                    style={{ width: 100, fontSize: '0.8rem', padding: '5px 8px' }} />
                  <button className="btn btn-primary btn-sm" onClick={() => {
                    addCustomEx(exNameRef.current?.value || '', exSetsRef.current?.value || '')
                    if (exNameRef.current) exNameRef.current.value = ''
                    if (exSetsRef.current) exSetsRef.current.value = ''
                    exNameRef.current?.focus()
                  }}>Add</button>
                  <button className="btn btn-sm" onClick={() => setShowAddEx(false)} style={{ padding: '5px 8px' }}>✕</button>
                </div>
              ) : (
                <button onClick={() => setShowAddEx(true)} style={{
                  width: '100%', marginTop: 8, padding: '5px',
                  border: '1.5px dashed var(--border)', background: 'transparent',
                  borderRadius: 'var(--radius)', cursor: 'pointer',
                  fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Georgia,serif',
                }}>
                  + Add Exercise
                </button>
              )}

              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>🔥 Cal Burned</span>
                <input type="number" placeholder="e.g. 350" value={log.totalBurned}
                  onChange={e => updateLog({ totalBurned: e.target.value })}
                  style={{ flex: 1, textAlign: 'center', fontWeight: 'bold' }} />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3>📝 Notes</h3></div>
            <div className="card-body">
              <textarea placeholder="Energy, soreness, wins…" value={log.notes}
                onChange={e => updateLog({ notes: e.target.value })}
                style={{ width: '100%', minHeight: 90, resize: 'vertical', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '8px 10px', fontFamily: 'Georgia,serif', fontSize: '0.82rem', background: 'var(--surface)' }} />
            </div>
          </div>

          {/* Mini nutrition summary for the sidebar */}
          <div className="card mt-12">
            <div className="card-header"><h3>📊 Today's Totals</h3></div>
            <div className="card-body" style={{ padding: '12px 16px' }}>
              {NUTRIENT_TARGETS.map(m => {
                const eaten = Math.round((totals[m.key] || 0) * 10) / 10
                const pct   = Math.min(100, (eaten / m.target) * 100)
                const over  = eaten > m.target * 1.05
                const good  = eaten >= m.target * 0.8 && !over
                return (
                  <div key={m.key} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)' }}>{m.label}</span>
                      <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: over ? 'var(--red)' : good ? m.color : 'var(--text)' }}>
                        {eaten}{m.unit} <span style={{ fontWeight: 'normal', color: 'var(--text-faint)', fontSize: '0.68rem' }}>/ {m.target}</span>
                      </span>
                    </div>
                    <div className="progress-bar" style={{ height: 5 }}>
                      <div className="progress-fill" style={{ width: `${pct}%`, background: over ? 'var(--red)' : good ? m.color : 'var(--border)', transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Meal-by-meal Food Log ── */}
        <div>
          {MEAL_CONFIG.map(({ name, emoji }) => (
            <MealSection key={name} meal={name} emoji={emoji}
              foods={log.meals[name] || []}
              onAddClick={() => setAddingTo(name)}
              onRemove={removeFood}
              onUpdateServing={updateServing}
              onUpdateField={updateField}
            />
          ))}

          {/* Meal breakdown table */}
          {allFood.length > 0 && (
            <div className="card mt-8">
              <div className="card-header" style={{ background: 'var(--pink-light)' }}><h3>Meal Breakdown</h3></div>
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Meal</th>
                      <th style={{ textAlign: 'right' }}>Cal</th>
                      <th style={{ textAlign: 'right' }}>Protein</th>
                      <th style={{ textAlign: 'right' }}>Carbs</th>
                      <th style={{ textAlign: 'right' }}>Fat</th>
                      <th style={{ textAlign: 'right' }}>Fiber</th>
                      <th style={{ textAlign: 'right' }}>Sugar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {MEAL_CONFIG.map(({ name, emoji }) => {
                      const mFoods = log.meals[name] || []
                      if (!mFoods.length) return null
                      const mc = k => mFoods.reduce((s, f) => s + (parseFloat(f[k]) || 0), 0)
                      return (
                        <tr key={name}>
                          <td><span style={{ marginRight: 6 }}>{emoji}</span><strong>{name}</strong></td>
                          <td style={{ textAlign: 'right', fontWeight: 'bold', color: 'var(--pink-text)' }}>{Math.round(mc('cal'))}</td>
                          <td style={{ textAlign: 'right' }}>{Math.round(mc('protein'))}g</td>
                          <td style={{ textAlign: 'right' }}>{Math.round(mc('carbs'))}g</td>
                          <td style={{ textAlign: 'right' }}>{Math.round(mc('fat'))}g</td>
                          <td style={{ textAlign: 'right' }}>{Math.round(mc('fiber') * 10) / 10}g</td>
                          <td style={{ textAlign: 'right' }}>{Math.round(mc('sugar') * 10) / 10}g</td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--pink-light)', fontWeight: 'bold' }}>
                      <td>Total</td>
                      <td style={{ textAlign: 'right', color: 'var(--pink-text)' }}>{Math.round(totals.cal)}</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(totals.protein)}g</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(totals.carbs)}g</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(totals.fat)}g</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(totals.fiber * 10) / 10}g</td>
                      <td style={{ textAlign: 'right' }}>{Math.round(totals.sugar * 10) / 10}g</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Food Modal */}
      {addingTo && (
        <FoodModal meal={addingTo} onClose={() => setAddingTo(null)} onAdd={food => addFood(addingTo, food)} />
      )}
    </div>
  )
}

// ─── Tab: Weekly Stats ────────────────────────────────────────────────────────
function WeeklyStatsTab({ weekly, setWeekly }) {
  const [adding, setAdding] = useState(false)
  const emptyWeek = () => ({ id: uid(), week: weekly.length + 1, date: today(), weight: '', bf: '', muscle: '', waist: '', hips: '', thigh: '', energy: '', sleep: '', wins: '', notes: '' })
  const [form, setForm] = useState(emptyWeek)

  function save(e) {
    e.preventDefault()
    setWeekly([...weekly, { ...form, week: weekly.length + 1 }])
    setAdding(false)
    setForm(emptyWeek())
  }

  const latestWeight = weekly.length ? weekly[weekly.length - 1].weight : null
  const totalLost    = latestWeight ? (BODY_STATS.startWeight - parseFloat(latestWeight)).toFixed(1) : null
  const toGoal       = latestWeight ? (parseFloat(latestWeight) - BODY_STATS.goalWeight).toFixed(1) : null

  return (
    <div>
      <div className="flex-between mb-16">
        <div>
          <h2>Weekly Progress</h2>
          {latestWeight && <p className="text-sm text-muted mt-4">Lost <strong className="text-green">{totalLost} lbs</strong> so far · <strong className="text-amber">{toGoal} lbs</strong> to goal</p>}
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setAdding(!adding)}>{adding ? 'Cancel' : '+ Log Week'}</button>
      </div>

      {adding && (
        <div className="card mb-24" style={{ borderTop: '3px solid var(--pink)' }}>
          <div className="card-header" style={{ background: 'var(--pink-light)' }}><h3>Week {weekly.length + 1} Entry</h3></div>
          <div className="card-body">
            <form onSubmit={save}>
              <div className="form-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                <div className="form-group"><label>Weight (lbs)</label><input type="number" step="0.1" placeholder="146.0" value={form.weight} onChange={e => setForm({ ...form, weight: e.target.value })} /></div>
                <div className="form-group"><label>Body Fat %</label><input type="number" step="0.1" placeholder="41.0" value={form.bf} onChange={e => setForm({ ...form, bf: e.target.value })} /></div>
                <div className="form-group"><label>Muscle (lbs)</label><input type="number" step="0.1" placeholder="47.0" value={form.muscle} onChange={e => setForm({ ...form, muscle: e.target.value })} /></div>
                <div className="form-group"><label>Waist (in)</label><input type="number" step="0.25" placeholder="30.5" value={form.waist} onChange={e => setForm({ ...form, waist: e.target.value })} /></div>
                <div className="form-group"><label>Hips (in)</label><input type="number" step="0.25" placeholder="38.0" value={form.hips} onChange={e => setForm({ ...form, hips: e.target.value })} /></div>
                <div className="form-group"><label>Thigh (in)</label><input type="number" step="0.25" placeholder="22.5" value={form.thigh} onChange={e => setForm({ ...form, thigh: e.target.value })} /></div>
                <div className="form-group"><label>Energy (1–10)</label><input type="number" min="1" max="10" placeholder="7" value={form.energy} onChange={e => setForm({ ...form, energy: e.target.value })} /></div>
                <div className="form-group"><label>Sleep (hrs avg)</label><input type="number" step="0.5" placeholder="6.5" value={form.sleep} onChange={e => setForm({ ...form, sleep: e.target.value })} /></div>
              </div>
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
                <div className="form-group"><label>Wins 🏆</label><textarea placeholder="New PR, stuck to meal plan, feeling stronger..." value={form.wins} onChange={e => setForm({ ...form, wins: e.target.value })} style={{ minHeight: 60 }} /></div>
                <div className="form-group"><label>Notes</label><textarea placeholder="Energy, soreness, mindset..." value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} style={{ minHeight: 60 }} /></div>
              </div>
              <button type="submit" className="btn btn-primary btn-sm">Save Week {weekly.length + 1}</button>
            </form>
          </div>
        </div>
      )}

      {/* Summary table */}
      {weekly.length > 0 && (
        <div className="card mb-24">
          <div className="card-header"><h3>Progress Log</h3></div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Week</th><th>Date</th><th className="text-right">Weight</th><th className="text-right">Body Fat</th>
                  <th className="text-right">Waist</th><th className="text-right">Hips</th><th className="text-right">Energy</th><th></th>
                </tr>
              </thead>
              <tbody>
                {[...weekly].reverse().map((w, i, arr) => {
                  const prev  = arr[i + 1]
                  const diff  = prev && w.weight && prev.weight ? (parseFloat(w.weight) - parseFloat(prev.weight)).toFixed(1) : null
                  return (
                    <tr key={w.id}>
                      <td className="bold">Week {w.week}</td>
                      <td className="text-muted text-sm">{formatDate(w.date)}</td>
                      <td className="text-right bold">
                        {w.weight ? `${w.weight} lb` : '—'}
                        {diff && <span style={{ fontSize: '0.75rem', color: parseFloat(diff) < 0 ? 'var(--green)' : 'var(--red)', marginLeft: 6 }}>{parseFloat(diff) > 0 ? '+' : ''}{diff}</span>}
                      </td>
                      <td className="text-right">{w.bf ? `${w.bf}%` : '—'}</td>
                      <td className="text-right">{w.waist ? `${w.waist}"` : '—'}</td>
                      <td className="text-right">{w.hips  ? `${w.hips}"` : '—'}</td>
                      <td className="text-right">{w.energy ? `${w.energy}/10` : '—'}</td>
                      <td><button className="btn btn-sm btn-danger" onClick={() => setWeekly(weekly.filter(x => x.id !== w.id))}>×</button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Progress bar toward goal */}
      {latestWeight && (
        <div className="card">
          <div className="card-header"><h3>Journey to Goal</h3></div>
          <div className="card-body">
            <div className="flex-between text-sm mb-8">
              <span>Start: <strong>148.8 lb</strong></span>
              <span style={{ color: 'var(--pink-text)', fontWeight: 'bold' }}>Current: {latestWeight} lb</span>
              <span>Goal: <strong className="text-green">130 lb</strong></span>
            </div>
            <div className="progress-bar" style={{ height: 10 }}>
              <div className="progress-fill" style={{ width: `${Math.min(100, (parseFloat(totalLost) / 18.8) * 100)}%`, background: 'linear-gradient(90deg, var(--pink), var(--green))' }} />
            </div>
            <div className="text-xs text-muted mt-8 text-right">{totalLost} of 18.8 lbs lost ({((parseFloat(totalLost) / 18.8) * 100).toFixed(0)}%)</div>
          </div>
        </div>
      )}

      {weekly.length === 0 && !adding && (
        <div className="empty-state">
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>📊</div>
          <p>Log your first week to start tracking progress!</p>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Tips ────────────────────────────────────────────────────────────────
function TipsTab() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
      {TIPS.map((tip, i) => (
        <div key={i} className="card" style={{ borderTop: '3px solid var(--pink-border)' }}>
          <div className="card-body">
            <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>{tip.icon}</div>
            <div style={{ fontWeight: 'bold', fontSize: '0.95rem', marginBottom: 8, color: 'var(--pink-text)' }}>{tip.title}</div>
            <p className="text-sm text-muted" style={{ lineHeight: 1.75 }}>{tip.body}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Fitness() {
  const [logs,   setLogs]   = useLocalStorage('fitness_logs',   {})
  const [weekly, setWeekly] = useLocalStorage('fitness_weekly', [])
  const [tab,    setTab]    = useState('daily')

  const TABS = [
    { id: 'overview', label: '🎯 Overview'      },
    { id: 'plan',     label: '🏋️ Workout Plan'  },
    { id: 'daily',    label: '📅 Daily Log'      },
    { id: 'weekly',   label: '📊 Weekly Stats'   },
    { id: 'tips',     label: '💡 Tips'            },
  ]

  return (
    <div>
      <div className="page-header">
        <h1>Health &amp; Fitness 🌸</h1>
        <p>Postpartum transformation — Strong, Toned &amp; Confident · 6–8 week plan</p>
      </div>
      <div className="tabs">
        {TABS.map(t => <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'plan'     && <WorkoutPlanTab />}
      {tab === 'daily'    && <DailyLogTab logs={logs} setLogs={setLogs} />}
      {tab === 'weekly'   && <WeeklyStatsTab weekly={weekly} setWeekly={setWeekly} />}
      {tab === 'tips'     && <TipsTab />}
    </div>
  )
}
