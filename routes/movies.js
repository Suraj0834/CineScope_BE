const express = require('express');
const router = express.Router();
const traktService = require('../services/trakt');
const omdbService = require('../services/omdb');
const watchmodeService = require('../services/watchmode');
const axios = require('axios');

/**
 * Get actor image from Wikipedia/Wikimedia Commons API (free, no API key needed)
 * Used for cast photos in movie details
 */
async function getActorImageFromWikipedia(personName) {
    if (!personName) return null;
    
    try {
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(personName.replace(/ /g, '_'))}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 3000, // Short timeout for cast images
            headers: {
                'User-Agent': 'CineScope/1.0 (Movie App)'
            }
        });
        
        if (response.data?.thumbnail?.source) {
            let imageUrl = response.data.thumbnail.source;
            imageUrl = imageUrl.replace(/\/\d+px-/, '/200px-');
            return imageUrl;
        }
        
        if (response.data?.originalimage?.source) {
            return response.data.originalimage.source;
        }
    } catch (error) {
        // Silently fail for individual cast members
    }
    
    // Fallback to styled avatar
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(personName)}&size=200&background=1a1a2e&color=e94560&bold=true`;
}

// Helper to enrich Trakt movies with OMDb data (Posters, Ratings)
const enrichWithOmdb = async (traktMovies) => {
  const promises = traktMovies.map(async (item) => {
    const movie = item.movie || item; // Handle 'trending' structure vs 'popular' structure
    const imdbId = movie.ids?.imdb || movie.imdbId;

    let omdbData = null;
    if (imdbId) {
      try {
        omdbData = await omdbService.getMovieByImdbId(imdbId);
      } catch (error) {
        console.log(`OMDb lookup failed for ${imdbId}: ${error.message}`);
      }
    }

    return {
      imdbId: imdbId || `trakt-${movie.ids?.trakt || movie.traktId}`, // Primary identifier
      tmdbId: movie.ids?.tmdb || movie.tmdbId, // TMDB ID if available
      traktId: movie.ids?.trakt || movie.traktId, // Trakt ID
      title: movie.title,
      originalTitle: movie.title,
      overview: omdbData?.plot || movie.overview,
      releaseDate: movie.released,
      year: movie.year?.toString() || movie.released?.substring(0, 4),
      posterPath: omdbData?.poster !== 'N/A' ? omdbData?.poster : null, // Full URL
      backdropPath: null, // OMDb/Trakt don't provide backdrops easily
      voteAverage: parseFloat(omdbData?.imdbRating) || movie.rating || 0,
      voteCount: parseInt(omdbData?.imdbVotes?.replace(/,/g, '')) || movie.votes || 0,
      popularity: (movie.rating || 0) * 10,
      genre: movie.genres?.join(', ') || omdbData?.genre || '',
      genreIds: [], // Genres are strings in Trakt, skipping ID mapping for now
      runtime: movie.runtime,
      imdbRating: parseFloat(omdbData?.imdbRating) || null
    };
  });

  return Promise.all(promises);
};

/**
 * @route   GET /api/movies/omdb-status
 * @desc    Get OMDb API key rotation status (for debugging)
 * @access  Public
 */
router.get('/omdb-status', (req, res) => {
  try {
    const status = omdbService.getOmdbStatus();
    res.json({
      success: true,
      message: 'OMDb API status',
      data: status
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to get OMDb status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/movies/trending
 * @desc    Get trending movies from Trakt + OMDb
 * @access  Public
 */
router.get('/trending', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const traktData = await traktService.getTrendingMovies(pageNum, limitNum);
    const movies = await enrichWithOmdb(traktData);

    // Trakt supports infinite scrolling - set high total pages to allow continuous loading
    // Only mark as last page if we got fewer results than requested
    const hasMore = movies.length >= limitNum;
    
    res.json({
      success: true,
      message: 'Trending movies fetched successfully (Trakt+OMDb)',
      data: {
        page: pageNum,
        totalPages: hasMore ? pageNum + 10 : pageNum, // Allow more pages if we have results
        totalResults: hasMore ? (pageNum + 10) * limitNum : pageNum * movies.length,
        hasMore: hasMore,
        movies: movies
      }
    });
  } catch (error) {
    console.error('Trending error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch trending movies' });
  }
});

/**
 * @route   GET /api/movies/popular
 * @desc    Get popular movies from Trakt + OMDb
 * @access  Public
 */
router.get('/popular', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const traktData = await traktService.getPopularMovies(pageNum, limitNum);
    const movies = await enrichWithOmdb(traktData);

    const hasMore = movies.length >= limitNum;
    
    res.json({
      success: true,
      message: 'Popular movies fetched successfully (Trakt+OMDb)',
      data: {
        page: pageNum,
        totalPages: hasMore ? pageNum + 10 : pageNum,
        totalResults: hasMore ? (pageNum + 10) * limitNum : pageNum * movies.length,
        hasMore: hasMore,
        movies: movies
      }
    });
  } catch (error) {
    console.error('Popular error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch popular movies' });
  }
});

/**
 * @route   GET /api/movies/search
 * @desc    Search movies via Trakt + OMDb
 * @access  Public
 */
router.get('/search', async (req, res) => {
  try {
    // Accept both 'q' and 'query' parameters for compatibility
    const { q, query, page = 1, limit = 20 } = req.query;
    const searchQuery = q || query;
    if (!searchQuery) return res.status(400).json({ success: false, message: 'Query required' });

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    
    const traktData = await traktService.searchMovies(searchQuery, pageNum, limitNum);
    const movies = await enrichWithOmdb(traktData);

    const hasMore = movies.length >= limitNum;

    res.json({
      success: true,
      message: 'Search results fetched successfully',
      data: {
        query: searchQuery,
        page: pageNum,
        totalPages: hasMore ? pageNum + 5 : pageNum,
        totalResults: hasMore ? (pageNum + 5) * limitNum : pageNum * movies.length,
        hasMore: hasMore,
        movies: movies
      }
    });
  } catch (error) {
    console.error('Search error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to search movies' });
  }
});

/**
 * @route   GET /api/movies/top-rated
 * @desc    Get top rated movies from Trakt + OMDb
 * @access  Public
 */
router.get('/top-rated', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // Use popular movies sorted by rating
    const traktData = await traktService.getPopularMovies(pageNum, limitNum);
    const movies = await enrichWithOmdb(traktData);

    // Sort by rating (voteAverage)
    const sortedMovies = movies.sort((a, b) => b.voteAverage - a.voteAverage);

    const hasMore = movies.length >= limitNum;

    res.json({
      success: true,
      message: 'Top rated movies fetched successfully',
      data: {
        page: pageNum,
        totalPages: hasMore ? pageNum + 10 : pageNum,
        totalResults: hasMore ? (pageNum + 10) * limitNum : pageNum * movies.length,
        hasMore: hasMore,
        movies: sortedMovies
      }
    });
  } catch (error) {
    console.error('Top rated error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch top rated movies' });
  }
});

/**
 * @route   GET /api/movies/genres
 * @desc    Get all movie genres
 * @access  Public
 */
router.get('/genres', async (req, res) => {
  try {
    // Return common movie genres
    const genres = [
      { id: 1, name: 'Action' },
      { id: 2, name: 'Adventure' },
      { id: 3, name: 'Animation' },
      { id: 4, name: 'Comedy' },
      { id: 5, name: 'Crime' },
      { id: 6, name: 'Documentary' },
      { id: 7, name: 'Drama' },
      { id: 8, name: 'Family' },
      { id: 9, name: 'Fantasy' },
      { id: 10, name: 'History' },
      { id: 11, name: 'Horror' },
      { id: 12, name: 'Music' },
      { id: 13, name: 'Mystery' },
      { id: 14, name: 'Romance' },
      { id: 15, name: 'Science Fiction' },
      { id: 16, name: 'Thriller' },
      { id: 17, name: 'War' },
      { id: 18, name: 'Western' }
    ];

    res.json({
      success: true,
      message: 'Genres fetched successfully',
      data: { genres }
    });
  } catch (error) {
    console.error('Genres error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to fetch genres' });
  }
});

/**
 * @route   GET /api/movies/discover
 * @desc    Discover movies with filters
 * @access  Public
 */
router.get('/discover', async (req, res) => {
  try {
    const { page = 1, limit = 20, genre, year, sortBy = 'popularity.desc' } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);

    // For now, use popular movies as base
    // TODO: Implement genre/year filtering when Trakt service supports it
    const traktData = await traktService.getPopularMovies(pageNum, limitNum);
    let movies = await enrichWithOmdb(traktData);

    // Filter by genre if provided
    if (genre) {
      const genreLower = genre.toLowerCase();
      movies = movies.filter(movie =>
        movie.genre && movie.genre.toLowerCase().includes(genreLower)
      );
    }

    // Filter by year if provided
    if (year) {
      movies = movies.filter(movie => movie.year === year.toString());
    }

    // Sort based on sortBy parameter
    if (sortBy === 'vote_average.desc') {
      movies.sort((a, b) => b.voteAverage - a.voteAverage);
    } else if (sortBy === 'release_date.desc') {
      movies.sort((a, b) => new Date(b.releaseDate) - new Date(a.releaseDate));
    }
    // Default is popularity.desc (already sorted from API)

    const hasMore = movies.length >= limitNum;

    res.json({
      success: true,
      message: 'Movies discovered successfully',
      data: {
        page: pageNum,
        totalPages: hasMore ? pageNum + 10 : pageNum,
        totalResults: hasMore ? (pageNum + 10) * limitNum : pageNum * movies.length,
        hasMore: hasMore,
        movies: movies
      }
    });
  } catch (error) {
    console.error('Discover error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to discover movies' });
  }
});

/**
 * @route   GET /api/movies/:id
 * @desc    Get movie details by Trakt ID or IMDB ID (enhanced with OMDb)
 * @access  Public
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Determine if ID is IMDB (starts with 'tt') or Trakt (number)
    const isImdbId = id.startsWith('tt');
    
    let traktMovie;
    
    if (isImdbId) {
      // Search for movie by IMDB ID first to get Trakt ID
      try {
        const searchResults = await traktService.searchByImdbId(id);
        if (!searchResults || searchResults.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'Movie not found'
          });
        }
        const traktId = searchResults[0].movie?.ids?.trakt;
        if (!traktId) {
          return res.status(404).json({
            success: false,
            message: 'Movie not found in Trakt'
          });
        }
        traktMovie = await traktService.getMovieDetails(traktId);
      } catch (error) {
        console.log('IMDB search failed, trying direct OMDb lookup');
        // Fallback: Just use OMDb data
        const omdbData = await omdbService.getMovieByImdbId(id);
        if (!omdbData || omdbData.Response === 'False') {
          return res.status(404).json({
            success: false,
            message: 'Movie not found'
          });
        }
        
        // Return OMDb-only data
        const movieData = {
          tmdbId: null,
          imdbId: id,
          title: omdbData.Title,
          originalTitle: omdbData.Title,
          tagline: '',
          overview: omdbData.Plot,
          releaseDate: omdbData.Released,
          runtime: parseInt(omdbData.Runtime) || 0,
          status: 'Released',
          posterPath: omdbData.Poster !== 'N/A' ? omdbData.Poster : null,
          backdropPath: null,
          voteAverage: parseFloat(omdbData.imdbRating) || 0,
          voteCount: parseInt(omdbData.imdbVotes?.replace(/,/g, '')) || 0,
          popularity: 0,
          adult: false,
          budget: 0,
          revenue: 0,
          homepage: '',
          genres: omdbData.Genre ? omdbData.Genre.split(', ').map(g => ({ id: 0, name: g })) : [],
          productionCompanies: [],
          productionCountries: [],
          spokenLanguages: [],
          credits: { cast: [], crew: [] },
          videos: [],
          similar: [],
          recommendations: [],
          watchProviders: {},
          watchmodeSources: []
        };

        // Get Watchmode sources for OMDb-only response
        try {
          const sources = await watchmodeService.getStreamingSources(id);
          movieData.watchmodeSources = sources;
        } catch (error) {
          console.log('Watchmode lookup failed:', error.message);
        }

        return res.json({
          success: true,
          message: 'Movie details fetched successfully (OMDb only)',
          data: movieData
        });
      }
    } else {
      // Validate Trakt ID
      if (isNaN(id)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid ID format'
        });
      }
      
      // Get Trakt movie details directly
      traktMovie = await traktService.getMovieDetails(id);
    }

    // 2. Get OMDb enhanced data
    let omdbData = null;
    if (traktMovie.imdbId) {
      try {
        omdbData = await omdbService.getEnhancedMovieData(traktMovie);
      } catch (error) {
        console.log(`OMDb enhancement failed for ${traktMovie.imdbId}: ${error.message}`);
      }
    }

    // 3. Get cast and crew from Trakt (use traktId from the movie object)
    const people = await traktService.getMoviePeople(traktMovie.traktId);

    // Construct comprehensive movie data
    const movieData = {
      tmdbId: traktMovie.traktId, // Using Trakt ID as main ID
      imdbId: traktMovie.imdbId,
      title: traktMovie.title,
      originalTitle: traktMovie.title,
      tagline: traktMovie.tagline || '',
      overview: omdbData?.plot || traktMovie.overview,
      releaseDate: traktMovie.released,
      runtime: traktMovie.runtime,
      status: traktMovie.status || 'Released',
      posterPath: omdbData?.poster || null,
      backdropPath: null, // Trakt/OMDb don't provide backdrops easily
      voteAverage: omdbData?.imdbRating ? parseFloat(omdbData.imdbRating) : (traktMovie.rating || 0),
      voteCount: omdbData?.imdbVotes ? parseInt(omdbData.imdbVotes.replace(/,/g, '')) : (traktMovie.votes || 0),
      popularity: (traktMovie.rating || 0) * 10,
      adult: false,
      budget: 0, // Not available in Trakt/OMDb
      revenue: 0, // Not available in Trakt/OMDb
      homepage: traktMovie.homepage || '',
      genres: traktMovie.genres ? traktMovie.genres.map(g => ({ id: 0, name: g })) : [],
      productionCompanies: [], // Not available in Trakt/OMDb
      productionCountries: [], // Not available in Trakt/OMDb
      spokenLanguages: [], // Not available in Trakt/OMDb

      // Credits (cast & crew) - will be enriched with Wikipedia images below
      credits: {
        cast: [],
        crew: people?.crew ? [
          ...(people.crew.directing || []).map(person => ({ ...person, department: 'Directing' })),
          ...(people.crew.writing || []).map(person => ({ ...person, department: 'Writing' })),
          ...(people.crew.producing || []).map(person => ({ ...person, department: 'Production' }))
        ] : []
      },

      // Videos (trailers) - Trakt provides trailer URLs
      videos: traktMovie.trailer ? [{
        id: 'trailer-1',
        key: traktMovie.trailer.split('v=')[1] || 'unknown', // Extract YouTube video ID
        name: 'Trailer',
        type: 'Trailer',
        site: 'YouTube',
        size: 1080,
        official: true
      }] : [],

      // Similar movies - will be populated below
      similar: [],
      recommendations: [],

      // Watch providers (not available in Trakt/OMDb free tier)
      watchProviders: {},

      // Watchmode streaming sources
      watchmodeSources: []
    };

    // Get Similar/Related movies from Trakt
    try {
      const relatedMovies = await traktService.getRelatedMovies(traktMovie.traktId);
      if (relatedMovies && relatedMovies.length > 0) {
        // Enrich with OMDb posters (limit to 10 for performance)
        const enrichedRelated = await Promise.all(
          relatedMovies.slice(0, 10).map(async (movie) => {
            let poster = null;
            if (movie.ids?.imdb) {
              try {
                const omdb = await omdbService.getMovieByImdbId(movie.ids.imdb);
                poster = omdb?.poster !== 'N/A' ? omdb?.poster : null;
              } catch (e) {}
            }
            return {
              id: movie.ids?.trakt,
              imdbId: movie.ids?.imdb,
              title: movie.title,
              posterPath: poster,
              releaseDate: movie.released,
              voteAverage: movie.rating || 0,
              overview: movie.overview?.substring(0, 200) || ''
            };
          })
        );
        movieData.similar = enrichedRelated;
        movieData.recommendations = enrichedRelated; // Use same for recommendations
      }
    } catch (error) {
      console.log('Related movies fetch failed:', error.message);
    }

    // Get Watchmode streaming sources (async, don't block main response)
    if (traktMovie.imdbId) {
      try {
        const sources = await watchmodeService.getStreamingSources(traktMovie.imdbId);
        movieData.watchmodeSources = sources;
      } catch (error) {
        console.log('Watchmode lookup failed:', error.message);
      }
    }

    // Enrich cast with Wikipedia images
    if (people?.cast && people.cast.length > 0) {
      try {
        const enrichedCast = await Promise.all(
          people.cast.slice(0, 15).map(async (person, index) => {
            // person.name is the actor name (already mapped in trakt service)
            const actorName = person.name || 'Unknown';
            const profilePath = await getActorImageFromWikipedia(actorName);
            return {
              id: person.traktId || 0,
              name: actorName,
              character: person.character || '',
              profilePath: profilePath,
              order: index,
              knownForDepartment: 'Acting'
            };
          })
        );
        movieData.credits.cast = enrichedCast;
        console.log(`Enriched ${enrichedCast.length} cast members with Wikipedia images`);
      } catch (error) {
        console.log('Cast enrichment failed:', error.message);
      }
    }

    res.json({
      success: true,
      message: 'Movie details fetched successfully (Trakt+OMDb)',
      data: movieData
    });
  } catch (error) {
    console.error('Movie details error:', error.message);

    if (error.message.includes('not found') || error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch movie details',
      error: error.message
    });
  }
});

module.exports = router;
