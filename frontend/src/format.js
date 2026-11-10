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

// Pastel pairs [background, text] as CSS tokens, so they follow light/dark mode. All pass 4.5:1.
export const TONES = [
  ['var(--mint)', 'var(--mint-ink)'],
  ['var(--butter)', 'var(--butter-ink)'],
  ['var(--pink)', 'var(--pink-ink)'],
  ['var(--violet-soft)', 'var(--violet-ink)'],
  ['var(--peach)', 'var(--peach-ink)'],
]
export const tone = (i) => TONES[Math.abs(i) % TONES.length]

export const SOURCE_LABEL = {
  StorePage: 'მაღაზიის გვერდი',
  DealsList: 'შეთავაზებების სია',
  SharedLink: 'გაზიარებული ბმული',
  Notification: 'SMS შეტყობინება',
}

export const RES_STATUS = {
  Confirmed: { label: 'დადასტურებული', cls: 'tone-mint' },
  Waitlisted: { label: 'მოლოდინის სიაში', cls: 'tone-butter' },
  Cancelled: { label: 'გაუქმებული', cls: 'tone-white' },
  Expired: { label: 'ვადაგასული', cls: 'tone-peach' },
  Redeemed: { label: 'გატანილი', cls: 'tone-violet' },
}

export const DEAL_STATUS = {
  Draft: { label: 'მონახაზი', cls: 'tone-white' },
  Open: { label: 'ჯგუფი გროვდება', cls: 'tone-butter' },
  Activated: { label: 'ჯგუფი შეივსო', cls: 'tone-mint' },
  Failed: { label: 'ვერ შეგროვდა', cls: 'tone-pink' },
  Closed: { label: 'დასრულებული', cls: 'tone-violet' },
}
