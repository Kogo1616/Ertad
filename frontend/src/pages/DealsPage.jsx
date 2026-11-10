import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { DealCard, ErrorBox, Loading, useLoad } from '../components/ui'

const FILTERS = [
  ['all', 'ყველა'],
  ['store', 'მაღაზიის შეთავაზება'],
  ['requests', 'მყიდველების მოთხოვნით'],
  ['ending', 'მალე მთავრდება'],
]

export default function DealsPage() {
  const [filter, setFilter] = useState('all')
  const [deals, error] = useLoad(() => api('/deals?filter=' + filter), [filter])

  return (
    <main className="page">
      <div className="page-head">
        <div className="stack-sm">
          <h1>ჯგუფური შეთავაზებები</h1>
          <p className="muted">შეუერთდი ჯგუფს — ფასი აქტიურდება, როცა საკმარისი ადამიანი შეგროვდება</p>
        </div>
        <div role="group" aria-label="ფილტრი" className="filters">
          {FILTERS.map(([key, label]) => (
            <button key={key} type="button" className="filter" aria-pressed={filter === key} onClick={() => setFilter(key)}>{label}</button>
          ))}
        </div>
      </div>

      <ErrorBox error={error} />
      {!deals && !error && <Loading />}
      {deals?.length === 0 && <div className="empty">ამ ფილტრით შეთავაზება ჯერ არ არის</div>}
      {deals?.length > 0 && (
        <div className="grid-cards">
          {deals.map((d) => <DealCard key={d.id} deal={d} to={`/d/${d.slug}?src=list`} />)}
        </div>
      )}

      <section className="cta-band tone-violet">
        <div className="stack-sm">
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--violet-ink)' }}>სასურველი ნივთი არ ჩანს?</span>
          <span style={{ fontSize: 14 }}>იპოვე ის მაღაზიის კატალოგში და მოითხოვე ჯგუფური ფასი</span>
        </div>
        <Link to="/stores" className="btn">მაღაზიების კატალოგი</Link>
      </section>
    </main>
  )
}
