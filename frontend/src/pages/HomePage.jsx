import { Link } from 'react-router-dom'
import { api } from '../api'
import { Faq } from '../components/SiteParts'
import { Countdown, DealCard, HowItWorks, ProductImage, Progress, useLoad } from '../components/ui'
import { money } from '../format'
import { ProductGrid } from './StorePage'
import { StoreCard } from './StoresPage'

/** Big "featured deal" card in the hero: the live deal with the biggest discount. */
function FeaturedDeal({ deal }) {
  const saving = deal.regularPrice - deal.groupPrice
  return (
    <Link to={`/d/${deal.slug}?src=list`} className="featured">
      <ProductImage name={deal.productName} imageUrl={deal.imageUrl} height={220}>
        <span className="chip pimg-badge" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>მთავარი აქცია</span>
        <span className="pimg-off">−{deal.percentOff}%</span>
      </ProductImage>
      <div className="stack-sm" style={{ gap: 4 }}>
        <strong style={{ fontSize: 18 }}>{deal.productName}</strong>
        <span className="small muted">{deal.storeName} · {deal.storeCity}</span>
      </div>
      <div className="price-line" style={{ padding: 0 }}>
        <span className="now" style={{ fontSize: 34 }}>{money(deal.groupPrice)}</span>
        <span className="strike" style={{ fontSize: 20 }}>{money(deal.regularPrice)}</span>
        <span className="save-chip">დაზოგე {money(saving)}</span>
      </div>
      <Progress value={deal.confirmed} max={deal.min} />
      <span className="small"><strong>{deal.confirmed} / {deal.min}</strong> ჯავშანი · აქტიურდება {deal.min} ადამიანზე</span>
      <Countdown to={deal.deadline} />
      <span className="btn btn-block">შემოუერთდი {money(deal.groupPrice)}-ად →</span>
    </Link>
  )
}

function Stat({ value, label, accent }) {
  return (
    <div className="home-stat">
      <strong style={accent ? { color: 'var(--accent-ink)' } : undefined}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export default function HomePage() {
  const [deals] = useLoad(() => api('/deals'), [])
  const [stats] = useLoad(() => api('/stats'), [])
  const [popular] = useLoad(() => api('/products/popular?limit=4'), [])
  const [stores] = useLoad(() => api('/stores'), [])

  const live = (deals ?? []).filter((d) => new Date(d.deadline) > Date.now())
  const featured = [...live].sort((a, b) => b.percentOff - a.percentOff)[0]
  const endingSoon = [...live].sort((a, b) => new Date(a.deadline) - new Date(b.deadline)).slice(0, 3)
  const topStores = [...(stores ?? [])].sort((a, b) => (b.activeDeals - a.activeDeals) || (b.interestCount - a.interestCount)).slice(0, 3)

  return (
    <main className="page" style={{ gap: 48 }}>
      {/* Hero */}
      <section className="home-hero">
        <div className="stack" style={{ gap: 20, flex: '1 1 440px', minWidth: 0 }}>
          <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>ჯგუფური შესყიდვები</span>
          <h1 className="home-title">ერთად იყიდე —<br /><span style={{ color: 'var(--accent-ink)' }}>იაფად</span></h1>
          <p className="muted" style={{ fontSize: 18, maxWidth: 520 }}>
            შეუერთდი სხვა მყიდველებს. როცა ჯგუფი შეივსება, მაღაზია ჯგუფურ ფასს გაძლევს. წინასწარ არაფერს იხდი — გადახდა მხოლოდ მაღაზიაში.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <Link to="/deals" className="btn btn-lg">აქტიური შეთავაზებები</Link>
            <Link to="/how" className="btn btn-lg btn-soft">როგორ მუშაობს</Link>
          </div>
          <ul className="home-points">
            <li>✓ წინასწარ 0 ₾</li>
            <li>✓ ვერ შეგროვდა — ავტომატურად უქმდება</li>
            <li>✓ კოდით გატანა მაღაზიაში</li>
          </ul>
        </div>
        <div style={{ flex: '0 1 420px', minWidth: 0, width: '100%' }}>
          {featured ? <FeaturedDeal deal={featured} /> : (
            <div className="featured featured-empty" aria-hidden="true">
              <span className="logo-mark big"><span /><span /><span /></span>
              <span className="muted">აქციები მალე გამოჩნდება</span>
            </div>
          )}
        </div>
      </section>

      {/* Live numbers */}
      {stats && (
        <section className="home-stats" aria-label="ერთად ციფრებში">
          <Stat value={stats.activeDeals} label="აქტიური აქცია" accent />
          <Stat value={stats.stores} label="მაღაზია" />
          <Stat value={stats.reservations} label="ჯავშანი" />
          <Stat value={money(stats.saved)} label="ჯამში დაზოგილი" accent />
        </section>
      )}

      {/* Ending soon */}
      {endingSoon.length > 0 && (
        <section className="stack">
          <div className="row between">
            <h2>მალე მთავრდება</h2>
            <Link to="/deals" className="small">ყველა შეთავაზება →</Link>
          </div>
          <div className="grid-cards">
            {endingSoon.map((d) => <DealCard key={d.id} deal={d} to={`/d/${d.slug}?src=list`} />)}
          </div>
        </section>
      )}

      {/* Most requested */}
      {popular?.length > 0 && (
        <section className="stack">
          <div className="row between">
            <div className="stack-sm" style={{ gap: 2 }}>
              <h2>ყველაზე მოთხოვნადი</h2>
              <span className="small muted">მოითხოვე ჯგუფური ფასი — რაც მეტი ითხოვს, მით უფრო სწრაფად აცხადებს მაღაზია აქციას</span>
            </div>
            <Link to="/stores" className="small">კატალოგი →</Link>
          </div>
          <ProductGrid products={popular} />
        </section>
      )}

      <HowItWorks />

      {/* Stores */}
      {topStores.length > 0 && (
        <section className="stack">
          <div className="row between">
            <h2>მაღაზიები</h2>
            <Link to="/stores" className="small">ყველა მაღაზია →</Link>
          </div>
          <div className="grid-stores">
            {topStores.map((s) => <StoreCard key={s.id} s={s} />)}
          </div>
        </section>
      )}

      {/* For stores */}
      <section className="cta-band home-partner">
        <div className="stack-sm" style={{ gap: 6 }}>
          <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>მაღაზიებისთვის</span>
          <strong style={{ fontSize: 22 }}>მეტი გაყიდვა ფასდაკლების რისკის გარეშე</strong>
          <span className="muted">ფასს აკლებ მხოლოდ მაშინ, როცა გაყიდვა გარანტირებულია. იხდი მხოლოდ გაყიდულ ნივთზე.</span>
        </div>
        <div className="row" style={{ gap: 10 }}>
          <Link to="/for-stores#apply" className="btn">გახდი პარტნიორი</Link>
          <Link to="/for-stores" className="btn btn-soft">დაწვრილებით</Link>
        </div>
      </section>

      <Faq limit={4} />
    </main>
  )
}
