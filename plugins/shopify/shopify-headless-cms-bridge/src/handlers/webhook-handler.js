import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class WebhookHandler {
  constructor(syncManager) {
    this.syncManager = syncManager;
    this.webhookSecret = process.env.SHOPIFY_WEBHOOK_SECRET;
  }

  verifyWebhookSignature(rawBody, signature) {
    if (!this.webhookSecret) {
      logger.warn('Webhook secret not configured, skipping signature verification');
      return true;
    }

    const hmac = crypto.createHmac('sha256', this.webhookSecret);
    hmac.update(rawBody, 'utf8');
    const expectedSignature = hmac.digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature, 'base64'),
      Buffer.from(expectedSignature, 'base64')
    );
  }

  async handleWebhook(topic, data, signature = null, rawBody = null) {
    try {
      // Verify signature if provided
      if (signature && rawBody && !this.verifyWebhookSignature(rawBody, signature)) {
        logger.error('Webhook signature verification failed', { topic });
        throw new Error('Invalid webhook signature');
      }

      logger.info(`Processing webhook: ${topic}`, { 
        dataKeys: Object.keys(data || {}),
        hasSignature: !!signature 
      });

      switch (topic) {
        case 'PRODUCTS_CREATE':
          return await this.handleProductCreate(data);
        
        case 'PRODUCTS_UPDATE':
          return await this.handleProductUpdate(data);
        
        case 'PRODUCTS_DELETE':
          return await this.handleProductDelete(data);
        
        case 'ORDERS_CREATE':
          return await this.handleOrderCreate(data);
        
        case 'ORDERS_UPDATE':
          return await this.handleOrderUpdate(data);
        
        case 'ORDERS_PAID':
          return await this.handleOrderPaid(data);
        
        case 'ORDERS_CANCELLED':
          return await this.handleOrderCancelled(data);
        
        case 'ORDERS_FULFILLED':
          return await this.handleOrderFulfilled(data);
        
        case 'CUSTOMERS_CREATE':
          return await this.handleCustomerCreate(data);
        
        case 'CUSTOMERS_UPDATE':
          return await this.handleCustomerUpdate(data);
        
        case 'CUSTOMERS_DELETE':
          return await this.handleCustomerDelete(data);
        
        case 'INVENTORY_LEVELS_UPDATE':
          return await this.handleInventoryUpdate(data);
        
        case 'APP_UNINSTALLED':
          return await this.handleAppUninstalled(data);
        
        default:
          logger.warn(`Unhandled webhook topic: ${topic}`, { data });
          return { success: false, message: `Unhandled webhook topic: ${topic}` };
      }
    } catch (error) {
      logger.error(`Webhook processing failed for topic ${topic}:`, {
        error: error.message,
        stack: error.stack,
        data: data || {}
      });
      throw error;
    }
  }

  async handleProductCreate(product) {
    logger.info('Processing product create webhook', { 
      productId: product.id,
      title: product.title 
    });

    try {
      const result = await this.syncManager.syncProductToCMS(product, 'create');
      logger.info('Product created in CMS', { 
        shopifyId: product.id,
        cmsResult: result 
      });
      return { success: true, action: 'create', result };
    } catch (error) {
      logger.error('Failed to sync product create to CMS:', error);
      throw error;
    }
  }

  async handleProductUpdate(product) {
    logger.info('Processing product update webhook', { 
      productId: product.id,
      title: product.title 
    });

    try {
      const result = await this.syncManager.syncProductToCMS(product, 'update');
      logger.info('Product updated in CMS', { 
        shopifyId: product.id,
        cmsResult: result 
      });
      return { success: true, action: 'update', result };
    } catch (error) {
      logger.error('Failed to sync product update to CMS:', error);
      throw error;
    }
  }

  async handleProductDelete(product) {
    logger.info('Processing product delete webhook', { 
      productId: product.id 
    });

    try {
      const result = await this.syncManager.deleteProductFromCMS(product.id);
      logger.info('Product deleted from CMS', { 
        shopifyId: product.id,
        cmsResult: result 
      });
      return { success: true, action: 'delete', result };
    } catch (error) {
      logger.error('Failed to sync product delete to CMS:', error);
      throw error;
    }
  }

  async handleOrderCreate(order) {
    logger.info('Processing order create webhook', { 
      orderId: order.id,
      orderName: order.name,
      totalPrice: order.total_price 
    });

    try {
      const result = await this.syncManager.syncOrderToCMS(order, 'create');
      logger.info('Order created in CMS', { 
        shopifyId: order.id,
        cmsResult: result 
      });
      return { success: true, action: 'create', result };
    } catch (error) {
      logger.error('Failed to sync order create to CMS:', error);
      throw error;
    }
  }

  async handleOrderUpdate(order) {
    logger.info('Processing order update webhook', { 
      orderId: order.id,
      orderName: order.name,
      financialStatus: order.financial_status,
      fulfillmentStatus: order.fulfillment_status 
    });

    try {
      const result = await this.syncManager.syncOrderToCMS(order, 'update');
      logger.info('Order updated in CMS', { 
        shopifyId: order.id,
        cmsResult: result 
      });
      return { success: true, action: 'update', result };
    } catch (error) {
      logger.error('Failed to sync order update to CMS:', error);
      throw error;
    }
  }

  async handleOrderPaid(order) {
    logger.info('Processing order paid webhook', { 
      orderId: order.id,
      orderName: order.name,
      totalPrice: order.total_price 
    });

    try {
      const result = await this.syncManager.handleOrderStatusChange(order, 'paid');
      logger.info('Order payment processed in CMS', { 
        shopifyId: order.id,
        cmsResult: result 
      });
      return { success: true, action: 'paid', result };
    } catch (error) {
      logger.error('Failed to process order payment in CMS:', error);
      throw error;
    }
  }

  async handleOrderCancelled(order) {
    logger.info('Processing order cancelled webhook', { 
      orderId: order.id,
      orderName: order.name,
      cancelReason: order.cancel_reason 
    });

    try {
      const result = await this.syncManager.handleOrderStatusChange(order, 'cancelled');
      logger.info('Order cancellation processed in CMS', { 
        shopifyId: order.id,
        cmsResult: result 
      });
      return { success: true, action: 'cancelled', result };
    } catch (error) {
      logger.error('Failed to process order cancellation in CMS:', error);
      throw error;
    }
  }

  async handleOrderFulfilled(order) {
    logger.info('Processing order fulfilled webhook', { 
      orderId: order.id,
      orderName: order.name 
    });

    try {
      const result = await this.syncManager.handleOrderStatusChange(order, 'fulfilled');
      logger.info('Order fulfillment processed in CMS', { 
        shopifyId: order.id,
        cmsResult: result 
      });
      return { success: true, action: 'fulfilled', result };
    } catch (error) {
      logger.error('Failed to process order fulfillment in CMS:', error);
      throw error;
    }
  }

  async handleCustomerCreate(customer) {
    logger.info('Processing customer create webhook', { 
      customerId: customer.id,
      email: customer.email 
    });

    try {
      const result = await this.syncManager.syncCustomerToCMS(customer, 'create');
      logger.info('Customer created in CMS', { 
        shopifyId: customer.id,
        cmsResult: result 
      });
      return { success: true, action: 'create', result };
    } catch (error) {
      logger.error('Failed to sync customer create to CMS:', error);
      throw error;
    }
  }

  async handleCustomerUpdate(customer) {
    logger.info('Processing customer update webhook', { 
      customerId: customer.id,
      email: customer.email 
    });

    try {
      const result = await this.syncManager.syncCustomerToCMS(customer, 'update');
      logger.info('Customer updated in CMS', { 
        shopifyId: customer.id,
        cmsResult: result 
      });
      return { success: true, action: 'update', result };
    } catch (error) {
      logger.error('Failed to sync customer update to CMS:', error);
      throw error;
    }
  }

  async handleCustomerDelete(customer) {
    logger.info('Processing customer delete webhook', { 
      customerId: customer.id 
    });

    try {
      const result = await this.syncManager.deleteCustomerFromCMS(customer.id);
      logger.info('Customer deleted from CMS', { 
        shopifyId: customer.id,
        cmsResult: result 
      });
      return { success: true, action: 'delete', result };
    } catch (error) {
      logger.error('Failed to sync customer delete to CMS:', error);
      throw error;
    }
  }

  async handleInventoryUpdate(inventoryLevel) {
    logger.info('Processing inventory update webhook', { 
      inventoryItemId: inventoryLevel.inventory_item_id,
      locationId: inventoryLevel.location_id,
      available: inventoryLevel.available 
    });

    try {
      const result = await this.syncManager.syncInventoryToCMS(inventoryLevel);
      logger.info('Inventory updated in CMS', { 
        inventoryItemId: inventoryLevel.inventory_item_id,
        cmsResult: result 
      });
      return { success: true, action: 'inventory_update', result };
    } catch (error) {
      logger.error('Failed to sync inventory update to CMS:', error);
      throw error;
    }
  }

  async handleAppUninstalled(data) {
    logger.warn('App uninstalled webhook received', { 
      shopDomain: data.domain || data.myshopify_domain 
    });

    try {
      // Clean up any stored data, webhooks, etc.
      const result = await this.syncManager.handleAppUninstalled(data);
      logger.info('App uninstall cleanup completed', { result });
      return { success: true, action: 'app_uninstalled', result };
    } catch (error) {
      logger.error('Failed to handle app uninstall:', error);
      throw error;
    }
  }

  // Webhook configuration helpers
  getRequiredWebhooks() {
    return [
      'PRODUCTS_CREATE',
      'PRODUCTS_UPDATE', 
      'PRODUCTS_DELETE',
      'ORDERS_CREATE',
      'ORDERS_UPDATE',
      'ORDERS_PAID',
      'ORDERS_CANCELLED',
      'ORDERS_FULFILLED',
      'CUSTOMERS_CREATE',
      'CUSTOMERS_UPDATE',
      'CUSTOMERS_DELETE',
      'INVENTORY_LEVELS_UPDATE',
      'APP_UNINSTALLED'
    ];
  }

  async setupWebhooks(graphqlClient, session, callbackUrl) {
    const webhooks = this.getRequiredWebhooks();
    const results = [];

    for (const topic of webhooks) {
      try {
        const result = await graphqlClient.createWebhook(session, {
          topic,
          webhookSubscription: {
            callbackUrl: `${callbackUrl}/webhooks/${topic.toLowerCase()}`,
            format: 'JSON'
          }
        });

        if (result.webhookSubscriptionCreate.userErrors?.length > 0) {
          logger.error(`Failed to create webhook for ${topic}:`, 
            result.webhookSubscriptionCreate.userErrors);
        } else {
          logger.info(`Created webhook for ${topic}:`, 
            result.webhookSubscriptionCreate.webhookSubscription);
        }

        results.push({
          topic,
          success: result.webhookSubscriptionCreate.userErrors?.length === 0,
          result: result.webhookSubscriptionCreate
        });
      } catch (error) {
        logger.error(`Error creating webhook for ${topic}:`, error);
        results.push({
          topic,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }
}