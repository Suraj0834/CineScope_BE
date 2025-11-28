const axios = require('axios');
require('dotenv').config();

// OMDb API configuration with circular key rotation
const OMDB_BASE_URL = process.env.OMDB_BASE_URL || 'http://www.omdbapi.com';

// Parse multiple API keys from comma-separated string
const OMDB_API_KEYS = (process.env.OMDB_API_KEYS || process.env.OMDB_API_KEY || '')
  .split(',')
  .map(key => key.trim())
  .filter(key => key && key !== 'YOUR_KEY_2' && key !== 'YOUR_KEY_3' && key !== 'YOUR_KEY_4');

// Track current key index and exhausted keys
let currentKeyIndex = 0;
const exhaustedKeys = new Set();

/**
 * Get the current active API key
 */
function getCurrentApiKey() {
  if (OMDB_API_KEYS.length === 0) {
    console.error('❌ No OMDb API keys configured!');
    return null;
  }
  
  // If all keys are exhausted, reset and try again (keys reset daily)
  if (exhaustedKeys.size >= OMDB_API_KEYS.length) {
    console.log('🔄 All OMDb API keys exhausted. Resetting for retry...');
    exhaustedKeys.clear();
    currentKeyIndex = 0;
  }
  
  // Find next non-exhausted key
  let attempts = 0;
  while (exhaustedKeys.has(currentKeyIndex) && attempts < OMDB_API_KEYS.length) {
    currentKeyIndex = (currentKeyIndex + 1) % OMDB_API_KEYS.length;
    attempts++;
  }
  
  return OMDB_API_KEYS[currentKeyIndex];
}

/**
 * Rotate to next API key
 */
function rotateToNextKey() {
  exhaustedKeys.add(currentKeyIndex);
  const oldKey = OMDB_API_KEYS[currentKeyIndex];
  currentKeyIndex = (currentKeyIndex + 1) % OMDB_API_KEYS.length;
  const newKey = OMDB_API_KEYS[currentKeyIndex];
  
  console.log(`🔄 OMDb API key rotated: ${oldKey.substring(0, 4)}**** → ${newKey.substring(0, 4)}****`);
  console.log(`   Keys status: ${OMDB_API_KEYS.length - exhaustedKeys.size}/${OMDB_API_KEYS.length} available`);
  
  return newKey;
}

/**
 * Helper function to make OMDb API requests with automatic key rotation
 */
async function omdbRequest(params = {}, retryCount = 0) {
  const apiKey = getCurrentApiKey();
  
  if (!apiKey) {
    throw new Error('No OMDb API keys available');
  }
  
  try {
    const response = await axios.get(OMDB_BASE_URL, {
      params: {
        apikey: apiKey,
        ...params
      },
      timeout: 5000
    });

    // Check for rate limit error
    if (response.data.Response === 'False') {
      const errorMsg = response.data.Error || 'OMDb API error';
      
      // If rate limit reached, rotate to next key and retry
      if (errorMsg.includes('Request limit reached') || errorMsg.includes('limit')) {
        if (retryCount < OMDB_API_KEYS.length) {
          console.log(`⚠️ OMDb key ${apiKey.substring(0, 4)}**** limit reached, rotating...`);
          rotateToNextKey();
          return omdbRequest(params, retryCount + 1);
        } else {
          throw new Error('All OMDb API keys have reached their request limit');
        }
      }
      
      throw new Error(errorMsg);
    }

    return response.data;
  } catch (error) {
    // Handle 401 errors (unauthorized - often means key is invalid or limit reached)
    if (error.response?.status === 401 || error.message?.includes('401')) {
      if (retryCount < OMDB_API_KEYS.length) {
        console.log(`⚠️ OMDb key ${apiKey.substring(0, 4)}**** returned 401, rotating...`);
        rotateToNextKey();
        return omdbRequest(params, retryCount + 1);
      }
    }
    throw error;
  }
}

/**
 * Get OMDb API status (for debugging)
 */
