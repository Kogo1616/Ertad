import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, tone } from '../format'

export function Logo({ to = '/deals' }) {
  return (
    <Link to={to} className="logo" aria-label="ერთად — მთავარი">
      <span className="logo-mark" aria-hidden="true"><span /><span /><span /></span>
      <span className="logo-text">ერთად</span>
    </Link>
  )
}

/** Product photo, or a neutral placeholder with the first letter. */
export function ProductImage({ name, imageUrl, height = 170, radius, children }) {
  return (
    <div className="pimg" style={{ height, borderRadius: radius }}>
      {imageUrl ? <img src={imageUrl} alt={name} /> : <span className="pimg-letter" aria-hidden="true">{name?.[0]}</span>}
      {children}
    </div>
  )
}

/** Shown instead of buyer actions (reserve, request a price) when an admin or store account is logged in. */
export function StaffBuyerNote({ roleName }) {
  return (
    <div className="note" role="note" style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <strong>ჯავშანი და ფასის მოთხოვნა მხოლოდ მყიდველებისთვისაა</strong>
      <span className="small">შენ შესული ხარ როგორც {roleName}. დასაჯავშნად გამოდი სისტემიდან და შედი მყიდველის ანგარიშით (ტელეფონის ნომრით).</span>
    </div>
  )
}

/** Store photo/logo, or its first letter on a soft lime tile. */
export function StoreLogo({ name, imageUrl, size = 48, round = false }) {
  const style = { width: size, height: size, flex: 'none', borderRadius: round ? '50%' : Math.round(size / 4), overflow: 'hidden' }
  if (imageUrl) return <img src={imageUrl} alt="" style={{ ...style, objectFit: 'cover', display: 'block' }} />
  return (
    <span aria-hidden="true" style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--accent-soft)', color: 'var(--accent-ink)', fontWeight: 800, fontSize: Math.round(size * 0.4) }}>
      {name?.replace('[', '')[0]}
    </span>
  )
}

export function OriginBadge({ origin }) {
  return origin === 'FromRequests'
    ? <span className="chip pimg-badge badge-origin req">მყიდველების მოთხოვნით</span>
    : <span className="chip pimg-badge badge-origin">მაღაზიის შეთავაზება</span>
}

export function Progress({ value, max }) {
  const pct = max > 0 ? Math.max(3, Math.min(100, Math.round((value / max) * 100))) : 0
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div style={{ width: pct + '%' }} />
    </div>
  )
}

/** Card used on /deals and in the store's live preview. */
export function DealCard({ deal, to, isNew }) {
  const body = (
    <>
      <ProductImage name={deal.productName} imageUrl={deal.imageUrl}>
        <OriginBadge origin={deal.origin} />
        <span className="pimg-off">−{deal.percentOff}%</span>
      </ProductImage>
      <div className="body">
        <span style={{ fontSize: 16, fontWeight: 700 }}>{deal.productName}</span>
        <span className="small muted">{deal.storeName} · {deal.storeCity}</span>
      </div>
      <div className="price-line">
        <span className="now">{money(deal.groupPrice)}</span>
        <span className="strike" style={{ fontSize: 15 }}>{money(deal.regularPrice)}</span>
      </div>
      <div className="stack-sm" style={{ padding: '0 4px 4px' }}>
        <Progress value={deal.confirmed} max={deal.min} />
        <div className="row between small">
          <strong>{deal.confirmed} / {deal.min} ჯავშანი</strong>
          <span className="muted">{isNew || deal.confirmed === 0 ? 'ახალი · ' : ''}<LiveTimeLeft to={deal.deadline} /></span>
        </div>
      </div>
    </>
  )
  return to ? <Link to={to} className="deal-card">{body}</Link> : <div className="deal-card">{body}</div>
}

export function AvatarStack({ initials, total }) {
  const extra = total - initials.length
  return (
    <div className="avatars" aria-hidden="true">
      {initials.map((ch, i) => {
        const [bg, fg] = tone(i)
        return <span key={i} className="avatar" style={{ background: bg, color: fg }}>{ch}</span>
      })}
      {extra > 0 && <span className="avatar" style={{ background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 12 }}>+{extra}</span>}
    </div>
  )
}

