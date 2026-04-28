# Sandcastle Resort — Full-Stack Web Application
## Project Documentation

**Course:** CAIS 339  
**Student:** Hayden Parker  
**Date:** May 4, 2025  
**GitHub Repository:** https://github.com/HaydenParker2713/sandcastle-resort

---

## Table of Contents

1. Introduction
2. Project Design: Description of Project Components
3. Major Issues / Problems and Solutions
4. User Manual
5. Conclusion and Future Work

---

# 1. Introduction

## 1.1 Project Overview

Sandcastle Resort is a full-stack web application designed to serve as a complete property management and guest-facing booking system for a fictional beach resort. The system allows guests to browse available accommodations, make reservations, track invoices, submit maintenance or housekeeping support tickets, leave reviews, and view resort events and amenities — all from a single, cohesive web interface.

The project addresses a real-world problem: many small resorts rely on paper-based processes or disconnected spreadsheet systems that are slow, error-prone, and offer a poor guest experience. Sandcastle Resort replaces that with a modern, browser-based solution requiring no software installation — any device with a web browser can use it.

## 1.2 Motivation

The motivation for this project was to build something that mirrors actual industry software in scope and technical depth. Rather than a simple CRUD demo, this application implements:

- Session-based authentication with role separation (guest, staff, admin)
- A transactional reservation engine that prevents double-bookings at the database level
- An interactive availability calendar built from scratch
- File upload handling for event images
- Automated booking confirmation emails
- A live revenue analytics chart for administration
- A full dark mode with user-selectable avatar preferences

The goal was to demonstrate end-to-end software engineering: database design, RESTful API design, secure server-side logic, and a functional frontend — all written without relying on a JavaScript framework like React or Vue.

## 1.3 Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js v20 |
| Web framework | Express.js v4 |
| Database | MySQL 8 (via mysql2/promise) |
| Authentication | express-session + bcrypt |
| File uploads | multer (disk storage) |
| Email | nodemailer (SMTP / Ethereal fallback) |
| Security headers | helmet |
| Rate limiting | express-rate-limit |
| HTTP logging | morgan |
| Frontend | Vanilla HTML5, CSS3, JavaScript (no framework) |
| Charts | Chart.js (CDN) |

## 1.4 Scope

The application covers three user roles:

- **Guest** — public browsing, registration, login, reservation, invoice view, ticket submission, review submission
- **Staff** — all guest capabilities plus managing tickets and posting/deleting resort events
- **Admin** — all staff capabilities plus user role management, unit status management, bar menu management, activities management, and revenue analytics

---

# 2. Project Design: Description of Project Components

## 2.1 System Architecture

The application follows a classic **three-tier architecture**:

```
┌─────────────────────────────────────────────────┐
│              CLIENT (Browser)                   │
│   HTML pages + CSS + Vanilla JavaScript         │
│   Communicates via fetch() / apiFetch()         │
└────────────────────┬────────────────────────────┘
                     │ HTTP (JSON)
┌────────────────────▼────────────────────────────┐
│          APPLICATION SERVER (Node.js)           │
│   Express.js — middleware, routing, sessions    │
│   Services layer — all database logic           │
│   Route handlers — input validation, auth       │
└────────────────────┬────────────────────────────┘
                     │ mysql2/promise (pooled)
┌────────────────────▼────────────────────────────┐
│              DATABASE (MySQL 8)                 │
│   10 normalised tables, FK constraints,         │
│   composite indexes, CHECK constraints          │
└─────────────────────────────────────────────────┘
```

The frontend is served as static files from Express. All data is exchanged as JSON over the same origin, so there are no CORS complications in production.

## 2.2 Database Design

The database (`sandcastle_resort`) contains the following tables:

### Core Tables

| Table | Purpose |
|---|---|
| `roles` | Three roles: guest (1), staff (2), admin (3) |
| `users` | All registered users; stores bcrypt password hash and optional reset token |
| `unit_types` | Room type definitions (name, capacity, nightly rate) |
| `units` | Physical units (room codes like A101) linked to a type; tracks status |
| `reservations` | Booking records with check-in/check-out dates, guest count, status |
| `invoices` | One invoice per reservation, auto-created on booking, tracked as paid/unpaid |
| `tickets` | Maintenance and housekeeping requests submitted by guests |
| `reviews` | One review per completed stay; 1–5 star rating plus optional comment |

