import express from 'express';
import { WordPressAuthService } from '../../services/WordPressAuthService.js';
import { WordPressBlogService } from '../../services/WordPressBlogService.js';
import { AIService } from '../../ai-writing-assistant/src/services/AIService.js';

const router = express.Router();

// Initialize services (should be done via dependency injection in production)
const authService = new WordPressAuthService();
const aiService = new AIService({
  ai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
    model: process.env.AI_MODEL || 'gpt-3.5-turbo',
    defaultParams: {
      maxTokens: 2000,
      temperature: 0.7,
      topP: 0.9
    }
  }
});
const blogService = new WordPressBlogService(authService, aiService);

/**
 * Generate WordPress authorization URL
 */
router.post('/auth/authorize', async (req, res) => {
  try {
    const { siteUrl, clientId, redirectUri } = req.body;
    
    if (!siteUrl || !clientId || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: siteUrl, clientId, redirectUri'
      });
    }

    const authUrl = authService.generateAuthUrl(siteUrl, clientId, redirectUri);
    
    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Exchange OAuth code for access token
 */
router.post('/auth/token', async (req, res) => {
  try {
    const { siteUrl, clientId, clientSecret, code, redirectUri, state } = req.body;
    
    const result = await authService.exchangeCodeForToken(
      siteUrl,
      clientId,
      clientSecret,
      code,
      redirectUri,
      state
    );
    
    res.json({
      success: result.success,
      data: result.success ? {
        accessToken: result.accessToken,
        expiresIn: result.expiresIn
      } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Authenticate with Application Password
 */
router.post('/auth/application-password', async (req, res) => {
  try {
    const { siteUrl, username, applicationPassword } = req.body;
    
    if (!siteUrl || !username || !applicationPassword) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters'
      });
    }

    const result = await authService.authenticateWithApplicationPassword(
      siteUrl,
      username,
      applicationPassword
    );
    
    res.json({
      success: result.success,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test authentication for a site
 */
router.post('/auth/test', async (req, res) => {
  try {
    const { siteUrl } = req.body;
    
    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing siteUrl parameter'
      });
    }

    const result = await authService.testAuthentication(siteUrl);
    
    res.json({
      success: result.success,
      data: result.user || null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate blog post content
 */
router.post('/generate', async (req, res) => {
  try {
    const blogRequest = req.body;
    
    if (!blogRequest.topic) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: topic'
      });
    }

    const blogPost = await blogService.generateBlogPost(blogRequest);
    
    res.json({
      success: true,
      data: { blogPost }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Enhance existing blog content
 */
router.post('/enhance', async (req, res) => {
  try {
    const { content, enhancements } = req.body;
    
    if (!content || !enhancements) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: content, enhancements'
      });
    }

    const enhancedContent = await blogService.enhanceBlogContent(content, enhancements);
    
    res.json({
      success: true,
      data: { content: enhancedContent }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate meta description
 */
router.post('/meta-description', async (req, res) => {
  try {
    const { content, maxLength = 160 } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: content'
      });
    }

    const metaDescription = await blogService.generateMetaDescription(content, maxLength);
    
    res.json({
      success: true,
      data: { metaDescription }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Publish blog post to WordPress
 */
router.post('/publish', async (req, res) => {
  try {
    const { siteUrl, blogPost, options = {} } = req.body;
    
    if (!siteUrl || !blogPost) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: siteUrl, blogPost'
      });
    }

    const result = await blogService.publishToWordPress(siteUrl, blogPost, options);
    
    res.json({
      success: result.success,
      data: result.success ? {
        wordpressId: result.wordpressId,
        url: result.url
      } : null,
      error: result.error,
      warnings: result.warnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update existing WordPress post
 */
router.put('/posts/:wordpressId', async (req, res) => {
  try {
    const { wordpressId } = req.params;
    const { siteUrl, blogPost } = req.body;
    
    if (!siteUrl || !blogPost) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: siteUrl, blogPost'
      });
    }

    const result = await blogService.updateWordPressPost(
      siteUrl,
      parseInt(wordpressId),
      blogPost
    );
    
    res.json({
      success: result.success,
      data: result.success ? {
        wordpressId: result.wordpressId,
        url: result.url
      } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get WordPress taxonomies (categories and tags)
 */
router.get('/taxonomies', async (req, res) => {
  try {
    const { siteUrl } = req.query;
    
    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: siteUrl'
      });
    }

    const taxonomies = await blogService.getWordPressTaxonomies(siteUrl as string);
    
    res.json({
      success: true,
      data: taxonomies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get authenticated sites
 */
router.get('/sites', async (req, res) => {
  try {
    const sites = authService.getAuthenticatedSites().map(siteUrl => ({
      siteUrl,
      authMethod: authService.getAuthMethod(siteUrl)
    }));
    
    res.json({
      success: true,
      data: { sites }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Remove site credentials
 */
router.delete('/sites', async (req, res) => {
  try {
    const { siteUrl } = req.body;
    
    if (!siteUrl) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameter: siteUrl'
      });
    }

    const removed = authService.removeCredentials(siteUrl);
    
    res.json({
      success: true,
      data: { removed }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'WordPress Blog API',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

export default router;