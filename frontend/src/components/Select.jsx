import { useEffect, useId, useRef, useState } from 'react'

/**
 * Styled replacement for <select> (WAI-ARIA "select-only combobox").
 * Focus stays on the button; ↑/↓ Home/End move, Enter/Space choose, Esc closes, typing jumps to a match.
 *   <Select label="დალაგება" value={sort} options={[['a', 'Label A'], …]} onChange={setSort} />
 */
export default function Select({ label, value, options, onChange, className = '' }) {
  const id = useId()
  const rootRef = useRef(null)
  const [open, setOpen] = useState(false)
  const selectedIndex = Math.max(0, options.findIndex(([v]) => v === value))
  const [active, setActive] = useState(selectedIndex)
  const typed = useRef({ text: '', at: 0 })

  // Close on outside click.
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (!rootRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  // Keep the highlighted option in view when moving with the keyboard.
  useEffect(() => {
    if (open) document.getElementById(`${id}-opt-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, id])

  const openMenu = () => { setActive(selectedIndex); setOpen(true) }
  const choose = (i) => { setOpen(false); if (options[i][0] !== value) onChange(options[i][0]) }

  const onKeyDown = (e) => {
    const last = options.length - 1
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openMenu(); return }
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(last, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0) }
    else if (e.key === 'End') { e.preventDefault(); setActive(last) }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active) }
    else if (e.key === 'Escape' || e.key === 'Tab') { setOpen(false) }
    else if (e.key.length === 1) {
      // Type-ahead: jump to the first option starting with the typed letters.
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 600 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const hit = options.findIndex(([, l]) => l.toLowerCase().startsWith(typed.current.text))
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <div className={'select ' + className} ref={rootRef}>
      <span id={`${id}-label`} className="sr-only">{label}</span>
      <button
        type="button"
        role="combobox"
        className="select-btn"
        aria-labelledby={`${id}-label ${id}-value`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={onKeyDown}
      >
        <span className="select-prefix" aria-hidden="true">{label}:</span>
        <span id={`${id}-value`} className="select-value">{options[selectedIndex]?.[1]}</span>
        <svg className="select-chevron" aria-hidden="true" width="12" height="8" viewBox="0 0 12 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 1.5l5 5 5-5" /></svg>
      </button>
      {open && (
        <ul className="select-menu" role="listbox" id={`${id}-list`} aria-labelledby={`${id}-label`} tabIndex={-1}>
          {options.map(([v, l], i) => (
            <li
              key={v}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={v === value}
              className={'select-option' + (i === active ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // keep focus on the button
              onClick={() => choose(i)}
            >
              <span>{l}</span>
              {v === value && (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
