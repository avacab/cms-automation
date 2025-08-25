const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

class DrupalAdapter extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.drupalUrl = options.drupalUrl;
    this.webhookSecret = options.webhookSecret || process.env.DRUPAL_WEBHOOK_SECRET;
    this.apiKey = options.apiKey || process.env.DRUPAL_API_KEY;
    this.syncDirection = options.syncDirection || 'bidirectional';
    this.retryAttempts = options.retryAttempts || 3;
    this.retryDelay = options.retryDelay || 1000;
    
    // Initialize transformers and utilities
    this.ContentTransformer = require('./content-transformer');
    this.WebhookSender = require('./webhook-sender');
    this.AuthManager = require('./auth-manager');
    
    this.transformer = new this.ContentTransformer();
    this.webhookSender = new this.WebhookSender(this.webhookSecret);
    this.authManager = new this.AuthManager();
    
    this.logger = options.logger || console;
    
    // Initialize sync queues
    this.syncQueues = {
      nodes: [],
      users: [],
      terms: []
    };
    
    this.logger.info('DrupalAdapter initialized', {
      drupalUrl: this.drupalUrl,
      syncDirection: this.syncDirection,
      hasWebhookSecret: !!this.webhookSecret
    });
  }

  async testConnection() {
    try {
      if (!this.drupalUrl || !this.apiKey) {
        throw new Error('Drupal URL and API key are required');
      }

      // Test connection to Drupal status endpoint
      const response = await axios.get(`${this.drupalUrl}/headless-cms-bridge/status`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'User-Agent': 'CMS-Drupal-Adapter/1.0.0'
        },
        timeout: 10000
      });

      this.logger.info('Drupal connection test successful', {
        status: response.status,
        data: response.data
      });

      return {
        success: true,
        status: 'connected',
        drupal_url: this.drupalUrl,
        timestamp: new Date().toISOString(),
        response: response.data
      };

    } catch (error) {
      this.logger.error('Drupal connection test failed:', error);
      return {
        success: false,
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  // Content Sync Methods
  async sendContentToDrupal(cmsContent) {
    try {
      this.logger.info('Sending content to Drupal', {
        contentType: cmsContent.content_type,
        id: cmsContent.id,
        title: cmsContent.title
      });

      if (!this.shouldSyncToDrupal()) {
        this.logger.info('Sync to Drupal disabled by configuration');
        return { success: false, message: 'Sync to Drupal disabled' };
      }

      // Transform CMS content to Drupal format
      let drupalContent;
      switch (cmsContent.content_type) {
        case 'node':
        case 'article':
        case 'page':
          drupalContent = this.transformer.transformCMSContentToDrupal(cmsContent);
          return await this.sendNodeToDrupal(drupalContent);
        case 'user':
          drupalContent = this.transformer.transformCMSUserToDrupal(cmsContent);
          return await this.sendUserToDrupal(drupalContent);
        case 'taxonomy_term':
        case 'term':
          drupalContent = this.transformer.transformCMSTermToDrupal(cmsContent);
          return await this.sendTermToDrupal(drupalContent);
        default:
          throw new Error(`Unsupported content type: ${cmsContent.content_type}`);
      }

    } catch (error) {
      this.logger.error('Failed to send content to Drupal:', error);
      throw error;
    }
  }

  async sendNodeToDrupal(node) {
    try {
      const endpoint = node.drupal_id 
        ? `${this.drupalUrl}/api/v1/drupal/node/${node.drupal_id}`
        : `${this.drupalUrl}/api/v1/drupal/node`;
      
      const method = node.drupal_id ? 'put' : 'post';

      const response = await this.makeDrupalRequest(method, endpoint, {
        node: node
      });

      this.logger.info('Node sent to Drupal successfully', {
        cmsId: node.id,
        drupalId: response.data.drupal_id,
        method
      });

      this.emit('nodeSynced', {
        direction: 'cms_to_drupal',
        node: node,
        response: response.data
      });

      return {
        success: true,
        drupal_id: response.data.drupal_id,
        cms_id: node.id,
        action: method === 'post' ? 'created' : 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send node to Drupal:', error);
      throw new Error(`Drupal node sync failed: ${error.message}`);
    }
  }

  async sendUserToDrupal(user) {
    try {
      const endpoint = user.drupal_id 
        ? `${this.drupalUrl}/api/v1/drupal/user/${user.drupal_id}`
        : `${this.drupalUrl}/api/v1/drupal/user`;
      
      const method = user.drupal_id ? 'put' : 'post';

      const response = await this.makeDrupalRequest(method, endpoint, {
        user: user
      });

      this.logger.info('User sent to Drupal successfully', {
        cmsId: user.id,
        drupalId: response.data.drupal_id,
        method
      });

      this.emit('userSynced', {
        direction: 'cms_to_drupal',
        user: user,
        response: response.data
      });

      return {
        success: true,
        drupal_id: response.data.drupal_id,
        cms_id: user.id,
        action: method === 'post' ? 'created' : 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send user to Drupal:', error);
      throw new Error(`Drupal user sync failed: ${error.message}`);
    }
  }

  async sendTermToDrupal(term) {
    try {
      const endpoint = term.drupal_id 
        ? `${this.drupalUrl}/api/v1/drupal/taxonomy_term/${term.drupal_id}`
        : `${this.drupalUrl}/api/v1/drupal/taxonomy_term`;
      
      const method = term.drupal_id ? 'put' : 'post';

      const response = await this.makeDrupalRequest(method, endpoint, {
        taxonomy_term: term
      });

      this.logger.info('Term sent to Drupal successfully', {
        cmsId: term.id,
        drupalId: response.data.drupal_id,
        method
      });

      this.emit('termSynced', {
        direction: 'cms_to_drupal',
        term: term,
        response: response.data
      });

      return {
        success: true,
        drupal_id: response.data.drupal_id,
        cms_id: term.id,
        action: method === 'post' ? 'created' : 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to send term to Drupal:', error);
      throw new Error(`Drupal term sync failed: ${error.message}`);
    }
  }

  // Webhook Handling Methods
  async handleDrupalWebhook(event, data, signature) {
    try {
      this.logger.info('Processing Drupal webhook', {
        event,
        hasData: !!data,
        hasSignature: !!signature
      });

      // Verify webhook signature
      if (signature && !this.verifyWebhookSignature(data, signature)) {
        throw new Error('Invalid webhook signature');
      }

      if (!this.shouldSyncFromDrupal()) {
        this.logger.info('Sync from Drupal disabled by configuration');
        return { success: false, message: 'Sync from Drupal disabled' };
      }

      // Process based on event type
      const [entity_type, action] = event.split('/');
      
      switch (entity_type) {
        case 'node':
          return await this.handleNodeWebhook(action, data);
        case 'user':
          return await this.handleUserWebhook(action, data);
        case 'taxonomy_term':
          return await this.handleTermWebhook(action, data);
        default:
          this.logger.warn(`Unhandled webhook entity type: ${entity_type}`);
          return { success: false, message: `Unhandled entity type: ${entity_type}` };
      }

    } catch (error) {
      this.logger.error(`Failed to process Drupal webhook ${event}:`, error);
      throw error;
    }
  }

  async handleNodeWebhook(action, nodeData) {
    try {
      // Transform Drupal node to CMS format
      const cmsNode = this.transformer.transformDrupalNodeToCMS(nodeData);
      
      this.emit('webhookReceived', {
        type: 'node',
        action,
        drupalData: nodeData,
        cmsData: cmsNode
      });

      return {
        success: true,
        action,
        drupal_id: nodeData.drupal_id || nodeData.nid,
        cms_data: cmsNode,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle node webhook:', error);
      throw error;
    }
  }

  async handleUserWebhook(action, userData) {
    try {
      // Transform Drupal user to CMS format
      const cmsUser = this.transformer.transformDrupalUserToCMS(userData);
      
      this.emit('webhookReceived', {
        type: 'user',
        action,
        drupalData: userData,
        cmsData: cmsUser
      });

      return {
        success: true,
        action,
        drupal_id: userData.drupal_id || userData.uid,
        cms_data: cmsUser,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle user webhook:', error);
      throw error;
    }
  }

  async handleTermWebhook(action, termData) {
    try {
      // Transform Drupal term to CMS format
      const cmsTerm = this.transformer.transformDrupalTermToCMS(termData);
      
      this.emit('webhookReceived', {
        type: 'taxonomy_term',
        action,
        drupalData: termData,
        cmsData: cmsTerm
      });

      return {
        success: true,
        action,
        drupal_id: termData.drupal_id || termData.tid,
        cms_data: cmsTerm,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      this.logger.error('Failed to handle term webhook:', error);
      throw error;
    }
  }

  // Bulk Operations
  async bulkSyncFromDrupal(options = {}) {
    try {
      const { entity_types = ['node', 'user', 'taxonomy_term'], batchSize = 50 } = options;
      
      this.logger.info('Starting bulk sync from Drupal', {
        entity_types,
        batchSize
      });

      const results = {};

      for (const entity_type of entity_types) {
        try {
          const endpoint = `${this.drupalUrl}/admin/config/services/headless-cms-bridge/sync/${entity_type}`;
          const response = await this.makeDrupalRequest('post', endpoint, {
            batch_size: batchSize,
            full_sync: true
          });

          results[entity_type] = {
            success: true,
            count: response.data.count,
            batches: response.data.batches
          };

          this.logger.info(`Bulk sync completed for ${entity_type}`, results[entity_type]);

        } catch (error) {
          results[entity_type] = {
            success: false,
            error: error.message
          };
          this.logger.error(`Bulk sync failed for ${entity_type}:`, error);
        }
      }

      return results;

    } catch (error) {
      this.logger.error('Bulk sync from Drupal failed:', error);
      throw error;
    }
  }

  // REST API Operations
  async getDrupalContent(entity_type, entity_id) {
    try {
      const endpoint = `${this.drupalUrl}/api/v1/drupal/${entity_type}/${entity_id}`;
      const response = await this.makeDrupalRequest('get', endpoint);
      
      return response.data.data;
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      this.logger.error('Failed to get Drupal content:', error);
      throw error;
    }
  }

  async searchDrupalContent(entity_type, query = {}) {
    try {
      const endpoint = `${this.drupalUrl}/api/v1/drupal/${entity_type}`;
      const params = new URLSearchParams(query);
      const url = params.toString() ? `${endpoint}?${params}` : endpoint;
      
      const response = await this.makeDrupalRequest('get', url);
      
      return response.data.data || [];
    } catch (error) {
      this.logger.error('Failed to search Drupal content:', error);
      throw error;
    }
  }

  // Utility Methods
  async makeDrupalRequest(method, url, data = null) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url,
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'CMS-Drupal-Adapter/1.0.0'
          },
          timeout: 30000
        };

        if (data && ['post', 'put', 'patch'].includes(method.toLowerCase())) {
          config.data = data;
        }

        const response = await axios(config);
        return response;

      } catch (error) {
        lastError = error;
        this.logger.warn(`Drupal request attempt ${attempt} failed:`, {
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
    const expectedSignature = hmac.digest('hex');

    // Remove 'sha256=' prefix if present
    const actualSignature = signature.replace('sha256=', '');

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(actualSignature, 'hex')
    );
  }

  shouldSyncToDrupal() {
    return ['bidirectional', 'cms_to_drupal'].includes(this.syncDirection);
  }

  shouldSyncFromDrupal() {
    return ['bidirectional', 'drupal_to_cms'].includes(this.syncDirection);
  }

  isNotFoundError(error) {
    return error.response && error.response.status === 404;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Status and Monitoring Methods
  getStatus() {
    return {
      drupal_url: this.drupalUrl,
      sync_direction: this.syncDirection,
      has_webhook_secret: !!this.webhookSecret,
      has_api_key: !!this.apiKey,
      sync_queues: {
        nodes: this.syncQueues.nodes.length,
        users: this.syncQueues.users.length,
        terms: this.syncQueues.terms.length
      },
      last_activity: this.lastActivity,
      connection_status: this.connectionStatus
    };
  }

  async getDrupalStatus() {
    try {
      const response = await this.makeDrupalRequest('get', `${this.drupalUrl}/headless-cms-bridge/status`);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get Drupal status:', error);
      return { error: error.message, status: 'disconnected' };
    }
  }

  async getSyncHistory(options = {}) {
    try {
      const { limit = 100, entity_type = 'all', since } = options;
      
      const params = new URLSearchParams();
      params.append('limit', limit);
      if (entity_type !== 'all') params.append('type', entity_type);
      if (since) params.append('since', since);

      const response = await this.makeDrupalRequest('get', 
        `${this.drupalUrl}/admin/config/services/headless-cms-bridge/logs?${params}`
      );

      return response.data;
    } catch (error) {
      this.logger.error('Failed to get sync history:', error);
      throw error;
    }
  }

  // Configuration Methods
  updateConfiguration(newConfig) {
    if (newConfig.drupalUrl) this.drupalUrl = newConfig.drupalUrl;
    if (newConfig.webhookSecret) this.webhookSecret = newConfig.webhookSecret;
    if (newConfig.apiKey) this.apiKey = newConfig.apiKey;
    if (newConfig.syncDirection) this.syncDirection = newConfig.syncDirection;

    this.logger.info('Drupal adapter configuration updated', {
      drupalUrl: this.drupalUrl,
      syncDirection: this.syncDirection
    });

    this.emit('configurationUpdated', newConfig);
  }

  getConfiguration() {
    return {
      drupalUrl: this.drupalUrl,
      syncDirection: this.syncDirection,
      hasWebhookSecret: !!this.webhookSecret,
      hasApiKey: !!this.apiKey,
      retryAttempts: this.retryAttempts,
      retryDelay: this.retryDelay
    };
  }

  // Entity Type Mappings
  getSupportedEntityTypes() {
    return {
      'node': {
        name: 'Content',
        bundles: ['article', 'page', 'basic_page'],
        endpoints: {
          list: '/api/v1/drupal/node',
          create: '/api/v1/drupal/node',
          read: '/api/v1/drupal/node/{id}',
          update: '/api/v1/drupal/node/{id}',
          delete: '/api/v1/drupal/node/{id}'
        }
      },
      'user': {
        name: 'Users',
        bundles: ['user'],
        endpoints: {
          list: '/api/v1/drupal/user',
          create: '/api/v1/drupal/user',
          read: '/api/v1/drupal/user/{id}',
          update: '/api/v1/drupal/user/{id}',
          delete: '/api/v1/drupal/user/{id}'
        }
      },
      'taxonomy_term': {
        name: 'Taxonomy Terms',
        bundles: ['tags', 'categories'],
        endpoints: {
          list: '/api/v1/drupal/taxonomy_term',
          create: '/api/v1/drupal/taxonomy_term',
          read: '/api/v1/drupal/taxonomy_term/{id}',
          update: '/api/v1/drupal/taxonomy_term/{id}',
          delete: '/api/v1/drupal/taxonomy_term/{id}'
        }
      }
    };
  }

  // Health Check Methods
  async performHealthCheck() {
    const checks = {
      connection: await this.testConnection(),
      status: await this.getDrupalStatus(),
      webhooks: this.getWebhookEndpoints(),
      configuration: this.getConfiguration()
    };

    const isHealthy = checks.connection.success && 
                     checks.status && 
                     !checks.status.error;

    return {
      healthy: isHealthy,
      timestamp: new Date().toISOString(),
      checks
    };
  }

  getWebhookEndpoints() {
    if (!this.drupalUrl) {
      return { error: 'Drupal URL not configured' };
    }

    const baseUrl = this.drupalUrl;
    return {
      node_create: `${baseUrl}/headless-cms-bridge/webhook/node/create`,
      node_update: `${baseUrl}/headless-cms-bridge/webhook/node/update`,
      node_delete: `${baseUrl}/headless-cms-bridge/webhook/node/delete`,
      user_create: `${baseUrl}/headless-cms-bridge/webhook/user/create`,
      user_update: `${baseUrl}/headless-cms-bridge/webhook/user/update`,
      user_delete: `${baseUrl}/headless-cms-bridge/webhook/user/delete`,
      term_create: `${baseUrl}/headless-cms-bridge/webhook/taxonomy_term/create`,
      term_update: `${baseUrl}/headless-cms-bridge/webhook/taxonomy_term/update`,
      term_delete: `${baseUrl}/headless-cms-bridge/webhook/taxonomy_term/delete`,
      status: `${baseUrl}/headless-cms-bridge/status`,
      health: `${baseUrl}/headless-cms-bridge/status?detailed=1`
    };
  }
}

module.exports = DrupalAdapter;