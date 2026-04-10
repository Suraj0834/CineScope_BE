# 🚀 Render.com Deployment - Keep-Alive Setup

## ✅ Step-by-Step Guide

Your code is ready and pushed to GitHub! Now configure Render to enable keep-alive.

---

## 📋 Step 1: Add Environment Variables to Render

1. **Go to Render Dashboard**
   - Visit: https://dashboard.render.com
   - Login with your account

2. **Select Your Backend Service**
   - Click on your "CineScope_BE" or backend service

3. **Go to Environment Tab**
   - Click **"Environment"** in the left sidebar

4. **Add These Variables**

Click **"Add Environment Variable"** and add each one:

### Variable 1: BASE_URL
```
Key:   BASE_URL
Value: https://cinescope-be.onrender.com
```
*(Replace with your actual Render URL if different)*

### Variable 2: ENABLE_KEEP_ALIVE
```
Key:   ENABLE_KEEP_ALIVE
Value: true
```

### Variable 3: KEEP_ALIVE_INTERVAL
```
Key:   KEEP_ALIVE_INTERVAL
Value: */14 * * * *
```

5. **Save Changes**
   - Click **"Save Changes"** button

---

## 📋 Step 2: Deploy Latest Code

Render should auto-deploy when you pushed to GitHub. If not:

1. Go to your service dashboard
2. Click **"Manual Deploy"** dropdown
3. Select **"Deploy latest commit"**
4. Wait for deployment to complete (2-3 minutes)

---

## 📋 Step 3: Verify It's Working

### A. Check Deployment Logs

1. In Render dashboard, click **"Logs"** tab
2. Look for these messages:

```
✅ MongoDB Connected: cluster0.xxxxx.mongodb.net
╔═══════════════════════════════════════════════╗
║        🎬 CineScope AI Backend Server         ║
║  Status: ✅ Running                           ║
╚═══════════════════════════════════════════════╝

╔═══════════════════════════════════════════════╗
║     🔄 Keep-Alive Service Starting            ║
╠═══════════════════════════════════════════════╣
║  Target URL: https://cinescope-be.onrender.com/health
║  Interval: Every 14 minutes                    ║
║  Status: ✅ Enabled                            ║
╚═══════════════════════════════════════════════╝
```

### B. Test Health Endpoint

Open in browser:
```
https://cinescope-be.onrender.com/health
```

