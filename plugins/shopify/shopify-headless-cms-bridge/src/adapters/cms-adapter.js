import axios from 'axios';
import { logger } from '../utils/logger.js';

export class CMSAdapter {
  constructor(options = {}) {
    this.apiUrl = options.apiUrl || process.env.CMS_API_URL;
    this.apiKey = options.apiKey || process.env.CMS_API_KEY;
    this.timeout = options.timeout || 10000;
    
    if (!this.apiUrl) {
      throw new Error('CMS API URL is required');
    }

    this.client = axios.create({
      baseURL: this.apiUrl,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Shopify-CMS-Bridge/1.0.0',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('CMS API Error:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data
        });
        return Promise.reject(error);
      }
    );

    // Request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug(`CMS API Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => Promise.reject(error)
    );
  }

  async isHealthy() {
    try {
      const response = await this.client.get('/health');
      return response.status === 200;
    } catch (error) {
      logger.warn('CMS health check failed:', error.message);
      return false;
    }
  }

  async testConnection() {
    try {
      const response = await this.client.get('/api/v1/status');
      logger.info('CMS connection test successful', {
        status: response.status,
        data: response.data
      });
      return { success: true, data: response.data };
    } catch (error) {
      logger.error('CMS connection test failed:', error);
      return { success: false, error: error.message };
    }
  }

  // Product Methods
  async createProduct(productData) {
    try {
      logger.info('Creating product in CMS', {
        shopifyId: productData.shopify_id,
        title: productData.title
      });

      const response = await this.client.post('/api/v1/shopify/products', {
        product: productData
      });

      logger.info('Product created in CMS', {
        shopifyId: productData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 409) {
        logger.info('Product already exists, trying update instead');
        return await this.updateProduct(productData);
      }
      logger.error('Failed to create product in CMS:', error);
      throw new Error(`CMS product creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateProduct(productData) {
    try {
      logger.info('Updating product in CMS', {
        shopifyId: productData.shopify_id,
        title: productData.title
      });

      const response = await this.client.put(`/api/v1/shopify/products/${productData.shopify_id}`, {
        product: productData
      });

      logger.info('Product updated in CMS', {
        shopifyId: productData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.info('Product not found, creating new one');
        return await this.createProduct(productData);
      }
      logger.error('Failed to update product in CMS:', error);
      throw new Error(`CMS product update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteProduct(shopifyProductId) {
    try {
      logger.info('Deleting product from CMS', { shopifyId: shopifyProductId });

      const response = await this.client.delete(`/api/v1/shopify/products/${shopifyProductId}`);

      logger.info('Product deleted from CMS', {
        shopifyId: shopifyProductId,
        result: response.data
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('Product not found in CMS for deletion', { shopifyId: shopifyProductId });
        return { success: true, message: 'Product not found (already deleted)' };
      }
      logger.error('Failed to delete product from CMS:', error);
      throw new Error(`CMS product deletion failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getProduct(shopifyProductId) {
    try {
      const response = await this.client.get(`/api/v1/shopify/products/${shopifyProductId}`);
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get product from CMS:', error);
      throw new Error(`CMS product retrieval failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Order Methods
  async createOrder(orderData) {
    try {
      logger.info('Creating order in CMS', {
        shopifyId: orderData.shopify_id,
        orderName: orderData.order_name
      });

      const response = await this.client.post('/api/v1/shopify/orders', {
        order: orderData
      });

      logger.info('Order created in CMS', {
        shopifyId: orderData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 409) {
        logger.info('Order already exists, trying update instead');
        return await this.updateOrder(orderData);
      }
      logger.error('Failed to create order in CMS:', error);
      throw new Error(`CMS order creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateOrder(orderData) {
    try {
      logger.info('Updating order in CMS', {
        shopifyId: orderData.shopify_id,
        orderName: orderData.order_name
      });

      const response = await this.client.put(`/api/v1/shopify/orders/${orderData.shopify_id}`, {
        order: orderData
      });

      logger.info('Order updated in CMS', {
        shopifyId: orderData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.info('Order not found, creating new one');
        return await this.createOrder(orderData);
      }
      logger.error('Failed to update order in CMS:', error);
      throw new Error(`CMS order update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateOrderStatus(shopifyOrderId, status, orderData = {}) {
    try {
      logger.info('Updating order status in CMS', {
        shopifyId: shopifyOrderId,
        status
      });

      const response = await this.client.patch(`/api/v1/shopify/orders/${shopifyOrderId}/status`, {
        status,
        order_data: orderData,
        updated_at: new Date().toISOString()
      });

      logger.info('Order status updated in CMS', {
        shopifyId: shopifyOrderId,
        status,
        result: response.data
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to update order status in CMS:', error);
      throw new Error(`CMS order status update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getOrder(shopifyOrderId) {
    try {
      const response = await this.client.get(`/api/v1/shopify/orders/${shopifyOrderId}`);
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get order from CMS:', error);
      throw new Error(`CMS order retrieval failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Customer Methods
  async createCustomer(customerData) {
    try {
      logger.info('Creating customer in CMS', {
        shopifyId: customerData.shopify_id,
        email: customerData.email
      });

      const response = await this.client.post('/api/v1/shopify/customers', {
        customer: customerData
      });

      logger.info('Customer created in CMS', {
        shopifyId: customerData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 409) {
        logger.info('Customer already exists, trying update instead');
        return await this.updateCustomer(customerData);
      }
      logger.error('Failed to create customer in CMS:', error);
      throw new Error(`CMS customer creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async updateCustomer(customerData) {
    try {
      logger.info('Updating customer in CMS', {
        shopifyId: customerData.shopify_id,
        email: customerData.email
      });

      const response = await this.client.put(`/api/v1/shopify/customers/${customerData.shopify_id}`, {
        customer: customerData
      });

      logger.info('Customer updated in CMS', {
        shopifyId: customerData.shopify_id,
        cmsId: response.data.data?.id
      });

      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.info('Customer not found, creating new one');
        return await this.createCustomer(customerData);
      }
      logger.error('Failed to update customer in CMS:', error);
      throw new Error(`CMS customer update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async deleteCustomer(shopifyCustomerId) {
    try {
      logger.info('Deleting customer from CMS', { shopifyId: shopifyCustomerId });

      const response = await this.client.delete(`/api/v1/shopify/customers/${shopifyCustomerId}`);

      logger.info('Customer deleted from CMS', {
        shopifyId: shopifyCustomerId,
        result: response.data
      });

      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.warn('Customer not found in CMS for deletion', { shopifyId: shopifyCustomerId });
        return { success: true, message: 'Customer not found (already deleted)' };
      }
      logger.error('Failed to delete customer from CMS:', error);
      throw new Error(`CMS customer deletion failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getCustomer(shopifyCustomerId) {
    try {
      const response = await this.client.get(`/api/v1/shopify/customers/${shopifyCustomerId}`);
      return response.data.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('Failed to get customer from CMS:', error);
      throw new Error(`CMS customer retrieval failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Inventory Methods
  async updateInventory(inventoryData) {
    try {
      logger.info('Updating inventory in CMS', {
        inventoryItemId: inventoryData.shopify_inventory_item_id,
        available: inventoryData.available_quantity
      });

      const response = await this.client.put('/api/v1/shopify/inventory', {
        inventory: inventoryData
      });

      logger.info('Inventory updated in CMS', {
        inventoryItemId: inventoryData.shopify_inventory_item_id,
        result: response.data
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to update inventory in CMS:', error);
      throw new Error(`CMS inventory update failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Shop Management Methods
  async activateShop(shopDomain, shopData = {}) {
    try {
      logger.info('Activating shop in CMS', { shopDomain });

      const response = await this.client.post('/api/v1/shopify/shops', {
        shop: {
          domain: shopDomain,
          status: 'active',
          activated_at: new Date().toISOString(),
          ...shopData
        }
      });

      logger.info('Shop activated in CMS', {
        shopDomain,
        result: response.data
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to activate shop in CMS:', error);
      throw new Error(`CMS shop activation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async deactivateShop(shopDomain) {
    try {
      logger.info('Deactivating shop in CMS', { shopDomain });

      const response = await this.client.patch(`/api/v1/shopify/shops/${shopDomain}`, {
        shop: {
          status: 'inactive',
          deactivated_at: new Date().toISOString()
        }
      });

      logger.info('Shop deactivated in CMS', {
        shopDomain,
        result: response.data
      });

      return response.data.data;
    } catch (error) {
      logger.error('Failed to deactivate shop in CMS:', error);
      throw new Error(`CMS shop deactivation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Batch Operations
  async batchCreateProducts(products) {
    try {
      logger.info('Batch creating products in CMS', { count: products.length });

      const response = await this.client.post('/api/v1/shopify/products/batch', {
        products
      });

      logger.info('Batch product creation completed', {
        requested: products.length,
        successful: response.data.successful?.length || 0,
        failed: response.data.failed?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to batch create products in CMS:', error);
      throw new Error(`CMS batch product creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async batchCreateOrders(orders) {
    try {
      logger.info('Batch creating orders in CMS', { count: orders.length });

      const response = await this.client.post('/api/v1/shopify/orders/batch', {
        orders
      });

      logger.info('Batch order creation completed', {
        requested: orders.length,
        successful: response.data.successful?.length || 0,
        failed: response.data.failed?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to batch create orders in CMS:', error);
      throw new Error(`CMS batch order creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async batchCreateCustomers(customers) {
    try {
      logger.info('Batch creating customers in CMS', { count: customers.length });

      const response = await this.client.post('/api/v1/shopify/customers/batch', {
        customers
      });

      logger.info('Batch customer creation completed', {
        requested: customers.length,
        successful: response.data.successful?.length || 0,
        failed: response.data.failed?.length || 0
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to batch create customers in CMS:', error);
      throw new Error(`CMS batch customer creation failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Analytics and Reporting
  async getSyncReport(shopDomain, options = {}) {
    try {
      const { startDate, endDate, type = 'all' } = options;
      
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (type !== 'all') params.append('type', type);

      const response = await this.client.get(
        `/api/v1/shopify/sync-report/${shopDomain}?${params}`
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get sync report from CMS:', error);
      throw new Error(`CMS sync report failed: ${error.response?.data?.message || error.message}`);
    }
  }

  async getShopAnalytics(shopDomain, options = {}) {
    try {
      const { period = '30d', metrics = 'all' } = options;
      
      const params = new URLSearchParams();
      params.append('period', period);
      params.append('metrics', metrics);

      const response = await this.client.get(
        `/api/v1/shopify/analytics/${shopDomain}?${params}`
      );

      return response.data.data;
    } catch (error) {
      logger.error('Failed to get shop analytics from CMS:', error);
      throw new Error(`CMS analytics failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Utility Methods
  async sendWebhookNotification(event, data) {
    try {
      logger.debug('Sending webhook notification to CMS', { event });

      const response = await this.client.post('/api/v1/shopify/webhooks/notify', {
        event,
        data,
        timestamp: new Date().toISOString()
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to send webhook notification to CMS:', error);
      // Don't throw here as webhook notifications are not critical
      return { success: false, error: error.message };
    }
  }

  async logSyncActivity(activity) {
    try {
      const response = await this.client.post('/api/v1/shopify/sync-log', {
        activity: {
          ...activity,
          timestamp: new Date().toISOString(),
          source: 'shopify-bridge'
        }
      });

      return response.data;
    } catch (error) {
      logger.error('Failed to log sync activity to CMS:', error);
      // Don't throw here as logging is not critical
      return { success: false, error: error.message };
    }
  }

  // Connection Management
  async refreshConnection() {
    try {
      const connectionTest = await this.testConnection();
      if (connectionTest.success) {
        logger.info('CMS connection refreshed successfully');
      } else {
        logger.warn('CMS connection refresh failed');
      }
      return connectionTest;
    } catch (error) {
      logger.error('Failed to refresh CMS connection:', error);
      return { success: false, error: error.message };
    }
  }

  getConnectionInfo() {
    return {
      apiUrl: this.apiUrl,
      hasApiKey: !!this.apiKey,
      timeout: this.timeout,
      lastHealthCheck: this._lastHealthCheck,
      isHealthy: this._isHealthy
    };
  }
}