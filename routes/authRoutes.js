const express = require("express");
const createServices = require("../services");
const { pool } = require("../config/db");
const { authService } = createServices(pool);

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: "All fields are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    const existing = await authService.findByEmail(email);
    if (existing) {
      return res.status(409).json({ error: "Email is already registered." });
    }

    const user = await authService.register({ first_name, last_name, email, password });

    req.session.user = user;

    res.status(201).json({
      message: "Registration successful.",
      user
    });
  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ error: "Server error during registration." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await authService.findByEmail(email);
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }
    const passwordMatch = await authService.verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    req.session.user = {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role_name: user.role_name
    };

    res.json({
      message: "Login successful.",
      user: req.session.user
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      return res.status(500).json({ error: "Could not log out." });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

router.get("/me", (req, res) => {
  if (!req.session.user) {
    return res.status(200).json({ user: null });
  }

  res.json({ user: req.session.user });
});

module.exports = router;