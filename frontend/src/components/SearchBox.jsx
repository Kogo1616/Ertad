import { useEffect, useId, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { money } from '../format'
import { SearchIcon } from './ui'

const LIMIT = 6
const DEBOUNCE_MS = 180

/**
 * Header search with live suggestions as you type (WAI-ARIA combobox pattern).
 * ↑/↓ move, Enter opens the highlighted product (or all results), Esc closes.
 */
export default function SearchBox() {
  const nav = useNavigate()
  const listId = useId()
  const boxRef = useRef(null)
  const [q, setQ] = useState('')
  const [items, setItems] = useState([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [active, setActive] = useState(-1) // highlighted row; items.length = "all results" row

  // Fetch suggestions (debounced; a newer query cancels the older request).
  useEffect(() => {
    const term = q.trim()
    if (!term) { setItems([]); setLoading(false); return }
    const ctrl = new AbortController()
    setLoading(true)
    const t = setTimeout(() => {
      api(`/products?q=${encodeURIComponent(term)}&limit=${LIMIT}`, { signal: ctrl.signal })
        .then((r) => { setItems(r); setActive(-1); setLoading(false) })
        .catch((e) => { if (e.name !== 'AbortError') { setItems([]); setLoading(false) } })
    }, DEBOUNCE_MS)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [q])

  // Close when clicking outside.
  useEffect(() => {
    const onDown = (e) => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const close = () => { setOpen(false); setActive(-1) }
  const goTo = (p) => {
    close(); setQ('')
    nav(p.deal ? `/d/${p.deal.slug}?src=list` : `/stores/${p.storeId}/products/${p.id}`)
  }
  const goAll = () => {
    const term = q.trim()
    close()
    nav('/stores' + (term ? '?q=' + encodeURIComponent(term) : ''))
  }

  const rows = items.length + (q.trim() ? 1 : 0) // + "all results"
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => (rows ? (a + 1) % rows : -1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (rows ? (a <= 0 ? rows - 1 : a - 1) : -1)) }
    else if (e.key === 'Escape') { close() }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (open && active >= 0 && active < items.length) goTo(items[active])
      else goAll()
    }
  }

  const showList = open && q.trim().length > 0
  const optionId = (i) => `${listId}-opt-${i}`

  return (
    <div className="search-wrap" ref={boxRef}>
      <form className="search" role="search" onSubmit={(e) => { e.preventDefault(); goAll() }}>
        <SearchIcon />
        <input
          type="search"
          role="combobox"
          aria-label="ძიება"
          aria-autocomplete="list"
          aria-expanded={showList}
          aria-controls={listId}
          aria-activedescendant={showList && active >= 0 ? optionId(active) : undefined}
          placeholder="მოძებნე პროდუქტი ან მაღაზია"
          autoComplete="off"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
      </form>

      {showList && (
        <ul className="suggest" id={listId} role="listbox" aria-label="შედეგები">
          {loading && items.length === 0 && <li className="suggest-empty" aria-live="polite">ვეძებ…</li>}
          {!loading && items.length === 0 && <li className="suggest-empty" aria-live="polite">„{q.trim()}“ — ვერაფერი მოიძებნა</li>}
          {items.map((p, i) => (
            <li
              key={p.id}
              id={optionId(i)}
              role="option"
              aria-selected={active === i}
              className={'suggest-item' + (active === i ? ' active' : '')}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => { e.preventDefault(); goTo(p) }} // mousedown: fires before the input loses focus
            >
              <span className="suggest-thumb">
                {p.imageUrl ? <img src={p.imageUrl} alt="" /> : <span aria-hidden="true">{p.name[0]}</span>}
              </span>
              <span className="suggest-text">
                <span className="suggest-name">{p.name}</span>
                <span className="suggest-store">{p.storeName}</span>
              </span>
              <span className="suggest-price">
                {p.deal ? (
                  <>
                    <strong style={{ color: 'var(--accent-ink)' }}>{money(p.deal.groupPrice)}</strong>
                    <span className="strike" style={{ fontSize: 13 }}>{money(p.deal.regularPrice)}</span>
                  </>
                ) : <strong>{money(p.regularPrice)}</strong>}
              </span>
            </li>
          ))}
          {items.length > 0 && (
            <li
              id={optionId(items.length)}
              role="option"
              aria-selected={active === items.length}
              className={'suggest-all' + (active === items.length ? ' active' : '')}
              onMouseEnter={() => setActive(items.length)}
              onMouseDown={(e) => { e.preventDefault(); goAll() }}
            >
              ყველა შედეგი „{q.trim()}“-ისთვის →
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