function getOmdbStatus() {
  return {
    totalKeys: OMDB_API_KEYS.length,
    currentKeyIndex,
    exhaustedCount: exhaustedKeys.size,
    availableKeys: OMDB_API_KEYS.length - exhaustedKeys.size,
    currentKey: OMDB_API_KEYS[currentKeyIndex]?.substring(0, 4) + '****'
  };
}

// Log initial status on startup
console.log(`✅ OMDb service initialized with ${OMDB_API_KEYS.length} API key(s)`);

/**
 * Get movie details by IMDB ID (preferred) or title
 */
async function getMovieByImdbId(imdbId) {
  try {
    const data = await omdbRequest({ i: imdbId, plot: 'full' });

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      rated: data.Rated,
      released: data.Released,
      runtime: data.Runtime,
      genre: data.Genre,
      director: data.Director,
      writer: data.Writer,
      actors: data.Actors,
      plot: data.Plot,
      language: data.Language,
      country: data.Country,
      awards: data.Awards,
      poster: data.Poster,
      ratings: data.Ratings?.map(rating => ({
        source: rating.Source,
        value: rating.Value
      })) || [],
      metascore: data.Metascore,
      imdbRating: data.imdbRating,
      imdbVotes: data.imdbVotes,
      type: data.Type,
      dvd: data.DVD,
      boxOffice: data.BoxOffice,
      production: data.Production,
      website: data.Website
    };
  } catch (error) {
    throw new Error(`Failed to fetch movie by IMDB ID: ${error.message}`);
  }
}

/**
 * Get movie details by title (fallback method)
 */
async function getMovieByTitle(title, year = null) {
  try {
    const params = { t: title, plot: 'full' };
    if (year) params.y = year;

    const data = await omdbRequest(params);

    return {
      imdbId: data.imdbID,
      title: data.Title,
      year: data.Year,
      rated: data.Rated,
      released: data.Released,
      runtime: data.Runtime,
      genre: data.Genre,
      director: data.Director,
      writer: data.Writer,
      actors: data.Actors,
      plot: data.Plot,
      language: data.Language,
      country: data.Country,
      awards: data.Awards,
      poster: data.Poster,
      ratings: data.Ratings?.map(rating => ({
        source: rating.Source,
        value: rating.Value
      })) || [],
      metascore: data.Metascore,
      imdbRating: data.imdbRating,
      imdbVotes: data.imdbVotes,
      type: data.Type,
      dvd: data.DVD,
      boxOffice: data.BoxOffice,
      production: data.Production,
      website: data.Website
    };
  } catch (error) {
    throw new Error(`Failed to fetch movie by title: ${error.message}`);
  }
}

/**
 * Search movies by title
 */
async function searchMovies(query, page = 1) {
  try {
    const data = await omdbRequest({ s: query, page });

    return {
      search: data.Search?.map(movie => ({
        imdbId: movie.imdbID,
        title: movie.Title,
        year: movie.Year,
        type: movie.Type,
        poster: movie.Poster
      })) || [],
      totalResults: parseInt(data.totalResults) || 0,
      response: data.Response
    };
  } catch (error) {
    throw new Error(`Failed to search movies: ${error.message}`);
  }
}

/**
 * Get series/season/episode details
 */
