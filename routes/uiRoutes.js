const express = require('express');
const path = require('path');
const passport = require('passport');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');

function ensureAuth(req, res, next) {
  if (req.isAuthenticated && req.isAuthenticated()) return next();
  res.redirect('/login');
}

// Serve login page (now from views folder)
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'pages', 'login.html'));
});

// Handle login (form POST)
router.post('/login', passport.authenticate('local', { failureRedirect: '/login' }), (req, res) => {
  res.redirect('/dashboard');
});

// Logout
router.get('/logout', (req, res) => {
  req.logout(() => {});
  res.redirect('/login');
});

// Protect dashboard
router.get('/dashboard', ensureAuth, (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'dashboard.html'));
});

// Return current user (simple JSON)
router.get('/me', (req, res) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) return res.status(401).json({});
  const u = req.user;
  res.json({ email: u.email, id: u._id, role: u.role });
});

// Serve registration page (optional, can use EJS or HTML)
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'views', 'pages', 'register.html'));
});

// Handle registration (form POST)
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).send('Email and password required');
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).send('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    await User.create({ email, passwordHash: hash, role: role || 'user' });
    res.redirect('/login');
  } catch (err) {
    res.status(500).send('Error registering user');
  }
});

// Admin: List all users
router.get('/admin/users', async (req, res) => {
  try {
    const users = await User.find({}, '-passwordHash'); // Exclude passwordHash
    console.log('Fetched users:', users); // Debug log
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users', details: err.message });
  }
});

// Admin: Create user
router.post('/admin/users', async (req, res) => {
  const { email, password, role } = req.body;
  if (!email || !password) return res.status(400).send('Email and password required');
  try {
    const exists = await User.findOne({ email });
    if (exists) return res.status(409).send('Email already registered');
    const hash = await bcrypt.hash(password, 10);
    const user = await User.create({ email, passwordHash: hash, role: role || 'user' });
    res.status(201).json({ email: user.email, role: user.role, id: user._id });
  } catch (err) {
    res.status(500).send('Error creating user');
  }
});

// Admin: Update user
router.put('/admin/users/:id', async (req, res) => {
  const { email, role } = req.body;
  if (!email && !role) return res.status(400).json({ error: 'Email or role required' });
  try {
    const update = {};
    if (email) update.email = email;
    if (role) update.role = role;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ email: user.email, role: user.role, id: user._id });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user', details: err.message });
  }
});

// Admin: Delete user
router.delete('/admin/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user', details: err.message });
  }
});

// Serve admin dashboard page
router.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

module.exports = router;
