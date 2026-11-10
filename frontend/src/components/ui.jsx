import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { money, timeLeft, tone } from '../format'

export function Logo({ to = '/deals' }) {
  return (
    <Link to={to} className="logo" aria-label="ერთად — მთავარი">
      <span className="logo-dots">
        <span style={{ background: '#6A4BE0' }} />
        <span style={{ background: '#FFD9EA' }} />
        <span style={{ background: '#CFF3E4' }} />
      </span>
      <span className="logo-text">ერთად</span>
    </Link>
  )
}

/** Product photo, or a pastel placeholder with the first letter. */
export function ProductImage({ id, name, imageUrl, height = 170, radius, children }) {
  const [bg] = tone(id)
  return (
    <div className="pimg" style={{ height, background: bg, borderRadius: radius }}>
      {imageUrl ? <img src={imageUrl} alt={name} /> : <span className="pimg-letter" aria-hidden="true">{name?.[0]}</span>}
      {children}
    </div>
  )
}

export function OriginBadge({ origin }) {
  return origin === 'FromRequests'
    ? <span className="chip pimg-badge" style={{ background: '#6A4BE0', color: '#fff' }}>მყიდველების მოთხოვნით</span>
    : <span className="chip pimg-badge" style={{ background: '#fff', color: '#9A3F14' }}>მაღაზიის შეთავაზება</span>
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
      <ProductImage id={deal.productId} name={deal.productName} imageUrl={deal.imageUrl}>
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
          <span className="muted">{isNew || deal.confirmed === 0 ? 'ახალი · ' : ''}{timeLeft(deal.deadline)}</span>
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
        const [bg, fg] = tone(i + 2)
        return <span key={i} className="avatar" style={{ background: bg, color: fg }}>{ch}</span>
      })}
      {extra > 0 && <span className="avatar" style={{ background: '#E9E3FF', color: '#4F33BF', fontSize: 12 }}>+{extra}</span>}
    </div>
  )
}

/** Days / hours / minutes boxes, ticking every 30s. */
export function Countdown({ to }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(to) - Date.now())
  const m = Math.floor(ms / 60000)
  const parts = [
    [Math.floor(m / 1440), 'დღე'],
    [String(Math.floor((m % 1440) / 60)).padStart(2, '0'), 'საათი'],
    [String(m % 60).padStart(2, '0'), 'წუთი'],
  ]
  return (
    <div className="countdown" role="timer" aria-label="დარჩენილი დრო">
      {parts.map(([v, l]) => <div key={l}><strong>{v}</strong><span>{l}</span></div>)}
    </div>
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
    ['tone-violet', 'მოითხოვე ფასი', 'აირჩიე ნივთი და მიუთითე, რამდენს გადაიხდიდი'],
    ['tone-butter', 'მაღაზია გთავაზობს', 'როცა ბევრი ვართ, მაღაზია ჯგუფურ ფასს აცხადებს'],
    ['tone-mint', 'ჯგუფი ივსება', 'დაჯავშნე და მოიწვიე მეგობრები. წინასწარ არაფერს იხდი'],
    ['tone-pink', 'გაიტანე მაღაზიიდან', 'აჩვენე კოდი და გადაიხადე ადგილზე'],
  ]
  return (
    <section className="stack" id="how">
      <h2>როგორ მუშაობს</h2>
      <div className="grid-auto">
        {steps.map(([cls, title, text], i) => (
          <div key={i} className={'how-step ' + cls}>
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
  const s = map[value] ?? { label: value, cls: 'tone-white' }
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

/** Small hook: load data from the API; returns [data, error, reload]. */
export function useLoad(fn, deps) {
  const [state, setState] = useState({ data: null, error: null })
  const load = () => fn().then((data) => setState({ data, error: null })).catch((e) => setState({ data: null, error: e.message }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, deps)
  return [state.data, state.error, load]
}