### Dynamic Tables (created at boot via `ensureTable()`)

| Table | Purpose |
|---|---|
| `events` | Resort events posted by staff — title, date, location, image path |
| `bar_items` | Bar and dining menu managed by admin — category, name, price |
| `resort_activities` | Activities list managed by admin — name, icon, tags |

### Key Design Decisions

**Foreign keys and referential integrity** are enforced at the database level. For example, a reservation cannot exist without a valid user and unit, and an invoice cannot exist without a reservation.

**Double-booking prevention** is handled by a database-level composite index:
```sql
INDEX idx_res_availability (unit_id, status, check_in, check_out)
```
And an atomic overlap check inside a transaction before any INSERT:
```sql
SELECT reservation_id FROM reservations
WHERE unit_id = ? AND status = 'confirmed'
AND check_in < ? AND check_out > ?
```
If a row is returned, the transaction is rolled back and a `DOUBLE_BOOKING` error is thrown.

**Password reset tokens** are stored on the user row as a UUID with a one-hour expiry, then cleared after use so they cannot be reused.

**CHECK constraint** on the reservations table ensures check_out is always after check_in at the DB level:
```sql
CONSTRAINT chk_dates CHECK (check_out > check_in)
```

## 2.3 Backend: Express Application

### 2.3.1 Entry Point (server.js)

`server.js` is the application entry point. It:

1. Validates that `SESSION_SECRET` is set in the environment (refuses to start if not)
2. Applies security middleware in order: helmet (security headers), CORS, morgan (logging), body parsers, express-session
3. Mounts all API route files under `/api/...`
4. Serves HTML pages at specific URL paths with server-side role checks
5. Runs `ensureTable()` on the three dynamic tables before accepting connections

### 2.3.2 Middleware (middleware/auth.js)

Two middleware functions protect all authenticated routes:

- **`requireAuth`** — checks that `req.session.user` exists; returns 401 if not
- **`requireRole(...roles)`** — first calls `requireAuth`, then verifies the session user's role is in the allowed list; returns 403 if not

These are composable: `requireRole('admin', 'staff')` produces a two-middleware array that Express handles automatically.

### 2.3.3 Services Layer (services.js)

All database access is centralised in `services.js`, organised as service objects:

- `authService` — register, login, password management, profile updates, reset tokens
- `unitService` — list all units, update unit status
- `reservationService` — create (with transaction), list by user, list all, cancel
- `invoiceService` — list by user, list all, mark paid
- `ticketService` — create, list by user, list all, update status
- `reviewService` — create, check for duplicates, list by unit, list all
- `statsService` — aggregate revenue and rating stats for the admin dashboard
- `barService` — CRUD for bar menu items
- `activityListService` — CRUD for resort activities
- `eventService` — CRUD for resort events, returns image path on delete

Every query uses **parameterised placeholders** (`?`) — user input is never interpolated into SQL strings, which prevents SQL injection.

### 2.3.4 API Routes

| Prefix | File | Key operations |
|---|---|---|
| `/api/auth` | authRoutes.js | Login, register, logout, profile, change password, forgot/reset password |
| `/api/units` | unitRoutes.js | List units, availability calendar for a unit, update status |
| `/api/reservations` | reservationRoutes.js | Create, list mine, list all (admin/staff), cancel |
| `/api/invoices` | invoiceRoutes.js | List mine, list all (admin), mark paid |
| `/api/tickets` | ticketRoutes.js | Create, list (role-filtered), update status |
| `/api/reviews` | reviewRoutes.js | Submit, list by unit, list reviewed reservation IDs |
| `/api/events` | eventRoutes.js | List (public), create with image upload (staff/admin), delete |
| `/api/bar` | barRoutes.js | List (public), create (admin), delete (admin) |
| `/api/activity-items` | activityListRoutes.js | List (public), create (admin), delete (admin) |
| `/api/admin` | adminRoutes.js | User list, role update, all reviews, all invoices, revenue stats |

### 2.3.5 Security Implementation

**Content Security Policy (CSP)** via helmet restricts which resources the browser will load:
- Scripts: self + `cdn.jsdelivr.net` (for Chart.js)
- Images: self + data URIs + blob URLs
- All other sources: self only

**Session cookies** are configured with:
- `httpOnly: true` — JavaScript cannot read the cookie (blocks XSS cookie theft)
- `secure: true` in production — HTTPS only
- `sameSite: 'lax'` — mitigates most CSRF attacks
- `maxAge: 7200000` — 2-hour session lifetime

