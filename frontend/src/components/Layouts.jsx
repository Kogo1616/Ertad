import { useState } from 'react'
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Loading, Logo, SearchIcon } from './ui'
import ThemeToggle from './ThemeToggle'

/** Public site: header with nav, search, my reservations, login. */
export function SiteLayout() {
  const { me, logout } = useAuth()
  const nav = useNavigate()
  const [q, setQ] = useState('')
  const search = (e) => {
    e.preventDefault()
    nav('/stores' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : ''))
  }
  const buyer = me?.authenticated && me.role === 'Buyer'
  const staff = me?.authenticated && me.role !== 'Buyer'
  const signOut = async () => { await logout(); nav('/deals') }

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <Logo />
          <nav aria-label="მთავარი მენიუ" className="main-nav">
            <NavLink to="/stores">მაღაზიები</NavLink>
            <NavLink to="/deals">აქტიური შეთავაზებები</NavLink>
            <NavLink to="/how">როგორ მუშაობს</NavLink>
          </nav>
          <form className="search" onSubmit={search} role="search">
            <SearchIcon />
            <input type="search" aria-label="ძიება" placeholder="მოძებნე პროდუქტი ან მაღაზია" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          <Link to="/my/reservations" className="header-link">ჩემი ჯავშნები</Link>
          <ThemeToggle />
          {buyer && <span className="me-avatar" title={me.phone} aria-label={'შესული ხარ: ' + me.phone}>{me.initial}</span>}
          {staff && <Link to={me.role === 'Admin' ? '/admin' : '/store'} className="btn-dark">პანელი</Link>}
          {me?.authenticated && <button type="button" className="btn btn-ghost btn-sm" onClick={signOut}>გასვლა</button>}
          {!me?.authenticated && <Link to="/login" className="btn-dark">შესვლა</Link>}
        </div>
      </header>
      <Outlet />
    </>
  )
}

/** Store panel: left sidebar. Requires StoreStaff. */
export function StoreLayout() {
  const { me, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const signOut = async () => { await logout(); nav('/deals') }
  if (me == null) return <Loading />
  if (!me.authenticated || me.role !== 'StoreStaff') return <Navigate to={'/staff/login?next=' + encodeURIComponent(loc.pathname)} replace />

  return (
    <div className="panel">
      <nav aria-label="მაღაზიის მენიუ" className="sidebar">
        <Logo to="/store" />
        <NavLink end to="/store" className="side-link">მოთხოვნები</NavLink>
        <NavLink to="/store/deals/new" className="side-link">შეთავაზებები</NavLink>
        <NavLink to="/store/redeem" className="side-link">კოდის შემოწმება</NavLink>
        <NavLink to="/store/reports" className="side-link">ანგარიშები</NavLink>
        <div className="store-card">
          <span style={{ fontSize: 13, fontWeight: 700 }}>{me.storeName}</span>
          <span className="muted" style={{ fontSize: 12 }}>{me.storeCity} · პილოტი</span>
        </div>
        <button type="button" className="btn btn-white btn-sm" style={{ marginTop: 10 }} onClick={signOut}>გასვლა</button>
        <ThemeToggle />
      </nav>
      <main className="panel-main">
        <Outlet />
      </main>
    </div>
  )
}

export function RequireBuyer({ children }) {
  const { me } = useAuth()
  const loc = useLocation()
  if (me == null) return <Loading />
  if (!me.authenticated || me.role !== 'Buyer') return <Navigate to={'/login?next=' + encodeURIComponent(loc.pathname + loc.search)} replace />
  return children
}
