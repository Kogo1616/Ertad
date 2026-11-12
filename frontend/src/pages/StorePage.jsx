import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, Loading, ProductImage, useLoad } from '../components/ui'
import { money } from '../format'

export function ProductGrid({ products }) {
  return (
    <div className="grid-auto">
      {products.map((p) => (
        <Link key={p.id} to={`/stores/${p.storeId}/products/${p.id}`} className="product-card">
          <ProductImage name={p.name} imageUrl={p.imageUrl} height={140} radius={18}>
            {p.dealSlug && <span className="chip pimg-badge" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>ჯგუფური {money(p.dealPrice)}</span>}
          </ProductImage>
          <span style={{ fontSize: 15, fontWeight: 700, padding: '0 4px' }}>{p.name}</span>
          <span className="row between" style={{ padding: '0 4px 4px', fontSize: 14 }}>
            <strong>{money(p.regularPrice)}</strong>
            <span style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>{p.interestCount > 0 ? `${p.interestCount} ითხოვს` : 'მოითხოვე პირველმა'}</span>
          </span>
        </Link>
      ))}
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
      <div className="page-head">
        <div className="stack-sm">
          <h1>{store.name}</h1>
          <p className="muted">{store.address} · <a href={store.mapUrl} target="_blank" rel="noreferrer">რუკაზე ნახვა</a></p>
        </div>
      </div>
      <ProductGrid products={store.products} />
    </main>
  )
}
