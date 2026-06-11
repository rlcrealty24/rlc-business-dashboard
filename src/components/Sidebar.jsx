import { useState, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
      </svg>
    ),
  },
  {
    path: '/finance',
    label: 'Finance',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    path: '/real-estate',
    label: 'Real Estate',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    path: '/credit-repair',
    label: 'Credit Repair',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="16 8 10 14 7 11"/>
      </svg>
    ),
  },
  {
    path: '/portal-project',
    label: 'Tasks & Projects',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    path: '/fitness',
    label: 'Health & Fitness',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    path: '/bible-study',
    label: 'Faith Journey',
    icon: (
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return { text: 'Good morning', emoji: '☀️' }
  if (h < 17) return { text: 'Good afternoon', emoji: '✨' }
  return { text: 'Good evening', emoji: '🌙' }
}

export default function Sidebar() {
  const [photo, setPhoto] = useState(() => localStorage.getItem('profile_photo') || null)
  const [hovered, setHovered] = useState(null)
  const fileRef = useRef(null)
  const location = useLocation()
  const greeting = getGreeting()
  const now = new Date()
  const dayStr  = now.toLocaleDateString('en-US', { weekday: 'short' })
  const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  function handlePhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      localStorage.setItem('profile_photo', ev.target.result)
      setPhoto(ev.target.result)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      background: 'var(--sidebar-bg)',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
    }}>

      {/* ── Brand / Profile ──────────────────────────────── */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 2px 10px rgba(244,63,94,0.4)',
          }}>
            <span style={{ color: '#fff', fontSize: '0.8rem', fontWeight: 800, letterSpacing: '-0.02em' }}>RC</span>
          </div>
          <div>
            <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '0.9rem', letterSpacing: '-0.02em' }}>
              RLC Dashboard
            </div>
            <div style={{ color: '#475569', fontSize: '0.68rem', marginTop: 1 }}>
              Life · Business · Faith
            </div>
          </div>
        </div>

        {/* Profile card */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 10,
          padding: '11px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          cursor: 'pointer',
        }}
          onClick={() => fileRef.current?.click()}
          title="Click to update photo"
        >
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg, #F43F5E 0%, #9D174D 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(244,63,94,0.4)',
          }}>
            {photo
              ? <img src={photo} alt="Royanna" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>R</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ color: '#F1F5F9', fontWeight: 600, fontSize: '0.84rem', letterSpacing: '-0.01em' }}>
              Royanna Carbajal
            </div>
            <div style={{ color: '#64748B', fontSize: '0.68rem', marginTop: 1 }}>
              {greeting.emoji} {greeting.text}  ·  {dayStr}, {dateStr}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ───────────────────────────────────── */}
      <nav style={{
        flex: 1,
        padding: '10px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        overflowY: 'auto',
      }}>
        <div style={{ padding: '8px 8px 4px', fontSize: '0.63rem', fontWeight: 700, letterSpacing: '0.1em', color: '#334155', textTransform: 'uppercase' }}>
          Navigation
        </div>
        {NAV.map(({ path, label, icon }) => {
          const isActive = location.pathname === path
          const isHovered = hovered === path
          return (
            <NavLink
              key={path}
              to={path}
              onMouseEnter={() => setHovered(path)}
              onMouseLeave={() => setHovered(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '9px 10px',
                borderRadius: 9,
                textDecoration: 'none',
                fontSize: '0.875rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#FFFFFF' : isHovered ? '#CBD5E1' : 'var(--sidebar-text)',
                background: isActive
                  ? 'rgba(244,63,94,0.18)'
                  : isHovered ? 'var(--sidebar-hover)' : 'transparent',
                borderLeft: isActive ? '3px solid #F43F5E' : '3px solid transparent',
                transition: 'all 0.15s',
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{ opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{icon}</span>
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Footer ───────────────────────────────────────── */}
      <div style={{
        padding: '14px 18px',
        borderTop: '1px solid var(--sidebar-border)',
        flexShrink: 0,
      }}>
        <div style={{
          fontSize: '0.7rem',
          color: '#334155',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}>
          <span style={{
            display: 'inline-block',
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#22C55E',
            flexShrink: 0,
          }} />
          All systems running
        </div>
      </div>
    </aside>
  )
}
