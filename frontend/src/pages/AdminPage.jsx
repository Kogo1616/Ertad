import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Loading, StatusChip, useLoad } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
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

const MAX_IMAGE_BYTES = 5_000_000
const IMAGE_TYPES = 'image/png,image/jpeg,image/webp'

/** Photo picker with a preview of the chosen (or current) image. */
function ImageInput({ id, file, currentUrl, onChange }) {
  const [error, setError] = useState(null)
  const [preview, setPreview] = useState(null)
  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const pick = (e) => {
    const f = e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (f.size > MAX_IMAGE_BYTES) { setError('ფაილი 5 MB-ზე დიდია'); return }
    setError(null)
    onChange(f)
  }
  const shown = preview ?? currentUrl
  return (
    <div className="row" style={{ gap: 14 }}>
      <div className="pimg" style={{ width: 72, height: 72, flex: 'none' }}>
        {shown ? <img src={shown} alt="" /> : <span className="small muted">ფოტო</span>}
      </div>
      <div className="stack-sm" style={{ gap: 6, alignItems: 'flex-start' }}>
        <div className="row" style={{ gap: 8 }}>
          <span className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
            {shown ? 'შეცვლა' : 'ფოტოს არჩევა'}
            <input id={id} type="file" accept={IMAGE_TYPES} hidden onChange={pick} />
          </span>
          {file && <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)}>გაუქმება</button>}
        </div>
        <span className="small muted" style={{ fontWeight: 500 }}>jpg, png ან webp, 5 MB-მდე</span>
        {error && <span className="small" style={{ color: 'var(--danger)' }}>{error}</span>}
      </div>
    </div>
  )
}

/** kind: 'products' | 'stores' */
async function uploadImage(kind, id, file) {
  const form = new FormData()
  form.append('file', file)
  return api(`/admin/${kind}/${id}/image`, { method: 'POST', form })
}

/** Thumbnail + upload/replace button for a table row. */
function RowImage({ imageUrl, onFile }) {
  return (
    <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
      <div className="pimg" style={{ width: 48, height: 48, flex: 'none' }}>
        {imageUrl ? <img src={imageUrl} alt="" /> : <span className="small muted">—</span>}
      </div>
      <label className="btn btn-soft btn-sm" style={{ cursor: 'pointer' }}>
        {imageUrl ? 'შეცვლა' : 'ატვირთვა'}
        <input type="file" accept={IMAGE_TYPES} hidden onChange={(e) => { const f = e.target.files[0]; e.target.value = ''; if (f) onFile(f) }} />
      </label>
    </div>
  )
}

/** Generic inline form helper: fields = [[key, label, type, options]]; `required` = keys that must be filled. */
function SimpleForm({ fields, initial, onSubmit, submitLabel = 'შენახვა', required = [] }) {
  const [v, setV] = useState(initial)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const submit = async (e) => {
    e.preventDefault()
    const missing = fields.find(([k, , type]) => required.includes(k) && (type === 'number' ? !(Number(v[k]) > 0) : !String(v[k] ?? '').trim()))
    if (missing) { setError(`შეავსე სავალდებულო ველი: ${missing[1]}`); return }
    setError(null); setBusy(true)
    try { await onSubmit(v); setV(initial) } catch (err) { setError(err.message) } finally { setBusy(false) }
  }
  return (
    <form className="card" style={{ gap: 12 }} onSubmit={submit} noValidate>
      <div className="form-grid">
        {fields.map(([k, label, type, options]) => (
          <label key={k} className={'field' + (type === 'image' ? ' field-full' : '')} htmlFor={'f-' + k}>
            <span>{label}{required.includes(k) && <span style={{ color: 'var(--danger)' }} aria-label="სავალდებულო"> *</span>}</span>
            {type === 'select' ? (
              <select id={'f-' + k} className="input" value={v[k] ?? ''} onChange={(e) => setV({ ...v, [k]: e.target.value })}>
                {options.map(([val, text]) => <option key={val} value={val}>{text}</option>)}
              </select>
            ) : type === 'image' ? (
              <ImageInput id={'f-' + k} file={v[k]} currentUrl={v.imageUrl} onChange={(file) => setV({ ...v, [k]: file })} />
            ) : type === 'checkbox' ? (
              <span className="check-row">
                <input id={'f-' + k} type="checkbox" checked={!!v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />
                {v[k] ? 'დიახ' : 'არა'}
              </span>
            ) : (
              <input id={'f-' + k} className="input" type={type || 'text'} value={v[k] ?? ''} required={required.includes(k)}
                aria-required={required.includes(k)} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined}
                onChange={(e) => setV({ ...v, [k]: e.target.value })} />
            )}
          </label>
        ))}
      </div>
      <ErrorBox error={error} />
      <div className="row" style={{ gap: 12 }}>
        <button className="btn" disabled={busy}>{submitLabel}</button>
        {required.length > 0 && <span className="small muted"><span style={{ color: 'var(--danger)' }}>*</span> სავალდებულო ველი</span>}
      </div>
    </form>
  )
}

