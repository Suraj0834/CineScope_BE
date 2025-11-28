const axios = require('axios');

const OMDB_BASE_URL = 'http://www.omdbapi.com/';
const OMDB_API_KEY = process.env.OMDB_API_KEY;

const getMovieDetails = async (imdbId) => {
    if (!imdbId) return null;

    try {
        const response = await axios.get(OMDB_BASE_URL, {
            params: {
                apikey: OMDB_API_KEY,
                i: imdbId,
                plot: 'full'
            },
            timeout: 5000
        });

        if (response.data.Response === 'False') {
            console.warn(`OMDb Error for ${imdbId}: ${response.data.Error}`);
            return null;
        }

        return response.data;
    } catch (error) {
        console.error(`OMDb Request Error (${imdbId}):`, error.message);
        return null;
    }
};

module.exports = {
    getMovieDetails
};
