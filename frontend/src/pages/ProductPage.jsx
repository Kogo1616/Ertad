import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { isBuyer, useAuth } from '../auth'
import { AvatarStack, CopyButton, DealCard, ErrorBox, HowItWorks, Loading, LockIcon, ProductImage, StoreLogo, useLoad } from '../components/ui'
import { money } from '../format'
import { ProductGrid } from './StorePage'

export default function ProductPage() {
  const { productId } = useParams()
  const { me } = useAuth()
  const nav = useNavigate()
  const [p, loadError, reload] = useLoad(() => api('/products/' + productId), [productId, me?.authenticated])

  const [choice, setChoice] = useState(null) // number | 'other' | null
  const [custom, setCustom] = useState('')
  const [error, setError] = useState(null)
  const [msg, setMsg] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!p) return
    const mine = p.myInterest?.maxPrice
    if (mine == null) { setChoice(p.myInterest ? null : p.suggestedPrices[1] ?? null); return }
    if (p.suggestedPrices.includes(Number(mine))) setChoice(Number(mine))
    else { setChoice('other'); setCustom(String(Number(mine))) }
  }, [p])

  if (loadError) return <main className="page"><ErrorBox error={loadError} /></main>
  if (!p) return <main className="page"><Loading /></main>

  const maxPrice = choice === 'other' ? (custom ? Number(custom) : null) : choice
  const shareUrl = window.location.origin + window.location.pathname

  const submit = async () => {
    if (!isBuyer(me)) { nav('/login?next=' + encodeURIComponent(window.location.pathname)); return }
    setBusy(true); setError(null); setMsg(null)
    try {
      await api(`/products/${p.id}/interest`, { method: 'POST', body: { maxPrice } })
      setMsg(p.myInterest ? 'მოთხოვნა განახლდა' : 'მოთხოვნა მიღებულია! შეთავაზებისას SMS-ს მიიღებ.')
      reload()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const withdraw = async () => {
    setBusy(true); setError(null)
    try {
      await api(`/products/${p.id}/interest`, { method: 'DELETE' })
      setMsg('მოთხოვნა გაუქმდა'); reload()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  return (
    <main className="page" style={{ gap: 28 }}>
      <nav aria-label="ნავიგაცია" className="row small muted" style={{ gap: 8 }}>
        <Link to="/stores" className="muted">მაღაზიები</Link><span>/</span>
        <Link to={`/stores/${p.store.id}`} className="muted">{p.store.name}, {p.store.city}</Link><span>/</span>
        <span style={{ color: 'var(--ink)', fontWeight: 600 }}>{p.name}</span>
      </nav>

      <div className="split" style={{ gap: 28 }}>
        <div style={{ flex: '1 1 480px' }}>
          <ProductImage name={p.name} imageUrl={p.imageUrl} height={440} radius="var(--r-lg)">
            {!p.imageUrl && <span className="chip pimg-badge badge-origin" style={{ left: 16, top: 16 }}>[პროდუქტის ფოტო]</span>}
          </ProductImage>
        </div>

        <div className="stack" style={{ flex: '1 1 400px', gap: 18 }}>
          <Link to={`/stores/${p.store.id}`} className="chip" style={{ alignSelf: 'flex-start', background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)', padding: '4px 12px 4px 4px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            <StoreLogo name={p.store.name} imageUrl={p.store.imageUrl} size={26} round />
            {p.store.name} · {p.store.city}
          </Link>
          <div className="stack-sm" style={{ gap: 4 }}>
            <h1>{p.name}</h1>
            <span className="muted">{p.description}</span>
          </div>
          <div className="row" style={{ alignItems: 'baseline' }}>
            <span style={{ fontSize: 32, fontWeight: 800 }}>{money(p.regularPrice)}</span>
            <span className="small muted" style={{ fontSize: 14 }}>ჩვეულებრივი ფასი</span>
          </div>

          {p.deal ? (
            <section className="card" style={{ gap: 14 }}>
              <span style={{ fontSize: 17, fontWeight: 700 }}>ამ ნივთზე ჯგუფი უკვე გროვდება!</span>
              <DealCard deal={p.deal} />
              <Link to={`/d/${p.deal.slug}?src=store`} className="btn btn-lg">შემოუერთდი {money(p.deal.groupPrice)}-ად</Link>
            </section>
          ) : (
            <section className="card" style={{ gap: 18 }}>
              <div className="row" style={{ gap: 14, flexWrap: 'nowrap' }}>
                {p.initials.length > 0 && <AvatarStack initials={p.initials} total={p.interestCount} />}
                <div className="stack-sm" style={{ gap: 0 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>
                    {p.interestCount > 0 ? `${p.interestCount} ადამიანი ითხოვს ჯგუფურ ფასს` : 'იყავი პირველი, ვინც ჯგუფურ ფასს ითხოვს'}
                  </span>
                  <span className="small muted">რაც მეტი ვართ, მით მეტია შანსი, რომ მაღაზია ფასს დაგვიკლებს</span>
                </div>
              </div>

              <div className="stack-sm" style={{ gap: 10 }}>
                <span style={{ fontSize: 14, fontWeight: 700 }}>რამდენს გადაიხდიდი?</span>
                <div role="group" aria-label="სასურველი ფასი" className="price-chips">
                  {p.suggestedPrices.map((v) => (
                    <button key={v} type="button" className="price-chip" aria-pressed={choice === v} onClick={() => setChoice(choice === v ? null : v)}>{money(v)}</button>
                  ))}
                  <button type="button" className="price-chip" style={{ fontSize: 15, fontWeight: 600 }} aria-pressed={choice === 'other'} onClick={() => setChoice('other')}>სხვა</button>
                </div>
                {choice === 'other' && (
                  <label className="field" htmlFor="custom-price">შენი ფასი, ₾
                    <input id="custom-price" className="input" type="number" min="1" step="1" value={custom} onChange={(e) => setCustom(e.target.value)} />
                  </label>
                )}
                <span className="lock-note"><LockIcon /> შენს ფასს მხოლოდ მაღაზია ხედავს</span>
              </div>

              <ErrorBox error={error} />
              {msg && <div className="note" role="status">{msg}</div>}

              <div className="row">
                <button type="button" className="btn btn-lg" style={{ flex: '1 1 240px' }} disabled={busy} onClick={submit}>
                  {p.myInterest ? 'ფასის განახლება' : 'მოითხოვე ჯგუფური ფასი'}
                </button>
                <CopyButton text={shareUrl} label="ბმულის კოპირება" className="btn btn-lg btn-soft" style={{ flex: '0 1 180px', fontSize: 15 }} />
              </div>
              {p.myInterest && (
                <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-start' }} disabled={busy} onClick={withdraw}>მოთხოვნის გაუქმება</button>
              )}
            </section>
          )}
        </div>
      </div>

      <HowItWorks />

      {p.others.length > 0 && (
        <section className="stack">
          <h2>სხვა პროდუქტები ამ მაღაზიიდან</h2>
          <ProductGrid products={p.others} />
        </section>
      )}
    </main>
  )
}
