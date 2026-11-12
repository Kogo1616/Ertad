import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { CheckIcon, CopyButton, ErrorBox, Loading, Progress, useLoad, useSecondsLeft } from '../components/ui'
import { money, when } from '../format'

function Confetti() {
  return (
    <svg aria-hidden="true" className="confetti" viewBox="0 0 1000 200" preserveAspectRatio="xMidYMid meet">
      <circle cx="140" cy="50" r="10" style={{ fill: 'var(--accent)' }} opacity=".7" />
      <rect x="820" y="40" width="20" height="20" rx="4" style={{ fill: 'var(--accent)' }} opacity=".35" transform="rotate(20 830 50)" />
      <circle cx="880" cy="150" r="12" style={{ fill: 'var(--accent)' }} />
      <rect x="200" y="150" width="16" height="16" rx="3" style={{ fill: 'var(--muted)' }} opacity=".5" transform="rotate(-15 208 158)" />
      <circle cx="740" cy="170" r="8" style={{ fill: 'var(--accent)' }} opacity=".5" />
      <circle cx="290" cy="30" r="7" style={{ fill: 'var(--muted)' }} opacity=".4" />
      <rect x="80" y="120" width="14" height="14" rx="3" style={{ fill: 'var(--accent)' }} opacity=".35" transform="rotate(30 87 127)" />
      <circle cx="660" cy="40" r="6" style={{ fill: 'var(--accent)' }} opacity=".7" />
    </svg>
  )
}

function Headline({ icon, bg, fg, title, text }) {
  return (
    <div className="stack center" style={{ position: 'relative', gap: 12 }}>
      <div className="big-icon" style={{ background: bg, color: fg, fontSize: 38, fontWeight: 800 }}>{icon}</div>
      <h1 style={{ fontSize: 36 }}>{title}</h1>
      <p className="muted" style={{ fontSize: 16 }}>{text}</p>
    </div>
  )
}

