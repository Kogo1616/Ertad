import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, Loading, ProductImage, Progress, StoreLogo, useLoad } from '../components/ui'
import { money, timeLeft } from '../format'

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
                  <span className="muted">{timeLeft(d.deadline)}{new Date(d.deadline) > Date.now() ? ' დარჩა' : ''}</span>
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

export default function StorePage() {
  const { storeId } = useParams()
  const [store, error] = useLoad(() => api('/stores/' + storeId), [storeId])
  if (error) return <main className="page"><ErrorBox error={error} /></main>
  if (!store) return <main className="page"><Loading /></main>

  return (
    <main className="page">
      <nav aria-label="ნავიგაცია" className="row small muted">
        <Link to="/stores" className="muted">მაღაზიები</Link><span>/</span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{store.name}, {store.city}</span>
      </nav>
      <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}>
        <StoreLogo name={store.name} imageUrl={store.imageUrl} size={80} />
        <div className="stack-sm" style={{ minWidth: 0 }}>
          <h1>{store.name}</h1>
          <p className="muted">{store.address} · <a href={store.mapUrl} target="_blank" rel="noreferrer">რუკაზე ნახვა</a></p>
        </div>
      </div>
      <ProductGrid products={store.products} />
    </main>
  )
}
