import { Link } from 'react-router-dom'
import { HowItWorks } from '../components/ui'

export default function HowPage() {
  return (
    <main className="page">
      <div className="stack-sm">
        <h1>ერთად იაფია</h1>
        <p className="muted">როცა ბევრს გვინდა ერთი და იგივე ნივთი, მაღაზია ჯგუფს სპეციალურ ფასს სთავაზობს.</p>
      </div>
      <HowItWorks />
      <div className="grid-auto">
        <div className="tile tone-white"><strong>ინტერესი ≠ ჯავშანი</strong><span className="small muted">„18 ითხოვს“ ნიშნავს, რომ 18 ადამიანს უნდა უკეთესი ფასი. „7 / 10 ჯავშანი“ — 7-მა უკვე დაეთანხმა კონკრეტულ ფასსა და პირობებს.</span></div>
        <div className="tile tone-white"><strong>წინასწარ 0 ₾</strong><span className="small muted">ონლაინ არაფერს იხდი. გადახდა მხოლოდ მაღაზიაში, ნივთის გატანისას.</span></div>
        <div className="tile tone-white"><strong>ვერ შეგროვდა?</strong><span className="small muted">ჯავშნები ავტომატურად უქმდება და SMS-ით გაცნობებთ.</span></div>
      </div>
      <div className="row"><Link to="/deals" className="btn">აქტიური შეთავაზებები</Link><Link to="/stores" className="btn btn-soft">მაღაზიები</Link></div>
    </main>
  )
}
