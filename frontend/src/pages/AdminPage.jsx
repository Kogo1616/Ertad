import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Loading, StatusChip, useLoad } from '../components/ui'
import { useConfirm } from '../components/ConfirmDialog'
import { DEAL_STATUS, dateTime, money, timeLeft, when } from '../format'

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
function SimpleForm({ fields, initial, onSubmit, submitLabel = 'შენახვა', required = [], children }) {
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
      {typeof children === 'function' ? children(v) : children}
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

const EMPTY_DEAL = { enabled: false, groupPrice: '', minReservations: '10', maxStock: '20', durationDays: '7', pickupDays: '3', warrantyTerms: '' }

/** Problem with the group-deal fields, or null. Checked before anything is saved. */
function dealError(deal, regularPrice) {
  if (!deal.enabled) return null
  const price = Number(deal.groupPrice), min = Number(deal.minReservations), stock = Number(deal.maxStock), days = Number(deal.durationDays)
  if (!(price > 0)) return 'შეავსე ჯგუფური ფასი'
  if (regularPrice > 0 && price >= regularPrice) return `ჯგუფური ფასი ჩვეულებრივ ფასზე (${money(regularPrice)}) ნაკლები უნდა იყოს`
  if (!(min >= 1)) return 'მიუთითე, რამდენი ადამიანი უნდა შეგროვდეს'
  if (!(stock >= min)) return 'მარაგი არ უნდა იყოს ადამიანების რაოდენობაზე ნაკლები'
  if (!(days >= 1 && days <= 60)) return 'ვადა 1-დან 60 დღემდე'
  if (!(Number(deal.pickupDays) >= 1)) return 'გატანის ვადა მინიმუმ 1 დღე'
  return null
}

/** "Sell at a group price" block inside the product form, with a live before/after preview. */
function DealSection({ deal, setDeal, regularPrice, liveDeal }) {
  if (liveDeal) {
    return (
      <div className="note" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <strong>აქტიური ჯგუფური შეთავაზება: {money(liveDeal.groupPrice)} · {liveDeal.confirmed} / {liveDeal.min} ჯავშანი</strong>
        <span>ვადა: {when(liveDeal.deadline)} · <a href={`/d/${liveDeal.slug}`} target="_blank" rel="noreferrer">საჯარო გვერდი</a>. პირობები აღარ იცვლება; საჭიროების შემთხვევაში გააუქმე „შეთავაზებების“ ჩანართში.</span>
      </div>
    )
  }
  const set = (k) => (e) => setDeal({ ...deal, [k]: e.target.value })
  const price = Number(deal.groupPrice)
  const off = regularPrice > 0 && price > 0 && price < regularPrice ? Math.round(((regularPrice - price) / regularPrice) * 100) : null
  const deadline = Number(deal.durationDays) > 0 ? new Date(Date.now() + Number(deal.durationDays) * 86400000).toISOString() : null
  const req = <span style={{ color: 'var(--danger)' }} aria-label="სავალდებულო"> *</span>

  return (
    <fieldset className="deal-box">
      <legend className="sr-only">ჯგუფური შეთავაზება</legend>
      <label className="check-row" htmlFor="deal-enabled" style={{ height: 'auto' }}>
        <input id="deal-enabled" type="checkbox" checked={deal.enabled} onChange={(e) => setDeal({ ...deal, enabled: e.target.checked })} />
        <span>
          <strong style={{ fontSize: 16 }}>ჯგუფური ფასით გაყიდვა</strong>
          <span className="small muted" style={{ display: 'block', fontWeight: 500 }}>ფასი აქტიურდება, როცა ვადაში საკმარისი ადამიანი შეგროვდება</span>
        </span>
      </label>
      {deal.enabled && (
        <>
          <div className="form-grid">
            <label className="field" htmlFor="d-price"><span>ჯგუფური ფასი, ₾{req}</span>
              <input id="d-price" className="input" type="number" min="0" step="any" value={deal.groupPrice} onChange={set('groupPrice')} /></label>
            <label className="field" htmlFor="d-min"><span>რამდენი ადამიანი უნდა შეგროვდეს{req}</span>
              <input id="d-min" className="input" type="number" min="1" value={deal.minReservations} onChange={set('minReservations')} /></label>
            <label className="field" htmlFor="d-stock"><span>მარაგი, ცალი{req}</span>
              <input id="d-stock" className="input" type="number" min="1" value={deal.maxStock} onChange={set('maxStock')} /></label>
            <label className="field" htmlFor="d-days"><span>ვადა, დღე{req}</span>
              <input id="d-days" className="input" type="number" min="1" max="60" value={deal.durationDays} onChange={set('durationDays')} /></label>
            <label className="field" htmlFor="d-pickup"><span>გატანის ვადა, დღე{req}</span>
              <input id="d-pickup" className="input" type="number" min="1" value={deal.pickupDays} onChange={set('pickupDays')} /></label>
            <label className="field" htmlFor="d-warranty"><span>გარანტია</span>
              <input id="d-warranty" className="input" placeholder="მაგ. 1 წელი" value={deal.warrantyTerms} onChange={set('warrantyTerms')} /></label>
          </div>
          {/* How buyers will see it */}
          <div className="deal-preview" aria-live="polite">
            <span className="small muted">ასე დაინახავენ მყიდველები</span>
            <div className="row" style={{ alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontSize: 30, fontWeight: 800, color: 'var(--accent-ink)' }}>{price > 0 ? money(price) : '— ₾'}</span>
              {regularPrice > 0 && <span className="strike" style={{ fontSize: 18 }}>{money(regularPrice)}</span>}
              {off != null && <span className="chip" style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}>−{off}% · დაზოგე {money(regularPrice - price)}</span>}
            </div>
            <span className="small">
              აქტიურდება, თუ <strong>{deal.minReservations || '—'}</strong> ადამიანი შეგროვდება{deadline ? <> <strong>{when(deadline)}</strong>-მდე</> : ''}. მაქსიმუმ {deal.maxStock || '—'} ცალი.
            </span>
          </div>
          <span className="small muted">გამოქვეყნების შემდეგ ფასი, რაოდენობა და ვადა აღარ იცვლება. ვინც ამ პროდუქტს ითხოვდა, SMS-ს მიიღებს.</span>
        </>
      )}
    </fieldset>
  )
}

