# Sandcastle Resort — Final Project Oral Presentation
## Slide Deck & Speaker Notes
**Hayden Parker · CAIS 339 · April 28 / 30, 2025**
**Total time: ~10 minutes**

---

## HOW TO USE THIS FILE
Each section below is one slide. The **SLIDE** block is what goes on the screen.
The **SPEAKER NOTES** block is what you say out loud. Estimated times are listed.

---

## SLIDE 1 — Title (0:00 – 0:30)

```
╔══════════════════════════════════════════════════╗
║                                                  ║
║   🏖️  Sandcastle Resort                         ║
║   Full-Stack Property Management System          ║
║                                                  ║
║   Hayden Parker                                  ║
║   CAIS 339 — Final Project                       ║
║   April 2025                                     ║
║                                                  ║
╚══════════════════════════════════════════════════╝
```

**SPEAKER NOTES:**
> "Hey everyone. My project is called Sandcastle Resort — it's a full-stack
> web application that acts as both a guest-facing booking system and a
> backend property management tool for a fictional beach resort.
> I'll give you a quick technical walkthrough and then do a live demo."

---

## SLIDE 2 — The Problem (0:30 – 1:15)

```
The Problem
───────────
Small resorts still rely on:
  • Phone calls and paper reservation logs
  • Disconnected spreadsheets for billing
  • No real-time ticket tracking for staff
  • Zero analytics on revenue or occupancy

Goal: Replace that with a single, browser-based
system — no app install required.
```

**SPEAKER NOTES:**
> "The motivation was practical. A lot of small hospitality businesses
> still rely on paper logs or spreadsheets that don't talk to each other.
> A front desk worker has a notepad. A maintenance person has a walkie talkie.
> The owner has no idea what revenue looks like month over month.
>
> My goal was to replace that whole workflow with one web application
> that any staff member or guest can use from any browser — desktop or mobile."

---

## SLIDE 3 — Tech Stack (1:15 – 2:00)

```
Tech Stack
──────────
  Backend     Node.js + Express.js
  Database    MySQL 8  (mysql2/promise connection pool)
  Auth        express-session + bcrypt
  Uploads     multer  (disk storage)
  Email       nodemailer  (SMTP / Ethereal fallback)
  Security    helmet · express-rate-limit
  Frontend    Vanilla HTML · CSS · JavaScript
  Charts      Chart.js  (CDN)

No React. No ORM. No magic.
```

**SPEAKER NOTES:**
> "The stack is pretty classic. Node and Express on the backend, MySQL
> for the database, and vanilla JavaScript on the frontend — no React,
> no Vue, no ORM. I wanted to own every layer of the stack, which meant
> writing raw SQL with parameterised queries and building the frontend
> UI from scratch.
>
> The decision to skip a framework was intentional — it forces you to
> understand what frameworks are actually doing for you."

---

## SLIDE 4 — System Architecture (2:00 – 3:00)

```
System Architecture
───────────────────

  Browser  ──── HTTP/JSON ────▶  Express App
                                     │
                    ┌────────────────┤
                    │                │
               Route files      Services layer
               (validation,     (all SQL lives
                auth checks)     here — no DB
                    │             logic in routes)
                    └────────────────┤
                                     ▼
                                  MySQL 8
                             (10 normalised tables,
                              FK constraints,
                              transactions)
```

**SPEAKER NOTES:**
> "Architecturally it's a three-tier app. The browser talks to Express
> over HTTP with JSON bodies. Express routes handle input validation and
> auth enforcement — but no SQL. All database logic lives in a separate
> services layer in services.js.
>
> That separation matters. If I want to add a test suite later, I can
> test services in isolation. If I want to swap MySQL for Postgres, I
> only touch one file.
>
> Pages are served as static HTML files — the server does a session check
> before sending /admin or /staff, so guests can't access those even if
> they know the URL."

---

## SLIDE 5 — Database Design (3:00 – 4:00)

```
Database — 11 Tables
─────────────────────
  roles          unit_types      bar_items
  users          units           resort_activities
  reservations   events
  invoices
  tickets
  reviews

Key decisions:
  ✓ Overlap check + INSERT in one transaction
       → prevents double-bookings at DB level
  ✓ Composite index (unit_id, status, check_in, check_out)
       → availability query stays fast as data grows
  ✓ CHECK constraint: check_out > check_in
  ✓ bcrypt hash stored — never plaintext
  ✓ Reset token + expiry on users row (UUID, 1 hr TTL)
```

