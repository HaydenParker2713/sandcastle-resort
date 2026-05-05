// ── Entry point ───────────────────────────────────────────────────────────────
// Load environment variables from .env before anything else.
require("dotenv").config();

// Refuse to start if SESSION_SECRET is missing or still set to the placeholder.
// A weak secret lets attackers forge session cookies.
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change_me") {
  console.error("FATAL: SESSION_SECRET is not set or is using the default placeholder.");
  console.error("Set a strong, random SESSION_SECRET in your .env file before starting.");
  process.exit(1);
}

const express = require("express");
const session = require("express-session");
const helmet  = require("helmet");   // sets secure HTTP headers
const morgan  = require("morgan");   // logs every incoming request
const cors    = require("cors");     // controls which origins can call the API
const path    = require("path");

// Internal modules
const { testConnection } = require("./config/db");
const authRoutes        = require("./routes/authRoutes");
const unitRoutes        = require("./routes/unitRoutes");
const reservationRoutes = require("./routes/reservationRoutes");
const ticketRoutes      = require("./routes/ticketRoutes");
const invoiceRoutes     = require("./routes/invoiceRoutes");
const adminRoutes       = require("./routes/adminRoutes");
const reviewRoutes          = require("./routes/reviewRoutes");
const eventRoutes           = require("./routes/eventRoutes");
const barRoutes             = require("./routes/barRoutes");
const activityListRoutes    = require("./routes/activityListRoutes");
const unitTypeRoutes        = require("./routes/unitTypeRoutes");

// Services that need to create their DB tables on first run
const { eventService, barService, activityListService, unitService } = require("./services/index");
const { ensureAuditTable } = require("./utils/audit");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
// helmet() sets many protective HTTP headers automatically.
// The Content Security Policy (CSP) tells browsers which sources of scripts,
// styles, images etc. are trusted — everything else is blocked.
// cdn.jsdelivr.net is explicitly allowed so Chart.js can be loaded from CDN.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],                           // only load resources from our own origin by default
      scriptSrc:  ["'self'", "https://cdn.jsdelivr.net"], // allow Chart.js CDN
      styleSrc:   ["'self'", "'unsafe-inline'"],        // inline styles needed for dynamic theming
      imgSrc:     ["'self'", "data:", "blob:"],         // allow uploaded image previews
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],                           // block Flash and other plugins
      upgradeInsecureRequests: []
    }
  }
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// Restricts which domain can call the API. credentials:true is needed so the
// browser sends the session cookie on cross-origin requests (dev scenarios).
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`,
  credentials: true
}));

// ── Logging ───────────────────────────────────────────────────────────────────
// Morgan 'dev' format prints coloured one-line summaries: METHOD /path STATUS ms
// Skipped in test environments to keep test output clean.
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Body parsing ──────────────────────────────────────────────────────────────
// Parse JSON bodies (API calls from frontend) and URL-encoded bodies (HTML forms).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session ───────────────────────────────────────────────────────────────────
// express-session stores the logged-in user in a server-side session.
// The session ID is sent to the browser as a cookie; the actual data stays
// on the server so it cannot be tampered with by the client.
app.use(
  session({
    secret: process.env.SESSION_SECRET, // used to sign the session cookie
    resave: false,                       // don't re-save unchanged sessions
    saveUninitialized: false,            // don't create sessions for anonymous visitors
    cookie: {
      httpOnly: true,                    // JS cannot read the cookie — blocks XSS cookie theft
      secure:   process.env.NODE_ENV === "production", // HTTPS-only in prod
      sameSite: "lax",                   // blocks cross-site request forgery (CSRF) on most requests
      maxAge:   1000 * 60 * 60 * 2      // sessions expire after 2 hours of inactivity
    }
  })
);

// ── Static files ──────────────────────────────────────────────────────────────
// Serve everything in /public directly: HTML pages, CSS, JS, images, uploads.
app.use(express.static(path.join(__dirname, "public")));

// ── API routes ────────────────────────────────────────────────────────────────
// Each route file handles a specific feature area.
// The prefix here is combined with the path inside each route file.
app.use("/api/auth",         authRoutes);        // login, register, logout, profile, password
app.use("/api/units",        unitRoutes);         // room units and availability
app.use("/api/reservations", reservationRoutes);  // create, view, cancel reservations
app.use("/api/tickets",      ticketRoutes);       // maintenance / housekeeping requests
app.use("/api/invoices",     invoiceRoutes);      // billing records
app.use("/api/admin",        adminRoutes);        // admin-only: user management, stats, reviews
app.use("/api/reviews",      reviewRoutes);       // guest reviews on past stays
app.use("/api/events",          eventRoutes);         // resort events (staff can post with images)
app.use("/api/bar",             barRoutes);           // bar & dining menu (admin managed)
app.use("/api/activity-items",  activityListRoutes);  // resort activities list (admin managed)
app.use("/api/unit-types",      unitTypeRoutes);       // room type details: description, amenities, photo

// ── Page routes ───────────────────────────────────────────────────────────────
// These serve HTML files for specific URL paths.
// Server-side checks mean a guest who navigates directly to /admin is
// redirected to the home page rather than seeing an error.

app.get("/dashboard", (req, res) => {
  // Any logged-in user can access the guest dashboard
  if (!req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin", (req, res) => {
  // Only admins can reach the admin panel
  if (!req.session.user || req.session.user.role_name !== "admin") {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/staff", (req, res) => {
  // Staff and admin users can both use the staff panel
  if (!req.session.user || !["admin", "staff"].includes(req.session.user.role_name)) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "staff.html"));
});

app.get("/activities", (req, res) => {
  // Public page — no authentication required
  res.sendFile(path.join(__dirname, "public", "activities.html"));
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "forgot-password.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

// ── Health check ──────────────────────────────────────────────────────────────
// Simple endpoint used by monitoring tools or load balancers to verify the
// server is running.
app.get("/api/health", (req, res) => {
  res.json({ message: "Sandcastle Resort API is running." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
// Before accepting requests we:
//   1. Verify the DB connection is alive
//   2. Run ensureTable() on dynamic tables — these are created by the app
//      itself rather than schema.sql because they were added later and use
//      a CREATE TABLE IF NOT EXISTS guard so they are safe to call every boot
async function startServer() {
  try {
    await testConnection();
    await unitService.ensureColumns();
    await eventService.ensureTable();
    await barService.ensureTable();
    await activityListService.ensureTable();
    await ensureAuditTable();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
