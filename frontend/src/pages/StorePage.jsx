import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, LiveTimeLeft, Loading, ProductImage, Progress, StoreLogo, useLoad } from '../components/ui'
import { money } from '../format'

/** Catalog card. With a live group deal it sells the saving: group price vs crossed-out regular price. */
export function ProductGrid({ products }) {
  return (
    <div className="grid-items">
      {products.map((p) => {
        const d = p.deal
        const off = d ? Math.round(((d.regularPrice - d.groupPrice) / d.regularPrice) * 100) : 0
        return (
          <Link key={p.id} to={d ? `/d/${d.slug}?src=store` : `/stores/${p.storeId}/products/${p.id}`} className="product-card">
            <ProductImage name={p.name} imageUrl={p.imageUrl} height={160}>
              {d && <span className="chip pimg-badge" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>ჯგუფური ფასი</span>}
              {d && <span className="pimg-off">−{off}%</span>}
            </ProductImage>
            <span style={{ fontSize: 15, fontWeight: 700, padding: '0 4px' }}>{p.name}</span>
            {d ? (
              <div className="stack-sm" style={{ padding: '0 4px 4px', gap: 8 }}>
                <div className="price-line" style={{ padding: 0 }}>
                  <span className="now">{money(d.groupPrice)}</span>
                  <span className="strike" style={{ fontSize: 15 }}>{money(d.regularPrice)}</span>
                  <span className="small" style={{ color: 'var(--accent-ink)', fontWeight: 700, marginLeft: 'auto' }}>დაზოგე {money(d.regularPrice - d.groupPrice)}</span>
                </div>
                <Progress value={d.confirmed} max={d.min} />
                <div className="row between small">
                  <strong>{d.status === 'Activated' ? 'ჯგუფი შეივსო ✓' : `${d.confirmed} / ${d.min} ჯავშანი`}</strong>
                  <span className="muted"><LiveTimeLeft to={d.deadline} suffix=" დარჩა" /></span>
                </div>
              </div>
            ) : (
              <div className="stack-sm" style={{ padding: '0 4px 4px', gap: 4 }}>
                <strong style={{ fontSize: 22 }}>{money(p.regularPrice)}</strong>
                <span className="small" style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>
                  {p.interestCount > 0 ? `${p.interestCount} ითხოვს ჯგუფურ ფასს` : 'მოითხოვე ჯგუფური ფასი'}
                </span>
              </div>
            )}
          </Link>
        )
      })}
    </div>
  )
}

const FILTERS = [
  ['all', 'ყველა'],
  ['deal', 'ჯგუფური ფასით'],
  ['request', 'ფასის მოთხოვნა'],
]
const SORTS = [
  ['recommended', 'რეკომენდებული'],
  ['priceAsc', 'ფასი: იაფიდან'],
  ['priceDesc', 'ფასი: ძვირიდან'],
  ['discount', 'ყველაზე დიდი ფასდაკლება'],
]

// The price a buyer would pay now, and the discount, for sorting.
const currentPrice = (p) => (p.deal ? p.deal.groupPrice : p.regularPrice)
const discount = (p) => (p.deal ? (p.deal.regularPrice - p.deal.groupPrice) / p.deal.regularPrice : 0)

export default function StorePage() {
  const { storeId } = useParams()
  const [params, setParams] = useSearchParams()
  const [store, error] = useLoad(() => api('/stores/' + storeId), [storeId])
  const filter = FILTERS.some(([k]) => k === params.get('filter')) ? params.get('filter') : 'all'
  const sort = SORTS.some(([k]) => k === params.get('sort')) ? params.get('sort') : 'recommended'

  // Kept in the URL, so a filtered view can be shared or survives "back".
  const update = (key, value, fallback) => {
    const next = new URLSearchParams(params)
    if (value === fallback) next.delete(key); else next.set(key, value)
    setParams(next, { replace: true })
  }

  const products = useMemo(() => {
    if (!store) return []
    const list = store.products.filter((p) => filter === 'all' || (filter === 'deal' ? !!p.deal : !p.deal))
    const by = {
      recommended: (a, b) => (!!b.deal - !!a.deal) || (b.interestCount - a.interestCount),
      priceAsc: (a, b) => currentPrice(a) - currentPrice(b),
      priceDesc: (a, b) => currentPrice(b) - currentPrice(a),
      discount: (a, b) => discount(b) - discount(a),
    }[sort]
    return [...list].sort(by)
  }, [store, filter, sort])

  if (error) return <main className="page"><ErrorBox error={error} /></main>
  if (!store) return <main className="page"><Loading /></main>

  return (
    <main className="page">
      <nav aria-label="ნავიგაცია" className="row small muted">
        <Link to="/stores" className="muted">მაღაზიები</Link><span>/</span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{store.name}, {store.city}</span>
      </nav>
      <div className="page-head" style={{ alignItems: 'center' }}>
        <div className="row" style={{ gap: 20, flexWrap: 'nowrap', minWidth: 0 }}>
          <StoreLogo name={store.name} imageUrl={store.imageUrl} size={80} />
          <div className="stack-sm" style={{ minWidth: 0 }}>
            <h1>{store.name}</h1>
            <p className="muted">{store.address} · <a href={store.mapUrl} target="_blank" rel="noreferrer">რუკაზე ნახვა</a></p>
          </div>
        </div>
        <div className="catalog-tools">
          <div role="group" aria-label="ფილტრი" className="filters">
            {FILTERS.map(([key, label]) => (
              <button key={key} type="button" className="filter" aria-pressed={filter === key} onClick={() => update('filter', key, 'all')}>{label}</button>
            ))}
          </div>
          <label className="sort-select" htmlFor="sort">
            <span className="sr-only">დალაგება</span>
            <select id="sort" className="input" value={sort} onChange={(e) => update('sort', e.target.value, 'recommended')}>
              {SORTS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
        </div>
      </div>
      <p className="small muted" aria-live="polite">{products.length} პროდუქტი</p>
      {products.length > 0
        ? <ProductGrid products={products} />
        : <div className="empty">ამ ფილტრით პროდუქტი არ მოიძებნა. <button type="button" className="btn btn-ghost btn-sm" onClick={() => update('filter', 'all', 'all')}>ყველას ჩვენება</button></div>}
    </main>
  )
}
