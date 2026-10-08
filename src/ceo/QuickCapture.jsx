import { useEffect, useRef, useState } from 'react'
import { useCeo } from './CeoStore.jsx'
import { toast } from './ui.jsx'

export function openCapture() { window.dispatchEvent(new Event('ceo-capture')) }

/** Floating "+" and ⌘K / Ctrl+K anywhere → one box → Inbox. No fields, no decisions. */
export default function QuickCapture() {
  const { capture, setupNeeded } = useCeo()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(true) }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener('ceo-capture', onOpen)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('ceo-capture', onOpen) }
  }, [])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 20) }, [open])

  async function submit(e) {
    e.preventDefault()
    if (!text.trim()) return
    await capture(text)
    toast('Captured', 'Saved to your Inbox — back to what you were doing.')
    setText('')
    setOpen(false)
  }

  if (setupNeeded) return null
  return (
    <>
      <button className="c-fab" onClick={() => setOpen(true)} aria-label="Quick capture" title="Quick capture (⌘K)">+</button>
      {open && (
        <div className="c-overlay" style={{ alignItems: 'flex-start', paddingTop: '18vh' }} onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false) }}>
          <form onSubmit={submit} style={{ width: '100%', maxWidth: 560 }} onKeyDown={e => { if (e.key === 'Escape') setOpen(false) }}>
            <div className="c-eyebrow" style={{ color: 'var(--sky)', marginBottom: 10 }}>Quick capture → Inbox</div>
            <div className="c-capture">
              <input ref={inputRef} autoFocus value={text} onChange={e => setText(e.target.value)} placeholder="What's on your mind? Press Enter." />
              <button className="c-btn c-btn-sky" style={{ border: 0 }} type="submit">Save</button>
            </div>
            <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 12, marginTop: 10 }}>
              Don&apos;t sort it now. You&apos;ll triage the Inbox during Tomorrow Setup.
            </div>
          </form>
        </div>
      )}
    </>
  )
}
