// Meal plan + grocery list from the active plan. Edits save to the plan in place.
import { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useFitnessPlan } from './plan.js'
import { MealsEditor, TargetsEditor } from './PlanEditor.jsx'

export default function MealPlanTab({ goToTab }) {
  const { plan, editPlan } = useFitnessPlan()
  const [checked, setChecked] = useLocalStorage('fitness_grocery', {})
  const [editing, setEditing] = useState(false)
  const n = plan.nutrition
  const got = (checked && checked.plan === plan.id && checked.items) || {}
  const toggle = item => setChecked({ plan: plan.id, items: { ...got, [item]: !got[item] } })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div className="card-header"><h3>Daily targets</h3><button className="btn btn-sm" onClick={() => setEditing(v => !v)}>{editing ? 'Done' : 'Edit'}</button></div>
        <div className="card-body">
          <TargetsEditor targets={plan.targets} onChange={editing ? targets => editPlan({ targets }) : null} />
          {plan.targets_why && <div className="text-xs text-muted" style={{ marginTop: 8 }}>{plan.targets_why}</div>}
        </div>
      </div>

      {!n && (
        <div className="card"><div className="card-body empty-state">
          <p>No meal plan yet. Your current plan only has macro targets.</p>
          <button className="btn btn-primary btn-sm" onClick={() => goToTab('coach')}>Ask the AI Coach for a meal plan</button>
        </div></div>
      )}

      {n && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
          <div className="card">
            <div className="card-header"><h3>Meals</h3><span className="text-xs text-muted">pick one option per meal</span></div>
            <div className="card-body" style={{ fontSize: '0.86rem', lineHeight: 1.6 }}>
              {n.strategy && <p className="text-muted" style={{ marginTop: 0 }}>{n.strategy}</p>}
              {editing ? <MealsEditor nutrition={n} onChange={nutrition => editPlan({ nutrition })} /> : (n.meals || []).map((m, i) => (
                <div key={i} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 'bold' }}>{m.meal}</div>
                  {(m.options || []).map((o, j) => (
                    <div key={j} style={{ padding: '8px 10px', background: 'var(--surface-hover)', borderRadius: 6, marginTop: 4 }}>
                      <div className="flex-between" style={{ gap: 8 }}><span>{o.name}</span><span className="text-xs text-muted" style={{ whiteSpace: 'nowrap' }}>{o.cal} cal · {o.protein}P</span></div>
                      {o.portions && <div className="text-xs text-muted">{o.portions}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div className="card">
            <div className="card-header"><h3>Grocery list</h3><button className="btn btn-sm" onClick={() => setChecked({ plan: plan.id, items: {} })}>Reset</button></div>
            <div className="card-body" style={{ fontSize: '0.86rem' }}>
              {(n.grocery || []).map((g, i) => (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{g.section}</div>
                  {(g.items || []).filter(Boolean).map(item => (
                    <label key={item} style={{ display: 'flex', gap: 8, padding: '3px 0', cursor: 'pointer', textDecoration: got[item] ? 'line-through' : 'none', color: got[item] ? 'var(--text-muted)' : undefined }}>
                      <input type="checkbox" checked={!!got[item]} onChange={() => toggle(item)} /> {item}
                    </label>
                  ))}
                </div>
              ))}
              {n.prep && <div className="text-sm" style={{ marginTop: 8 }}><strong>Weekly prep: </strong>{n.prep}</div>}
            </div>
          </div>
        </div>
      )}
      <div className="text-xs text-muted">General nutrition guidance, not medical advice — talk to your doctor or a registered dietitian about medical or dietary needs.</div>
    </div>
  )
}
