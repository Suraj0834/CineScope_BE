# CineScope_BE

Backend API server for CineScope - An AI-powered movie discovery Android application.

## 🚀 Features

- **User Authentication**
  - Register with email and password
  - Login with JWT token authentication
  - Password reset via Gmail OTP verification
  - Secure password hashing with bcrypt

- **Movie Discovery (Trakt.tv + OMDb APIs)**
  - Browse trending/popular movies
  - Search movies by title
  - Get detailed movie information with posters
  - Check streaming availability via Watchmode API (India region)
  - Access movie cast, crew, videos, and similar movies
  - Real actor photos from Wikipedia API

- **AI-Powered Features**
  - Generate movie summaries using Google Gemini AI
  - Multi-language translation support (AiLang)
  - Get detailed explanations about plot points

- **User Profile Management**
  - Manage personal watchlist
  - Save favorite movies
  - Update profile information
  - Check movie status (in watchlist/favorites)

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **Security**: bcryptjs, helmet, cors, express-rate-limit
- **Email**: nodemailer (Gmail)
- **HTTP Client**: axios
- **APIs**: Trakt.tv, OMDb, Watchmode, Google Gemini, Wikipedia

## 📂 Project Structure

```
CineScope_BE/
│
├── server.js              # Main application entry point
├── package.json           # Dependencies and scripts
├── .env.example           # Environment variables template
├── .gitignore            # Git ignore rules
│
├── models/
│   ├── User.js           # User schema with watchlist & favorites
│   └── Otp.js            # OTP schema for password reset
│
├── routes/
│   ├── auth.js           # Authentication endpoints
│   ├── movies.js         # Movie discovery endpoints
│   ├── openai.js         # AI features endpoints
│   └── profile.js        # User profile endpoints
│
└── middleware/
    └── auth.js           # JWT authentication middleware
```

