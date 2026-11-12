# ერთად (Ertad) — group-discount MVP

Buyers pool interest in a product. The partner store answers with a group price. If enough people reserve before the deadline, everyone gets a pickup code and pays in the store.

- **Backend:** ASP.NET Core (.NET 10) Web API, EF Core + PostgreSQL (Npgsql), cookie auth, a background job that runs every minute
- **Frontend:** React 19 + React Router (Vite, plain JSX), one hand-written CSS file with design tokens
- **Tests:** xUnit integration tests against real PostgreSQL (your local server or Testcontainers)

## Prerequisites
- .NET SDK 10
- Node.js 20+ (LTS)
- PostgreSQL 17 on `localhost:5432`, user `postgres` / password `postgres`. Either use a local install, or run `docker compose up -d`.

## Run (development)

Terminal 1, the API on http://localhost:5080. It applies migrations and seeds demo data on first start:

```bash
cd backend/Ertad.Api
dotnet run --launch-profile http
```

Terminal 2, React on http://localhost:5173. It proxies `/api` to the API:

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

### Single-process mode
`npm run build` (in `frontend/`) writes the app into `backend/Ertad.Api/wwwroot`. After that, `dotnet run` alone serves the site at http://localhost:5080.

## Logins

| Who | How |
| --- | --- |
| Admin | `/staff/login`: `admin@ertad.ge` / `Admin123!` → `/admin`. It's created on first start; change it with `Seed:AdminEmail` / `Seed:AdminPassword` before the first start in production. |
| Store staff | Accounts the admin creates on `/admin` → „თანამშრომლები“. |
| Buyer | `/login`: any phone number. In Development (Dev SMS) the code is shown on the page and printed in the API console. |

## Adding real stores (admin UI)

The database starts empty apart from the admin account.

1. Log in at `/staff/login` as the admin. You land on `/admin`.
2. **„მაღაზიები“:** fill in name, city, address, map link and commission per sold item, then press „შენახვა“.
3. **„პროდუქტები“:** choose the store, enter name, description, regular price and an optional photo. To sell it at a group price right away, tick „ჯგუფური ფასით გაყიდვა“ and set the group price, how many people must join, stock, duration in days and pickup days. On save the deal is published and the card shows the group price next to the crossed-out regular price.
4. **„თანამშრომლები“:** create the store's login (email, password of at least 8 characters, role „მაღაზიის თანამშრომელი“, the store).
5. The store logs in at `/staff/login` and publishes group deals from its panel (`/store`).

Required fields are marked with *. A product that never had a deal can be deleted („წაშლა“ in its row). A product with deals, and any store, can only be switched off: untick „აქტიური“ and save, so past deals and reports stay intact.

## Real SMS

By default SMS go to the API console (`Sms:Provider = Dev`), and the login page shows the code. Two real providers are built in.

### ubill.ge (recommended, cheapest: 0.01 ₾ per SMS, no minimum package)

