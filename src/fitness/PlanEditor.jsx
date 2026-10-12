// Edit any plan — the active one or a coach proposal. Pure: (plan, onChange).
import { useState } from 'react'
import { DOW, WEEK_ORDER, planDay } from './plan.js'

const inp = { fontSize: '0.8rem', padding: '5px 8px', width: '100%' }

export function TargetsEditor({ targets = {}, onChange, before }) {
  const fields = [['cal', 'Calories', ''], ['protein', 'Protein', 'g'], ['carbs', 'Carbs', 'g'], ['fat', 'Fat', 'g']]
  const cals = (Number(targets.protein) || 0) * 4 + (Number(targets.carbs) || 0) * 4 + (Number(targets.fat) || 0) * 9
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
        {fields.map(([k, label, unit]) => (
          <div key={k} className="form-group" style={{ margin: 0 }}>
            <label>{label}{unit && ` (${unit})`}</label>
            <input type="number" value={targets[k] ?? ''} disabled={!onChange} onChange={e => onChange({ ...targets, [k]: e.target.value === '' ? '' : Number(e.target.value) })} style={inp} />
            {before && before[k] !== undefined && Number(before[k]) !== Number(targets[k]) && (
              <div className="text-xs text-muted" style={{ marginTop: 2 }}>was {before[k]}</div>
            )}
          </div>
        ))}
      </div>
      {targets.cal > 0 && Math.abs(cals - targets.cal) > targets.cal * 0.06 && (
        <div className="text-xs text-amber" style={{ marginTop: 6 }}>Macros add up to {Math.round(cals)} cal — {Math.round(cals - targets.cal) > 0 ? 'more' : 'less'} than the calorie target.</div>
      )}
    </div>
  )
}

