const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const moviesRoutes = require('./routes/movies');
const geminiRoutes = require('./routes/gemini');
const profileRoutes = require('./routes/profile');
const personRoutes = require('./routes/person');

// Initialize Express app
const app = express();

// ===========================
// MIDDLEWARE
// ===========================

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Global rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 1 * 60 * 1000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000, // Limit each IP to 1000 requests per minute
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });
}

// ===========================
// DATABASE CONNECTION
// ===========================

const connectDB = async () => {
  try {
    // Note: recent MongoDB Node driver versions ignore the
    // `useNewUrlParser` and `useUnifiedTopology` options —
    // pass only the connection string to avoid deprecation warnings.
    const conn = await mongoose.connect(process.env.MONGO_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return true; // Return success
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    return false; // Return failure
  }
};

connectDB();

// ===========================
// ROUTES
// ===========================

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'CineScope AI Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      auth: '/api/auth',
      movies: '/api/movies',
      gemini: '/api/gemini',
      profile: '/api/profile',
      person: '/api/person'
    }
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'CineScope AI API - v1.0.0',
    documentation: {
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        forgot: 'POST /api/auth/forgot',
        verifyOtp: 'POST /api/auth/verify-otp'
      },
      movies: {
        trending: 'GET /api/movies/trending',
        search: 'GET /api/movies/search?q=query',
        detailsByImdbId: 'GET /api/movies/:imdbId',
        detailsByTitle: 'GET /api/movies/title/:title'
      },
      gemini: {
        summarize: 'POST /api/gemini/summarize (Protected)',
        explain: 'POST /api/gemini/explain (Protected)',
        recommend: 'POST /api/gemini/recommend (Protected)',
        analyze: 'POST /api/gemini/analyze (Protected)'
      },
      profile: {
        getProfile: 'GET /api/profile (Protected)',
        updateProfile: 'PUT /api/profile (Protected)',
        getWatchlist: 'GET /api/profile/watchlist (Protected)',
        updateWatchlist: 'PUT /api/profile/watchlist (Protected)',
        getFavorites: 'GET /api/profile/favorites (Protected)',
        updateFavorites: 'PUT /api/profile/favorites (Protected)',
        checkMovie: 'GET /api/profile/check/:imdbId (Protected)'
      }
    }
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/movies', moviesRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/person', personRoutes);

// ===========================
// ERROR HANDLING
// ===========================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);

  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ===========================
// SERVER STARTUP
// ===========================

const PORT = process.env.PORT || 5000;

connectDB().then((dbConnected) => {
  // Start server and keep reference so we can handle errors & graceful shutdown
  let server = app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════╗
║                                               ║
║        🎬 CineScope AI Backend Server         ║
║                                               ║
║  Status: ✅ Running                           ║
║  Port: ${PORT}                                    ║
║  Environment: ${process.env.NODE_ENV || 'development'}                  ║
║  Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}                    ║
║                                               ║
║  API Documentation: http://localhost:${PORT}/api   ║
║                                               ║
╚═══════════════════════════════════════════════╝
    `);
  });

  // Handle server 'error' events (e.g. port already in use)
  server.on('error', (error) => {
    if (error && error.syscall !== 'listen') {
      console.error('Server error:', error);
      process.exit(1);
    }

    // Detect whether PORT is a named pipe or numeric port
    const bind = Number.isNaN(Number(PORT)) ? `Pipe ${PORT}` : `Port ${PORT}`;

    // Friendly handling for EADDRINUSE
    if (error.code === 'EADDRINUSE') {
      console.error(`❌ ${bind} is already in use. Please free the port or start with a different PORT. Example: PORT=3000 npm start`);
      // Attempt graceful shutdown of DB connection before exit.
      // `mongoose.connection.close()` returns a Promise in recent mongoose versions.
      if (mongoose.connection && typeof mongoose.connection.close === 'function') {
        mongoose.connection
          .close(false)
          .then(() => process.exit(1))
          .catch(() => process.exit(1));
      } else {
        process.exit(1);
      }
    } else {
      console.error('Server error:', error);
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
    // Close server & exit process
    if (server && typeof server.close === 'function') {
      server.close(() => process.exit(1));
    } else {
      process.exit(1);
    }
  });

  // Handle SIGTERM
  process.on('SIGTERM', () => {
    console.log('👋 SIGTERM received. Shutting down gracefully...');
    if (server && typeof server.close === 'function') {
      server.close(() => {
        console.log('💤 Server closed.');
        process.exit(0);
      });
    } else {
      process.exit(0);
    }
  });
}).catch(() => {
  console.error('❌ Failed to connect to database. Server not started.');
  process.exit(1);
});

module.exports = app;