**Rate limiting** protects write and sensitive endpoints:
- Login: 10 attempts / 15 minutes per IP
- Forgot password: 5 requests / hour per IP
- Reservations: 20 / hour per IP
- Tickets: 30 / hour per IP
- Reviews: 10 / hour per IP
- Events: 20 / hour per IP

**Input length validation** on all text fields prevents oversized payloads from reaching the database.

**XSS prevention** is handled by the `escapeHTML()` function in `public/api.js`, applied to all user-supplied strings before they are inserted into `innerHTML`.

**Path traversal protection** on event image deletion: the stored path must start with `/uploads/events/` and must not contain `..` before the file is deleted from disk.

## 2.4 Frontend Design

The frontend is plain HTML, CSS, and JavaScript — no framework. Each page loads `api.js` (shared utilities) and a page-specific JS file.

### 2.4.1 Pages

| URL | File | Access |
|---|---|---|
| `/` | index.html + home.js | Public (redirects logged-in users) |
| `/dashboard` | dashboard.html + app.js | Any logged-in user |
| `/staff` | staff.html + staff.js | Staff and admin |
| `/admin` | admin.html + admin.js | Admin only |
| `/activities` | activities.html | Public |
| `/forgot-password` | forgot-password.html | Public |
| `/reset-password` | reset-password.html | Public |

### 2.4.2 Guest Dashboard (dashboard.html / app.js)

The guest dashboard is a tabbed single-page experience with the following panels:

- **Browse & Book** — unit gallery cards with gradients matched to room type; clicking a card opens an interactive availability calendar. The calendar fetches existing bookings and colours each day: green (available), red (booked), grey (past). Guests click two dates to select a range and the system validates that no booked days fall within the selection before enabling the Confirm button.

- **My Bookings** — lists confirmed reservations as cards. Past stays show a "Leave Review" button; upcoming stays show a Cancel button.

- **My Invoices** — shows all invoices linked to the guest's reservations with paid/unpaid badge.

- **Support Tickets** — a form to submit maintenance or housekeeping requests; lists the guest's tickets with live status polling every 15 seconds.

- **Account** — edit profile name/email, change password, choose emoji avatar, select light/dark theme.

### 2.4.3 Dark Mode

Dark mode uses CSS custom properties scoped to `[data-theme="dark"]`. An inline `<script>` in `<head>` on every page reads `localStorage` and applies the attribute before the page renders, preventing a flash of the wrong colour scheme.

### 2.4.4 Avatar System

Guests choose from 12 beach-themed emoji avatars (🏄 🌊 🏖️ 🐚 ⛵ 🌴 🦀 🐬 🌺 🤿 🏝️ 🦈). The selection is stored in `localStorage` and displayed in the dashboard header. No backend storage is required.

### 2.4.5 Staff Panel (staff.html / staff.js)

Staff can view all reservations and tickets in sortable tables, update ticket status via inline dropdowns, and post/delete resort events. The events tab is lazy-loaded — it initialises only when the staff member first clicks the tab, saving an unnecessary API call on pages where events are not needed.

Event posting uses `multipart/form-data` via the browser's native `FormData` API so images can be submitted alongside text fields in a single request.

### 2.4.6 Admin Panel (admin.html / admin.js)

The admin panel extends the staff panel with:

- **Revenue Analytics** — a Chart.js bar chart showing monthly revenue for the past 6 months, total revenue, and average guest rating
- **User Management** — full user list with an inline role dropdown (admin accounts are protected)
- **Unit Management** — unit list with inline status selector
- **Bar & Dining** — add/delete menu items organised by category
- **Resort Activities** — add/delete activity entries with icon and tags
- **Reviews** — read-only view of all guest reviews

The admin panel polls reservations and tickets every 10 seconds to keep data fresh.

## 2.5 Email System

The system sends three types of transactional emails using nodemailer (`utils/email.js`):

1. **Booking confirmation** — sent after a reservation is created; includes unit, dates, nights, and total amount.
2. **Password changed notice** — a security alert sent whenever a user changes their password via the Account panel.
3. **Password reset** — sent when a user requests a reset link via the Forgot Password page; contains a one-time token link valid for 1 hour.

