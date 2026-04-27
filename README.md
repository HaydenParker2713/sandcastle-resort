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
- Admin dashboard: revenue charts, user management, ticket tracking
- Staff dashboard: reservation and ticket management
- Email notifications for bookings and password changes (Ethereal preview if SMTP not configured)

## Tech stack

| Layer    | Technology |
|----------|-----------|
| Runtime  | Node.js   |
| Framework| Express.js |
| Database | MySQL 8+  |
| Auth     | express-session + bcrypt |
| Email    | Nodemailer (Ethereal fallback) |
| Frontend | Vanilla HTML/CSS/JavaScript |

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

Leave `SMTP_*` blank to use Ethereal (free email previews logged to console).

### 3. Set up the database

```bash
# Create tables:
mysql -uroot -p < schema.sql

# Load demo accounts:
mysql -uroot -p sandcastle_resort < seed.sql
```

### 4. Start the server

```bash
npm run dev    # development — auto-restarts on changes
npm start      # production
```

Open [http://localhost:3000](http://localhost:3000)

## Demo accounts

After running `seed.sql`:

| Role  | Email                    | Password    |
|-------|--------------------------|-------------|
| Admin | admin@sandcastle.com     | Admin123!   |
| Staff | staff@sandcastle.com     | Admin123!   |

Register any email address to get a guest account.

## API endpoints

### Auth — `/api/auth`

| Method | Path               | Auth     | Description |
|--------|--------------------|----------|-------------|
| POST   | `/register`        | None     | Register new guest |
| POST   | `/login`           | None     | Login (rate-limited: 10/15 min) |
| POST   | `/logout`          | Session  | Logout |
| GET    | `/me`              | None     | Current session user |
| PATCH  | `/profile`         | Guest+   | Update name/email |
| POST   | `/change-password` | Guest+   | Change password |

### Units — `/api/units`

| Method | Path                | Auth     | Description |
|--------|---------------------|----------|-------------|
| GET    | `/`                 | None     | All units with type info |
| POST   | `/`                 | Admin    | Create unit |
| GET    | `/:id/availability` | None     | Booked date ranges for a unit |
| PATCH  | `/:id/status`       | Admin    | Update unit status |

### Reservations — `/api/reservations`

| Method | Path            | Auth         | Description |
|--------|-----------------|--------------|-------------|
| GET    | `/`             | Admin, Staff | All reservations |
| POST   | `/`             | Guest+       | Create reservation |
| GET    | `/mine`         | Guest+       | Current user's reservations |
| POST   | `/:id/cancel`   | Guest+       | Cancel reservation |

### Invoices — `/api/invoices`

| Method | Path       | Auth   | Description |
|--------|------------|--------|-------------|
| GET    | `/mine`    | Guest+ | Current user's invoices |
| GET    | `/`        | Admin  | All invoices |
| POST   | `/:id/pay` | Admin  | Mark invoice paid |

### Tickets — `/api/tickets`

| Method | Path     | Auth         | Description |
|--------|----------|--------------|-------------|
| POST   | `/`      | Guest+       | Submit ticket |
| GET    | `/`      | Guest+       | Own tickets (admin/staff see all) |
| PATCH  | `/:id`   | Admin, Staff | Update ticket status |

### Reviews — `/api/reviews`

| Method | Path          | Auth   | Description |
|--------|---------------|--------|-------------|
| POST   | `/`           | Guest+ | Submit review for a past reservation |
| GET    | `/mine`       | Guest+ | IDs of reviewed reservations |
| GET    | `/unit/:id`   | None   | Reviews for a unit |

### Admin — `/api/admin`

| Method | Path              | Auth  | Description |
|--------|-------------------|-------|-------------|
| GET    | `/users`          | Admin | All users |
| PATCH  | `/users/:id/role` | Admin | Change user role |
| GET    | `/stats`          | Admin | Revenue and booking stats |
| GET    | `/reviews`        | Admin | All reviews |

## Role system

| Role  | Can do |
|-------|--------|
| guest | Browse units, make reservations, view own invoices, submit tickets, leave reviews |
| staff | Everything guest can do + view all reservations and manage tickets |
| admin | Everything staff can do + manage users, units, invoices, view revenue stats |

## Project structure

```
sandcastle-resort/
├── config/
│   └── db.js               MySQL connection pool
├── middleware/
│   └── auth.js             requireAuth, requireRole
├── public/                 Static frontend
│   ├── api.js              Shared fetch utility
│   ├── home.js             Landing page logic
│   ├── app.js              Dashboard logic
│   ├── staff.js            Staff dashboard logic
│   ├── admin.js            Admin dashboard logic
│   ├── index.html
│   ├── dashboard.html
│   ├── staff.html
│   ├── admin.html
│   └── styles.css
├── routes/                 Express route handlers
│   ├── authRoutes.js
│   ├── unitRoutes.js
│   ├── reservationRoutes.js
│   ├── ticketRoutes.js
│   ├── invoiceRoutes.js
│   ├── reviewRoutes.js
│   └── adminRoutes.js
├── utils/
│   └── email.js            Nodemailer helpers
├── services.js             All DB service methods
├── server.js               App entry point
├── schema.sql              Table definitions
├── seed.sql                Demo accounts
└── .env.example            Environment variable template
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for branch naming, commit format, and PR workflow.