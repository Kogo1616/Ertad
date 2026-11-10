import { isoToTbilisiLocal } from '../../format'

/** Tbilisi-local "YYYY-MM-DDT18:00", N days from now. */
export function defaultDeadline(days) {
  const local = isoToTbilisiLocal(new Date(Date.now() + days * 86400000).toISOString())
  return local.slice(0, 11) + '18:00'
}

/** Pure-CSS bar chart of the price distribution. The bucket containing the offer is highlighted. */
export function PriceBars({ buckets, offerPrice }) {
  const max = Math.max(1, ...buckets.map((b) => b.count))
  const limits = buckets.slice(0, 3).map((b) => Number(b.label.replace(/[^0-9.]/g, '')))
  const hi = !offerPrice ? -1 : offerPrice <= limits[0] ? 0 : offerPrice <= limits[1] ? 1 : offerPrice <= limits[2] ? 2 : 3
  return (
    <div className="bars" role="img" aria-label={'ფასების განაწილება: ' + buckets.map((b) => `${b.label} — ${b.count}`).join(', ')}>
      {buckets.map((b, i) => (
        <div key={b.label}>
          <strong className="small">{b.count}</strong>
          <span className={'bar' + (i === hi ? ' hi' : '') + (i === 4 ? ' none' : '')} style={{ height: Math.round((b.count / max) * 80) + 'px' }} />
          <span className="lbl" title={b.label}>{b.label}</span>
        </div>
      ))}
    </div>
  )
}
