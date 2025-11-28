/**
 * Quick API Health Check
 * Tests basic endpoints that don't require TMDB API key
 */

const axios = require('axios');

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function testHealthCheck() {
    console.log('\n🏥 Testing Server Health...\n');

    try {
        const response = await axios.get(`${BASE_URL}/`);
        console.log('✅ Server is running');
        console.log('📊 Response:', JSON.stringify(response.data, null, 2));
        return true;
    } catch (error) {
        console.log('❌ Server is not responding');
        console.log('Error:', error.message);
        return false;
    }
}

async function testAuthEndpoints() {
    console.log('\n🔐 Testing Authentication Endpoints...\n');

    const testEmail = `test${Date.now()}@cinescope.com`;
    const testPassword = 'test123456';

    try {
        // Test Register
        console.log('Testing: POST /api/auth/register');
        const registerResponse = await axios.post(`${BASE_URL}/api/auth/register`, {
            name: 'Test User',
            email: testEmail,
            password: testPassword
        });

        if (registerResponse.data.success) {
            console.log('✅ Register endpoint working');
            const token = registerResponse.data.data.token;

            // Test Login
            console.log('\nTesting: POST /api/auth/login');
            const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
                email: testEmail,
                password: testPassword
            });

            if (loginResponse.data.success) {
                console.log('✅ Login endpoint working');

                // Test Profile
                console.log('\nTesting: GET /api/profile');
                const profileResponse = await axios.get(`${BASE_URL}/api/profile`, {
                    headers: { Authorization: `Bearer ${token}` }
                });

                if (profileResponse.data.success) {
                    console.log('✅ Profile endpoint working');
                    console.log('👤 User:', profileResponse.data.data.user.name);
                }
            }
        }

        return true;
    } catch (error) {
        console.log('❌ Auth test failed:', error.response?.data?.message || error.message);
        return false;
    }
}

async function testMoviesEndpoints() {
    console.log('\n🎬 Testing Movies Endpoints (requires TMDB API key)...\n');

    try {
        console.log('Testing: GET /api/movies/trending');
        const response = await axios.get(`${BASE_URL}/api/movies/trending`);

        if (response.data.success) {
            console.log('✅ Movies endpoint working');
            console.log(`📊 Found ${response.data.data.movies.length} trending movies`);
            if (response.data.data.movies.length > 0) {
                console.log(`🎥 First movie: ${response.data.data.movies[0].title}`);
            }
            return true;
        }
    } catch (error) {
        if (error.response?.status === 500) {
            console.log('⚠️  Movies endpoint failed - TMDB API key may be missing');
            console.log('   Please add TMDB_API_KEY to your .env file');
            console.log('   Get your key from: https://www.themoviedb.org/settings/api');
        } else {
            console.log('❌ Movies test failed:', error.response?.data?.message || error.message);
        }
        return false;
    }
}

async function runQuickTests() {
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║         CineScope Backend - Quick Health Check           ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');

    const serverOk = await testHealthCheck();

    if (!serverOk) {
        console.log('\n❌ Server is not running. Please start it with: npm run dev\n');
        process.exit(1);
    }

    await testAuthEndpoints();
    await testMoviesEndpoints();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    Tests Complete                         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

runQuickTests().catch(console.error);
