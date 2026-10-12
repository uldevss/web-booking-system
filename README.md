# Booking System — Hospitality, Travel & Events

A two-sided booking marketplace for **hotels, short-term rentals, tour operators, escape
rooms, event venues and restaurants**. Businesses list what can be booked (rooms, cabins,
tours, game rooms, halls, tables), guests book nights or time slots with live availability,
and an **admin** oversees the platform.

Built with Next.js 16 (App Router) + TypeScript, Tailwind CSS + shadcn/ui, PostgreSQL +
Prisma 7, Auth.js v5, Zod, Recharts, and Resend for email.

## Features

| Area | What it does |
|---|---|
| Accounts | Guest sign-up, business sign-up with category (`/provider/register`), login, four roles (customer, provider, staff, admin) with route guards, suspended accounts blocked |
| Email verification | Sign-ups must use an allowed domain (`ALLOWED_EMAIL_DOMAINS`, Gmail by default) and enter a 6-digit code emailed to them before the account can book or manage anything; codes are hashed, expire after 15 minutes and are rate-limited |
| Profiles | Name, phone, photo (resized in the browser), email-notification preference, password change |
| Catalog | Browse by category or search (`/services`, `/providers`), business pages with ratings and reviews (`/providers/[id]`) |
| Booking options | Each business lists options with a booking type (**timed** slot or **nightly** stay), pricing per booking / per person / per night, a guest limit, and check-in/check-out times for stays |
| Resources | Rooms, rental units, tables, spaces and staff members, each with weekly opening hours and the options it can be booked for |
| Availability | `GET /api/availability?serviceId&from&to[&nights]` returns free time slots, or free check-in dates for a stay of N nights, from the resources' hours minus pending/confirmed bookings |
| Booking | `/book/[serviceId]`: calendar (dates + nights for stays, time slots otherwise) → guests → confirm; a free room/table/space/guide is assigned automatically and the price is computed server-side |
| Changes | Guests cancel or change dates up to 24 h before (configurable); businesses can always; businesses can reassign a booking to another room/table/person |
| Payments | To book a priced option the guest pays upfront by GCash: a deposit (`NEXT_PUBLIC_DEPOSIT_PERCENT`, 20% by default) or the full amount, sent to the **platform's** GCash account (QR + number set by the admin under Payment settings), entering the GCash reference. The business checks it and records the payment (partial, paid, refunded). No online charging |
| Commission | Confirming a booking confirms the GCash payment the guest reported; the platform keeps a commission (5% by default, editable in Payment settings). Businesses see gross, commission and net under Earnings (searchable) and can cash out their balance to their GCash; admins see totals, approve cash-outs and record the GCash reference under Commission. The seed includes a demo GCash QR |
| Reviews | One review per completed booking; admins can hide or delete; hidden reviews don't count |
| Notifications | In-app bell + email for booked, confirmed, cancelled, rescheduled, reassigned, review request, payment received, and daily check-in reminders |
| Admin | Approve/suspend businesses, suspend users, browse all bookings, moderate reviews |
| Reports | Revenue by day/week/month, bookings by status, top options, utilisation per room/space/staff (nights, hours, no-shows), cancellation & no-show rates, average rating, CSV export |

### How double booking is prevented

1. Every booking, date change and reassignment re-checks availability **inside a
   `SERIALIZABLE` transaction** using the same code the calendar uses. If two requests race,
   Postgres aborts one (`P2034`); it is retried, sees the other booking, and either picks a
   different free resource or answers "no longer available". See `lib/bookings.ts`.
2. A Postgres **exclusion constraint** (`Booking_no_overlap`, in the migrations) makes
   overlapping active bookings for one resource impossible, whatever code writes them.

`npm test` proves this with 12 simultaneous requests for one slot: exactly one wins. It
also checks that a 3-night stay blocks the room's nights but frees it on check-out day.

### Security notes

- Passwords hashed with bcrypt; login, sign-up and booking are rate-limited (stored in Postgres).
- Every page, server action and API route checks the role **and** ownership against the
  database (a business can only touch its own options, resources and bookings; guests only
  see their own bookings; staff only see bookings assigned to them). The proxy (`proxy.ts`)
  only does fast redirects.
- All input is validated with Zod (`lib/validators.ts`). Prices are always computed from the
  database, never taken from the browser. Times are stored in UTC and shown in the platform
  time zone.
- CSV export defuses spreadsheet formulas; emails escape user content.

## Getting started (local)

Requirements: Node.js 20.19+ (tested on 26). No Docker or Postgres install needed.

