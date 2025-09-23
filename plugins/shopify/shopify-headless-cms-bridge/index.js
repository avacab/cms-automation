import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';
import { shopifyApp } from '@shopify/shopify-app-express';
import { MemorySessionStorage } from '@shopify/shopify-app-session-storage-memory';

import { logger } from './src/utils/logger.js';
import { GraphQLClient } from './src/services/graphql-client.js';
import { WebhookHandler } from './src/handlers/webhook-handler.js';
import { CMSAdapter } from './src/adapters/cms-adapter.js';
import { SyncManager } from './src/services/sync-manager.js';

dotenv.config();

const PORT = process.env.PORT || 3000;

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: process.env.SCOPES?.split(',') || ['read_products', 'write_products', 'read_orders'],
  hostName: process.env.HOST || `localhost:${PORT}`,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false,
  logger: {
    level: 'info',
    httpRequests: true,
    timestamps: true,
  },
});

// Create Express app
const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.NODE_ENV === 'production' ? 
    process.env.ALLOWED_ORIGINS?.split(',') : true,
  credentials: true
}));

// Initialize session storage
const sessionStorage = new MemorySessionStorage();

// Initialize Shopify app
const shopifyAppInstance = shopifyApp({
  api: shopify,
  auth: {
    path: '/auth',
    callbackPath: '/auth/callback',
  },
  webhooks: {
    path: '/webhooks',
  },
  sessionStorage,
});

// Apply Shopify app middleware
app.use(shopifyAppInstance);

// Initialize services
const graphqlClient = new GraphQLClient(shopify);
const cmsAdapter = new CMSAdapter({
  apiUrl: process.env.CMS_API_URL,
  apiKey: process.env.CMS_API_KEY
});
const syncManager = new SyncManager(graphqlClient, cmsAdapter);
const webhookHandler = new WebhookHandler(syncManager);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    services: {
      graphql: 'connected',
      cms: cmsAdapter.isHealthy() ? 'connected' : 'disconnected'
    }
  });
});

// CMS sync endpoints
app.post('/api/sync/products', async (req, res) => {
  try {
    const result = await syncManager.syncProductsFromShopify();
    res.json({
      success: true,
      message: 'Products sync initiated',
      data: result
    });
  } catch (error) {
    logger.error('Product sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Product sync failed',
      error: error.message
    });
  }
});

app.post('/api/sync/orders', async (req, res) => {
  try {
    const result = await syncManager.syncOrdersFromShopify();
    res.json({
      success: true,
      message: 'Orders sync initiated',
      data: result
    });
  } catch (error) {
    logger.error('Order sync failed:', error);
    res.status(500).json({
      success: false,
      message: 'Order sync failed',
      error: error.message
    });
  }
});

// Manual webhook test endpoint
app.post('/api/webhook/test', async (req, res) => {
  try {
    const { topic, data } = req.body;
    await webhookHandler.handleWebhook(topic, data);
    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    logger.error('Webhook test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook test failed',
      error: error.message
    });
  }
});

// Status endpoint for monitoring
app.get('/api/status', async (req, res) => {
  try {
    const status = await syncManager.getStatus();
    res.json(status);
  } catch (error) {
    logger.error('Status check failed:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.originalUrl} not found`
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`Shopify CMS Bridge started on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
  logger.info(`CMS API: ${process.env.CMS_API_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;