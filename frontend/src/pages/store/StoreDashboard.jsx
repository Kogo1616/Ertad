import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../api'
import { ErrorBox, Loading, useLoad } from '../../components/ui'
import { money, tbilisiLocalToIso, tone } from '../../format'
import { defaultDeadline, PriceBars } from './shared'

export default function StoreDashboard() {
  const [data, error, reload] = useLoad(() => api('/store/dashboard'), [])
  const [selectedId, setSelectedId] = useState(null)

  useEffect(() => {
    if (data && selectedId == null && data.products.length) setSelectedId(data.products[0].id)
  }, [data, selectedId])

  if (error) return <ErrorBox error={error} />
  if (!data) return <Loading />
  const { kpis, products } = data
  const maxInterest = Math.max(1, ...products.map((p) => p.interestCount))
  const selected = products.find((p) => p.id === selectedId)

  return (
    <>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1>გამარჯობა! რას ითხოვენ მყიდველები</h1>
          <p className="muted small" style={{ fontSize: 14 }}>უპასუხე მოთხოვნას ან გამოაცხადე შეთავაზება შენი ინიციატივით.</p>
        </div>
        <Link to="/store/deals/new" className="btn">+ ახალი შეთავაზება</Link>
      </div>

      <div className="kpis">
        <div className="kpi tone-violet"><span>დაინტერესებული</span><strong style={{ color: 'var(--violet-ink)' }}>{kpis.interested}</strong></div>
        <div className="kpi tone-mint"><span>აქტიური შეთავაზება</span><strong style={{ color: 'var(--mint-ink)' }}>{kpis.activeDeals}</strong></div>
        <div className="kpi tone-butter"><span>ჯავშანი</span><strong style={{ color: 'var(--butter-ink)' }}>{kpis.reserved} / {kpis.needed}</strong></div>
        <div className="kpi tone-pink"><span>გატანილი</span><strong style={{ color: 'var(--pink-ink)' }}>{kpis.redeemed}</strong></div>
      </div>

      <div className="split" style={{ gap: 20, alignItems: 'flex-start' }}>
        <section className="stack" style={{ flex: '2 1 420px', gap: 10 }}>
          {products.map((p, i) => {
            const [bg, fg] = tone(i + 3)
            const bar = ['#6A4BE0', '#3FBF8E', '#E8B931', '#F07AAE', '#F09A6A'][i % 5]
            return (
              <button key={p.id} type="button" className={'prow' + (p.id === selectedId ? ' selected' : '')} aria-pressed={p.id === selectedId} onClick={() => setSelectedId(p.id)}>
                <span className="icon-square" style={{ background: bg, color: fg }}>{p.name[0]}</span>
                <div className="stack-sm" style={{ flex: 1, minWidth: 0 }}>
                  <div className="row between" style={{ gap: 8, flexWrap: 'nowrap' }}>
                    <strong style={{ fontSize: 15 }}>{p.name}</strong>
                    <span className="small muted" style={{ whiteSpace: 'nowrap' }}>{money(p.regularPrice)}{p.median != null && <> · სურვილი ~{money(p.median)}</>}</span>
                  </div>
                  <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                    <div className="progress" style={{ flex: 1 }}><div style={{ width: Math.round((p.interestCount / maxInterest) * 100) + '%', background: bar }} /></div>
                    <span className="small" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.interestCount > 0 ? `${p.interestCount} ითხოვს` : 'მოთხოვნა არ არის'}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </section>

        {selected && <OfferPanel key={selected.id} product={selected} onPublished={reload} />}
      </div>
    </>
  )
}

function OfferPanel({ product, onPublished }) {
  const [demand] = useLoad(() => api(`/store/products/${product.id}/demand`), [product.id])
  const [form, setForm] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (demand && !form)
      setForm({ price: String(demand.median ?? Math.round(product.regularPrice * 0.75)), min: '10', stock: '20', deadline: defaultDeadline(3) })
  }, [demand, form, product.regularPrice])

  if (!demand || !form) return <section className="card" style={{ flex: '1 1 340px' }}><Loading /></section>

  const price = Number(form.price)
  const willing = demand.priceCounts.filter((x) => x.price >= price).reduce((s, x) => s + x.count, 0)
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const publish = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api('/store/deals', {
        method: 'POST',
        body: {
          storeProductId: product.id, origin: 'FromRequests', groupPrice: price, minReservations: Number(form.min),
          maxStock: Number(form.stock), reservationDeadline: tbilisiLocalToIso(form.deadline), pickupDays: 3, warrantyTerms: '', publish: true,
        },
      })
      if (r.error) setError(r.error); else { setDone(r.slug); onPublished() }
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <section className="card" style={{ flex: '1 1 340px', gap: 18 }}>
      <div className="stack-sm" style={{ gap: 2 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>არჩეული</span>
        <h2 style={{ fontSize: 20 }}>{product.name} · {money(product.regularPrice)}</h2>
        <span className="small muted">{demand.interestCount} ითხოვს · {demand.withPrice}-მა მიუთითა ფასი</span>
      </div>

      <PriceBars buckets={demand.buckets} offerPrice={price} />

      {product.liveDealId ? (
        <div className="note">ამ პროდუქტზე შეთავაზება უკვე აქტიურია. <Link to={`/store/reports/${product.liveDealId}`}>ანგარიშის ნახვა</Link></div>
      ) : done ? (
        <div className="note">გამოქვეყნდა! <a href={`/d/${done}`} target="_blank" rel="noreferrer">საჯარო გვერდი</a> · შეტყობინება {demand.interestCount}-მა მიიღო.</div>
      ) : (
        <form className="stack" style={{ background: 'var(--bg)', borderRadius: 22, padding: 16, gap: 12 }} onSubmit={(e) => { e.preventDefault(); publish() }}>
          <strong style={{ fontSize: 15 }}>შესთავაზე ჯგუფს</strong>
          <div className="form-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            <label className="field" htmlFor="o-price">ფასი, ₾<input id="o-price" className="input input-white" type="number" min="1" value={form.price} onChange={set('price')} required /></label>
            <label className="field" htmlFor="o-min">მინ. ჯგუფი<input id="o-min" className="input input-white" type="number" min="1" value={form.min} onChange={set('min')} required /></label>
            <label className="field" htmlFor="o-stock">მარაგი<input id="o-stock" className="input input-white" type="number" min="1" value={form.stock} onChange={set('stock')} required /></label>
            <label className="field" htmlFor="o-deadline">ვადა<input id="o-deadline" className="input input-white" style={{ fontSize: 13 }} type="datetime-local" value={form.deadline} onChange={set('deadline')} required /></label>
          </div>
          <p className="note">{money(price)} ან მეტს {willing} ადამიანი ელოდება. შეტყობინებას {demand.interestCount}-ვე მიიღებს.</p>
          <ErrorBox error={error} />
          <button className="btn" disabled={busy}>გამოქვეყნება</button>
          <Link to={`/store/deals/new?product=${product.id}&origin=FromRequests`} className="small" style={{ textAlign: 'center' }}>დეტალური ფორმა (გატანა, გარანტია)</Link>
        </form>
      )}
    </section>
  )
}
