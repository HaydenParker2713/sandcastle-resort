# Sandcastle Resort — Project Documentation

**Author:** Hayden Parker  
**Project:** Sandcastle Resort Web Application  
**Date:** May 2026

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Project Design: Description of Project Components](#2-project-design-description-of-project-components)
3. [Major Issues / Problems and Solutions](#3-major-issues--problems-and-solutions)
4. [User Manual](#4-user-manual)
5. [Conclusion and Future Work](#5-conclusion-and-future-work)

---

## 1. Introduction

### 1.1 Project Overview

Sandcastle Resort is a full-stack web application that serves as the complete digital management platform for a fictional beach resort. The application replaces what would typically be a combination of phone reservations, paper invoices, and disconnected staff spreadsheets with a unified, browser-based system accessible to guests, staff, and administrators alike.

The system covers the full lifecycle of a guest stay: browsing available units, making reservations, receiving invoices, submitting housekeeping or maintenance requests, and leaving a review after checkout. Resort staff can post events, manage tickets, and update operational information. Administrators have full oversight: user management, revenue statistics, audit logs, and control over every piece of content on the platform.

### 1.2 Purpose and Motivation

Modern hospitality businesses depend on reliable software for revenue, guest satisfaction, and operational efficiency. This project was built to demonstrate how a real-world multi-role web application can be designed and implemented from the ground up — including authentication, database design, transactional business logic, security hardening, and a usable frontend — within the constraints of a capstone project.

Beyond feature completeness, a major goal of this project was production-readiness: the codebase is structured to reflect how professional Node.js applications are built, with separate route, service, and utility layers, environment-variable configuration, and defensive security practices throughout.

### 1.3 Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Runtime | Node.js 20 | Server-side JavaScript execution |
| Web Framework | Express 4 | HTTP routing and middleware |
| Database | MySQL 8 | Relational data storage |
| DB Driver | mysql2 | Async MySQL client with prepared statements |
| Authentication | express-session + bcrypt | Session cookies + password hashing |
| Security Headers | helmet | CSP, HSTS, X-Frame-Options, etc. |
| Rate Limiting | express-rate-limit | Brute-force and spam protection |
| File Uploads | multer | Image uploads for units and events |
| Email | nodemailer | Password reset emails |
| Logging | morgan | Per-request HTTP logs |
| Configuration | dotenv | Environment variable management |
| Frontend | Vanilla HTML/CSS/JS | No framework — direct DOM manipulation |

### 1.4 Scope

The application supports three user roles with distinct capabilities:

- **Guest** — registers an account, browses available units, books stays, manages their reservations, pays invoices, submits support tickets, and leaves reviews.
- **Staff** — all guest capabilities plus the ability to manage maintenance/housekeeping tickets and post resort events with images.
- **Admin** — all staff capabilities plus full administrative control: user management, unit and room-type management, revenue statistics, audit log access, and management of the bar menu and activities list.

---

## 2. Project Design: Description of Project Components

### 2.1 High-Level Architecture

The application follows a classic three-tier architecture:

```
Browser (HTML/CSS/JS)
        │  HTTP (REST JSON)
        ▼
Express Server (Node.js)
  ├── Middleware stack (helmet, CORS, session, morgan, rate limiters)
  ├── Route handlers  (11 route files — input validation, auth checks)
  └── Service layer   (11 service files — all database logic)
        │  mysql2 prepared statements
        ▼
MySQL 8 Database
  └── 9 tables (roles, users, unit_types, units, reservations,
                invoices, tickets, reviews, audit_log)
      + 3 dynamic tables (events, bar_items, activity_items)
```

All frontend pages are served as static files from the `public/` directory. API communication is exclusively JSON over HTTP, with no server-side rendering of HTML.

### 2.2 Directory Structure

```
sandcastle-resort/
├── server.js                  Entry point, middleware stack, route mounting
├── constants.js               Enum strings for all status values
├── package.json               Dependencies and npm scripts
├── .env.example               Environment variable template
├── schema.sql                 Full database schema and seed data
├── seed.sql                   Demo admin/staff account records
├── config/
│   └── db.js                  MySQL connection pool
├── middleware/
│   └── auth.js                requireAuth and requireRole guards
├── routes/  (11 files)        HTTP handlers — validation, auth, service calls
├── services/ (11 files)       All database access logic
├── utils/
│   ├── audit.js               Audit log writer
│   └── email.js               Email sender (nodemailer)
└── public/
    ├── *.html (7 files)       Static pages
    ├── api.js                 Shared frontend helpers
    └── *.js (9 files)         Page-specific frontend scripts
```

### 2.3 Database Schema

The relational schema was designed to enforce correctness at the database level, not just in application code. Key design decisions are described below.

#### Core Tables

**roles** — A lookup table with three fixed rows: `guest`, `staff`, `admin`. Users reference this table rather than storing role strings directly, which prevents typos and makes role changes a single-row update.

**users** — Stores account credentials and profile data. The `password_hash` column stores the bcrypt output only — plain-text passwords are never persisted. `reset_token` and `reset_token_expiry` support the forgot-password flow.

**unit_types** — Defines the 13 room categories offered by the resort (Studio, One Bedroom Suite, Oceanfront Suite with Balcony, etc.), each with a `nightly_rate`, `capacity`, and optional `description`, `amenities`, and `photo_url`.

**units** — Individual physical rooms. Each unit belongs to a `unit_type` and carries a `status` of `available`, `maintenance`, or `inactive`. A per-unit `nightly_rate` column can override the type-level rate for rooms that command a premium.

**reservations** — Links a user to a unit for a date range. A database-level `CHECK (check_out > check_in)` constraint prevents reversed dates regardless of what the application sends. Status is either `confirmed` or `cancelled`.

**invoices** — Each reservation automatically generates one invoice at booking time with a `total_amount` calculated as `nights × nightly_rate`. A `UNIQUE` constraint on `reservation_id` guarantees exactly one invoice per reservation. Status can be `unpaid`, `paid`, or `voided` (applied when a reservation is cancelled).

**tickets** — Maintenance and housekeeping requests tied to a unit and the user who opened them. Status progresses from `open` → `in_progress` → `closed`. The `closed_by` and `closed_at` columns record who resolved the ticket.

**reviews** — Post-stay feedback tied to a reservation, unit, and user. A `UNIQUE` constraint on `reservation_id` enforces one review per stay. A `CHECK (rating BETWEEN 1 AND 5)` constraint is enforced at the database level.

**audit_log** — An append-only log of significant actions (reservation created, invoice paid, role changed, etc.) with `actor_id`, `action`, `target_type`, `target_id`, and a JSON `detail` column for context.

#### Dynamic Tables

Three tables (`events`, `bar_items`, `activity_items`) were added after the initial schema was written. Rather than requiring a migration on every fresh install, the corresponding service modules call `CREATE TABLE IF NOT EXISTS` on startup, making the application self-provisioning.

### 2.4 Middleware Stack

Requests flow through the following middleware in order before reaching any route handler:

1. **`app.set('trust proxy', 1)`** — Tells Express to trust the `X-Forwarded-For` header from one upstream proxy so that rate limiters key on the real client IP, not the load balancer's.
2. **helmet** — Sets a strict Content Security Policy (restricting scripts to `'self'` and the Chart.js CDN), plus `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and other protective headers.
3. **cors** — Restricts cross-origin API access to the configured `ALLOWED_ORIGIN`.
4. **morgan** — Logs every request with method, path, status code, and response time.
5. **express.json / express.urlencoded** — Body parsers for JSON and form payloads.
6. **express-session** — Maintains server-side sessions with an `httpOnly`, `sameSite: lax` cookie. The `SESSION_SECRET` is required to be set at startup.

### 2.5 Authentication and Authorization

Authentication is session-based. On login, `services/auth.js` retrieves the user record, compares the submitted password against the stored bcrypt hash, and — on success — writes `req.session.user` with the user's `user_id`, `role_name`, and display name.

Two middleware guards in `middleware/auth.js` protect routes:

- **`requireAuth`** — Returns 401 if `req.session.user` is absent.
- **`requireRole(...roles)`** — Returns 403 if the session user's role is not in the allowed list.

Route files compose these guards as needed. For example, admin routes apply `requireRole('admin')` while staff endpoints apply `requireRole('staff', 'admin')`.

### 2.6 Route and Service Layer

Each feature area is split across two files: a route file that handles HTTP concerns (input parsing, validation, guard middleware, response formatting) and a service file that contains all database queries. This separation means route files never build SQL strings and service files never touch `req` or `res`.

The ten service modules are re-exported through `services/index.js` so route files import from a single location.

### 2.7 Reservation Booking Flow

The booking flow is the most complex transaction in the system and was designed to be safe under concurrent load:

1. The route validates the request (dates are valid, check-in is in the future, guest count is within capacity).
2. `reservationService.createReservation` opens a database transaction and immediately issues `SELECT ... FOR UPDATE` on the target unit row, acquiring a row-level lock.
3. While holding the lock, it checks for any existing confirmed reservations that overlap the requested date range.
4. If clear, it inserts the reservation and immediately inserts a corresponding invoice with `total_amount = nights × nightly_rate`.
5. On success the transaction commits; on any error it rolls back.

The `FOR UPDATE` lock prevents two simultaneous booking requests for the same unit from both passing the overlap check before either has inserted its reservation row.

### 2.8 File Upload Handling

Unit photos, event images, and room-type photos are handled by multer. Each upload endpoint applies two layers of validation before accepting a file:

- **MIME type check** — Only `image/jpeg`, `image/png`, and `image/webp` are accepted.
- **Extension check** — The original filename extension must match an allowed list.

Files are stored in `public/uploads/` under a subdirectory per resource type and served as static assets.

### 2.9 Frontend Architecture

The frontend is plain HTML with JavaScript loaded via regular `<script src>` tags. Shared utilities (authenticated `fetch` wrapper, `escapeHTML` for XSS prevention, status badge helpers) live in `public/api.js` and are included on every page before the page-specific script.

Each HTML page has a corresponding JS file: `app.js` for the guest dashboard, `admin.js` for the admin panel, `staff.js` for the staff panel, and so on. All API calls go through the shared `apiFetch` helper which sets `credentials: 'same-origin'` and handles 401 redirects centrally.

Dark mode is implemented via a small `theme-init.js` IIFE that reads `localStorage` and applies a class to `<html>` before the first paint, preventing a flash of the wrong theme.

---

## 3. Major Issues / Problems and Solutions

### 3.1 Double-Booking Race Condition

**Problem:** When two guests simultaneously attempt to book the same unit for overlapping dates, both requests could pass the availability check before either had committed its reservation INSERT. This would result in two confirmed reservations for the same room on the same night.

**Solution:** The booking flow was redesigned to use a MySQL transaction with a `SELECT ... FOR UPDATE` lock on the unit row. This serializes concurrent booking attempts: the second request blocks until the first transaction commits, at which point the overlap check will find the first reservation and reject the second. A `CHECK (check_out > check_in)` database constraint was also added to prevent invalid date ranges regardless of application logic.

### 3.2 Duplicate Review Race Condition

**Problem:** A similar concurrency issue existed for reviews. Two simultaneous review submissions for the same reservation could both pass the soft duplicate check (a `SELECT` before the `INSERT`) and both succeed, resulting in two reviews for a single stay.

**Solution:** A two-layer approach was used. The route still performs a soft check via `reviewService.getReviewByReservation` to give a clean error message in the normal case. Additionally, a database-level `UNIQUE` constraint on `reviews.reservation_id` ensures the second concurrent INSERT is rejected with `ER_DUP_ENTRY`. The route handler catches this error code explicitly and returns the same 409 response as the soft check, so the client sees a consistent error regardless of which layer caught the duplicate.

### 3.3 Service Layer Monolith

**Problem:** The original codebase had a single `services.js` file at the project root containing 870 lines of mixed database logic for all features. As the project grew this became difficult to navigate, and changes to one feature required editing a file that touched every other feature.

**Solution:** The services was split into eleven focused service files under a `services/` directory, each responsible for exactly one feature area (`auth.js`, `reservation.js`, `invoice.js`, `ticket.js`, `review.js`, `unit.js`, `stats.js`, `event.js`, `bar.js`, `activityList.js`). A `services/index.js` barrel re-exports all services so existing import paths required only a single change. The original `services.js` file at the root was removed.

### 3.4 Session Secret Enforcement

**Problem:** If the application starts without a `SESSION_SECRET` environment variable (or with the placeholder value `change_me` from the example file), all sessions are signed with a predictable secret. An attacker who knows the secret can forge session cookies and impersonate any user.

**Solution:** The server entry point (`server.js`) now checks for the secret immediately on startup, before any middleware or route is registered. If the variable is missing or still set to the placeholder, the process logs a fatal error and exits with a non-zero code. This makes misconfiguration fail loudly during deployment rather than silently in production.

### 3.5 Password Reset Token Not Validated

**Problem:** The `validateResetToken` function was defined in `services/auth.js` but was never called from any route. The password reset flow would accept any token string, valid or expired, because the validation step was simply missing from the route handler.

**Solution:** The reset password route was updated to call `authService.validateResetToken(token)` before allowing the password change. The function verifies the token exists in the database, has not expired, and matches the provided email address. After a successful reset the token is cleared from the database to prevent reuse.

### 3.6 Missing Input Validation on Event Dates

**Problem:** The event creation and update endpoints in `eventRoutes.js` accepted `event_date` values without validating that the string was a real date or that the date was not in the past. This allowed malformed date strings to reach the database, which could cause silent insertion errors or unexpected query behavior.

**Solution:** Server-side validation was added to both the POST and PATCH handlers in `eventRoutes.js`. The submitted `event_date` is parsed with `new Date()` and checked for `isNaN`. Events with past dates are rejected with a descriptive 400 error so staff cannot accidentally create events that immediately appear as historical.

### 3.7 Missing Guest Ticket Ownership Check

**Problem:** The guest-facing ticket detail endpoint retrieved a ticket by ID without verifying that the requesting user created it. Any authenticated user could view (or interact with) any other user's maintenance or housekeeping ticket simply by guessing the ticket ID.

**Solution:** Ownership verification was added to the affected route handler. When a guest user requests a ticket, the query includes `AND created_by = ?` with the session user's ID. If no row is returned the route returns 404 — the same response given for a ticket that does not exist — so the endpoint does not reveal whether the ticket ID belongs to a different user.

### 3.8 Content Security Policy Blocking Dashboard Scripts

**Problem:** After helmet was added to the middleware stack, the admin and guest dashboards stopped functioning. The browser's developer console showed CSP violations because the frontend scripts used inline event handlers and `<script>` blocks without nonces, which are blocked by the default `'self'`-only script source policy.

**Solution:** The frontend scripts were refactored to remove all inline event handlers, moving them into the external JS files loaded from `public/`. The CSP was configured to allow `https://cdn.jsdelivr.net` (needed for Chart.js) while keeping the strict `'self'`-only rule for all other script sources. The `'unsafe-inline'` exception was restricted to `styleSrc` only, which was needed for the dynamic dark mode theming.

### 3.9 Misleading 404 Responses from affectedRows Checks

**Problem:** Several route handlers checked `result.affectedRows === 0` after an UPDATE and returned a 404 response. In cases where the row existed but the update was a no-op (i.e., the new value was the same as the existing value), `affectedRows` is 0 even though the record was found. This caused the ticket status update endpoint to return 404 when staff tried to set a ticket to its current status.

**Solution:** The affected routes were updated to first verify the record exists with a SELECT, then perform the UPDATE. The 404 is returned only when the SELECT finds no row. The UPDATE's `affectedRows` is no longer used as a proxy for existence.

---

## 4. User Manual

### 4.1 Getting Started

#### Prerequisites

- Node.js 18 or higher
- MySQL 8.0 or higher
- A terminal (Command Prompt, PowerShell, or Bash)

#### Installation

1. Clone or extract the project files.
2. Copy `.env.example` to `.env` and fill in the required values:
   - `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` — MySQL connection details.
   - `SESSION_SECRET` — A long random string (e.g., 64 random hex characters). The server will refuse to start without this.
   - `PORT` — Optional. Defaults to `3000`.
3. Create and seed the database:
   ```
   npm run db:reset
   npm run db:seed
   ```
4. Install dependencies:
   ```
   npm install
   ```
5. Start the server:
   ```
   npm start
   ```
   Or in development mode (auto-restart on file changes):
   ```
   npm run dev
   ```
6. Open `http://localhost:3000` in a browser.

#### Default Accounts

After running `db:seed`, the following demo accounts are available:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@sandcastle.com | Admin123! |
| Staff | staff@sandcastle.com | Admin123! |

### 4.2 Guest Features

#### Registering an Account

1. Click **Register** on the home page.
2. Enter your first name, last name, email address, and a password.
3. Passwords must be at least 8 characters.
4. On success you will be logged in automatically and taken to the dashboard.

#### Browsing and Booking a Unit

1. From the home page, the room gallery shows available unit types with nightly rates and photos.
2. Log in and open the **Dashboard**.
3. Click the **Make a Reservation** tab.
4. Select a unit type, enter your check-in and check-out dates, and specify the number of guests.
5. Available units matching your criteria will be displayed. Select one and confirm the booking.
6. A reservation confirmation and a matching invoice are created immediately.

#### Managing Reservations

- The **My Reservations** tab lists all your confirmed and cancelled stays.
- To cancel a reservation, click **Cancel** next to the booking. Cancelling voids any unpaid invoice automatically.

#### Viewing Invoices

- Open the **Invoices** tab to see all your invoices and their current status (unpaid, paid, or voided).
- Invoice payment is processed by resort staff or an administrator.

#### Submitting a Maintenance or Housekeeping Ticket

1. Open the **Support Tickets** tab on the dashboard.
2. Click **New Ticket**.
3. Select the ticket type (maintenance or housekeeping), the affected unit, a short title, and an optional description.
4. Submit the form. Staff will update the ticket status as work progresses.

#### Leaving a Review

1. Open the **My Reservations** tab.
2. Reservations that are confirmed and have a past checkout date will show a **Leave Review** button.
3. Click it, select a star rating (1–5), add an optional comment (up to 1000 characters), and submit.
4. Each reservation can only be reviewed once.

#### Updating Your Profile

- Open the **My Profile** tab to update your name or email address.
- Use the **Change Password** section to update your password. You will need to enter your current password to confirm.

#### Forgot Password

1. Click **Forgot Password** on the login page.
2. Enter your registered email address.
3. If the address is found, a reset link is sent to that email. The link expires after one hour.
4. Click the link in the email, enter and confirm your new password.

### 4.3 Staff Features

Staff have access to everything guests can do, plus the following:

#### Managing Tickets

1. Navigate to `/staff` after logging in.
2. The **Tickets** tab shows all open and in-progress tickets across all units.
3. Click a ticket to update its status from `Open` to `In Progress` or `Closed`.

#### Managing Events

1. Open the **Events** tab in the staff panel.
2. Click **Add Event** to create a new event with a title, description, date, and optional image.
3. Existing events can be edited or deleted.
4. Events appear on the public Activities page visible to all visitors.

### 4.4 Admin Features

Admins have access to all staff features plus the following administrative panels, all accessible from `/admin`.

#### User Management

- The **Users** tab lists every registered account.
- Click on a user to view their details or change their role between `guest`, `staff`, and `admin`.

#### Unit Management

- The **Units** tab lists all physical rooms.
- Admins can add new units, edit unit details (description, status, per-unit rate override), upload a photo, or mark a unit as under maintenance or inactive.
- Units under maintenance or inactive cannot be booked.

#### Room Type Management

- The **Room Types** tab lists the 13 unit categories.
- Admins can update the base nightly rate, capacity, description, amenities text, and photo for each type.

#### Reservations and Invoices

- The **Reservations** tab shows all reservations across all guests, with associated invoice status.
- The **Invoices** tab allows admins to mark any invoice as paid.

#### Reviews

- The **Reviews** tab shows all guest reviews with guest name, unit, rating, and comment.

#### Statistics

- The **Stats** tab shows total revenue (sum of paid invoices), average nightly rate, total confirmed nights booked, and average review rating.
- A bar chart displays monthly revenue for the current year using Chart.js.

#### Audit Log

- The **Audit Log** tab shows a chronological list of significant system actions: who did what, to which record, and when.

#### Bar Menu and Activities

- Admins can manage the resort bar and dining menu under **Bar & Dining**.
- The public-facing **Activities** list is managed under **Activity Items**.

---

## 5. Conclusion and Future Work

### 5.1 Summary

Sandcastle Resort is a complete, multi-role web application that covers the full operational cycle of a resort — from guest registration and room booking through to invoice payment, staff ticket management, and administrative reporting. The project demonstrates production-quality engineering practices: transactional database operations with race-condition protection, layered security via session management and HTTP security headers, role-based access control enforced at both the route and database levels, and a clean separation between HTTP handling and data access logic.

The application was built and iteratively hardened over the course of the project, with a dedicated code review phase that identified and resolved issues ranging from concurrency bugs to input validation gaps. The codebase is in a state that could serve as the foundation for a production deployment with only infrastructure additions (a persistent session store and a production MySQL host).

### 5.2 Known Limitations

- **In-memory session store** — `express-session` defaults to an in-memory store when no external store is configured. This means all active sessions are lost when the server restarts and cannot be shared across multiple server instances. For production, this should be replaced with a Redis-backed session store using `connect-redis`.

- **No automated test suite** — The project relies on manual testing. A future iteration should add unit tests for service-layer functions and integration tests for route handlers using a test database.

- **No HTTPS in development** — TLS termination is expected to be handled by a reverse proxy (nginx, AWS ALB) in production. The session cookie's `secure: true` flag is already conditional on `NODE_ENV === 'production'`, so this is production-ready but not tested locally with HTTPS.

- **Single-server file storage** — Uploaded images are stored on the local filesystem under `public/uploads/`. In a multi-server or containerized deployment, uploads would be lost on restart. Production deployments should use object storage (AWS S3, Cloudflare R2) with signed URLs or a CDN.

### 5.3 Future Work

#### Payment Processing Integration

Currently invoices are marked as paid manually by an admin or by the guest clicking a pay button with no real payment gateway behind it. Integrating Stripe or a similar payment processor would allow guests to pay with a credit card and have the invoice status updated automatically via webhook.

#### Real-Time Ticket Updates

Maintenance and housekeeping staff currently have to refresh the ticket list to see new requests. Adding WebSocket support (via the `ws` package or Socket.io) would push ticket updates to connected staff clients in real time, reducing response latency on urgent requests.

#### Email Notifications

The nodemailer integration is currently used only for password resets. It could be extended to send booking confirmation emails, invoice receipts, and ticket status change notifications to guests and staff.

#### Online Check-In

A pre-arrival workflow where guests confirm their arrival time, submit ID details, and receive a digital room key (or door code) would reduce front-desk workload and improve the guest experience.

#### Dynamic Pricing

The current pricing model is a fixed nightly rate per unit type with an optional per-unit override. A demand-based pricing engine that adjusts rates based on occupancy, seasonality, and lead time would increase revenue and is a common feature in modern property management systems.

#### Mobile Application

The existing REST API is fully capable of serving a native mobile application. A React Native or Flutter frontend consuming the same `/api/*` endpoints would extend the platform to mobile guests without requiring backend changes.

#### Persistent Session Store

Replacing the default MemoryStore with Redis via `connect-redis` would allow the application to scale horizontally across multiple server instances and would survive server restarts without logging out all active users. This is the single highest-priority infrastructure improvement before a production launch.

---

*End of Documentation*