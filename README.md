# Sandcastle Resort

A full-stack resort booking web application built with Node.js, Express, MySQL, and vanilla JavaScript.

## Features

- User registration and login (session-based auth)
- Role system: **guest**, **staff**, **admin**
- Browse resort units by type with availability calendar
- Create and cancel reservations (double-booking prevented via DB transaction)
- Automatic invoice generation on booking
- Maintenance and housekeeping ticket submission
- Guest reviews with star ratings
- Password reset via email link
- Admin dashboard: revenue charts, user management, unit/room-type config, audit log
- Staff dashboard: reservation, ticket, and event management
- Public activities page: resort events, bar & dining menu, activities list
- Dark mode (preference saved in localStorage, applied before first render)

## Tech stack

| Layer     | Technology                        |
|-----------|-----------------------------------|
| Runtime   | Node.js                           |
| Framework | Express.js                        |
| Database  | MySQL 8+                          |
| Auth      | express-session + bcrypt          |
| Security  | Helmet (CSP, security headers)    |
| Email     | Nodemailer (Ethereal fallback)    |
| Frontend  | Vanilla HTML / CSS / JavaScript   |

## Quick start

### 1. Clone and install

```bash
git clone <repo-url>
cd sandcastle-resort
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your database credentials. `SESSION_SECRET` **must** be changed to a long random string — the server will refuse to start otherwise.

Leave `SMTP_*` blank to use Ethereal (free email previews logged to the console).

### 3. Set up the database

**Fresh setup (new database):**

```bash
# Create all tables (includes all migrations):
mysql -uroot -p < schema.sql