All three emails use a shared `getTransporter()` function. If `SMTP_HOST`, `SMTP_USER`, and `SMTP_PASS` are set in the environment, the system uses that SMTP server. Otherwise it falls back to Ethereal (a fake SMTP capture service used in development) and logs a preview URL to the console so emails can be inspected without actually sending them. All emails are sent asynchronously after the HTTP response so users never wait on email delivery.

## 2.6 File Upload System

Event images are uploaded using multer. The configuration:
- Stores files to `public/uploads/events/` with timestamp-based filenames
- Enforces a 5 MB file size limit
- Validates both the file extension AND the MIME type to prevent disguised file uploads
- Accepted formats: JPG, PNG, GIF, WebP
- Deleted images are removed from disk when their event is deleted

Uploaded images are excluded from Git via `.gitignore`; only a `.gitkeep` file is committed to preserve the directory structure.

---

# 3. Major Issues / Problems and Solutions

## 3.1 Double-Booking Race Condition

**Problem:** Early versions of the reservation system checked availability with a SELECT query and then inserted the reservation in two separate operations. Under concurrent load, two requests could both pass the SELECT check and both INSERT — resulting in two confirmed reservations for the same unit on the same dates.

**Solution:** The availability check and INSERT were wrapped in a single MySQL transaction using a dedicated connection from the pool. The overlap check uses a precise date-range condition:
```sql
WHERE unit_id = ? AND status = 'confirmed'
AND check_in < ? AND check_out > ?
```
This correctly identifies any booking that overlaps the requested range, even partial overlaps. The `check_out > check_in` direction ensures the checkout day itself is always available for the next guest. A composite index `(unit_id, status, check_in, check_out)` was added to make this query fast even as the reservations table grows.

## 3.2 Foreign Key Type Mismatch on Events Table

**Problem:** When creating the `events` table with `ensureTable()`, the `created_by` column was defined as `INT`. This caused a silent constraint failure because `users.user_id` is defined as `BIGINT UNSIGNED`. MySQL rejected the foreign key constraint, and the server crashed on startup.

**Solution:** The column definition was corrected to `BIGINT UNSIGNED` to match the referenced column type exactly. A careful review of the schema confirmed all other foreign key pairs were already type-consistent.

## 3.3 "Cannot GET /activities" — White Page

**Problem:** After adding the activities page and registering the route in server.js, navigating to `/activities` returned a blank white page with "Cannot GET /activities" in the browser. The HTML file existed and the route code was written correctly.

**Solution:** The issue was that the server process was still running from before the code change. Node.js does not hot-reload — the route registration only takes effect when the server restarts. Killing the old process and restarting the server resolved the issue immediately. This reinforced the importance of always restarting the server after route changes.

## 3.4 Staff Event POST Returning HTML Instead of JSON

**Problem:** When staff submitted the event creation form, the browser received an HTML "Cannot POST /api/events" response instead of JSON. The frontend's `JSON.parse()` failed with: `Unexpected token '<', '<!DOCTYPE '... is not valid JSON`.

**Solution:** There were two root causes:
1. The server process was running without the `/api/events` route because it hadn't been restarted after the route file was added.
2. multer was throwing errors (e.g., invalid file type) that propagated as Express's default HTML error page rather than JSON.

Both were fixed: the server was restarted, and a multer-specific error handler middleware was added to `eventRoutes.js` to intercept multer errors and return structured JSON responses instead.

## 3.5 PNG Images Failing Upload Validation

**Problem:** After implementing file type checking, JPG images uploaded successfully but PNG files were rejected even though the `fileFilter` logic appeared to allow them.

**Solution:** The original `fileFilter` used an ambiguous conditional pattern where `cb(ok ? null : new Error(...), ok)` was evaluated. The variable `ok` was boolean `true` or `false`, but multer's callback signature expects `cb(error, acceptFile)`. When `ok` was `false` (rejected), the callback was invoked as `cb(new Error(...), false)` but the error was not always propagated correctly. The fix was to separate the two paths explicitly:
```javascript
if (extOk && mimeOk) {
  cb(null, true);
} else {
  cb(new Error('Only image files (JPG, PNG, GIF, WebP) are allowed.'));
}
```
Additionally, the MIME type check was expanded to explicitly include `image/png` alongside `image/jpeg`, `image/gif`, and `image/webp`.

## 3.6 Duplicate Activities Appearing on the Public Page

