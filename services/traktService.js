const axios = require('axios');

const TRAKT_BASE_URL = 'https://api.trakt.tv';
const TRAKT_CLIENT_ID = process.env.TRAKT_CLIENT_ID;

const traktClient = axios.create({
    baseURL: TRAKT_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
        'trakt-api-version': '2',
        'trakt-api-key': TRAKT_CLIENT_ID
    },
    timeout: 10000 // 10 seconds timeout
});

const getTrendingMovies = async (page = 1, limit = 20) => {
    try {
        const response = await traktClient.get('/movies/trending', {
            params: { page, limit, extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error('Trakt Trending Error:', error.message);
        return [];
    }
};

const getPopularMovies = async (page = 1, limit = 20) => {
    try {
        const response = await traktClient.get('/movies/popular', {
            params: { page, limit, extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error('Trakt Popular Error:', error.message);
        return [];
    }
};

const searchMovies = async (query, page = 1, limit = 20) => {
    try {
        const response = await traktClient.get('/search/movie', {
            params: { query, page, limit, extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error('Trakt Search Error:', error.message);
        return [];
    }
};

const getMovieSummary = async (traktId) => {
    try {
        const response = await traktClient.get(`/movies/${traktId}`, {
            params: { extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error(`Trakt Summary Error (${traktId}):`, error.message);
        return null;
    }
};

const getMoviePeople = async (traktId) => {
    try {
        const response = await traktClient.get(`/movies/${traktId}/people`);
        return response.data;
    } catch (error) {
        console.error(`Trakt People Error (${traktId}):`, error.message);
        return null;
    }
};

const getRelatedMovies = async (traktId) => {
    try {
        const response = await traktClient.get(`/movies/${traktId}/related`, {
            params: { limit: 10, extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error(`Trakt Related Error (${traktId}):`, error.message);
        return [];
    }
};

const getPersonSummary = async (traktId) => {
    try {
        const response = await traktClient.get(`/people/${traktId}`, {
            params: { extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error(`Trakt Person Summary Error (${traktId}):`, error.message);
        return null;
    }
};

const getPersonMovies = async (traktId) => {
    try {
        const response = await traktClient.get(`/people/${traktId}/movies`, {
            params: { extended: 'full' }
        });
        return response.data;
    } catch (error) {
        console.error(`Trakt Person Movies Error (${traktId}):`, error.message);
        return null;
    }
};

module.exports = {
    getTrendingMovies,
    getPopularMovies,
    searchMovies,
    getMovieSummary,
    getMoviePeople,
    getRelatedMovies,
    getPersonSummary,
    getPersonMovies
};
