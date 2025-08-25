import { logger } from '../utils/logger.js';
import { ProductTransformer } from '../transformers/product-transformer.js';
import { OrderTransformer } from '../transformers/order-transformer.js';
import { CustomerTransformer } from '../transformers/customer-transformer.js';

export class SyncManager {
  constructor(graphqlClient, cmsAdapter) {
    this.graphqlClient = graphqlClient;
    this.cmsAdapter = cmsAdapter;
    this.productTransformer = new ProductTransformer();
    this.orderTransformer = new OrderTransformer();
    this.customerTransformer = new CustomerTransformer();
    
    // Sync statistics
    this.stats = {
      products: { synced: 0, failed: 0, lastSync: null },
      orders: { synced: 0, failed: 0, lastSync: null },
      customers: { synced: 0, failed: 0, lastSync: null },
      webhooks: { processed: 0, failed: 0 }
    };
  }

  async getStatus() {
    return {
      isHealthy: await this.cmsAdapter.isHealthy(),
      stats: this.stats,
      lastActivity: new Date().toISOString()
    };
  }

  // Product Sync Methods
  async syncProductsFromShopify(session, options = {}) {
    const { batchSize = 50, cursor = null, query = null } = options;
    
    try {
      logger.info('Starting product sync from Shopify', { batchSize, cursor, query });
      
      const response = await this.graphqlClient.getProducts(session, {
        first: batchSize,
        after: cursor,
        query
      });

      const products = response.products.edges.map(edge => edge.node);
      const results = [];

      for (const product of products) {
        try {
          const result = await this.syncProductToCMS(product, 'sync');
          results.push(result);
          this.stats.products.synced++;
        } catch (error) {
          logger.error(`Failed to sync product ${product.id}:`, error);
          results.push({ 
            success: false, 
            shopifyId: product.id, 
            error: error.message 
          });
          this.stats.products.failed++;
        }
      }

      this.stats.products.lastSync = new Date().toISOString();

      // Check if there are more products to sync
      const hasNextPage = response.products.pageInfo.hasNextPage;
      const nextCursor = response.products.pageInfo.endCursor;

      logger.info('Product sync batch completed', {
        processed: products.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        hasNextPage,
        nextCursor
      });

      return {
        success: true,
        results,
        pagination: {
          hasNextPage,
          nextCursor,
          processedCount: products.length
        }
      };

    } catch (error) {
      logger.error('Product sync from Shopify failed:', error);
      throw error;
    }
  }

