const axios = require('axios');
require('dotenv').config();

// Trakt.tv API configuration
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;
const TRAKT_CLIENT_SECRET = process.env.TRAKT_CLIENT_SECRET;
const TRAKT_BASE_URL = process.env.TRAKT_BASE_URL || 'https://api.trakt.tv';

/**
 * Helper function to make Trakt.tv API requests
 */
async function traktRequest(endpoint, params = {}, method = 'GET') {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'trakt-api-version': '2',
      'trakt-api-key': TRAKT_CLIENT_ID
    };

    const config = {
      method,
      url: `${TRAKT_BASE_URL}${endpoint}`,
      headers,
      params
    };

    const response = await axios(config);
    return response.data;
  } catch (error) {
    throw error;
  }
}

/**
 * Get trending movies from Trakt.tv
 */
async function getTrendingMovies(page = 1, limit = 20) {
  try {
    const data = await traktRequest('/movies/trending', {
      page,
      limit,
      extended: 'full'
    });

    return data.map(item => ({
      traktId: item.movie.ids.trakt,
      tmdbId: item.movie.ids.tmdb,
      imdbId: item.movie.ids.imdb,
      title: item.movie.title,
      year: item.movie.year,
      overview: item.movie.overview,
      released: item.movie.released,
      runtime: item.movie.runtime,
      country: item.movie.country,
      trailer: item.movie.trailer,
      homepage: item.movie.homepage,
      status: item.movie.status,
      rating: item.movie.rating,
      votes: item.movie.votes,
      comment_count: item.movie.comment_count,
      updated_at: item.movie.updated_at,
      language: item.movie.language,
      languages: item.movie.languages,
      available_translations: item.movie.available_translations,
      genres: item.movie.genres,
      certification: item.movie.certification,
      watchers: item.watchers
    }));
  } catch (error) {
    throw new Error(`Failed to fetch trending movies: ${error.message}`);
  }
}

/**
 * Get popular movies from Trakt.tv
 */
async function getPopularMovies(page = 1, limit = 20) {
  try {
    const data = await traktRequest('/movies/popular', {
      page,
      limit,
      extended: 'full'
    });

    return data.map(movie => ({
      traktId: movie.ids.trakt,
      tmdbId: movie.ids.tmdb,
      imdbId: movie.ids.imdb,
      title: movie.title,
      year: movie.year,
      overview: movie.overview,
      released: movie.released,
      runtime: movie.runtime,
      country: movie.country,
      trailer: movie.trailer,
      homepage: movie.homepage,
      status: movie.status,
      rating: movie.rating,
      votes: movie.votes,
      comment_count: movie.comment_count,
      updated_at: movie.updated_at,
      language: movie.language,
      languages: movie.languages,
      available_translations: movie.available_translations,
      genres: movie.genres,
      certification: movie.certification
    }));
  } catch (error) {
    throw new Error(`Failed to fetch popular movies: ${error.message}`);
  }
}

/**
 * Search movies by query
 */
async function searchMovies(query, page = 1, limit = 20) {
  try {
    const data = await traktRequest('/search/movie', {
      query,
      page,
      limit,
      extended: 'full'
    });

    return data.map(item => ({
      traktId: item.movie.ids.trakt,
      tmdbId: item.movie.ids.tmdb,
      imdbId: item.movie.ids.imdb,
      title: item.movie.title,
      year: item.movie.year,
      overview: item.movie.overview,
      released: item.movie.released,
      runtime: item.movie.runtime,
      country: item.movie.country,
      trailer: item.movie.trailer,
      homepage: item.movie.homepage,
      status: item.movie.status,
      rating: item.movie.rating,
      votes: item.movie.votes,
      comment_count: item.movie.comment_count,
      updated_at: item.movie.updated_at,
      language: item.movie.language,
      languages: item.movie.languages,
      available_translations: item.movie.available_translations,
      genres: item.movie.genres,
      certification: item.movie.certification,
      score: item.score
    }));
  } catch (error) {
    throw new Error(`Failed to search movies: ${error.message}`);
  }
}

/**
 * Search by IMDB ID
 */
async function searchByImdbId(imdbId) {
  try {
    const data = await traktRequest('/search/imdb/' + imdbId, {
      type: 'movie',
      extended: 'full'
    });
    return data;
  } catch (error) {
    throw new Error(`Failed to search by IMDB ID: ${error.message}`);
  }
}

/**
 * Get movie details by Trakt ID
 */
async function getMovieDetails(traktId) {
  try {
    const data = await traktRequest(`/movies/${traktId}`, {}, 'GET');

    return {
      traktId: data.ids.trakt,
      tmdbId: data.ids.tmdb,
      imdbId: data.ids.imdb,
      title: data.title,
      year: data.year,
      overview: data.overview,
      released: data.released,
      runtime: data.runtime,
      country: data.country,
      trailer: data.trailer,
      homepage: data.homepage,
      status: data.status,
      rating: data.rating,
      votes: data.votes,
      comment_count: data.comment_count,
      updated_at: data.updated_at,
      language: data.language,
      languages: data.languages,
      available_translations: data.available_translations,
      genres: data.genres,
      certification: data.certification
    };
  } catch (error) {
    throw new Error(`Failed to fetch movie details: ${error.message}`);
  }
}

