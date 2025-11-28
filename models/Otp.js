const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  code: {
    type: String,
    required: [true, 'OTP code is required'],
    length: 6
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 600 // Document will be automatically deleted after 10 minutes (600 seconds)
  },
  expiresAt: {
    type: Date,
    required: true
  },
  verified: {
    type: Boolean,
    default: false
  }
});

// Index to improve query performance
otpSchema.index({ email: 1, createdAt: -1 });

// Method to check if OTP is expired
otpSchema.methods.isExpired = function() {
  return Date.now() > this.expiresAt;
};

module.exports = mongoose.model('Otp', otpSchema);
