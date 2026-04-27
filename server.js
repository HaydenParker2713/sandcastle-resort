require("dotenv").config();

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === "change_me") {
  console.error("FATAL: SESSION_SECRET is not set or is using the default placeholder.");
  console.error("Set a strong, random SESSION_SECRET in your .env file before starting.");
  process.exit(1);
}

const express = require("express");
const session = require("express-session");
const helmet  = require("helmet");
const morgan  = require("morgan");
const cors    = require("cors");
const path    = require("path");

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
const { eventService, barService, activityListService } = require("./services");

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "https://cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'"],
      imgSrc:     ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc:    ["'self'"],
      objectSrc:  ["'none'"],
      upgradeInsecureRequests: []
    }
  }
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || `http://localhost:${PORT}`,
  credentials: true
}));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("dev"));
}

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Session ───────────────────────────────────────────────────────────────────
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge:   1000 * 60 * 60 * 2
    }
  })
);

// ── Static files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, "public")));

// ── API routes ────────────────────────────────────────────────────────────────
app.use("/api/auth",         authRoutes);
app.use("/api/units",        unitRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/tickets",      ticketRoutes);
app.use("/api/invoices",     invoiceRoutes);
app.use("/api/admin",        adminRoutes);
app.use("/api/reviews",      reviewRoutes);
app.use("/api/events",          eventRoutes);
app.use("/api/bar",             barRoutes);
app.use("/api/activity-items",  activityListRoutes);

// ── Page routes ───────────────────────────────────────────────────────────────
app.get("/dashboard", (req, res) => {
  if (!req.session.user) return res.redirect("/");
  res.sendFile(path.join(__dirname, "public", "dashboard.html"));
});

app.get("/admin", (req, res) => {
  if (!req.session.user || req.session.user.role_name !== "admin") {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/staff", (req, res) => {
  if (!req.session.user || !["admin", "staff"].includes(req.session.user.role_name)) {
    return res.redirect("/");
  }
  res.sendFile(path.join(__dirname, "public", "staff.html"));
});

app.get("/activities", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "activities.html"));
});

app.get("/forgot-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "forgot-password.html"));
});

app.get("/reset-password", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "reset-password.html"));
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ message: "Sandcastle Resort API is running." });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function startServer() {
  try {
    await testConnection();
    await eventService.ensureTable();
    await barService.ensureTable();
    await activityListService.ensureTable();
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();