# Load demo accounts:
mysql -uroot -p sandcastle_resort < seed.sql
```

**Upgrading an existing database:**

If you have a database created from an older version of `schema.sql`, run the migration files in this order:

```bash
mysql -uroot -p sandcastle_resort < migrate_forgot_password.sql
mysql -uroot -p sandcastle_resort < migrate_availability_index.sql
mysql -uroot -p sandcastle_resort < migrate_indexes.sql
mysql -uroot -p sandcastle_resort < migrate_audit_log.sql
mysql -uroot -p sandcastle_resort < migrate_ticket_closure.sql
mysql -uroot -p sandcastle_resort < migrate_unit_types_details.sql
```

> Do **not** run migrations on a fresh database — `schema.sql` already includes all of these changes and running them again will cause duplicate column errors.

### 4. Start the server

```bash
npm run dev    # development — auto-restarts on changes
npm start      # production
```

Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

After running `seed.sql`:

| Role  | Email                | Password  |
|-------|----------------------|-----------|
| Admin | admin@sandcastle.com | Admin123! |
| Staff | staff@sandcastle.com | Admin123! |

Register any email address to get a guest account.

## Pages and access

| Path                | Who can access             |
|---------------------|----------------------------|
| `/`                 | Public — home/landing page, room browsing |
| `/activities`       | Public — events, bar & dining, resort activities |
| `/forgot-password`  | Public — request a password reset email |
| `/reset-password`   | Public — set a new password via token link |
| `/dashboard`        | Guests (must be logged in) — reservations, tickets, reviews |
| `/staff`            | Staff + Admin — ticket and event management |
| `/admin`            | Admin only — full control panel |

## Role system

| Role  | Capabilities |
|-------|-------------|
| guest | Browse units, make reservations, view own invoices, submit tickets, leave reviews |
| staff | Everything guest can do + view all reservations, update ticket status, post/delete events |
| admin | Full access: all of the above + manage users, units, room types, invoices, bar menu, activities, audit log. Admins cannot be demoted via the UI. |

## API endpoints

### Auth — `/api/auth`

| Method | Path                | Auth    | Description |
|--------|---------------------|---------|-------------|
| POST   | `/register`         | None    | Register new guest |
| POST   | `/login`            | None    | Login (rate-limited: 10/15 min) |
| POST   | `/logout`           | Session | Logout |
| GET    | `/me`               | None    | Current session user |
| PATCH  | `/profile`          | Guest+  | Update name/email |
| POST   | `/change-password`  | Guest+  | Change password |
| POST   | `/forgot-password`  | None    | Send password reset email |
| POST   | `/reset-password`   | None    | Set new password via token |

### Units — `/api/units`

| Method | Path                | Auth  | Description |
|--------|---------------------|-------|-------------|
| GET    | `/`                 | None  | All units with type info |
| POST   | `/`                 | Admin | Create unit |
| GET    | `/:id/availability` | None  | Booked date ranges for a unit |
| PATCH  | `/:id/status`       | Admin | Update unit status |
| PATCH  | `/:id/details`      | Admin | Update unit description and nightly rate |
| PATCH  | `/:id/photo`        | Admin | Upload unit photo |
| DELETE | `/:id`              | Admin | Delete unit |

### Reservations — `/api/reservations`

| Method | Path          | Auth         | Description |
|--------|---------------|--------------|-------------|
| GET    | `/`           | Admin, Staff | All reservations |
| POST   | `/`           | Guest+       | Create reservation |
| GET    | `/mine`       | Guest+       | Current user's reservations |
| POST   | `/:id/cancel` | Guest+       | Cancel reservation |

### Invoices — `/api/invoices`

| Method | Path       | Auth   | Description |
|--------|------------|--------|-------------|
| GET    | `/mine`    | Guest+ | Current user's invoices |
| GET    | `/`        | Admin  | All invoices |
| POST   | `/:id/pay` | Admin  | Mark invoice paid |

### Tickets — `/api/tickets`

| Method | Path   | Auth         | Description |
|--------|--------|--------------|-------------|
| POST   | `/`    | Guest+       | Submit ticket |
| GET    | `/`    | Guest+       | Own tickets (admin/staff see all) |
| PATCH  | `/:id` | Admin, Staff | Update ticket status |

### Reviews — `/api/reviews`

| Method | Path        | Auth   | Description |
|--------|-------------|--------|-------------|
| POST   | `/`         | Guest+ | Submit review for a past reservation |
| GET    | `/mine`     | Guest+ | IDs of reviewed reservations |
| GET    | `/unit/:id` | None   | Reviews for a unit |

### Admin — `/api/admin`

| Method | Path              | Auth  | Description |
|--------|-------------------|-------|-------------|
| GET    | `/users`          | Admin | All users |
| PATCH  | `/users/:id/role` | Admin | Change user role |
| GET    | `/stats`          | Admin | Revenue and booking stats |
| GET    | `/reviews`        | Admin | All reviews |
| GET    | `/audit-log`      | Admin | Admin action history (last 200) |

## Security

| Mechanism             | Details |
|-----------------------|---------|
| Content Security Policy | Helmet blocks inline scripts; external resources restricted to known origins |
| Session cookies       | `httpOnly`, `sameSite=lax`, `secure=true` in production, 2-hour expiry |
| SQL injection         | All queries use parameterized inputs via mysql2 |
| Password storage      | bcrypt hashed; plain text never stored |
| Role enforcement      | `requireAuth` and `requireRole` middleware on every protected route — frontend gating is cosmetic only |
| Rate limiting         | Login: 10 attempts / 15 min per IP. Ticket creation: 30 / hour per IP |
| XSS prevention        | `escapeHTML()` applied to all user-supplied text before DOM insertion |

## Project structure

```
sandcastle-resort/
├── config/
│   └── db.js                   MySQL connection pool
├── middleware/
│   └── auth.js                 requireAuth, requireRole
├── public/                     Static frontend
│   ├── index.html              Home/landing page
│   ├── dashboard.html          Guest dashboard
│   ├── staff.html              Staff panel
│   ├── admin.html              Admin panel
│   ├── activities.html         Public events/bar/activities page
│   ├── forgot-password.html
│   ├── reset-password.html
│   ├── api.js                  Shared fetch utility + escapeHTML, formatDate
│   ├── home.js                 Landing page room browsing and booking
│   ├── app.js                  Guest dashboard logic
│   ├── staff.js                Staff panel logic
│   ├── admin.js                Admin panel logic (~1000 lines)
│   ├── activities.js           Activities page logic
│   ├── forgot-password.js
│   ├── reset-password.js
│   ├── theme-init.js           Applies stored theme before first render
│   └── styles.css              Main stylesheet with dark mode support
├── routes/                     Express route handlers
│   ├── authRoutes.js
│   ├── unitRoutes.js
│   ├── reservationRoutes.js
│   ├── ticketRoutes.js
│   ├── invoiceRoutes.js
│   ├── reviewRoutes.js
│   ├── eventRoutes.js
│   ├── barRoutes.js
│   ├── activityListRoutes.js
│   ├── adminRoutes.js
│   └── unitTypeRoutes.js
├── utils/
│   ├── audit.js                logAction() — admin action logging
│   └── email.js                Nodemailer helpers
├── services.js                 All DB service methods
├── server.js                   App entry point
├── schema.sql                  Table definitions (includes all migrations)
├── seed.sql                    Demo accounts
├── migrate_*.sql               Incremental schema changes (for upgrading)
├── run-migration.js            Migration runner script
└── .env.example                Environment variable template
```
