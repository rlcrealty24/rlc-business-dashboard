import { useState, useEffect, useCallback } from 'react'
import { PHASES, MOODS, STUDY_DAYS, STUDY_META, FUTURE_STUDIES, PRAYER_CATEGORIES, getPhase, getDay } from '../data/bibleStudyData.js'

// ─── localStorage helpers ────────────────────────────────────────────────────
function loadLS(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback }
  catch { return fallback }
}
function saveLS(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

const DEFAULT_PROGRESS = {
  currentDay: 1,
  completed: [],     // array of day numbers
  streak: 0,
  lastDate: null,    // 'YYYY-MM-DD'
  startDate: new Date().toISOString().slice(0, 10),
}
const DEFAULT_JOURNAL  = {}   // { [day]: { mood, prompts:{[idx]:text}, gratitude, release, endReflection } }
const DEFAULT_FAVS     = { scriptures: [], prayers: [] }
const DEFAULT_PRAYERS  = []  // [{ id, date, category, title, prayer, answered, answeredDate, answeredNote }]

// ─── Colour helpers ──────────────────────────────────────────────────────────
const PHASE_COLORS = {
  1: { main: '#b06858', light: '#fdf0ed', border: '#e8c4bb', dark: '#8c5042' },
  2: { main: '#6a9669', light: '#f0f5ef', border: '#b8d4b7', dark: '#4e7a4e' },
  3: { main: '#b08055', light: '#fdf6ec', border: '#e5c99a', dark: '#8c6040' },
  4: { main: '#5e87b5', light: '#eff4fa', border: '#b0c9e5', dark: '#3d6a99' },
}
function pc(phaseId) { return PHASE_COLORS[phaseId] || PHASE_COLORS[1] }

// Today's YYYY-MM-DD string
function today() { return new Date().toISOString().slice(0, 10) }

// Compute streak: returns updated streak + lastDate
function computeStreak(prev) {
  const td = today()
  if (prev.lastDate === td) return { streak: prev.streak, lastDate: td }
  const yest = new Date(); yest.setDate(yest.getDate() - 1)
  const yesterdayStr = yest.toISOString().slice(0, 10)
  if (prev.lastDate === yesterdayStr) return { streak: (prev.streak || 0) + 1, lastDate: td }
  return { streak: 1, lastDate: td }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange, color }) {
  return (
    <div style={{
      display: 'flex', overflowX: 'auto', borderBottom: '1px solid #ede4da',
      scrollbarWidth: 'none', msOverflowStyle: 'none',
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          flexShrink: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          padding: '10px 16px 12px', border: 'none',
          borderBottom: `2px solid ${active === t.id ? color : 'transparent'}`,
          cursor: 'pointer', fontSize: '0.6rem', fontWeight: active === t.id ? 700 : 400,
          background: 'transparent',
          color: active === t.id ? color : '#c4b4a8',
          transition: 'all 0.2s', letterSpacing: '0.08em', textTransform: 'uppercase',
          marginBottom: '-1px', whiteSpace: 'nowrap',
        }}>
          <span style={{ fontSize: '1.05rem' }}>{t.icon}</span>
          {t.label}
        </button>
      ))}
    </div>
  )
}

function ScriptureCard({ day, favs, onToggleFav }) {
  const phase = getPhase(day.day)
  const c = pc(day.phase)
  const isFaved = favs.scriptures.some(s => s.day === day.day)
  return (
    <div style={{
      background: c.light, border: `1px solid ${c.border}`,
      borderRadius: 28, padding: '36px 28px 30px',
      position: 'relative', textAlign: 'center',
      boxShadow: '0 6px 32px rgba(0,0,0,0.07)',
    }}>
      {/* Decorative accent line */}
      <div style={{ width: 36, height: 2, background: c.main, borderRadius: 2, margin: '0 auto 20px' }} />
      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: c.main, letterSpacing: '0.14em',
        textTransform: 'uppercase', marginBottom: 20 }}>
        {phase.icon} {phase.name} · Day {day.day}
      </div>
      <blockquote style={{
        margin: '0 0 20px', fontFamily: 'Georgia, serif', fontSize: '1.18rem',
        lineHeight: 1.9, color: '#3a2c22', fontStyle: 'italic',
      }}>
        "{day.scripture}"
      </blockquote>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{
          fontSize: '0.82rem', color: c.dark, fontWeight: 600,
          fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: '0.02em',
        }}>
          — {day.scriptureRef}
        </div>
        <span style={{
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.1em',
          color: c.main, border: `1px solid ${c.border}`,
          borderRadius: 10, padding: '2px 7px', textTransform: 'uppercase',
          opacity: 0.8,
        }}>NIV</span>
      </div>
      <button onClick={() => onToggleFav('scripture', day)} style={{
        position: 'absolute', top: 18, right: 18,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '1.1rem', opacity: isFaved ? 1 : 0.28,
        transition: 'opacity 0.2s',
      }} title={isFaved ? 'Remove from saved' : 'Save scripture'}>
        🔖
      </button>
    </div>
  )
}

function PrayerCard({ title, text, type, dayNum, favs, onToggleFav, phaseId }) {
  const c = pc(phaseId)
  const isFaved = favs.prayers.some(p => p.day === dayNum && p.type === type)
  return (
    <div style={{
      background: type === 'morning' ? '#fefcf7' : '#f8f4fc',
      border: `1px solid ${c.border}`,
      borderRadius: 28, padding: '34px 26px 28px',
      position: 'relative', textAlign: 'center',
      boxShadow: '0 6px 32px rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '1.8rem', marginBottom: 6 }}>
        {type === 'morning' ? '☀️' : '🌙'}
      </div>
      <div style={{ fontSize: '0.62rem', fontWeight: 700, color: c.main,
        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 24 }}>
        {title}
      </div>
      <div style={{ textAlign: 'left' }}>
        {text.split('\n\n').map((para, i) => (
          <p key={i} style={{
            margin: '0 0 18px', fontFamily: 'Georgia, serif',
            fontSize: '1rem', lineHeight: 2.05, color: '#3a2c22',
            fontStyle: 'italic',
          }}>{para}</p>
        ))}
      </div>
      <button onClick={() => onToggleFav('prayer', { day: dayNum, type, text, title })} style={{
        position: 'absolute', top: 18, right: 18,
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: '1.1rem', opacity: isFaved ? 1 : 0.28,
        transition: 'opacity 0.2s',
      }} title={isFaved ? 'Remove from saved' : 'Save prayer'}>
        🔖
      </button>
    </div>
  )
}

function JournalTextArea({ value, onChange, placeholder, rows = 4 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '14px 16px', borderRadius: 16,
        border: '1px solid #ede4da', background: '#fefcf8',
        fontSize: '0.94rem', fontFamily: 'Georgia, serif', fontStyle: 'italic',
        lineHeight: 1.9, color: '#3a2c22', resize: 'vertical', outline: 'none',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onFocus={e => {
        e.target.style.borderColor = '#d4b8a0'
        e.target.style.boxShadow = '0 2px 14px rgba(0,0,0,0.06)'
      }}
      onBlur={e => {
        e.target.style.borderColor = '#ede4da'
        e.target.style.boxShadow = 'none'
      }}
    />
  )
}

// ─── Highlightable paragraph ─────────────────────────────────────────────────
// Tap the ✦ icon to highlight a passage; highlighted passages get a warm amber glow
function HighlightableParagraph({ text, paraIndex, section, dayNum, highlights, onToggle, pStyle }) {
  const isHighlighted = (highlights || []).includes(paraIndex)
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      background: isHighlighted ? 'rgba(253,240,186,0.55)' : 'transparent',
      borderLeft: `3px solid ${isHighlighted ? '#c9922a' : 'transparent'}`,
      borderRadius: '0 12px 12px 0',
      paddingLeft: isHighlighted ? 10 : 0,
      transition: 'all 0.25s',
      marginBottom: 18,
    }}>
      <p style={{ ...pStyle, margin: 0, flex: 1 }}>{text}</p>
      <button
        onClick={() => onToggle(dayNum, section, paraIndex)}
        title={isHighlighted ? 'Remove highlight' : 'Highlight this passage'}
        style={{
          flexShrink: 0, marginTop: 3,
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: '0.88rem', lineHeight: 1,
          color: isHighlighted ? '#c9922a' : '#d4c4b4',
          transition: 'color 0.2s', padding: '2px 2px',
        }}
      >✦</button>
    </div>
  )
}