**Problem:** The Activities page showed two "Game Room" entries — one from the database seed and one from leftover hardcoded HTML that was not removed when the page was converted from static content to API-driven content.

**Solution:** The orphaned hardcoded `<div>` elements were located and removed from `activities.html`. All content on the page is now rendered exclusively by JavaScript using data from the API, ensuring there is a single source of truth.

## 3.7 Text Invisible in Dark Mode (Admin Panel)

**Problem:** After implementing dark mode, the bar menu and activity list in the admin panel had invisible text. The item names and descriptions were hardcoded with inline `color:#111827` (very dark grey) directly in JavaScript template literals. Against the dark mode background (`#0f172a`), this was invisible.

**Solution:** The inline colour styles were removed from the template strings and replaced with CSS classes (`list-item-name`, `list-item-desc`, `list-tag-*`). Each class has proper default colours for light mode and overrides under `[data-theme="dark"]` in the stylesheet. This approach makes all future theme changes a CSS-only change.

## 3.8 Role Dropdown Unreadable

**Problem:** In the admin user management table, the role dropdown appeared to have no text — the dropdown was there but empty-looking.

**Solution:** The `.inline` CSS class applied to the `<select>` element had no explicit `color` property, so it inherited a colour from a parent rule that happened to be nearly white. Adding `color: #111827; font-weight: 600;` to `.inline` made the dropdown text visible. This was a reminder that form elements do not always inherit text colour predictably across browsers.

## 3.9 XSS Vulnerability in innerHTML Rendering

**Problem:** During the security code review, it was identified that user-supplied data (guest names, ticket titles, review comments, event titles, activity tags, and bar menu names) was being inserted directly into `innerHTML` template strings without escaping. A malicious user could register with a name like `<img src=x onerror=alert(1)>` and cause script execution in every admin/staff browser that loaded the user list.

**Solution:** An `escapeHTML()` function was added to `public/api.js`:
```javascript
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
```
This function was then applied to every user-sourced value in `innerHTML` template strings across `admin.js`, `activities.html`, and `staff.js`. The `badge()` helper was also updated to escape both its `text` and `cls` arguments.

---

# 4. User Manual

## 4.1 System Requirements

- A modern web browser (Chrome, Firefox, Edge, Safari)
- No software installation required on the guest device
- An internet connection (or local network connection to the server)

## 4.2 Accessing the Application

Navigate to the resort's web address in your browser. The home page displays a gallery of available room types and their nightly rates.

---

## 4.3 Guest — Getting Started

### 4.3.1 Creating an Account

1. On the home page, click **Sign In** in the top-right navigation bar.
2. In the pop-up dialog, click the **Register** tab.
3. Fill in your first name, last name, email address, and a password (minimum 8 characters).
4. Click **Create Account**. You will be redirected to your personal dashboard automatically.

### 4.3.2 Signing In

1. Click **Sign In** on the home page.
2. Enter your email and password, then click **Sign In** (or press Enter).
3. You will be redirected to your dashboard. Admins go to the Admin panel; staff go to the Staff panel.

### 4.3.3 Forgot Password

1. On the Sign In dialog, click **Forgot password?**
2. Enter your email address and submit.
3. Check your email for a reset link (valid for 1 hour).
4. Click the link, enter your new password, and confirm it.

---

## 4.4 Guest Dashboard

After signing in, you land on your personal dashboard. The dashboard has five tabs across the top.

### 4.4.1 Browse & Book

This tab shows two ways to make a reservation:

**Visual Calendar Method (recommended):**
1. Scroll down to the unit gallery. Each card shows the unit code, room type, nightly rate, and availability status.
2. Click on any green (available) unit card. A detail banner appears showing the rate.
3. Below the banner, an availability calendar loads for the current month. Days are colour-coded:
   - **Green** — available and selectable
   - **Red** — already booked by another guest
   - **Grey** — past dates (not bookable)
4. Click a green start date (your first night). The date is highlighted and a summary bar appears.
5. Click a green end date (your last night). The system validates that all days between start and end are available.
6. The summary bar shows your date range, number of nights, and estimated total cost.
7. Click **Confirm Reservation** to complete the booking. You will receive a confirmation email and be automatically switched to the My Bookings tab.

**Quick Book Method:**
1. Use the "Quick Book" form at the top of the Browse & Book tab.
2. Select a unit from the dropdown, enter check-in and check-out dates, and click **Book Now**.

