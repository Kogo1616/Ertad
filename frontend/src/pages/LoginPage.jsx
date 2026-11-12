import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, useSecondsLeft } from '../components/ui'

/** Buyer login: phone → SMS code. */
export default function LoginPage() {
  const [params] = useSearchParams()
  const next = params.get('next') || '/my/reservations'
  const { reload } = useAuth()
  const nav = useNavigate()
  const [step, setStep] = useState('phone')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [devCode, setDevCode] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [resendAt, setResendAt] = useState(null)
  const resendIn = useSecondsLeft(resendAt)

  const requestCode = async () => {
    setBusy(true); setError(null); setNotice(null)
    try {
      const r = await api('/auth/otp', { method: 'POST', body: { phone } })
      setDevCode(r.devCode)
      setResendAt(Date.now() + r.resendIn * 1000)
      if (step === 'code') { setCode(''); setNotice('ახალი კოდი გაიგზავნა') }
      setStep('code')
    } catch (err) {
      setError(err.message)
      if (err.data?.resendIn) setResendAt(Date.now() + err.data.resendIn * 1000)
    } finally { setBusy(false) }
  }
  const sendCode = (e) => { e.preventDefault(); requestCode() }

  const verify = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      await api('/auth/verify', { method: 'POST', body: { phone, code, name } })
      await reload()
      nav(next, { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <main className="page" style={{ maxWidth: 520, paddingTop: 48 }}>
      <section className="card" style={{ gap: 18, padding: 28 }}>
        <h1 style={{ fontSize: 28 }}>შესვლა</h1>
        {step === 'phone' ? (
          <form className="stack" onSubmit={sendCode}>
            <p className="muted">შეიყვანე ტელეფონის ნომერი — SMS-ით გამოგიგზავნით კოდს. პაროლი არ გჭირდება.</p>
            <label className="field" htmlFor="phone">ტელეფონი
              <input id="phone" className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="5XX XX XX XX" value={phone} onChange={(e) => setPhone(e.target.value)} required />
            </label>
            <ErrorBox error={error} />
            <button className="btn btn-lg" disabled={busy}>კოდის მიღება</button>
          </form>
        ) : (
          <form className="stack" onSubmit={verify}>
            <p className="muted">კოდი გაიგზავნა ნომერზე {phone}. <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep('phone')}>შეცვლა</button></p>
            {devCode && <div className="note">სატესტო რეჟიმი: შენი კოდია <strong>{devCode}</strong></div>}
            <label className="field" htmlFor="code">SMS კოდი
              <input id="code" className="input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value)} required />
            </label>
            <label className="field" htmlFor="name">სახელი (არასავალდებულო — ჯგუფში მხოლოდ პირველი ასო ჩანს)
              <input id="name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <ErrorBox error={error} />
            {notice && <div className="note" role="status">{notice}</div>}
            <button className="btn btn-lg" disabled={busy}>შესვლა</button>
            <button type="button" className="btn btn-ghost" disabled={busy || resendIn > 0} onClick={requestCode} aria-live="polite">
              {resendIn > 0 ? `კოდი თავიდან გამოგზავნა შეიძლება ${resendIn} წამში` : 'კოდი არ მოვიდა? თავიდან გამომიგზავნე'}
            </button>
          </form>
        )}
        <span className="small muted">მაღაზიის თანამშრომელი ხარ? <Link to="/staff/login">შესვლა პანელში</Link></span>
      </section>
    </main>
  )
}
