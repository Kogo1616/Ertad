# Decisions

Where the spec was ambiguous or the request changed it, we took the simplest option that keeps the business rules. Each one is noted here.

## Stack
- **React (Vite, plain JSX) instead of Razor Pages.** The product owner asked for a React frontend. The API is ASP.NET Core (.NET 10) with controllers; the React app calls `/api/*`. In dev, Vite proxies `/api` to the API, so cookies are same-origin. `npm run build` writes into `backend/Ertad.Api/wwwroot`, so in production one process serves both.
- **One project for the backend** (`Ertad.Api`): `Domain/` (entities), `Data/` (DbContext, seed, migrations), `Services/` (business rules), `Controllers/` (HTTP). No repositories or CQRS: the DbContext is used directly.
- **All deal state changes go through `DealService`.** Controllers stay thin.

## Auth
- **One cookie scheme for everybody.** The role claim (`Buyer`, `StoreStaff`, `Admin`) decides access. One browser is signed in as one kind of user at a time.
- **Staff use a small `StaffUser` table with ASP.NET Core Identity's `PasswordHasher`** instead of the full Identity schema (users/roles/claims tables). That gives the same email + password + role model with far less code. You can switch to full Identity later without touching the deal logic.
- **OTP:** a 6-digit code, valid for 5 minutes, 5 wrong tries max, and at most 5 codes per phone in about 10 minutes. In Development the API also returns the code (`devCode`) and the login page shows it, because there's no SMS gateway yet.
- **DisplayInitial** comes from an optional name field on the OTP step (first letter). Only the initial is ever shown publicly.

## Deals
- **Reservations stay open after activation** while stock and time remain (status `Open` or `Activated`). Buyers who join an activated deal get their code right away. Once stock is full, new buyers go to the waitlist.
- **Pickup deadline is per code:** `IssuedAt + PickupDays`. For the original group, `IssuedAt = ActivatedAt`, as the spec says. Buyers promoted from the waitlist get a full pickup window from the moment they're promoted.
- **`ConfirmedCount` = Confirmed + Redeemed reservations.** It only changes through atomic `UPDATE … SET ConfirmedCount = ConfirmedCount ± 1 WHERE …` statements (EF `ExecuteUpdate`). The reserve path holds the deal's row lock until commit, so activation and code issuing happen in the same transaction.
- **A cancelled reservation keeps its pickup code row**, but redemption also requires `Reservation.Status = Confirmed`, so the code is dead. This avoids deletes and keeps an audit trail.
- **"One active deal at a time" is enforced per product** (at most one Open/Activated deal per product). The seed has two live deals on different products, so a per-store limit would contradict it.
- **Drafts:** a deal can be saved as a draft and published later. Once it's Open, nothing can be edited. There is no edit endpoint at all; only an admin can cancel (cancelling sets it to `Failed`, cancels reservations and notifies buyers).
- **Closing:** an Activated deal whose deadline has passed and has no Confirmed (unpicked) reservations left becomes `Closed`. Any remaining waitlist entries are cancelled.
- **Price-chip suggestions** are the regular price × 0.70 / 0.75 / 0.85, rounded to 5 ₾ (80 ₾ → 55 / 60 / 70).
- **Store demand buckets** are relative to the regular price: ≤ R×0.65, ≤ R×0.70, ≤ R×0.75, > R×0.75 (labelled R×0.80+), plus "no price". Each bound is rounded to 5 ₾. For 80 ₾ this gives exactly ≤50 / 55 / 60 / 65+.
- **The "N people want ≤ this price" hint** counts interests with `MaxPrice ≥ offer`. The API gives the store grouped counts per price, never individual rows.

## Notifications
- `Notifier.Queue()` adds a `NotificationLog` row inside the same transaction as the business change. After commit, `FlushAsync()` hands the messages to `ISmsSender`. `DevSmsSender` logs to the console.
- **Post-pickup "1/2" reply:** there's no inbound SMS in the MVP. The answer is stored with `POST /api/my/reservations/{id}/pickup-answer`, and the buyer's reservation page shows the two buttons.
- The 24h reminder is sent once per deal (claimed through `ReminderSentAt`). Its share link carries `?ref=<userId>`.

## Attribution
- `?src=list|store|sms` and `?ref=<userId>` on `/d/{slug}` are kept in `sessionStorage`, so they survive the login redirect, and are sent with the reservation. `ref` wins and means `SharedLink`. A self-referral is ignored.

## Dates
- All timestamps are stored in UTC. They are shown in Asia/Tbilisi time (UTC+4, no DST). Georgian day and month names are hard-coded because not every browser or OS ships `ka` locale data.
- The store's deadline input (`datetime-local`) is read as Tbilisi time.

## Tests
- Integration tests run against real PostgreSQL. With `ERTAD_TEST_DB` set (a server connection string), they use that server and create and drop one database per test. Without it, they start a Testcontainers `postgres:17-alpine` container (needs Docker).

## Visual design
- **Direction C, dark and modern** (chosen 2026-11-12): near-black background (#0C0F14), slightly lighter cards with 1px borders, and a single lime accent (#B8F23A). The pastel/violet look from the mockups is gone.
- **Lime is used sparingly**, only where it should pull attention: the group price, the main button, progress bars, the discount badge and the selected item. Everything else is neutral, so the accent keeps working. Status colors (green, amber, red, sky) are muted, soft-background chips.
- **Shape:** cards have a 16px radius, buttons, chips and filters are pills, and inputs have a 12px radius. There are no shadows or gradients; a small hover lift on cards is disabled under prefers-reduced-motion.
- **Dark is the default.** Light is opt-in through the header/sidebar toggle, stored in localStorage (`ertad-theme`) and applied by an inline script in index.html before first paint. In light mode lime can't be used as text on white, so prices and links switch to a dark olive (`--accent-ink`, #3F6212), and lime stays as a fill only.
- All colors live as CSS custom properties in `styles.css`. Components use tokens only, no hex values, except purely decorative SVG.

## SMS
- **Providers: ubill.ge (recommended) and sender.ge.** Both cost about 0.01 ₾ per SMS. ubill has no minimum package, documents its API fully and has an `otp` priority flag for login codes, but it needs a registered sender brand. sender.ge was first chosen as the cheapest documented Georgian API at about 0.01 ₾ per part. ubill.ge has a similar price, but its public API docs were incomplete. Twilio-type international providers cost about $0.10+ per SMS to Georgia. `SenderGeSmsSender` posts to `https://sender.ge/api/send.php` with the 9-digit national number. `Dev` stays the default provider.
- **Transliteration on by default:** Georgian text is converted to Latin before sending (GSM-7, 160 chars per part, vs UCS-2 at 70). A typical notification drops from 3 parts to 1–2.
- **`smsno=2` (informational)** for all messages. They are codes and deal updates the buyer asked for, not advertising.
- **A failed SMS after a committed change is logged, not rolled back.** For example, a deal still activates even if one buyer's SMS fails; the code is always on the reservation page. Only the login code and the manual pickup-code resend report the failure to the user.
- **The pickup-code resend is limited to 3 per reservation, 60 s apart,** and recorded in `NotificationLog` as `CodeResent`.

## Real data
- **Demo seed is off by default (`Seed:Demo`).** On every start only an admin account is ensured (`Seed:AdminEmail` / `Seed:AdminPassword`), so a wiped database is usable right away. Integration tests turn the demo on.
- **Stores and products are switched off, not deleted** (`IsActive`), because deals, reservations and commissions reference them.
