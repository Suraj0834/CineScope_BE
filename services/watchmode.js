/**
 * Watchmode API Service
 * Provides streaming availability data for movies
 */
const axios = require('axios');

const WATCHMODE_KEY = process.env.WATCHMODE_KEY;
const WATCHMODE_BASE_URL = process.env.WATCHMODE_BASE_URL || 'https://api.watchmode.com/v1';

// USD to INR conversion rate (approximate real-world rate)
const USD_TO_INR = 83.5;

// Quality priority (higher index = higher priority)
const QUALITY_PRIORITY = ['SD', 'HD', '4K', 'UHD'];

class WatchmodeService {
  constructor() {
    this.client = axios.create({
      baseURL: WATCHMODE_BASE_URL,
      timeout: 10000
    });
  }

  /**
   * Convert USD price to INR
   */
  convertToINR(usdPrice) {
    if (!usdPrice || usdPrice === 0) return null;
    return Math.round(usdPrice * USD_TO_INR);
  }

  /**
   * Get quality priority score (higher = better)
   */
  getQualityScore(format) {
    const idx = QUALITY_PRIORITY.indexOf(format?.toUpperCase());
    return idx >= 0 ? idx : 0;
  }

  /**
   * Filter and optimize sources - India only, best quality per platform
   */
  optimizeSources(sources) {
    // Filter for India region only
    const indiaSources = sources.filter(s => s.region === 'IN');
    
    // If no India sources, return empty (no fallback to other regions)
    if (indiaSources.length === 0) {
      // Fallback: check for US sources and convert prices
      const usSources = sources.filter(s => s.region === 'US');
      return this.dedupeByPlatform(usSources, true);
    }
    
    return this.dedupeByPlatform(indiaSources, false);
  }

  /**
   * Keep only the best quality option per platform+type combination
   */
  dedupeByPlatform(sources, convertPrices) {
    const platformMap = new Map();
    
    sources.forEach(source => {
      const key = `${source.name}-${source.type}`;
      const existing = platformMap.get(key);
      
      if (!existing || this.getQualityScore(source.format) > this.getQualityScore(existing.format)) {
        // Convert price to INR if needed
        let priceINR = source.price;
        if (convertPrices && source.price) {
          priceINR = this.convertToINR(source.price);
        }
        
        platformMap.set(key, {
          ...source,
          price: priceINR,
          region: 'IN' // Normalize to IN for display
        });
      }
    });
    
    return Array.from(platformMap.values());
  }

  /**
   * Get streaming sources for a movie by IMDB ID
   * @param {string} imdbId - IMDB ID (e.g., 'tt1375666')
   * @returns {Promise<Array>} - List of streaming sources
   */
  async getStreamingSources(imdbId) {
    if (!WATCHMODE_KEY || !imdbId) {
      return [];
    }

    try {
      // First, get the Watchmode title ID from IMDB ID
      const searchResponse = await this.client.get('/search/', {
        params: {
          apiKey: WATCHMODE_KEY,
          search_field: 'imdb_id',
          search_value: imdbId
        }
      });

      if (!searchResponse.data?.title_results?.length) {
        console.log(`No Watchmode results for IMDB: ${imdbId}`);
        return [];
      }

      const watchmodeId = searchResponse.data.title_results[0].id;

      // Get streaming sources
      const sourcesResponse = await this.client.get(`/title/${watchmodeId}/sources/`, {
        params: {
          apiKey: WATCHMODE_KEY
        }
      });

      if (!sourcesResponse.data || !Array.isArray(sourcesResponse.data)) {
        return [];
      }

      // Transform to our format
      const allSources = sourcesResponse.data.map(source => ({
        name: source.name || source.source_name || 'Unknown',
        type: source.type || 'subscription',
        region: source.region || 'US',
        webUrl: source.web_url || null,
        format: source.format || 'HD',
        price: source.price || null
      }));

      // Optimize: India only, best quality per platform
      return this.optimizeSources(allSources);
    } catch (error) {
      console.error(`Watchmode error for ${imdbId}:`, error.message);
      return [];
    }
  }

  /**
   * Get all available streaming platforms
   * @returns {Promise<Array>} - List of streaming platforms
   */
  async getAvailablePlatforms() {
    if (!WATCHMODE_KEY) {
      return [];
    }

    try {
      const response = await this.client.get('/sources/', {
        params: {
          apiKey: WATCHMODE_KEY
        }
      });

      return response.data || [];
    } catch (error) {
      console.error('Failed to get platforms:', error.message);
      return [];
    }
  }
}

module.exports = new WatchmodeService();
