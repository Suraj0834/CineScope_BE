const express = require('express');
const router = express.Router();
const authenticateToken = require('../middleware/auth');
const User = require('../models/User');

/**
 * @route   GET /api/profile
 * @desc    Get user profile information
 * @access  Private (JWT required)
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile fetched successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          watchlistCount: user.watchlist.length,
          favoritesCount: user.favorites.length,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/profile
 * @desc    Update user profile information
 * @access  Private (JWT required)
 */
router.put('/', authenticateToken, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name || name.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Name is required'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.name = name.trim();
    await user.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email
        }
      }
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/profile/watchlist
 * @desc    Get user's watchlist
 * @access  Private (JWT required)
 */
router.get('/watchlist', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('watchlist');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort by most recently added
    const sortedWatchlist = user.watchlist.sort((a, b) => b.addedAt - a.addedAt);

    res.json({
      success: true,
      message: 'Watchlist fetched successfully',
      data: {
        watchlist: sortedWatchlist,
        count: sortedWatchlist.length
      }
    });
  } catch (error) {
    console.error('Get watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch watchlist',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/profile/watchlist
 * @desc    Add movie to watchlist (Android compatible)
 * @access  Private (JWT required)
 */
router.post('/watchlist', authenticateToken, async (req, res) => {
  try {
    const { imdbId, title, posterPath } = req.body;

    if (!imdbId) {
      return res.status(400).json({
        success: false,
        message: 'imdbId is required'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already in watchlist (search by imdbId)
    const existingItem = user.watchlist.find(item => item.imdbId === imdbId);
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Movie already in watchlist'
      });
    }

    // Add to watchlist with imdbId
    user.watchlist.push({
      imdbId,
      tmdbId: null, // Will be populated if available
      title: title || '',
      posterPath: posterPath || '',
      addedAt: new Date()
    });

    await user.save();

    res.json({
      success: true,
      message: 'Movie added to watchlist',
      data: {
        imdbId,
        watchlistCount: user.watchlist.length
      }
    });
  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to watchlist',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/profile/watchlist/:imdbId
 * @desc    Remove movie from watchlist (Android compatible)
 * @access  Private (JWT required)
 */
router.delete('/watchlist/:imdbId', authenticateToken, async (req, res) => {
  try {
    const { imdbId } = req.params;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if movie exists in watchlist
    const existingItem = user.watchlist.find(item => item.imdbId === imdbId);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found in watchlist'
      });
    }

    // Remove from watchlist
    user.watchlist = user.watchlist.filter(item => item.imdbId !== imdbId);
    await user.save();

    res.json({
      success: true,
      message: 'Movie removed from watchlist',
      data: {
        imdbId,
        watchlistCount: user.watchlist.length
      }
    });
  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from watchlist',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/profile/watchlist
 * @desc    Add or remove movie from watchlist (Legacy - supports tmdbId)
 * @access  Private (JWT required)
 */
router.put('/watchlist', authenticateToken, async (req, res) => {
  try {
    const { tmdbId, action, title, posterPath } = req.body;

    // Validate input
    if (!tmdbId || !action) {
      return res.status(400).json({
        success: false,
        message: 'tmdbId and action (add/remove) are required'
      });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "add" or "remove"'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (action === 'add') {
      // Check if already in watchlist
      if (user.isInWatchlist(tmdbId)) {
        return res.status(400).json({
          success: false,
          message: 'Movie already in watchlist'
        });
      }

      // Add to watchlist
      user.watchlist.push({
        tmdbId,
        title: title || '',
        posterPath: posterPath || '',
        addedAt: new Date()
      });

      await user.save();

      return res.json({
        success: true,
        message: 'Movie added to watchlist',
        data: {
          tmdbId,
          watchlistCount: user.watchlist.length
        }
      });
    }

    if (action === 'remove') {
      // Check if movie exists in watchlist
      if (!user.isInWatchlist(tmdbId)) {
        return res.status(400).json({
          success: false,
          message: 'Movie not found in watchlist'
        });
      }

      // Remove from watchlist
      user.watchlist = user.watchlist.filter(item => item.tmdbId !== tmdbId);
      await user.save();

      return res.json({
        success: true,
        message: 'Movie removed from watchlist',
        data: {
          tmdbId,
          watchlistCount: user.watchlist.length
        }
      });
    }
  } catch (error) {
    console.error('Update watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update watchlist',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/profile/favorites
 * @desc    Get user's favorite movies
 * @access  Private (JWT required)
 */
router.get('/favorites', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('favorites');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Sort by most recently added
    const sortedFavorites = user.favorites.sort((a, b) => b.addedAt - a.addedAt);

    res.json({
      success: true,
      message: 'Favorites fetched successfully',
      data: {
        favorites: sortedFavorites,
        count: sortedFavorites.length
      }
    });
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch favorites',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/profile/favorites
 * @desc    Add movie to favorites (Android compatible)
 * @access  Private (JWT required)
 */
router.post('/favorites', authenticateToken, async (req, res) => {
  try {
    const { imdbId, title, posterPath } = req.body;

    if (!imdbId) {
      return res.status(400).json({
        success: false,
        message: 'imdbId is required'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already in favorites (search by imdbId)
    const existingItem = user.favorites.find(item => item.imdbId === imdbId);
    if (existingItem) {
      return res.status(400).json({
        success: false,
        message: 'Movie already in favorites'
      });
    }

    // Add to favorites with imdbId
    user.favorites.push({
      imdbId,
      tmdbId: null, // Will be populated if available
      title: title || '',
      posterPath: posterPath || '',
      addedAt: new Date()
    });

    await user.save();

    res.json({
      success: true,
      message: 'Movie added to favorites',
      data: {
        imdbId,
        favoritesCount: user.favorites.length
      }
    });
  } catch (error) {
    console.error('Add to favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add to favorites',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/profile/favorites/:imdbId
 * @desc    Remove movie from favorites (Android compatible)
 * @access  Private (JWT required)
 */
router.delete('/favorites/:imdbId', authenticateToken, async (req, res) => {
  try {
    const { imdbId } = req.params;

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if movie exists in favorites
    const existingItem = user.favorites.find(item => item.imdbId === imdbId);
    if (!existingItem) {
      return res.status(404).json({
        success: false,
        message: 'Movie not found in favorites'
      });
    }

    // Remove from favorites
    user.favorites = user.favorites.filter(item => item.imdbId !== imdbId);
    await user.save();

    res.json({
      success: true,
      message: 'Movie removed from favorites',
      data: {
        imdbId,
        favoritesCount: user.favorites.length
      }
    });
  } catch (error) {
    console.error('Remove from favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove from favorites',
      error: error.message
    });
  }
});

/**
 * @route   PUT /api/profile/favorites
 * @desc    Add or remove movie from favorites (Legacy - supports tmdbId)
 * @access  Private (JWT required)
 */
router.put('/favorites', authenticateToken, async (req, res) => {
  try {
    const { tmdbId, action, title, posterPath } = req.body;

    // Validate input
    if (!tmdbId || !action) {
      return res.status(400).json({
        success: false,
        message: 'tmdbId and action (add/remove) are required'
      });
    }

    if (!['add', 'remove'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "add" or "remove"'
      });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (action === 'add') {
      // Check if already in favorites
      if (user.isInFavorites(tmdbId)) {
        return res.status(400).json({
          success: false,
          message: 'Movie already in favorites'
        });
      }

      // Add to favorites
      user.favorites.push({
        tmdbId,
        title: title || '',
        posterPath: posterPath || '',
        addedAt: new Date()
      });

      await user.save();

      return res.json({
        success: true,
        message: 'Movie added to favorites',
        data: {
          tmdbId,
          favoritesCount: user.favorites.length
        }
      });
    }

    if (action === 'remove') {
      // Check if movie exists in favorites
      if (!user.isInFavorites(tmdbId)) {
        return res.status(400).json({
          success: false,
          message: 'Movie not found in favorites'
        });
      }

      // Remove from favorites
      user.favorites = user.favorites.filter(item => item.tmdbId !== tmdbId);
      await user.save();

      return res.json({
        success: true,
        message: 'Movie removed from favorites',
        data: {
          tmdbId,
          favoritesCount: user.favorites.length
        }
      });
    }
  } catch (error) {
    console.error('Update favorites error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update favorites',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/profile/status/:imdbId
 * @desc    Check if movie is in watchlist or favorites (Android compatible)
 * @access  Private (JWT required)
 */
router.get('/status/:imdbId', authenticateToken, async (req, res) => {
  try {
    const { imdbId } = req.params;

    if (!imdbId) {
      return res.status(400).json({
        success: false,
        message: 'imdbId is required'
      });
    }

    const user = await User.findById(req.userId).select('watchlist favorites');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check by imdbId
    const isInWatchlist = user.watchlist.some(item => item.imdbId === imdbId);
    const isInFavorites = user.favorites.some(item => item.imdbId === imdbId);

    res.json({
      success: true,
      message: 'Check completed',
      data: {
        imdbId,
        isInWatchlist,
        isInFavorites
      }
    });
  } catch (error) {
    console.error('Check movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check movie status',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/profile/check/:tmdbId
 * @desc    Check if movie is in watchlist or favorites (Legacy - supports tmdbId)
 * @access  Private (JWT required)
 */
router.get('/check/:tmdbId', authenticateToken, async (req, res) => {
  try {
    const { tmdbId } = req.params;

    if (!tmdbId || isNaN(tmdbId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid TMDB ID format. Must be a number.'
      });
    }

    const user = await User.findById(req.userId).select('watchlist favorites');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Check completed',
      data: {
        tmdbId: parseInt(tmdbId),
        isInWatchlist: user.isInWatchlist(parseInt(tmdbId)),
        isInFavorites: user.isInFavorites(parseInt(tmdbId))
      }
    });
  } catch (error) {
    console.error('Check movie error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check movie status',
      error: error.message
    });
  }
});

module.exports = router;
