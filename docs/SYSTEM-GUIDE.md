# Booking System — Complete System Guide

A two-sided marketplace for **Hospitality, Travel & Events**: hotels, short-term rentals, tour operators, escape rooms, event venues and restaurants list what guests can book; guests pay a deposit or the full amount by GCash; the platform keeps a commission and pays businesses out.

- Live site: https://booking-system-ul18.vercel.app
- Source code: https://github.com/uldevss/web-booking-system
- Local: `start-app.cmd` or `npm run db:start` + `npm run dev`, then http://localhost:3000

---

## 1. Roles and what each one can do

| Role | Who | What they can do |
|---|---|---|
| **Guest (Customer)** | Anyone who signs up with a Gmail address or Google | Browse and search listings, book a time slot or a stay, pay by GCash, see and manage their bookings, cancel or change dates (up to 24 h before), leave one review per completed booking, get in-app and email notifications |
| **Business (Provider)** | The owner of a hotel, rental, tour company, escape room, venue or restaurant | Register the business, set up rooms/units/tables/spaces/staff with weekly hours, create booking options with prices and capacity, confirm/complete/cancel bookings, reassign rooms or staff, see reports and earnings, cash out to GCash |
| **Staff (Employee)** | A person a business adds as a bookable resource, e.g. a tour guide or concierge | Sees only the bookings assigned to them, marks them completed or no-show |
| **Admin** | The platform operator | Approves or suspends businesses, suspends users, sees every booking, moderates reviews, sets the platform GCash account and commission, pays out cash-out requests, sees platform-wide reports and commission |

---

## 2. Accounts and sign-in

### 2.1 Sign up with email
- Only Gmail addresses are accepted (`ALLOWED_EMAIL_DOMAINS`, default `gmail.com,googlemail.com`).
- After sign-up a **6-digit verification code** is emailed. The account cannot book or manage anything until the code is entered. Codes are stored hashed, expire after 15 minutes, and are rate-limited (10 checks / 15 min, 4 resends / 10 min).
- If no email arrives the address probably doesn't exist; an unverified account is released once its code expires so the address can be used again.
- A yellow bar at the top reminds unverified users to enter their code.

### 2.2 Continue with Google
- One click sign-in. A first Google sign-in creates a guest account for that Gmail address, already verified (Google vouches for it). An existing account with the same email signs in.
- Business owners register through the business form first, then may sign in with Google using the same email.
- Google consent screen is in *Testing* mode: only listed test users can use it until it is published.

### 2.3 Password login
- Email + password, with a **Show password** checkbox on every password field.
- Login, sign-up and bookings are rate-limited in production (off while developing; `RATE_LIMIT=on|off` overrides).
- A stale session (account deleted) falls back to the login form instead of looping.
- `/login` shows a **Demo accounts** list in development only (one-click sign-in).

### 2.4 Profile
- Name, mobile number, profile photo (resized in the browser), email-notification preference, change password.

---

## 3. Browsing and searching (public)

| Page | Function |
|---|---|
| `/` Home | Hero search, category grid with business counts, "Popular right now" options, how-it-works, call to action for businesses |
| `/services` Browse | All bookable options; category filter chips; search box |
| `/providers` Businesses | All approved businesses with rating and option count; category filter |
| `/providers/[id]` | A business's page: category, address, description, rating, bookable options, reviews |
| `/book/[serviceId]` | Booking flow for one option |

**Autocomplete** on every search box: as you type, suggestions appear (categories, booking options, businesses on public pages; guests and booking codes on business/admin lists; people on the admin users list). Arrow keys + Enter navigate; selecting a suggestion with a link opens it directly.

---

## 4. Booking options, resources and availability

### 4.1 Booking option (`Service`)
Each business creates options such as "Deluxe King Room", "Island Hopping Tour", "Table for 2".

