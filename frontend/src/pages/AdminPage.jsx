import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Loading, StatusChip, useLoad } from '../components/ui'
import { DEAL_STATUS, dateTime, money } from '../format'

const TABS = [['stores', 'მაღაზიები'], ['products', 'პროდუქტები'], ['staff', 'თანამშრომლები'], ['deals', 'შეთავაზებები'], ['log', 'შეტყობინებები']]

export default function AdminPage() {
  const { me } = useAuth()
  const [tab, setTab] = useState('stores')
  if (me == null) return <Loading />
  if (!me.authenticated || me.role !== 'Admin') return <Navigate to="/staff/login?next=/admin" replace />

  return (
    <main className="page">
      <h1>ადმინისტრირება</h1>
      <div role="tablist" className="filters">
        {TABS.map(([k, l]) => <button key={k} role="tab" type="button" className="filter" aria-selected={tab === k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {tab === 'stores' && <Stores />}
      {tab === 'products' && <Products />}
      {tab === 'staff' && <Staff />}
      {tab === 'deals' && <Deals />}
      {tab === 'log' && <Log />}
    </main>
  )
}

/** Generic inline form helper: fields = [[key, label, type]] */
function SimpleForm({ fields, initial, onSubmit, submitLabel = 'შენახვა' }) {
  const [v, setV] = useState(initial)
  const [error, setError] = useState(null)
  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    try { await onSubmit(v); setV(initial) } catch (err) { setError(err.message) }
  }
  return (
    <form className="card" style={{ gap: 12 }} onSubmit={submit}>
      <div className="form-grid">
        {fields.map(([k, label, type, options]) => (
          <label key={k} className="field" htmlFor={'f-' + k}>{label}
            {type === 'select' ? (
              <select id={'f-' + k} className="input" value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })}>
                {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
              </select>
            ) : type === 'checkbox' ? (
              <input id={'f-' + k} type="checkbox" checked={!!v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} style={{ width: 22, height: 22 }} />
            ) : (
              <input id={'f-' + k} className="input" type={type || 'text'} value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <ErrorBox error={error} />
      <button className="btn" style={{ alignSelf: 'flex-start' }}>{submitLabel}</button>
    </form>
  )
}

function Stores() {
  const [stores, error, reload] = useLoad(() => api('/admin/stores'), [])
  const [editing, setEditing] = useState(null)
  const fields = [['name', 'სახელი'], ['city', 'ქალაქი'], ['address', 'მისამართი'], ['mapUrl', 'რუკის ბმული'], ['commissionPerItem', 'საკომისიო / ერთეული, ₾', 'number'], ['isActive', 'აქტიური', 'checkbox']]
  const save = async (v) => {
    const body = { ...v, commissionPerItem: Number(v.commissionPerItem) }
    await api(editing ? `/admin/stores/${editing.id}` : '/admin/stores', { method: editing ? 'PUT' : 'POST', body })
    setEditing(null); reload()
  }
  return (
    <section className="stack">
      <ErrorBox error={error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>სახელი</th><th>ქალაქი</th><th>საკომისიო</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>{stores?.map((s) => (
            <tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.city}</td><td>{money(s.commissionPerItem)}</td><td>{s.isActive ? 'დიახ' : 'არა'}</td>
              <td><button type="button" className="btn btn-sm btn-soft" onClick={() => setEditing(s)}>რედაქტირება</button></td></tr>
          ))}</tbody>
        </table>
      </div>
      <h2>{editing ? `რედაქტირება: ${editing.name}` : 'ახალი მაღაზია'}</h2>
      <SimpleForm key={editing?.id ?? 'new'} fields={fields} onSubmit={save}
        initial={editing ?? { name: '', city: 'ქუთაისი', address: '', mapUrl: '', commissionPerItem: 5, isActive: true }} />
    </section>
  )
}

function Products() {
  const [products, error, reload] = useLoad(() => api('/admin/products'), [])
  const [stores] = useLoad(() => api('/admin/stores'), [])
  const [editing, setEditing] = useState(null)
  if (!stores) return <Loading />
  const fields = [
    ['storeId', 'მაღაზია', 'select', stores.map((s) => [s.id, s.name])],
    ['name', 'სახელი'], ['description', 'აღწერა'], ['regularPrice', 'ფასი, ₾', 'number'], ['isActive', 'აქტიური', 'checkbox'],
  ]
  const save = async (v) => {
    const body = { ...v, storeId: Number(v.storeId), regularPrice: Number(v.regularPrice) }
    await api(editing ? `/admin/products/${editing.id}` : '/admin/products', { method: editing ? 'PUT' : 'POST', body })
    setEditing(null); reload()
  }
  const upload = async (id, file) => {
    const form = new FormData()
    form.append('file', file)
    try { await api(`/admin/products/${id}/image`, { method: 'POST', form }); reload() } catch (e) { alert(e.message) }
  }
  return (
    <section className="stack">
      <ErrorBox error={error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>ფოტო</th><th>სახელი</th><th>ფასი</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>{products?.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                {p.imageUrl && <img src={p.imageUrl} alt="" width="48" height="48" style={{ objectFit: 'cover', borderRadius: 10, display: 'block', marginBottom: 4 }} />}
                <label className="small" style={{ cursor: 'pointer', color: 'var(--accent-ink)', fontWeight: 700 }}>
                  ატვირთვა<input type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(e) => e.target.files[0] && upload(p.id, e.target.files[0])} />
                </label>
              </td>
              <td>{p.name}<div className="small muted">{p.description}</div></td>
              <td>{money(p.regularPrice)}</td><td>{p.isActive ? 'დიახ' : 'არა'}</td>
              <td><button type="button" className="btn btn-sm btn-soft" onClick={() => setEditing(p)}>რედაქტირება</button></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <h2>{editing ? `რედაქტირება: ${editing.name}` : 'ახალი პროდუქტი'}</h2>
      <SimpleForm key={editing?.id ?? 'new'} fields={fields} onSubmit={save}
        initial={editing ?? { storeId: stores[0]?.id, name: '', description: '', regularPrice: '', isActive: true }} />
    </section>
  )
}

function Staff() {
  const [staff, error, reload] = useLoad(() => api('/admin/staff'), [])
  const [stores] = useLoad(() => api('/admin/stores'), [])
  if (!stores) return <Loading />
  const fields = [
    ['email', 'ელ-ფოსტა', 'email'], ['password', 'პაროლი (მინ. 8)', 'password'],
    ['role', 'როლი', 'select', [['StoreStaff', 'მაღაზიის თანამშრომელი'], ['Admin', 'ადმინი']]],
    ['storeId', 'მაღაზია', 'select', stores.map((s) => [s.id, s.name])],
  ]
  const save = async (v) => {
    await api('/admin/staff', { method: 'POST', body: { ...v, storeId: v.role === 'Admin' ? null : Number(v.storeId) } })
    reload()
  }
  return (
    <section className="stack">
      <ErrorBox error={error} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>ელ-ფოსტა</th><th>როლი</th><th>მაღაზია</th></tr></thead>
          <tbody>{staff?.map((s) => <tr key={s.id}><td>{s.id}</td><td>{s.email}</td><td>{s.role}</td><td>{s.storeName ?? '—'}</td></tr>)}</tbody>
        </table>
      </div>
      <h2>ახალი ანგარიში</h2>
      <SimpleForm fields={fields} onSubmit={save} submitLabel="შექმნა" initial={{ email: '', password: '', role: 'StoreStaff', storeId: stores[0]?.id }} />
    </section>
  )
}

function Deals() {
  const [deals, error, reload] = useLoad(() => api('/admin/deals'), [])
  const cancel = async (d) => {
    if (!confirm(`გავაუქმო „${d.productName}“? ყველა ჯავშანი გაუქმდება და მყიდველები SMS-ს მიიღებენ.`)) return
    await api(`/admin/deals/${d.id}/cancel`, { method: 'POST' })
    reload()
  }
  return (
    <section className="card table-wrap">
      <ErrorBox error={error} />
      <table>
        <thead><tr><th>#</th><th>პროდუქტი</th><th>მაღაზია</th><th>ფასი</th><th>ჯავშანი</th><th>ვადა</th><th>სტატუსი</th><th></th></tr></thead>
        <tbody>{deals?.map((d) => (
          <tr key={d.id}>
            <td>{d.id}</td><td><a href={`/d/${d.slug}`} target="_blank" rel="noreferrer">{d.productName}</a></td><td>{d.storeName}</td>
            <td>{money(d.groupPrice)}</td><td>{d.confirmed} / {d.min}</td><td>{dateTime(d.deadline)}</td>
            <td><StatusChip map={DEAL_STATUS} value={d.status} /></td>
            <td>{['Draft', 'Open', 'Activated'].includes(d.status) && <button type="button" className="btn btn-sm btn-ghost" onClick={() => cancel(d)}>გაუქმება</button>}</td>
          </tr>
        ))}</tbody>
      </table>
    </section>
  )
}

function Log() {
  const [log, error] = useLoad(() => api('/admin/notifications'), [])
  return (
    <section className="card table-wrap">
      <ErrorBox error={error} />
      <table>
        <thead><tr><th>დრო</th><th>ტელეფონი</th><th>ტიპი</th><th>ტექსტი</th></tr></thead>
        <tbody>{log?.map((n) => (
          <tr key={n.id}><td style={{ whiteSpace: 'nowrap' }}>{dateTime(n.sentAt)}</td><td>{n.phone}</td><td>{n.type}</td><td className="small">{n.body}</td></tr>
        ))}</tbody>
      </table>
      {log?.length === 0 && <span className="muted">შეტყობინება ჯერ არ არის</span>}
    </section>
  )
}
