import express from 'express';
import { LinkedInService } from '../services/LinkedInService.js';
import { createClient } from '@supabase/supabase-js';

const router = express.Router();

// Initialize LinkedIn service
let linkedInService: LinkedInService | null = null;

// Initialize service with environment variables
const initializeLinkedInService = () => {
  try {
    if (!linkedInService && process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET) {
      linkedInService = new LinkedInService({
        clientId: process.env.LINKEDIN_CLIENT_ID,
        clientSecret: process.env.LINKEDIN_CLIENT_SECRET
      });
    }
  } catch (error) {
    console.error('Error initializing LinkedIn service:', error);
  }
};

initializeLinkedInService();

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Middleware to check if LinkedIn service is initialized
const requireLinkedInService = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!linkedInService) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'LINKEDIN_SERVICE_UNAVAILABLE',
        message: 'LinkedIn service is not configured. Please set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.'
      }
    });
  }
  next();
};

/**
 * GET /api/v1/linkedin/status
 * Get LinkedIn integration status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      configured: !!linkedInService,
      ready: linkedInService?.isConfigured() || false,
      characterLimit: linkedInService?.getCharacterLimit() || 3000
    }
  });
});

/**
 * GET /api/v1/linkedin/auth-url
 * Generate LinkedIn OAuth URL
 */
