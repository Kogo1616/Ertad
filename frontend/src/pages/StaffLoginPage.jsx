import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox } from '../components/ui'

/** Store staff and admin: email + password. */
export default function StaffLoginPage() {
  const [params] = useSearchParams()
  const { reload } = useAuth()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await api('/auth/staff-login', { method: 'POST', body: { email, password } })
      await reload()
      nav(params.get('next') || (r.role === 'Admin' ? '/admin' : '/store'), { replace: true })
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <main className="page" style={{ maxWidth: 520, paddingTop: 48 }}>
      <form className="card" style={{ gap: 16, padding: 28 }} onSubmit={submit}>
        <h1 style={{ fontSize: 28 }}>მაღაზიის პანელი</h1>
        <label className="field" htmlFor="email">ელ-ფოსტა
          <input id="email" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
        <label className="field" htmlFor="password">პაროლი
          <input id="password" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        <ErrorBox error={error} />
        <button className="btn btn-lg" disabled={busy}>შესვლა</button>
      </form>
    </main>
  )
}