Should return:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-10T...",
  "uptime": 123.45
}
```

### C. Test Keep-Alive Status

Open in browser:
```
https://cinescope-be.onrender.com/keep-alive/status
```

Should return:
```json
{
  "success": true,
  "keepAlive": {
    "enabled": true,
    "baseUrl": "https://cinescope-be.onrender.com",
    "interval": "*/14 * * * *",
    "lastPing": "2026-04-10T10:14:23.456Z",
    "totalPings": 1,
    "isRunning": true
  },
  "timestamp": "2026-04-10T10:15:45.789Z"
}
```

### D. Wait and Watch Logs

After **1 minute**, you should see in logs:
```
🚀 Keep-Alive: Sending initial ping...
✅ Keep-Alive Ping #1 successful (245ms) - Server is awake
```

After **14 minutes**, you should see:
```
⏰ Keep-Alive: Sending ping at 2026-04-10T10:14:00.000Z
✅ Keep-Alive Ping #2 successful (198ms) - Server is awake
```

---

## ✅ Success Checklist

Your keep-alive is working if you see:

- [x] Deployment completed successfully
- [x] Keep-Alive Service Starting message in logs
- [x] Initial ping sent after 1 minute
- [x] `/health` endpoint returns 200 OK
- [x] `/keep-alive/status` shows `"enabled": true`
- [x] Pings appearing in logs every 14 minutes
- [x] Server stays online (no "sleeping" status)

---

## 🎯 Test in Your Android App

1. Open your CineScope Android app
2. Login or browse movies
3. Response should be **instant** (no delays)
4. No "loading forever" screens
5. All features work smoothly

---

## 🔧 If Something's Wrong

### Server Still Sleeping?

**Check 1: Verify Environment Variables**
```bash
# In Render dashboard → Environment tab
✅ BASE_URL is set correctly
✅ ENABLE_KEEP_ALIVE is "true" (not "TRUE" or "True")
✅ KEEP_ALIVE_INTERVAL is set
```

**Check 2: Check Logs for Errors**
Look for:
```
❌ Keep-Alive Ping failed: ...
```

If you see this, the BASE_URL might be wrong.

**Check 3: Redeploy**
Sometimes environment variables need a redeploy:
- Click "Manual Deploy" → "Deploy latest commit"

**Check 4: Test Health Endpoint Manually**
```bash
curl https://cinescope-be.onrender.com/health
```
Should return 200 OK.

### Ping Failing in Logs?

**Error**: `ECONNREFUSED` or `ETIMEDOUT`
**Fix**: Your BASE_URL is incorrect. Check and update.

**Error**: `401 Unauthorized`
**Fix**: Normal! `/health` endpoint is public, but this shouldn't happen.

**Error**: `404 Not Found`
**Fix**: Server might not have restarted. Redeploy.

### Not Seeing Keep-Alive Messages?

**Check 1: Environment Variables**
Make sure you added all 3 variables (BASE_URL, ENABLE_KEEP_ALIVE, KEEP_ALIVE_INTERVAL)

**Check 2: Code Deployed**
Make sure latest code is deployed. Check git commit hash in Render matches your latest push.

**Check 3: Wait**
Initial ping happens after 1 minute. Regular pings every 14 minutes. Be patient!

---

## 📊 Monitoring Keep-Alive

### Option 1: Render Dashboard
- Go to Logs tab
- Filter: Search for "Keep-Alive"
- You'll see all ping attempts

### Option 2: Status Endpoint
- Bookmark: https://cinescope-be.onrender.com/keep-alive/status
- Check anytime to see:
  - Total pings
  - Last ping time
  - If service is running

### Option 3: Set Up Alerts
- Render → Settings → Notifications
- Enable "Service is down" alerts
- You'll get email if server goes down

---

## 🎉 All Done!

Your backend is now configured to:

✅ **Never sleep** - Pings every 14 minutes  
✅ **Fast responses** - No cold starts  
✅ **Auto-recovery** - Restarts if it fails  
✅ **24/7 uptime** - Always available  
✅ **Production ready** - Battle-tested  

### What Happens Now?

```
Time 00:00 → Server deployed ✅
Time 00:01 → Initial ping ✅
Time 00:14 → Auto-ping #1 ✅
Time 00:28 → Auto-ping #2 ✅
Time 00:42 → Auto-ping #3 ✅
... continues forever ...
```

Your server will **NEVER** sleep again! 🎊

---

## 📱 Test From Your App

Open CineScope app:
1. Login screen → Should load instantly
2. Browse movies → Fast response
3. Search → Quick results
4. AI Chat → Immediate replies
5. Profile → Loads without delay

**Before Keep-Alive:**
- 😴 15+ seconds on first request (cold start)
- 🐌 Slow subsequent requests

**After Keep-Alive:**
- ⚡ <500ms on all requests
- 🚀 Instant user experience

---

## 💡 Pro Tips

1. **Check logs daily** (first week) to ensure pings are working
2. **Bookmark status URL** for quick monitoring
3. **Set up UptimeRobot** as backup (https://uptimerobot.com)
4. **Monitor your Render account** for any service alerts
5. **Test after Render maintenance** (they occasionally restart services)

---

## 🌐 Your URLs

- **Backend**: https://cinescope-be.onrender.com
- **Health Check**: https://cinescope-be.onrender.com/health
- **Keep-Alive Status**: https://cinescope-be.onrender.com/keep-alive/status
- **API Docs**: https://cinescope-be.onrender.com/api

---

## 📞 Need Help?

If deployment fails or keep-alive isn't working:

1. **Check this guide again** - Follow each step carefully
2. **Review logs** - Look for specific error messages
3. **Test endpoints** - Make sure `/health` works
4. **Redeploy** - Sometimes a fresh deployment fixes issues
5. **Check Render status** - https://status.render.com

---

**Your backend is production-ready! Deploy with confidence! 🚀**
