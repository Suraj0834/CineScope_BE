# Keep-Alive Service Setup Guide

## 🔄 What is Keep-Alive Service?

The Keep-Alive service prevents your backend server from sleeping due to inactivity on free hosting platforms like:
- **Render** (free tier sleeps after 15 min)
- **Heroku** (free/hobby tier sleeps after 30 min)
- **Railway** (sleeps after inactivity)
- **Fly.io** (suspends after inactivity)

## 🎯 How It Works

The service automatically sends HTTP requests to your server's `/health` endpoint every 14 minutes to keep it awake.

```
Time 0:00  ✅ Server Active
Time 14:00 🔄 Auto-ping sent → Server stays awake
Time 28:00 🔄 Auto-ping sent → Server stays awake
Time 42:00 🔄 Auto-ping sent → Server stays awake
... continues forever
```

## ✅ Already Configured

The keep-alive service has been added to your backend and is **already configured**!

### What Was Added:

1. **New Service File**: `/services/keepAlive.js`
   - Handles automatic ping scheduling
   - Logs all ping attempts
   - Tracks ping statistics

2. **Updated**: `server.js`
   - Imports keep-alive service
   - Starts service on server startup
   - Stops service on shutdown

3. **New Endpoint**: `GET /keep-alive/status`
   - Check if keep-alive is working
   - View ping statistics

4. **Updated**: `.env`
   - Added keep-alive configuration

## 🚀 How to Use

### Option 1: Use Default Configuration (Recommended)

Already configured in `.env`:
```env
BASE_URL=https://cinescope-be.onrender.com
ENABLE_KEEP_ALIVE=true
KEEP_ALIVE_INTERVAL=*/14 * * * *
```

Just start your server:
```bash
npm start
```

You should see:
```
╔═══════════════════════════════════════════════╗
║     🔄 Keep-Alive Service Starting            ║
╠═══════════════════════════════════════════════╣
║  Target URL: https://cinescope-be.onrender.com/health
║  Interval: Every 14 minutes                    ║
║  Status: ✅ Enabled                            ║
╚═══════════════════════════════════════════════╝
```

### Option 2: Custom Configuration

Edit `.env` to customize:

```env
# Your server URL (IMPORTANT: Must match your actual URL)
BASE_URL=https://your-backend-url.com

# Enable/disable keep-alive (true/false)
ENABLE_KEEP_ALIVE=true

# How often to ping (cron format)
# */14 * * * * = Every 14 minutes (recommended)
# */10 * * * * = Every 10 minutes
# */5 * * * * = Every 5 minutes
KEEP_ALIVE_INTERVAL=*/14 * * * *
```

## 📊 Check If It's Working

### Method 1: Check Server Logs
Watch your server logs for:
```
✅ Keep-Alive Ping #1 successful (245ms) - Server is awake
✅ Keep-Alive Ping #2 successful (198ms) - Server is awake
✅ Keep-Alive Ping #3 successful (312ms) - Server is awake
```

### Method 2: Check Status Endpoint
Visit: `https://cinescope-be.onrender.com/keep-alive/status`

Response:
```json
{
  "success": true,
  "keepAlive": {
    "enabled": true,
    "baseUrl": "https://cinescope-be.onrender.com",
    "interval": "*/14 * * * *",
    "lastPing": "2026-04-10T10:14:23.456Z",
    "totalPings": 42,
    "isRunning": true
  },
  "timestamp": "2026-04-10T10:28:45.789Z"
}
```

### Method 3: Monitor from Browser
Open browser console and run:
```javascript
setInterval(async () => {
  const res = await fetch('https://cinescope-be.onrender.com/keep-alive/status');
  const data = await res.json();
  console.log('Keep-Alive Status:', data.keepAlive);
}, 60000); // Check every minute
```

## 🎯 For Render.com Deployment

### Step 1: Update Environment Variables

1. Go to your Render dashboard
2. Select your backend service
3. Click **Environment** tab
4. Add these variables:

```
BASE_URL = https://cinescope-be.onrender.com
ENABLE_KEEP_ALIVE = true
KEEP_ALIVE_INTERVAL = */14 * * * *
```

### Step 2: Deploy

Push your code to GitHub:
```bash
cd CineScope_Be
git add .
git commit -m "Add keep-alive service"
git push origin main
```

Render will automatically redeploy.

### Step 3: Verify

After deployment completes:
1. Check Render logs for keep-alive messages
2. Visit `/keep-alive/status` endpoint
3. Wait 14 minutes and check if server is still awake

