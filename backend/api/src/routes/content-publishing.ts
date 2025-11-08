import express from 'express';
import { ContentPublishingService } from '../services/ContentPublishingService.js';
import { SupabaseService, ContentItem } from '../services/SupabaseService.js';
import { SocialMediaOrchestrator } from '../services/SocialMediaOrchestrator.js';

const router = express.Router();

// Initialize services
let contentPublishingService: ContentPublishingService | null = null;
let supabaseService: SupabaseService | null = null;
let socialMediaOrchestrator: SocialMediaOrchestrator | null = null;

// Initialize services with environment variables
const initializeServices = async () => {
  try {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
      console.log('⚠️  Supabase credentials not configured for content publishing');
      return;
    }

    if (!contentPublishingService) {
      contentPublishingService = new ContentPublishingService(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      await contentPublishingService.initialize();
    }

    if (!supabaseService) {
      supabaseService = new SupabaseService(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY
      );
      await supabaseService.initialize();
    }

    if (!socialMediaOrchestrator) {
      const linkedinConfig = process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET ? {
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET
      } : undefined;

      socialMediaOrchestrator = new SocialMediaOrchestrator(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        linkedinConfig
      );
      const initialized = await socialMediaOrchestrator.initialize();
      
      if (initialized) {
        // Start the scheduler for automatic post processing
        socialMediaOrchestrator.startScheduler();
        console.log('🚀 SocialMediaOrchestrator scheduler started');
      }
    }
  } catch (error) {
    console.error('Error initializing content publishing services:', error);
  }
};

initializeServices();

// Middleware to check if services are initialized
const requireServices = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  // If services aren't initialized yet, try to initialize them now
  if (!contentPublishingService || !supabaseService) {
    await initializeServices();
  }

  // Check again after initialization attempt
  if (!contentPublishingService || !supabaseService) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'SERVICES_UNAVAILABLE',
        message: 'Content publishing services are not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY.'
      }
    });
  }
  next();
};

/**
 * POST /api/v1/content-publishing/webhook
 * Webhook endpoint for content publication events
 */