router.get('/auth-url', requireLinkedInService, (req, res) => {
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

    const result = linkedInService!.generateAuthUrl(redirectUri);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Generate LinkedIn auth URL error:', error);
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
 * GET /api/v1/linkedin/callback
 * OAuth callback endpoint - handles LinkedIn redirect after authorization
 */
router.get('/callback', requireLinkedInService, async (req, res) => {
  try {
    const { code, state, error, error_description } = req.query;

    // Check for OAuth errors
    if (error) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>LinkedIn Authorization Failed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
            h1 { color: #c33; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Authorization Failed</h1>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Description:</strong> ${error_description || 'Unknown error'}</p>
            <p>Please close this window and try again.</p>
          </div>
        </body>
        </html>
      `);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Invalid Request</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Invalid Request</h1>
            <p>Authorization code is missing or invalid.</p>
          </div>
        </body>
        </html>
      `);
    }

    const redirectUri = `${req.protocol}://${req.get('host')}/api/v1/linkedin/callback`;

    // Exchange code for access token
    const tokenResult = await linkedInService!.exchangeCodeForToken(code, redirectUri);
    if (!tokenResult.success || !tokenResult.data) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Token Exchange Failed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Token Exchange Failed</h1>
            <p>${tokenResult.error?.message || 'Failed to exchange authorization code for access token'}</p>
          </div>
        </body>
        </html>
      `);
    }

    // Set access token for subsequent requests
    linkedInService!.setAccessToken(tokenResult.data.access_token);

    // Get user profile and organizations
    const connectionTest = await linkedInService!.testConnection();
    if (!connectionTest.success) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Connection Test Failed</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Connection Test Failed</h1>
            <p>${connectionTest.error?.message || 'Failed to retrieve LinkedIn profile and organizations'}</p>
          </div>
        </body>
        </html>
      `);
    }

    // Store the connection in database
    const connectionData = {
      platform: 'linkedin',
      account_name: `${connectionTest.data!.profile!.firstName} ${connectionTest.data!.profile!.lastName}`,
      account_id: connectionTest.data!.profile!.id,
      access_token: tokenResult.data.access_token,
      expires_at: new Date(Date.now() + (tokenResult.data.expires_in * 1000)).toISOString(),
      is_active: true,
      account_data: {
        organizations: connectionTest.data!.organizations || []
      }
    };

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert(connectionData, {
        onConflict: 'platform,account_id',
        ignoreDuplicates: false
      });

    if (dbError) {
      console.error('Database error storing LinkedIn connection:', dbError);
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Database Error</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>Database Error</h1>
            <p>Failed to store LinkedIn connection in database.</p>
            <p>Error: ${dbError.message}</p>
          </div>
        </body>
        </html>
      `);
    }

    // Success! Display confirmation page
    const orgsList = connectionTest.data!.organizations && connectionTest.data!.organizations.length > 0
      ? `<ul>${connectionTest.data!.organizations.map(org => `<li>${org.name || org.id}</li>`).join('')}</ul>`
      : '<p>No organizations found. You may only have access to post as your personal profile.</p>';

    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>LinkedIn Connected Successfully</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { background: #efe; border: 1px solid #cfc; padding: 20px; border-radius: 5px; }
          h1 { color: #3c3; }
          .info { background: #f9f9f9; padding: 15px; margin: 15px 0; border-radius: 5px; }
          code { background: #eee; padding: 2px 6px; border-radius: 3px; }
        </style>
      </head>
      <body>
        <div class="success">
          <h1>✓ LinkedIn Connected Successfully!</h1>
          <div class="info">
            <p><strong>Name:</strong> ${connectionTest.data!.profile!.firstName} ${connectionTest.data!.profile!.lastName}</p>
            <p><strong>Account ID:</strong> <code>${connectionTest.data!.profile!.id}</code></p>
            <p><strong>Token Expires:</strong> ${new Date(Date.now() + (tokenResult.data.expires_in * 1000)).toLocaleString()}</p>
          </div>
          <h3>Organizations You Can Post To:</h3>
          ${orgsList}
          <p style="margin-top: 20px;">Your LinkedIn account has been connected and stored in the database. You can now close this window.</p>
          <p style="color: #666; font-size: 14px;">Next step: Configure the organization ID in your Supabase social_accounts table to enable company page posting.</p>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('LinkedIn callback error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Server Error</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .error { background: #fee; border: 1px solid #fcc; padding: 20px; border-radius: 5px; }
        </style>
      </head>
      <body>
        <div class="error">
          <h1>Server Error</h1>
          <p>An unexpected error occurred while processing the LinkedIn authorization.</p>
          <p>${error instanceof Error ? error.message : 'Unknown error'}</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * POST /api/v1/linkedin/connect
 * Connect LinkedIn account using authorization code
 */
router.post('/connect', requireLinkedInService, async (req, res) => {
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
    const tokenResult = await linkedInService!.exchangeCodeForToken(code, redirectUri);
    if (!tokenResult.success || !tokenResult.data) {
      return res.status(400).json({
        success: false,
        error: tokenResult.error
      });
    }

    // Set access token for subsequent requests
    linkedInService!.setAccessToken(tokenResult.data.access_token);

    // Get user profile and organizations
    const connectionTest = await linkedInService!.testConnection();
    if (!connectionTest.success) {
      return res.status(400).json({
        success: false,
        error: connectionTest.error
      });
    }

    // Store the connection in database
    const connectionData = {
      platform: 'linkedin',
      account_name: `${connectionTest.data!.profile!.firstName} ${connectionTest.data!.profile!.lastName}`,
      account_id: connectionTest.data!.profile!.id,
      access_token: tokenResult.data.access_token,
      expires_at: new Date(Date.now() + (tokenResult.data.expires_in * 1000)).toISOString(),
      is_active: true
    };

    const { error: dbError } = await supabase
      .from('social_accounts')
      .upsert(connectionData, { 
        onConflict: 'platform,account_id',
        ignoreDuplicates: false 
      });

    if (dbError) {
      console.error('Database error storing LinkedIn connection:', dbError);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to store connection'
        }
      });
    }

    res.json({
      success: true,
      data: {
        access_token: tokenResult.data.access_token,
        expires_in: tokenResult.data.expires_in,
        profile: connectionTest.data!.profile,
        organizations: connectionTest.data!.organizations
      }
    });
  } catch (error) {
    console.error('LinkedIn connect error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'CONNECT_ERROR',
        message: 'Failed to connect LinkedIn account'
      }
    });
  }
});

/**
 * POST /api/v1/linkedin/publish
 * Publish directly to LinkedIn (immediate)
 */
router.post('/publish', requireLinkedInService, async (req, res) => {
  try {
    const { accessToken, postData, postAsOrganization = false, organizationId } = req.body;

    if (!accessToken || !postData) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'accessToken and postData are required'
        }
      });
    }

    // Validate post content
    const validation = linkedInService!.validatePost(postData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_POST_DATA',
          message: 'Post validation failed',
          details: validation.errors
        }
      });
    }

    linkedInService!.setAccessToken(accessToken);

    // Set organization if posting as organization
    if (postAsOrganization && organizationId) {
      linkedInService!.setOrganizationUrn(organizationId);
    } else {
      // Get user profile to set person URN
      await linkedInService!.getUserProfile();
    }

    const result = await linkedInService!.publishPost(postData, postAsOrganization);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('LinkedIn publish error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'PUBLISH_ERROR',
        message: 'Failed to publish to LinkedIn'
      }
    });
  }
});

/**
 * POST /api/v1/linkedin/schedule
 * Schedule a LinkedIn post
 */
router.post('/schedule', requireLinkedInService, async (req, res) => {
  try {
    const { accessToken, postData, publishTime, postAsOrganization = false, organizationId } = req.body;

    if (!accessToken || !postData || !publishTime) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'accessToken, postData, and publishTime are required'
        }
      });
    }

    // Validate post content
    const validation = linkedInService!.validatePost(postData);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_POST_DATA',
          message: 'Post validation failed',
          details: validation.errors
        }
      });
    }

    // Store scheduled post in database
    const scheduledPost = {
      content_id: req.body.contentId || `linkedin-${Date.now()}`,
      platform: 'linkedin',
      account_id: req.body.accountId, // Should be passed from frontend
      status: 'scheduled',
      scheduled_time: new Date(publishTime).toISOString(),
      post_data: {
        ...postData,
        accessToken, // Store for later use
        postAsOrganization,
        organizationId
      },
      retry_count: 0,
      max_retries: 3
    };

    const { data, error } = await supabase
      .from('social_posts')
      .insert([scheduledPost])
      .select()
      .single();

    if (error) {
      console.error('Database error scheduling LinkedIn post:', error);
      return res.status(500).json({
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to schedule post'
        }
      });
    }

    res.json({
      success: true,
      data: {
        id: data.id,
        scheduled_time: data.scheduled_time,
        status: data.status
      }
    });
  } catch (error) {
    console.error('LinkedIn schedule error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'SCHEDULE_ERROR',
        message: 'Failed to schedule LinkedIn post'
      }
    });
  }
});

/**
 * GET /api/v1/linkedin/profile
 * Get user's LinkedIn profile
 */
router.get('/profile', requireLinkedInService, async (req, res) => {
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

    linkedInService!.setAccessToken(accessToken);
    const result = await linkedInService!.getUserProfile();

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get LinkedIn profile error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_PROFILE_ERROR',
        message: 'Failed to get LinkedIn profile'
      }
    });
  }
});

/**
 * GET /api/v1/linkedin/organizations
 * Get user's LinkedIn organizations
 */
router.get('/organizations', requireLinkedInService, async (req, res) => {
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

    linkedInService!.setAccessToken(accessToken);
    const result = await linkedInService!.getUserOrganizations();

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get LinkedIn organizations error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ORGANIZATIONS_ERROR',
        message: 'Failed to get LinkedIn organizations'
      }
    });
  }
});

/**
 * GET /api/v1/linkedin/posts
 * Get user's recent LinkedIn posts
 */
router.get('/posts', requireLinkedInService, async (req, res) => {
  try {
    const { accessToken, count = 20, organizationId } = req.query;

    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    linkedInService!.setAccessToken(accessToken);

    const postAsOrganization = !!organizationId;
    if (postAsOrganization) {
      linkedInService!.setOrganizationUrn(organizationId as string);
    } else {
      await linkedInService!.getUserProfile();
    }

    const result = await linkedInService!.getUserPosts(
      parseInt(count as string), 
      postAsOrganization
    );

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get LinkedIn posts error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_POSTS_ERROR',
        message: 'Failed to get LinkedIn posts'
      }
    });
  }
});

/**
 * POST /api/v1/linkedin/upload-media
 * Upload media to LinkedIn
 */
router.post('/upload-media', requireLinkedInService, async (req, res) => {
  try {
    const { accessToken, mediaUrl, mediaType = 'image' } = req.body;

    if (!accessToken || !mediaUrl) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'accessToken and mediaUrl are required'
        }
      });
    }

    linkedInService!.setAccessToken(accessToken);

    // Get user profile to set person URN
    await linkedInService!.getUserProfile();

    const result = await linkedInService!.uploadMedia(mediaUrl, mediaType);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('LinkedIn upload media error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'UPLOAD_ERROR',
        message: 'Failed to upload media to LinkedIn'
      }
    });
  }
});

/**
 * GET /api/v1/linkedin/analytics/:postUrn
 * Get LinkedIn post analytics
 */
router.get('/analytics/:postUrn', requireLinkedInService, async (req, res) => {
  try {
    const { postUrn } = req.params;
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

    linkedInService!.setAccessToken(accessToken);
    const result = await linkedInService!.getPostAnalytics(postUrn);

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('Get LinkedIn analytics error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'GET_ANALYTICS_ERROR',
        message: 'Failed to get LinkedIn post analytics'
      }
    });
  }
});

/**
 * POST /api/v1/linkedin/test-connection
 * Test LinkedIn API connection
 */
router.post('/test-connection', requireLinkedInService, async (req, res) => {
  try {
    const { accessToken } = req.body;

    if (!accessToken) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ACCESS_TOKEN',
          message: 'Access token is required'
        }
      });
    }

    linkedInService!.setAccessToken(accessToken);
    const result = await linkedInService!.testConnection();

    res.json(result);
  } catch (error) {
    console.error('LinkedIn test connection error:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'TEST_CONNECTION_ERROR',
        message: 'Failed to test LinkedIn connection'
      }
    });
  }
});

export default router;