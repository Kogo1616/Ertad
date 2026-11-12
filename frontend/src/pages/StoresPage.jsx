import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ClockIcon, ErrorBox, Loading, PhoneIcon, PinIcon, StoreLogo, useLoad } from '../components/ui'
import { ProductGrid } from './StorePage'
import Select from '../components/Select'

const SORTS = [
  ['recommended', 'რეკომენდებული'],
  ['deals', 'ყველაზე მეტი აქცია'],
  ['demand', 'ყველაზე მოთხოვნადი'],
  ['discount', 'ყველაზე დიდი ფასდაკლება'],
  ['name', 'ანბანით'],
]

export function StoreCard({ s }) {
  const images = s.previewImages ?? []
  return (
    <article className="store-card-lg">
      <Link to={`/stores/${s.id}`} className="store-cover" aria-label={`${s.name} — კატალოგი`} tabIndex={-1}>
        {images.length > 0
          ? images.map((src, i) => <img key={i} src={src} alt="" loading="lazy" />)
          : <span className="store-cover-empty" aria-hidden="true">{s.name.replace('[', '')[0]}</span>}
        {s.activeDeals > 0 && <span className="chip store-cover-badge" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>{s.activeDeals} აქტიური აქცია</span>}
        {s.maxDiscount != null && <span className="pimg-off">−{s.maxDiscount}%-მდე</span>}
      </Link>

      <div className="store-body">
        <div className="store-title">
          <span className="store-logo-ring"><StoreLogo name={s.name} imageUrl={s.imageUrl} size={56} /></span>
          <div style={{ minWidth: 0 }}>
            <h2 style={{ fontSize: 19 }}><Link to={`/stores/${s.id}`} className="store-name">{s.name}</Link></h2>
            {s.city && <span className="chip tone-neutral" style={{ marginTop: 4 }}>{s.city}</span>}
          </div>
        </div>

        {s.description && <p className="store-desc">{s.description}</p>}

        <ul className="store-info">
          {s.address && (
            <li><PinIcon />
              {s.mapUrl ? <a href={s.mapUrl} target="_blank" rel="noreferrer">{s.address}</a> : <span>{s.address}</span>}
            </li>
          )}
          {s.workingHours && <li><ClockIcon /><span>{s.workingHours}</span></li>}
          {s.phone && <li><PhoneIcon /><a href={`tel:${s.phone.replace(/[^\d+]/g, '')}`}>{s.phone}</a></li>}
        </ul>

        <dl className="store-stats">
          <div><dt>პროდუქტი</dt><dd>{s.productCount}</dd></div>
          <div><dt>აქტიური აქცია</dt><dd style={s.activeDeals > 0 ? { color: 'var(--accent-ink)' } : undefined}>{s.activeDeals}</dd></div>
          <div><dt>ითხოვს ფასს</dt><dd>{s.interestCount}</dd></div>
        </dl>

        <Link to={`/stores/${s.id}${s.activeDeals > 0 ? '?filter=deal' : ''}`} className={'btn btn-block' + (s.activeDeals > 0 ? '' : ' btn-soft')}>
          {s.activeDeals > 0 ? `ნახე აქციები (${s.activeDeals}) →` : 'მაღაზიის კატალოგი →'}
        </Link>
      </div>
    </article>
  )
}

export default function StoresPage() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || '' // product search from the header
  const [stores, error] = useLoad(() => api('/stores'), [])
  const [results] = useLoad(() => (q ? api('/products?q=' + encodeURIComponent(q)) : Promise.resolve(null)), [q])

  const name = params.get('name') || ''
  const city = params.get('city') || ''
  const onlyDeals = params.get('deals') === '1'
  const sort = SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'recommended'
  const set = (key, value) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  const cities = useMemo(() => [...new Set((stores ?? []).map((s) => s.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ka')), [stores])

  const shown = useMemo(() => {
    if (!stores) return []
    const term = name.trim().toLowerCase()
    const list = stores.filter((s) =>
      (!city || s.city === city) &&
      (!onlyDeals || s.activeDeals > 0) &&
      (!term || [s.name, s.address, s.description].some((t) => t?.toLowerCase().includes(term))))
    const by = {
      recommended: (a, b) => (b.activeDeals - a.activeDeals) || (b.interestCount - a.interestCount) || a.name.localeCompare(b.name, 'ka'),
      deals: (a, b) => b.activeDeals - a.activeDeals,
      demand: (a, b) => b.interestCount - a.interestCount,
      discount: (a, b) => (b.maxDiscount ?? -1) - (a.maxDiscount ?? -1),
      name: (a, b) => a.name.localeCompare(b.name, 'ka'),
    }[sort]
    return [...list].sort(by)
  }, [stores, name, city, onlyDeals, sort])

  const filtered = name || city || onlyDeals

  return (
    <main className="page">
      {q && (
        <section className="stack">
          <h1>ძიება: „{q}“</h1>
          {results?.length === 0 && <div className="empty">ვერაფერი მოიძებნა</div>}
          {results?.length > 0 && <ProductGrid products={results} />}
        </section>
      )}

      <section className="stack" style={{ gap: 20 }}>
        <div className="stack-sm">
          {q ? <h2>მაღაზიები</h2> : <h1>მაღაზიები</h1>}
          <p className="muted">იპოვე მაღაზია, ნახე მისი ჯგუფური ფასები ან მოითხოვე ფასდაკლება სასურველ ნივთზე.</p>
        </div>

        <div className="stores-toolbar" role="search" aria-label="მაღაზიების ფილტრი">
          <label className="search" htmlFor="store-filter" style={{ flex: '1 1 240px' }}>
            <span className="sr-only">მაღაზიის ძებნა</span>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input id="store-filter" type="search" placeholder="სახელი, მისამართი…" value={name} onChange={(e) => set('name', e.target.value)} />
          </label>
          {cities.length > 1 && (
            <div role="group" aria-label="ქალაქი" className="filters">
              <button type="button" className="filter" aria-pressed={!city} onClick={() => set('city', '')}>ყველა ქალაქი</button>
              {cities.map((c) => <button key={c} type="button" className="filter" aria-pressed={city === c} onClick={() => set('city', city === c ? '' : c)}>{c}</button>)}
            </div>
          )}
          <button type="button" className="filter" aria-pressed={onlyDeals} onClick={() => set('deals', onlyDeals ? '' : '1')}>
            {onlyDeals ? '✓ ' : ''}მხოლოდ აქციებით
          </button>
          <Select label="დალაგება" value={sort} options={SORTS} onChange={(v) => set('sort', v === 'recommended' ? '' : v)} />
        </div>

        <ErrorBox error={error} />
        {!stores && !error && <Loading />}
        {stores && <p className="small muted" aria-live="polite">{shown.length} მაღაზია</p>}
        {stores && shown.length === 0 && (
          <div className="empty">
            ამ ფილტრით მაღაზია ვერ მოიძებნა.{' '}
            {filtered && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams(q ? { q } : {}, { replace: true })}>ფილტრის გასუფთავება</button>}
          </div>
        )}
        <div className="grid-stores">
          {shown.map((s) => <StoreCard key={s.id} s={s} />)}
        </div>
      </section>
    </main>
  )
}