/**
 * Get related/similar movies
 */
async function getRelatedMovies(traktId) {
  try {
    const data = await traktRequest(`/movies/${traktId}/related`, {
      extended: 'full',
      limit: 10
    }, 'GET');
    return data || [];
  } catch (error) {
    console.error(`Failed to fetch related movies: ${error.message}`);
    return [];
  }
}

/**
 * Get movie cast and crew
 */
async function getMoviePeople(traktId) {
  try {
    const data = await traktRequest(`/movies/${traktId}/people`, {}, 'GET');

    return {
      cast: data.cast?.map(person => ({
        traktId: person.person.ids.trakt,
        tmdbId: person.person.ids.tmdb,
        imdbId: person.person.ids.imdb,
        name: person.person.name,
        biography: person.person.biography,
        birthday: person.person.birthday,
        death: person.person.death,
        birthplace: person.person.birthplace,
        homepage: person.person.homepage,
        character: person.character,
        characters: person.characters
      })) || [],
      crew: {
        directing: data.crew?.directing?.map(person => ({
          traktId: person.person.ids.trakt,
          tmdbId: person.person.ids.tmdb,
          imdbId: person.person.ids.imdb,
          name: person.person.name,
          job: person.job
        })) || [],
        writing: data.crew?.writing?.map(person => ({
          traktId: person.person.ids.trakt,
          tmdbId: person.person.ids.tmdb,
          imdbId: person.person.ids.imdb,
          name: person.person.name,
          job: person.job
        })) || [],
        producing: data.crew?.producing?.map(person => ({
          traktId: person.person.ids.trakt,
          tmdbId: person.person.ids.tmdb,
          imdbId: person.person.ids.imdb,
          name: person.person.name,
          job: person.job
        })) || []
      }
    };
  } catch (error) {
    throw new Error(`Failed to fetch movie people: ${error.message}`);
  }
}

/**
 * Search people by name
 */
async function searchPeople(query, page = 1, limit = 20) {
  try {
    const data = await traktRequest('/search/person', {
      query,
      page,
      limit,
      extended: 'full'
    });

    return data.map(item => ({
      traktId: item.person.ids.trakt,
      tmdbId: item.person.ids.tmdb,
      imdbId: item.person.ids.imdb,
      name: item.person.name,
      biography: item.person.biography,
      birthday: item.person.birthday,
      death: item.person.death,
      birthplace: item.person.birthplace,
      homepage: item.person.homepage,
      score: item.score
    }));
  } catch (error) {
    throw new Error(`Failed to search people: ${error.message}`);
  }
}

/**
 * Get person details by Trakt ID
 */
async function getPersonDetails(traktId) {
  try {
    const data = await traktRequest(`/people/${traktId}`, {}, 'GET');

    return {
      traktId: data.ids.trakt,
      tmdbId: data.ids.tmdb,
      imdbId: data.ids.imdb,
      name: data.name,
      biography: data.biography,
      birthday: data.birthday,
      death: data.death,
      birthplace: data.birthplace,
      homepage: data.homepage
    };
  } catch (error) {
    throw new Error(`Failed to fetch person details: ${error.message}`);
  }
}

/**
 * Get person's movie credits
 */
async function getPersonMovies(traktId) {
  try {
    const data = await traktRequest(`/people/${traktId}/movies`, {}, 'GET');

    const cast = data.cast?.map(movie => ({
      traktId: movie.movie.ids.trakt,
      tmdbId: movie.movie.ids.tmdb,
      imdbId: movie.movie.ids.imdb,
      title: movie.movie.title,
      year: movie.movie.year,
      character: movie.character,
      characters: movie.characters
    })) || [];

    const crew = [];
    if (data.crew) {
      Object.keys(data.crew).forEach(department => {
        data.crew[department]?.forEach(movie => {
          crew.push({
            traktId: movie.movie.ids.trakt,
            tmdbId: movie.movie.ids.tmdb,
            imdbId: movie.movie.ids.imdb,
            title: movie.movie.title,
            year: movie.movie.year,
            job: movie.job,
            department
          });
        });
      });
    }

    return { cast, crew };
  } catch (error) {
    throw new Error(`Failed to fetch person movies: ${error.message}`);
  }
}

module.exports = {
  getTrendingMovies,
  getPopularMovies,
  searchMovies,
  searchByImdbId,
  getMovieDetails,
  getMoviePeople,
  getRelatedMovies,
  searchPeople,
  getPersonDetails,
  getPersonMovies
};
