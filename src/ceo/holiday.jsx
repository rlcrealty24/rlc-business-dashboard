// Christmas theme: on automatically Nov 1 – Jan 6 (or forced on/off from the sidebar).
// Adds `html.xmas` (see holiday.css), light snowfall, holiday labels and a countdown.

import { useEffect, useState } from 'react'
import { iso, todayISO, daysBetween } from './recurrence.js'

const KEY = '__xmas'   // per device: 'auto' | 'on' | 'off'

export function inSeason(d = new Date()) {
  const m = d.getMonth(), day = d.getDate()
  return m === 10 || m === 11 || (m === 0 && day <= 6)
}

function readMode() {
  try { return localStorage.getItem(KEY) || 'auto' } catch { return 'auto' }
}

export function useHoliday() {
  const [mode, setModeState] = useState(readMode)
  const on = mode === 'on' || (mode === 'auto' && inSeason())
  useEffect(() => {
    document.documentElement.classList.toggle('xmas', on)
  }, [on])
  useEffect(() => {
    const sync = () => setModeState(readMode())
    window.addEventListener('xmas-mode', sync)
    return () => window.removeEventListener('xmas-mode', sync)
  }, [])
  const setMode = m => {
    try { localStorage.setItem(KEY, m) } catch { /* private mode */ }
    setModeState(m)
    window.dispatchEvent(new Event('xmas-mode'))
  }
  return { on, mode, setMode }
}

/** Fixed + floating holidays for one year → { 'YYYY-MM-DD': '🎄 Christmas' } */
function holidaysFor(y) {
  const nov1 = new Date(y, 10, 1)
  const thanks = new Date(y, 10, 1 + ((4 - nov1.getDay() + 7) % 7) + 21)
  return {
    [iso(thanks)]: '🦃 Thanksgiving',
    [`${y}-12-24`]: '✨ Christmas Eve',
    [`${y}-12-25`]: '🎄 Christmas',
    [`${y}-12-31`]: '🥂 New Year’s Eve',
    [`${y}-01-01`]: '🎉 New Year’s Day',
  }
}
const cache = {}
export function holidayOn(ds) {
  const y = Number(ds.slice(0, 4))
  return (cache[y] ||= holidaysFor(y))[ds] || null
}

export function daysToChristmas() {
  const t = todayISO()
  const y = Number(t.slice(0, 4))
  const xmas = t > `${y}-12-25` ? `${y + 1}-12-25` : `${y}-12-25`
  return daysBetween(t, xmas)
}

export function Countdown() {
  const n = daysToChristmas()
  return <span className="x-count">🎄 {n === 0 ? 'Merry Christmas!' : `${n} day${n === 1 ? '' : 's'} to Christmas`}</span>
}

/** Twinkling string of lights — sits on top of the calendar */
export function Garland() {
  return <div className="x-garland" aria-hidden="true">{Array.from({ length: 28 }, (_, i) => <span key={i} />)}</div>
}

/** Gentle snowfall; pointer-events none, skipped for reduced motion */
export function Snow() {
  const flakes = Array.from({ length: 26 }, (_, i) => ({
    left: (i * 37) % 100, delay: -((i * 7.3) % 14), dur: 10 + ((i * 5) % 9), size: 8 + ((i * 3) % 9), drift: (i % 2 ? 1 : -1) * (10 + (i % 4) * 8),
  }))
  return (
    <div className="x-snow" aria-hidden="true">
      {flakes.map((f, i) => (
        <span key={i} style={{ left: `${f.left}%`, animationDelay: `${f.delay}s`, animationDuration: `${f.dur}s`, fontSize: f.size, '--drift': `${f.drift}px` }}>❄</span>
      ))}
    </div>
  )
}
