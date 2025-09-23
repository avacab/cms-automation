import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { GraphQLClient } from '../src/services/graphql-client.js';
import { SyncManager } from '../src/services/sync-manager.js';
import { WebhookHandler } from '../src/handlers/webhook-handler.js';
import { AuthHandler } from '../src/handlers/auth-handler.js';
import { CMSAdapter } from '../src/adapters/cms-adapter.js';
import { ProductTransformer } from '../src/transformers/product-transformer.js';
import { OrderTransformer } from '../src/transformers/order-transformer.js';
import { CustomerTransformer } from '../src/transformers/customer-transformer.js';

describe('Shopify Integration Test Suite', () => {
  let mockShopifyApi;
  let mockSessionStorage;
  let mockSession;
  let graphqlClient;
  let cmsAdapter;
  let syncManager;
  let webhookHandler;
  let authHandler;

  beforeEach(() => {
    // Setup mock Shopify API
    mockShopifyApi = {
      clients: {
        Graphql: class {
          constructor() {}
          async query() {
            return { body: { data: {} } };
          }
        }
      },
      auth: {
        begin: async () => 'https://test-auth-url.com',
        callback: async () => ({ session: mockSession })
      },
      session: {
        getOfflineId: (shop) => `offline_${shop}`
      }
    };

    // Setup mock session storage
    mockSessionStorage = {
      storeSession: async () => true,
      loadSession: async () => mockSession,
      deleteSession: async () => true
    };

    // Setup mock session
    mockSession = {
      id: 'test_session',
      shop: 'test-shop.myshopify.com',
      accessToken: 'test_access_token',
      scope: 'read_products,write_products'
    };

    // Initialize services
    graphqlClient = new GraphQLClient(mockShopifyApi);
    cmsAdapter = new CMSAdapter({
      apiUrl: 'http://localhost:5000',
      apiKey: 'test_api_key'
    });
    syncManager = new SyncManager(graphqlClient, cmsAdapter);
    webhookHandler = new WebhookHandler(syncManager);
    authHandler = new AuthHandler(mockShopifyApi, mockSessionStorage);
  });

  describe('GraphQL Client', () => {
    test('should execute GraphQL queries successfully', async () => {
      const mockQuery = 'query { products { edges { node { id title } } } }';
      
      // Mock successful response
      mockShopifyApi.clients.Graphql = class {
        constructor() {}
        async query() {
          return {
            body: {
              data: {
                products: {
                  edges: [
                    { node: { id: 'gid://shopify/Product/1', title: 'Test Product' } }
                  ]
                }
              }
            }
          };
        }
      };

      const result = await graphqlClient.executeQuery(mockSession, mockQuery);
      
      assert.ok(result.products);
      assert.equal(result.products.edges.length, 1);
      assert.equal(result.products.edges[0].node.title, 'Test Product');
    });

    test('should handle GraphQL errors', async () => {
      const mockQuery = 'invalid query';
      
      // Mock error response
      mockShopifyApi.clients.Graphql = class {
        constructor() {}
        async query() {
          return {
            body: {
              errors: [{ message: 'Syntax error' }]
            }
          };
        }
      };

      await assert.rejects(
        () => graphqlClient.executeQuery(mockSession, mockQuery),
        /GraphQL errors/
      );
    });

    test('should get products with pagination', async () => {
      // Mock products response
      mockShopifyApi.clients.Graphql = class {
        constructor() {}
        async query() {
          return {
            body: {
              data: {
                products: {
                  edges: [
                    {
                      node: {
                        id: 'gid://shopify/Product/1',
                        title: 'Test Product',
                        handle: 'test-product',
                        status: 'ACTIVE',
                        variants: { edges: [] },
                        images: { edges: [] }
                      }
                    }
                  ],
                  pageInfo: {
                    hasNextPage: false,
                    endCursor: 'cursor123'
                  }
                }
              }
            }
          };
        }
      };

      const result = await graphqlClient.getProducts(mockSession, { first: 10 });
      
      assert.ok(result.products);
      assert.equal(result.products.edges.length, 1);
      assert.equal(result.products.pageInfo.hasNextPage, false);
    });
  });

  describe('Product Transformer', () => {
    let transformer;

    beforeEach(() => {
      transformer = new ProductTransformer();
    });

    test('should transform Shopify product to CMS format', () => {
      const shopifyProduct = {
        id: 'gid://shopify/Product/123',
        title: 'Test Product',
        description: 'A test product',
        handle: 'test-product',
        vendor: 'Test Vendor',
        productType: 'Physical',
        status: 'ACTIVE',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
        tags: ['tag1', 'tag2'],
        variants: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductVariant/456',
                title: 'Default',
                price: '19.99',
                sku: 'TEST-001',
                inventoryQuantity: 100
              }
            }
          ]
        },
        images: {
          edges: [
            {
              node: {
                id: 'gid://shopify/ProductImage/789',
                url: 'https://example.com/image.jpg',
                altText: 'Test image'
              }
            }
          ]
        }
      };

      const cmsProduct = transformer.shopifyToCMS(shopifyProduct);

      assert.equal(cmsProduct.shopify_id, 'gid://shopify/Product/123');
      assert.equal(cmsProduct.title, 'Test Product');
      assert.equal(cmsProduct.description, 'A test product');
      assert.equal(cmsProduct.status, 'published');
      assert.equal(cmsProduct.price, 19.99);
      assert.equal(cmsProduct.variants.length, 1);
      assert.equal(cmsProduct.images.length, 1);
      assert.equal(cmsProduct.content_type, 'product');
      assert.equal(cmsProduct.source, 'shopify');
    });

    test('should validate required fields', () => {
      const invalidProduct = {};
      
      assert.throws(
        () => transformer.validateShopifyProduct(invalidProduct),
        /Missing required fields/
      );
    });

    test('should generate product slug from title', () => {
      const title = 'Test Product With Special Characters!@#';
      const slug = transformer.generateSlug(title);
      
      assert.equal(slug, 'test-product-with-special-characters');
    });
  });

  describe('Order Transformer', () => {
    let transformer;

    beforeEach(() => {
      transformer = new OrderTransformer();
    });

    test('should transform Shopify order to CMS format', () => {
      const shopifyOrder = {
        id: 'gid://shopify/Order/123',
        name: '#1001',
        email: 'customer@example.com',
        createdAt: '2024-01-01T00:00:00Z',
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        totalPrice: '29.99',
        subtotalPrice: '24.99',
        totalTax: '5.00',
        currency: 'USD',
        customer: {
          id: 'gid://shopify/Customer/456',
          email: 'customer@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        lineItems: {
          edges: [
            {
              node: {
                id: 'gid://shopify/LineItem/789',
                title: 'Test Product',
                quantity: 2,
                variant: {
                  id: 'gid://shopify/ProductVariant/101',
                  price: '12.49'
                }
              }
            }
          ]
        }
      };

      const cmsOrder = transformer.shopifyToCMS(shopifyOrder);

      assert.equal(cmsOrder.shopify_id, 'gid://shopify/Order/123');
      assert.equal(cmsOrder.order_name, '#1001');
      assert.equal(cmsOrder.email, 'customer@example.com');
      assert.equal(cmsOrder.total_price, 29.99);
      assert.equal(cmsOrder.financial_status, 'paid');
      assert.equal(cmsOrder.order_status, 'completed');
      assert.equal(cmsOrder.line_items.length, 1);
      assert.equal(cmsOrder.item_count, 2);
      assert.equal(cmsOrder.content_type, 'order');
    });

    test('should determine order status correctly', () => {
      const transformer = new OrderTransformer();

      // Test completed order
      const completedOrder = {
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        cancelledAt: null
      };
      assert.equal(transformer.determineOrderStatus(completedOrder), 'completed');

      // Test cancelled order
      const cancelledOrder = {
        financialStatus: 'paid',
        fulfillmentStatus: 'fulfilled',
        cancelledAt: '2024-01-01T00:00:00Z'
      };
      assert.equal(transformer.determineOrderStatus(cancelledOrder), 'cancelled');

      // Test processing order
      const processingOrder = {
        financialStatus: 'paid',
        fulfillmentStatus: null,
        cancelledAt: null
      };
      assert.equal(transformer.determineOrderStatus(processingOrder), 'processing');
    });
  });

  describe('Customer Transformer', () => {
    let transformer;

    beforeEach(() => {
      transformer = new CustomerTransformer();
    });

    test('should transform Shopify customer to CMS format', () => {
      const shopifyCustomer = {
        id: 'gid://shopify/Customer/123',
        email: 'customer@example.com',
        firstName: 'John',
        lastName: 'Doe',
        phone: '+1234567890',
        state: 'enabled',
        acceptsMarketing: true,
        createdAt: '2024-01-01T00:00:00Z',
        orders: {
          edges: [
            {
              node: {
                id: 'gid://shopify/Order/456',
                name: '#1001',
                totalPrice: '29.99',
                createdAt: '2024-01-15T00:00:00Z'
              }
            }
          ]
        },
        defaultAddress: {
          firstName: 'John',
          lastName: 'Doe',
          address1: '123 Main St',
          city: 'New York',
          province: 'NY',
          country: 'United States',
          zip: '10001'
        }
      };

      const cmsCustomer = transformer.shopifyToCMS(shopifyCustomer);

      assert.equal(cmsCustomer.shopify_id, 'gid://shopify/Customer/123');
      assert.equal(cmsCustomer.email, 'customer@example.com');
      assert.equal(cmsCustomer.full_name, 'John Doe');
      assert.equal(cmsCustomer.status, 'active');
      assert.equal(cmsCustomer.order_count, 1);
      assert.equal(cmsCustomer.total_spent, 29.99);
      assert.equal(cmsCustomer.customer_segment, 'first_time');
      assert.ok(cmsCustomer.default_address);
      assert.equal(cmsCustomer.content_type, 'customer');
    });

    test('should determine customer segment correctly', () => {
      const transformer = new CustomerTransformer();

      // Test VIP customer
      const vipOrders = [
        { total_price: 600 },
        { total_price: 400 }
      ];
      assert.equal(transformer.determineCustomerSegment(vipOrders), 'vip');

      // Test loyal customer
      const loyalOrders = Array(6).fill({ total_price: 50 });
      assert.equal(transformer.determineCustomerSegment(loyalOrders), 'loyal');

      // Test first-time customer
      const firstTimeOrders = [{ total_price: 25 }];
      assert.equal(transformer.determineCustomerSegment(firstTimeOrders), 'first_time');

      // Test new customer
      const newOrders = [];
      assert.equal(transformer.determineCustomerSegment(newOrders), 'new');
    });
  });

  describe('Webhook Handler', () => {
    test('should handle product create webhook', async () => {
      const productData = {
        id: 'gid://shopify/Product/123',
        title: 'Test Product',
        status: 'active'
      };

      // Mock sync manager
      syncManager.syncProductToCMS = async (product, action) => {
        assert.equal(action, 'create');
        return { success: true, cmsId: 'cms_123' };
      };

      const result = await webhookHandler.handleWebhook('PRODUCTS_CREATE', productData);
      
      assert.ok(result.success);
      assert.equal(result.action, 'create');
    });

    test('should verify webhook signature', () => {
      const secret = 'test_secret';
      const data = { test: 'data' };
      const rawBody = JSON.stringify(data);
      
      // Create valid signature
      const crypto = await import('crypto');
      const hmac = crypto.createHmac('sha256', secret);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('base64');

      const handler = new WebhookHandler(syncManager);
      handler.webhookSecret = secret;

      assert.ok(handler.verifyWebhookSignature(rawBody, signature));
      assert.ok(!handler.verifyWebhookSignature(rawBody, 'invalid_signature'));
    });

    test('should handle unrecognized webhook topics', async () => {
      const result = await webhookHandler.handleWebhook('UNKNOWN_TOPIC', {});
      
      assert.ok(!result.success);
      assert.match(result.message, /Unhandled webhook topic/);
    });
  });

  describe('Auth Handler', () => {
    test('should validate shop domain', () => {
      assert.ok(authHandler.isValidShopDomain('test-shop.myshopify.com'));
      assert.ok(!authHandler.isValidShopDomain('invalid-domain.com'));
      assert.ok(!authHandler.isValidShopDomain('test-shop'));
      assert.ok(!authHandler.isValidShopDomain(''));
    });

    test('should get session for valid shop', async () => {
      const session = await authHandler.getSession('test-shop.myshopify.com');
      assert.equal(session.shop, 'test-shop.myshopify.com');
    });

    test('should return null for non-existent shop', async () => {
      mockSessionStorage.loadSession = async () => null;
      
      const session = await authHandler.getSession('non-existent.myshopify.com');
      assert.equal(session, null);
    });
  });

  describe('CMS Adapter', () => {
    test('should create CMS adapter with proper configuration', () => {
      const adapter = new CMSAdapter({
        apiUrl: 'http://localhost:5000',
        apiKey: 'test_key',
        timeout: 5000
      });

      const info = adapter.getConnectionInfo();
      assert.equal(info.apiUrl, 'http://localhost:5000');
      assert.ok(info.hasApiKey);
      assert.equal(info.timeout, 5000);
    });

    test('should throw error without API URL', () => {
      assert.throws(
        () => new CMSAdapter({}),
        /CMS API URL is required/
      );
    });
  });

  describe('Integration Tests', () => {
    test('should complete full product sync workflow', async () => {
      const mockProduct = {
        id: 'gid://shopify/Product/123',
        title: 'Test Product',
        handle: 'test-product',
        status: 'ACTIVE',
        variants: { edges: [] },
        images: { edges: [] },
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };

      // Mock GraphQL client response
      graphqlClient.getProducts = async () => ({
        products: {
          edges: [{ node: mockProduct }],
          pageInfo: { hasNextPage: false, endCursor: null }
        }
      });

      // Mock CMS adapter response
      cmsAdapter.createProduct = async (product) => ({
        id: 'cms_123',
        shopify_id: product.shopify_id,
        title: product.title
      });

      const result = await syncManager.syncProductsFromShopify(mockSession);
      
      assert.ok(result.success);
      assert.equal(result.results.length, 1);
      assert.ok(result.results[0].success);
    });

    test('should handle sync errors gracefully', async () => {
      const mockProduct = {
        id: 'gid://shopify/Product/123',
        title: 'Test Product',
        variants: { edges: [] },
        images: { edges: [] }
      };

      graphqlClient.getProducts = async () => ({
        products: {
          edges: [{ node: mockProduct }],
          pageInfo: { hasNextPage: false, endCursor: null }
        }
      });

      // Mock CMS adapter to throw error
      cmsAdapter.createProduct = async () => {
        throw new Error('CMS connection failed');
      };

      const result = await syncManager.syncProductsFromShopify(mockSession);
      
      assert.ok(result.success); // Overall operation succeeds
      assert.equal(result.results.length, 1);
      assert.ok(!result.results[0].success); // Individual product fails
      assert.match(result.results[0].error, /CMS connection failed/);
    });
  });
});