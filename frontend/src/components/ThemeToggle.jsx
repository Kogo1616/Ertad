import { useEffect, useState } from 'react'

// The theme lives on <html data-theme="light|dark">. With no saved choice, CSS follows the OS.
// index.html applies the saved choice before React loads, so there is no flash.
const KEY = 'ertad-theme'
const media = window.matchMedia('(prefers-color-scheme: dark)')

function currentTheme() {
  const attr = document.documentElement.dataset.theme
  return attr === 'light' || attr === 'dark' ? attr : media.matches ? 'dark' : 'light'
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme)

  // Follow OS changes while the user hasn't picked a theme.
  useEffect(() => {
    const onChange = () => setTheme(currentTheme())
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try { localStorage.setItem(KEY, next) } catch { /* private mode: still works for this page */ }
    setTheme(next)
  }

  const dark = theme === 'dark'
  return (
    <button type="button" className="theme-toggle" onClick={toggle}
      aria-label={dark ? 'ღია თემა' : 'მუქი თემა'} title={dark ? 'ღია თემა' : 'მუქი თემა'}>
      {dark ? (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" />
          <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  )
}