export function DaysEditor({ plan, onChange }) {
  const [open, setOpen] = useState(null)
  const setDay = (i, patch) => onChange({ ...plan, days: { ...plan.days, [i]: { ...planDayRaw(plan, i), ...patch } } })
  const setEx = (i, n, patch) => { const ex = [...planDayRaw(plan, i).exercises]; ex[n] = { ...ex[n], ...patch }; setDay(i, { exercises: ex }) }
  const moveEx = (i, n, dir) => { const ex = [...planDayRaw(plan, i).exercises]; const m = n + dir; if (m < 0 || m >= ex.length) return; [ex[n], ex[m]] = [ex[m], ex[n]]; setDay(i, { exercises: ex }) }
  const swapDays = (a, b) => onChange({ ...plan, days: { ...plan.days, [a]: planDayRaw(plan, b), [b]: planDayRaw(plan, a) } })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {WEEK_ORDER.map(i => {
        const d = planDay(plan, i)
        const isOpen = open === i
        return (
          <div key={i} className="card" style={{ borderLeft: `3px solid ${d.rest ? 'var(--border)' : d.color}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: isOpen ? d.bg : undefined }} onClick={() => setOpen(isOpen ? null : i)}>
              <span style={{ fontSize: '1.2rem' }}>{d.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: d.color }}>{DOW[i]}</div>
                <div style={{ fontWeight: 'bold', fontSize: '0.88rem' }}>{d.name}{d.rest && <span className="text-muted" style={{ fontWeight: 'normal' }}> · rest</span>}</div>
              </div>
              <span className="text-xs text-muted">{d.exercises.length} ex</span>
              <span style={{ color: d.color, fontSize: '0.8rem' }}>{isOpen ? '▲' : '▼'}</span>
            </div>
            {isOpen && (
              <div style={{ padding: '10px 14px 14px', borderTop: `1px solid ${d.border}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr auto', gap: 6, alignItems: 'center' }}>
                  <input value={d.emoji} onChange={e => setDay(i, { emoji: e.target.value })} style={inp} aria-label="Emoji" />
                  <input value={d.name} onChange={e => setDay(i, { name: e.target.value })} style={inp} aria-label="Day name" />
                  <label className="text-xs" style={{ display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={!!d.rest} onChange={e => setDay(i, { rest: e.target.checked })} /> Rest day
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <span className="text-xs text-muted" style={{ alignSelf: 'center' }}>Swap with:</span>
                  {WEEK_ORDER.filter(j => j !== i).map(j => <button key={j} className="btn btn-sm" onClick={() => swapDays(i, j)}>{DOW[j].slice(0, 3)}</button>)}
                </div>
                <textarea rows={2} placeholder="Warm-up" value={d.warmup || ''} onChange={e => setDay(i, { warmup: e.target.value })} style={inp} />
                {d.exercises.map((ex, n) => (
                  <div key={n} style={{ padding: 8, background: 'var(--surface-hover)', borderRadius: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px auto', gap: 6 }}>
                      <input value={ex.name} onChange={e => setEx(i, n, { name: e.target.value })} style={inp} aria-label="Exercise" />
                      <input value={ex.sets} onChange={e => setEx(i, n, { sets: e.target.value })} style={inp} aria-label="Sets × reps" />
                      <span style={{ display: 'flex', gap: 2 }}>
                        <button className="btn btn-sm" title="Move up" disabled={n === 0} onClick={() => moveEx(i, n, -1)}>↑</button>
                        <button className="btn btn-sm" title="Move down" disabled={n === d.exercises.length - 1} onClick={() => moveEx(i, n, 1)}>↓</button>
                        <button className="btn btn-sm btn-danger" title="Remove" onClick={() => setDay(i, { exercises: d.exercises.filter((_, m) => m !== n) })}>×</button>
                      </span>
                    </div>
                    <input value={ex.tip || ''} placeholder="Cue / notes" onChange={e => setEx(i, n, { tip: e.target.value })} style={inp} />
                    {ex.swap && (
                      <div className="text-xs text-muted">Swap option: {ex.swap} <button className="btn btn-sm" style={{ marginLeft: 6 }} onClick={() => setEx(i, n, { name: ex.swap, swap: ex.name })}>Use this instead</button></div>
                    )}
                  </div>
                ))}
                <button className="btn btn-sm" onClick={() => setDay(i, { exercises: [...d.exercises, { name: '', sets: '3 × 10–12', tip: '' }] })}>+ Add exercise</button>
                <textarea rows={2} placeholder="Cool-down / finisher" value={d.cooldown || ''} onChange={e => setDay(i, { cooldown: e.target.value })} style={inp} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function planDayRaw(plan, i) {
  const d = plan.days?.[i] || plan.days?.[String(i)] || { name: 'Rest', rest: true, exercises: [] }
  return { ...d, exercises: d.exercises || [] }
}

export function MealsEditor({ nutrition, onChange }) {
  if (!nutrition) return null
  const meals = nutrition.meals || []
  const setOpt = (m, o, patch) => onChange({ ...nutrition, meals: meals.map((x, mi) => mi !== m ? x : { ...x, options: x.options.map((y, oi) => oi !== o ? y : { ...y, ...patch }) }) })
  const dropOpt = (m, o) => onChange({ ...nutrition, meals: meals.map((x, mi) => mi !== m ? x : { ...x, options: x.options.filter((_, oi) => oi !== o) }) })
  const addOpt = m => onChange({ ...nutrition, meals: meals.map((x, mi) => mi !== m ? x : { ...x, options: [...x.options, { name: '', portions: '', cal: 0, protein: 0, carbs: 0, fat: 0 }] }) })
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {meals.map((m, mi) => (
        <div key={mi}>
          <div style={{ fontWeight: 'bold', fontSize: '0.85rem', marginBottom: 4 }}>{m.meal}</div>
          {(m.options || []).map((o, oi) => (
            <div key={oi} style={{ padding: 8, background: 'var(--surface-hover)', borderRadius: 6, marginBottom: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 6 }}>
                <input value={o.name} placeholder="Meal" onChange={e => setOpt(mi, oi, { name: e.target.value })} style={inp} />
                <button className="btn btn-sm btn-danger" onClick={() => dropOpt(mi, oi)}>×</button>
              </div>
              <textarea rows={2} value={o.portions || ''} placeholder="Portions" onChange={e => setOpt(mi, oi, { portions: e.target.value })} style={inp} />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 4 }}>
                {['cal', 'protein', 'carbs', 'fat'].map(k => (
                  <input key={k} type="number" value={o[k] ?? ''} title={k} placeholder={k} onChange={e => setOpt(mi, oi, { [k]: Number(e.target.value) || 0 })} style={inp} />
                ))}
              </div>
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => addOpt(mi)}>+ Option</button>
        </div>
      ))}
    </div>
  )
}