**Calendar Navigation:**
- Use the **← Prev** and **→ Next** buttons to move between months.
- Use the **Year Filter** dropdown to jump to a specific year.
- Click **Clear Filters** to return to the current month.

### 4.4.2 My Bookings

This tab lists all your confirmed reservations as cards. Each card shows:
- Unit and room type
- Check-in and check-out dates and number of nights
- Number of guests and nightly rate
- Total cost

**To cancel a booking:** Click the red **Cancel** button on an upcoming reservation. Cancellation is immediate.

**To leave a review:** For past stays, a **⭐ Review** button appears. Click it to open the review dialog, select a star rating (1–5), optionally write a comment, and click **Submit Review**. You can only submit one review per stay.

### 4.4.3 My Invoices

All invoices linked to your reservations appear here, showing the unit, stay dates, total amount, and whether the invoice is **Paid** or **Unpaid**. Invoices are created automatically when you book and are marked paid by front-desk staff.

### 4.4.4 Support Tickets

Use this tab to report a problem in your unit or to request housekeeping.

1. Select the unit from the dropdown.
2. Choose the ticket type: **Maintenance** (something broken) or **Housekeeping** (cleaning request).
3. Enter a short title (required, max 150 characters) and an optional description.
4. Click **Submit Ticket**.

Your submitted tickets appear in a live list below the form. The status updates automatically every 15 seconds — you do not need to refresh the page to see when staff changes your ticket from Open to In Progress or Closed.

### 4.4.5 Account Settings

- **Edit Profile:** Update your first name, last name, or email address.
- **Change Password:** Enter your current password and a new password (minimum 8 characters) to update it.
- **Avatar & Theme:**
  - Click any of the 12 beach emoji icons to set your dashboard avatar (displayed in the top-left).
  - Click **Light** or **Dark** to switch the colour theme. Your choice is remembered across all pages and future visits.

---

## 4.5 Activities Page

The Activities page is public — no login required. Access it from the home page navigation or from your dashboard.

It contains three tabs:

- **🎉 Upcoming Events** — Resort events posted by staff. Each event card shows the title, date, time, location, and ticket information. Some events include a photo posted by staff.
- **🍹 Bar & Dining** — The full bar and restaurant menu, organised by category (e.g., Cocktails, Beer & Wine, Food) with prices.
- **🤿 Activities** — A list of all resort activities with icons, descriptions, and tags indicating whether the activity is free, included with your stay, or has an additional cost.

---

## 4.6 Staff Panel

Staff members are redirected to the Staff panel after login. The panel contains three tabs:

### 4.6.1 Reservations Tab
A table of all guest reservations, searchable by any column. Displays reservation ID, guest name and email, unit, check-in/check-out dates, status, and total amount.

### 4.6.2 Tickets Tab
All submitted support tickets from all guests. Staff can update each ticket's status using the inline dropdown:
- **Open** — newly submitted, not yet started
- **In Progress** — being handled
- **Closed** — resolved

Changes save immediately when the dropdown selection changes.

### 4.6.3 Events Tab
Staff can post new resort events and view or delete existing ones.

**To post an event:**
1. Click the **Events** tab.
2. Fill in the event title (required), description, date, time, location, and ticket information.
3. Click one of the emoji buttons to choose a banner emoji (used when no image is uploaded).
4. Optionally, click **Choose Image** to upload a photo (JPG, PNG, GIF, or WebP; max 5 MB). A preview appears before posting.
5. Click **Post Event**.

**To delete an event:** Click the red **Delete** button next to an event in the list and confirm.

---

## 4.7 Admin Panel

Admins access the Admin panel automatically after login. It extends the staff panel with additional tabs.

### 4.7.1 Reservations Tab
Same as the staff view, with the addition of **Mark Paid** buttons on unpaid invoices.

### 4.7.2 Units Tab
All accommodation units with their type, capacity, nightly rate, and current status. Use the inline dropdown on each row to change a unit's status:
- **Available** — bookable by guests
- **Maintenance** — removed from the booking system; shows as unavailable
- **Inactive** — hidden from the active unit list

### 4.7.3 Tickets Tab
Same as the staff view.

### 4.7.4 Users Tab
All registered user accounts with their role. Non-admin accounts have a role dropdown to change the user between Guest and Staff. Admin accounts show "Protected" and cannot be changed from this interface.