## 🔧 Troubleshooting

### Server Still Sleeping?

**Problem**: Server goes to sleep despite keep-alive
**Solution**: 
- Check if `ENABLE_KEEP_ALIVE=true` in environment variables
- Verify `BASE_URL` matches your actual deployed URL
- Check Render logs for keep-alive errors
- Try reducing interval to `*/10 * * * *` (every 10 minutes)

### Ping Failing?

**Problem**: Logs show "❌ Keep-Alive Ping failed"
**Solution**:
- Verify your server URL is correct
- Check if `/health` endpoint is accessible
- Test manually: `curl https://your-url.com/health`
- Check Render service status

### Too Many Logs?

**Problem**: Keep-alive logs cluttering console
**Solution**: The service only logs:
- Startup message (once)
- Each ping result (every 14 min)
- Errors (when they occur)

This is minimal and helpful for debugging.

### Want to Disable?

Set in `.env`:
```env
ENABLE_KEEP_ALIVE=false
```

Or remove the environment variable entirely.

## 📈 Performance Impact

### Resource Usage:
- **CPU**: Negligible (~0.01% per ping)
- **Memory**: ~1MB for cron service
- **Network**: 1 HTTP request every 14 minutes
- **Bandwidth**: ~100 bytes per ping

### Benefits:
- ✅ Server never sleeps
- ✅ Faster response times (no cold starts)
- ✅ Better user experience
- ✅ No manual intervention needed

## 🌐 Alternative Solutions

If keep-alive doesn't work for your hosting:

### 1. External Cron Services (Free)

**UptimeRobot** (https://uptimerobot.com)
- Free tier: 50 monitors
- Check interval: 5 minutes
- Setup: Add your `/health` URL

**Cron-job.org** (https://cron-job.org)
- Free tier: Unlimited jobs
- Check interval: 1 minute minimum
- Setup: Add your `/health` URL

**Pingdom** (https://pingdom.com)
- Free tier: 1 monitor
- Check interval: 1 minute
- Setup: Add your `/health` URL

### 2. GitHub Actions

Create `.github/workflows/keep-alive.yml`:
```yaml
name: Keep Backend Alive
on:
  schedule:
    - cron: '*/14 * * * *'
  workflow_dispatch:

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Server
        run: curl https://cinescope-be.onrender.com/health
```

### 3. Upgrade Hosting Plan

Most platforms offer paid plans that don't sleep:
- **Render**: $7/month (never sleeps)
- **Heroku**: $5/month (never sleeps)
- **Railway**: $5/month (never sleeps)

## 📝 Cron Interval Examples

```bash
# Every 5 minutes
KEEP_ALIVE_INTERVAL=*/5 * * * *

# Every 10 minutes
KEEP_ALIVE_INTERVAL=*/10 * * * *

# Every 14 minutes (recommended)
KEEP_ALIVE_INTERVAL=*/14 * * * *

# Every 30 minutes
KEEP_ALIVE_INTERVAL=*/30 * * * *

# Every hour
KEEP_ALIVE_INTERVAL=0 * * * *

# Every 2 hours
KEEP_ALIVE_INTERVAL=0 */2 * * *
```

## ❓ FAQ

**Q: Will this work on localhost?**  
A: Yes, but it's not needed. Localhost doesn't sleep.

**Q: Does this cost money?**  
A: No, it's completely free. Just uses existing server resources.

**Q: Can I use multiple URLs?**  
A: Currently supports one URL. You can modify the service to ping multiple endpoints.

**Q: What if my server crashes?**  
A: Keep-alive will log the error but won't restart the server. You need proper monitoring and auto-restart (PM2, Render auto-restart, etc.)

**Q: Is this reliable?**  
A: Yes, node-cron is battle-tested and used in production by thousands of apps.

**Q: Can I see ping history?**  
A: Check `/keep-alive/status` for total pings and last ping time.

## 🎉 Success Indicators

Your keep-alive is working if:
- ✅ You see ping logs every 14 minutes
- ✅ Server responds immediately (no cold start delay)
- ✅ `/keep-alive/status` shows increasing `totalPings`
- ✅ Server doesn't show "sleeping" status on Render
- ✅ Your app users don't experience delays

## 📞 Need Help?

If you encounter issues:
1. Check server logs for error messages
2. Verify environment variables are set
3. Test the `/health` endpoint manually
4. Check if your hosting platform allows self-pinging

---

**Your backend will now stay awake 24/7! 🎉**

No more cold starts, no more delays, just a fast and responsive API.
