const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

class ShopifyAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.shopifyUrl = options.shopifyUrl;
    this.webhookSecret = options.webhookSecret || process.env.SHOPIFY_WEBHOOK_SECRET;
    this.apiKey = options.apiKey || process.env.SHOPIFY_API_KEY;
    this.syncDirection = options.syncDirection || 'bidirectional';
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Initialize sync queues
    this.syncQueues = {
      products: [],
      orders: [],
      customers: []
    };
    
    // Initialize transformers
    this.ContentTransformer = require('./content-transformer');
    this.WebhookSender = require('./webhook-sender');
    this.AuthManager = require('./auth-manager');
    
    this.transformer = new this.ContentTransformer();
    this.webhookSender = new this.WebhookSender(this.webhookSecret);
    this.authManager = new this.AuthManager();
    
    this.logger = options.logger || console;
    
    this.logger.info('ShopifyAdapter initialized', {
      shopifyUrl: this.shopifyUrl,
      syncDirection: this.syncDirection,
      hasWebhookSecret: !!this.webhookSecret
    });
  }

  async testConnection() {
    try {
      if (!this.shopifyUrl || !this.apiKey) {
        throw new Error('Shopify URL and API key are required');
      }

      // Test connection to Shopify bridge app
      const response = await axios.get(`${this.shopifyUrl}/health`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'CMS-Shopify-Adapter/1.0.0'
        },
        timeout: 10000
      });

      this.logger.info('Shopify connection test successful', {
        status: response.status,
        data: response.data
      });

      return {
        success: true,
        status: 'connected',
        shopify_url: this.shopifyUrl,
        timestamp: new Date().toISOString(),
        response: response.data
      };

    } catch (error) {
      this.logger.error('Shopify connection test failed:', error);
      return {
        success: false,
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Content Sync Methods
  async sendContentToShopify(cmsContent) {
    try {
      this.logger.info('Sending content to Shopify', {
        contentType: cmsContent.content_type,
        id: cmsContent.id,
        title: cmsContent.title
      });

      if (!this.shouldSyncToShopify()) {
        this.logger.info('Sync to Shopify disabled by configuration');
        return { success: false, message: 'Sync to Shopify disabled' };
      }

      // Transform CMS content to Shopify format
      let shopifyContent;
      switch (cmsContent.content_type) {
        case 'product':
          shopifyContent = this.transformer.transformCMSProductToShopify(cmsContent);
          return await this.sendProductToShopify(shopifyContent);
        case 'order':
          shopifyContent = this.transformer.transformCMSOrderToShopify(cmsContent);
          return await this.sendOrderToShopify(shopifyContent);
        case 'customer':
          shopifyContent = this.transformer.transformCMSCustomerToShopify(cmsContent);
          return await this.sendCustomerToShopify(shopifyContent);
        default:
          throw new Error(`Unsupported content type: ${cmsContent.content_type}`);
      }

    } catch (error) {
      this.logger.error('Failed to send content to Shopify:', error);
      throw error;
    }
  }

  async sendProductToShopify(product) {
    try {
      const endpoint = product.shopify_id 
        ? `${this.shopifyUrl}/api/sync/products/${product.shopify_id}`
        : `${this.shopifyUrl}/api/sync/products`;
      
      const method = product.shopify_id ? 'put' : 'post';

      const response = await this.makeShopifyRequest(method, endpoint, {
        product: product
      });

      this.logger.info('Product sent to Shopify successfully', {
        cmsId: product.id,
        shopifyId: response.data.shopify_id,
        method
      });

      this.emit('productSynced', {
        direction: 'cms_to_shopify',
        product: product,
        response: response.data
      });

      return {
        success: true,
        shopify_id: response.data.shopify_id,
        cms_id: product.id,
        action: method === 'post' ? 'created' : 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send product to Shopify:', error);
      throw new Error(`Shopify product sync failed: ${error.message}`);
    }
  }

  async sendOrderToShopify(order) {
    try {
      // Note: Most order data in Shopify is read-only after creation
      // This mainly handles status updates and metadata
      const endpoint = `${this.shopifyUrl}/api/sync/orders/${order.shopify_id}/status`;

      const response = await this.makeShopifyRequest('patch', endpoint, {
        status: order.status,
        notes: order.cms_notes,
        metadata: order.cms_metadata
      });

      this.logger.info('Order status sent to Shopify successfully', {
        cmsId: order.id,
        shopifyId: order.shopify_id,
        status: order.status
      });

      this.emit('orderSynced', {
        direction: 'cms_to_shopify',
        order: order,
        response: response.data
      });

      return {
        success: true,
        shopify_id: order.shopify_id,
        cms_id: order.id,
        action: 'status_updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send order to Shopify:', error);
      throw new Error(`Shopify order sync failed: ${error.message}`);
    }
  }

  async sendCustomerToShopify(customer) {
    try {
      const endpoint = customer.shopify_id 
        ? `${this.shopifyUrl}/api/sync/customers/${customer.shopify_id}`
        : `${this.shopifyUrl}/api/sync/customers`;
      
      const method = customer.shopify_id ? 'put' : 'post';

      const response = await this.makeShopifyRequest(method, endpoint, {
        customer: customer
      });

      this.logger.info('Customer sent to Shopify successfully', {
        cmsId: customer.id,
        shopifyId: response.data.shopify_id,
        method
      });

      this.emit('customerSynced', {
        direction: 'cms_to_shopify',
        customer: customer,
        response: response.data
      });

      return {
        success: true,
        shopify_id: response.data.shopify_id,
        cms_id: customer.id,
        action: method === 'post' ? 'created' : 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send customer to Shopify:', error);
      throw new Error(`Shopify customer sync failed: ${error.message}`);
    }
  }

  // Webhook Handling Methods
  async handleShopifyWebhook(event, data, signature) {
    try {
      this.logger.info('Processing Shopify webhook', {
        event,
        hasData: !!data,
        hasSignature: !!signature
      });

      // Verify webhook signature
      if (signature && !this.verifyWebhookSignature(data, signature)) {
        throw new Error('Invalid webhook signature');
      }

      if (!this.shouldSyncFromShopify()) {
        this.logger.info('Sync from Shopify disabled by configuration');
        return { success: false, message: 'Sync from Shopify disabled' };
      }

      // Process based on event type
      switch (event) {
        case 'products/create':
        case 'products/update':
          return await this.handleProductWebhook(event, data);
        case 'products/delete':
          return await this.handleProductDeleteWebhook(data);
        case 'orders/create':
        case 'orders/updated':
        case 'orders/paid':
        case 'orders/cancelled':
        case 'orders/fulfilled':
          return await this.handleOrderWebhook(event, data);
        case 'customers/create':
        case 'customers/update':
          return await this.handleCustomerWebhook(event, data);
        case 'customers/delete':
          return await this.handleCustomerDeleteWebhook(data);
        default:
          this.logger.warn(`Unhandled webhook event: ${event}`);
          return { success: false, message: `Unhandled event: ${event}` };
      }

    } catch (error) {
      this.logger.error(`Failed to process Shopify webhook ${event}:`, error);
      throw error;
    }
  }

  async handleProductWebhook(event, productData) {
    try {
      // Transform Shopify product to CMS format
      const cmsProduct = this.transformer.transformShopifyProductToCMS(productData);
      
      this.emit('webhookReceived', {
        type: 'product',
        event,
        shopifyData: productData,
        cmsData: cmsProduct
      });

      return {
        success: true,
        event,
        shopify_id: productData.id,
        cms_data: cmsProduct,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle product webhook:', error);
      throw error;
    }
  }

  async handleProductDeleteWebhook(productData) {
    try {
      this.emit('webhookReceived', {
        type: 'product_delete',
        event: 'products/delete',
        shopifyData: productData
      });

      return {
        success: true,
        event: 'products/delete',
        shopify_id: productData.id,
        action: 'delete',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle product delete webhook:', error);
      throw error;
    }
  }

  async handleOrderWebhook(event, orderData) {
    try {
      // Transform Shopify order to CMS format
      const cmsOrder = this.transformer.transformShopifyOrderToCMS(orderData);
      
      this.emit('webhookReceived', {
        type: 'order',
        event,
        shopifyData: orderData,
        cmsData: cmsOrder
      });

      return {
        success: true,
        event,
        shopify_id: orderData.id,
        cms_data: cmsOrder,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle order webhook:', error);
      throw error;
    }
  }

  async handleCustomerWebhook(event, customerData) {
    try {
      // Transform Shopify customer to CMS format
      const cmsCustomer = this.transformer.transformShopifyCustomerToCMS(customerData);
      
      this.emit('webhookReceived', {
        type: 'customer',
        event,
        shopifyData: customerData,
        cmsData: cmsCustomer
      });

      return {
        success: true,
        event,
        shopify_id: customerData.id,
        cms_data: cmsCustomer,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle customer webhook:', error);
      throw error;
    }
  }

  async handleCustomerDeleteWebhook(customerData) {
    try {
      this.emit('webhookReceived', {
        type: 'customer_delete',
        event: 'customers/delete',
        shopifyData: customerData
      });

      return {
        success: true,
        event: 'customers/delete',
        shopify_id: customerData.id,
        action: 'delete',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle customer delete webhook:', error);
      throw error;
    }
  }

  // Batch Operations
  async bulkSyncFromShopify(options = {}) {
    try {
      const { types = ['products', 'orders', 'customers'], batchSize = 50 } = options;
      
      this.logger.info('Starting bulk sync from Shopify', {
        types,
        batchSize
      });

      const results = {};

      for (const type of types) {
        try {
          const endpoint = `${this.shopifyUrl}/api/sync/${type}`;
          const response = await this.makeShopifyRequest('post', endpoint, {
            batch_size: batchSize,
            full_sync: true
          });

          results[type] = {
            success: true,
            count: response.data.count,
            batches: response.data.batches
          };

          this.logger.info(`Bulk sync completed for ${type}`, results[type]);

        } catch (error) {
          results[type] = {
            success: false,
            error: error.message
          };
          this.logger.error(`Bulk sync failed for ${type}:`, error);
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Bulk sync from Shopify failed:', error);
      throw error;
    }
  }

  // Utility Methods
  async makeShopifyRequest(method, url, data = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'CMS-Shopify-Adapter/1.0.0'
          },
          timeout: 30000
        };

        if (data && (method === 'post' || method === 'put' || method === 'patch')) {
          config.data = data;
        }

        const response = await axios(config);
        return response;

      } catch (error) {
        lastError = error;
        this.logger.warn(`Shopify request attempt ${attempt} failed:`, {
          url,
          method,
          error: error.message,
          status: error.response?.status
        });

        if (attempt < this.retryAttempts) {
          await this.delay(this.retryDelay * attempt);
        }
      }
    }

    throw lastError;
  }

  verifyWebhookSignature(data, signature) {
    if (!this.webhookSecret) {
      this.logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(JSON.stringify(data), 'utf8');
    const expectedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  }

  shouldSyncToShopify() {
    return ['bidirectional', 'cms_to_shopify'].includes(this.syncDirection);
  }

  shouldSyncFromShopify() {
    return ['bidirectional', 'shopify_to_cms'].includes(this.syncDirection);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Status and Monitoring Methods
  getStatus() {
    return {
      shopify_url: this.shopifyUrl,
      sync_direction: this.syncDirection,
      has_webhook_secret: !!this.webhookSecret,
      has_api_key: !!this.apiKey,
      sync_queues: {
        products: this.syncQueues.products.length,
        orders: this.syncQueues.orders.length,
        customers: this.syncQueues.customers.length
      },
      last_activity: this.lastActivity,
      connection_status: this.connectionStatus
    };
  }

  async getShopifyStatus() {
    try {
      const response = await this.makeShopifyRequest('get', `${this.shopifyUrl}/api/status`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Shopify status:', error);
      return { error: error.message, status: 'disconnected' };
    }
  }

  async getSyncHistory(options = {}) {
    try {
      const { limit = 100, type = 'all', since } = options;
      
      const params = new URLSearchParams();
      params.append('limit', limit);
      if (type !== 'all') params.append('type', type);
      if (since) params.append('since', since);

      const response = await this.makeShopifyRequest('get', 
        `${this.shopifyUrl}/api/sync/history?${params}`
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get sync history:', error);
      throw error;
    }
  }

  // Configuration Methods
  updateConfiguration(newConfig) {
    if (newConfig.shopifyUrl) this.shopifyUrl = newConfig.shopifyUrl;
    if (newConfig.webhookSecret) this.webhookSecret = newConfig.webhookSecret;
    if (newConfig.apiKey) this.apiKey = newConfig.apiKey;
    if (newConfig.syncDirection) this.syncDirection = newConfig.syncDirection;

    this.logger.info('Shopify adapter configuration updated', {
      shopifyUrl: this.shopifyUrl,
      syncDirection: this.syncDirection
    });

    this.emit('configurationUpdated', newConfig);
  }

  getConfiguration() {
    return {
      shopifyUrl: this.shopifyUrl,
      syncDirection: this.syncDirection,
      hasWebhookSecret: !!this.webhookSecret,
      hasApiKey: !!this.apiKey,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    };
  }
}

module.exports = ShopifyAdapter;