import { Link } from 'react-router-dom'
import { api } from '../api'
import { ErrorBox, Loading, StatusChip, useLoad } from '../components/ui'
import { DEAL_STATUS, RES_STATUS, dateTime, money } from '../format'

export default function MyPage() {
  const [data, error] = useLoad(() => api('/my'), [])
  if (error) return <main className="page"><ErrorBox error={error} /></main>
  if (!data) return <main className="page"><Loading /></main>

  return (
    <main className="page">
      <h1>ჩემი ჯავშნები</h1>

      <section className="stack">
        <h2>ჯავშნები</h2>
        {data.reservations.length === 0 && <div className="empty">ჯავშანი ჯერ არ გაქვს. <Link to="/deals">ნახე შეთავაზებები</Link></div>}
        {data.reservations.map((r) => (
          <Link key={r.id} to={`/my/reservations/${r.id}`} className="prow" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
            <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <strong>{r.productName} · {money(r.groupPrice)}</strong>
              <span className="small muted">{r.storeName} · {dateTime(r.createdAt)} · ჯგუფი {r.confirmed} / {r.min}</span>
            </div>
            <div className="row" style={{ gap: 6 }}>
              <StatusChip map={DEAL_STATUS} value={r.dealStatus} />
              <StatusChip map={RES_STATUS} value={r.status} />
            </div>
          </Link>
        ))}
      </section>

      <section className="stack">
        <h2>ჩემი მოთხოვნები</h2>
        {data.interests.length === 0 && <div className="empty">მოთხოვნა ჯერ არ გაქვს. <Link to="/stores">გადახედე კატალოგს</Link></div>}
        {data.interests.map((i) => (
          <Link key={i.id} to={`/stores/${i.storeId}/products/${i.productId}`} className="prow" style={{ textDecoration: 'none', color: 'var(--ink)' }}>
            <div className="stack-sm" style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <strong>{i.productName}</strong>
              <span className="small muted">{i.storeName} · ჩვეულებრივ {money(i.regularPrice)} · სულ {i.interestCount} ითხოვს</span>
            </div>
            <span className="chip tone-violet">{i.maxPrice != null ? `ჩემი ფასი: ${money(i.maxPrice)}` : 'ფასის გარეშე'}</span>
          </Link>
        ))}
      </section>
    </main>
  )
}
