import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../../api'
import { useAuth } from '../../auth'
import { DealCard, ErrorBox, Loading, SearchIcon, StatusChip, useLoad } from '../../components/ui'
import { DEAL_STATUS, money, tbilisiLocalToIso, timeLeft, when } from '../../format'
import { defaultDeadline } from './shared'

export default function StoreNewDeal() {
  const [params] = useSearchParams()
  const { me } = useAuth()
  const [data, error] = useLoad(() => api('/store/dashboard'), [])
  const [deals, , reloadDeals] = useLoad(() => api('/store/deals'), [])

  const [origin, setOrigin] = useState(params.get('origin') === 'FromRequests' ? 'FromRequests' : 'StoreInitiated')
  const [productId, setProductId] = useState(params.get('product') ? Number(params.get('product')) : null)
  const [q, setQ] = useState('')
  const [form, setForm] = useState({ price: '', min: '6', stock: '12', deadline: defaultDeadline(4), pickupDays: '3', warranty: '' })
  const [msg, setMsg] = useState(null)
  const [formError, setFormError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (error) return <ErrorBox error={error} />
  if (!data) return <Loading />

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const visible = data.products
    .filter((p) => origin === 'StoreInitiated' || p.interestCount > 0)
    .filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()))
  const product = data.products.find((p) => p.id === productId)
  const price = Number(form.price) || (product ? Math.round(product.regularPrice * 0.8) : 0)

  const preview = product && {
    productId: product.id, productName: product.name, imageUrl: product.imageUrl, origin,
    storeName: me?.storeName, storeCity: me?.storeCity,
    groupPrice: price, regularPrice: product.regularPrice,
    percentOff: product.regularPrice > 0 ? Math.round(((product.regularPrice - price) / product.regularPrice) * 100) : 0,
    confirmed: 0, min: Number(form.min) || 0, deadline: form.deadline ? tbilisiLocalToIso(form.deadline) : new Date().toISOString(),
  }

  const save = async (publish) => {
    if (!product) { setFormError('აირჩიე პროდუქტი'); return }
    setBusy(true); setFormError(null); setMsg(null)
    try {
      const r = await api('/store/deals', {
        method: 'POST',
        body: {
          storeProductId: product.id, origin, groupPrice: price, minReservations: Number(form.min), maxStock: Number(form.stock),
          reservationDeadline: tbilisiLocalToIso(form.deadline), pickupDays: Number(form.pickupDays), warrantyTerms: form.warranty, publish,
        },
      })
      if (r.error) setFormError('მონახაზი შეინახა, მაგრამ ვერ გამოქვეყნდა: ' + r.error)
      else setMsg(publish ? { text: 'შეთავაზება გამოქვეყნდა!', slug: r.slug } : { text: 'მონახაზი შენახულია' })
      reloadDeals()
    } catch (e) { setFormError(e.message) } finally { setBusy(false) }
  }

  const publishDraft = async (id) => {
    try { await api(`/store/deals/${id}/publish`, { method: 'POST' }); reloadDeals() }
    catch (e) { alert(e.message) }
  }

  return (
    <>
      <div className="page-head">
        <div className="stack-sm" style={{ gap: 4 }}>
          <h1>ახალი ჯგუფური შეთავაზება</h1>
          <p className="muted" style={{ fontSize: 14 }}>გამოაცხადე ჯგუფური ფასი ნებისმიერ პროდუქტზე — მყიდველების მოთხოვნის გარეშეც.</p>
        </div>
        <div role="group" aria-label="შეთავაზების ტიპი" className="toggle">
          <button type="button" aria-pressed={origin === 'StoreInitiated'} onClick={() => setOrigin('StoreInitiated')}>ჩემი ინიციატივით</button>
          <button type="button" aria-pressed={origin === 'FromRequests'} onClick={() => setOrigin('FromRequests')}>მოთხოვნაზე პასუხი</button>
        </div>
      </div>

      <div className="split" style={{ gap: 20, alignItems: 'flex-start' }}>
        <div className="stack" style={{ flex: '3 1 460px', gap: 16 }}>
          <section className="card" style={{ gap: 14 }}>
            <div className="row"><span className="step-num">1</span><strong style={{ fontSize: 16 }}>აირჩიე პროდუქტი</strong></div>
            <div className="search" style={{ borderRadius: 16, height: 46, flex: 'none' }}>
              <SearchIcon />
              <input type="search" aria-label="კატალოგში ძიება" placeholder="მოძებნე კატალოგში" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="grid-cards" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 10 }}>
              {visible.map((p, i) => {
                const [bg, fg] = ['var(--surface-2)', 'var(--ink)']
                return (
                  <button key={p.id} type="button" className="pick" aria-pressed={p.id === productId} onClick={() => setProductId(p.id)}>
                    <span className="icon-square" style={{ background: bg, color: fg }}>{p.name[0]}</span>
                    <span className="stack-sm" style={{ gap: 2, minWidth: 0, alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: 14 }}>{p.name}</strong>
                      <span className="muted" style={{ fontSize: 12 }}>{money(p.regularPrice)} · {p.interestCount > 0 ? `${p.interestCount} ითხოვს` : 'მოთხოვნა არ არის'}</span>
                    </span>
                  </button>
                )
              })}
              {visible.length === 0 && <span className="muted small">ვერაფერი მოიძებნა</span>}
            </div>
          </section>

          <section className="card" style={{ gap: 14 }}>
            <div className="row"><span className="step-num">2</span><strong style={{ fontSize: 16 }}>დააწესე პირობები</strong></div>
            <div className="form-grid">
              <label className="field" htmlFor="f-price">ჯგუფური ფასი, ₾<input id="f-price" className="input" type="number" min="1" placeholder={product ? String(price) : ''} value={form.price} onChange={set('price')} /></label>
              <label className="field" htmlFor="f-min">მინ. ჯავშანი<input id="f-min" className="input" type="number" min="1" value={form.min} onChange={set('min')} /></label>
              <label className="field" htmlFor="f-stock">გამოყოფილი მარაგი<input id="f-stock" className="input" type="number" min="1" value={form.stock} onChange={set('stock')} /></label>
              <label className="field" htmlFor="f-deadline">დაჯავშნის ბოლო ვადა<input id="f-deadline" className="input" style={{ fontSize: 14 }} type="datetime-local" value={form.deadline} onChange={set('deadline')} /></label>
              <label className="field" htmlFor="f-pickup">გატანის ვადა (დღე)<input id="f-pickup" className="input" type="number" min="1" value={form.pickupDays} onChange={set('pickupDays')} /></label>
              <label className="field" htmlFor="f-warranty">გარანტია<input id="f-warranty" className="input" placeholder="[პირობა]" value={form.warranty} onChange={set('warranty')} /></label>
            </div>
            <span className="small muted">გამოქვეყნების შემდეგ პროდუქტი, ფასი, მარაგი, ვადები და გარანტია აღარ იცვლება.</span>
          </section>
        </div>

        <aside className="stack" style={{ flex: '2 1 320px', gap: 14 }}>
          <span className="small muted" style={{ fontWeight: 700 }}>ასე დაინახავენ მყიდველები</span>
          {preview ? <DealCard deal={preview} isNew /> : <div className="empty">აირჩიე პროდუქტი</div>}
          <div className="note" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <strong style={{ fontSize: 14 }}>ვინ შეიტყობს</strong>
            <span>• ჩნდება „აქტიური შეთავაზებების“ გვერდზე</span>
            <span>• ვინც ამ პროდუქტზე ინტერესი დააფიქსირა, SMS-ს მიიღებს{product ? ` (${product.interestCount})` : ''}</span>
            <span>• მზად იქნება გასაზიარებელი ბმული</span>
          </div>
          <ErrorBox error={formError} />
          {msg && <div className="note" role="status">{msg.text} {msg.slug && <a href={`/d/${msg.slug}`} target="_blank" rel="noreferrer">საჯარო გვერდი</a>}</div>}
          <button type="button" className="btn btn-lg" disabled={busy || !product} onClick={() => save(true)}>შეთავაზების გამოქვეყნება</button>
          <button type="button" className="btn btn-white" disabled={busy || !product} onClick={() => save(false)}>შენახვა მონახაზად</button>
        </aside>
      </div>

      <section className="card" style={{ gap: 12 }}>
        <h2 style={{ fontSize: 18 }}>ჩემი შეთავაზებები</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>პროდუქტი</th><th>ფასი</th><th>ჯავშანი</th><th>ვადა</th><th>სტატუსი</th><th></th></tr></thead>
            <tbody>
              {deals?.map((d) => (
                <tr key={d.id}>
                  <td style={{ fontWeight: 600 }}>{d.productName}<div className="small muted">{d.origin === 'FromRequests' ? 'მოთხოვნით' : 'ინიციატივით'}</div></td>
                  <td>{money(d.groupPrice)}</td>
                  <td>{d.confirmed} / {d.min} (მარაგი {d.maxStock})</td>
                  <td className="muted">{when(d.deadline)}<div className="small">{timeLeft(d.deadline)}</div></td>
                  <td><StatusChip map={DEAL_STATUS} value={d.status} /></td>
                  <td>
                    {d.status === 'Draft'
                      ? <button type="button" className="btn btn-sm" onClick={() => publishDraft(d.id)}>გამოქვეყნება</button>
                      : <Link to={`/store/reports/${d.id}`}>ანგარიში</Link>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