1. Create an account at [ubill.ge](https://ubill.ge), top up the SMS balance, and register a sender name (brand, e.g. `Ertad`). Wait until ubill approves it.
2. Copy the API key from the company settings and the brand's numeric ID.
3. Start the API:

```powershell
$env:Sms__Provider="Ubill"; $env:Sms__Ubill__ApiKey="YOUR_KEY"; $env:Sms__Ubill__BrandId="YOUR_BRAND_ID"; dotnet run --launch-profile http
```

Login codes are sent with ubill's `otp` flag, which gives them top priority. Text is transliterated to Latin by default (`Sms:Ubill:Transliterate`).

### sender.ge

To send real SMS through sender.ge instead:

1. Create an account at [sender.ge](https://sender.ge), top up the balance (about 0.01 ₾ per SMS part), and copy your API key.
2. Start the API with the provider and key set as environment variables. Keep the key out of git:

```bash
Sms__Provider=SenderGe Sms__SenderGe__ApiKey=YOUR_KEY dotnet run --launch-profile http
```

PowerShell: `$env:Sms__Provider="SenderGe"; $env:Sms__SenderGe__ApiKey="YOUR_KEY"; dotnet run --launch-profile http`

Settings (`appsettings.json` → `Sms:SenderGe`):

| Setting | Default | Meaning |
| --- | --- | --- |
| `SmsNo` | `2` | 2 = informational (no opt-out text). 1 = advertising. |
| `Transliterate` | `true` | Sends Georgian text in Latin letters ("ertad: sheni kodia 123456"). A Latin SMS part holds 160 characters, a Georgian one only 70, so this costs 2–3× less. |
| `Priority` | not sent | `1` skips sender.ge's subscription check, so codes reach buyers who opted out of SMS. It only works after you enable it for your Brand Name in the sender.ge panel. |

Only Georgian numbers (+995) can receive SMS through sender.ge. When the real provider is on, the login page no longer shows the code.

**Resend limits** (each SMS costs money):
- **Login code:** the next one can be sent 60 s after the last, and at most 5 codes go out in about 10 minutes.
- **Pickup code:** the buyer can have it re-sent from the reservation page, at most 3 times, 60 s apart. The code is always visible on that page anyway.

## Demo data (optional)

Off by default. To load it, start the API on an **empty** database with `Seed:Demo=true` (PowerShell: `$env:Seed__Demo="true"`). It contains:
- Store staff login `store@ertad.ge` / `Store123!`.
- Buyers `+995 555 00 00 01` … `+995 555 00 00 30`.
- One store, „[მაღაზია]“ in Kutaisi, with 12 household appliances.
- 30 demo buyers. The blender has 18 interests; 12 of them give a price (3×≤50, 2×55, 7×60).
- **Blender:** a FromRequests deal at 60 ₾, 7 / 10 reserved, stock 20 (`/d/blender-60`).
- **Coffee machine:** a StoreInitiated deal at 210 ₾, min 6, stock 12, 2 reserved (`/d/coffee-210`).

To wipe everything: `dropdb -U postgres ertad`, then start the API again (it recreates the schema and the admin account).

## Tests

The tests need a PostgreSQL server. Either point them at yours (each test creates its own database and drops it afterwards):

```bash
cd backend
ERTAD_TEST_DB="Host=localhost;Port=5432;Username=postgres;Password=postgres" dotnet test
```

PowerShell: `$env:ERTAD_TEST_DB="Host=localhost;Port=5432;Username=postgres;Password=postgres"; dotnet test`

Or leave `ERTAD_TEST_DB` unset to use Testcontainers (Docker required).

What's covered: the race for the last slot (exactly one buyer wins, the other is waitlisted), parallel buyers never exceeding stock, a double reserve by the same buyer, activation at the minimum with codes issued, idempotent redemption (one sale, one commission), failure at the deadline, waitlist promotion after a cancellation, one active interest per user, and max prices never appearing in public JSON or HTML.

## Architecture

```
backend/
  Ertad.Api/
    Domain/Entities.cs        all entities + enums
    Data/AppDbContext.cs      indexes & constraints (filtered unique indexes)
    Data/DbSeeder.cs          demo data
    Data/Migrations/          EF Core migrations (dotnet ef migrations add <Name> -p Ertad.Api -o Data/Migrations)
    Services/DealService.cs   ALL deal rules: create/publish, reserve, activate, waitlist, cancel, redeem, jobs
    Services/Notifier.cs      ISmsSender, DevSmsSender, notification queue (NotificationLog)
    Services/DealJob.cs       BackgroundService, runs DealService.RunJobsAsync() every minute
    Controllers/              Auth, Public (buyer site), My (buyer's own data), Store (panel), Admin
  Ertad.Tests/                xUnit integration tests
frontend/
  src/main.jsx                routes
  src/api.js, auth.jsx        fetch wrapper, current-user context
  src/styles.css              design tokens + components
  src/components/             header/sidebar layouts, shared UI (cards, progress, slots, countdown…)
  src/pages/                  buyer pages, store/ panel pages, AdminPage
docs/
  mockups/                    original design files
  decisions.md                choices made where the spec was open
```

**How the key rules are enforced**
- *Never oversell.* Reserving runs one atomic `UPDATE "Deals" SET "ConfirmedCount" = "ConfirmedCount" + 1 WHERE id = @id AND status IN (Open, Activated) AND "ConfirmedCount" < "MaxStock" AND now() < deadline` inside a transaction. If 0 rows are updated, the buyer is waitlisted. If the minimum is reached, the same transaction activates the deal and issues the codes.
- *One interest / one reservation per buyer.* Filtered unique indexes: `(UserId, StoreProductId) WHERE Status = 'Active'` and `(DealId, UserId) WHERE Status <> 'Cancelled'`.
- *Idempotent redemption.* `UPDATE "PickupCodes" SET "RedeemedAt" = now() WHERE id = @id AND "RedeemedAt" IS NULL …`, plus a unique index on `Commissions.PickupCodeId`.
- *Privacy.* Public endpoints never return `MaxPrice`. The store gets only aggregates: count, buckets, median, and grouped counts per price.

## Routes

Buyer: `/` (home), `/deals`, `/stores`, `/stores/:id`, `/stores/:id/products/:id`, `/d/:slug`, `/login`, `/my/reservations`, `/my/reservations/:id`, `/how` (with FAQ), `/for-stores` (partner application form)
Store: `/store`, `/store/deals/new`, `/store/redeem`, `/store/reports/:dealId`
Admin: `/admin` (stores, products, staff, deals, partner applications, notification log)

## Not in the MVP
Online payment, a native app, multiple cities, reviews, a real SMS gateway (swap `DevSmsSender` for a real `ISmsSender`), inbound SMS replies.