```bash
npm install
cp .env.example .env        # then set AUTH_SECRET (npx auth secret)
npm run db:start            # terminal 1: local Postgres on port 5433 (leave running)
npm run db:migrate          # terminal 2: create tables
npm run db:seed             # demo data
npm run dev                 # http://localhost:3000
```

On Windows you can also double-click `start-app.cmd` to start the database and the app and open the browser.

Demo logins are printed by `npm run db:seed`; they all share the password in
`prisma/seed.ts` (`DEMO_PASSWORD`):

| Email | Role |
|---|---|
| admin@example.com | Admin |
| provider@example.com | Business owner (Harbor View Hotel) |
| employee@example.com | Staff (Harbor View Hotel concierge) |
| tours@example.com | Business owner (Island Hop Palawan) |
| pending@example.com | Business owner awaiting approval |
| customer@example.com | Guest |

The seed creates one approved business per category plus one awaiting approval, with
about six weeks of past and upcoming bookings, payments and reviews.

### Sign in with Google

With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` set (see `.env.example` for the
Google Cloud steps), the login and sign-up pages show **Continue with Google**. A first
Google sign-in creates a guest account for that Gmail address, already verified. If an
account with that email exists, Google signs into it. Business owners still register
through the business form, then can use Google to sign in with the same email.

### Email notifications through Gmail

Every account is notified at its own email address (booking requests, confirmations,
cancellations, date changes, payments, review requests and check-in reminders). To send
real emails, let the platform use a Gmail account:

1. In that Google account, turn on **2-Step Verification**.
2. Create an **App Password** at https://myaccount.google.com/apppasswords.
3. Put both in `.env`:

   ```
   GMAIL_USER="yourplatform@gmail.com"
   GMAIL_APP_PASSWORD="xxxx xxxx xxxx xxxx"
   ```

4. Check it works:

   ```bash
   npm run email:test -- you@gmail.com
   ```

Gmail allows roughly 500 emails a day per account, which is plenty for development and
small deployments. Without these settings (and without `RESEND_API_KEY`), emails are
printed in the `npm run dev` terminal instead. Each person can turn email notifications off
in their profile.

### Scripts

| Script | Purpose |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run db:start` | Local Postgres (data in `~/.booking-system/pgdata`, outside OneDrive) |
| `npm run db:migrate` | Apply/create migrations (`prisma migrate dev`) |
| `npm run db:seed` | Load demo data (skips if already seeded) |
| `npm run db:reset` | Wipe the local database, re-migrate and re-seed |
| `npm run db:studio` | Browse data in Prisma Studio |
| `npm test` | Unit tests + database tests (uses the separate `hospitality_test` database) |
| `npm run lint` / `typecheck` | ESLint / TypeScript |

## Deploying to Vercel

1. Create a Postgres database on **Neon** or **Supabase** (free tier).
2. Push this repo to GitHub and import it in Vercel.
3. Set environment variables in Vercel (see `.env.example`):
   `DATABASE_URL` (pooled URL), `DIRECT_URL` (direct URL, for migrations), `AUTH_SECRET`,
   `APP_URL`, `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`, and the `NEXT_PUBLIC_*` settings.
4. The build runs `prisma generate`. Apply migrations from your machine with
   `DATABASE_URL=<direct url> npx prisma migrate deploy` (or add it to the build command).
5. `vercel.json` schedules `/api/cron/reminders` daily at 10:00 UTC (6 PM Manila) to send
   next-day check-in reminders; Vercel sends `CRON_SECRET` automatically.

## Project structure

```
app/
├─ page.tsx, services/, providers/      public pages (category browse, search, business pages)
├─ (auth)/login, register, actions.ts   sign-in / sign-up
├─ book/[serviceId]/                    booking flow (stay picker or slot picker)
├─ dashboard/(customer)/                guest: overview, bookings
├─ dashboard/profile/, notifications/   every role
├─ provider/register/                   business sign-up
├─ provider/(dashboard)/                business: bookings, booking options, staff & resources, reports, profile
├─ employee/                            staff: my bookings
├─ admin/                               admin: overview/reports, businesses, users, bookings, reviews
└─ api/                                 availability, bookings, payments, reviews, notifications, reports, cron
components/                             UI (shadcn/ui in components/ui)
lib/                                    business logic: catalog, bookings, slots, notifications, reports, auth helpers
prisma/                                 schema, migrations, seed
tests/                                  node:test unit + database tests
```

## Possible next steps

Online payments (PayMongo), SMS reminders, business-specific time zones and seasonal
pricing, guests choosing a specific room or guide, photo galleries in object storage, and
minimum-stay rules per date range.
