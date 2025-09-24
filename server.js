const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const http = require('http');
const socketio = require('socket.io');

const productRoutes = require('./routes/productRoutes');
const uiRoutes = require('./routes/uiRoutes');
const stockIntakeRoutes = require('./routes/stockIntakeRoutes');

const app = express();
const server = http.createServer(app);
const io = socketio(server);
app.set('io', io); // Make io accessible in controllers
let liveUserCount = 0;
io.on('connection', (socket) => {
  liveUserCount++;
  io.emit('userCount', liveUserCount);
  socket.on('disconnect', () => {
    liveUserCount--;
    io.emit('userCount', liveUserCount);
  });
});
const PORT = process.env.PORT || 5000;

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Sessions & Passport
const session = require('express-session');
const passport = require('passport');
require('./config/passport')(passport);

app.use(session({ secret: process.env.SESSION_SECRET || 'keyboard cat', resave: false, saveUninitialized: false }));
app.use(passport.initialize());
app.use(passport.session());

// UI Routes (login, dashboard, static pages)
app.use('/', uiRoutes);

// API / resource routes
app.use('/products', productRoutes);
app.use('/stock-intake', stockIntakeRoutes);

app.get('/', (req, res) => res.redirect('/login'));

// Connect to MongoDB (local by default)
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/Wareniex';
mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('Connected to MongoDB');

    // Ensure default admin user exists (email: admin@example.com / password: admin123)
    const User = require('./models/User');
    const bcrypt = require('bcryptjs');
    (async () => {
      const exists = await User.findOne({ email: 'admin@example.com' });
      if (!exists) {
        const hash = await bcrypt.hash('admin123', 10);
        await User.create({ email: 'admin@example.com', passwordHash: hash });
        console.log('Created default admin user: admin@example.com / admin123');
      }
    })().catch(() => {});

    server.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
  })
  .catch(err => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
