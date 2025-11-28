const express = require('express');
const router = express.Router();
const traktService = require('../services/traktService');
const omdbService = require('../services/omdb');
const axios = require('axios');

/**
 * Get actor image from Wikipedia/Wikimedia Commons API (free, no API key needed)
 */
async function getActorImageFromWikipedia(personName) {
    if (!personName) return null;
    
    try {
        // Use Wikipedia API to get the main image for this person
        const searchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(personName.replace(/ /g, '_'))}`;
        
        const response = await axios.get(searchUrl, {
            timeout: 5000,
            headers: {
                'User-Agent': 'CineScope/1.0 (Movie App)'
            }
        });
        
        if (response.data?.thumbnail?.source) {
            // Get higher resolution by modifying the thumbnail URL
            let imageUrl = response.data.thumbnail.source;
            // Wikipedia thumbnails have size in URL, increase it
            imageUrl = imageUrl.replace(/\/\d+px-/, '/400px-');
            return imageUrl;
        }
        
        if (response.data?.originalimage?.source) {
            return response.data.originalimage.source;
        }
    } catch (error) {
        console.log(`Wikipedia image lookup failed for ${personName}:`, error.message);
    }
    
    // Final fallback: styled avatar with person's initials
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(personName)}&size=400&background=1a1a2e&color=e94560&bold=true&format=png`;
}

/**
 * @route   GET /api/person/search
 * @desc    Search for people (Not implemented in Trakt service yet, returning empty)
 * @access  Public
 */
router.get('/search', async (req, res) => {
    res.json({ success: true, data: { results: [] } });
});

/**
 * @route   GET /api/person/:personId
 * @desc    Get person details by ID (Trakt ID)
 * @access  Public
 */
router.get('/:personId', async (req, res) => {
    try {
        const { personId } = req.params;

        const person = await traktService.getPersonSummary(personId);
        if (!person) {
            return res.status(404).json({ success: false, message: 'Person not found' });
        }

        // Get real actor image from Wikipedia
        const profilePath = await getActorImageFromWikipedia(person.name);

        res.json({
            success: true,
            message: 'Person details fetched successfully',
            data: {
                id: person.ids.trakt,
                imdbId: person.ids?.imdb,
                name: person.name,
                biography: person.biography,
                birthday: person.birthday,
                deathday: person.deathday,
                placeOfBirth: person.birthplace,
                profilePath: profilePath,
                knownForDepartment: 'Acting',
                gender: 0,
                popularity: 0
            }
        });
    } catch (error) {
        console.error('Person details error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch person details',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/person/:personId/movies
 * @desc    Get person filmography (Trakt + OMDb for posters)
 * @access  Public
 */
router.get('/:personId/movies', async (req, res) => {
    try {
        const { personId } = req.params;

        const credits = await traktService.getPersonMovies(personId);

        // Map cast movies with OMDb poster enrichment
        const castMoviesPromises = (credits?.cast || []).slice(0, 20).map(async (item) => {
            const imdbId = item.movie?.ids?.imdb;
            let posterPath = null;
            
            // Get poster from OMDb if we have IMDB ID
            if (imdbId) {
                try {
                    const omdbData = await omdbService.getMovieByImdbId(imdbId);
                    if (omdbData?.poster && omdbData.poster !== 'N/A') {
                        posterPath = omdbData.poster;
                    }
                } catch (e) {
                    // Ignore OMDb errors
                }
            }
            
            return {
                id: item.movie?.ids?.trakt,
                imdbId: imdbId || `trakt-${item.movie?.ids?.trakt}`,
                traktId: item.movie?.ids?.trakt,
                title: item.movie?.title,
                character: item.character,
                posterPath: posterPath,
                releaseDate: item.movie?.released,
                year: item.movie?.year,
                voteAverage: item.movie?.rating || 0
            };
        });

        const castMovies = await Promise.all(castMoviesPromises);

        // Map crew movies (without poster enrichment for speed)
        const crewMovies = (credits?.crew?.production || []).slice(0, 10).map(item => ({
            id: item.movie?.ids?.trakt,
            imdbId: item.movie?.ids?.imdb || `trakt-${item.movie?.ids?.trakt}`,
            traktId: item.movie?.ids?.trakt,
            title: item.movie?.title,
            job: 'Producer',
            posterPath: null,
            releaseDate: item.movie?.released,
            year: item.movie?.year,
            voteAverage: item.movie?.rating || 0
        }));

        res.json({
            success: true,
            message: 'Filmography fetched successfully',
            data: {
                cast: castMovies.filter(m => m.title), // Filter out any nulls
                crew: crewMovies.filter(m => m.title)
            }
        });
    } catch (error) {
        console.error('Filmography error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch filmography',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/person/:personId/images
 * @desc    Get person images (Stub)
 * @access  Public
 */
router.get('/:personId/images', async (req, res) => {
    res.json({ success: true, data: { profiles: [] } });
});

/**
 * @route   GET /api/person/popular/list
 * @desc    Get popular people (Stub)
 * @access  Public
 */
router.get('/popular/list', async (req, res) => {
    res.json({ success: true, data: { results: [] } });
});

module.exports = router;