/** Re-renders every second until `to` has passed; returns the remaining time split up. */
function useRemaining(to) {
  const [now, setNow] = useState(() => Date.now())
  const end = new Date(to).getTime()
  useEffect(() => {
    if (!(end > Date.now())) return
    const t = setInterval(() => {
      const n = Date.now()
      setNow(n)
      if (n >= end) clearInterval(t)
    }, 1000)
    return () => clearInterval(t)
  }, [end])
  const total = Math.max(0, Math.floor((end - now) / 1000))
  return {
    done: total === 0,
    d: Math.floor(total / 86400),
    h: Math.floor((total % 86400) / 3600),
    m: Math.floor((total % 3600) / 60),
    s: total % 60,
  }
}
const pad = (n) => String(n).padStart(2, '0')

/** Days / hours / minutes / seconds boxes, ticking live every second. */
export function Countdown({ to }) {
  const { done, d, h, m, s } = useRemaining(to)
  if (done) return <p className="muted" role="status">ვადა ამოიწურა</p>
  const parts = [[d, 'დღე'], [pad(h), 'საათი'], [pad(m), 'წუთი'], [pad(s), 'წამი']]
  return (
    // role="timer" is not announced every second by screen readers; the label gives the full value on demand.
    <div className="countdown" role="timer" aria-label={`დარჩენილია ${d} დღე, ${h} საათი, ${m} წუთი`}>
      {parts.map(([v, l]) => <div key={l}><strong>{v}</strong><span>{l}</span></div>)}
    </div>
  )
}

/** Compact live time left for cards: "6 დღე 23:41:05", "05:12:09", or "დასრულდა". */
export function LiveTimeLeft({ to, suffix = '' }) {
  const { done, d, h, m, s } = useRemaining(to)
  if (done) return <span>დასრულდა</span>
  const clock = `${pad(h)}:${pad(m)}:${pad(s)}`
  return (
    <span role="timer" style={{ fontVariantNumeric: 'tabular-nums' }}>
      {d > 0 ? `${d} დღე ${clock}` : clock}{suffix}
    </span>
  )
}

export function CopyButton({ text, label = 'კოპირება', className = 'btn btn-sm', style }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) } catch { /* ignore */ }
    setDone(true)
    setTimeout(() => setDone(false), 1500)
  }
  return <button type="button" className={className} style={style} onClick={copy}>{done ? 'დაკოპირდა ✓' : label}</button>
}

export function HowItWorks() {
  const steps = [
    ['მოითხოვე ფასი', 'აირჩიე ნივთი და მიუთითე, რამდენს გადაიხდიდი'],
    ['მაღაზია გთავაზობს', 'როცა ბევრი ვართ, მაღაზია ჯგუფურ ფასს აცხადებს'],
    ['ჯგუფი ივსება', 'დაჯავშნე და მოიწვიე მეგობრები. წინასწარ არაფერს იხდი'],
    ['გაიტანე მაღაზიიდან', 'აჩვენე კოდი და გადაიხადე ადგილზე'],
  ]
  return (
    <section className="stack" id="how">
      <h2>როგორ მუშაობს</h2>
      <div className="grid-auto">
        {steps.map(([title, text], i) => (
          <div key={i} className="how-step">
            <span className="num">{i + 1}</span>
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function StatusChip({ map, value }) {
  const s = map[value] ?? { label: value, cls: 'tone-neutral' }
  return <span className={'chip ' + s.cls}>{s.label}</span>
}

export function ErrorBox({ error }) {
  return error ? <div className="error" role="alert">{error}</div> : null
}

export function Loading() {
  return <div className="empty">იტვირთება…</div>
}

export const LockIcon = () => (
  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
)
export const CheckIcon = ({ size = 42 }) => (
  <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
)
export const SearchIcon = () => (
  <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
)

/** Seconds left until `until` (ms timestamp), ticking every second; 0 when passed. */
export function useSecondsLeft(until) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!until || until <= Date.now()) return
    const t = setInterval(() => tick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [until])
  return until ? Math.max(0, Math.ceil((until - Date.now()) / 1000)) : 0
}

/** Small hook: load data from the API; returns [data, error, reload]. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null })
  const load = () => fn().then((data) => setState({ data, error: null })).catch((e) => setState({ data: null, error: e.message }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, deps)
  return [state.data, state.error, load]
}
