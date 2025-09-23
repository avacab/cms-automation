import { logger } from '../utils/logger.js';

export class AuthHandler {
  constructor(shopifyApi, sessionStorage) {
    this.shopify = shopifyApi;
    this.sessionStorage = sessionStorage;
  }

  async handleAuth(req, res) {
    try {
      const { shop } = req.query;
      
      if (!shop) {
        return res.status(400).json({
          error: 'Missing shop parameter'
        });
      }

      // Validate shop domain
      if (!this.isValidShopDomain(shop)) {
        return res.status(400).json({
          error: 'Invalid shop domain'
        });
      }

      logger.info(`Starting OAuth flow for shop: ${shop}`);

      // Create authorization URL
      const authRoute = await this.shopify.auth.begin({
        shop,
        callbackPath: '/auth/callback',
        isOnline: false, // Use offline tokens for background operations
      });

      logger.info(`Redirecting to Shopify OAuth: ${authRoute}`);
      return res.redirect(authRoute);

    } catch (error) {
      logger.error('Auth initiation failed:', error);
      return res.status(500).json({
        error: 'Authentication initiation failed',
        message: error.message
      });
    }
  }

  async handleAuthCallback(req, res) {
    try {
      const { shop, code, state, hmac, timestamp } = req.query;

      if (!shop || !code) {
        return res.status(400).json({
          error: 'Missing required OAuth parameters'
        });
      }

      logger.info(`Processing OAuth callback for shop: ${shop}`);

      // Complete the OAuth flow
      const callbackResponse = await this.shopify.auth.callback({
        rawRequest: req,
        rawResponse: res,
      });

      const { session } = callbackResponse;

      if (!session) {
        throw new Error('No session returned from OAuth callback');
      }

      // Store the session
      await this.sessionStorage.storeSession(session);
      
      logger.info(`OAuth completed successfully for shop: ${shop}`, {
        sessionId: session.id,
        accessToken: session.accessToken ? 'present' : 'missing',
        scope: session.scope
      });

      // Setup webhooks after successful authentication
      try {
        await this.setupInitialConfiguration(session);
      } catch (webhookError) {
        logger.error('Failed to setup initial configuration:', webhookError);
        // Don't fail the auth flow if webhook setup fails
      }

      // Redirect to success page or app dashboard
      const redirectUrl = process.env.AUTH_SUCCESS_REDIRECT_URL || '/dashboard';
      return res.redirect(redirectUrl);

    } catch (error) {
      logger.error('OAuth callback failed:', error);
      
      // Redirect to error page or show error
      const errorUrl = process.env.AUTH_ERROR_REDIRECT_URL || '/auth/error';
      return res.redirect(`${errorUrl}?error=${encodeURIComponent(error.message)}`);
    }
  }

  async setupInitialConfiguration(session) {
    try {
      logger.info('Setting up initial configuration for shop:', session.shop);

      // Import dependencies here to avoid circular imports
      const { GraphQLClient } = await import('../services/graphql-client.js');
      const { WebhookHandler } = await import('./webhook-handler.js');
      
      const graphqlClient = new GraphQLClient(this.shopify);
      const webhookHandler = new WebhookHandler(null); // SyncManager will be set later
      
      // Setup required webhooks
      const callbackUrl = process.env.WEBHOOK_CALLBACK_URL || 
                         `${process.env.HOST || 'https://localhost:3000'}`;
      
      const webhookResults = await webhookHandler.setupWebhooks(
        graphqlClient, 
        session, 
        callbackUrl
      );

      logger.info('Webhook setup completed:', {
        shop: session.shop,
        successful: webhookResults.filter(r => r.success).length,
        failed: webhookResults.filter(r => !r.success).length
      });

      // Store initial shop configuration
      await this.storeShopConfiguration(session, webhookResults);

    } catch (error) {
      logger.error('Initial configuration setup failed:', error);
      throw error;
    }
  }

