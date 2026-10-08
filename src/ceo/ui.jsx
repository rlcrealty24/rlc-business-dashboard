import { useEffect, useState } from 'react'
import { CATEGORIES, itemColors } from './constants.js'
import { fmtRange } from './recurrence.js'

export function Modal({ title, eyebrow, onClose, children, footer, width = 620 }) {
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="c-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="c-modal" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="c-modal-head">
          <div style={{ minWidth: 0 }}>
            {eyebrow && <div className="c-eyebrow">{eyebrow}</div>}
            <div className="c-serif" style={{ fontSize: 24, lineHeight: 1.2, marginTop: eyebrow ? 6 : 0 }}>{title}</div>
          </div>
          <button className="c-icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="c-modal-body">{children}</div>
        {footer && <div className="c-modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

export function Checklist({ items, checked = [], onToggle, dark = false }) {
  if (!items?.length) return null
  const set = new Set(checked)
  return (
    <div className="c-checklist">
      {items.map(c => {
        const done = set.has(c.id)
        return (
          <button key={c.id} type="button" className={`c-check${done ? ' done' : ''}`} onClick={() => onToggle?.(c.id)}>
            <span className="c-box">{done && <Tick color={dark ? '#0a0a0a' : '#0a0a0a'} />}</span>
            <span className="c-check-text">{c.text}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Tick({ color = '#0a0a0a', size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export function Progress({ value }) {
  return <div className="c-progress"><div style={{ width: `${Math.round(Math.min(1, Math.max(0, value)) * 100)}%` }} /></div>
}

export function CategoryTag({ item }) {
  if (item.source === 'portal') return <span className="c-chip ink">RLC Portal</span>
  if (item.source === 'bill') return <span className="c-chip red">Bill</span>
  if (item.source === 'life') return <span className="c-chip">Dashboard</span>
  const c = CATEGORIES[item.category] || CATEGORIES.business
  return (
    <span className="c-chip" style={{ color: c.color, borderColor: c.color + '40', background: c.bg }}>
      {item.source === 'task' ? 'Task · ' : ''}{c.label}
    </span>
  )
}

export function ItemBadges({ item }) {
  return (
    <>
      {item.unconfirmed && <span className="c-chip warn">Unconfirmed</span>}
      {item.bumpedBy && <span className="c-chip warn">Bumped by {item.bumpedBy}</span>}
      {item.clashes?.length > 0 && <span className="c-chip red">Clash: {item.clashes.join(', ')}</span>}
      {item.moved && <span className="c-chip sky">Moved</span>}
      {item.status === 'skipped' && <span className="c-chip">Skipped</span>}
      {item.status === 'done' && <span className="c-chip green">Done</span>}
    </>
  )
}

export function ItemLine({ item }) {
  const col = itemColors(item)
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <span className="c-dot" style={{ background: col.color }} />
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</span>
      <span className="c-muted" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>{item.allDay ? 'All day' : fmtRange(item.start, item.end)}</span>
    </span>
  )
}

// ── Toasts (fire-and-forget from anywhere) ─────────────────────────────────
export function toast(title, sub, action) {
  window.dispatchEvent(new CustomEvent('ceo-toast', { detail: { id: Math.random(), title, sub, action } }))
}

export function Toaster() {
  const [list, setList] = useState([])
  useEffect(() => {
    const onToast = e => {
      const t = e.detail
      setList(l => [...l.slice(-3), t])
      setTimeout(() => setList(l => l.filter(x => x.id !== t.id)), t.action ? 20000 : 3500)
    }
    window.addEventListener('ceo-toast', onToast)
    return () => window.removeEventListener('ceo-toast', onToast)
  }, [])
  if (!list.length) return null
  return (
    <div className="c-toasts" aria-live="polite">
      {list.map(t => (
        <div key={t.id} className="c-toast">
          {t.action?.eyebrow && <div className="c-eyebrow" style={{ color: 'var(--sky)' }}>{t.action.eyebrow}</div>}
          <div className="tt">{t.title}</div>
          {t.sub && <div className="ts">{t.sub}</div>}
          <div style={{ display: 'flex', gap: 8, marginTop: t.action ? 10 : 0 }}>
            {t.action?.label && (
              <button className="c-btn c-btn-sky c-btn-sm" onClick={() => { t.action.onClick(); setList(l => l.filter(x => x.id !== t.id)) }}>
                {t.action.label}
              </button>
            )}
            {t.action && (
              <button className="c-btn c-btn-sm" style={{ background: 'transparent', color: '#fff', borderColor: 'rgba(255,255,255,.3)' }}
                onClick={() => setList(l => l.filter(x => x.id !== t.id))}>Dismiss</button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
