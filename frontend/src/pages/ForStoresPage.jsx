import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { api } from '../api'
import { CheckIcon, ErrorBox } from '../components/ui'

const BENEFITS = [
  ['მოთხოვნა წინასწარ ჩანს', 'ხედავთ, რომელ ნივთს ითხოვენ, რამდენი ადამიანი და რა ფასად — სანამ ფასს დააკლებთ.'],
  ['აქცია მხოლოდ შევსებულ ჯგუფზე', 'ფასი აქტიურდება მხოლოდ მაშინ, როცა საკმარისი მყიდველი დაჯავშნის. არ შეივსო — არაფერი იცვლება.'],
  ['იხდით მხოლოდ გაყიდვაზე', 'განთავსება და ყოველთვიური გადასახადი არ არის. საკომისიო მხოლოდ გატანილ ნივთზე.'],
]

const STEPS = [
  ['კატალოგი', 'ვამატებთ თქვენს პროდუქტებს ფოტოებით და ფასებით.'],
  ['მოთხოვნა', 'მყიდველები ითხოვენ ჯგუფურ ფასს — თქვენ ხედავთ ჯამურ სურათს.'],
  ['შეთავაზება', 'აცხადებთ ფასს, მინიმალურ ჯგუფს, მარაგს და ვადას. დაინტერესებულები SMS-ს იღებენ.'],
  ['გაყიდვა', 'მყიდველი მოდის 6-ნიშნა კოდით და იხდის მაღაზიაში. კოდს პანელში ამოწმებთ.'],
]

const EMPTY = { name: '', storeName: '', phone: '', city: '', message: '', website: '' }

export default function ForStoresPage() {
  const loc = useLocation()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  // Links to /for-stores#apply scroll to the form.
  useEffect(() => {
    if (loc.hash === '#apply') document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [loc.hash])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const submit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.storeName.trim() || !form.phone.trim()) { setError('შეავსე სახელი, მაღაზიის სახელი და ტელეფონი'); return }
    setBusy(true); setError(null)
    try {
      await api('/partner-leads', { method: 'POST', body: form })
      setSent(true); setForm(EMPTY)
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  const req = <span style={{ color: 'var(--danger)' }} aria-label="სავალდებულო"> *</span>

  return (
    <main className="page" style={{ gap: 48 }}>
      <section className="home-hero" style={{ alignItems: 'center' }}>
        <div className="stack" style={{ gap: 18, flex: '1 1 480px', minWidth: 0 }}>
          <span className="eyebrow" style={{ color: 'var(--accent-ink)' }}>მაღაზიებისთვის</span>
          <h1 className="home-title" style={{ fontSize: 48 }}>მეტი გაყიდვა ფასდაკლების რისკის გარეშე</h1>
          <p className="muted" style={{ fontSize: 18, maxWidth: 560 }}>
            „ერთად“ აგროვებს მყიდველებს, რომლებსაც ერთი და იგივე ნივთი უნდათ. ფასს აკლებთ მხოლოდ მაშინ, როცა გაყიდვა გარანტირებულია.
          </p>
          <div className="row" style={{ gap: 12 }}>
            <a href="#apply" className="btn btn-lg" onClick={(e) => { e.preventDefault(); document.getElementById('apply')?.scrollIntoView({ behavior: 'smooth' }) }}>გახდი პარტნიორი</a>
            <a href="/staff/login" className="btn btn-lg btn-soft">მაღაზიის პანელი</a>
          </div>
        </div>
        <div className="home-stats" style={{ flex: '0 1 380px', gridTemplateColumns: '1fr 1fr' }}>
          <div className="home-stat"><strong style={{ color: 'var(--accent-ink)' }}>0 ₾</strong><span>განთავსება</span></div>
          <div className="home-stat"><strong>0 ₾</strong><span>ყოველთვიური</span></div>
          <div className="home-stat"><strong>0 ₾</strong><span>თუ ვერ შეგროვდა</span></div>
          <div className="home-stat"><strong style={{ color: 'var(--accent-ink)' }}>%</strong><span>მხოლოდ გაყიდვაზე</span></div>
        </div>
      </section>

      <section className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
        {BENEFITS.map(([title, text]) => (
          <div key={title} className="how-step">
            <span className="num" aria-hidden="true"><CheckIcon size={18} /></span>
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        ))}
      </section>

      <section className="stack">
        <h2>როგორ მუშაობს მაღაზიისთვის</h2>
        <div className="grid-auto">
          {STEPS.map(([title, text], i) => (
            <div key={title} className="how-step">
              <span className="num">{i + 1}</span>
              <strong>{title}</strong>
              <span>{text}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="apply" className="split" style={{ gap: 24, scrollMarginTop: 90 }}>
        <div className="stack" style={{ flex: '1 1 320px', gap: 12 }}>
          <h2>გახდი პარტნიორი</h2>
          <p className="muted">დაგვიტოვე კონტაქტი — დაგიკავშირდებით, ერთად შევარჩევთ პროდუქტებს და მოვამზადებთ პირველ შეთავაზებას.</p>
          <ul className="home-points" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
            <li>✓ კატალოგს ჩვენ ვამატებთ</li>
            <li>✓ პილოტი 10–15 პროდუქტით</li>
            <li>✓ პანელი: მოთხოვნები, კოდის შემოწმება, ანგარიშები</li>
          </ul>
        </div>
        <form className="card" style={{ flex: '1 1 420px', gap: 14 }} onSubmit={submit} noValidate>
          {sent ? (
            <div className="stack center" style={{ padding: '24px 0' }} role="status">
              <span className="big-icon" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}><CheckIcon /></span>
              <strong style={{ fontSize: 20 }}>განაცხადი მიღებულია!</strong>
              <span className="muted">მალე დაგიკავშირდებით.</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSent(false)}>კიდევ ერთი განაცხადი</button>
            </div>
          ) : (
            <>
              <div className="form-grid">
                <label className="field" htmlFor="l-name"><span>სახელი{req}</span><input id="l-name" className="input" autoComplete="name" value={form.name} onChange={set('name')} /></label>
                <label className="field" htmlFor="l-store"><span>მაღაზიის სახელი{req}</span><input id="l-store" className="input" autoComplete="organization" value={form.storeName} onChange={set('storeName')} /></label>
                <label className="field" htmlFor="l-phone"><span>ტელეფონი{req}</span><input id="l-phone" className="input" type="tel" autoComplete="tel" placeholder="5XX XX XX XX" value={form.phone} onChange={set('phone')} /></label>
                <label className="field" htmlFor="l-city"><span>ქალაქი</span><input id="l-city" className="input" autoComplete="address-level2" value={form.city} onChange={set('city')} /></label>
              </div>
              <label className="field" htmlFor="l-msg"><span>რას ყიდით? (არასავალდებულო)</span>
                <textarea id="l-msg" className="input" rows={3} maxLength={1000} value={form.message} onChange={set('message')} />
              </label>
              {/* Honeypot: hidden from people, bots fill it in */}
              <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="sr-only" aria-hidden="true" />
              <ErrorBox error={error} />
              <button className="btn btn-lg" disabled={busy}>განაცხადის გაგზავნა</button>
              <span className="small muted">ნომერს გამოვიყენებთ მხოლოდ თქვენთან დასაკავშირებლად.</span>
            </>
          )}
        </form>
      </section>
    </main>
  )
}
