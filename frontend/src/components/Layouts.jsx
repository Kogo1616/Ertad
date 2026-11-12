
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { isStaff, staffRoleName, useAuth } from '../auth'
import { Loading, Logo, StaffBuyerNote } from './ui'
import SearchBox from './SearchBox'
import ThemeToggle from './ThemeToggle'

/** Round icon button, same size and style as the theme toggle. */
function LogoutButton({ onClick }) {
  return (
    <button type="button" className="icon-btn" onClick={onClick} aria-label="გასვლა" title="გასვლა">
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" />
      </svg>
    </button>
  )
}

/** Public site: header with nav, search, my reservations, login. */
export function SiteLayout() {
  const { me, logout } = useAuth()
  const nav = useNavigate()
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
          <SearchBox />
          {/* Right-hand actions stay together on one line; on narrow screens the whole group wraps. */}
          <div className="header-actions">
            {!staff && <Link to="/my/reservations" className="header-link" aria-label="ჩემი ჯავშნები">
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 8a2 2 0 0 0 2-2V5h14v1a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2v1H5v-1a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z" /><path d="M10 9h4M10 15h4" />
              </svg>
              <span className="label">ჩემი ჯავშნები</span>
            </Link>}
            <ThemeToggle />
            {buyer && <span className="me-avatar" title={me.phone} aria-label={'შესული ხარ: ' + me.phone}>{me.initial}</span>}
            {staff && <Link to={me.role === 'Admin' ? '/admin' : '/store'} className="btn-dark">პანელი</Link>}
            {me?.authenticated && <LogoutButton onClick={signOut} />}
            {!me?.authenticated && <Link to="/login" className="btn-dark">შესვლა</Link>}
          </div>
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
  // Staff stay logged in as staff: explain instead of bouncing them to the buyer login.
  if (isStaff(me)) return <main className="page" style={{ maxWidth: 640 }}><StaffBuyerNote roleName={staffRoleName(me)} /></main>
  if (!me.authenticated) return <Navigate to={'/login?next=' + encodeURIComponent(loc.pathname + loc.search)} replace />
  return children
}
