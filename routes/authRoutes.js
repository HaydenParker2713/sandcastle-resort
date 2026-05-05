const express    = require('express');
const rateLimit  = require('express-rate-limit');
const { authService } = require('../services/index');
const { requireAuth } = require('../middleware/auth');
const { sendPasswordChangedNotice, sendPasswordReset } = require('../utils/email');
const { pool } = require('../config/db');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
});

const forgotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset requests. Please try again later.' },
});

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', async (req, res) => {
  try {
    const { first_name, last_name, email, password } = req.body;

    if (!first_name || !last_name || !email || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (first_name.length > 50 || last_name.length > 50) {
      return res.status(400).json({ error: 'Name must be 50 characters or fewer.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
    }

    const existing = await authService.findByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email is already registered.' });

    const user = await authService.register({ first_name, last_name, email, password });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error.' });
      req.session.user = user;
      res.status(201).json({ message: 'Registration successful.', user });
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error during registration.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await authService.findByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const passwordMatch = await authService.verifyPassword(password, user.password_hash);
    if (!passwordMatch) return res.status(401).json({ error: 'Invalid email or password.' });

    req.session.regenerate((err) => {
      if (err) return res.status(500).json({ error: 'Session error.' });
      req.session.user = {
        user_id:    user.user_id,
        first_name: user.first_name,
        last_name:  user.last_name,
        email:      user.email,
        role_name:  user.role_name,
      };
      res.json({ message: 'Login successful.', user: req.session.user });
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

router.post('/logout', (req, res) => {
  req.session.destroy((error) => {
    if (error) return res.status(500).json({ error: 'Could not log out.' });
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully.' });
  });
});

router.get('/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

router.patch('/profile', requireAuth, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (first_name.length > 50 || last_name.length > 50) {
      return res.status(400).json({ error: 'Name must be 50 characters or fewer.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email address.' });
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

router.post('/change-password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    const user = await authService.findByEmail(req.session.user.email);
    if (!user) return res.status(401).json({ error: 'Account not found.' });

    const match = await authService.verifyPassword(current_password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Current password is incorrect.' });

    await authService.changePassword(req.session.user.user_id, new_password);

    sendPasswordChangedNotice({ to: user.email, firstName: user.first_name })
      .catch(err => console.error('Security notice email failed:', err.message));

    res.json({ message: 'Password updated successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error changing password.' });
  }
});

router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  try {
    const result = await authService.createPasswordResetToken(email);

    // Always return 200 whether the email exists or not — prevents email enumeration.
    if (!result) {
      return res.json({ message: 'Reset link sent! Check your email inbox (and spam folder).' });
    }

    const baseUrl   = process.env.APP_URL || `http://localhost:${process.env.PORT || 3000}`;
    const resetLink = `${baseUrl}/reset-password?token=${result.token}`;

    try {
      await sendPasswordReset({ to: result.user.email, firstName: result.user.first_name, resetLink });
      res.json({ message: 'Reset link sent! Check your email inbox (and spam folder).' });
    } catch {
      // Email delivery failed — invalidate the token so it doesn't sit unused in the DB.
      await pool.execute(
        `UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE user_id = ?`,
        [result.user.user_id]
      );
      res.status(503).json({ error: 'Could not send reset email. Please try again later.' });
    }
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, new_password } = req.body;
    if (!token || !new_password) {
      return res.status(400).json({ error: 'Token and new password are required.' });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }
    await authService.resetPasswordByToken(token, new_password);
    res.json({ message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    if (err.code === 'INVALID_TOKEN') return res.status(400).json({ error: err.message });
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Server error resetting password.' });
  }
});

module.exports = router;