**SPEAKER NOTES:**
> "11 tables total. The most interesting design decision was the reservation
> system. The naive approach is: SELECT to check availability, then INSERT.
> But that's a race condition — two requests can both pass the SELECT and
> both INSERT, giving you a double-booking.
>
> The fix is wrapping both operations in a single MySQL transaction on a
> dedicated connection from the pool. If the overlap SELECT returns any rows,
> we rollback and throw a DOUBLE_BOOKING error code that the route handler
> maps to a 409 response.
>
> I also added a composite index across unit_id, status, check_in, and
> check_out specifically for that availability query — without it the
> query would do a full table scan as reservations grow."

---

## SLIDE 6 — LIVE DEMO (4:00 – 7:30)

```
  LIVE DEMO

  1. Guest flow
     → Register account
     → Browse room gallery
     → Click unit → availability calendar loads
     → Select date range → Confirm reservation
     → View booking + invoice
     → Submit a support ticket

  2. Staff panel
     → View all reservations and tickets
     → Update ticket status
     → Post a new event with image upload

  3. Admin panel
     → Revenue chart (Chart.js)
     → Mark invoice paid
     → Change a user's role
     → Add a bar menu item
```

**SPEAKER NOTES:**
> "Let me switch over to the browser and walk through it live."

> **[Guest flow — ~1.5 min]**
> "I'll register a new account. After registering, the session is created
> server-side immediately so I land directly on the dashboard.
>
> This is the Browse & Book tab. Each card represents a physical unit —
> the gradient and emoji are matched to the room type in code.
> I'll click this oceanfront suite. The calendar loads from the API —
> green days are available, red are booked by another guest.
>
> I'll click a start date... and an end date. The system validates that
> every day in the range is available — no gaps allowed. Here's the
> estimated total. I'll confirm."

> **[Show My Bookings tab]**
> "The booking shows up immediately. There's a Cancel button for future
> stays and a Review button for past stays. The invoice tab shows the
> auto-generated unpaid invoice."

> **[Submit a ticket]**
> "I can submit a housekeeping ticket. Status updates live — it polls
> every 15 seconds so if staff change it, the guest sees it automatically."

> **[Staff panel — ~1 min]**
> "Logging in as staff. Same session-based auth — the server checks
> role_name before serving the HTML file at all, so you can't navigate
> here as a guest even if you know the URL.
>
> I can update ticket status right inline. And I can post a new event —
> this uses FormData instead of JSON so the image file can travel in
> the same request as the text fields. multer handles it server-side
> with both MIME type and extension validation."

> **[Admin panel — ~1 min]**
> "Admin panel. The revenue chart pulls 6 months of data from a single
> aggregate SQL query. I can mark invoices paid, change user roles —
> admin accounts are protected and show 'Protected' instead of the
> dropdown. I can manage the bar menu and activities list from here,
> which feed directly to the public Activities page."

---

## SLIDE 7 — Security Decisions (7:30 – 9:00)

```
Security — What Actually Matters
──────────────────────────────────
  SQL injection     Parameterised queries (?), no string interpolation
  XSS               escapeHTML() applied to every innerHTML insertion
  Session theft     httpOnly cookie, SameSite=lax, 2 hr expiry
  CSRF              SameSite=lax blocks cross-origin form submissions
  Brute force       Rate limits on login, forgot-password, and writes
  File uploads      MIME type AND extension both validated by multer
  Path traversal    Image delete checks path starts with /uploads/events/
  Clickjacking      helmet X-Frame-Options header
  CSP               Explicit allowlist — only self + Chart.js CDN
```

**SPEAKER NOTES:**
> "I want to spend a minute on security because it's where a lot of
> web apps fail silently.
>
> SQL injection is the easy one — every query uses a ? placeholder.
> mysql2 handles escaping. User input never touches the SQL string.
>
> XSS was more subtle. I'm using innerHTML to render API data, which means
> if a user registered with a name like script-alert-1-script, it would
> execute in every admin browser that loaded the user table. The fix was
> an escapeHTML() function in api.js that converts angle brackets and quotes
> to HTML entities before anything goes into innerHTML.
>
> For file uploads, checking only the file extension isn't enough — you
> can rename a file to .jpg. Checking only the Content-Type header isn't
> enough either — the browser sets that based on the filename. I check both.
>
> The path traversal guard on image deletion is a good example of defence
> in depth: even though the path comes from our own database, I still
> require it starts with /uploads/events/ and contains no dot-dot sequences
> before touching the filesystem."

---

## SLIDE 8 — What I'd Do Next (9:00 – 9:30)

```
Future Work
───────────
  → Stripe integration for online payments at booking
  → Redis session store  (survives server restarts)
  → Jest + Supertest test suite  (no tests right now)
  → AWS S3 for image storage  (currently local disk)
  → Server-side rendered unit reviews on room cards
  → Push notifications for ticket status updates
```