| Field | Meaning |
|---|---|
| Booking type | **Timed** (a time slot, e.g. 60 min tour) or **Nightly** (a stay with check-in and check-out) |
| Pricing | Per booking, per person, or per night (nightly stays are always per night) |
| Price | Decimal, ₱; 0 means free |
| Duration | Minutes, timed options only |
| Max guests | Capacity per booking |
| Check-in / check-out time | Nightly options (defaults 14:00 / 12:00) |
| Resources | Which rooms/units/tables/spaces/staff can host this option |

### 4.2 Resources (`Resource`)
What actually gets booked: **Room, Rental unit, Table, Space, or Staff member** (a staff resource is tied to a user account). Each has:
- weekly opening hours (several ranges per day allowed, e.g. 09:00–12:00 and 13:00–18:00),
- the options it can be booked for,
- active/inactive flag.

### 4.3 Availability engine (`lib/slots.ts`, `lib/bookings.ts`)
- **Timed**: for each day, for each qualified resource, generate start times every `NEXT_PUBLIC_SLOT_INTERVAL_MIN` (30) minutes inside opening hours where the full duration fits, minus existing pending/confirmed bookings, minus the past, minus the lead time (`NEXT_PUBLIC_MIN_LEAD_MINUTES`, 60), up to `NEXT_PUBLIC_MAX_ADVANCE_DAYS` (60) ahead. Slots list which resources are free.
- **Nightly**: for each possible check-in date, which rooms/units are free for the whole stay of N nights (max 30). A stay starting on another stay's check-out day is allowed.
- API: `GET /api/availability?serviceId&from&to[&nights]` → `{type:"TIMED", slots[]}` or `{type:"NIGHTLY", stays[]}`.

### 4.4 Double-booking protection
1. Every booking, date change and reassignment runs inside a **SERIALIZABLE transaction** that re-checks availability; conflicts are retried and the loser is told the slot is gone.
2. A Postgres **exclusion constraint** (`Booking_no_overlap`) makes overlapping active bookings on one resource impossible at the database level.
3. A guest cannot hold two bookings at the same time.

---

## 5. Booking flow (guest)

1. **Pick** a date and time slot (timed) or a check-in date and number of nights (nightly), and the party size (≤ max guests).
2. **Confirm** screen shows when, length, guests, business, total. Total = price × nights (per night), × guests (per person), or flat.
3. **Payment** (unless the option is free):
   - choose **20% deposit** (`NEXT_PUBLIC_DEPOSIT_PERCENT`) or **pay in full**;
   - the **platform's GCash QR and number** are shown (set by the admin);
   - the guest sends the exact amount in GCash and enters the **GCash reference number**;
   - button: "I've paid ₱X, book it".
4. The booking is created as **Pending**, a free resource is auto-assigned, the price is computed on the server (never trusted from the browser), and the payment is recorded immediately as **Partially paid** (deposit) or **Fully paid**, with the commission fixed.
5. Guest and business (and assigned staff) are notified in-app and by email.

Signed-out visitors are sent to log in and return with their choice kept.

---

## 6. Managing bookings

### 6.1 Booking statuses
`PENDING → CONFIRMED → COMPLETED | NO_SHOW`, or `CANCELLED` from pending/confirmed.

| Action | Who | Rule |
|---|---|---|
| Confirm | Business, admin | Checks the GCash reference first; confirming notifies the guest |
| Complete / No-show | Business, staff, admin | After the booking has started |
| Cancel | Guest, business, admin | Guests only up to `NEXT_PUBLIC_CANCELLATION_CUTOFF_HOURS` (24) before; businesses any time |
| Change dates / reschedule | Guest (within cutoff), business, admin | Re-checks availability; nightly stays are re-priced by nights |
| Reassign | Business, admin | Move to another room/table/space/staff set up for the option |

### 6.2 Lists and filters
- Business and admin booking lists: **Upcoming / Past / All** switch (upcoming by default, soonest first), status filter, resource filter, date range, search with autocomplete (guest name, email, booking code).
- Business overview: today's check-ins and slots, **New requests** (newest pending bookings), waiting-for-confirmation count, collected this month, rating.
- Guest dashboard: upcoming / past / cancelled tabs.
- Staff: today's and upcoming bookings assigned to them.

