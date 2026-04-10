const cron = require('node-cron');
const axios = require('axios');

/**
 * Keep-Alive Service
 *
 * Prevents the backend from sleeping due to inactivity by sending
 * periodic ping requests to the health endpoint.
 *
 * This is especially useful for free hosting services like Render
 * that put apps to sleep after 15 minutes of inactivity.
 */

class KeepAliveService {
  constructor() {
    this.baseUrl = process.env.BASE_URL || 'http://localhost:5000';
    this.pingInterval = process.env.KEEP_ALIVE_INTERVAL || '*/14 * * * *'; // Every 14 minutes
    this.isEnabled = process.env.ENABLE_KEEP_ALIVE !== 'false'; // Enabled by default
    this.cronJob = null;
    this.lastPingTime = null;
    this.pingCount = 0;
  }

  /**
   * Send a ping request to the health endpoint
   */
  async ping() {
    try {
      const startTime = Date.now();
      const response = await axios.get(`${this.baseUrl}/health`, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'KeepAlive-Service'
        }
      });

      const duration = Date.now() - startTime;
      this.lastPingTime = new Date();
      this.pingCount++;

      if (response.status === 200) {
        console.log(`✅ Keep-Alive Ping #${this.pingCount} successful (${duration}ms) - Server is awake`);
        return true;
      } else {
        console.warn(`⚠️  Keep-Alive Ping #${this.pingCount} returned status ${response.status}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Keep-Alive Ping #${this.pingCount} failed:`, error.message);
      return false;
    }
  }

  /**
   * Start the keep-alive cron job
   */
  start() {
    if (!this.isEnabled) {
      console.log('⏸️  Keep-Alive Service is disabled (set ENABLE_KEEP_ALIVE=true to enable)');
      return;
    }

    console.log(`
╔═══════════════════════════════════════════════╗
║     🔄 Keep-Alive Service Starting            ║
╠═══════════════════════════════════════════════╣
║  Target URL: ${this.baseUrl}/health
║  Interval: Every 14 minutes                    ║
║  Status: ✅ Enabled                            ║
╚═══════════════════════════════════════════════╝
    `);

    // Schedule cron job - runs every 14 minutes
    this.cronJob = cron.schedule(this.pingInterval, async () => {
      console.log(`\n⏰ Keep-Alive: Sending ping at ${new Date().toISOString()}`);
      await this.ping();
    });

    // Send initial ping after 1 minute
    setTimeout(() => {
      console.log('\n🚀 Keep-Alive: Sending initial ping...');
      this.ping();
    }, 60000);
  }

  /**
   * Stop the keep-alive cron job
   */
  stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('⏹️  Keep-Alive Service stopped');
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      baseUrl: this.baseUrl,
      interval: this.pingInterval,
      lastPing: this.lastPingTime,
      totalPings: this.pingCount,
      isRunning: this.cronJob ? true : false
    };
  }
}

// Export singleton instance
const keepAliveService = new KeepAliveService();

module.exports = keepAliveService;