  async storeShopConfiguration(session, webhookResults) {
    const config = {
      shop: session.shop,
      accessToken: session.accessToken,
      scope: session.scope,
      isOnline: session.isOnline,
      webhooks: webhookResults,
      configuredAt: new Date().toISOString(),
      status: 'active'
    };

    // Store in your preferred storage (database, file, etc.)
    // For now, we'll use a simple file-based approach
    const fs = await import('fs/promises');
    const path = await import('path');
    
    try {
      const configDir = 'config/shops';
      await fs.mkdir(configDir, { recursive: true });
      
      const configFile = path.join(configDir, `${session.shop}.json`);
      await fs.writeFile(configFile, JSON.stringify(config, null, 2));
      
      logger.info(`Shop configuration saved to ${configFile}`);
    } catch (error) {
      logger.error('Failed to save shop configuration:', error);
      // Don't throw here as this is not critical for the auth flow
    }
  }

  async getSession(shop) {
    try {
      const sessionId = this.shopify.session.getOfflineId(shop);
      const session = await this.sessionStorage.loadSession(sessionId);
      
      if (!session) {
        logger.warn(`No session found for shop: ${shop}`);
        return null;
      }

      // Check if session is still valid
      if (this.isSessionExpired(session)) {
        logger.warn(`Session expired for shop: ${shop}`);
        await this.sessionStorage.deleteSession(sessionId);
        return null;
      }

      return session;
    } catch (error) {
      logger.error(`Failed to get session for shop ${shop}:`, error);
      return null;
    }
  }

  async validateRequest(req, res, next) {
    try {
      const { shop } = req.query;
      
      if (!shop) {
        return res.status(400).json({
          error: 'Shop parameter required'
        });
      }

      const session = await this.getSession(shop);
      
      if (!session) {
        return res.status(401).json({
          error: 'Authentication required',
          authUrl: `/auth?shop=${encodeURIComponent(shop)}`
        });
      }

      // Attach session to request for use in route handlers
      req.session = session;
      req.shop = shop;
      
      next();
    } catch (error) {
      logger.error('Request validation failed:', error);
      return res.status(500).json({
        error: 'Request validation failed',
        message: error.message
      });
    }
  }

  isValidShopDomain(shop) {
    const shopDomainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-]*\.myshopify\.com$/;
    return shopDomainRegex.test(shop);
  }

  isSessionExpired(session) {
    // Offline tokens don't expire, but we can check if they're still valid
    // by testing an API call or checking session metadata
    return false; // For offline tokens, we'll assume they're valid
  }

  async revokeAccess(shop) {
    try {
      logger.info(`Revoking access for shop: ${shop}`);
      
      const sessionId = this.shopify.session.getOfflineId(shop);
      await this.sessionStorage.deleteSession(sessionId);
      
      // Clean up shop configuration
      const fs = await import('fs/promises');
      const path = await import('path');
      const configFile = path.join('config/shops', `${shop}.json`);
      
      try {
        await fs.unlink(configFile);
        logger.info(`Shop configuration deleted: ${configFile}`);
      } catch (error) {
        logger.warn(`Failed to delete shop configuration: ${error.message}`);
      }
      
      return { success: true, message: 'Access revoked successfully' };
    } catch (error) {
      logger.error(`Failed to revoke access for shop ${shop}:`, error);
      throw error;
    }
  }

  // Middleware to require authentication
  requireAuth() {
    return this.validateRequest.bind(this);
  }

  // Get all authenticated shops
  async getAuthenticatedShops() {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const configDir = 'config/shops';
      
      const files = await fs.readdir(configDir);
      const shops = [];
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const configFile = path.join(configDir, file);
          const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
          shops.push({
            shop: config.shop,
            configuredAt: config.configuredAt,
            status: config.status,
            webhookCount: config.webhooks?.length || 0
          });
        }
      }
      
      return shops;
    } catch (error) {
      logger.error('Failed to get authenticated shops:', error);
      return [];
    }
  }
}