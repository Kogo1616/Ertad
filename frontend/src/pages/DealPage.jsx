import { useEffect, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { isBuyer, isStaff, staffRoleName, useAuth } from '../auth'
import { Countdown, CopyButton, ErrorBox, Loading, ProductImage, StaffBuyerNote, useLoad } from '../components/ui'
import { money, when } from '../format'

// How the buyer arrived here → reservation Source.
const SRC = { list: 'DealsList', store: 'StorePage', sms: 'Notification' }

export default function DealPage() {
  const { slug } = useParams()
  const [params] = useSearchParams()
  const { me } = useAuth()
  const nav = useNavigate()
  const [data, loadError] = useLoad(() => api('/deals/' + slug), [slug, me?.authenticated])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  // Remember attribution across the login redirect.
  useEffect(() => {
    const ref = params.get('ref'), src = params.get('src')
    if (ref || src) sessionStorage.setItem('attr:' + slug, JSON.stringify({ ref, src }))
  }, [slug, params])

  if (loadError) return <main className="page"><ErrorBox error={loadError} /></main>
  if (!data) return <main className="page"><Loading /></main>
  const { deal, participants, myReservation, myUserId } = data

  const live = (deal.status === 'Open' || deal.status === 'Activated') && new Date(deal.deadline) > Date.now()
  const need = Math.max(0, deal.min - deal.confirmed)
  const slotsCount = Math.max(deal.min, Math.min(participants.length, deal.maxStock))
  const shareUrl = `${window.location.origin}/d/${deal.slug}${myUserId ? '?ref=' + myUserId : ''}`

  const join = async () => {
    if (myReservation) { nav('/my/reservations/' + myReservation.id); return }
    if (!isBuyer(me)) { nav('/login?next=' + encodeURIComponent(window.location.pathname + window.location.search)); return }
    setBusy(true); setError(null)
    try {
      let attr = {}
      try { attr = JSON.parse(sessionStorage.getItem('attr:' + slug) || '{}') } catch { /* ignore */ }
      const refUserId = attr.ref ? Number(attr.ref) : null
      const source = refUserId ? 'SharedLink' : SRC[attr.src] ?? 'StorePage'
      const r = await api(`/deals/${slug}/reserve`, { method: 'POST', body: { source, refUserId } })
      nav('/my/reservations/' + r.id)
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <main className="page">
      <div className="split">
        <section className="hero">
          <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
            <div style={{ width: 64, flex: 'none' }}>
              <ProductImage name={deal.productName} imageUrl={deal.imageUrl} height={64} />
            </div>
            <div className="stack-sm" style={{ gap: 0, flex: 1, minWidth: 0 }}>
              <span className="eyebrow">{deal.origin === 'FromRequests' ? 'მყიდველების მოთხოვნით' : 'მაღაზიის შეთავაზება'}</span>
              <h1 style={{ fontSize: 24 }}>{deal.productName}</h1>
              <span className="small muted">{deal.storeName} · {deal.storeCity}</span>
            </div>
          </div>
          <div className="row" style={{ alignItems: 'baseline', gap: 14 }}>
            <span className="hero-price">{money(deal.groupPrice)}</span>
            <span className="hero-old">{money(deal.regularPrice)}</span>
            <span className="chip" style={{ background: 'var(--accent)', color: 'var(--on-accent)', fontSize: 16 }} aria-label={`${deal.percentOff}% ფასდაკლება`}>−{deal.percentOff}%</span>
            <span className="save-chip" style={{ fontSize: 16, padding: '5px 12px' }}>დაზოგე {money(deal.regularPrice - deal.groupPrice)}</span>
          </div>
          <span className="muted" style={{ fontSize: 15 }}>
            {deal.status === 'Activated'
              ? `ჯგუფი შეივსო! ფასი მოქმედებს — დარჩენილი ადგილები ${when(deal.deadline)}-მდე`
              : deal.status === 'Failed' ? 'ჯგუფი ვერ შეგროვდა, შეთავაზება დასრულდა'
              : deal.status === 'Closed' ? 'შეთავაზება დასრულდა'
              : `ფასი აქტიურდება, თუ ${deal.min} ადამიანი შეგროვდება ${when(deal.deadline)}-მდე`}
          </span>
          {live && <Countdown to={deal.deadline} />}
        </section>

        <section className="card" style={{ flex: '2 1 360px', borderRadius: 'var(--r-lg)', padding: 24, gap: 18 }}>
          <div className="row between">
            <span style={{ fontSize: 20, fontWeight: 800 }}>ჯგუფი: {deal.confirmed} / {deal.min}</span>
            {need > 0 && live && <span className="chip tone-warning" style={{ fontSize: 13 }}>კიდევ {need}!</span>}
            {deal.status === 'Activated' && <span className="chip tone-success" style={{ fontSize: 13 }}>შეივსო ✓</span>}
          </div>
          <div className="slots" aria-label={`${deal.confirmed} მონაწილე ${deal.min}-დან`}>
            {Array.from({ length: slotsCount }, (_, i) => {
              const initial = participants[i]
              if (!initial) return <span key={i} className="slot slot-empty" aria-hidden="true">+</span>
              return <span key={i} className="slot slot-filled" aria-hidden="true">{initial}</span>
            })}
          </div>

          <ErrorBox error={error} />
          {isStaff(me) ? (
            <>
              <button type="button" className="btn btn-lg" disabled>შემოუერთდი {money(deal.groupPrice)}-ად</button>
              <StaffBuyerNote roleName={staffRoleName(me)} />
            </>
          ) : myReservation ? (
            <button type="button" className="btn btn-lg" onClick={join}>ჩემი ჯავშანი →</button>
          ) : live ? (
            <button type="button" className="btn btn-lg" disabled={busy} onClick={join}>
              {deal.confirmed >= deal.maxStock ? 'მოლოდინის სიაში ჩაწერა' : `შემოუერთდი ${money(deal.groupPrice)}-ად`}
            </button>
          ) : (
            <button type="button" className="btn btn-lg" disabled>შეთავაზება დასრულდა</button>
          )}

          <div className="stack-sm" style={{ gap: 8 }}>
            <label htmlFor="share" style={{ fontSize: 13, fontWeight: 700 }}>მოიწვიე მეგობარი — ყველას დააახლოებ ფასთან</label>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input id="share" className="input" style={{ fontSize: 14, fontWeight: 500 }} readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <CopyButton text={shareUrl} className="btn btn-soft btn-sm" style={{ height: 46 }} />
            </div>
          </div>
        </section>
      </div>

      <section className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <div className="tile tone-neutral" style={{ gap: 4 }}>
          <strong style={{ color: 'var(--accent-ink)' }}>წინასწარ 0 ₾</strong>
          <span className="small muted">გადახდა მხოლოდ მაღაზიაში, ნივთის გატანისას</span>
        </div>
        <div className="tile tone-neutral" style={{ gap: 4 }}>
          <strong>ვერ შეგროვდა?</strong>
          <span className="small muted">ჯავშანი ავტომატურად უქმდება, არაფერს კარგავ</span>
        </div>
        <div className="tile tone-neutral" style={{ gap: 4 }}>
          <strong>მარაგი: {Math.max(0, deal.maxStock - deal.confirmed)} / {deal.maxStock}</strong>
          <span className="small muted">გატანა {deal.pickupDays} დღეში{deal.warrantyTerms ? ' · ' + deal.warrantyTerms : ''}</span>
        </div>
      </section>
    </main>
  )
}
