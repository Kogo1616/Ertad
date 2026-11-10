import { useState } from 'react'
import { api } from '../../api'
import { CheckIcon, ErrorBox, StatusChip, useLoad } from '../../components/ui'
import { RES_STATUS, SOURCE_LABEL, dateTime, money, when } from '../../format'

const RESULT = {
  Valid: { title: 'კოდი მოქმედია', cls: 'tone-mint' },
  AlreadyRedeemed: { title: 'კოდი უკვე გამოყენებულია', cls: 'tone-butter' },
  Expired: { title: 'კოდს ვადა გაუვიდა', cls: 'tone-peach' },
  Cancelled: { title: 'ჯავშანი გაუქმებულია', cls: 'tone-pink' },
  NotFound: { title: 'კოდი ვერ მოიძებნა', cls: 'tone-pink' },
}

export default function StoreRedeem() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [table, , reloadTable] = useLoad(() => api('/store/reservations'), [])

  const check = async (e) => {
    e.preventDefault()
    setBusy(true); setError(null); setConfirmed(false)
    try { setResult(await api('/store/redeem/check', { method: 'POST', body: { code } })) }
    catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const redeem = async () => {
    setBusy(true); setError(null)
    try {
      const r = await api('/store/redeem', { method: 'POST', body: { code } })
      setResult(r)
      setConfirmed(r.status === 'Valid' && r.redeemedAt != null)
      reloadTable()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const info = result && RESULT[result.status]

  return (
    <>
      <div className="stack-sm" style={{ gap: 4 }}>
        <h1>კოდის შემოწმება</h1>
        <p className="muted" style={{ fontSize: 14 }}>შეიყვანე მყიდველის 6-ნიშნა კოდი და დაადასტურე გატანა.</p>
      </div>

      <div className="split" style={{ gap: 20 }}>
        <form className="card" style={{ flex: '1 1 340px', justifyContent: 'center', gap: 14 }} onSubmit={check}>
          <label htmlFor="code" style={{ fontSize: 15, fontWeight: 700 }}>მყიდველის კოდი</label>
          <input id="code" className="code-input" inputMode="numeric" autoComplete="off" maxLength={6} value={code}
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setResult(null) }} />
          <button className="btn btn-soft" disabled={busy || code.length !== 6}>შემოწმება</button>
          <ErrorBox error={error} />
        </form>

        {result && (
          <section className={'card ' + info.cls} style={{ flex: '1 1 380px', gap: 16 }} aria-live="polite">
            <div className="row" style={{ gap: 12 }}>
              <span className="big-icon" style={{ width: 40, height: 40, background: '#fff' }}>{result.status === 'Valid' ? <CheckIcon size={22} /> : '!'}</span>
              <span style={{ fontSize: 20, fontWeight: 800 }}>{confirmed ? 'გატანა დადასტურდა ✓' : info.title}</span>
            </div>
            {result.productName && (
              <div style={{ background: '#fff', borderRadius: 20, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, color: '#1F1640' }}>
                <div className="kv"><span>პროდუქტი</span><strong style={{ fontSize: 15 }}>{result.productName}</strong></div>
                <div className="kv"><span>ჯგუფური ფასი</span><strong style={{ fontSize: 22, fontWeight: 800 }}>{money(result.price)}</strong></div>
                <div className="kv"><span>ტელეფონი</span><strong style={{ fontSize: 15 }}>{result.maskedPhone}</strong></div>
                <div className="kv"><span>{result.redeemedAt ? 'გატანილია' : 'ვადა'}</span><strong style={{ fontSize: 15 }}>{when(result.redeemedAt ?? result.expiresAt)}</strong></div>
              </div>
            )}
            {result.status === 'Valid' && !confirmed && (
              <>
                <button type="button" className="btn btn-lg" disabled={busy} onClick={redeem}>გატანის დადასტურება</button>
                <span className="small">დადასტურების შემდეგ კოდი მეორედ აღარ იმუშავებს</span>
              </>
            )}
          </section>
        )}
      </div>

      {table?.deal && (
        <section className="card" style={{ gap: 12 }}>
          <div className="row between">
            <h2 style={{ fontSize: 18 }}>{table.deal.productName} — ჯავშნები</h2>
            <div className="row" style={{ gap: 8 }}>
              <span className="chip tone-butter" style={{ fontSize: 13 }}>გაიტანეს {table.redeemed}</span>
              <span className="chip tone-pink" style={{ fontSize: 13 }}>ელოდება {table.waiting}</span>
            </div>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>ტელეფონი</th><th>დაჯავშნა</th><th>წყარო</th><th>სტატუსი</th></tr></thead>
              <tbody>
                {table.rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.phone}</td>
                    <td className="muted">{dateTime(r.createdAt)}</td>
                    <td className="muted">{SOURCE_LABEL[r.source]}</td>
                    <td><StatusChip map={RES_STATUS} value={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