### 6.3 Booking page
Shows check-in/check-out or time, length, guests, business, assigned resource, guest contact (not shown to guests), requests, review, and the **Payment card**: total, deposit due or paid upfront, status, GCash reference, and a note while the booking is pending ("Guest paid ₱X via GCash, ref …; check it before confirming").

---

## 7. Payments, commission and cash-outs

### 7.1 Platform GCash account (admin → Payment settings)
- GCash account name, number, QR image (uploaded; a demo QR is seeded), commission percent (default 5).
- Every guest payment goes to this account.

### 7.2 Payment record (`Payment`)
| Field | Meaning |
|---|---|
| plan | DEPOSIT or FULL |
| amountDue | What the guest owed upfront |
| amountPaid, status | Recorded at booking: PARTIAL (deposit) or PAID (full); admins can correct (UNPAID / PARTIAL / PAID / REFUNDED) |
| method, reference | GCash + reference entered by the guest |
| commissionPercent, commissionAmount | Fixed when the payment is recorded (e.g. 5% of ₱1,800 = ₱90) |

The remaining balance on a deposit booking is paid to the business on arrival, outside the platform.

### 7.3 Earnings (business)
- Cards: confirmed payments, platform commission, **available to cash out** (net minus earlier cash-outs), money from bookings still awaiting confirmation.
- Table of confirmed payments: date, booking, guest, deposit/full, paid, commission, to business. Search by guest, option or reference.
- **Cash out**: enter GCash name and number (remembered) and an amount up to the available balance; one request at a time. History shows Waiting / Sent (with reference) / Rejected (with reason).

### 7.4 Commission (admin)
- Cards: collected, platform commission, owed to businesses, cash-outs waiting.
- Cash-out requests: **Mark as sent** (enter the GCash reference) or **Reject** (reason); the business is notified.
- Confirmed payments table across all businesses, searchable.

---

## 8. Reviews
- One review per **completed** booking, 1–5 stars plus optional comment, from the guest's booking page.
- Business pages show the average and recent reviews; admins can hide or delete a review; hidden reviews don't count.

---

## 9. Notifications
In-app bell (unread count, mark all read, `/notifications` page) and email (if the user keeps email notifications on):

| Event | Who is notified |
|---|---|
| New booking (with reported payment and reference) | Business owner, assigned staff; guest gets "Booking received" |
| Confirmed, completed, cancelled, rescheduled, reassigned | Guest (and staff where relevant) |
| Payment recorded / corrected | Guest |
| New business registered | Admins |
| Cash-out requested / sent / rejected | Admins / business |
| Daily check-in reminders for tomorrow | Guests and assigned staff (Vercel Cron, `/api/cron/reminders`, 10:00 UTC) |

Email is sent through **Gmail SMTP** (`GMAIL_USER` + app password), or Resend, or printed to the dev console if neither is set. The verification email uses a natural subject and asks recipients to mark "Not spam".

---

## 10. Reports (business and admin)
- Date range and group by day / week / month.
- Revenue collected (by payment date), bookings by status (by start date), top booking options, utilisation per room/space/staff (completed, nights, hours, no-shows), cancellation and no-show rates, average rating.
- CSV export (`/api/reports/export`), with spreadsheet-formula characters defused.
- Admin can view the whole platform or one business.

---

## 11. Admin area
| Page | Function |
|---|---|
| Overview | Guests, listed businesses, awaiting approval, bookable resources, platform report |
| Providers | Approve / suspend businesses (unapproved listings are hidden from guests) |
| Users | Search (with autocomplete), filter by role, suspend / reactivate |
| Bookings | Every booking, filters and search |
| Reviews | Hide / delete |
| Commission | Totals and cash-out approvals |
| Payment settings | GCash name, number, QR image, commission percent |