// ─── Section notes panel ──────────────────────────────────────────────────────
// Collapsible notes area for Deep Dive and Devotional sections
function SectionNotesPanel({ dayNum, section, notes, onSaveNote, c }) {
  const [open, setOpen] = useState(false)
  const [localNote, setLocalNote] = useState(notes[dayNum]?.[section]?.notes || '')
  const hasNote = !!(notes[dayNum]?.[section]?.notes)

  // Sync value if day changes
  useEffect(() => {
    setLocalNote(notes[dayNum]?.[section]?.notes || '')
  }, [dayNum])

  const QUICK = [
    '💛 This spoke to me',
    '❓ I have a question',
    '🙏 I want to pray about this',
    '✨ I can apply this by…',
  ]

  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: open ? c.light : 'transparent',
          border: `1px solid ${c.border}`, borderRadius: 20,
          padding: '8px 18px', color: c.main,
          fontSize: '0.73rem', fontWeight: 600,
          cursor: 'pointer', transition: 'all 0.2s',
        }}
      >
        📝 {open ? 'Close Notes' : 'My Notes'}
        {!open && hasNote && <span style={{ color: '#c9922a', fontSize: '0.7rem' }}>✦</span>}
      </button>

      {open && (
        <div style={{
          marginTop: 12, background: '#fefdf7',
          border: `1px solid ${c.border}`, borderRadius: 20,
          padding: '18px 18px', boxShadow: '0 2px 14px rgba(0,0,0,0.05)',
        }}>
          <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
            letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12 }}>
            My Notes
          </div>
          {/* Quick-start chips */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {QUICK.map(q => (
              <button key={q}
                onClick={() => {
                  const updated = localNote ? localNote + '\n' + q + ': ' : q + ': '
                  setLocalNote(updated)
                  onSaveNote(dayNum, section, updated)
                }}
                style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                  border: `1px solid ${c.border}`,
                  background: c.light, color: c.dark,
                  fontSize: '0.68rem', fontWeight: 500,
                }}
              >{q}</button>
            ))}
          </div>
          <JournalTextArea
            value={localNote}
            onChange={v => { setLocalNote(v); onSaveNote(dayNum, section, v) }}
            placeholder="Write your thoughts, questions, or what God is speaking to you…"
            rows={4}
          />
          {localNote && (
            <div style={{ fontSize: '0.6rem', color: '#c4b4a8', marginTop: 6,
              textAlign: 'right', fontStyle: 'italic' }}>
              ✦ saved automatically ✦
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── TAB: HOME ───────────────────────────────────────────────────────────────
function HomeTab({ progress, journal, onNavigate }) {
  const c = progress.completed
  const pct = Math.round((c.length / 30) * 100)
  const todayDay = progress.currentDay
  const dayData = getDay(todayDay)
  const phase = getPhase(todayDay)
  const col = pc(dayData.phase)
  const completedToday = c.includes(todayDay)
  const [prayerOpen, setPrayerOpen] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* Day opening — soft editorial, no gradient */}
      <div style={{
        background: col.light, border: `1px solid ${col.border}`,
        borderRadius: 28, padding: '32px 26px 28px',
        boxShadow: '0 4px 28px rgba(0,0,0,0.06)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.6rem', color: col.main, fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 18,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <span>{phase.icon}</span> {phase.name} · Day {todayDay} of 30
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.4rem', fontStyle: 'italic',
          color: '#3a2c22', lineHeight: 1.55, marginBottom: 16 }}>
          {dayData.title}
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.85rem', fontStyle: 'italic',
          color: col.main, lineHeight: 1.5, marginBottom: 22 }}>
          {dayData.scriptureRef}
        </div>
        {/* Subtle progress — not the focus, just present */}
        <div style={{ maxWidth: 180, margin: '0 auto' }}>
          <div style={{ background: col.border, borderRadius: 4, height: 3 }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 4,
              background: col.main, transition: 'width 0.5s ease',
            }} />
          </div>
          <div style={{ fontSize: '0.65rem', color: col.main, marginTop: 7, opacity: 0.75, letterSpacing: '0.04em' }}>
            {c.length} of 30 days with you
            {progress.streak > 1 && <span style={{ marginLeft: 6 }}>· {progress.streak} days in a row 🌿</span>}
          </div>
        </div>
      </div>

      {/* Theme — quiet, italic, no box */}
      <div style={{ textAlign: 'center', padding: '0 8px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.98rem', color: '#9a8880',
          fontStyle: 'italic', lineHeight: 1.8 }}>
          "{dayData.theme}"
        </div>
      </div>

      {/* Word for today — centered, beautiful */}
      <div style={{
        background: '#fefcf9', border: '1px solid #ede4da',
        borderRadius: 22, padding: '24px 22px',
        boxShadow: '0 2px 18px rgba(0,0,0,0.05)', textAlign: 'center',
      }}>
        <div style={{ fontSize: '0.6rem', color: '#c4a090', fontWeight: 700,
          letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
          🌸 Word for Today
        </div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', color: '#3a2c22',
          fontStyle: 'italic', lineHeight: 1.9 }}>
          {dayData.encouragement}
        </div>
      </div>

      {/* Morning Prayer — soft invitation card */}
      <div style={{
        background: '#fefcf7', border: `1px solid ${col.border}`,
        borderRadius: 22, padding: '26px 22px',
        boxShadow: '0 2px 18px rgba(0,0,0,0.05)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>☀️</div>
          <div style={{ fontSize: '0.6rem', color: col.main, fontWeight: 700,
            letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>
            Morning Prayer
          </div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.88rem', color: '#9a8880',
            fontStyle: 'italic', lineHeight: 1.7 }}>
            Before the day begins — bring it all to Him.
          </div>
        </div>
        {/* Always show the first paragraph */}
        <p style={{
          fontFamily: 'Georgia, serif', fontSize: '0.95rem', color: '#3a2c22',
          fontStyle: 'italic', lineHeight: 2.05, margin: '0 0 14px',
        }}>
          {dayData.morningPrayer.split('\n\n')[0]}
        </p>
        {/* Rest of prayer — shown when expanded */}
        {prayerOpen && dayData.morningPrayer.split('\n\n').slice(1).map((para, i) => (
          <p key={i} style={{
            fontFamily: 'Georgia, serif', fontSize: '0.95rem', color: '#3a2c22',
            fontStyle: 'italic', lineHeight: 2.05, margin: '0 0 14px',
          }}>{para}</p>
        ))}
        <button
          onClick={() => setPrayerOpen(o => !o)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: col.main, fontSize: '0.73rem', fontWeight: 600,
            display: 'block', margin: '2px auto 0',
            letterSpacing: '0.08em', padding: '6px 0',
            fontFamily: 'Georgia, serif', fontStyle: 'italic',
          }}
        >
          {prayerOpen ? '↑ Close Prayer' : '✦ Read Full Prayer'}
        </button>
      </div>

      {/* Begin CTA — soft, editorial */}
      <button
        onClick={() => onNavigate('study')}
        style={{
          background: completedToday ? '#f4faf4' : col.light,
          color: completedToday ? '#558855' : col.dark,
          border: `1.5px solid ${completedToday ? '#c0dfc0' : col.border}`,
          borderRadius: 30, padding: '18px 32px', fontSize: '0.93rem', fontWeight: 700,
          cursor: 'pointer', letterSpacing: '0.04em', fontFamily: 'Georgia, serif',
          boxShadow: '0 3px 20px rgba(0,0,0,0.07)', transition: 'all 0.2s',
          display: 'block', width: '100%',
        }}
      >
        {completedToday ? '✓ Today Complete — Return & Reflect' : `Begin Day ${todayDay} — Enter the Study`}
      </button>

      {/* Journey overview — very subtle, slim bars */}
      <div>
        <div style={{ fontSize: '0.6rem', color: '#c4b4a8', fontWeight: 700,
          textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 14, textAlign: 'center' }}>
          Your Journey
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {PHASES.map(ph => {
            const pDays = Array.from({ length: ph.days[1] - ph.days[0] + 1 }, (_, i) => ph.days[0] + i)
            const pDone = pDays.filter(d => c.includes(d)).length
            const pPct = Math.round((pDone / pDays.length) * 100)
            const col2 = pc(ph.id)
            const isActive = todayDay >= ph.days[0] && todayDay <= ph.days[1]
            return (
              <div key={ph.id} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: isActive ? 1 : 0.5 }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{ph.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.7rem', color: isActive ? col2.dark : '#9a8880',
                      fontWeight: isActive ? 700 : 400 }}>{ph.name}</span>
                    <span style={{ fontSize: '0.65rem', color: '#b0a090' }}>{pDone}/{pDays.length}</span>
                  </div>
                  <div style={{ background: '#ede4da', borderRadius: 3, height: 3 }}>
                    <div style={{ width: `${pPct}%`, height: '100%', borderRadius: 3,
                      background: col2.main, transition: 'width 0.4s' }} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ─── TAB: DAILY STUDY ────────────────────────────────────────────────────────
function StudyTab({ progress, journal, onSaveJournal, onMarkComplete, onUpdateDay, favs, onToggleFav, notes, onSaveNote, onToggleHighlight }) {
  const dayNum = progress.currentDay
  const day = getDay(dayNum)
  const c = pc(day.phase)
  const phase = getPhase(dayNum)
  const completed = progress.completed.includes(dayNum)

  const [step, setStep] = useState(0)
  const [mood, setMood] = useState(journal[dayNum]?.mood || '')
  const [prompts, setPrompts] = useState(journal[dayNum]?.prompts || {})
  const [gratitude, setGratitude] = useState(journal[dayNum]?.gratitude || '')
  const [release, setRelease] = useState(journal[dayNum]?.release || '')
  const [endReflection, setEndReflection] = useState(journal[dayNum]?.endReflection || '')

  // Auto-save whenever anything changes
  useEffect(() => {
    const entry = { mood, prompts, gratitude, release, endReflection }
    onSaveJournal(dayNum, entry)
  }, [mood, prompts, gratitude, release, endReflection, dayNum])

  // Reset step when day changes
  useEffect(() => {
    setStep(0)
    setMood(journal[dayNum]?.mood || '')
    setPrompts(journal[dayNum]?.prompts || {})
    setGratitude(journal[dayNum]?.gratitude || '')
    setRelease(journal[dayNum]?.release || '')
    setEndReflection(journal[dayNum]?.endReflection || '')
  }, [dayNum])

  const STEPS = [
    { id: 0, label: 'Morning Prayer', icon: '☀️' },
    { id: 1, label: 'How You Feel',   icon: '💭' },
    { id: 2, label: 'Scripture',      icon: '📖' },
    { id: 3, label: 'Deep Dive',      icon: '🔍' },
    { id: 4, label: 'Devotional',     icon: '🕊️' },
    { id: 5, label: 'God Teaches',    icon: '✨' },
    { id: 6, label: 'Journal',        icon: '📝' },
    { id: 7, label: 'Close Your Day', icon: '🌸' },
    { id: 8, label: 'Night Prayer',   icon: '🌙' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Day selector — soft, text-link style */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button
          onClick={() => onUpdateDay(Math.max(1, dayNum - 1))}
          disabled={dayNum <= 1}
          style={{
            background: 'none', border: 'none', padding: '8px 4px',
            cursor: dayNum > 1 ? 'pointer' : 'default',
            color: dayNum > 1 ? '#b0988a' : '#ddd0c8', fontSize: '0.8rem',
          }}>← Day {dayNum - 1 > 0 ? dayNum - 1 : ''}</button>

        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontFamily: 'Georgia, serif', fontWeight: 600, fontSize: '1.02rem',
            color: c.dark, lineHeight: 1.3 }}>
            {day.title}
          </div>
          <div style={{ fontSize: '0.62rem', color: c.main, marginTop: 5,
            letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            {phase.icon} Day {dayNum} · {phase.name}
            {completed && <span style={{ marginLeft: 8, color: '#7aaa7a' }}>✓</span>}
          </div>
        </div>

        <button
          onClick={() => onUpdateDay(Math.min(30, dayNum + 1))}
          disabled={dayNum >= 30}
          style={{
            background: 'none', border: 'none', padding: '8px 4px',
            cursor: dayNum < 30 ? 'pointer' : 'default',
            color: dayNum < 30 ? '#b0988a' : '#ddd0c8', fontSize: '0.8rem',
          }}>Day {dayNum + 1 <= 30 ? dayNum + 1 : ''} →</button>
      </div>

      {/* Chapter progress — editorial book feel, no numbered circles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
        <div style={{ width: '100%', background: '#ede4da', borderRadius: 3, height: 2, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: 3,
            background: c.main,
            width: `${(step / (STEPS.length - 1)) * 100}%`,
            transition: 'width 0.45s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase' }}>
          {STEPS[step].icon} {STEPS[step].label} · {step + 1} of {STEPS.length}
        </div>
      </div>

      {/* ─── Step content ─── */}

      {/* STEP 1: How you feel today */}
      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 28, padding: '30px 24px', textAlign: 'center',
            boxShadow: '0 4px 22px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
              Before We Begin
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.05rem', fontStyle: 'italic',
              color: '#3a2c22', lineHeight: 1.85, marginBottom: 22 }}>
              How are you carrying yourself into this moment?
              <br /><span style={{ fontSize: '0.9rem', color: c.main }}>He meets you exactly where you are.</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
              {MOODS.map(m => (
                <button key={m.value} onClick={() => setMood(m.value)} style={{
                  padding: '13px 6px', borderRadius: 18, cursor: 'pointer', textAlign: 'center',
                  transition: 'all 0.2s',
                  border: `1.5px solid ${mood === m.value ? c.main : '#ede4da'}`,
                  background: mood === m.value ? c.light : '#fefcf9',
                  boxShadow: mood === m.value ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
                }}>
                  <div style={{ fontSize: '1.5rem' }}>{m.emoji}</div>
                  <div style={{ fontSize: '0.6rem', marginTop: 5,
                    color: mood === m.value ? c.dark : '#b0988a',
                    fontWeight: mood === m.value ? 700 : 400 }}>{m.label}</div>
                </button>
              ))}
            </div>
          </div>
          {mood && (
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.9rem', color: c.main,
              textAlign: 'center', fontStyle: 'italic', lineHeight: 1.8 }}>
              {MOODS.find(m => m.value === mood)?.label} — He sees it. He holds it all. 🙏
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Scripture */}
      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <ScriptureCard day={day} favs={favs} onToggleFav={onToggleFav} />
          <div style={{ textAlign: 'center', fontFamily: 'Georgia, serif', fontSize: '0.88rem',
            color: '#b0988a', fontStyle: 'italic', lineHeight: 1.9, padding: '0 12px' }}>
            Read it slowly. Maybe twice.<br />
            Let it settle somewhere before you move on.
          </div>
        </div>
      )}

      {/* STEP 3: Deep Dive */}
      {step === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Plain-language intro — what this passage is really saying */}
          <div style={{
            background: '#fefcf9', border: '1px solid #ede4da',
            borderRadius: 20, padding: '18px 20px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
              The Heart of This Passage
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.95rem', fontStyle: 'italic',
              color: '#3a2c22', lineHeight: 1.85, marginBottom: 10 }}>
              {day.theme}
            </div>
            <div style={{ fontSize: '0.68rem', color: '#b0988a', fontStyle: 'italic',
              fontFamily: 'Georgia, serif' }}>
              Tap ✦ beside any passage to highlight it · tap 📝 to add notes
            </div>
          </div>

          {/* Historical Context */}
          <div style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 24, padding: '26px 22px',
            boxShadow: '0 4px 22px rgba(0,0,0,0.05)',
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                📜 Historical Context
              </div>
              <div style={{ fontSize: '0.7rem', color: '#b0988a', fontStyle: 'italic',
                fontFamily: 'Georgia, serif', marginTop: 3 }}>
                What was happening when this was written
              </div>
            </div>
            {day.historicalContext.split('\n\n').map((para, i) => (
              <HighlightableParagraph
                key={i} text={para} paraIndex={i}
                section="historical" dayNum={dayNum}
                highlights={notes[dayNum]?.historical?.highlightedParas}
                onToggle={onToggleHighlight}
                pStyle={{ fontSize: '0.93rem', lineHeight: 1.95, color: '#3a2c22', fontFamily: 'Georgia, serif' }}
              />
            ))}
            <SectionNotesPanel dayNum={dayNum} section="historical"
              notes={notes} onSaveNote={onSaveNote} c={c} />
          </div>

          {/* Word Study */}
          {day.wordStudy && (
            <div style={{
              background: '#fefcf9', border: '1px solid #ede4da',
              borderRadius: 24, padding: '26px 22px',
              boxShadow: '0 4px 22px rgba(0,0,0,0.05)',
            }}>
              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
                  letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  🔤 Word Study
                </div>
                <div style={{ fontSize: '0.7rem', color: '#b0988a', fontStyle: 'italic',
                  fontFamily: 'Georgia, serif', marginTop: 3 }}>
                  What the original Hebrew or Greek word actually means
                </div>
              </div>
              {/* Original word — centered display */}
              <div style={{
                textAlign: 'center', background: c.light, borderRadius: 18,
                padding: '18px 16px', marginBottom: 18, border: `1px solid ${c.border}`,
              }}>
                <div style={{ fontFamily: 'Georgia, serif', fontSize: '1.7rem', color: c.dark,
                  fontWeight: 700, marginBottom: 6 }}>
                  {day.wordStudy.original}
                </div>
                <div style={{ fontSize: '0.9rem', color: c.main, fontWeight: 700, marginBottom: 3 }}>
                  {day.wordStudy.word}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9a8a80', fontStyle: 'italic' }}>
                  {day.wordStudy.language} · pronounced: "{day.wordStudy.pronunciation}"
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.62rem', color: '#9a8880', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 8 }}>
                  What It Means
                </div>
                <p style={{ margin: '0 0 0', fontSize: '0.93rem', lineHeight: 1.9, color: '#3a2c22' }}>
                  {day.wordStudy.meaning}
                </p>
              </div>
              <div style={{ background: c.light, borderRadius: 16, padding: '18px', border: `1px solid ${c.border}`, marginBottom: 4 }}>
                <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10 }}>
                  Why It Matters for You
                </div>
                <HighlightableParagraph
                  text={day.wordStudy.significance} paraIndex={0}
                  section="wordStudy" dayNum={dayNum}
                  highlights={notes[dayNum]?.wordStudy?.highlightedParas}
                  onToggle={onToggleHighlight}
                  pStyle={{ fontSize: '0.93rem', lineHeight: 1.9, color: '#3a2c22',
                    fontStyle: 'italic', fontFamily: 'Georgia, serif' }}
                />
              </div>
              <SectionNotesPanel dayNum={dayNum} section="wordStudy"
                notes={notes} onSaveNote={onSaveNote} c={c} />
            </div>
          )}

          {/* Verse Breakdown */}
          <div style={{
            background: '#fefcf9', border: '1px solid #ede4da',
            borderRadius: 24, padding: '26px 22px',
            boxShadow: '0 4px 22px rgba(0,0,0,0.05)',
          }}>
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
                letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                🔍 Verse Breakdown
              </div>
              <div style={{ fontSize: '0.7rem', color: '#b0988a', fontStyle: 'italic',
                fontFamily: 'Georgia, serif', marginTop: 3 }}>
                Walking through each part of the verse, phrase by phrase
              </div>
            </div>
            {day.verseBreakdown.split('\n\n').map((para, i) => (
              <HighlightableParagraph
                key={i} text={para} paraIndex={i}
                section="breakdown" dayNum={dayNum}
                highlights={notes[dayNum]?.breakdown?.highlightedParas}
                onToggle={onToggleHighlight}
                pStyle={{ fontSize: '0.93rem', lineHeight: 1.95, color: '#3a2c22', fontFamily: 'Georgia, serif' }}
              />
            ))}
            <SectionNotesPanel dayNum={dayNum} section="breakdown"
              notes={notes} onSaveNote={onSaveNote} c={c} />
          </div>
        </div>
      )}

      {/* STEP 4: Devotional — the heart of the study */}
      {step === 4 && (
        <div style={{
          background: '#fefcf9', border: `1px solid ${c.border}`,
          borderRadius: 28, padding: '32px 24px',
          boxShadow: '0 6px 32px rgba(0,0,0,0.07)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 10 }}>🕊️</div>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>
              Today's Devotional
            </div>
            <div style={{ fontSize: '0.68rem', color: '#b0988a', fontStyle: 'italic',
              fontFamily: 'Georgia, serif' }}>
              Tap ✦ beside any paragraph to mark it · 📝 to write notes
            </div>
          </div>
          {day.devotional.split('\n\n').map((para, i) => (
            <HighlightableParagraph
              key={i} text={para} paraIndex={i}
              section="devotional" dayNum={dayNum}
              highlights={notes[dayNum]?.devotional?.highlightedParas}
              onToggle={onToggleHighlight}
              pStyle={{ fontSize: '1rem', lineHeight: 2.05, color: '#3a2c22', fontFamily: 'Georgia, serif' }}
            />
          ))}
          <SectionNotesPanel dayNum={dayNum} section="devotional"
            notes={notes} onSaveNote={onSaveNote} c={c} />
        </div>
      )}

      {/* STEP 5: God Is Teaching Me */}
      {step === 5 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 28, padding: '32px 24px', textAlign: 'center',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '1.4rem', marginBottom: 10 }}>✨</div>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 20 }}>
              God Is Teaching Me
            </div>
            <p style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: '1.02rem',
              lineHeight: 2.05, color: '#3a2c22', fontStyle: 'italic' }}>
              {day.godIsTeachingMe}
            </p>
          </div>
          <div style={{
            background: '#fefcf9', border: '1px solid #ede4da',
            borderRadius: 20, padding: '20px 20px',
          }}>
            <div style={{ fontSize: '0.8rem', color: '#9a8880', fontWeight: 500, marginBottom: 10,
              fontStyle: 'italic', fontFamily: 'Georgia, serif' }}>
              In your own words — what is God speaking to you today?
            </div>
            <JournalTextArea
              value={prompts['teaches'] || ''}
              onChange={v => setPrompts(p => ({ ...p, teaches: v }))}
              placeholder="My own reflection on what God is teaching me today…"
              rows={4}
            />
          </div>
        </div>
      )}

      {/* STEP 6: Journal */}
      {step === 6 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ textAlign: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: '1.2rem', marginBottom: 8 }}>📝</div>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase' }}>
              Your Journal
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.83rem', color: '#b0988a',
              fontStyle: 'italic', marginTop: 6, lineHeight: 1.7 }}>
              Answer what speaks to your heart. Nothing needs to be perfect here.
            </div>
          </div>

          {day.journalPrompts.map((prompt, i) => (
            <div key={i} style={{
              background: '#fefcf9', border: '1px solid #ede4da',
              borderRadius: 22, padding: '20px 20px',
              boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
            }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.93rem', color: '#3a2c22',
                fontWeight: 600, marginBottom: 12, lineHeight: 1.6, fontStyle: 'italic' }}>
                {prompt}
              </div>
              <JournalTextArea
                value={prompts[`q${i}`] || ''}
                onChange={v => setPrompts(p => ({ ...p, [`q${i}`]: v }))}
                placeholder="Write freely — this is your safe space…"
              />
            </div>
          ))}

          <div style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 22, padding: '20px 20px',
            boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.93rem', color: c.dark,
              fontWeight: 600, marginBottom: 12, lineHeight: 1.6, fontStyle: 'italic' }}>
              🌷 {day.gratitudePrompt}
            </div>
            <JournalTextArea
              value={gratitude}
              onChange={setGratitude}
              placeholder="I am grateful for…"
              rows={3}
            />
          </div>

          <div style={{
            background: '#fdf6f4', border: '1px solid #f0d0c8',
            borderRadius: 22, padding: '20px 20px',
            boxShadow: '0 2px 14px rgba(0,0,0,0.04)',
          }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.93rem', color: '#9a6055',
              fontWeight: 600, marginBottom: 12, lineHeight: 1.6, fontStyle: 'italic' }}>
              🕊️ {day.releasePrompt}
            </div>
            <JournalTextArea
              value={release}
              onChange={setRelease}
              placeholder="I release…"
              rows={3}
            />
          </div>
        </div>
      )}

      {/* STEP 0: Morning Prayer — open your day with God */}
      {step === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.95rem', fontStyle: 'italic',
              color: '#b0988a', lineHeight: 1.9 }}>
              Before you read a single verse today —<br />
              bring your heart to God first.<br />
              <span style={{ fontSize: '0.83rem', color: c.main }}>Let this prayer open the door.</span>
            </div>
          </div>
          <PrayerCard
            title="Morning Prayer"
            text={day.morningPrayer}
            type="morning"
            dayNum={dayNum}
            phaseId={day.phase}
            favs={favs}
            onToggleFav={onToggleFav}
          />
        </div>
      )}

      {/* STEP 8: Night Prayer — close your day in prayer */}
      {step === 8 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ textAlign: 'center', padding: '0 8px' }}>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.95rem', fontStyle: 'italic',
              color: '#b0988a', lineHeight: 1.9 }}>
              You made it through today.<br />
              Now lay it all down before you rest.<br />
              <span style={{ fontSize: '0.83rem', color: c.main }}>He is still here.</span>
            </div>
          </div>
          <PrayerCard
            title="Night Prayer"
            text={day.nightPrayer}
            type="night"
            dayNum={dayNum}
            phaseId={day.phase}
            favs={favs}
            onToggleFav={onToggleFav}
          />
        </div>
      )}

      {/* STEP 7: Close Your Day — reflection + complete */}
      {step === 7 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 28, padding: '32px 24px', textAlign: 'center',
            boxShadow: '0 4px 22px rgba(0,0,0,0.06)',
          }}>
            <div style={{ fontSize: '1.5rem', marginBottom: 10 }}>🌸</div>
            <div style={{ fontSize: '0.62rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 16 }}>
              Before You Close
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.9rem', color: '#9a8880',
              fontStyle: 'italic', lineHeight: 1.85, marginBottom: 18 }}>
              Write one word, one feeling, or one thing you want to carry<br />with you — then head to the night prayer to close your day:
            </div>
            <JournalTextArea
              value={endReflection}
              onChange={setEndReflection}
              placeholder="Today I am leaving this study with…"
              rows={3}
            />
          </div>

          {!completed ? (
            <button onClick={() => onMarkComplete(dayNum)} style={{
              background: c.light, color: c.dark,
              border: `1.5px solid ${c.border}`, borderRadius: 30,
              padding: '18px 32px', fontSize: '0.93rem', fontWeight: 700, cursor: 'pointer',
              fontFamily: 'Georgia, serif', letterSpacing: '0.04em',
              boxShadow: '0 4px 22px rgba(0,0,0,0.08)', transition: 'all 0.2s',
              display: 'block', width: '100%',
            }}>
              ✦ Complete Day {dayNum} ✦
            </button>
          ) : (
            <div style={{
              background: '#f4faf4', border: '1px solid #c0dfc0',
              borderRadius: 24, padding: '22px', textAlign: 'center',
              color: '#558855', fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1rem',
              lineHeight: 1.7,
            }}>
              ✓ Day {dayNum} is complete — beautifully done. 🌸
            </div>
          )}
        </div>
      )}

      {/* Page-turn navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6 }}>
        {step > 0 ? (
          <button onClick={() => setStep(s => s - 1)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#c4b4a8', fontSize: '0.78rem', fontWeight: 500,
            display: 'flex', alignItems: 'center', gap: 5, padding: '8px 0',
            letterSpacing: '0.03em',
          }}>
            ← {STEPS[step - 1].label}
          </button>
        ) : <span />}

        {step < STEPS.length - 1 ? (
          <button onClick={() => setStep(s => s + 1)} style={{
            background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 30, padding: '13px 28px', cursor: 'pointer',
            color: c.dark, fontSize: '0.88rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 8,
            boxShadow: '0 3px 16px rgba(0,0,0,0.08)', letterSpacing: '0.03em',
            transition: 'box-shadow 0.2s',
          }}>
            {STEPS[step + 1].label} {STEPS[step + 1].icon}
          </button>
        ) : <span />}
      </div>
      <div style={{ textAlign: 'center', fontSize: '0.6rem', color: '#c4b4a8', fontStyle: 'italic', marginTop: 2 }}>
        ✦ your words are saved automatically ✦
      </div>
    </div>
  )
}

// ─── TAB: MY JOURNAL ─────────────────────────────────────────────────────────
function JournalTab({ progress, journal }) {
  const [selected, setSelected] = useState(null)

  const daysWithJournal = STUDY_DAYS.filter(d => {
    const j = journal[d.day]
    if (!j) return false
    const hasContent = (j.mood) ||
      Object.values(j.prompts || {}).some(v => v?.trim()) ||
      j.gratitude?.trim() || j.release?.trim() || j.endReflection?.trim()
    return hasContent
  })

  if (daysWithJournal.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a8a80' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📝</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.6 }}>
          Your journal entries will appear here as you move through the study.
        </div>
      </div>
    )
  }

  if (selected) {
    const day = getDay(selected)
    const j = journal[selected] || {}
    const c = pc(day.phase)
    const moodObj = MOODS.find(m => m.value === j.mood)
    return (
      <div>
        <button onClick={() => setSelected(null)} style={{
          background: 'none', border: 'none', color: c.main, cursor: 'pointer',
          fontSize: '0.85rem', fontWeight: 600, marginBottom: 14, padding: 0,
        }}>← Back to Journal</button>

        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: c.dark, marginBottom: 4 }}>
          Day {day.day}: {day.title}
        </div>
        {moodObj && (
          <div style={{ fontSize: '0.85rem', color: '#7a6a60', marginBottom: 16 }}>
            Mood: {moodObj.emoji} {moodObj.label}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {day.journalPrompts.map((prompt, i) => j.prompts?.[`q${i}`] && (
            <div key={i} style={{ background: '#fffdf9', border: '1px solid #e8ddd4',
              borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600, marginBottom: 6 }}>
                {prompt}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#4a3c30', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {j.prompts[`q${i}`]}
              </div>
            </div>
          ))}

          {j.gratitude && (
            <div style={{ background: c.light, border: `1px solid ${c.border}`,
              borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.73rem', color: c.main, fontWeight: 700, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>🌷 Gratitude</div>
              <div style={{ fontSize: '0.9rem', color: '#4a3c30', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {j.gratitude}
              </div>
            </div>
          )}

          {j.release && (
            <div style={{ background: '#fff8f6', border: '1px solid #e8c4bb',
              borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.73rem', color: '#b06858', fontWeight: 700, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>🕊️ Release</div>
              <div style={{ fontSize: '0.9rem', color: '#4a3c30', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {j.release}
              </div>
            </div>
          )}

          {j.endReflection && (
            <div style={{ background: '#fffdf9', border: '1px solid #e8ddd4',
              borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.73rem', color: '#8a7a70', fontWeight: 700, marginBottom: 6,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>🌸 End-of-Day Reflection</div>
              <div style={{ fontSize: '0.9rem', color: '#4a3c30', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                {j.endReflection}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
        {daysWithJournal.length} Journal {daysWithJournal.length === 1 ? 'Entry' : 'Entries'}
      </div>
      {daysWithJournal.reverse().map(d => {
        const j = journal[d.day] || {}
        const c = pc(d.phase)
        const moodObj = MOODS.find(m => m.value === j.mood)
        const hasText = Object.values(j.prompts || {}).some(v => v?.trim()) || j.gratitude || j.release
        return (
          <button key={d.day} onClick={() => setSelected(d.day)} style={{
            background: '#fffdf9', border: '1px solid #e8ddd4', borderRadius: 12,
            padding: '14px 16px', textAlign: 'left', cursor: 'pointer', width: '100%',
            borderLeft: `4px solid ${c.main}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700, color: '#3d3028', fontSize: '0.9rem' }}>
                  Day {d.day}: {d.title}
                </div>
                <div style={{ fontSize: '0.72rem', color: c.main, marginTop: 2 }}>
                  {getPhase(d.day).icon} {getPhase(d.day).name}
                  {moodObj && <span style={{ marginLeft: 8 }}>{moodObj.emoji} {moodObj.label}</span>}
                </div>
              </div>
              <div style={{ fontSize: '0.75rem', color: '#9a8a80' }}>
                {hasText ? '📝' : '💭'} →
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── TAB: SAVED ──────────────────────────────────────────────────────────────
function SavedTab({ favs, onToggleFav }) {
  const [view, setView] = useState('scriptures')

  const hasScriptures = favs.scriptures.length > 0
  const hasPrayers = favs.prayers.length > 0

  if (!hasScriptures && !hasPrayers) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a8a80' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🔖</div>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '1rem', fontStyle: 'italic', lineHeight: 1.6 }}>
          Tap the bookmark icon on any scripture or prayer to save it here for quick access.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {['scriptures', 'prayers'].map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            flex: 1, padding: '8px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: view === v ? '#b06858' : '#f5f0eb',
            color: view === v ? '#fff' : '#7a6a60',
            fontWeight: view === v ? 700 : 400, fontSize: '0.83rem',
          }}>
            {v === 'scriptures' ? '📖 Scriptures' : '🙏 Prayers'}
            <span style={{ marginLeft: 6, opacity: 0.8 }}>
              ({v === 'scriptures' ? favs.scriptures.length : favs.prayers.length})
            </span>
          </button>
        ))}
      </div>

      {view === 'scriptures' && favs.scriptures.map((s, i) => {
        const day = getDay(s.day)
        const c = pc(day.phase)
        return (
          <div key={i} style={{ background: c.light, border: `1px solid ${c.border}`,
            borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
              Day {day.day} · {day.title}
            </div>
            <blockquote style={{ margin: 0, fontFamily: 'Georgia, serif', fontSize: '0.93rem',
              lineHeight: 1.7, color: '#3d3028', fontStyle: 'italic' }}>
              "{day.scripture}"
            </blockquote>
            <div style={{ marginTop: 8, fontSize: '0.8rem', color: c.dark, fontWeight: 600,
              fontFamily: 'Georgia, serif' }}>— {day.scriptureRef}</div>
            <button onClick={() => onToggleFav('scripture', day)} style={{
              position: 'absolute', top: 12, right: 12,
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
            }} title="Remove">🔖</button>
          </div>
        )
      })}

      {view === 'prayers' && favs.prayers.map((p, i) => {
        const day = getDay(p.day)
        const c = pc(day.phase)
        return (
          <div key={i} style={{ background: '#fffdf9', border: `1px solid ${c.border}`,
            borderRadius: 14, padding: '16px 18px', position: 'relative' }}>
            <div style={{ fontSize: '0.7rem', color: c.main, fontWeight: 700,
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
              {p.type === 'morning' ? '☀️' : '🌙'} {p.title} · Day {p.day}
            </div>
            {p.text.split('\n\n').map((para, j) => (
              <p key={j} style={{ margin: '0 0 10px', fontFamily: 'Georgia, serif',
                fontSize: '0.88rem', lineHeight: 1.75, color: '#4a3c30', fontStyle: 'italic' }}>
                {para}
              </p>
            ))}
            <button onClick={() => onToggleFav('prayer', p)} style={{
              position: 'absolute', top: 12, right: 12,
              background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem',
            }} title="Remove">🔖</button>
          </div>
        )
      })}
    </div>
  )
}

// ─── TAB: JOURNEY (all 30 days grid) ─────────────────────────────────────────
function JourneyTab({ progress, onUpdateDay, onNavigate }) {
  const completed = progress.completed
  const current = progress.currentDay

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {PHASES.map(phase => {
        const c = pc(phase.id)
        const pDays = STUDY_DAYS.filter(d => d.phase === phase.id)
        const pDone = pDays.filter(d => completed.includes(d.day)).length
        return (
          <div key={phase.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ fontSize: '1.1rem' }}>{phase.icon}</div>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: c.dark }}>
                  Phase {phase.id}: {phase.name}
                </div>
                <div style={{ fontSize: '0.7rem', color: c.main }}>
                  Days {phase.days[0]}–{phase.days[1]} · {pDone}/{pDays.length} complete
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
              {pDays.map(d => {
                const isDone = completed.includes(d.day)
                const isCurrent = d.day === current
                return (
                  <button key={d.day} onClick={() => { onUpdateDay(d.day); onNavigate('study') }} style={{
                    aspectRatio: '1', borderRadius: 10, border: `2px solid`,
                    borderColor: isCurrent ? c.main : isDone ? '#a8c8a6' : c.border,
                    background: isDone ? '#f0fdf4' : isCurrent ? c.light : '#fff',
                    cursor: 'pointer', display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', gap: 2,
                    transition: 'all 0.15s',
                  }}>
                    <div style={{ fontSize: '0.68rem', fontWeight: 700,
                      color: isDone ? '#15803d' : isCurrent ? c.dark : '#9a8a80' }}>
                      {d.day}
                    </div>
                    <div style={{ fontSize: '0.8rem' }}>
                      {isDone ? '✓' : isCurrent ? '→' : ''}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Phase progress bar */}
            <div style={{ marginTop: 8, background: c.border, borderRadius: 4, height: 4 }}>
              <div style={{
                width: `${(pDone / pDays.length) * 100}%`, height: '100%', borderRadius: 4,
                background: c.main, transition: 'width 0.3s',
              }} />
            </div>
          </div>
        )
      })}

      <div style={{ background: '#fdf8f4', border: '1px solid #e8ddd4', borderRadius: 12,
        padding: '14px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#b06858' }}>
          {completed.length}/30
        </div>
        <div style={{ fontSize: '0.75rem', color: '#8a7a70', marginTop: 2 }}>
          Days Complete · {Math.round((completed.length / 30) * 100)}% of Journey
        </div>
      </div>
    </div>
  )
}