  async syncProductToCMS(shopifyProduct, action = 'sync') {
    try {
      logger.info(`Syncing product to CMS`, { 
        action,
        shopifyId: shopifyProduct.id,
        title: shopifyProduct.title 
      });

      // Transform Shopify product to CMS format
      const cmsProduct = this.productTransformer.shopifyToCMS(shopifyProduct);

      let result;
      switch (action) {
        case 'create':
          result = await this.cmsAdapter.createProduct(cmsProduct);
          break;
        case 'update':
        case 'sync':
          // Try update first, create if doesn't exist
          result = await this.cmsAdapter.updateProduct(cmsProduct) ||
                   await this.cmsAdapter.createProduct(cmsProduct);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      logger.info('Product synced to CMS successfully', {
        shopifyId: shopifyProduct.id,
        cmsId: result.id,
        action
      });

      return {
        success: true,
        shopifyId: shopifyProduct.id,
        cmsId: result.id,
        action,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to sync product ${shopifyProduct.id} to CMS:`, error);
      throw error;
    }
  }

  async deleteProductFromCMS(shopifyProductId) {
    try {
      logger.info('Deleting product from CMS', { shopifyId: shopifyProductId });

      const result = await this.cmsAdapter.deleteProduct(shopifyProductId);

      logger.info('Product deleted from CMS successfully', {
        shopifyId: shopifyProductId,
        result
      });

      return {
        success: true,
        shopifyId: shopifyProductId,
        action: 'delete',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to delete product ${shopifyProductId} from CMS:`, error);
      throw error;
    }
  }

  // Order Sync Methods
  async syncOrdersFromShopify(session, options = {}) {
    const { batchSize = 50, cursor = null, query = null } = options;
    
    try {
      logger.info('Starting order sync from Shopify', { batchSize, cursor, query });
      
      const response = await this.graphqlClient.getOrders(session, {
        first: batchSize,
        after: cursor,
        query
      });

      const orders = response.orders.edges.map(edge => edge.node);
      const results = [];

      for (const order of orders) {
        try {
          const result = await this.syncOrderToCMS(order, 'sync');
          results.push(result);
          this.stats.orders.synced++;
        } catch (error) {
          logger.error(`Failed to sync order ${order.id}:`, error);
          results.push({ 
            success: false, 
            shopifyId: order.id, 
            error: error.message 
          });
          this.stats.orders.failed++;
        }
      }

      this.stats.orders.lastSync = new Date().toISOString();

      const hasNextPage = response.orders.pageInfo.hasNextPage;
      const nextCursor = response.orders.pageInfo.endCursor;

      logger.info('Order sync batch completed', {
        processed: orders.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        hasNextPage,
        nextCursor
      });

      return {
        success: true,
        results,
        pagination: {
          hasNextPage,
          nextCursor,
          processedCount: orders.length
        }
      };

    } catch (error) {
      logger.error('Order sync from Shopify failed:', error);
      throw error;
    }
  }

  async syncOrderToCMS(shopifyOrder, action = 'sync') {
    try {
      logger.info(`Syncing order to CMS`, { 
        action,
        shopifyId: shopifyOrder.id,
        orderName: shopifyOrder.name 
      });

      // Transform Shopify order to CMS format
      const cmsOrder = this.orderTransformer.shopifyToCMS(shopifyOrder);

      let result;
      switch (action) {
        case 'create':
          result = await this.cmsAdapter.createOrder(cmsOrder);
          break;
        case 'update':
        case 'sync':
          result = await this.cmsAdapter.updateOrder(cmsOrder) ||
                   await this.cmsAdapter.createOrder(cmsOrder);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      logger.info('Order synced to CMS successfully', {
        shopifyId: shopifyOrder.id,
        cmsId: result.id,
        action
      });

      return {
        success: true,
        shopifyId: shopifyOrder.id,
        cmsId: result.id,
        action,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to sync order ${shopifyOrder.id} to CMS:`, error);
      throw error;
    }
  }

  async handleOrderStatusChange(shopifyOrder, status) {
    try {
      logger.info('Handling order status change', {
        orderId: shopifyOrder.id,
        orderName: shopifyOrder.name,
        newStatus: status
      });

      const result = await this.cmsAdapter.updateOrderStatus(
        shopifyOrder.id, 
        status, 
        shopifyOrder
      );

      logger.info('Order status updated in CMS', {
        shopifyId: shopifyOrder.id,
        status,
        result
      });

      return {
        success: true,
        shopifyId: shopifyOrder.id,
        action: `status_${status}`,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to handle order status change for ${shopifyOrder.id}:`, error);
      throw error;
    }
  }

  // Customer Sync Methods
  async syncCustomersFromShopify(session, options = {}) {
    const { batchSize = 50, cursor = null, query = null } = options;
    
    try {
      logger.info('Starting customer sync from Shopify', { batchSize, cursor, query });
      
      const response = await this.graphqlClient.getCustomers(session, {
        first: batchSize,
        after: cursor,
        query
      });

      const customers = response.customers.edges.map(edge => edge.node);
      const results = [];

      for (const customer of customers) {
        try {
          const result = await this.syncCustomerToCMS(customer, 'sync');
          results.push(result);
          this.stats.customers.synced++;
        } catch (error) {
          logger.error(`Failed to sync customer ${customer.id}:`, error);
          results.push({ 
            success: false, 
            shopifyId: customer.id, 
            error: error.message 
          });
          this.stats.customers.failed++;
        }
      }

      this.stats.customers.lastSync = new Date().toISOString();

      const hasNextPage = response.customers.pageInfo.hasNextPage;
      const nextCursor = response.customers.pageInfo.endCursor;

      logger.info('Customer sync batch completed', {
        processed: customers.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length,
        hasNextPage,
        nextCursor
      });

      return {
        success: true,
        results,
        pagination: {
          hasNextPage,
          nextCursor,
          processedCount: customers.length
        }
      };

    } catch (error) {
      logger.error('Customer sync from Shopify failed:', error);
      throw error;
    }
  }

  async syncCustomerToCMS(shopifyCustomer, action = 'sync') {
    try {
      logger.info(`Syncing customer to CMS`, { 
        action,
        shopifyId: shopifyCustomer.id,
        email: shopifyCustomer.email 
      });

      // Transform Shopify customer to CMS format
      const cmsCustomer = this.customerTransformer.shopifyToCMS(shopifyCustomer);

      let result;
      switch (action) {
        case 'create':
          result = await this.cmsAdapter.createCustomer(cmsCustomer);
          break;
        case 'update':
        case 'sync':
          result = await this.cmsAdapter.updateCustomer(cmsCustomer) ||
                   await this.cmsAdapter.createCustomer(cmsCustomer);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      logger.info('Customer synced to CMS successfully', {
        shopifyId: shopifyCustomer.id,
        cmsId: result.id,
        action
      });

      return {
        success: true,
        shopifyId: shopifyCustomer.id,
        cmsId: result.id,
        action,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to sync customer ${shopifyCustomer.id} to CMS:`, error);
      throw error;
    }
  }

  async deleteCustomerFromCMS(shopifyCustomerId) {
    try {
      logger.info('Deleting customer from CMS', { shopifyId: shopifyCustomerId });

      const result = await this.cmsAdapter.deleteCustomer(shopifyCustomerId);

      logger.info('Customer deleted from CMS successfully', {
        shopifyId: shopifyCustomerId,
        result
      });

      return {
        success: true,
        shopifyId: shopifyCustomerId,
        action: 'delete',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`Failed to delete customer ${shopifyCustomerId} from CMS:`, error);
      throw error;
    }
  }

  // Inventory and other sync methods
  async syncInventoryToCMS(inventoryLevel) {
    try {
      logger.info('Syncing inventory to CMS', {
        inventoryItemId: inventoryLevel.inventory_item_id,
        locationId: inventoryLevel.location_id,
        available: inventoryLevel.available
      });

      const result = await this.cmsAdapter.updateInventory({
        shopify_inventory_item_id: inventoryLevel.inventory_item_id,
        shopify_location_id: inventoryLevel.location_id,
        available_quantity: inventoryLevel.available,
        updated_at: new Date().toISOString()
      });

      return {
        success: true,
        inventoryItemId: inventoryLevel.inventory_item_id,
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to sync inventory to CMS:', error);
      throw error;
    }
  }

  async handleAppUninstalled(data) {
    try {
      logger.info('Handling app uninstall cleanup', {
        shopDomain: data.domain || data.myshopify_domain
      });

      // Clean up any resources, mark shop as inactive, etc.
      const result = await this.cmsAdapter.deactivateShop(
        data.domain || data.myshopify_domain
      );

      return {
        success: true,
        action: 'app_uninstalled',
        result,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Failed to handle app uninstall:', error);
      throw error;
    }
  }

  // Bulk sync operations
  async performFullSync(session, options = {}) {
    const { includeProducts = true, includeOrders = true, includeCustomers = true } = options;
    
    try {
      logger.info('Starting full sync operation', { includeProducts, includeOrders, includeCustomers });
      
      const results = {
        products: null,
        orders: null,
        customers: null,
        startTime: new Date().toISOString(),
        endTime: null,
        success: true
      };

      if (includeProducts) {
        try {
          let allProducts = [];
          let cursor = null;
          let hasNextPage = true;

          while (hasNextPage) {
            const productResult = await this.syncProductsFromShopify(session, { cursor });
            allProducts = allProducts.concat(productResult.results);
            
            hasNextPage = productResult.pagination.hasNextPage;
            cursor = productResult.pagination.nextCursor;
          }

          results.products = {
            total: allProducts.length,
            successful: allProducts.filter(r => r.success).length,
            failed: allProducts.filter(r => !r.success).length
          };
        } catch (error) {
          results.products = { error: error.message };
          results.success = false;
        }
      }

      if (includeOrders) {
        try {
          let allOrders = [];
          let cursor = null;
          let hasNextPage = true;

          while (hasNextPage) {
            const orderResult = await this.syncOrdersFromShopify(session, { cursor });
            allOrders = allOrders.concat(orderResult.results);
            
            hasNextPage = orderResult.pagination.hasNextPage;
            cursor = orderResult.pagination.nextCursor;
          }

          results.orders = {
            total: allOrders.length,
            successful: allOrders.filter(r => r.success).length,
            failed: allOrders.filter(r => !r.success).length
          };
        } catch (error) {
          results.orders = { error: error.message };
          results.success = false;
        }
      }

      if (includeCustomers) {
        try {
          let allCustomers = [];
          let cursor = null;
          let hasNextPage = true;

          while (hasNextPage) {
            const customerResult = await this.syncCustomersFromShopify(session, { cursor });
            allCustomers = allCustomers.concat(customerResult.results);
            
            hasNextPage = customerResult.pagination.hasNextPage;
            cursor = customerResult.pagination.nextCursor;
          }

          results.customers = {
            total: allCustomers.length,
            successful: allCustomers.filter(r => r.success).length,
            failed: allCustomers.filter(r => !r.success).length
          };
        } catch (error) {
          results.customers = { error: error.message };
          results.success = false;
        }
      }

      results.endTime = new Date().toISOString();
      
      logger.info('Full sync operation completed', results);
      
      return results;

    } catch (error) {
      logger.error('Full sync operation failed:', error);
      throw error;
    }
  }
}