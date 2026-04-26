const express = require("express");
const createServices = require("../services");
const { pool } = require("../config/db");
const { requireAuth } = require("../middleware/auth");
const { sendPasswordChangedNotice } = require("../utils/email");
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

router.patch("/profile", requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    const updated = await authService.updateProfile(req.session.user.user_id, { first_name, last_name, email });
    req.session.user = { ...req.session.user, first_name: updated.first_name, last_name: updated.last_name, email: updated.email };
    res.json({ message: 'Profile updated.', user: req.session.user });
  } catch (err) {
    if (err.code === 'EMAIL_TAKEN') return res.status(409).json({ error: err.message });
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error updating profile.' });
  }
});

router.post("/change-password", requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: "Both current and new password are required." });
    }
    if (new_password.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters." });
    }

    const user = await authService.findByEmail(req.session.user.email);
    const match = await authService.verifyPassword(current_password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }

    await authService.changePassword(req.session.user.user_id, new_password);

    // Fire-and-forget security notice email
    sendPasswordChangedNotice({
      to: user.email,
      firstName: user.first_name
    });

    res.json({ message: "Password updated successfully." });
  } catch (error) {
    console.error("Change password error:", error);
    res.status(500).json({ error: "Server error changing password." });
  }
});

module.exports = router;