function Stores() {
  const [stores, error, reload] = useLoad(() => api('/admin/stores'), [])
  const [editing, setEditing] = useState(null)
  const [rowError, setRowError] = useState(null)
  const fields = [['name', 'სახელი'], ['city', 'ქალაქი'], ['address', 'მისამართი'], ['mapUrl', 'რუკის ბმული'], ['commissionPerItem', 'საკომისიო / ერთეული, ₾', 'number'], ['isActive', 'აქტიური', 'checkbox'], ['photo', 'ფოტო ან ლოგო', 'image']]
  const save = async ({ photo, ...v }) => {
    const body = { ...v, commissionPerItem: Number(v.commissionPerItem) }
    const saved = await api(editing ? `/admin/stores/${editing.id}` : '/admin/stores', { method: editing ? 'PUT' : 'POST', body })
    if (photo) await uploadImage('stores', saved.id, photo)
    setEditing(null); reload()
  }
  const upload = async (id, file) => {
    setRowError(null)
    if (file.size > MAX_IMAGE_BYTES) { setRowError('ფაილი 5 MB-ზე დიდია'); return }
    try { await uploadImage('stores', id, file); reload() } catch (e) { setRowError(e.message) }
  }
  return (
    <section className="stack">
      <ErrorBox error={error ?? rowError} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>ფოტო</th><th>სახელი</th><th>ქალაქი</th><th>საკომისიო</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>{stores?.map((s) => (
            <tr key={s.id}><td>{s.id}</td><td><RowImage imageUrl={s.imageUrl} onFile={(f) => upload(s.id, f)} /></td><td>{s.name}</td><td>{s.city}</td><td>{money(s.commissionPerItem)}</td><td>{s.isActive ? 'დიახ' : 'არა'}</td>
              <td><button type="button" className="btn btn-sm btn-soft" onClick={() => setEditing(s)}>რედაქტირება</button></td></tr>
          ))}</tbody>
        </table>
      </div>
      <h2>{editing ? `რედაქტირება: ${editing.name}` : 'ახალი მაღაზია'}</h2>
      <SimpleForm key={editing?.id ?? 'new'} fields={fields} onSubmit={save} required={['name']}
        initial={editing ?? { name: '', city: 'ქუთაისი', address: '', mapUrl: '', commissionPerItem: 5, isActive: true }} />
    </section>
  )
}

function Products() {
  const confirm = useConfirm()
  const [products, error, reload] = useLoad(() => api('/admin/products'), [])
  const [stores] = useLoad(() => api('/admin/stores'), [])
  const [editing, setEditing] = useState(null)
  const [rowError, setRowError] = useState(null)
  if (!stores) return <Loading />
  if (stores.length === 0) return <div className="empty">ჯერ დაამატე მაღაზია „მაღაზიების“ ჩანართში</div>
  const fields = [
    ['storeId', 'მაღაზია', 'select', stores.map((s) => [s.id, s.name])],
    ['name', 'სახელი'], ['description', 'აღწერა'], ['regularPrice', 'ფასი, ₾', 'number'], ['isActive', 'აქტიური', 'checkbox'],
    ['photo', 'ფოტო', 'image'],
  ]
  const save = async ({ photo, ...v }) => {
    const body = { ...v, storeId: Number(v.storeId), regularPrice: Number(v.regularPrice) }
    const saved = await api(editing ? `/admin/products/${editing.id}` : '/admin/products', { method: editing ? 'PUT' : 'POST', body })
    if (photo) await uploadImage('products', saved.id, photo)
    setEditing(null); reload()
  }
  const upload = async (id, file) => {
    setRowError(null)
    if (file.size > MAX_IMAGE_BYTES) { setRowError('ფაილი 5 MB-ზე დიდია'); return }
    try { await uploadImage('products', id, file); reload() } catch (e) { setRowError(e.message) }
  }
  const remove = async (p) => {
    const ok = await confirm({
      title: `წავშალო „${p.name}“?`,
      message: 'პროდუქტი წაიშლება ფოტოსთან და მყიდველების მოთხოვნებთან ერთად. ამის დაბრუნება ვეღარ მოხერხდება.',
      confirmLabel: 'წაშლა',
      danger: true,
    })
    if (!ok) return
    setRowError(null)
    try {
      await api(`/admin/products/${p.id}`, { method: 'DELETE' })
      if (editing?.id === p.id) setEditing(null)
      reload()
    } catch (e) { setRowError(e.message) }
  }
  return (
    <section className="stack">
      <ErrorBox error={error ?? rowError} />
      <div className="card table-wrap">
        <table>
          <thead><tr><th>#</th><th>ფოტო</th><th>სახელი</th><th>ფასი</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>{products?.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><RowImage imageUrl={p.imageUrl} onFile={(f) => upload(p.id, f)} /></td>
              <td>{p.name}<div className="small muted">{p.description}</div></td>
              <td>{money(p.regularPrice)}</td><td>{p.isActive ? 'დიახ' : 'არა'}</td>
              <td>
                <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => setEditing(p)}>რედაქტირება</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(p)} aria-label={`წაშლა: ${p.name}`}>წაშლა</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <h2>{editing ? `რედაქტირება: ${editing.name}` : 'ახალი პროდუქტი'}</h2>
      <SimpleForm key={editing?.id ?? 'new'} fields={fields} onSubmit={save} required={['name', 'regularPrice']}
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
      <SimpleForm fields={fields} onSubmit={save} submitLabel="შექმნა" required={['email', 'password']} initial={{ email: '', password: '', role: 'StoreStaff', storeId: stores[0]?.id }} />
    </section>
  )
}

function Deals() {
  const confirm = useConfirm()
  const [deals, error, reload] = useLoad(() => api('/admin/deals'), [])
  const cancel = async (d) => {
    const ok = await confirm({
      title: `გავაუქმო „${d.productName}“-ის შეთავაზება?`,
      message: 'ყველა ჯავშანი გაუქმდება და მყიდველები SMS-ს მიიღებენ. ამის დაბრუნება ვეღარ მოხერხდება.',
      confirmLabel: 'შეთავაზების გაუქმება',
      cancelLabel: 'უკან',
      danger: true,
    })
    if (!ok) return
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