router.post('/webhook', requireServices, async (req, res) => {
  try {
    const { content_id, action, content_item } = req.body;

    if (!content_id || !action) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'content_id and action are required'
        }
      });
    }

    console.log(`📡 Content webhook received: ${action} for content ${content_id}`);

    // Handle different actions
    if (action === 'published' || action === 'content.published') {
      let contentData: ContentItem;

      // Use provided content_item or fetch from database
      if (content_item) {
        contentData = content_item;
      } else {
        const fetchedContent = await supabaseService!.getContentItemById(content_id);
        if (!fetchedContent) {
          return res.status(404).json({
            success: false,
            error: {
              code: 'CONTENT_NOT_FOUND',
              message: `Content item with ID ${content_id} not found`
            }
          });
        }
        contentData = fetchedContent;
      }

      // Only process published content
      if (contentData.status !== 'published') {
        return res.json({
          success: true,
          message: `Content status is '${contentData.status}', skipping social media processing`
        });
      }

      // Process content for social media publishing
      const results = await contentPublishingService!.handleContentPublished(contentData);

      res.json({
        success: true,
        message: 'Content processed for social media publishing',
        results: results
      });

    } else if (action === 'updated' || action === 'content.updated') {
      // Handle content updates - could trigger social media updates
      res.json({
        success: true,
        message: 'Content update webhook received - social media updates not yet implemented'
      });

    } else {
      res.json({
        success: true,
        message: `Webhook action '${action}' received but not processed`
      });
    }

  } catch (error) {
    console.error('Content publishing webhook error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_ERROR',
        message: 'Failed to process content publishing webhook',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/trigger/:contentId
 * Manually trigger social media publishing for specific content
 */
router.post('/trigger/:contentId', requireServices, async (req, res) => {
  try {
    const { contentId } = req.params;

    // Fetch content from database
    const contentItem = await supabaseService!.getContentItemById(contentId);
    if (!contentItem) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'CONTENT_NOT_FOUND',
          message: `Content item with ID ${contentId} not found`
        }
      });
    }

    // Process content for social media publishing
    const results = await contentPublishingService!.handleContentPublished(contentItem);

    res.json({
      success: true,
      message: `Manually triggered social media publishing for "${contentItem.title}"`,
      results: results
    });

  } catch (error) {
    console.error('Manual content publishing trigger error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TRIGGER_ERROR',
        message: 'Failed to trigger social media publishing',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/v1/content-publishing/pending
 * Get pending social media posts
 */
router.get('/pending', requireServices, async (req, res) => {
  try {
    const pendingPosts = await contentPublishingService!.getPendingPosts();

    res.json({
      success: true,
      data: {
        pending_posts: pendingPosts,
        count: pendingPosts.length
      }
    });

  } catch (error) {
    console.error('Get pending posts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PENDING_ERROR',
        message: 'Failed to fetch pending posts',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/v1/content-publishing/content/:contentId/social
 * Get social media posts for specific content
 */
router.get('/content/:contentId/social', requireServices, async (req, res) => {
  try {
    const { contentId } = req.params;

    // This would require additional query methods in ContentPublishingService
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Social media posts for content retrieval not yet implemented',
      data: {
        content_id: contentId,
        social_posts: []
      }
    });

  } catch (error) {
    console.error('Get content social posts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_CONTENT_SOCIAL_ERROR',
        message: 'Failed to fetch social media posts for content',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/posts/:postId/status
 * Update social media post status
 */
router.post('/posts/:postId/status', requireServices, async (req, res) => {
  try {
    const { postId } = req.params;
    const { status, platform_post_id, error_message, analytics_data } = req.body;

    if (!status || !['published', 'failed', 'cancelled'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_STATUS',
          message: 'Status must be one of: published, failed, cancelled'
        }
      });
    }

    const updates: any = {};
    
    if (platform_post_id) {
      updates.platform_post_id = platform_post_id;
    }
    
    if (error_message) {
      updates.error_message = error_message;
    }
    
    if (analytics_data) {
      updates.analytics_data = analytics_data;
    }

    await contentPublishingService!.updateSocialPostStatus(postId, status, updates);

    res.json({
      success: true,
      message: `Social media post status updated to '${status}'`
    });

  } catch (error) {
    console.error('Update post status error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPDATE_STATUS_ERROR',
        message: 'Failed to update social media post status',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/orchestrator/process
 * Manually trigger orchestrator to process pending posts
 */
router.post('/orchestrator/process', requireServices, async (req, res) => {
  try {
    if (!socialMediaOrchestrator) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'ORCHESTRATOR_UNAVAILABLE',
          message: 'Social media orchestrator is not initialized'
        }
      });
    }

    const result = await socialMediaOrchestrator.processPendingPosts();
    
    res.json({
      success: true,
      message: 'Orchestrator processing completed',
      data: result
    });

  } catch (error) {
    console.error('Orchestrator process error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'ORCHESTRATOR_PROCESS_ERROR',
        message: 'Failed to process pending posts',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/orchestrator/publish/:postId
 * Manually publish a specific post now
 */
router.post('/orchestrator/publish/:postId', requireServices, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!socialMediaOrchestrator) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'ORCHESTRATOR_UNAVAILABLE',
          message: 'Social media orchestrator is not initialized'
        }
      });
    }

    const result = await socialMediaOrchestrator.publishPostNow(postId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Post published successfully',
        data: {
          post_id: result.post_id
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'PUBLISH_ERROR',
          message: result.error || 'Failed to publish post'
        }
      });
    }

  } catch (error) {
    console.error('Manual publish error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MANUAL_PUBLISH_ERROR',
        message: 'Failed to manually publish post',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/orchestrator/cancel/:postId
 * Cancel a scheduled post
 */
router.post('/orchestrator/cancel/:postId', requireServices, async (req, res) => {
  try {
    const { postId } = req.params;

    if (!socialMediaOrchestrator) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'ORCHESTRATOR_UNAVAILABLE',
          message: 'Social media orchestrator is not initialized'
        }
      });
    }

    const result = await socialMediaOrchestrator.cancelPost(postId);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Post cancelled successfully'
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'CANCEL_ERROR',
          message: result.error || 'Failed to cancel post'
        }
      });
    }

  } catch (error) {
    console.error('Cancel post error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CANCEL_POST_ERROR',
        message: 'Failed to cancel post',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * GET /api/v1/content-publishing/orchestrator/stats
 * Get orchestrator statistics
 */
router.get('/orchestrator/stats', requireServices, async (req, res) => {
  try {
    if (!socialMediaOrchestrator) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'ORCHESTRATOR_UNAVAILABLE',
          message: 'Social media orchestrator is not initialized'
        }
      });
    }

    const stats = await socialMediaOrchestrator.getStats();
    
    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error('Get orchestrator stats error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_STATS_ERROR',
        message: 'Failed to get orchestrator statistics',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * POST /api/v1/content-publishing/multi-channel
 * Create content and publish to multiple channels (WordPress + LinkedIn)
 */
router.post('/multi-channel', requireServices, async (req, res) => {
  try {
    const { content, publishing_options } = req.body;

    if (!content || !publishing_options) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'content and publishing_options are required'
        }
      });
    }

    console.log(`🚀 Multi-channel publishing request: ${content.title}`);
    console.log(`📋 Publishing options:`, publishing_options);

    // First, create the content item in our CMS
    const contentItem = await supabaseService!.createContentItem({
      id: `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content_type_id: 'blog-post',
      title: content.title,
      content: { text: content.content },
      slug: content.slug,
      featured_image_url: content.featured_image_url,
      status: content.status || 'published'
    });

    const results: any = {
      success: true,
      content: contentItem,
      publishing_results: {}
    };

    // Handle WordPress publishing
    if (publishing_options.publishToWordPress) {
      try {
        console.log(`📝 Publishing to WordPress for company: ${publishing_options.companyBranding}`);
        
        const wordpressResult = await publishToWordPress(contentItem, publishing_options);
        results.publishing_results.wordpress = wordpressResult;
        
        console.log(`✅ WordPress publishing result:`, wordpressResult);
      } catch (error) {
        console.error(`❌ WordPress publishing failed:`, error);
        results.publishing_results.wordpress = {
          success: false,
          message: 'Failed to publish to WordPress',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Handle LinkedIn publishing
    if (publishing_options.publishToLinkedIn) {
      try {
        console.log(`💼 Publishing to LinkedIn for company: ${publishing_options.companyBranding}`);
        
        const linkedinResults = await contentPublishingService!.handleContentPublished(contentItem);
        const linkedinResult = linkedinResults[0] || { success: false, message: 'No LinkedIn accounts configured' };
        
        results.publishing_results.linkedin = {
          success: linkedinResult.success,
          message: linkedinResult.message,
          social_post_id: linkedinResult.social_post_id,
          mapping_id: linkedinResult.mapping_id,
          error: linkedinResult.error?.message
        };
        
        console.log(`✅ LinkedIn publishing result:`, linkedinResult);
      } catch (error) {
        console.error(`❌ LinkedIn publishing failed:`, error);
        results.publishing_results.linkedin = {
          success: false,
          message: 'Failed to publish to LinkedIn',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }

    // Set overall success based on requested publishing options
    const requestedPublishing = [
      publishing_options.publishToWordPress,
      publishing_options.publishToLinkedIn
    ].filter(Boolean).length;

    const successfulPublishing = [
      results.publishing_results.wordpress?.success,
      results.publishing_results.linkedin?.success
    ].filter(Boolean).length;

    results.success = successfulPublishing > 0; // At least one channel succeeded
    results.partial_success = requestedPublishing > successfulPublishing && successfulPublishing > 0;

    console.log(`📊 Multi-channel publishing summary: ${successfulPublishing}/${requestedPublishing} channels successful`);

    res.json({
      success: true,
      message: results.partial_success 
        ? `Content published with partial success (${successfulPublishing}/${requestedPublishing} channels)`
        : `Content successfully published to ${successfulPublishing} channel(s)`,
      data: results
    });

  } catch (error) {
    console.error('Multi-channel publishing error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'MULTI_CHANNEL_PUBLISHING_ERROR',
        message: 'Failed to publish content to multiple channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      }
    });
  }
});

/**
 * Helper function to publish content to WordPress
 */
async function publishToWordPress(contentItem: any, publishingOptions: any): Promise<any> {
  // WordPress webhook URL (this should be configured based on the company)
  const wordpressWebhookUrl = getWordPressWebhookUrl(publishingOptions.companyBranding);
  
  if (!wordpressWebhookUrl) {
    throw new Error(`WordPress webhook URL not configured for company: ${publishingOptions.companyBranding}`);
  }

  // Transform content for WordPress webhook format (matches plugin expectations)
  const wordpressContent = {
    event: 'created',
    content_id: contentItem.id,
    content: {
      id: contentItem.id,
      title: contentItem.title,
      content: contentItem.content,
      slug: contentItem.slug,
      status: 'published',
      type: 'post',
      meta: {
        source: 'headless_cms',
        company: publishingOptions.companyBranding,
        created_at: contentItem.created_at
      }
    }
  };

  try {
    const axios = require('axios');
    const crypto = require('crypto');
    
    // Create webhook security headers
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify(wordpressContent);
    const webhookSecret = getWordPressWebhookSecret(publishingOptions.companyBranding);
    const signature = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
    
    const response = await axios.post(wordpressWebhookUrl, wordpressContent, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'CMS-Automation/1.0',
        'X-CMS-Signature': `sha256=${signature}`,
        'X-CMS-Timestamp': timestamp.toString()
      },
      timeout: 30000 // 30 second timeout
    });

    return {
      success: true,
      message: 'Successfully published to WordPress',
      post_id: response.data?.post_id || response.data?.id,
      wordpress_url: response.data?.url
    };
  } catch (error: any) {
    throw new Error(`WordPress publishing failed: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Helper function to get WordPress webhook URL based on company branding
 */
function getWordPressWebhookUrl(companyBranding: string): string | null {
  const webhookUrls: Record<string, string> = {
    'haidrun': process.env.HAIDRUN_WORDPRESS_WEBHOOK_URL || 'https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/content',
    'personal': process.env.PERSONAL_WORDPRESS_WEBHOOK_URL || null
  };

  return webhookUrls[companyBranding] || null;
}

/**
 * Helper function to get WordPress webhook secret based on company branding
 */
function getWordPressWebhookSecret(companyBranding: string): string {
  const webhookSecrets: Record<string, string> = {
    'haidrun': process.env.HAIDRUN_WORDPRESS_WEBHOOK_SECRET || 'default-haidrun-secret',
    'personal': process.env.PERSONAL_WORDPRESS_WEBHOOK_SECRET || 'default-personal-secret'
  };

  return webhookSecrets[companyBranding] || 'default-secret';
}

/**
 * GET /api/v1/content-publishing/status
 * Get content publishing service status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      content_publishing_service: !!contentPublishingService,
      supabase_service: !!supabaseService,
      social_media_orchestrator: !!socialMediaOrchestrator,
      orchestrator_healthy: socialMediaOrchestrator?.isHealthy() || false,
      ready: !!(contentPublishingService && supabaseService && socialMediaOrchestrator),
      wordpress_webhooks: {
        haidrun: {
          url_configured: !!process.env.HAIDRUN_WORDPRESS_WEBHOOK_URL,
          secret_configured: !!process.env.HAIDRUN_WORDPRESS_WEBHOOK_SECRET
        },
        personal: {
          url_configured: !!process.env.PERSONAL_WORDPRESS_WEBHOOK_URL,
          secret_configured: !!process.env.PERSONAL_WORDPRESS_WEBHOOK_SECRET
        }
      }
    }
  });
});

export default router;