**Search:** Use the search box above the table to filter by name, email, or role in real time.

### 4.7.5 Reviews Tab
A read-only list of all guest reviews, showing star rating, guest name, unit code, comment, and date.

### 4.7.6 Revenue Tab
A monthly bar chart (powered by Chart.js) showing revenue for the past 6 months. The tab header also displays total all-time revenue from paid invoices and the average star rating across all reviews.

### 4.7.7 Bar & Dining Tab
Add or remove items from the resort bar and dining menu.

**To add a menu item:**
1. Enter the category (e.g., "Cocktails"), name, optional description, and optional price.
2. Click **Add Item**.

The menu is displayed on the public Activities page grouped by category.

### 4.7.8 Activities Tab
Add or remove entries from the resort activities list.

**To add an activity:**
1. Optionally enter an emoji icon.
2. Enter the activity name (required), description, and tags (comma-separated, e.g., "Free, Outdoors, Equipment Provided").
3. Click **Add Activity**.

Activities appear on the public Activities page.

---

# 5. Conclusion and Future Work

## 5.1 Summary of Achievements

The Sandcastle Resort application successfully delivers a complete, production-ready property management system for a small resort property. The following goals were achieved:

- **Full authentication system** with registration, login, logout, profile editing, password change, and email-based password reset
- **Transactional reservation engine** that prevents double-bookings at the database level using row-locking transactions
- **Interactive availability calendar** built from scratch without any calendar library, with month navigation, year filtering, and consecutive-range validation
- **Three-role access control** (guest, staff, admin) enforced at both the server route level and the client UI level
- **File upload system** for event images with validation, storage, and cleanup on deletion
- **Email confirmation system** with Gmail SMTP integration and a development fallback
- **Revenue analytics** with a live Chart.js bar chart and summary statistics
- **Public-facing activities page** with events, bar menu, and activities tabs, all driven by the API
- **Full dark mode** with no flash on load, persisted to localStorage across all pages
- **Comprehensive security hardening** including CSP headers, rate limiting, XSS escaping, CSRF mitigation, and path traversal protection

## 5.2 Challenges Overcome

The most technically challenging aspects of the project were:

1. **The transactional reservation system** — designing the overlap query and wrapping it correctly in a transaction required careful reasoning about SQL date ranges and MySQL connection pool behaviour.
2. **The interactive calendar** — building a month-grid renderer, availability colour-coding, and consecutive-range selection from scratch in vanilla JavaScript required significant design work.
3. **Security hardening** — performing a systematic code review and implementing escapeHTML, rate limiting, CSP, and path traversal checks across the entire codebase required understanding multiple categories of web vulnerability simultaneously.
4. **File upload validation** — understanding why checking only extension or only MIME type is insufficient, and implementing both checks correctly.

## 5.3 Future Work

If this project were to be continued or deployed commercially, the following enhancements would be priorities:

### 5.3.1 Payments Integration
Currently invoices are created and marked paid manually by front-desk staff. A real deployment would integrate with Stripe or Square to accept online credit card payments at booking time, with webhooks to update invoice status automatically.

### 5.3.2 Unit Photo Gallery
The unit cards currently use CSS gradient banners. Adding actual room photographs — stored on a CDN like AWS S3 — would significantly improve the guest browsing experience.

### 5.3.3 Email Notifications for Tickets
When a staff member changes a ticket status, the submitting guest should receive an email notification. The email infrastructure already exists; this would require hooking into the ticket update route.

### 5.3.4 Check-out Date Validation on the Calendar
The calendar currently lets guests select any end date. A future improvement would show available checkout dates more clearly and enforce minimum stay requirements (e.g., 2-night minimum on weekends).

### 5.3.5 Admin Seeding Interface
Currently, the default bar menu and activity list are seeded via a SQL script. An admin interface to import a CSV of menu items or activities would make initial setup easier for non-technical resort managers.

### 5.3.6 Session Persistence
The current in-memory session store is lost when the server restarts. A production deployment would use `connect-redis` or `express-mysql-session` to persist sessions to a store that survives restarts and supports horizontal scaling.

### 5.3.7 Unit Test Suite
The application has no automated tests. A test suite using Jest (for services) and Supertest (for route integration tests) would allow confident refactoring and catch regressions during future development.

### 5.3.8 Mobile App
A React Native or Flutter mobile application with push notification support for booking confirmations and ticket status updates would greatly improve the guest experience for returning visitors.