export default function ReservationPage() {
  const { id } = useParams()
  const [r, loadError, reload] = useLoad(() => api('/my/reservations/' + id), [id])
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [smsNote, setSmsNote] = useState(null)
  const [resendAt, setResendAt] = useState(null)
  const resendIn = useSecondsLeft(resendAt)

  if (loadError) return <main className="page"><ErrorBox error={loadError} /></main>
  if (!r) return <main className="page"><Loading /></main>
  const { deal } = r

  const cancel = async () => {
    if (!confirm('ნამდვილად გინდა ჯავშნის გაუქმება?')) return
    setBusy(true); setError(null)
    try { await api(`/my/reservations/${r.id}/cancel`, { method: 'POST' }); reload() }
    catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  const resendCode = async () => {
    setBusy(true); setError(null); setSmsNote(null)
    try {
      const res = await api(`/my/reservations/${r.id}/resend-code`, { method: 'POST' })
      setResendAt(Date.now() + res.resendIn * 1000)
      setSmsNote(res.remaining > 0 ? `კოდი SMS-ით გაიგზავნა (კიდევ ${res.remaining}-ჯერ შეიძლება)` : 'კოდი SMS-ით გაიგზავნა')
    } catch (e) {
      setError(e.message)
      if (e.data?.resendIn) setResendAt(Date.now() + e.data.resendIn * 1000)
    } finally { setBusy(false) }
  }
  const answer = async (pickedUp) => {
    await api(`/my/reservations/${r.id}/pickup-answer`, { method: 'POST', body: { pickedUp } })
    reload()
  }

  const shareUrl = `${window.location.origin}/d/${deal.slug}`
  const need = Math.max(0, deal.min - deal.confirmed)

  return (
    <main className="page" style={{ maxWidth: 1000, position: 'relative', paddingTop: 48, gap: 28 }}>
      {r.status === 'Confirmed' && r.code && (
        <>
          <Confetti />
          <Headline icon={<CheckIcon />} bg="var(--accent)" fg="var(--on-accent)" title="ჯგუფი შეივსო!"
            text={`${deal.confirmed}-მა ადამიანმა ერთად მოიპოვა ${money(deal.groupPrice)}-იანი ფასი. შენ ${money(r.saving)} დაზოგე.`} />
          <section className="ticket">
            <div className="ticket-left">
              <span className="muted" style={{ fontSize: 14, fontWeight: 600 }}>შენი გატანის კოდი</span>
              <div className="code-boxes" aria-label={'კოდი ' + r.code.split('').join(' ')}>
                {r.code.split('').map((c, i) => <span key={i} aria-hidden="true">{c}</span>)}
              </div>
              <span className="muted" style={{ fontSize: 14 }}>აჩვენე მაღაზიაში გადახდისას</span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy || resendIn > 0} onClick={resendCode}>
                {resendIn > 0 ? `თავიდან გაგზავნა ${resendIn} წამში` : 'კოდი SMS-ით გამომიგზავნე'}
              </button>
              {smsNote && <span className="small" role="status" style={{ color: 'var(--accent-ink)' }}>{smsNote}</span>}
            </div>
            <div className="ticket-right">
              <div className="kv"><span>პროდუქტი</span><strong>{deal.productName}</strong></div>
              <div className="kv"><span>გადასახდელი</span><strong style={{ fontSize: 22, fontWeight: 800 }}>{money(deal.groupPrice)}</strong></div>
              <div className="kv"><span>გაიტანე</span><strong>{when(r.pickupDeadline)}-მდე</strong></div>
              <div className="kv"><span>სად</span><strong>{r.store.address}</strong></div>
              <div className="row" style={{ gridColumn: '1 / -1', marginTop: 6 }}>
                <a href={r.store.mapUrl} target="_blank" rel="noreferrer" className="btn">რუკაზე ნახვა</a>
                <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>ჯავშნის გაუქმება</button>
              </div>
            </div>
          </section>
        </>
      )}

      {r.status === 'Confirmed' && !r.code && (
        <>
          <Headline icon="⏳" bg="var(--warning-soft)" fg="var(--warning)" title="ადგილი დაჯავშნილია!"
            text={`ჯგუფს კიდევ ${need} სჭირდება ${when(deal.deadline)}-მდე. შეივსება თუ არა — SMS-ით გაცნობებთ.`} />
          <section className="card" style={{ gap: 14 }}>
            <div className="row between">
              <strong style={{ fontSize: 18 }}>{deal.productName} · {money(deal.groupPrice)}</strong>
              <span className="chip tone-warning">კიდევ {need}!</span>
            </div>
            <Progress value={deal.confirmed} max={deal.min} />
            <span className="small"><strong>{deal.confirmed} / {deal.min} ჯავშანი</strong> · წინასწარ არაფერს იხდი</span>
            <label htmlFor="share" style={{ fontSize: 13, fontWeight: 700 }}>მოიწვიე მეგობარი</label>
            <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
              <input id="share" className="input" style={{ fontSize: 14, fontWeight: 500 }} readOnly value={shareUrl} />
              <CopyButton text={shareUrl} className="btn btn-soft btn-sm" style={{ height: 46 }} />
            </div>
            <div className="row">
              <Link to={`/d/${deal.slug}`} className="btn btn-soft">შეთავაზების ნახვა</Link>
              <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>ჯავშნის გაუქმება</button>
            </div>
          </section>
        </>
      )}

      {r.status === 'Waitlisted' && (
        <>
          <Headline icon="#" bg="var(--surface-2)" fg="var(--ink)" title={`მოლოდინის სიაში ხარ — №${r.waitlistPosition}`}
            text="მარაგი ამჟამად სავსეა. თუ ვინმე გააუქმებს ან არ გაიტანს, ადგილი შენ გადმოგეცემა და SMS-ს მიიღებ." />
          <div className="row" style={{ justifyContent: 'center' }}>
            <Link to={`/d/${deal.slug}`} className="btn btn-soft">შეთავაზების ნახვა</Link>
            <button type="button" className="btn btn-ghost" disabled={busy} onClick={cancel}>სიიდან გასვლა</button>
          </div>
        </>
      )}

      {r.status === 'Cancelled' && (
        <Headline icon="×" bg="var(--danger-soft)" fg="var(--danger)"
          title={deal.status === 'Failed' ? 'ჯგუფი ვერ შეგროვდა' : 'ჯავშანი გაუქმებულია'}
          text={deal.status === 'Failed' ? 'ვადაში საკმარისი ადამიანი ვერ შეგროვდა. არაფერი გადაგიხდია.' : 'ჯავშანი გაუქმდა. არაფერი გადაგიხდია.'} />
      )}

      {r.status === 'Expired' && (
        <Headline icon="!" bg="var(--warning-soft)" fg="var(--warning)" title="გატანის ვადა გავიდა"
          text={`კოდი ${when(r.pickupDeadline)}-მდე მოქმედებდა. ადგილი მოლოდინის სიაში მყოფს გადაეცა.`} />
      )}

      {r.status === 'Redeemed' && (
        <>
          <Headline icon={<CheckIcon />} bg="var(--success-soft)" fg="var(--success)" title="ნივთი გატანილია"
            text={`${deal.productName} · ${money(deal.groupPrice)} · ${when(r.redeemedAt)}`} />
          <section className="card center" style={{ gap: 12 }}>
            {r.buyerConfirmedPickup == null ? (
              <>
                <strong>გაიტანე ნივთი?</strong>
                <div className="row" style={{ justifyContent: 'center' }}>
                  <button type="button" className="btn" onClick={() => answer(true)}>1 — დიახ</button>
                  <button type="button" className="btn btn-ghost" onClick={() => answer(false)}>2 — არა</button>
                </div>
              </>
            ) : (
              <span className="muted">მადლობა პასუხისთვის!</span>
            )}
          </section>
        </>
      )}

      <ErrorBox error={error} />

      <div className="cta-band" style={{ padding: '18px 22px' }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>მოგეწონა? ნახე სხვა ნივთები, რომლებზეც ხალხი ფასს ითხოვს</span>
        <Link to="/deals" className="btn btn-sm">შეთავაზებების ნახვა</Link>
      </div>
    </main>
  )
}
