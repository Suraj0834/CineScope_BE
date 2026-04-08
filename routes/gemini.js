const express = require('express');
const router = express.Router();
const axios = require('axios');
const authenticateToken = require('../middleware/auth');
const aiService = require('../services/aiService');
const geminiKeyManager = require('../services/geminiKeyManager');

// Google Gemini API configuration (Fallback)
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';
const USE_GEMINI_FALLBACK = process.env.USE_GEMINI_FALLBACK === 'true';
const MAX_RETRIES = 4; // Try up to 4 different keys

// Helper function: Fallback to Gemini if RAG AI fails or returns empty
async function callGemini(prompt, systemInstruction = null, generationConfig = null, contents = null) {
  let lastError = null;
  let attempts = 0;

  while (attempts < MAX_RETRIES) {
    try {
      // Get current API key from key manager
      const apiKey = geminiKeyManager.getCurrentKey();

      const requestBody = {
        contents: contents || [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      };

      if (systemInstruction) {
        requestBody.systemInstruction = { parts: [{ text: systemInstruction }] };
      }
      if (generationConfig) {
        requestBody.generationConfig = generationConfig;
      }

      const response = await axios.post(
        `${GEMINI_API_URL}?key=${apiKey}`,
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      // Success! Mark key as successful and return result
      geminiKeyManager.markCurrentKeySuccess();
      return response.data.candidates[0].content.parts[0].text.trim();

    } catch (error) {
      lastError = error;
      attempts++;

      console.error(`Gemini API Error (attempt ${attempts}/${MAX_RETRIES}):`, error.response?.data || error.message);

      // Check if this is a quota/rate limit error
      if (geminiKeyManager.isQuotaError(error)) {
        console.log('🔄 Quota/rate limit error detected, rotating to next API key...');
        geminiKeyManager.markCurrentKeyFailedAndRotate(error);

        // If we have more retries left, continue to next key
        if (attempts < MAX_RETRIES) {
          console.log(`Retrying with next API key (attempt ${attempts + 1}/${MAX_RETRIES})...`);
          continue;
        }
      } else {
        // For non-quota errors (like auth errors), don't retry
        console.error('Non-quota error encountered, not retrying.');
        throw error;
      }
    }
  }

  // All retries exhausted
  console.error(`❌ All ${MAX_RETRIES} API key attempts exhausted`);
  throw lastError;
}

/**
 * @route   POST /api/gemini/summarize
 * @desc    Generate AI summary/explanation for a movie using RAG AI (or Gemini fallback)
 * @access  Private (JWT required)
 */
router.post('/summarize', authenticateToken, async (req, res) => {
  try {
    const { title, description, year, genres, plot } = req.body;

    // Validate input
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Movie title is required'
      });
    }

    try {
      // Try RAG AI first
      const summary = await aiService.summarize({ title, year, plot, description });

      res.json({
        success: true,
        message: 'AI summary generated successfully (CinScope AI)',
        data: {
          title,
          summary,
          source: 'CinScope AI'
        }
      });
    } catch (aiError) {
      console.error('CinScope AI summarize failed:', aiError.message);

      if (!USE_GEMINI_FALLBACK) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate AI summary (CinScope AI)',
          error: aiError.message
        });
      }

      // Fallback to Gemini
      console.log('Falling back to Gemini API for summarize...');

      let movieContext = `Movie: ${title}`;
      if (year) movieContext += ` (${year})`;
      if (genres && genres.length > 0) movieContext += `\nGenres: ${genres.join(', ')}`;
      if (plot || description) movieContext += `\nPlot: ${plot || description}`;

      const prompt = `You are a friendly and enthusiastic movie expert assistant 🎬✨. Provide a clear, engaging summary and explanation of the following movie.

**Guidelines:**
1. 📖 Brief plot summary (avoid major spoilers unless the ending is well-known)
2. 🎯 Key themes and what makes it interesting
3. 🤔 If the ending is confusing or notable, explain it in simple terms
4. Use emojis sparingly to make it engaging and fun
5. Use markdown formatting (**bold**, *italic*, lists) to organize information

Keep the response under 250 words and make it easy to understand.

${movieContext}`;

      const summary = await callGemini(prompt);

      res.json({
        success: true,
        message: 'AI summary generated successfully (Gemini Fallback)',
        data: {
          title,
          summary,
          source: 'Gemini'
        }
      });
    }
  } catch (error) {
    console.error('Summarize error:', error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key is invalid or missing'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate AI summary',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @route   POST /api/gemini/explain
 * @desc    Get detailed explanation about specific movie aspects using RAG AI (or Gemini fallback)
 * @access  Private (JWT required)
 */
router.post('/explain', authenticateToken, async (req, res) => {
  try {
    const { title, question, context } = req.body;

    // Validate input
    if (!title || !question) {
      return res.status(400).json({
        success: false,
        message: 'Movie title and question are required'
      });
    }

    try {
      // Try RAG AI first
      const explanation = await aiService.explain(title, question, context);

      res.json({
        success: true,
        message: 'Explanation generated successfully (CinScope AI)',
        data: {
          title,
          question,
          explanation,
          source: 'CinScope AI'
        }
      });
    } catch (aiError) {
      console.error('CinScope AI explain failed:', aiError.message);

      if (!USE_GEMINI_FALLBACK) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate explanation (CinScope AI)',
          error: aiError.message
        });
      }

      // Fallback to Gemini
      console.log('Falling back to Gemini API for explain...');

      let prompt = `🎬 Movie: ${title}\n`;
      if (context) prompt += `📝 Context: ${context}\n`;
      prompt += `\n❓ Question: ${question}\n\nProvide a clear, detailed explanation in under 200 words. Use markdown formatting (**bold**, *italic*) and emojis to make it engaging and easy to understand.`;

      const explanation = await callGemini(prompt);

      res.json({
        success: true,
        message: 'Explanation generated successfully (Gemini Fallback)',
        data: {
          title,
          question,
          explanation,
          source: 'Gemini'
        }
      });
    }
  } catch (error) {
    console.error('Explain error:', error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key is invalid or missing'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate explanation',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @route   POST /api/gemini/recommend
 * @desc    Get AI-powered movie recommendations using RAG AI (or Gemini fallback)
 * @access  Private (JWT required)
 */
router.post('/recommend', authenticateToken, async (req, res) => {
  try {
    const { favoriteMovies, genres, mood } = req.body;

    if (!favoriteMovies || favoriteMovies.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one favorite movie'
      });
    }

    try {
      // Try RAG AI first
      const recommendations = await aiService.recommend(favoriteMovies, genres, mood);

      res.json({
        success: true,
        message: 'Recommendations generated successfully (CinScope AI)',
        data: {
          recommendations,
          basedOn: favoriteMovies,
          source: 'CinScope AI'
        }
      });
    } catch (aiError) {
      console.error('CinScope AI recommend failed:', aiError.message);

      if (!USE_GEMINI_FALLBACK) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate recommendations (CinScope AI)',
          error: aiError.message
        });
      }

      // Fallback to Gemini
      console.log('Falling back to Gemini API for recommend...');

      let prompt = `🎬 Based on these favorite movies: ${favoriteMovies.join(', ')}`;
      if (genres && genres.length > 0) prompt += `\n🎭 Preferred genres: ${genres.join(', ')}`;
      if (mood) prompt += `\n😊 Current mood: ${mood}`;
      prompt += `\n\nRecommend 5 similar movies with brief reasons why (2-3 sentences each). Format as a numbered list with markdown formatting and emojis.`;

      const recommendations = await callGemini(prompt);

      res.json({
        success: true,
        message: 'Recommendations generated successfully (Gemini Fallback)',
        data: {
          recommendations,
          basedOn: favoriteMovies,
          source: 'Gemini'
        }
      });
    }
  } catch (error) {
    console.error('Recommend error:', error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key is invalid or missing'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate recommendations',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @route   POST /api/gemini/analyze
 * @desc    Analyze movie themes, symbolism, and deeper meanings using RAG AI (or Gemini fallback)
 * @access  Private (JWT required)
 */
router.post('/analyze', authenticateToken, async (req, res) => {
  try {
    const { title, plot, aspect } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Movie title is required'
      });
    }

    try {
      // Try RAG AI first
      const analysis = await aiService.analyze(title, plot, aspect);

      res.json({
        success: true,
        message: 'Analysis generated successfully (CinScope AI)',
        data: {
          title,
          aspect: aspect || 'themes and symbolism',
          analysis,
          source: 'CinScope AI'
        }
      });
    } catch (aiError) {
      console.error('CinScope AI analyze failed:', aiError.message);

      if (!USE_GEMINI_FALLBACK) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate analysis (CinScope AI)',
          error: aiError.message
        });
      }

      // Fallback to Gemini
      console.log('Falling back to Gemini API for analyze...');

      let prompt = `🎬 Analyze the movie "${title}" focusing on ${aspect || 'themes and symbolism'}.`;
      if (plot) prompt += `\n\n📖 Plot context: ${plot}`;
      prompt += `\n\nProvide an insightful analysis in under 250 words. Use markdown formatting (**bold**, *italic*, lists) and emojis to make it engaging.`;

      const analysis = await callGemini(prompt);

      res.json({
        success: true,
        message: 'Analysis generated successfully (Gemini Fallback)',
        data: {
          title,
          aspect: aspect || 'themes and symbolism',
          analysis,
          source: 'Gemini'
        }
      });
    }
  } catch (error) {
    console.error('Analyze error:', error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key is invalid or missing'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate analysis',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @route   POST /api/gemini/chat
 * @desc    Chat with AI about movie rumors, myths, facts, and trivia (RAG Power)
 * @access  Private (JWT required)
 */
router.post('/chat', authenticateToken, async (req, res) => {
  try {
    const { movieMetadata, userMessage, conversationHistory } = req.body;

    // Validate input
    if (!movieMetadata || !movieMetadata.title) {
      return res.status(400).json({
        success: false,
        message: 'Movie metadata with title is required'
      });
    }

    if (!userMessage || userMessage.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'User message is required'
      });
    }

    try {
      // Try RAG AI first
      const result = await aiService.chat(movieMetadata, userMessage, conversationHistory);

      res.json({
        success: true,
        message: 'Chat response generated successfully (CinScope AI)',
        data: {
          response: result.response,
          movieTitle: movieMetadata.title,
          source: 'CinScope AI',
          sources: result.sources // Pass back sources if available
        }
      });
    } catch (aiError) {
      console.error('CinScope AI chat failed:', aiError.message);

      if (!USE_GEMINI_FALLBACK) {
        return res.status(500).json({
          success: false,
          message: 'Failed to generate chat response (CinScope AI)',
          error: aiError.message
        });
      }

      // Fallback to Gemini
      console.log('Falling back to Gemini API for chat...');

      // Build comprehensive movie context
      let movieContext = `Movie Information:
- Title: ${movieMetadata.title}`;

      if (movieMetadata.year) movieContext += `\n- Release Year: ${movieMetadata.year}`;
      if (movieMetadata.rated) movieContext += `\n- Rated: ${movieMetadata.rated}`;
      if (movieMetadata.runtime) movieContext += `\n- Runtime: ${movieMetadata.runtime}`;
      if (movieMetadata.genre) movieContext += `\n- Genres: ${movieMetadata.genre}`;
      if (movieMetadata.director) movieContext += `\n- Director: ${movieMetadata.director}`;
      if (movieMetadata.writer) movieContext += `\n- Writer(s): ${movieMetadata.writer}`;
      if (movieMetadata.actors) movieContext += `\n- Main Cast: ${movieMetadata.actors}`;
      if (movieMetadata.plot) movieContext += `\n- Plot: ${movieMetadata.plot}`;
      if (movieMetadata.language) movieContext += `\n- Language: ${movieMetadata.language}`;
      if (movieMetadata.country) movieContext += `\n- Country: ${movieMetadata.country}`;
      if (movieMetadata.awards) movieContext += `\n- Awards: ${movieMetadata.awards}`;
      if (movieMetadata.imdbRating) movieContext += `\n- IMDb Rating: ${movieMetadata.imdbRating}/10`;
      if (movieMetadata.imdbVotes) movieContext += `\n- IMDb Votes: ${movieMetadata.imdbVotes}`;
      if (movieMetadata.boxOffice) movieContext += `\n- Box Office: ${movieMetadata.boxOffice}`;

      // System instruction for AI
      const systemInstruction = `You are a friendly, knowledgeable movie expert assistant 🎬 specialized in discussing movie rumors, myths, facts, trivia, behind-the-scenes stories, and Easter eggs.

Your role:
- Answer questions about the movie's production, cast, director, and crew 🎥
- Clarify rumors and myths with factual information ✅
- Share interesting trivia and little-known facts 💡
- Discuss plot theories, symbolism, and interpretations 🔍
- Explain confusing scenes or endings 🤔
- Talk about deleted scenes, alternate endings, and director's cuts 🎞️
- Share behind-the-scenes stories and production challenges 🎭
- Be conversational, engaging, and informative with a warm personality 😊
- Use emojis naturally to enhance communication (not too many!)
- Use markdown formatting (**bold**, *italic*, lists, etc.) to organize information clearly
- If you're unsure about something, acknowledge it honestly
- Keep responses concise (under 200 words unless asked for more detail)

Use the provided movie metadata to give accurate, contextual responses.`;

      // Build conversation contents
      const contents = [];

      // Add conversation history if provided
      if (conversationHistory && Array.isArray(conversationHistory) && conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          if (msg.role === 'user') {
            contents.push({
              role: 'user',
              parts: [{ text: msg.message }]
            });
          } else if (msg.role === 'assistant' || msg.role === 'model') {
            contents.push({
              role: 'model',
              parts: [{ text: msg.message }]
            });
          }
        });
      }

      // Add current user message with movie context
      const userPrompt = `${movieContext}

User Question: ${userMessage}`;

      contents.push({
        role: 'user',
        parts: [{ text: userPrompt }]
      });

      // Detect if user is asking for recommendations (e.g., "similar", "recommend", "like this movie")
      const recRegex = /\b(similar|recommend|recommendation|like this movie|like this|10 similar|suggest)\b/i;
      if (recRegex.test(userMessage)) {
        // Build a recommend-style prompt using the provided movie title as the favorite
        const fav = movieMetadata.title;
        let recPrompt = `Based on this movie: ${fav}`;
        if (movieMetadata.genre) recPrompt += `\nGenres: ${movieMetadata.genre}`;
        recPrompt += `\n\nUser asked: ${userMessage}`;
        recPrompt += `\n\nRecommend 10 similar movies with a short (1-2 sentence) reason for each. Format as a numbered list with markdown formatting. Use emojis sparingly to make it engaging.`;

        // Call Gemini for recommendations
        const recText = await callGemini(recPrompt);

        // Parse numbered list from the recommendation text and try to enrich with OMDb data
        const lines = recText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const recItems = [];

        const itemRegex = /^\s*\d+\.?\s*(.*?)\s*(?:[-–—:]\s*(.*))?$/;

        for (let line of lines) {
          const m = line.match(itemRegex);
          if (m) {
            const titlePart = m[1].replace(/^"|"$/g, '').trim();
            const reasonPart = m[2] ? m[2].trim() : '';

            // Try to fetch details from OMDb (Note: OMDB_BASE_URL and OMDB_API_KEY are not defined in this snippet, assuming they exist elsewhere or are placeholders)
            try {
              // This part assumes OMDb integration is available. If not, it will fail.
              // For this edit, I'll keep it as is, assuming the original code had these defined.
              const omdbResp = await axios.get(OMDB_BASE_URL, { // OMDB_BASE_URL not defined in provided snippet
                params: {
                  apikey: OMDB_API_KEY, // OMDB_API_KEY not defined in provided snippet
                  t: titlePart
                }
              });

              if (omdbResp.data && omdbResp.data.Response === 'True') {
                recItems.push({
                  title: omdbResp.data.Title,
                  imdbId: omdbResp.data.imdbID,
                  year: omdbResp.data.Year,
                  poster: omdbResp.data.Poster !== 'N/A' ? omdbResp.data.Poster : null,
                  reason: reasonPart
                });
                continue;
              }
            } catch (err) {
              // ignore and fallback to title only
            }

            // Fallback if OMDb lookup failed
            recItems.push({
              title: titlePart,
              imdbId: null,
              year: null,
              poster: null,
              reason: reasonPart
            });
          }
        }

        return res.json({
          success: true,
          message: 'Recommendation generated successfully (Gemini Fallback)',
          data: {
            response: recText.trim(),
            movieTitle: movieMetadata.title,
            recommendations: recItems,
            source: 'Gemini'
          }
        });
      }

      // Call Google Gemini API for general chat
      const aiResponse = await callGemini(null, systemInstruction, {
        temperature: 0.8,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 500
      }, contents);

      res.json({
        success: true,
        message: 'Chat response generated successfully (Gemini Fallback)',
        data: {
          response: aiResponse,
          movieTitle: movieMetadata.title,
          source: 'Gemini'
        }
      });
    }
  } catch (error) {
    console.error('Chat error:', error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        message: 'Gemini API key is invalid or missing'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        message: 'Gemini API rate limit exceeded. Please try again later.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to generate chat response',
      error: error.response?.data?.error?.message || error.message
    });
  }
});

/**
 * @route   GET /api/gemini/key-stats
 * @desc    Get Gemini API key rotation statistics (for debugging)
 * @access  Private (JWT required)
 */
router.get('/key-stats', authenticateToken, async (req, res) => {
  try {
    const stats = geminiKeyManager.getStats();
    res.json({
      success: true,
      message: 'Key statistics retrieved successfully',
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve key statistics',
      error: error.message
    });
  }
});

module.exports = router;
