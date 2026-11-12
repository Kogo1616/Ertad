// Money, dates (Asia/Tbilisi, Georgian), colors.

export const money = (v) => (v == null ? '—' : `${Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 })} ₾`)

// Georgian names are hard-coded: not every browser ships 'ka' locale data.
// Tbilisi is UTC+4 all year (no DST), so we shift by 4h and read UTC fields.
const DAYS = ['კვირა', 'ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი', 'შაბათი']
const DAYS_SHORT = ['კვი', 'ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ']
const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ']
const tb = (iso) => new Date(new Date(iso).getTime() + 4 * 3600000)
const hm = (d) => `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`

/** "პარასკევი, 18:00" if within a week, otherwise "პარ, 14 ნოე, 18:00". */
export function when(iso) {
  if (!iso) return '—'
  const days = (new Date(iso) - Date.now()) / 86400000
  const d = tb(iso)
  return days > -6 && days < 6 ? `${DAYS[d.getUTCDay()]}, ${hm(d)}` : dateTime(iso)
}
export function dateTime(iso) {
  if (!iso) return '—'
  const d = tb(iso)
  return `${DAYS_SHORT[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${hm(d)}`
}

/** "1 დღე 6 სთ", "5 სთ", "40 წთ" */
export function timeLeft(iso) {
  const ms = new Date(iso) - Date.now()
  if (ms <= 0) return 'დასრულდა'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), min = m % 60
  if (d > 0) return h > 0 ? `${d} დღე ${h} სთ` : `${d} დღე`
  if (h > 0) return `${h} სთ`
  return `${min} წთ`
}

/** <input type="datetime-local"> value interpreted as Tbilisi time (UTC+4, no DST). */
export const tbilisiLocalToIso = (local) => new Date(local + ':00+04:00').toISOString()
export function isoToTbilisiLocal(iso) {
  const d = new Date(new Date(iso).getTime() + 4 * 3600000)
  return d.toISOString().slice(0, 16)
}

// Soft [background, text] pairs for avatars and icon squares. CSS tokens, so they follow the theme.
export const TONES = [
  ['var(--accent-soft)', 'var(--accent-ink)'],
  ['var(--info-soft)', 'var(--info)'],
  ['var(--warning-soft)', 'var(--warning)'],
  ['var(--danger-soft)', 'var(--danger)'],
  ['var(--success-soft)', 'var(--success)'],
]
export const tone = (i) => TONES[Math.abs(i) % TONES.length]

export const SOURCE_LABEL = {
  StorePage: 'მაღაზიის გვერდი',
  DealsList: 'შეთავაზებების სია',
  SharedLink: 'გაზიარებული ბმული',
  Notification: 'SMS შეტყობინება',
}

export const RES_STATUS = {
  Confirmed: { label: 'დადასტურებული', cls: 'tone-success' },
  Waitlisted: { label: 'მოლოდინის სიაში', cls: 'tone-warning' },
  Cancelled: { label: 'გაუქმებული', cls: 'tone-neutral' },
  Expired: { label: 'ვადაგასული', cls: 'tone-danger' },
  Redeemed: { label: 'გატანილი', cls: 'tone-accent' },
}

export const DEAL_STATUS = {
  Draft: { label: 'მონახაზი', cls: 'tone-neutral' },
  Open: { label: 'ჯგუფი გროვდება', cls: 'tone-warning' },
  Activated: { label: 'ჯგუფი შეივსო', cls: 'tone-success' },
  Failed: { label: 'ვერ შეგროვდა', cls: 'tone-danger' },
  Closed: { label: 'დასრულებული', cls: 'tone-neutral' },
}
