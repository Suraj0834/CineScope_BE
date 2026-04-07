const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default
  },
  watchlist: [{
    tmdbId: {
      type: Number,
      required: false,
      default: null
    },
    // IMDB ID - primary identifier for Android app
    imdbId: {
      type: String,
      required: false,
      default: null
    },
    title: {
      type: String,
      default: ''
    },
    posterPath: {
      type: String,
      default: ''
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  favorites: [{
    tmdbId: {
      type: Number,
      required: false,
      default: null
    },
    // IMDB ID - primary identifier for Android app
    imdbId: {
      type: String,
      required: false,
      default: null
    },
    title: {
      type: String,
      default: ''
    },
    posterPath: {
      type: String,
      default: ''
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
userSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

// Instance method to check if movie is in watchlist
userSchema.methods.isInWatchlist = function (tmdbId) {
  return this.watchlist.some(item => item.tmdbId === tmdbId);
};

// Instance method to check if movie is in favorites
userSchema.methods.isInFavorites = function (tmdbId) {
  return this.favorites.some(item => item.tmdbId === tmdbId);
};

module.exports = mongoose.model('User', userSchema);
