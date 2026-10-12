// ─── AI Coach tab ────────────────────────────────────────────────────────────
// Talk → review → answer questions → proposal → edit → approve.
// Approving replaces the plan (the old one goes to history) and updates the calendar.
import { useEffect, useMemo, useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage.js'
import { useCeo } from '../ceo/CeoStore.jsx'
import { occursOn, toMin, addDays, fmtDate } from '../ceo/recurrence.js'
import { toast } from '../ceo/ui.jsx'
import { today, uid } from '../utils/formatters.js'
import { DOW, WEEK_ORDER, trainingDays, useFitnessPlan, useFitnessProfile, progressBetween, weighIns, latestMeasurements, addDaysISO } from './plan.js'
import { reviewPlan, buildPlan } from './coach.js'
import { DaysEditor, TargetsEditor, MealsEditor } from './PlanEditor.jsx'

const EXAMPLES = [
  'My goal is now body recomposition with an emphasis on glute growth. Review my current plan and create an updated workout and nutrition strategy.',
  'Check in: here is my progress since the last plan — what should I adjust?',
  'I can only train 3 days a week right now. Rework my split.',
  "Swap out exercises I don't like and keep everything else.",
]

const CHECK = { display: 'flex', gap: 6, textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem', fontWeight: 'normal', color: 'var(--text)' }

const DISCLAIMER = 'General fitness and nutrition guidance — not medical advice. Check with your doctor, a registered dietitian or a pelvic-floor physical therapist about anything health-related, postpartum symptoms, pain or injuries.'

// Cleared drafts are stored as EMPTY, not null — null never syncs, so an old draft would come back from the cloud
const EMPTY = { message: '', review: null, answers: {}, proposal: null }

const strip = plan => {
  if (!plan) return null
  const { snapshot, ...rest } = plan
  return { ...rest, days: Object.fromEntries(WEEK_ORDER.map(i => { const d = plan.days?.[i] || {}; return [DOW[i], { name: d.name, rest: !!d.rest, exercises: (d.exercises || []).map(e => `${e.name} — ${e.sets}`) }] })) }
}

/** Weekly calendar blocks, one line each — so the coach can fit training around real life */
function scheduleLines(blocks) {
  const t = today()
  return blocks.filter(b => b.kind === 'block' && b.recurrence?.freq === 'weekly' && !b.all_day && (!b.until_date || b.until_date >= t))
    .map(b => `${(b.recurrence.byDay || []).map(d => DOW[d].slice(0, 3)).join('/')} ${b.start_time}–${b.end_time} ${b.title}`)
}

function nextDateFor(dow, from = addDaysISO(today(), 1)) {
  for (let i = 0; i < 7; i++) { const d = addDaysISO(from, i); if (new Date(d + 'T00:00:00').getDay() === dow) return d }
  return from
}

export default function CoachTab({ logs, weekly, setWeekly, goToTab }) {
  const { plan, history, replacePlan } = useFitnessPlan()
  const [profile, setProfile] = useFitnessProfile()
  const { blocks, saveBlock, splitBlock, saveTask } = useCeo()
  const [draft, setDraft] = useLocalStorage('fitness_coach_draft', null)
  const [busy, setBusy] = useState(null)
  const [secs, setSecs] = useState(0)
  const [showDetails, setShowDetails] = useState(!profile.goal)
  useEffect(() => { if (!busy) return; setSecs(0); const t = setInterval(() => setSecs(s => s + 1), 1000); return () => clearInterval(t) }, [busy])

  const d = draft && typeof draft.message === 'string' ? draft : EMPTY
  const patchDraft = p => setDraft(prev => ({ ...(prev && typeof prev.message === 'string' ? prev : EMPTY), ...p }))

  const gym = useMemo(() => blocks.filter(b => b.category === 'fitness' && b.kind === 'block' && b.recurrence?.freq === 'weekly' && /gym|workout|train/i.test(b.title) && (!b.until_date || b.until_date >= today()))
    .sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''))[0] || null, [blocks])

  // First visit: pre-fill available days from the gym block
  useEffect(() => { if (gym && !profile.days?.length) setProfile({ days: gym.recurrence.byDay || [] }) }, [gym]) // eslint-disable-line react-hooks/exhaustive-deps

  const sincePlan = progressBetween({ logs, weekly, plan, from: plan.approved_at || '2026-01-01' })
  const last4 = progressBetween({ logs, weekly, plan, from: addDaysISO(today(), -28) })
  const checkinDue = addDaysISO(plan.approved_at || today(), (plan.checkin_weeks || 4) * 7) <= today()
  const latest = latestMeasurements(weekly)
  const weights = weighIns(logs, weekly)

  function context() {
    return {
      today: today(), message: d.message, answers: d.review?.questions?.map(q => ({ question: q.question, answer: d.answers?.[q.id] || '' })).filter(a => a.answer) || [],
      profile: { ...profile, days: (profile.days || []).map(x => DOW[x]) },
      current_plan: strip(plan), plan_started: plan.approved_at,
      progress_since_plan_started: sincePlan, progress_last_4_weeks: last4,
      recent_weigh_ins: weights.slice(-12), latest_measurements_inches: latest,
      weekly_calendar: scheduleLines(blocks),
      previous_plans: history.slice(0, 3).map(h => ({ name: h.name, goal: h.goal, from: h.approved_at, to: h.archived_at, targets: h.targets, result: h.snapshot })),
    }
  }

  async function runReview() {
    if (!d.message.trim()) { toast('Tell the coach what you want first', 'Pick an example or type your own'); return }
    setBusy('review')
    try { const review = await reviewPlan(context()); patchDraft({ review, proposal: null, answers: {} }) }
    catch (e) { toast('Coach could not answer', e.message) }
    setBusy(null)
  }
  async function runBuild() {
    setBusy('build')
    try { const proposal = await buildPlan(context(), n => setBusy(`build${n}`)); patchDraft({ proposal, base_plan_id: plan.id }) }
    catch (e) { toast('Coach could not build the plan', e.message) }
    setBusy(null)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 20 }} className="coach-grid">
      <style>{'@media (max-width: 900px) { .coach-grid { grid-template-columns: minmax(0,1fr) !important; } }'}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        {checkinDue && !d.proposal && (
          <div className="card" style={{ borderLeft: '3px solid #1c9fd0' }}>
            <div className="card-body flex-between" style={{ gap: 12, flexWrap: 'wrap' }}>
              <div><strong>Time for a check-in.</strong> <span className="text-sm text-muted">Your plan started {fmtDate(plan.approved_at)}. Log your weight and measurements, then ask the coach what to adjust.</span></div>
              <button className="btn btn-sm" onClick={() => patchDraft({ message: EXAMPLES[1], review: null, proposal: null })}>Start check-in</button>
            </div>
          </div>
        )}

        {/* ── Ask ── */}
        {!d.proposal && (
          <div className="card">
            <div className="card-header"><h3>Talk to your coach</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <textarea rows={3} value={d.message} placeholder="What's changed? What do you want from your plan now?" onChange={e => patchDraft({ message: e.target.value })} style={{ width: '100%', fontSize: '0.88rem', padding: 10 }} />
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {EXAMPLES.map(x => <button key={x} className="btn btn-sm" style={{ fontSize: '0.7rem', textAlign: 'left' }} onClick={() => patchDraft({ message: x, review: null })}>{x.length > 60 ? x.slice(0, 58) + '…' : x}</button>)}
              </div>
              <div className="flex-between" style={{ gap: 8, flexWrap: 'wrap' }}>
                <span className="text-xs text-muted">The coach reads your plan, weigh-ins, measurements, logs and calendar.</span>
                <button className="btn btn-primary" disabled={!!busy} onClick={runReview}>{busy === 'review' ? `Reviewing… ${secs}s` : d.review ? 'Review again' : 'Review my plan'}</button>
              </div>
            </div>
          </div>
        )}

        {/* ── Review + questions ── */}
        {d.review && !d.proposal && (
          <div className="card">
            <div className="card-header"><h3>Coach review</h3></div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: '0.88rem', lineHeight: 1.6 }}>
              <div>{(d.review.assessment || []).map((a, i) => <div key={i}>• {a}</div>)}</div>
              {d.review.direction && <div style={{ padding: 10, background: 'var(--surface-hover)', borderRadius: 8 }}><strong>Direction: </strong>{d.review.direction}</div>}
              {d.review.safety?.length > 0 && <div className="text-amber text-sm">{d.review.safety.map((s, i) => <div key={i}>⚠ {s}</div>)}</div>}
              {d.review.questions?.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontWeight: 'bold' }}>A few questions first <span className="text-muted text-xs" style={{ fontWeight: 'normal' }}>(skip any you like)</span></div>
                  {d.review.questions.map(q => (
                    <div key={q.id} className="form-group" style={{ margin: 0 }}>
                      <label style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.85rem' }}>{q.question}</label>
                      {q.why && <div className="text-xs text-muted" style={{ marginBottom: 4 }}>{q.why}</div>}
                      <input value={d.answers?.[q.id] || ''} onChange={e => patchDraft({ answers: { ...(d.answers || {}), [q.id]: e.target.value } })} style={{ width: '100%' }} />
                    </div>
                  ))}
                </div>
              )}
              <div className="text-xs text-muted">Measurements or details to update? Use "Your details" and "Check-in" on the right — the coach reads them.</div>
              <div style={{ textAlign: 'right' }}>
                <button className="btn btn-primary" disabled={!!busy} onClick={runBuild}>{busy?.startsWith('build') ? `${busy === 'build2' ? 'Step 2 of 2: meals & groceries' : 'Step 1 of 2: training & targets'}… ${secs}s` : 'Build my updated plan'}</button>
                {busy?.startsWith('build') && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Usually 2–4 minutes in total — you can leave this tab open and do something else.</div>}
              </div>
            </div>
          </div>
        )}

        {d.proposal && <Proposal key={d.proposal.name + (d.base_plan_id || '')} draft={d} plan={plan} gym={gym} blocks={blocks}
          onChange={proposal => patchDraft({ proposal })} onDiscard={() => { if (window.confirm('Discard this proposal? Your current plan stays as it is.')) setDraft(EMPTY) }}
          onApprove={async (proposal, opts) => {
            const next = replacePlan({ ...proposal, source: 'coach', request: d.message }, { snapshot: sincePlan, label: 'Replaced by coach plan' })
            await applyCalendar({ plan: next, opts, gym, blocks, saveBlock, splitBlock, saveTask })
            setDraft(EMPTY)
            toast('New plan is live', 'Your old plan is saved in History.')
            setTimeout(() => goToTab('plan'), 50)   // let the cleared draft save before this tab unmounts
          }} />}

        <div className="text-xs text-muted" style={{ lineHeight: 1.6 }}>{DISCLAIMER}</div>
      </div>

      {/* ── Right column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
        <div className="card">
          <div className="card-header"><h3>Current plan</h3><span className="text-xs text-muted">v{plan.version || 1}</span></div>
          <div className="card-body text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontWeight: 'bold' }}>{plan.name}</div>
            <div className="text-muted">{plan.goal}</div>
            <div>Since {fmtDate(plan.approved_at)} · {trainingDays(plan).map(i => DOW[i].slice(0, 3)).join(', ') || 'no training days'}</div>
            <div>{plan.targets?.cal} cal · {plan.targets?.protein}P / {plan.targets?.carbs}C / {plan.targets?.fat}F</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              <button className="btn btn-sm" onClick={() => goToTab('plan')}>Edit plan</button>
              <button className="btn btn-sm" onClick={() => goToTab('history')}>History ({history.length})</button>
            </div>
          </div>
        </div>

        <ProgressCard p={sincePlan} label="Since this plan started" targets={plan.targets} />

        <CheckInCard weekly={weekly} setWeekly={setWeekly} latest={latest} />

        <div className="card">
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setShowDetails(v => !v)}><h3>Your details</h3><span className="text-xs text-muted">{showDetails ? 'Hide' : 'Edit'}</span></div>
          {showDetails && <ProfileForm profile={profile} setProfile={setProfile} gym={gym} />}
          {!showDetails && <div className="card-body text-xs text-muted">{profile.goal || 'No goal set yet.'} {profile.days?.length ? `· ${profile.days.length} days/week` : ''}</div>}
        </div>
      </div>
    </div>
  )
}

function ProgressCard({ p, label, targets }) {
  const row = (k, v) => v === null || v === undefined ? null : <div className="flex-between"><span className="text-muted">{k}</span><span>{v}</span></div>
  const sign = v => (v > 0 ? `+${v}` : `${v}`)
  return (
    <div className="card">
      <div className="card-header"><h3>Progress</h3><span className="text-xs text-muted">{label}</span></div>
      <div className="card-body text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {row('Weight', p.weight_change !== null ? `${p.weight_start} → ${p.weight_end} lb (${sign(p.weight_change)})` : 'log a weigh-in')}
        {row('Waist', p.waist_change !== null ? `${sign(p.waist_change)} in` : null)}
        {row('Hips', p.hips_change !== null ? `${sign(p.hips_change)} in` : null)}
        {row('Thigh', p.thigh_change !== null ? `${sign(p.thigh_change)} in` : null)}
        {row('Workouts logged', `${p.workouts_logged}${p.workouts_planned ? ` of ~${p.workouts_planned}` : ''}`)}
        {row('Avg calories', p.avg_calories !== null ? `${p.avg_calories} / ${targets?.cal} (${p.days_food_logged} days logged)` : null)}
        {row('Avg protein', p.avg_protein !== null ? `${p.avg_protein} / ${targets?.protein} g` : null)}
      </div>
    </div>
  )
}

function CheckInCard({ weekly, setWeekly, latest }) {
  const blank = { weight: '', waist: '', hips: '', thigh: '', bf: '' }
  const [f, setF] = useState(blank)
  function save() {
    if (!Object.values(f).some(v => parseFloat(v) > 0)) return
    const list = Array.isArray(weekly) ? weekly : []
    setWeekly([...list, { id: uid(), week: list.length + 1, date: today(), muscle: '', energy: '', sleep: '', wins: '', notes: 'Coach check-in', ...f }])
    setF(blank); toast('Check-in saved', 'Added to Weekly Stats')
  }
  return (
    <div className="card">
      <div className="card-header"><h3>Check-in</h3>{latest?.date && <span className="text-xs text-muted">last {fmtDate(latest.date)}</span>}</div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6 }}>
        {[['weight', 'Weight'], ['waist', 'Waist'], ['hips', 'Hips'], ['thigh', 'Thigh'], ['bf', 'BF %']].map(([k, l]) => (
          <div key={k} className="form-group" style={{ margin: 0 }}>
            <label style={{ fontSize: '0.6rem' }}>{l}</label>
            <input type="number" step="0.1" value={f[k]} placeholder={latest?.[k] || ''} onChange={e => setF({ ...f, [k]: e.target.value })} style={{ width: '100%', fontSize: '0.8rem', padding: '5px 6px' }} />
          </div>
        ))}
        <button className="btn btn-sm btn-primary" style={{ gridColumn: '1 / -1' }} onClick={save}>Save check-in</button>
      </div>
    </div>
  )
}

function Field({ profile, setProfile, k, label, ph, rows }) {
  return (
    <div className="form-group" style={{ margin: 0 }}>
      <label>{label}</label>
      {rows ? <textarea rows={rows} defaultValue={profile[k]} placeholder={ph} onBlur={e => setProfile({ [k]: e.target.value })} style={{ width: '100%', fontSize: '0.82rem' }} />
        : <input defaultValue={profile[k]} placeholder={ph} onBlur={e => setProfile({ [k]: e.target.value })} style={{ width: '100%', fontSize: '0.82rem' }} />}
    </div>
  )
}

function ProfileForm({ profile, setProfile, gym }) {
  return (
    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Field profile={profile} setProfile={setProfile} k="goal" label="Current goal" ph="Body recomposition, glute growth, gain muscle, lose fat" rows={2} />
      <div className="form-group" style={{ margin: 0 }}>
        <label>Days I can train</label>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {WEEK_ORDER.map(i => {
            const on = (profile.days || []).includes(i)
            return <button key={i} className={`btn btn-sm${on ? ' btn-primary' : ''}`} onClick={() => setProfile({ days: on ? profile.days.filter(x => x !== i) : [...(profile.days || []), i].sort() })}>{DOW[i].slice(0, 3)}</button>
          })}
        </div>
        {gym && <div className="text-xs text-muted" style={{ marginTop: 4 }}>Calendar: {gym.title} {(gym.recurrence.byDay || []).map(x => DOW[x].slice(0, 3)).join('/')} {gym.start_time}–{gym.end_time}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <Field profile={profile} setProfile={setProfile} k="session_minutes" label="Minutes per session" ph="60" />
        <Field profile={profile} setProfile={setProfile} k="meals_per_day" label="Meals + snacks / day" ph="4" />
        <Field profile={profile} setProfile={setProfile} k="height" label="Height" ph={'5\'5"'} />
        <Field profile={profile} setProfile={setProfile} k="age" label="Age" ph="" />
      </div>
      <div className="form-group" style={{ margin: 0 }}>
        <label>Breastfeeding?</label>
        <select value={profile.breastfeeding} onChange={e => setProfile({ breastfeeding: e.target.value })} style={{ width: '100%' }}>
          <option value="">—</option><option>No</option><option>Yes</option>
        </select>
      </div>
      <Field profile={profile} setProfile={setProfile} k="equipment" label="Where / equipment" ph="Full gym with kids club" />
      <Field profile={profile} setProfile={setProfile} k="activity" label="Activity outside the gym" ph="Steps/day, stroller walks, on your feet at showings…" />
      <Field profile={profile} setProfile={setProfile} k="experience" label="Lifting experience" ph="Beginner / intermediate / advanced" />
      <Field profile={profile} setProfile={setProfile} k="health" label="Injuries, postpartum or health notes" ph="Anything the coach should work around" rows={2} />
      <Field profile={profile} setProfile={setProfile} k="foods_like" label="Foods I like" ph="" rows={2} />
      <Field profile={profile} setProfile={setProfile} k="foods_avoid" label="Foods I avoid / don't like" ph="" rows={2} />
      <Field profile={profile} setProfile={setProfile} k="cooking" label="Cooking time & budget" ph="e.g. 1 prep session on Sunday, simple meals" />
    </div>
  )
}

// ─── Proposal review & approval ──────────────────────────────────────────────
function Proposal({ draft, plan, gym, blocks, onChange, onDiscard, onApprove }) {
  const p = draft.proposal
  const [tab, setTab] = useState('overview')
  const newDays = trainingDays(p)
  const oldDays = gym?.recurrence?.byDay || []
  const daysChange = gym && (newDays.length !== oldDays.length || newDays.some(x => !oldDays.includes(x)))
  const hasPrep = blocks.some(b => /meal prep/i.test(b.title) && (!b.until_date || b.until_date >= today()))
  const [opts, setOpts] = useState({ gym: !!gym, prep: !hasPrep && !!p.nutrition, checkin: true })
  const [saving, setSaving] = useState(false)

  const conflicts = useMemo(() => {
    if (!gym || !daysChange) return []
    const s = toMin(gym.start_time), e = toMin(gym.end_time)
    return newDays.filter(x => !oldDays.includes(x)).flatMap(dow => {
      const date = nextDateFor(dow)
      return blocks.filter(b => b.id !== gym.id && b.kind === 'block' && !b.all_day && occursOn(b, date) && toMin(b.start_time) < e && toMin(b.end_time) > s)
        .map(b => `${DOW[dow].slice(0, 3)}: ${b.title} ${b.start_time}–${b.end_time}`)
    })
  }, [gym, daysChange, newDays.join(), blocks]) // eslint-disable-line react-hooks/exhaustive-deps

  const TABS = [['overview', 'Overview'], ['workouts', 'Workouts'], ['nutrition', 'Nutrition'], ['grocery', 'Grocery list']]
  return (
    <div className="card" style={{ borderTop: '3px solid #1c9fd0' }}>
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div><h3>Proposed: {p.name}</h3><div className="text-xs text-muted">{p.goal}</div></div>
        <span className="text-xs text-muted">Edit anything below, then approve</span>
      </div>
      <div className="tabs" style={{ padding: '0 16px' }}>
        {TABS.map(([k, l]) => <button key={k} className={`tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.86rem', lineHeight: 1.6 }}>
        {tab === 'overview' && <>
          {p.summary && <div>{p.summary}</div>}
          {p.changes?.length > 0 && <div><div style={{ fontWeight: 'bold' }}>What changes</div>{p.changes.map((c, i) => <div key={i}>• {c}</div>)}</div>}
          <div><div style={{ fontWeight: 'bold', marginBottom: 6 }}>Daily targets</div>
            <TargetsEditor targets={p.targets} before={plan.targets} onChange={targets => onChange({ ...p, targets })} />
            {p.targets_why && <div className="text-xs text-muted" style={{ marginTop: 6 }}>{p.targets_why}</div>}
          </div>
          {[['progression', 'Progression'], ['cardio', 'Cardio & steps'], ['recovery', 'Recovery']].map(([k, l]) => (
            <div key={k} className="form-group" style={{ margin: 0 }}><label>{l}</label>
              <textarea rows={3} value={p[k] || ''} onChange={e => onChange({ ...p, [k]: e.target.value })} style={{ width: '100%', fontSize: '0.82rem' }} /></div>
          ))}
          {p.safety?.length > 0 && <div className="text-amber text-sm">{p.safety.map((s, i) => <div key={i}>⚠ {s}</div>)}</div>}
        </>}
        {tab === 'workouts' && <DaysEditor plan={p} onChange={onChange} />}
        {tab === 'nutrition' && (p.nutrition ? <>
          <textarea rows={3} value={p.nutrition.strategy || ''} onChange={e => onChange({ ...p, nutrition: { ...p.nutrition, strategy: e.target.value } })} style={{ width: '100%', fontSize: '0.82rem' }} />
          <MealsEditor nutrition={p.nutrition} onChange={nutrition => onChange({ ...p, nutrition })} />
        </> : <div className="text-muted">No meal plan in this proposal.</div>)}
        {tab === 'grocery' && (p.nutrition?.grocery?.length ? <>
          {p.nutrition.grocery.map((g, gi) => (
            <div key={gi} className="form-group" style={{ margin: 0 }}><label>{g.section}</label>
              <textarea rows={Math.min(8, (g.items || []).length + 1)} value={(g.items || []).join('\n')} style={{ width: '100%', fontSize: '0.82rem' }}
                onChange={e => onChange({ ...p, nutrition: { ...p.nutrition, grocery: p.nutrition.grocery.map((x, i) => i !== gi ? x : { ...x, items: e.target.value.split('\n') }) } })} /></div>
          ))}
          {p.nutrition.prep && <div><strong>Weekly prep: </strong>{p.nutrition.prep}</div>}
        </> : <div className="text-muted">No grocery list in this proposal.</div>)}

        {/* ── Approve ── */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 'bold' }}>When you approve</div>
          <div className="text-sm">✓ This becomes your plan — Workout Plan, Daily Log checklists, macro targets and Meal Plan all switch to it.</div>
          <div className="text-sm">✓ Your current plan ({plan.name}, v{plan.version || 1}) and its results are saved in History.</div>
          {gym && <label className="text-sm" style={CHECK}><input type="checkbox" checked={opts.gym} onChange={e => setOpts({ ...opts, gym: e.target.checked })} />
            <span>{daysChange ? <>Move your <strong>{gym.title}</strong> block from {oldDays.map(x => DOW[x].slice(0, 3)).join('/')} to <strong>{newDays.map(x => DOW[x].slice(0, 3)).join('/')}</strong> starting tomorrow, and list each day's workout on it</> : <>Update your <strong>{gym.title}</strong> block with each day's workout</>}</span></label>}
          {opts.gym && conflicts.length > 0 && <div className="text-amber text-xs" style={{ paddingLeft: 22 }}>Overlaps on the new days: {conflicts.join(' · ')}. You can move the block in Calendar after approving.</div>}
          {!gym && newDays.length > 0 && <label className="text-sm" style={CHECK}><input type="checkbox" checked={!!opts.addGym} onChange={e => setOpts({ ...opts, addGym: e.target.checked })} /><span>Add a Workout block (8:00–9:15) on {newDays.map(x => DOW[x].slice(0, 3)).join('/')}</span></label>}
          {p.nutrition && !hasPrep && <label className="text-sm" style={CHECK}><input type="checkbox" checked={opts.prep} onChange={e => setOpts({ ...opts, prep: e.target.checked })} /><span>Add a weekly <strong>Meal Prep & Grocery</strong> block on Sunday with a checklist</span></label>}
          <label className="text-sm" style={CHECK}><input type="checkbox" checked={opts.checkin} onChange={e => setOpts({ ...opts, checkin: e.target.checked })} /><span>Remind me to check in with the coach in {p.checkin_weeks || 4} weeks</span></label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6, flexWrap: 'wrap' }}>
            <button className="btn" onClick={onDiscard}>Discard</button>
            <button className="btn btn-primary" disabled={saving} onClick={async () => { setSaving(true); try { await onApprove(p, opts) } finally { setSaving(false) } }}>{saving ? 'Saving…' : 'Approve & replace my plan'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Calendar + reminders after approval — only what was ticked */
async function applyCalendar({ plan, opts, gym, blocks, saveBlock, splitBlock, saveTask }) {
  const days = trainingDays(plan)
  const split = days.map(i => `${DOW[i].slice(0, 3)}: ${plan.days[i].name}`).join(' · ')
  const desc = `Today's workout is in Health & Fitness (${plan.name}). ${split}`
  const tomorrow = addDaysISO(today(), 1)
  if (opts.gym && gym) {
    const oldDays = gym.recurrence.byDay || []
    const same = days.length === oldDays.length && days.every(x => oldDays.includes(x))
    if (same || !days.length) await saveBlock({ ...gym, description: desc })
    else {
      await splitBlock(gym, tomorrow, { recurrence: { ...gym.recurrence, byDay: days }, description: desc })
      // The drive-home walk follows the gym days
      const follow = blocks.find(b => b.id !== gym.id && b.kind === 'block' && b.recurrence?.freq === 'weekly' && (!b.until_date || b.until_date >= today()) && b.start_time === gym.end_time
        && (b.recurrence.byDay || []).length === oldDays.length && (b.recurrence.byDay || []).every(x => oldDays.includes(x)))
      if (follow) await splitBlock(follow, tomorrow, { recurrence: { ...follow.recurrence, byDay: days } })
    }
  }
  if (opts.addGym && !gym && days.length) {
    await saveBlock({ id: uid(), title: 'Workout', category: 'fitness', kind: 'block', start_date: today(), until_date: null, all_day: false,
      start_time: '08:00', end_time: '09:15', recurrence: { freq: 'weekly', byDay: days }, description: desc, link: '/fitness', reminders: [15],
      checklist: ['Warm-up', "Today's workout (see Fitness)", 'Log it in Fitness'].map((text, i) => ({ id: `c${i + 1}`, text })) })
  }
  if (opts.prep) {
    const sunday = nextDateFor(0, today())
    const busyAt = blocks.filter(b => b.kind === 'block' && !b.all_day && occursOn(b, sunday)).map(b => [toMin(b.start_time), toMin(b.end_time)])
    const start = ['16:00', '14:00', '10:00', '13:00', '17:00'].find(t => { const s = toMin(t); return !busyAt.some(([a, z]) => a < s + 60 && z > s) }) || '16:00'
    const end = `${String(Number(start.slice(0, 2)) + 1).padStart(2, '0')}:00`
    await saveBlock({ id: uid(), title: 'Meal Prep & Grocery', category: 'fitness', kind: 'block', start_date: today(), until_date: null, all_day: false,
      start_time: start, end_time: end, recurrence: { freq: 'weekly', byDay: [0] }, link: '/fitness',
      description: `${plan.nutrition?.prep || 'Prep the week\'s proteins, carbs and snacks.'} Grocery list: Health & Fitness → Meal Plan.`,
      checklist: ['Check the grocery list (Fitness → Meal Plan)', 'Grocery run / pickup', 'Cook proteins', 'Prep carbs & veggies', 'Portion breakfasts & snacks'].map((text, i) => ({ id: `c${i + 1}`, text })) })
  }
  if (opts.checkin) {
    await saveTask({ title: `Fitness check-in: weigh in, measure, ask the coach (${plan.name})`, status: 'next', priority: 'medium',
      due_date: addDays(today(), (plan.checkin_weeks || 4) * 7), notes: 'Health & Fitness → AI Coach → Check-in, then "Start check-in".' })
  }
}
