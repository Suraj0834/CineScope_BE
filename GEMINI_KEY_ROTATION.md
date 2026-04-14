# Gemini API Key Rotation System

## Overview

The CineScope backend now features an **automatic Gemini API key rotation system** that seamlessly switches between multiple API keys when quota limits are reached. This ensures uninterrupted AI service even when individual API keys hit their daily limits.

## How It Works

### 1. **Circular Key Rotation**
- The system maintains a pool of Gemini API keys
- When a key fails due to quota/rate limits (500 or 429 errors), it automatically rotates to the next key
- Keys are used in a circular fashion: Key1 → Key2 → Key3 → Key4 → Key1...

### 2. **Smart Failure Handling**
- Failed keys are temporarily blocked after 3 consecutive failures
- Blocked keys are automatically unblocked after 5 minutes
- On successful requests, failure counters are reset

### 3. **Automatic Retry Logic**
- When an API call fails, the system automatically retries with the next key
- Up to 4 retry attempts (one for each key)
- Non-quota errors (like invalid API keys) skip retries to fail fast

## Configuration

### Setting Up Multiple API Keys

In your `.env` file, configure multiple Gemini API keys:


**Important:**
- Separate keys with commas (`,`)
- No spaces between keys
- Minimum 1 key, recommended 4 keys for best coverage

### Getting Gemini API Keys

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and add it to your `.env` file
5. Repeat for up to 4 different Google accounts to get 4 keys

## Error Handling

### Quota Errors (Automatic Rotation)
When these errors occur, the system automatically rotates to the next key:
- **500 Internal Server Error** (often indicates quota exhaustion)
- **429 Too Many Requests** (rate limit exceeded)
- Any error containing keywords: "quota", "rate limit", "resource exhausted"

### Non-Quota Errors (Immediate Failure)
These errors cause immediate failure without rotation:
- **401 Unauthorized** (invalid API key)
- **403 Forbidden** (API access denied)
- Network errors

## Monitoring

### Check Key Status

Use the `/api/gemini/key-stats` endpoint to monitor key rotation status:

```bash
GET /api/gemini/key-stats
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "message": "Key statistics retrieved successfully",
  "data": {
    "totalKeys": 4,
    "currentIndex": 0,
    "failedKeys": [
      {
        "keyIndex": 0,
        "failures": 2,
        "lastFailedAt": "2026-04-08T10:30:00.000Z"
      }
    ]
  }
}
```

### Console Logs

The system provides detailed console logs:

```
🔑 Gemini Key Manager initialized with 4 API key(s)
✅ Key at index 0 recovered
🔄 Rotating Gemini API key: index 0 → 1
❌ Key at index 1 failed (1/3 failures): Request failed with status code 500
⏭️  Skipping blocked key (index 2)
```

## Best Practices

### 1. **Use 4 Different Google Accounts**
- Each Google account provides its own free tier quota
- More keys = better coverage and reliability

### 2. **Monitor Key Usage**
- Check `/api/gemini/key-stats` regularly
- Replace or add keys if multiple keys are consistently failing

### 3. **Stagger Key Usage**
- If possible, use keys from different Google accounts created on different days
- This helps distribute quota refresh times

### 4. **Production Setup**
- Use environment variables (never hardcode keys)
- Keep `.env` file in `.gitignore`
- Use secure secret management for production (e.g., AWS Secrets Manager, Azure Key Vault)

## Troubleshooting

### Problem: "No Gemini API keys available"
**Solution:** Check your `.env` file and ensure `GEMINI_API_KEYS` or `GEMINI_API_KEY` is set.

### Problem: All keys are blocked
**Cause:** All keys have exceeded their quota or rate limits.

**Solutions:**
1. Wait 5 minutes for automatic unblocking
2. Add more API keys to the pool
3. Wait until quota resets (usually 24 hours)

### Problem: Keys rotating too frequently
**Cause:** One or more keys may be invalid or have very low quota.

**Solutions:**
1. Check `/api/gemini/key-stats` to identify problematic keys
2. Remove or replace invalid keys
3. Verify all keys are active at [Google AI Studio](https://makersuite.google.com/app/apikey)

## Technical Details

### Files Modified
- **`services/geminiKeyManager.js`**: Core key rotation logic
- **`routes/gemini.js`**: Updated to use key manager
- **`.env`**: Configuration for multiple keys

### Key Manager Configuration
```javascript
maxFailuresBeforeSkip: 3      // Block key after 3 failures
resetFailureAfter: 300000     // Unblock after 5 minutes (ms)
```

### API Call Flow
```
1. Get current key from manager
2. Make API request
3. Success? → Mark key as successful
4. Failure (quota error)? → Rotate to next key and retry
5. Failure (other error)? → Stop retrying
6. Max retries reached? → Return error
```

## Migration from Single Key

If you were previously using `GEMINI_API_KEY`, the system is backward compatible:

**Old format:**
```env
GEMINI_API_KEY=AIzaSyCZYGliOSWQaN5Wx3-z8gC6F7VpcCxOEDw
```

**New format (recommended):**
```env
GEMINI_API_KEYS=AIzaSyCZYGliOSWQaN5Wx3-z8gC6F7VpcCxOEDw,AIzaSyDFOclYHOjq6B9I0cL92rKNrTKGd9WK5ic
GEMINI_API_KEY=AIzaSyCZYGliOSWQaN5Wx3-z8gC6F7VpcCxOEDw
```

The system prioritizes `GEMINI_API_KEYS` but falls back to `GEMINI_API_KEY` if needed.

## Support

For issues or questions:
- Check console logs for detailed error messages
- Use `/api/gemini/key-stats` endpoint for diagnostics
- Review Google AI Studio quota limits
- Verify all keys are valid and active

---

**Last Updated:** April 2026
**Version:** 1.0.0