## 🔧 Installation & Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB (local or Atlas)
- API Keys:
  - TMDb API Key ([Get it here](https://www.themoviedb.org/settings/api))
  - Watchmode API Key ([Get it here](https://api.watchmode.com/))
  - OpenAI API Key ([Get it here](https://platform.openai.com/api-keys))
  - Gmail App Password ([Setup guide](https://support.google.com/accounts/answer/185833))

### Step 1: Install Dependencies

```bash
cd backend
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env` and fill in your credentials:

```bash
copy .env.example .env
```

Edit `.env` file:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGO_URI=mongodb://localhost:27017/cinescope
# Or MongoDB Atlas: mongodb+srv://username:password@cluster.mongodb.net/cinescope

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
JWT_EXPIRES_IN=7d

# TMDb API
TMDB_KEY=your_tmdb_api_key_here
TMDB_BASE_URL=https://api.themoviedb.org/3

# Watchmode API
WATCHMODE_KEY=your_watchmode_api_key_here
WATCHMODE_BASE_URL=https://api.watchmode.com/v1

# OpenAI API
OPENAI_KEY=your_openai_api_key_here

# Email Configuration (Gmail)
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_gmail_app_password_here

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
OTP_RATE_LIMIT_WINDOW_MS=900000
OTP_RATE_LIMIT_MAX_REQUESTS=5
```

### Step 3: Start MongoDB

**Local MongoDB:**
```bash
mongod
```

**Or use MongoDB Atlas** (cloud database) - just update MONGO_URI in .env

### Step 4: Run the Server

**Production mode:**
```bash
npm start
```

**Development mode (with nodemon):**
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## 📡 API Endpoints

### Authentication (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | ❌ |
| POST | `/api/auth/login` | Login user | ❌ |
| POST | `/api/auth/forgot` | Send OTP for password reset | ❌ |
| POST | `/api/auth/verify-otp` | Verify OTP and reset password | ❌ |

### Movies (`/api/movies`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/movies/trending?type=popular&page=1` | Get trending movies | ❌ |
| GET | `/api/movies/search?q=inception&page=1` | Search movies | ❌ |
| GET | `/api/movies/:id` | Get movie details + streaming | ❌ |
| GET | `/api/movies/genres/list` | Get all genres | ❌ |

### AI Features (`/api/ai`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/ai/summarize` | Generate movie summary | ✅ |
| POST | `/api/ai/explain` | Explain movie aspects | ✅ |
| POST | `/api/ai/recommend` | Get recommendations | ✅ |

### User Profile (`/api/profile`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/profile` | Get user profile | ✅ |
| PUT | `/api/profile` | Update profile | ✅ |
| GET | `/api/profile/watchlist` | Get watchlist | ✅ |
| PUT | `/api/profile/watchlist` | Add/remove from watchlist | ✅ |
| GET | `/api/profile/favorites` | Get favorites | ✅ |
| PUT | `/api/profile/favorites` | Add/remove from favorites | ✅ |
| GET | `/api/profile/check/:tmdbId` | Check movie status | ✅ |

## 🧪 Testing with Postman

### 1. Register a User

```http
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123"
}
```

### 2. Login

```http
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": { ... }
  }
}
```

### 3. Use Token for Protected Routes

Add to Headers:
```
Authorization: Bearer your_jwt_token_here
```

### 4. Get Trending Movies

```http
GET http://localhost:5000/api/movies/trending?type=popular&page=1
```

### 5. Search Movies

```http
GET http://localhost:5000/api/movies/search?q=inception
```

### 6. Get Movie Details

```http
GET http://localhost:5000/api/movies/550
```

### 7. Add to Watchlist (Protected)

```http
PUT http://localhost:5000/api/profile/watchlist
Authorization: Bearer your_jwt_token_here
Content-Type: application/json

{
  "tmdbId": 550,
  "action": "add",
  "title": "Fight Club",
  "posterPath": "/path/to/poster.jpg"
}
```

### 8. Generate AI Summary (Protected)

```http
POST http://localhost:5000/api/ai/summarize
Authorization: Bearer your_jwt_token_here
Content-Type: application/json

{
  "title": "Inception",
  "description": "A thief who steals corporate secrets...",
  "year": "2010",
  "genres": ["Action", "Sci-Fi", "Thriller"]
}
```

## 🔐 Security Features

- **Password Hashing**: bcrypt with salt rounds
- **JWT Authentication**: Secure token-based auth
- **Rate Limiting**: Prevents brute force attacks
- **Helmet**: Secure HTTP headers
- **CORS**: Configurable cross-origin requests
- **Input Validation**: Server-side validation
- **OTP Expiry**: 10-minute expiration for password reset

## 🚨 Error Handling

All endpoints return consistent JSON responses:

**Success Response:**
```json
{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 📝 Environment Variables Explained

| Variable | Description | Required |
|----------|-------------|----------|
| PORT | Server port | ✅ |
| MONGO_URI | MongoDB connection string | ✅ |
| JWT_SECRET | Secret key for JWT signing | ✅ |
| JWT_EXPIRES_IN | Token expiration time | ✅ |
| TMDB_KEY | The Movie Database API key | ✅ |
| WATCHMODE_KEY | Watchmode API key | ✅ |
| OPENAI_KEY | OpenAI API key | ✅ |
| EMAIL_USER | Gmail address | ✅ |
| EMAIL_PASS | Gmail app password | ✅ |
| FRONTEND_URL | Frontend URL for CORS | ❌ |

## 🎯 Gmail App Password Setup

1. Enable 2-Factor Authentication on your Gmail account
2. Go to [Google App Passwords](https://myaccount.google.com/apppasswords)
3. Select "Mail" and your device
4. Copy the generated 16-character password
5. Use this password in `EMAIL_PASS` environment variable

## 🐛 Troubleshooting

### MongoDB Connection Error

- Check if MongoDB is running: `mongod`
- Verify MONGO_URI in .env
- For Atlas: Check network access and credentials

### API Key Errors

- Verify all API keys are valid
- Check API key quotas/limits
- Ensure keys are properly set in .env

### Email Not Sending

- Verify Gmail credentials
- Enable "Less secure app access" or use App Password
- Check Gmail account settings

## 📦 Deployment

### Deploy to Heroku

```bash
heroku create cinescope-api
heroku config:set MONGO_URI=your_mongo_uri
heroku config:set JWT_SECRET=your_secret
# ... set all other env variables
git push heroku main
```

### Deploy to Railway

```bash
railway login
railway init
railway up
# Add environment variables in Railway dashboard
```

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

ISC License

## 👨‍💻 Author

CineScope AI Development Team

---

**Built with ❤️ for movie enthusiasts**
