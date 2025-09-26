import express from 'express';
import { FacebookService } from '../services/FacebookService.js';
import { SocialSchedulerService } from '../services/SocialSchedulerService.js';
import crypto from 'crypto';

const router = express.Router();

// Initialize services
let facebookService: FacebookService | null = null;
let schedulerService: SocialSchedulerService | null = null;

// Initialize services with environment variables
const initializeServices = () => {
  try {
    if (!facebookService && process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
      facebookService = new FacebookService({
        appId: process.env.FACEBOOK_APP_ID,
        appSecret: process.env.FACEBOOK_APP_SECRET
      });
    }

    if (!schedulerService) {
      schedulerService = new SocialSchedulerService();
    }
  } catch (error) {
    console.error('Error initializing social media services:', error);
  }
};

initializeServices();

// Middleware to check if services are initialized
const requireServices = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!schedulerService) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Social media services are not properly configured'
      }
    });
  }
  next();
};

const requireFacebookService = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!facebookService) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'FACEBOOK_SERVICE_UNAVAILABLE',
        message: 'Facebook service is not configured. Please set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET.'
      }
    });
  }
  next();
};

/**
 * GET /api/v1/social/status
 * Get social media integration status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      services: {
        facebook: {
          configured: !!facebookService,
          ready: facebookService?.isConfigured() || false
        },
        scheduler: {
          configured: !!schedulerService,
          ready: true
        },
        twitter: {
          configured: false,
          ready: false,
          status: 'not_implemented'
        },
        linkedin: {
          configured: false,
          ready: false,
          status: 'not_implemented'
        },
        instagram: {
          configured: false,
          ready: false,
          status: 'not_implemented'
        }
      }
    }
  });
});

/**
 * POST /api/v1/social/schedule
 * Schedule posts across multiple platforms
 */
router.post('/schedule', requireServices, async (req, res) => {
  try {
    const { contentId, platforms, content, customScheduleTime, useOptimalTiming = true } = req.body;

    if (!contentId || !platforms || !Array.isArray(platforms) || !content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'contentId, platforms array, and content are required'
        }
      });
    }

    if (!content.message) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT',
          message: 'Content message is required'
        }
      });
    }

    const result = await schedulerService!.scheduleMultiPlatformPost({
      contentId,
      platforms,
      content,
      customScheduleTime,
      useOptimalTiming
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.status(201).json(result);
  } catch (error) {
    console.error('Schedule post error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: 'Failed to schedule posts'
      }
    });
  }
});

/**
 * GET /api/v1/social/posts/:contentId
 * Get scheduled posts for content
 */
router.get('/posts/:contentId', requireServices, async (req, res) => {
  try {
    const { contentId } = req.params;
    const result = await schedulerService!.getScheduledPosts(contentId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_POSTS_ERROR',
        message: 'Failed to get scheduled posts'
      }
    });
  }
});

/**
 * POST /api/v1/social/posts/:postId/publish
 * Publish a scheduled post immediately
 */
router.post('/posts/:postId/publish', requireServices, async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await schedulerService!.publishPost(postId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Publish post error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: 'Failed to publish post'
      }
    });
  }
});

/**
 * DELETE /api/v1/social/posts/:postId
 * Cancel a scheduled post
 */
router.delete('/posts/:postId', requireServices, async (req, res) => {
  try {
    const { postId } = req.params;
    const result = await schedulerService!.cancelScheduledPost(postId);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      message: 'Post cancelled successfully'
    });
  } catch (error) {
    console.error('Cancel post error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCEL_ERROR',
        message: 'Failed to cancel post'
      }
    });
  }
});

/**
 * GET /api/v1/social/analytics
 * Get social media analytics
 */
router.get('/analytics', requireServices, async (req, res) => {
  try {
    const { timeRange = '30d' } = req.query;
    const result = await schedulerService!.getAnalytics(timeRange as any);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ANALYTICS_ERROR',
        message: 'Failed to get analytics'
      }
    });
  }
});

// Facebook-specific routes

/**
 * GET /api/v1/social/facebook/auth-url
 * Generate Facebook OAuth URL
 */
router.get('/facebook/auth-url', requireFacebookService, (req, res) => {
  try {
    const { redirectUri } = req.query;
    
    if (!redirectUri || typeof redirectUri !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REDIRECT_URI',
          message: 'redirectUri query parameter is required'
        }
      });
    }

    const result = facebookService!.generateAuthUrl(redirectUri);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Generate auth URL error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AUTH_URL_ERROR',
        message: 'Failed to generate authentication URL'
      }
    });
  }
});

/**
 * POST /api/v1/social/facebook/connect
 * Connect Facebook account using authorization code
 */