// ─── TAB: LIBRARY ────────────────────────────────────────────────────────────
function LibraryTab({ progress }) {
  const completed = progress.completed
  const pct = Math.round((completed.length / 30) * 100)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Active Study */}
      <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        📚 Currently Active
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #b06858 0%, #8c5042 100%)',
        borderRadius: 18, padding: '22px 22px 18px', color: '#fff',
      }}>
        <div style={{ fontSize: '0.72rem', opacity: 0.85, letterSpacing: '0.06em',
          textTransform: 'uppercase', marginBottom: 4 }}>
          🕊️ {STUDY_META.category}
        </div>
        <div style={{ fontSize: '1.25rem', fontWeight: 800, lineHeight: 1.2, marginBottom: 4 }}>
          {STUDY_META.title}
        </div>
        <div style={{ fontSize: '0.83rem', opacity: 0.9, fontFamily: 'Georgia, serif',
          fontStyle: 'italic', marginBottom: 16 }}>
          {STUDY_META.subtitle}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {STUDY_META.tags.map(tag => (
            <span key={tag} style={{
              background: 'rgba(255,255,255,0.2)', borderRadius: 20,
              padding: '2px 10px', fontSize: '0.68rem', fontWeight: 600,
            }}>{tag}</span>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.25)', borderRadius: 6, height: 8, marginBottom: 6 }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 6,
            background: '#fff', transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.73rem', opacity: 0.85 }}>
          <span>{completed.length} of {STUDY_META.daysCount} days complete</span>
          <span>{pct}%</span>
        </div>
      </div>

      {/* Audio Devotionals scaffold */}
      <div style={{ background: '#fffdf9', border: '1px solid #e8ddd4', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: '0.72rem', color: '#b06858', fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
          🎧 Audio Devotionals & Prayers
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12,
          background: '#fdf8f4', borderRadius: 10, padding: '12px 14px' }}>
          <span style={{ fontSize: '1.5rem' }}>🎵</span>
          <div>
            <div style={{ fontSize: '0.85rem', color: '#4a3c30', fontWeight: 600 }}>
              Listen to each day's prayer &amp; devotional read aloud
            </div>
            <div style={{ fontSize: '0.72rem', color: '#9a8a80', marginTop: 2 }}>
              Coming soon — audio recordings for every day
            </div>
          </div>
          <span style={{
            marginLeft: 'auto', background: '#e8ddd4', borderRadius: 20,
            padding: '3px 10px', fontSize: '0.65rem', color: '#7a6a60', fontWeight: 700, flexShrink: 0,
          }}>SOON</span>
        </div>
      </div>

      {/* Daily Reminder scaffold */}
      <div style={{ background: '#fffdf9', border: '1px solid #e8ddd4', borderRadius: 14, padding: '18px 20px' }}>
        <div style={{ fontSize: '0.72rem', color: '#b06858', fontWeight: 700,
          letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 12 }}>
          🔔 Daily Reminder
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <label style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#fdf0ed', border: '1px solid #e8c4bb',
            borderRadius: 10, padding: '10px 14px', cursor: 'not-allowed', flex: 1, opacity: 0.7,
          }}>
            <input type="checkbox" readOnly style={{ width: 16, height: 16, accentColor: '#b06858' }} />
            <span>
              <strong style={{ fontSize: '0.85rem', color: '#4a3c30', display: 'block' }}>
                Enable daily reminder
              </strong>
              <span style={{ fontSize: '0.7rem', color: '#9a8a80' }}>
                Push notifications — coming soon
              </span>
            </span>
          </label>
          <div style={{
            background: '#f5f0eb', border: '1px solid #e0d4c8', borderRadius: 10,
            padding: '10px 14px', fontSize: '0.85rem', color: '#9a8a80', opacity: 0.7,
          }}>
            8:00 AM
          </div>
        </div>
        <div style={{ fontSize: '0.72rem', color: '#9a8a80', fontStyle: 'italic' }}>
          Daily reminder notifications will be available in a future update.
        </div>
      </div>

      {/* Future Studies */}
      <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        📖 More Studies Coming Soon
      </div>

      {FUTURE_STUDIES.map(study => (
        <div key={study.id} style={{
          background: '#faf7f4', border: '1px solid #e8ddd4',
          borderRadius: 14, padding: '18px 20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: '1.4rem' }}>{study.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#3d3028' }}>
                    {study.title}
                  </div>
                  <div style={{ fontSize: '0.7rem', color: '#9a8a80', marginTop: 1 }}>
                    {study.daysCount}-Day Study · {study.category}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {study.tags.map(tag => (
                  <span key={tag} style={{
                    background: '#ede8e3', borderRadius: 20,
                    padding: '2px 8px', fontSize: '0.65rem', color: '#7a6a60', fontWeight: 600,
                  }}>{tag}</span>
                ))}
              </div>
            </div>
            <span style={{
              background: '#e8ddd4', borderRadius: 20, flexShrink: 0, marginLeft: 12,
              padding: '4px 12px', fontSize: '0.68rem', color: '#7a6a60', fontWeight: 700,
            }}>Coming Soon</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── TAB: PRAYER ─────────────────────────────────────────────────────────────
function PrayerTab({ prayers, onAddPrayer, onToggleAnswered, onDeletePrayer }) {
  const [view, setView]           = useState('active')   // 'active' | 'answered' | 'new'
  const [filterCat, setFilterCat] = useState('all')
  const [form, setForm]           = useState({ category: 'healing', title: '', prayer: '' })

  const activePrayers   = prayers.filter(p => !p.answered)
  const answeredPrayers = prayers.filter(p => p.answered)
  const filtered        = (view === 'active' ? activePrayers : answeredPrayers)
    .filter(p => filterCat === 'all' || p.category === filterCat)

  function handleSubmit() {
    if (!form.title.trim() || !form.prayer.trim()) return
    onAddPrayer({
      id: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      category: form.category,
      title: form.title.trim(),
      prayer: form.prayer.trim(),
      answered: false,
      answeredDate: null,
      answeredNote: '',
    })
    setForm({ category: 'healing', title: '', prayer: '' })
    setView('active')
  }

  const catObj = (val) => PRAYER_CATEGORIES.find(c => c.value === val) || PRAYER_CATEGORIES[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        {[
          { label: 'Active',   count: activePrayers.length,   color: '#b06858', bg: '#fdf0ed', border: '#e8c4bb' },
          { label: 'Answered', count: answeredPrayers.length, color: '#5a9e69', bg: '#f0fdf4', border: '#a8d8b0' },
          { label: 'Total',    count: prayers.length,         color: '#5e87b5', bg: '#eff4fa', border: '#b0c9e5' },
        ].map(s => (
          <div key={s.label} style={{
            background: s.bg, border: `1px solid ${s.border}`,
            borderRadius: 12, padding: '12px 14px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '0.7rem', color: '#8a7a70', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* View switcher */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[
          { id: 'active',   label: `🙏 Active (${activePrayers.length})` },
          { id: 'answered', label: `✅ Answered (${answeredPrayers.length})` },
          { id: 'new',      label: '+ Add Prayer' },
        ].map(v => (
          <button key={v.id} onClick={() => setView(v.id)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: view === v.id ? '#b06858' : '#f5f0eb',
            color: view === v.id ? '#fff' : '#7a6a60',
            fontWeight: view === v.id ? 700 : 400, fontSize: '0.73rem',
          }}>{v.label}</button>
        ))}
      </div>

      {/* Add prayer form */}
      {view === 'new' && (
        <div style={{
          background: '#fffdf9', border: '1px solid #e8ddd4', borderRadius: 14,
          padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <div style={{ fontSize: '0.72rem', color: '#b06858', fontWeight: 700,
            letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            🙏 New Prayer Request
          </div>

          {/* Category */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600, marginBottom: 7 }}>
              Category
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PRAYER_CATEGORIES.map(cat => (
                <button key={cat.value} onClick={() => setForm(f => ({ ...f, category: cat.value }))} style={{
                  padding: '5px 12px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                  border: `1.5px solid ${form.category === cat.value ? '#b06858' : '#e0d4c8'}`,
                  background: form.category === cat.value ? '#fdf0ed' : '#fff',
                  color: form.category === cat.value ? '#8c5042' : '#7a6a60',
                  fontSize: '0.75rem', fontWeight: form.category === cat.value ? 700 : 400,
                }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600, marginBottom: 6 }}>
              Prayer Title / Subject
            </div>
            <input
              type="text"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="What are you bringing before God today?"
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                borderRadius: 8, border: '1px solid #e0d4c8', background: '#fff',
                fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', color: '#3d3028',
              }}
            />
          </div>

          {/* Prayer body */}
          <div>
            <div style={{ fontSize: '0.75rem', color: '#8a7a70', fontWeight: 600, marginBottom: 6 }}>
              Your Prayer
            </div>
            <textarea
              value={form.prayer}
              onChange={e => setForm(f => ({ ...f, prayer: e.target.value }))}
              placeholder="Write your prayer freely. Lay your heart before Him…"
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                borderRadius: 8, border: '1px solid #e0d4c8', background: '#fff',
                fontSize: '0.88rem', fontFamily: 'Georgia, serif', fontStyle: 'italic',
                lineHeight: 1.75, color: '#4a3c30', resize: 'vertical', outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setView('active')} style={{
              flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #e0d4c8',
              background: '#fff', color: '#8a7a70', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem',
            }}>Cancel</button>
            <button
              onClick={handleSubmit}
              disabled={!form.title.trim() || !form.prayer.trim()}
              style={{
                flex: 2, padding: '10px', borderRadius: 8, border: 'none',
                background: (!form.title.trim() || !form.prayer.trim()) ? '#e0d4c8' : '#b06858',
                color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: '0.88rem',
                transition: 'background 0.15s',
              }}>
              🙏 Add Prayer Request
            </button>
          </div>
        </div>
      )}

      {/* Category filter chips */}
      {view !== 'new' && prayers.length > 0 && (
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', paddingBottom: 2 }}>
          <button onClick={() => setFilterCat('all')} style={{
            padding: '4px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0,
            border: `1.5px solid ${filterCat === 'all' ? '#b06858' : '#e0d4c8'}`,
            background: filterCat === 'all' ? '#fdf0ed' : '#fff',
            color: filterCat === 'all' ? '#8c5042' : '#7a6a60',
            fontSize: '0.72rem', fontWeight: filterCat === 'all' ? 700 : 400,
          }}>All</button>
          {PRAYER_CATEGORIES.map(cat => (
            <button key={cat.value} onClick={() => setFilterCat(cat.value)} style={{
              padding: '4px 12px', borderRadius: 20, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
              border: `1.5px solid ${filterCat === cat.value ? '#b06858' : '#e0d4c8'}`,
              background: filterCat === cat.value ? '#fdf0ed' : '#fff',
              color: filterCat === cat.value ? '#8c5042' : '#7a6a60',
              fontSize: '0.72rem', fontWeight: filterCat === cat.value ? 700 : 400,
            }}>{cat.icon} {cat.label}</button>
          ))}
        </div>
      )}

      {/* Empty state */}
      {view !== 'new' && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#9a8a80' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🙏</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.95rem', fontStyle: 'italic', lineHeight: 1.7 }}>
            {view === 'active'
              ? 'No active prayer requests yet. Tap "+ Add Prayer" to bring your heart before God.'
              : 'Answered prayers will appear here. God hears every single one.'}
          </div>
          {view === 'active' && (
            <button onClick={() => setView('new')} style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 20, border: 'none',
              background: '#b06858', color: '#fff', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer',
            }}>+ Add First Prayer</button>
          )}
        </div>
      )}

      {/* Prayer list */}
      {view !== 'new' && filtered.map(p => {
        const cat = catObj(p.category)
        return (
          <div key={p.id} style={{
            background: p.answered ? '#f0fdf4' : '#fffdf9',
            border: `1px solid ${p.answered ? '#a8d8b0' : '#e8ddd4'}`,
            borderRadius: 14, padding: '16px 18px',
            borderLeft: `4px solid ${p.answered ? '#5a9e69' : '#b06858'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontSize: '0.9rem' }}>{cat.icon}</span>
              <span style={{ fontSize: '0.68rem', color: '#9a8a80', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {cat.label}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#b0a090', marginLeft: 'auto' }}>{p.date}</span>
            </div>
            <div style={{ fontWeight: 700, fontSize: '0.93rem', color: '#3d3028', marginBottom: 8, lineHeight: 1.3 }}>
              {p.title}
            </div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: '0.87rem', color: '#5a4c3c',
              lineHeight: 1.75, fontStyle: 'italic' }}>
              {p.prayer}
            </div>
            {p.answered && p.answeredDate && (
              <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#5a9e69', fontWeight: 700 }}>
                ✅ Answered {p.answeredDate}
              </div>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
              {!p.answered ? (
                <button onClick={() => onToggleAnswered(p.id)} style={{
                  flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #a8d8b0', background: '#f0fdf4',
                  color: '#15803d', fontWeight: 600, fontSize: '0.75rem',
                }}>✅ Mark Answered</button>
              ) : (
                <button onClick={() => onToggleAnswered(p.id)} style={{
                  flex: 1, padding: '7px', borderRadius: 8, cursor: 'pointer',
                  border: '1px solid #e0d4c8', background: '#f5f0eb',
                  color: '#7a6a60', fontWeight: 600, fontSize: '0.75rem',
                }}>↩ Move to Active</button>
              )}
              <button onClick={() => onDeletePrayer(p.id)} style={{
                padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                border: '1px solid #fcd4c4', background: '#fff8f6',
                color: '#b06858', fontWeight: 600, fontSize: '0.75rem',
              }}>🗑</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── MAIN PAGE COMPONENT ─────────────────────────────────────────────────────
export default function BibleStudy() {
  const [progress, setProgress] = useState(() => loadLS('bs_progress', DEFAULT_PROGRESS))
  const [journal, setJournal]   = useState(() => loadLS('bs_journals', DEFAULT_JOURNAL))
  const [favs, setFavs]         = useState(() => loadLS('bs_favorites', DEFAULT_FAVS))
  const [prayers, setPrayers]   = useState(() => loadLS('bs_prayer_requests', DEFAULT_PRAYERS))
  const [notes, setNotes]       = useState(() => loadLS('bs_notes', {}))
  const [tab, setTab]           = useState('home')

  // Persist
  useEffect(() => { saveLS('bs_progress', progress)      }, [progress])
  useEffect(() => { saveLS('bs_journals', journal)        }, [journal])
  useEffect(() => { saveLS('bs_favorites', favs)          }, [favs])
  useEffect(() => { saveLS('bs_prayer_requests', prayers) }, [prayers])
  useEffect(() => { saveLS('bs_notes', notes)             }, [notes])

  const handleSaveJournal = useCallback((dayNum, entry) => {
    setJournal(prev => ({ ...prev, [dayNum]: entry }))
  }, [])

  const handleMarkComplete = useCallback((dayNum) => {
    setProgress(prev => {
      if (prev.completed.includes(dayNum)) return prev
      const { streak, lastDate } = computeStreak(prev)
      const newCompleted = [...prev.completed, dayNum]
      const newDay = Math.min(30, dayNum + 1)
      return { ...prev, completed: newCompleted, currentDay: newDay, streak, lastDate }
    })
  }, [])

  const handleUpdateDay = useCallback((dayNum) => {
    setProgress(prev => ({ ...prev, currentDay: dayNum }))
  }, [])

  const handleToggleFav = useCallback((type, item) => {
    setFavs(prev => {
      if (type === 'scripture') {
        const exists = prev.scriptures.some(s => s.day === item.day)
        return {
          ...prev,
          scriptures: exists
            ? prev.scriptures.filter(s => s.day !== item.day)
            : [...prev.scriptures, { day: item.day }],
        }
      } else {
        const exists = prev.prayers.some(p => p.day === item.day && p.type === item.type)
        return {
          ...prev,
          prayers: exists
            ? prev.prayers.filter(p => !(p.day === item.day && p.type === item.type))
            : [...prev.prayers, item],
        }
      }
    })
  }, [])

  const handleSaveNote = useCallback((dayNum, section, noteText) => {
    setNotes(prev => ({
      ...prev,
      [dayNum]: {
        ...prev[dayNum],
        [section]: { ...prev[dayNum]?.[section], notes: noteText },
      },
    }))
  }, [])

  const handleToggleHighlight = useCallback((dayNum, section, paraIndex) => {
    setNotes(prev => {
      const current = prev[dayNum]?.[section]?.highlightedParas || []
      const updated = current.includes(paraIndex)
        ? current.filter(i => i !== paraIndex)
        : [...current, paraIndex]
      return {
        ...prev,
        [dayNum]: {
          ...prev[dayNum],
          [section]: { ...prev[dayNum]?.[section], highlightedParas: updated },
        },
      }
    })
  }, [])

  const handleAddPrayer = useCallback((prayerObj) => {
    setPrayers(prev => [prayerObj, ...prev])
  }, [])

  const handleToggleAnswered = useCallback((id) => {
    setPrayers(prev => prev.map(p =>
      p.id === id
        ? { ...p, answered: !p.answered, answeredDate: !p.answered ? new Date().toISOString().slice(0, 10) : null }
        : p
    ))
  }, [])

  const handleDeletePrayer = useCallback((id) => {
    setPrayers(prev => prev.filter(p => p.id !== id))
  }, [])

  const currentPhase = getPhase(progress.currentDay)
  const c = pc(currentPhase.id)

  const TABS = [
    { id: 'home',    label: 'Home',    icon: '🏡' },
    { id: 'study',   label: 'Study',   icon: '📖' },
    { id: 'journal', label: 'Journal', icon: '📝' },
    { id: 'prayer',  label: 'Prayer',  icon: '🙏' },
    { id: 'saved',   label: 'Saved',   icon: '🔖' },
    { id: 'journey', label: 'Journey', icon: '✨' },
    { id: 'library', label: 'Library', icon: '📚' },
  ]

  return (
    <div style={{ padding: '24px 20px 48px', maxWidth: 680, margin: '0 auto' }}>

      {/* Page header — editorial, centered, quiet luxury */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{
          fontSize: '0.6rem', color: '#c4b0a0', fontWeight: 700,
          letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <span>{currentPhase.icon}</span> {currentPhase.name}
        </div>
        <h1 style={{
          margin: 0, fontSize: '1.6rem', fontWeight: 600, color: '#2d2018',
          fontFamily: 'Georgia, serif', letterSpacing: '0.01em', lineHeight: 1.25,
        }}>
          30-Day Bible Study
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '0.87rem', color: '#b09888',
          fontFamily: 'Georgia, serif', fontStyle: 'italic', letterSpacing: '0.03em' }}>
          Healing, Clarity &amp; Peace
        </p>
        <div style={{ width: 32, height: 1.5, background: '#d4b8a4', borderRadius: 2, margin: '14px auto 0' }} />
      </div>

      {/* Tab navigation */}
      <div style={{ marginBottom: 28 }}>
        <TabBar tabs={TABS} active={tab} onChange={setTab} color={c.main} />
      </div>

      {/* Tab content */}
      {tab === 'home' && (
        <HomeTab progress={progress} journal={journal} onNavigate={setTab} />
      )}
      {tab === 'study' && (
        <StudyTab
          progress={progress}
          journal={journal}
          onSaveJournal={handleSaveJournal}
          onMarkComplete={handleMarkComplete}
          onUpdateDay={handleUpdateDay}
          favs={favs}
          onToggleFav={handleToggleFav}
          notes={notes}
          onSaveNote={handleSaveNote}
          onToggleHighlight={handleToggleHighlight}
        />
      )}
      {tab === 'journal' && (
        <JournalTab progress={progress} journal={journal} />
      )}
      {tab === 'saved' && (
        <SavedTab favs={favs} onToggleFav={handleToggleFav} />
      )}
      {tab === 'journey' && (
        <JourneyTab progress={progress} onUpdateDay={handleUpdateDay} onNavigate={setTab} />
      )}
      {tab === 'prayer' && (
        <PrayerTab
          prayers={prayers}
          onAddPrayer={handleAddPrayer}
          onToggleAnswered={handleToggleAnswered}
          onDeletePrayer={handleDeletePrayer}
        />
      )}
      {tab === 'library' && (
        <LibraryTab progress={progress} />
      )}
    </div>
  )
}
