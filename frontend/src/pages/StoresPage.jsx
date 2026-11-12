import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, Loading, StoreLogo, useLoad } from '../components/ui'
import { ProductGrid } from './StorePage'

export default function StoresPage() {
  const [params] = useSearchParams()
  const q = params.get('q') || ''
  const [stores, error] = useLoad(() => api('/stores'), [])
  const [results] = useLoad(() => (q ? api('/products?q=' + encodeURIComponent(q)) : Promise.resolve(null)), [q])

  return (
    <main className="page">
      {q && (
        <section className="stack">
          <h1>ძიება: „{q}“</h1>
          {results?.length === 0 && <div className="empty">ვერაფერი მოიძებნა</div>}
          {results?.length > 0 && <ProductGrid products={results} />}
        </section>
      )}

      <section className="stack">
        {q ? <h2>მაღაზიები</h2> : <h1>მაღაზიები</h1>}
        <ErrorBox error={error} />
        {!stores && !error && <Loading />}
        <div className="grid-items">
          {stores?.map((s) => (
            <Link key={s.id} to={`/stores/${s.id}`} className="product-card" style={{ padding: 20 }}>
              <StoreLogo name={s.name} imageUrl={s.imageUrl} size={64} />
              <span style={{ fontSize: 17, fontWeight: 800 }}>{s.name}</span>
              <span className="small muted">{s.city} · {s.address}</span>
              <span className="small" style={{ color: 'var(--accent-ink)', fontWeight: 700 }}>{s.productCount} პროდუქტი</span>
            </Link>
          ))}
        </div>
      </section>
    </main>
  )
}