async function getSeriesDetails(imdbId, season = null, episode = null) {
  try {
    const params = { i: imdbId };
    if (season) params.season = season;
    if (episode) params.episode = episode;

    const data = await omdbRequest(params);

    if (episode) {
      // Episode details
      return {
        imdbId: data.imdbID,
        title: data.Title,
        year: data.Year,
        rated: data.Rated,
        released: data.Released,
        season: data.Season,
        episode: data.Episode,
        runtime: data.Runtime,
        genre: data.Genre,
        director: data.Director,
        writer: data.Writer,
        actors: data.Actors,
        plot: data.Plot,
        language: data.Language,
        country: data.Country,
        awards: data.Awards,
        poster: data.Poster,
        ratings: data.Ratings?.map(rating => ({
          source: rating.Source,
          value: rating.Value
        })) || [],
        metascore: data.Metascore,
        imdbRating: data.imdbRating,
        imdbVotes: data.imdbVotes,
        seriesId: data.seriesID,
        type: data.Type
      };
    } else if (season) {
      // Season details
      return {
        title: data.Title,
        season: data.Season,
        totalSeasons: data.totalSeasons,
        episodes: data.Episodes?.map(ep => ({
          title: ep.Title,
          released: ep.Released,
          episode: ep.Episode,
          imdbRating: ep.imdbRating,
          imdbId: ep.imdbID
        })) || [],
        response: data.Response
      };
    } else {
      // Series details
      return {
        imdbId: data.imdbID,
        title: data.Title,
        year: data.Year,
        rated: data.Rated,
        released: data.Released,
        runtime: data.Runtime,
        genre: data.Genre,
        director: data.Director,
        writer: data.Writer,
        actors: data.Actors,
        plot: data.Plot,
        language: data.Language,
        country: data.Country,
        awards: data.Awards,
        poster: data.Poster,
        ratings: data.Ratings?.map(rating => ({
          source: rating.Source,
          value: rating.Value
        })) || [],
        metascore: data.Metascore,
        imdbRating: data.imdbRating,
        imdbVotes: data.imdbVotes,
        type: data.Type,
        totalSeasons: data.totalSeasons,
        response: data.Response
      };
    }
  } catch (error) {
    throw new Error(`Failed to fetch series details: ${error.message}`);
  }
}

/**
 * Get enhanced movie data by combining Trakt and OMDb
 * This is the main function that provides TMDB-like functionality
 */
async function getEnhancedMovieData(traktMovieData) {
  try {
    let omdbData = null;

    // Try to get data by IMDB ID first (most reliable)
    if (traktMovieData.imdbId) {
      try {
        omdbData = await getMovieByImdbId(traktMovieData.imdbId);
      } catch (error) {
        console.log(`OMDb lookup by IMDB ID failed: ${error.message}`);
      }
    }

    // Fallback to title search if IMDB ID lookup failed
    if (!omdbData && traktMovieData.title) {
      try {
        omdbData = await getMovieByTitle(traktMovieData.title, traktMovieData.year);
      } catch (error) {
        console.log(`OMDb lookup by title failed: ${error.message}`);
      }
    }

    // Combine Trakt and OMDb data
    const enhancedData = {
      ...traktMovieData,
      // Use OMDb poster if available and Trakt doesn't have one
      poster: traktMovieData.poster || omdbData?.poster || null,
      // Use OMDb ratings if available
      ratings: omdbData?.ratings || [],
      // Use OMDb plot if Trakt plot is missing or shorter
      plot: (omdbData?.plot && (!traktMovieData.overview || traktMovieData.overview.length < omdbData.plot.length))
        ? omdbData.plot
        : traktMovieData.overview,
      // Additional OMDb fields
      rated: omdbData?.rated || null,
      boxOffice: omdbData?.boxOffice || null,
      production: omdbData?.production || null,
      website: omdbData?.website || null,
      awards: omdbData?.awards || null,
      metascore: omdbData?.metascore || null,
      // Enhanced ratings
      imdbRating: omdbData?.imdbRating || null,
      imdbVotes: omdbData?.imdbVotes || null,
      rottenTomatoesRating: omdbData?.ratings?.find(r => r.source === 'Rotten Tomatoes')?.value || null,
      metacriticRating: omdbData?.ratings?.find(r => r.source === 'Metacritic')?.value || null
    };

    return enhancedData;
  } catch (error) {
    console.log(`Failed to enhance movie data: ${error.message}`);
    return traktMovieData; // Return original data if enhancement fails
  }
}

module.exports = {
  getMovieByImdbId,
  getMovieByTitle,
  searchMovies,
  getSeriesDetails,
  getEnhancedMovieData,
  getOmdbStatus
};