---

## 12. API endpoints
| Method & path | Purpose |
|---|---|
| `GET /api/availability` | Free slots or stays for an option |
| `GET /api/bookings` | The guest's bookings |
| `POST /api/bookings` | Create a booking (+ GCash payment) |
| `GET /api/bookings/[id]` | One booking (guest, business, staff, admin) |
| `PATCH /api/bookings/[id]` | cancel / reschedule / status / assign |
| `PUT /api/bookings/[id]/payment` | Admin payment correction |
| `POST /api/bookings/[id]/review` | Leave a review |
| `GET/PATCH /api/notifications` | Bell contents, mark read |
| `GET /api/reports/export` | CSV |
| `GET /api/suggest?scope=catalog|bookings|users&q=` | Search suggestions |
| `GET /api/cron/reminders` | Daily reminders (needs `CRON_SECRET`) |
| `/api/auth/*` | Auth.js (Google sign-in callback) |

Every route checks the role **and** ownership against the database; input is validated with Zod.

---

## 13. Data model (Prisma / PostgreSQL)
`User` (role, verification, notification preference) · `Provider` (business, category, approval, payout GCash) · `Resource` (kind, hours, optional user) · `WorkSchedule` · `Service` (option) · `Booking` (times, guests, price, status, resource) · `Payment` (plan, due, paid, commission, reference) · `Payout` (cash-outs) · `Review` · `Notification` · `PlatformSettings` (GCash + commission) · `RateLimit`.

Times are stored in UTC and shown in `NEXT_PUBLIC_TIMEZONE` (Asia/Manila). Databases are created as UTF-8.

---

## 14. Settings (`.env`)
| Variable | Meaning |
|---|---|
| `DATABASE_URL`, `DIRECT_URL`, `TEST_DATABASE_URL` | Postgres connections |
| `AUTH_SECRET`, `AUTH_TRUST_HOST`, `APP_URL` | Auth.js and links in emails |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Continue with Google |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` (or `RESEND_API_KEY`), `EMAIL_FROM` | Outgoing email |
| `ALLOWED_EMAIL_DOMAINS` | Sign-up domains (empty = any) |
| `RATE_LIMIT` | `on` / `off` override |
| `CRON_SECRET` | Protects the reminders job |
| `NEXT_PUBLIC_APP_NAME`, `_TIMEZONE`, `_LOCALE`, `_CURRENCY` | Display |
| `NEXT_PUBLIC_SLOT_INTERVAL_MIN`, `_MIN_LEAD_MINUTES`, `_MAX_ADVANCE_DAYS`, `_CANCELLATION_CUTOFF_HOURS`, `_DEPOSIT_PERCENT` | Booking rules |

---

## 15. Demo data and accounts
`npm run db:seed` creates one business per category (Harbor View Hotel, Casa Verde Tagaytay, Island Hop Palawan, Lockdown Escape Rooms, The Glass Pavilion, Dizon's Kitchen) plus one awaiting approval, six weeks of bookings, payments with commission, reviews, and the platform GCash settings with a demo QR.

| Email | Role |
|---|---|
| admin@example.com | Admin |
| provider@example.com | Harbor View Hotel owner |
| rental@, tours@, escape@, venue@, restaurant@example.com | Other business owners |
| pending@example.com | Owner awaiting approval |
| employee@example.com | Hotel concierge (staff) |
| customer@example.com | Guest |

Password for all: `Password123!`

---

## 16. Tech stack
Next.js 16 (App Router, server actions, Turbopack) · React 19 · TypeScript · Tailwind CSS 4 + shadcn/ui · Prisma 7 + PostgreSQL (Neon in production, embedded Postgres locally) · Auth.js v5 (credentials + Google) · Zod · Nodemailer (Gmail) · Recharts · Vercel (hosting + cron). Tests: `npm test` (unit + database tests, including the 12-way concurrency test).
