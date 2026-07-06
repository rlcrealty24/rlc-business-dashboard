import { useState, useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar.jsx'
import { bulkSync } from '../hooks/useLocalStorage.js'

export default function Layout() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    bulkSync()
  }, [])

  return (
    <div className="layout">
      {/* Mobile backdrop — tap to close sidebar */}
      <div className={`sidebar-backdrop ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />

      <Sidebar open={open} onClose={() => setOpen(false)} />

      <main className="main-content">
        {/* Sticky top bar shown only on mobile */}
        <div className="mobile-topbar">
          <button
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
            style={{
              background: 'none', border: '1.5px solid var(--border)', borderRadius: 9,
              width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text)', flexShrink: 0,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6"/>
              <line x1="3" y1="12" x2="21" y2="12"/>
              <line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <span className="mobile-topbar-title">🌸 RLC Dashboard</span>
        </div>

        <Outlet />
      </main>
    </div>
  )
}