## 5.4 Lessons Learned

This project reinforced several important software engineering principles:

- **Security must be designed in from the start.** Retrofitting rate limiting, CSP, and XSS escaping across a partially built application is much harder than building with these constraints from the beginning.
- **Database transactions are essential for financial operations.** A reservation system without atomic transactions is fundamentally broken regardless of how good the rest of the code is.
- **Server restarts are mandatory after route changes in Node.js.** Many hours of debugging were wasted before this became second nature.
- **Separate concerns.** Keeping all database logic in `services.js` made it easy to find, read, and secure queries — and would make it straightforward to add a test suite in the future.
- **CSS classes beat inline styles for theming.** Every time inline colours were used in JavaScript template strings, dark mode broke. The pattern of using CSS classes with `[data-theme="dark"]` overrides was consistently more maintainable.

---

*End of Documentation*

---

**Appendix A: Environment Variables**

| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes | Strong random string for signing session cookies |
| `DB_HOST` | Yes | MySQL host (default: localhost) |
| `DB_PORT` | No | MySQL port (default: 3306) |
| `DB_USER` | Yes | MySQL username |
| `DB_PASSWORD` | Yes | MySQL password |
| `DB_NAME` | Yes | Database name (sandcastle_resort) |
| `SMTP_HOST` | No | SMTP server hostname (e.g. smtp.gmail.com) |
| `SMTP_PORT` | No | SMTP port (default: 587) |
| `SMTP_USER` | No | SMTP login username |
| `SMTP_PASS` | No | SMTP login password |
| `SMTP_FROM` | No | Display name and address for outgoing email |
| `APP_URL` | No | Base URL used to build password reset links (e.g. https://yourdomain.com) |
| `PORT` | No | Server port (default: 3000) |
| `NODE_ENV` | No | Set to `production` for secure cookies and silent logging |
| `ALLOWED_ORIGIN` | No | CORS allowed origin in production |

**Appendix B: API Endpoint Summary**

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | Public | Create new guest account |
| POST | /api/auth/login | Public | Log in, create session |
| POST | /api/auth/logout | Any | Destroy session |
| GET | /api/auth/me | Any | Get current session user |
| PATCH | /api/auth/profile | Auth | Update name/email |
| POST | /api/auth/change-password | Auth | Change password |
| POST | /api/auth/forgot-password | Public | Send reset email |
| POST | /api/auth/reset-password | Public | Reset password by token |
| GET | /api/units | Public | List all units |
| GET | /api/units/:id/availability | Public | Get bookings for a unit |
| PATCH | /api/units/:id/status | Admin | Change unit status |
| GET | /api/reservations | Staff/Admin | All reservations |
| POST | /api/reservations | Auth | Create reservation |
| GET | /api/reservations/mine | Auth | My reservations |
| POST | /api/reservations/:id/cancel | Auth | Cancel reservation |
| GET | /api/invoices/mine | Auth | My invoices |
| GET | /api/invoices | Admin | All invoices |
| POST | /api/invoices/:id/pay | Admin | Mark invoice paid |
| GET | /api/tickets | Auth | Tickets (role-filtered) |
| POST | /api/tickets | Auth | Submit ticket |
| PATCH | /api/tickets/:id | Staff/Admin | Update ticket status |
| POST | /api/reviews | Auth | Submit review |
| GET | /api/reviews/mine | Auth | My reviewed reservation IDs |
| GET | /api/reviews/unit/:id | Public | Reviews for a unit |
| GET | /api/events | Public | All events |
| POST | /api/events | Staff/Admin | Create event (with image) |
| DELETE | /api/events/:id | Staff/Admin | Delete event |
| GET | /api/bar | Public | Bar menu items |
| POST | /api/bar | Admin | Add menu item |
| DELETE | /api/bar/:id | Admin | Delete menu item |
| GET | /api/activity-items | Public | Activity list |
| POST | /api/activity-items | Admin | Add activity |
| DELETE | /api/activity-items/:id | Admin | Delete activity |
| GET | /api/admin/users | Admin | All users |
| PATCH | /api/admin/users/:id/role | Admin | Change user role |
| GET | /api/admin/stats | Admin | Revenue and rating stats |
| GET | /api/admin/reviews | Admin | All reviews |
| GET | /api/health | Public | Server health check |