**SPEAKER NOTES:**
> "A few things I'd prioritise if this were going to production.
>
> The session store is in-memory right now — every server restart logs
> everyone out. Redis would fix that and enable horizontal scaling.
>
> There are zero automated tests. That's the thing that would hurt most
> in a real team environment. I'd add Jest for the services layer and
> Supertest for route integration tests.
>
> And Stripe — right now admins manually mark invoices paid. Actual
> payment processing is the most obvious missing feature."

---

## SLIDE 9 — Summary + Q&A (9:30 – 10:00)

```
Summary
────────
  ✓ Full-stack booking system — guest, staff, admin roles
  ✓ Transactional reservation engine (no double-bookings)
  ✓ Interactive availability calendar (vanilla JS)
  ✓ File upload with image validation
  ✓ 3-type email system (booking, password reset, security notice)
  ✓ Revenue analytics with Chart.js
  ✓ Dark mode, emoji avatars, live ticket polling
  ✓ Security hardening across all layers

  GitHub: github.com/HaydenParker2713/sandcastle-resort

  Questions?
```

**SPEAKER NOTES:**
> "To summarise — Sandcastle Resort is a full property management system
> covering the whole guest lifecycle from booking to checkout, with a
> staff-facing event and ticket system and an admin analytics dashboard.
>
> The source code is on GitHub if anyone wants to look at it.
>
> Happy to take any questions."

---

## TIMING GUIDE

| Slide | Topic | Target Time | Cumulative |
|---|---|---|---|
| 1 | Title | 0:30 | 0:30 |
| 2 | Problem | 0:45 | 1:15 |
| 3 | Tech Stack | 0:45 | 2:00 |
| 4 | Architecture | 1:00 | 3:00 |
| 5 | Database | 1:00 | 4:00 |
| 6 | **LIVE DEMO** | 3:30 | 7:30 |
| 7 | Security | 1:30 | 9:00 |
| 8 | Future Work | 0:30 | 9:30 |
| 9 | Q&A | 0:30 | 10:00 |

---

## DEMO CHECKLIST (do these before class)

- [ ] Server is running locally (`npm start`)
- [ ] MySQL is running and database has seed data
- [ ] Browser tab is open to `http://localhost:3000`
- [ ] Have a test image ready to upload for the events demo
- [ ] Have an admin account and a staff account credentials ready
- [ ] Open a second browser window / incognito tab for the guest flow
- [ ] Zoom in browser to ~125% so the class can see text clearly
- [ ] Close all other browser tabs to avoid distractions
- [ ] Turn off Slack / Discord / notifications
- [ ] Have GitHub repo open in another tab in case someone asks to see code

---

## LIKELY QUESTIONS + ANSWERS

**Q: Why not use React or Next.js?**
> "Intentional decision. I wanted to understand what a framework gives
> you before relying on one. Vanilla JS forced me to build the calendar
> state machine, DOM rendering, and polling logic from scratch. I now know
> exactly what useEffect and useState are replacing."

**Q: How does the double-booking prevention actually work?**
> "The availability check SELECT and the reservation INSERT happen inside
> a single MySQL transaction on a locked connection. If the SELECT returns
> any overlapping rows the transaction is rolled back. The overlap condition
> is: existing check_in < new check_out AND existing check_out > new check_in —
> that catches partial overlaps too, not just exact matches."

**Q: What happens if the server crashes mid-transaction?**
> "MySQL rolls back any uncommitted transaction automatically when the
> connection drops. The connection pool handles reconnection. The guest
> would get a 500 error and would need to retry — no partial data is committed."

**Q: Why store sessions server-side instead of JWTs?**
> "JWTs are stateless — you can't invalidate them before expiry without
> a blocklist, which is basically a session store anyway. Server-side
> sessions let you logout immediately by destroying the session.
> The tradeoff is you need sticky sessions or a shared store for
> horizontal scaling, which is why I listed Redis as future work."

**Q: Could a staff member post malicious JavaScript in an event title?**
> "Good catch — that's exactly what XSS is. Every value from the API goes
> through escapeHTML() before being written to innerHTML. So angle brackets
> become HTML entities and render as literal text, not executable code."

**Q: How does the email fallback work?**
> "nodemailer has a built-in test account service called Ethereal. If
> SMTP credentials aren't in the environment, the app creates an Ethereal
> throwaway account and sends mail there. nodemailer.getTestMessageUrl()
> returns a URL you can open to see what the email would have looked like.
> It's perfect for development — zero configuration required."