router.post('/facebook/connect', requireFacebookService, async (req, res) => {
  try {
    const { code, redirectUri, state } = req.body;

    if (!code || !redirectUri) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Authorization code and redirect URI are required'
        }
      });
    }

    // Exchange code for access token
    const tokenResult = await facebookService!.exchangeCodeForToken(code, redirectUri);
    if (!tokenResult.success || !tokenResult.data) {
      return res.status(400).json({
        success: false,
        error: tokenResult.error
      });
    }

    // Get long-lived token
    const longLivedResult = await facebookService!.getLongLivedToken(tokenResult.data.access_token);
    if (!longLivedResult.success || !longLivedResult.data) {
      return res.status(400).json({
        success: false,
        error: longLivedResult.error
      });
    }

    // Get user pages
    const pagesResult = await facebookService!.getUserPages(longLivedResult.data.access_token);
    if (!pagesResult.success || !pagesResult.data) {
      return res.status(400).json({
        success: false,
        error: pagesResult.error
      });
    }

    res.json({
      success: true,
      data: {
        access_token: longLivedResult.data.access_token,
        expires_in: longLivedResult.data.expires_in,
        pages: pagesResult.data
      }
    });
  } catch (error) {
    console.error('Facebook connect error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONNECT_ERROR',
        message: 'Failed to connect Facebook account'
      }
    });
  }
});

/**
 * POST /api/v1/social/facebook/publish
 * Publish directly to Facebook (immediate)
 */
router.post('/facebook/publish', requireFacebookService, async (req, res) => {
  try {
    const { pageAccessToken, pageId, postData } = req.body;

    if (!pageAccessToken || !pageId || !postData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'pageAccessToken, pageId, and postData are required'
        }
      });
    }

    facebookService!.setPageAccessToken(pageAccessToken, pageId);
    const result = await facebookService!.publishPost(postData);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Facebook publish error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: 'Failed to publish to Facebook'
      }
    });
  }
});

/**
 * POST /api/v1/social/facebook/schedule
 * Schedule a Facebook post
 */
router.post('/facebook/schedule', requireFacebookService, async (req, res) => {
  try {
    const { pageAccessToken, pageId, postData, publishTime } = req.body;

    if (!pageAccessToken || !pageId || !postData || !publishTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'pageAccessToken, pageId, postData, and publishTime are required'
        }
      });
    }

    facebookService!.setPageAccessToken(pageAccessToken, pageId);
    const result = await facebookService!.schedulePost(postData, new Date(publishTime));

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Facebook schedule error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: 'Failed to schedule Facebook post'
      }
    });
  }
});

/**
 * GET /api/v1/social/facebook/pages
 * Get user's Facebook pages
 */
router.get('/facebook/pages', requireFacebookService, async (req, res) => {
  try {
    const { accessToken } = req.query;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    const result = await facebookService!.getUserPages(accessToken);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get Facebook pages error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PAGES_ERROR',
        message: 'Failed to get Facebook pages'
      }
    });
  }
});

/**
 * GET /api/v1/social/facebook/insights/:postId
 * Get Facebook post insights
 */
router.get('/facebook/insights/:postId', requireFacebookService, async (req, res) => {
  try {
    const { postId } = req.params;
    const { accessToken } = req.query;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    // Set access token temporarily for this request
    const originalToken = (facebookService as any).config?.accessToken;
    (facebookService as any).config.accessToken = accessToken;

    const result = await facebookService!.getPostInsights(postId);

    // Restore original token
    if (originalToken) {
      (facebookService as any).config.accessToken = originalToken;
    }

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get Facebook insights error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_INSIGHTS_ERROR',
        message: 'Failed to get Facebook post insights'
      }
    });
  }
});

/**
 * POST /api/v1/social/webhook/facebook
 * Facebook webhook endpoint
 */
router.post('/webhook/facebook', (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256'] as string;
    const payload = JSON.stringify(req.body);

    if (!process.env.FACEBOOK_APP_SECRET) {
      return res.status(500).json({
        success: false,
        error: 'Facebook app secret not configured'
      });
    }

    // Verify webhook signature
    if (!FacebookService.verifyWebhookSignature(payload, signature, process.env.FACEBOOK_APP_SECRET)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid webhook signature'
      });
    }

    // Process webhook payload
    console.log('Facebook webhook received:', payload);
    
    // TODO: Process webhook events (post updates, comments, etc.)
    
    res.json({ success: true });
  } catch (error) {
    console.error('Facebook webhook error:', error);
    res.status(500).json({
      success: false,
      error: 'Webhook processing failed'
    });
  }
});

/**
 * GET /api/v1/social/webhook/facebook
 * Facebook webhook verification
 */
router.get('/webhook/facebook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  // Verify the webhook
  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    console.log('Facebook webhook verified');
    res.status(200).send(challenge);
  } else {
    console.error('Facebook webhook verification failed');
    res.status(403).send('Forbidden');
  }
});

export default router;