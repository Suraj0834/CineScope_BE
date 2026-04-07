/**
 * AI Service Client
 * Handles communication with the Python RAG AI service
 */
const axios = require('axios');

class AIService {
  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
    this.enabled = process.env.AI_SERVICE_ENABLED !== 'false';
    this.useGeminiFallback = process.env.USE_GEMINI_FALLBACK === 'true';
    this.timeout = 30000; // 30 seconds
    
    // Create axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    console.log(`🤖 AI Service initialized:`);
    console.log(`   URL: ${this.baseURL}`);
    console.log(`   Enabled: ${this.enabled}`);
    console.log(`   Gemini Fallback: ${this.useGeminiFallback}`);
  }

  /**
   * Check if AI service is healthy
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/api/health');
      return response.data.status === 'healthy';
    } catch (error) {
      console.error('AI Service health check failed:', error.message);
      return false;
    }
  }

  /**
   * Ask a question to the RAG AI
   * @param {string} question - User's question
   * @param {Array} platforms - Optional platform filter
   * @returns {Promise<Object>} AI response
   */
  async ask(question, platforms = null) {
    try {
      const response = await this.client.post('/api/ask', {
        question,
        platforms
      });

      return {
        success: true,
        answer: response.data.answer,
        sources: response.data.sources || [],
        isMovieRelated: response.data.is_movie_related
      };
    } catch (error) {
      console.error('AI Service ask error:', error.message);
      throw error;
    }
  }

  /**
   * Generate movie summary using RAG AI
   * @param {Object} movieData - Movie information
   * @returns {Promise<string>} Summary text
   */
  async summarize(movieData) {
    const { title, year, plot } = movieData;
    
    const question = `Provide a comprehensive summary of the movie "${title}"${year ? ` (${year})` : ''}. ${plot ? `Context: ${plot}` : ''} Include key plot points, themes, and what makes it interesting.`;

    const result = await this.ask(question);
    return result.answer;
  }

  /**
   * Explain specific movie aspects
   * @param {string} title - Movie title
   * @param {string} question - Specific question
   * @param {string} context - Additional context
   * @returns {Promise<string>} Explanation
   */
  async explain(title, question, context = null) {
    const fullQuestion = context 
      ? `About the movie "${title}" (${context}): ${question}`
      : `About the movie "${title}": ${question}`;

    const result = await this.ask(fullQuestion);
    return result.answer;
  }

  /**
   * Get movie recommendations
   * @param {Array} favoriteMovies - List of favorite movies
   * @param {Array} genres - Preferred genres
   * @param {string} mood - Current mood
   * @returns {Promise<string>} Recommendations
   */
  async recommend(favoriteMovies, genres = null, mood = null) {
    let question = `Based on these favorite movies: ${favoriteMovies.join(', ')}`;
    
    if (genres && genres.length > 0) {
      question += `, and preferred genres: ${genres.join(', ')}`;
    }
    
    if (mood) {
      question += `, and current mood: ${mood}`;
    }
    
    question += `, recommend 5 similar movies with brief explanations.`;

    const result = await this.ask(question);
    return result.answer;
  }

  /**
   * Analyze movie themes and symbolism
   * @param {string} title - Movie title
   * @param {string} plot - Movie plot
   * @param {string} aspect - Aspect to analyze
   * @returns {Promise<string>} Analysis
   */
  async analyze(title, plot = null, aspect = 'themes and symbolism') {
    let question = `Analyze the movie "${title}" focusing on ${aspect}.`;
    
    if (plot) {
      question += ` Plot context: ${plot}`;
    }
    
    question += ` Provide an insightful analysis.`;

    const result = await this.ask(question);
    return result.answer;
  }

  /**
   * Chat about a movie (for rumor/trivia/facts)
   * @param {Object} movieMetadata - Complete movie information
   * @param {string} userMessage - User's message/question
   * @param {Array} conversationHistory - Previous conversation
   * @returns {Promise<Object>} Chat response with sources
   */
  async chat(movieMetadata, userMessage, conversationHistory = []) {
    // Build context from movie metadata
    let context = `Movie: ${movieMetadata.title}`;
    if (movieMetadata.year) context += ` (${movieMetadata.year})`;
    if (movieMetadata.genre) context += `, Genres: ${movieMetadata.genre}`;
    if (movieMetadata.director) context += `, Director: ${movieMetadata.director}`;
    
    // Include conversation history in the question for context
    let fullQuestion = context + '\n\n';
    
    if (conversationHistory && conversationHistory.length > 0) {
      fullQuestion += 'Previous conversation:\n';
      conversationHistory.slice(-3).forEach(msg => {
        fullQuestion += `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.message}\n`;
      });
      fullQuestion += '\n';
    }
    
    fullQuestion += `Current question: ${userMessage}`;

    const result = await this.ask(fullQuestion);
    
    return {
      response: result.answer,
      sources: result.sources,
      movieTitle: movieMetadata.title
    };
  }

  /**
   * Get trending movie topics
   * @returns {Promise<Array>} Trending topics
   */
  async getTrending() {
    try {
      const response = await this.client.get('/api/movies/trending');
      return response.data.trending || [];
    } catch (error) {
      console.error('Error fetching trending:', error.message);
      return [];
    }
  }

  /**
   * Get database statistics
   * @returns {Promise<Object>} Database stats
   */
  async getStats() {
    try {
      const response = await this.client.get('/api/stats');
      return response.data;
    } catch (error) {
      console.error('Error fetching stats:', error.message);
      return { total_documents: 0 };
    }
  }
}

// Export singleton instance
module.exports = new AIService();
