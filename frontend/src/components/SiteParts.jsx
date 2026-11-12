import { Link } from 'react-router-dom'
import { Logo } from './ui'

const FAQ = [
  ['როგორ მუშაობს ჯგუფური ფასი?', 'მაღაზია აცხადებს სპეციალურ ფასს, რომელიც აქტიურდება, როცა ვადაში საკმარისი ადამიანი დაჯავშნის. რაც მეტი ვართ, მით უფრო სწრაფად ივსება ჯგუფი.'],
  ['წინასწარ უნდა გადავიხადო?', 'არა. ჯავშანი უფასოა — იხდი მხოლოდ მაღაზიაში, ნივთის გატანისას.'],
  ['რა ხდება, თუ ჯგუფი ვერ შეივსო?', 'ჯავშანი ავტომატურად უქმდება და SMS-ით გაცნობებთ. არაფერს კარგავ.'],
  ['როგორ გავიტანო ნივთი?', 'ჯგუფის შევსებისას SMS-ით მიიღებ 6-ნიშნა კოდს. მაღაზიაში აჩვენებ კოდს და იხდი ჯგუფურ ფასს.'],
  ['რამდენი დრო მაქვს გასატანად?', 'ყოველ შეთავაზებას აქვს გატანის ვადა (მაგალითად, 3 დღე). ის შეთავაზების გვერდზე და შენს ბილეთზე წერია.'],
  ['შემიძლია ჯავშნის გაუქმება?', 'კი, „ჩემი ჯავშნების“ გვერდიდან. შენი ადგილი მოლოდინის სიაში მდგომ მყიდველს გადაეცემა.'],
  ['რა არის „ფასის მოთხოვნა“?', 'თუ ნივთზე აქცია ჯერ არ არის, მიუთითე, რამდენს გადაიხდიდი. როცა ბევრი ითხოვს, მაღაზია ჯგუფურ ფასს აცხადებს და SMS-ით გაცნობებთ. შენს ფასს მხოლოდ მაღაზია ხედავს.'],
  ['რატომ ითხოვთ ტელეფონის ნომერს?', 'შესასვლელად და SMS-ებისთვის: შესვლის კოდი, ჯგუფის სტატუსი და გატანის კოდი. ნომერი სხვა მყიდველებს არ უჩანს.'],
]

/** Frequently asked questions as native <details> (keyboard and screen-reader friendly, no JS). */
export function Faq({ title = 'ხშირი კითხვები', limit }) {
  const items = limit ? FAQ.slice(0, limit) : FAQ
  return (
    <section className="stack" aria-labelledby="faq-title">
      <h2 id="faq-title">{title}</h2>
      <div className="faq">
        {items.map(([q, a]) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </div>
      {limit && limit < FAQ.length && <Link to="/how#faq" className="small">ყველა კითხვა →</Link>}
    </section>
  )
}

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="stack-sm" style={{ maxWidth: 320 }}>
          <Logo to="/" />
          <p className="small muted">ჯგუფური შესყიდვები: ერთად ვაგროვებთ მყიდველებს, მაღაზია ჯგუფურ ფასს გვაძლევს. წინასწარ არაფერს ვიხდით.</p>
        </div>
        <nav aria-label="მყიდველებისთვის" className="footer-col">
          <strong>მყიდველებისთვის</strong>
          <Link to="/deals">აქტიური შეთავაზებები</Link>
          <Link to="/stores">მაღაზიები</Link>
          <Link to="/how">როგორ მუშაობს</Link>
          <Link to="/my/reservations">ჩემი ჯავშნები</Link>
        </nav>
        <nav aria-label="მაღაზიებისთვის" className="footer-col">
          <strong>მაღაზიებისთვის</strong>
          <Link to="/for-stores">რატომ „ერთად“</Link>
          <Link to="/for-stores#apply">გახდი პარტნიორი</Link>
          <Link to="/staff/login">მაღაზიის პანელი</Link>
        </nav>
      </div>
      <div className="site-footer-bottom">
        <span>© {new Date().getFullYear()} ერთად</span>
        <span>ჯგუფური ფასები საქართველოში</span>
      </div>
    </footer>
  )
}
