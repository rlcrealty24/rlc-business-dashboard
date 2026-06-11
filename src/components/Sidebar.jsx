import { useState, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

const NAV = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/>
      </svg>
    ),
  },
  {
    path: '/finance',
    label: 'Finance',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/>
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    path: '/real-estate',
    label: 'Real Estate',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    path: '/credit-repair',
    label: 'Credit Repair',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="16 8 10 14 7 11"/>
      </svg>
    ),
  },
  {
    path: '/portal-project',
    label: 'Tasks & Projects',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/>
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    path: '/fitness',
    label: 'Health & Fitness',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    path: '/bible-study',
    label: 'Faith Journey',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
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
      background: '#1C1025',
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      position: 'sticky',
      top: 0,
      borderRight: '1px solid rgba(232,84,122,0.1)',
    }}>

      {/* ── Brand ──────────────────────────────────────────── */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #E8547A 0%, #C73D63 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(232,84,122,0.45)',
          }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>🌸</span>
          </div>
          <div>
            <div style={{
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.92rem',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}>
              RLC Dashboard
            </div>
            <div style={{ color: 'rgba(232,84,122,0.7)', fontSize: '0.65rem', marginTop: 2, letterSpacing: '0.04em' }}>
              Life · Business · Faith
            </div>
          </div>
        </div>

        {/* Profile card */}
        <div
          onClick={() => fileRef.current?.click()}
          title="Click to update photo"
          style={{
            background: 'rgba(232,84,122,0.08)',
            border: '1px solid rgba(232,84,122,0.18)',
            borderRadius: 10,
            padding: '10px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(232,84,122,0.14)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(232,84,122,0.08)'}
        >
          <div style={{
            width: 34, height: 34, borderRadius: '50%',
            overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg, #E8547A 0%, #9D174D 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid rgba(232,84,122,0.5)',
          }}>
            {photo
              ? <img src={photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: '#fff', fontSize: '0.9rem', fontWeight: 700 }}>R</span>
            }
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
          <div style={{ minWidth: 0 }}>
            <div style={{
              color: '#F1E8EF',
              fontWeight: 600,
              fontSize: '0.83rem',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              Royanna Carbajal
            </div>
            <div style={{ color: 'rgba(155,122,133,0.9)', fontSize: '0.67rem', marginTop: 2 }}>
              {greeting.emoji} {greeting.text}
            </div>
          </div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav style={{
        flex: 1,
        padding: '12px 10px',
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        overflowY: 'auto',
      }}>
        <div style={{
          padding: '4px 8px 8px',
          fontSize: '0.61rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          color: 'rgba(155,122,133,0.5)',
          textTransform: 'uppercase',
        }}>
          Menu
        </div>

        {NAV.map(({ path, label, icon }) => {
          const isActive = location.pathname === path || location.pathname.startsWith(path + '/')
          const isHov = hovered === path

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
                padding: '9px 10px 9px 12px',
                borderRadius: 9,
                textDecoration: 'none',
                fontSize: '0.86rem',
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? '#FFFFFF'
                  : isHov
                    ? 'rgba(241,232,239,0.85)'
                    : 'rgba(155,122,133,0.9)',
                background: isActive
                  ? 'rgba(232,84,122,0.2)'
                  : isHov
                    ? 'rgba(232,84,122,0.1)'
                    : 'transparent',
                borderLeft: isActive
                  ? '2.5px solid #E8547A'
                  : '2.5px solid transparent',
                transition: 'all 0.15s ease',
                letterSpacing: '-0.01em',
              }}
            >
              <span style={{
                color: isActive ? '#E8547A' : isHov ? 'rgba(232,84,122,0.75)' : 'rgba(155,122,133,0.6)',
                flexShrink: 0,
                transition: 'color 0.15s',
              }}>
                {icon}
              </span>
              {label}
            </NavLink>
          )
        })}
      </nav>

      {/* ── Footer ─────────────────────────────────────────── */}
      <div style={{
        padding: '12px 18px 14px',
        borderTop: '1px solid rgba(255,255,255,0.05)',
        flexShrink: 0,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          fontSize: '0.68rem',
          color: 'rgba(155,122,133,0.5)',
        }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: '#2D9E6B',
            flexShrink: 0,
            boxShadow: '0 0 6px rgba(45,158,107,0.7)',
          }} />
          All systems running
        </div>
      </div>
    </aside>
  )
}
