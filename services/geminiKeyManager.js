/**
 * Gemini API Key Manager
 * Handles circular rotation of multiple Gemini API keys
 */

class GeminiKeyManager {
  constructor() {
    // Load API keys from environment variable
    const keysString = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || '';
    this.apiKeys = keysString.split(',').map(key => key.trim()).filter(key => key.length > 0);

    if (this.apiKeys.length === 0) {
      console.warn('⚠️  No Gemini API keys configured!');
    }

    // Track current key index
    this.currentIndex = 0;

    // Track failed keys with timestamps (for temporary blocking)
    this.failedKeys = new Map(); // key -> { count, lastFailedAt }

    // Configuration
    this.maxFailuresBeforeSkip = 3; // Skip key after 3 consecutive failures
    this.resetFailureAfter = 300000; // Reset failure count after 5 minutes (300000ms)

    console.log(`🔑 Gemini Key Manager initialized with ${this.apiKeys.length} API key(s)`);
  }

  /**
   * Get the current active API key
   * @returns {string} Current API key
   */
  getCurrentKey() {
    if (this.apiKeys.length === 0) {
      throw new Error('No Gemini API keys available');
    }

    // Clean up old failures
    this.cleanupOldFailures();

    // Find next available key (skip temporarily blocked ones)
    let attempts = 0;
    const maxAttempts = this.apiKeys.length;

    while (attempts < maxAttempts) {
      const key = this.apiKeys[this.currentIndex];

      // Check if this key is temporarily blocked
      if (this.isKeyBlocked(key)) {
        console.log(`⏭️  Skipping blocked key (index ${this.currentIndex})`);
        this.rotateToNext();
        attempts++;
        continue;
      }

      return key;
    }

    // All keys are blocked, return current key anyway (last resort)
    console.warn('⚠️  All API keys are temporarily blocked, using current key anyway');
    return this.apiKeys[this.currentIndex];
  }

  /**
   * Check if a key is temporarily blocked due to failures
   * @param {string} key - API key to check
   * @returns {boolean} True if key is blocked
   */
  isKeyBlocked(key) {
    const failure = this.failedKeys.get(key);
    if (!failure) return false;

    const timeSinceLastFailure = Date.now() - failure.lastFailedAt;

    // If enough time has passed, unblock the key
    if (timeSinceLastFailure > this.resetFailureAfter) {
      this.failedKeys.delete(key);
      return false;
    }

    // Block if failure count exceeds threshold
    return failure.count >= this.maxFailuresBeforeSkip;
  }

  /**
   * Clean up old failure records
   */
  cleanupOldFailures() {
    const now = Date.now();
    for (const [key, failure] of this.failedKeys.entries()) {
      if (now - failure.lastFailedAt > this.resetFailureAfter) {
        this.failedKeys.delete(key);
      }
    }
  }

  /**
   * Rotate to the next API key in circular fashion
   * @returns {string} New current API key
   */
  rotateToNext() {
    if (this.apiKeys.length === 0) {
      throw new Error('No Gemini API keys available');
    }

    const previousIndex = this.currentIndex;
    this.currentIndex = (this.currentIndex + 1) % this.apiKeys.length;

    console.log(`🔄 Rotating Gemini API key: index ${previousIndex} → ${this.currentIndex}`);

    return this.getCurrentKey();
  }

  /**
   * Mark current key as failed and rotate to next
   * @param {Error} error - The error that occurred
   * @returns {string} New current API key
   */
  markCurrentKeyFailedAndRotate(error) {
    const currentKey = this.apiKeys[this.currentIndex];

    // Track failure
    const failure = this.failedKeys.get(currentKey) || { count: 0, lastFailedAt: 0 };
    failure.count++;
    failure.lastFailedAt = Date.now();
    this.failedKeys.set(currentKey, failure);

    console.log(`❌ Key at index ${this.currentIndex} failed (${failure.count}/${this.maxFailuresBeforeSkip} failures): ${error.message}`);

    // Rotate to next key
    return this.rotateToNext();
  }

  /**
   * Reset failure count for current key (on successful request)
   */
  markCurrentKeySuccess() {
    const currentKey = this.apiKeys[this.currentIndex];
    if (this.failedKeys.has(currentKey)) {
      this.failedKeys.delete(currentKey);
      console.log(`✅ Key at index ${this.currentIndex} recovered`);
    }
  }

  /**
   * Check if error is due to rate limit or quota exceeded
   * @param {Error} error - Error object from API call
   * @returns {boolean} True if error indicates quota/rate limit issue
   */
  isQuotaError(error) {
    if (!error.response) return false;

    const status = error.response.status;
    const errorData = error.response.data;

    // Check for rate limit (429) or server error (500)
    if (status === 429 || status === 500) {
      return true;
    }

    // Check error message for quota-related keywords
    const errorMessage = JSON.stringify(errorData).toLowerCase();
    const quotaKeywords = ['quota', 'rate limit', 'too many requests', 'limit exceeded', 'resource exhausted'];

    return quotaKeywords.some(keyword => errorMessage.includes(keyword));
  }

  /**
   * Get statistics about key usage
   * @returns {Object} Key manager statistics
   */
  getStats() {
    return {
      totalKeys: this.apiKeys.length,
      currentIndex: this.currentIndex,
      failedKeys: Array.from(this.failedKeys.entries()).map(([key, failure]) => ({
        keyIndex: this.apiKeys.indexOf(key),
        failures: failure.count,
        lastFailedAt: new Date(failure.lastFailedAt).toISOString()
      }))
    };
  }
}

// Export singleton instance
module.exports = new GeminiKeyManager();
