import { useState, useRef } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useCeo } from '../ceo/CeoStore.jsx'

const ico = d => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{d}</svg>
)

const CEO_NAV = [
  { path: '/today',    label: 'Today',    icon: ico(<><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></>) },
  { path: '/calendar', label: 'Calendar', icon: ico(<><rect x="3" y="4" width="18" height="17" rx="1"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/></>) },
  { path: '/inbox',    label: 'Inbox',    icon: ico(<><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></>) },
  { path: '/dates',    label: 'Dates & Reminders', icon: ico(<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>) },
]

const NAV = [
  {
    path: '/finance',
    label: 'Finance',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
      </svg>
    ),
  },
  {
    path: '/real-estate',
    label: 'Real Estate',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    path: '/credit-repair',
    label: 'Credit Repair',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><polyline points="16 8 10 14 7 11"/>
      </svg>
    ),
  },
  {
    path: '/portal-project',
    label: 'Tasks & Projects',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
      </svg>
    ),
  },
  {
    path: '/fitness',
    label: 'Health & Fitness',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
    ),
  },
  {
    path: '/bible-study',
    label: 'Faith Journey',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
      </svg>
    ),
  },
]

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function NavItem({ path, label, icon, badge, onClose, active }) {
  return (
    <NavLink to={path} onClick={onClose} className={`rlc-nav${active ? ' active' : ''}`}>
      <span className="rlc-nav-ico">{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge > 0 && <span className="rlc-nav-badge">{badge}</span>}
    </NavLink>
  )
}

export default function Sidebar({ open = true, onClose = () => {} }) {
  const [photo, setPhoto] = useState(() => localStorage.getItem('profile_photo') || null)
  const fileRef = useRef(null)
  const location = useLocation()
  const { tasks } = useCeo()
  const inboxCount = tasks.filter(t => t.status === 'inbox').length

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
    <aside className={`sidebar rlc-sidebar${open ? ' open' : ''}`}>
      {/* ── Brand ──────────────────────────────────────────── */}
      <div className="rlc-brand">
        <img src="/rlc-logo.png" alt="RLC Realty Co." />
        <div className="rlc-brand-sub">CEO Command Center</div>
      </div>

      {/* Profile */}
      <div className="rlc-profile" onClick={() => fileRef.current?.click()} title="Click to update photo">
        <div className="rlc-avatar">
          {photo ? <img src={photo} alt="Profile" /> : <span>RC</span>}
        </div>
        <input ref={fileRef} type="file" accept="image/*" onChange={handlePhoto} style={{ display: 'none' }} />
        <div style={{ minWidth: 0 }}>
          <div className="rlc-profile-name">Royanna Carbajal</div>
          <div className="rlc-profile-sub">{getGreeting()}</div>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="rlc-navlist">
        <div className="rlc-nav-section">CEO</div>
        {CEO_NAV.map(n => (
          <NavItem key={n.path} {...n} onClose={onClose} active={location.pathname === n.path}
            badge={n.path === '/inbox' ? inboxCount : 0} />
        ))}
        <div className="rlc-nav-section" style={{ marginTop: 14 }}>Life &amp; Money</div>
        {NAV.map(n => <NavItem key={n.path} {...n} onClose={onClose} active={location.pathname === n.path} />)}
      </nav>

      <div className="rlc-side-foot">
        <span>Leadership in every deal.</span>
        <span>Loyalty in every move.</span>
      </div>
    </aside>
  )
}