function Products() {
  const confirm = useConfirm()
  const [products, error, reload] = useLoad(() => api('/admin/products'), [])
  const [stores] = useLoad(() => api('/admin/stores'), [])
  const [editing, setEditing] = useState(null)
  const [rowError, setRowError] = useState(null)
  const [deal, setDeal] = useState(EMPTY_DEAL)
  const [notice, setNotice] = useState(null)
  if (!stores) return <Loading />
  if (stores.length === 0) return <div className="empty">ჯერ დაამატე მაღაზია „მაღაზიების“ ჩანართში</div>
  const fields = [
    ['storeId', 'მაღაზია', 'select', stores.map((s) => [s.id, s.name])],
    ['name', 'სახელი'], ['description', 'აღწერა'], ['regularPrice', 'ჩვეულებრივი ფასი, ₾', 'number'], ['isActive', 'აქტიური', 'checkbox'],
    ['photo', 'ფოტო', 'image'],
  ]
  const startEdit = (p) => { setEditing(p); setDeal(EMPTY_DEAL); setNotice(null) }
  const save = async ({ photo, ...v }) => {
    const regularPrice = Number(v.regularPrice)
    const problem = editing?.liveDeal ? null : dealError(deal, regularPrice)
    if (problem) throw new Error(problem)
    setNotice(null)
    const body = { ...v, storeId: Number(v.storeId), regularPrice }
    const saved = await api(editing ? `/admin/products/${editing.id}` : '/admin/products', { method: editing ? 'PUT' : 'POST', body })
    if (photo) await uploadImage('products', saved.id, photo)
    if (deal.enabled && !editing?.liveDeal) {
      try {
        const d = await api(`/admin/products/${saved.id}/deal`, {
          method: 'POST',
          body: {
            groupPrice: Number(deal.groupPrice), minReservations: Number(deal.minReservations), maxStock: Number(deal.maxStock),
            durationDays: Number(deal.durationDays), pickupDays: Number(deal.pickupDays), warrantyTerms: deal.warrantyTerms,
          },
        })
        setNotice({ text: 'პროდუქტი შენახულია და ჯგუფური შეთავაზება გამოქვეყნდა.', slug: d.slug })
      } catch (e) {
        reload()
        throw new Error(`პროდუქტი შენახულია, მაგრამ შეთავაზება ვერ გამოქვეყნდა: ${e.message}`)
      }
    }
    setEditing(null); setDeal(EMPTY_DEAL); reload()
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
          <thead><tr><th>#</th><th>ფოტო</th><th>სახელი</th><th>ფასი</th><th>ჯგუფური</th><th>აქტიური</th><th></th></tr></thead>
          <tbody>{products?.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td><RowImage imageUrl={p.imageUrl} onFile={(f) => upload(p.id, f)} /></td>
              <td>{p.name}<div className="small muted">{p.description}</div></td>
              <td>{money(p.regularPrice)}</td>
              <td>
                {p.liveDeal
                  ? <><strong style={{ color: 'var(--accent-ink)' }}>{money(p.liveDeal.groupPrice)}</strong><div className="small muted">{p.liveDeal.confirmed} / {p.liveDeal.min} · {timeLeft(p.liveDeal.deadline)}</div></>
                  : <span className="muted">—</span>}
              </td>
              <td>{p.isActive ? 'დიახ' : 'არა'}</td>
              <td>
                <div className="row" style={{ gap: 8, flexWrap: 'nowrap' }}>
                  <button type="button" className="btn btn-sm btn-soft" onClick={() => startEdit(p)}>რედაქტირება</button>
                  <button type="button" className="btn btn-sm btn-ghost" style={{ color: 'var(--danger)' }} onClick={() => remove(p)} aria-label={`წაშლა: ${p.name}`}>წაშლა</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <h2>{editing ? `რედაქტირება: ${editing.name}` : 'ახალი პროდუქტი'}</h2>
      {notice && <div className="note" role="status">{notice.text} {notice.slug && <a href={`/d/${notice.slug}`} target="_blank" rel="noreferrer">საჯარო გვერდი</a>}</div>}
      <SimpleForm key={editing?.id ?? 'new'} fields={fields} onSubmit={save} required={['name', 'regularPrice']}
        initial={editing ?? { storeId: stores[0]?.id, name: '', description: '', regularPrice: '', isActive: true }}>
        {(v) => <DealSection deal={deal} setDeal={setDeal} regularPrice={Number(v.regularPrice)} liveDeal={editing?.liveDeal} />}
      </SimpleForm>
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
