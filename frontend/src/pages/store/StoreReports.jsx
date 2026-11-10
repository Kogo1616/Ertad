import { Link, useParams } from 'react-router-dom'
import { api } from '../../api'
import { ErrorBox, Loading, StatusChip, useLoad } from '../../components/ui'
import { DEAL_STATUS, SOURCE_LABEL, money, when } from '../../format'

export default function StoreReports() {
  const { dealId } = useParams()
  const [deals, error] = useLoad(() => api('/store/deals'), [])
  if (error) return <ErrorBox error={error} />
  if (!deals) return <Loading />
  const published = deals.filter((d) => d.status !== 'Draft')
  const current = dealId ? Number(dealId) : published[0]?.id

  return (
    <>
      <h1>ანგარიშები</h1>
      <div className="tabs">
        {published.map((d) => (
          <Link key={d.id} to={`/store/reports/${d.id}`} className="filter" aria-pressed={d.id === current}
            style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none', ...(d.id === current ? { background: 'var(--ink)', color: 'var(--surface)' } : {}) }}>
            {d.productName} · {money(d.groupPrice)}
          </Link>
        ))}
      </div>
      {current ? <Report key={current} dealId={current} /> : <div className="empty">გამოქვეყნებული შეთავაზება ჯერ არ არის</div>}
    </>
  )
}

function Report({ dealId }) {
  const [r, error] = useLoad(() => api('/store/reports/' + dealId), [dealId])
  if (error) return <ErrorBox error={error} />
  if (!r) return <Loading />
  const { deal } = r

  return (
    <>
      <section className="card" style={{ gap: 8 }}>
        <div className="row between">
          <h2 style={{ fontSize: 20 }}>{deal.productName} · {money(deal.groupPrice)} <span className="strike" style={{ fontSize: 15 }}>{money(deal.regularPrice)}</span></h2>
          <StatusChip map={DEAL_STATUS} value={deal.status} />
        </div>
        <span className="small muted">
          მინ. {deal.min} · მარაგი {deal.maxStock} · ვადა {when(deal.deadline)} · {deal.origin === 'FromRequests' ? 'მყიდველების მოთხოვნით' : 'მაღაზიის ინიციატივით'} ·{' '}
          <a href={`/d/${deal.slug}`} target="_blank" rel="noreferrer">საჯარო გვერდი</a>
        </span>
      </section>

      <div className="kpis">
        <div className="kpi tone-violet"><span>დაინტერესებული</span><strong>{r.interestCount}</strong></div>
        <div className="kpi tone-butter"><span>ჯავშანი</span><strong>{r.reservations.confirmed}</strong><span className="small">მოლოდინში {r.reservations.waitlisted} · გაუქმდა {r.reservations.cancelled}</span></div>
        <div className="kpi tone-mint"><span>აქტიურდა?</span><strong>{r.activated ? 'დიახ' : 'არა'}</strong></div>
        <div className="kpi tone-pink"><span>გატანილი</span><strong>{r.redeemed}</strong><span className="small">არ მოვიდა: {r.noShows}</span></div>
        <div className="kpi tone-peach"><span>საკომისიო</span><strong>{money(r.commissionTotal)}</strong></div>
      </div>

      <div className="split" style={{ gap: 20 }}>
        <section className="card" style={{ flex: '1 1 360px' }}>
          <h2 style={{ fontSize: 18 }}>წყაროები</h2>
          <div className="table-wrap">
            <table style={{ minWidth: 300 }}>
              <thead><tr><th>წყარო</th><th>ჯავშანი</th><th>გაყიდვა</th></tr></thead>
              <tbody>
                {r.salesBySource.map((s) => (
                  <tr key={s.source}>
                    <td>{SOURCE_LABEL[s.source]}</td>
                    <td>{r.reservationsBySource.find((x) => x.source === s.source)?.count ?? 0}</td>
                    <td style={{ fontWeight: 700 }}>{s.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="card" style={{ flex: '1 1 300px' }}>
          <h2 style={{ fontSize: 18 }}>SMS დადასტურება გატანის შემდეგ</h2>
          <div className="stack-sm">
            <span>„გაიტანე?“ — დიახ: <strong>{r.pickupConfirmations.yes}</strong></span>
            <span>არა: <strong>{r.pickupConfirmations.no}</strong></span>
            <span className="muted">პასუხი არ არის: {r.pickupConfirmations.noAnswer}</span>
          </div>
        </section>
      </div>
    </>
  )
}
