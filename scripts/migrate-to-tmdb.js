/**
 * Database Migration Script: IMDb IDs to TMDB IDs
 * 
 * This script migrates existing user watchlists and favorites from IMDb IDs to TMDB IDs.
 * It uses TMDB's find API to convert IMDb IDs to TMDB IDs.
 * 
 * Usage:
 *   node scripts/migrate-to-tmdb.js
 * 
 * Prerequisites:
 *   - TMDB_API_KEY must be set in .env file
 *   - MongoDB must be running and accessible
 */

require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const User = require('../models/User');

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const MONGO_URI = process.env.MONGO_URI;

// Statistics
const stats = {
    totalUsers: 0,
    usersProcessed: 0,
    usersFailed: 0,
    watchlistItemsConverted: 0,
    watchlistItemsFailed: 0,
    favoritesItemsConverted: 0,
    favoritesItemsFailed: 0
};

/**
 * Convert IMDb ID to TMDB ID using TMDB's find API
 */
async function convertImdbToTmdb(imdbId) {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/find/${imdbId}`, {
            params: {
                api_key: TMDB_API_KEY,
                external_source: 'imdb_id'
            }
        });

        const movieResults = response.data.movie_results;
        if (movieResults && movieResults.length > 0) {
            return movieResults[0].id;
        }

        console.warn(`⚠️  No TMDB match found for IMDb ID: ${imdbId}`);
        return null;
    } catch (error) {
        console.error(`❌ Error converting ${imdbId}:`, error.message);
        return null;
    }
}

/**
 * Migrate a single user's watchlist and favorites
 */
async function migrateUser(user) {
    let updated = false;

    console.log(`\n📝 Processing user: ${user.email}`);

    // Migrate watchlist
    if (user.watchlist && user.watchlist.length > 0) {
        console.log(`  Watchlist items: ${user.watchlist.length}`);

        for (let item of user.watchlist) {
            // Skip if already has tmdbId
            if (item.tmdbId) {
                console.log(`  ✓ Already has TMDB ID: ${item.title} (${item.tmdbId})`);
                continue;
            }

            // Skip if no imdbId
            if (!item.imdbId) {
                console.warn(`  ⚠️  No IMDb ID for: ${item.title}`);
                stats.watchlistItemsFailed++;
                continue;
            }

            // Convert IMDb ID to TMDB ID
            const tmdbId = await convertImdbToTmdb(item.imdbId);

            if (tmdbId) {
                item.tmdbId = tmdbId;
                updated = true;
                stats.watchlistItemsConverted++;
                console.log(`  ✅ Converted: ${item.title} (${item.imdbId} → ${tmdbId})`);
            } else {
                stats.watchlistItemsFailed++;
                console.error(`  ❌ Failed to convert: ${item.title} (${item.imdbId})`);
            }

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Migrate favorites
    if (user.favorites && user.favorites.length > 0) {
        console.log(`  Favorites items: ${user.favorites.length}`);

        for (let item of user.favorites) {
            // Skip if already has tmdbId
            if (item.tmdbId) {
                console.log(`  ✓ Already has TMDB ID: ${item.title} (${item.tmdbId})`);
                continue;
            }

            // Skip if no imdbId
            if (!item.imdbId) {
                console.warn(`  ⚠️  No IMDb ID for: ${item.title}`);
                stats.favoritesItemsFailed++;
                continue;
            }

            // Convert IMDb ID to TMDB ID
            const tmdbId = await convertImdbToTmdb(item.imdbId);

            if (tmdbId) {
                item.tmdbId = tmdbId;
                updated = true;
                stats.favoritesItemsConverted++;
                console.log(`  ✅ Converted: ${item.title} (${item.imdbId} → ${tmdbId})`);
            } else {
                stats.favoritesItemsFailed++;
                console.error(`  ❌ Failed to convert: ${item.title} (${item.imdbId})`);
            }

            // Rate limiting: wait 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    // Save user if updated
    if (updated) {
        try {
            await user.save();
            stats.usersProcessed++;
            console.log(`✅ Saved user: ${user.email}`);
        } catch (error) {
            stats.usersFailed++;
            console.error(`❌ Failed to save user ${user.email}:`, error.message);
        }
    } else {
        console.log(`ℹ️  No changes needed for user: ${user.email}`);
    }
}

/**
 * Main migration function
 */
async function migrateAllUsers() {
    console.log('\n🚀 Starting IMDb to TMDB ID migration...\n');

    // Validate environment
    if (!TMDB_API_KEY) {
        console.error('❌ TMDB_API_KEY not found in environment variables');
        process.exit(1);
    }

    if (!MONGO_URI) {
        console.error('❌ MONGO_URI not found in environment variables');
        process.exit(1);
    }

    try {
        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(MONGO_URI);
        console.log('✅ Connected to MongoDB\n');

        // Find all users
        const users = await User.find({});
        stats.totalUsers = users.length;

        console.log(`📊 Found ${users.length} users to process\n`);
        console.log('═'.repeat(60));

        // Process each user
        for (const user of users) {
            await migrateUser(user);
        }

        // Print final statistics
        console.log('\n' + '═'.repeat(60));
        console.log('\n📊 Migration Statistics:\n');
        console.log(`Total Users:                ${stats.totalUsers}`);
        console.log(`Users Processed:            ${stats.usersProcessed}`);
        console.log(`Users Failed:               ${stats.usersFailed}`);
        console.log(`Watchlist Items Converted:  ${stats.watchlistItemsConverted}`);
        console.log(`Watchlist Items Failed:     ${stats.watchlistItemsFailed}`);
        console.log(`Favorites Items Converted:  ${stats.favoritesItemsConverted}`);
        console.log(`Favorites Items Failed:     ${stats.favoritesItemsFailed}`);
        console.log('\n✅ Migration complete!\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        // Close MongoDB connection
        await mongoose.connection.close();
        console.log('📡 Disconnected from MongoDB');
    }
}

// Run migration
if (require.main === module) {
    migrateAllUsers()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { migrateAllUsers, convertImdbToTmdb };
