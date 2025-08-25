# Shopify Integration for Headless CMS

This integration enables bidirectional synchronization between Shopify and your headless CMS system using modern GraphQL APIs, real-time webhooks, and event-driven architecture.

## 📁 Structure

```
shopify-integration/
├── shopify-headless-cms-bridge/     # Shopify App (Node.js/Express)
│   ├── src/                         # Source code
│   │   ├── services/                # Core services
│   │   │   ├── graphql-client.js    # Shopify GraphQL client
│   │   │   └── sync-manager.js      # Sync orchestration
│   │   ├── handlers/                # Request handlers
│   │   │   ├── webhook-handler.js   # Webhook processing
│   │   │   └── auth-handler.js      # OAuth authentication
│   │   ├── adapters/                # External adapters
│   │   │   └── cms-adapter.js       # CMS API communication
│   │   ├── transformers/            # Data transformers
│   │   │   ├── product-transformer.js
│   │   │   ├── order-transformer.js
│   │   │   └── customer-transformer.js
│   │   └── utils/                   # Utilities
│   │       └── logger.js            # Winston logging
│   ├── test/                        # Test suite
│   │   └── test-suite.js           # Comprehensive tests
│   ├── index.js                     # Main application
│   └── package.json                 # Dependencies and scripts
└── README.md                        # This file
```

## 🚀 Installation

### Prerequisites

- Node.js 18+ 
- Shopify Partner Account
- CMS API access with authentication

### Shopify App Setup

1. **Create Shopify App**
   ```bash
   # Navigate to Shopify Partners Dashboard
   # Create new app with the following settings:
   # - App type: Custom app
   # - Distribution: Private app
   # - API access: GraphQL Admin API
   ```

2. **Install Dependencies**
   ```bash
   cd shopify-integration/shopify-headless-cms-bridge
   npm install
   ```

3. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Environment Variables**
   ```env
   # Shopify App Configuration
   SHOPIFY_API_KEY=your_shopify_api_key
   SHOPIFY_API_SECRET=your_shopify_api_secret  
   SHOPIFY_WEBHOOK_SECRET=your_webhook_secret
   SCOPES=read_products,write_products,read_orders,read_customers

   # CMS API Configuration  
   CMS_API_URL=http://localhost:5000
   CMS_API_KEY=your_cms_api_key

   # App Configuration
   PORT=3000
   NODE_ENV=development
   HOST=https://your-app-domain.com
   ```

### CMS Backend Integration

The CMS backend components are automatically available in:
- `backend/integrations/shopify/`

## ⚙️ Configuration

### Shopify App Settings

Configure in Shopify Partner Dashboard:

#### App URLs
- **App URL**: `https://your-app-domain.com`
- **Allowed redirection URLs**: `https://your-app-domain.com/auth/callback`

#### API Permissions (Scopes)
- `read_products` - Read product data
- `write_products` - Create/update products
- `read_orders` - Access order information  
- `read_customers` - Access customer data
- `read_inventory` - Inventory level access

#### Webhook Configuration
Webhook URLs (auto-configured during OAuth):
- **Products**: `https://your-app-domain.com/webhooks/products_create`
- **Orders**: `https://your-app-domain.com/webhooks/orders_create`
- **Customers**: `https://your-app-domain.com/webhooks/customers_create`

### CMS Configuration

```javascript
const ShopifyAdapter = require('./backend/integrations/shopify/shopify-adapter');

const shopifyAdapter = new ShopifyAdapter({
    shopifyUrl: 'https://your-shopify-bridge-app.com',
    webhookSecret: 'your-webhook-secret', 
    apiKey: 'your-api-key',
    syncDirection: 'bidirectional' // 'shopify_to_cms', 'cms_to_shopify', 'bidirectional'
});
```

## 🔄 Sync Workflows

### Modern GraphQL Architecture

**Shopify → CMS**
1. Shopify events trigger webhooks (products, orders, customers)
2. Bridge app receives webhook with HMAC signature verification
3. GraphQL client fetches complete data using bulk operations
4. Data transformers convert Shopify format to CMS schema
5. CMS adapter makes authenticated API calls to store data

**CMS → Shopify**  
1. CMS content changes trigger sync events
2. Content transformers convert CMS format to Shopify schema
3. GraphQL mutations update Shopify via Admin API
4. Response handling with retry logic and error recovery

### Supported Data Types

#### Products
- **Basic Info**: Title, description, vendor, product type, status
- **Variants**: SKU, pricing, inventory, weight, shipping
- **Media**: Images with alt text and positioning
- **SEO**: Meta titles, descriptions, handles  
- **Metadata**: Custom fields via metafields API
- **Categories**: Tags and collections mapping

#### Orders
- **Order Details**: Number, email, phone, status tracking
- **Financial**: Subtotal, tax, shipping, total, currency
- **Line Items**: Products, variants, quantities, pricing
- **Customer**: Contact info, addresses (billing/shipping)
- **Fulfillment**: Status updates, tracking information

#### Customers  
- **Profile**: Name, email, phone, marketing preferences
- **Addresses**: Multiple addresses with default selection
- **History**: Order count, total spent, last order date
- **Segmentation**: VIP, loyal, first-time, new customer categories
- **Analytics**: Lifetime value, purchase frequency, churn risk

### Real-Time Webhooks

The system handles these Shopify webhook events:

- `PRODUCTS_CREATE`, `PRODUCTS_UPDATE`, `PRODUCTS_DELETE`
- `ORDERS_CREATE`, `ORDERS_UPDATE`, `ORDERS_PAID`, `ORDERS_CANCELLED`, `ORDERS_FULFILLED`  
- `CUSTOMERS_CREATE`, `CUSTOMERS_UPDATE`, `CUSTOMERS_DELETE`
- `INVENTORY_LEVELS_UPDATE`
- `APP_UNINSTALLED`

## 🔐 Authentication & Security

### OAuth 2.0 Flow
- **Authorization**: Shopify Partner OAuth with offline tokens
- **Scopes**: Granular permissions for data access
- **Session Management**: Secure token storage with expiration handling

### Webhook Security
- **HMAC Signatures**: SHA-256 signature verification  
- **Timestamp Validation**: Prevent replay attacks
- **IP Allowlisting**: Optional Shopify IP validation
- **Rate Limiting**: Built-in request throttling

### API Security
- **Bearer Tokens**: JWT-based CMS authentication
- **HTTPS Only**: Encrypted data transmission
- **Secret Management**: Environment-based configuration
- **Audit Logging**: Comprehensive activity tracking

## 🧪 Testing

### Run Test Suite
```bash
npm test
```

### Test Coverage
- ✅ GraphQL client with pagination and error handling
- ✅ Data transformers (Products, Orders, Customers)  
- ✅ Webhook signature verification and processing
- ✅ OAuth authentication flow
- ✅ CMS adapter with retry logic
- ✅ Sync manager with batch operations
- ✅ End-to-end integration workflows
- ✅ Error handling and recovery

### Manual Testing
```bash
# Start development server
npm run dev

# Test webhook endpoints
curl -X POST http://localhost:3000/api/webhook/test \
  -H "Content-Type: application/json" \
  -d '{"topic": "PRODUCTS_CREATE", "data": {"id": "123", "title": "Test"}}'

# Test sync endpoints  
curl -X POST http://localhost:3000/api/sync/products
```

## 📊 Monitoring & Analytics

### Health Monitoring
- **Service Health**: `/health` endpoint with dependency checks
- **Sync Status**: Real-time sync queue monitoring  
- **Connection Status**: CMS and Shopify connectivity  
- **Webhook Status**: Event processing metrics

### Performance Metrics
- **Sync Statistics**: Success/failure rates by data type
- **Response Times**: API call latencies and bottlenecks
- **Queue Metrics**: Pending operations and processing rates
- **Error Tracking**: Detailed error logs with stack traces

### Business Intelligence
- **Data Flow**: Volume of synced products, orders, customers
- **Revenue Impact**: Order value tracking and trends  
- **Customer Insights**: Segmentation and behavior analysis
- **Inventory Sync**: Stock level accuracy and updates

## 🔧 Advanced Configuration

### Bulk Operations
```javascript
// Sync all products from Shopify
await syncManager.performFullSync(session, {
  includeProducts: true,
  includeOrders: true, 
  includeCustomers: true
});

// Batch process with pagination
await syncManager.syncProductsFromShopify(session, {
  batchSize: 100,
  cursor: 'eyJsYXN0X2lkIjo...'
});
```

### Custom Transformations
```javascript
// Extend product transformer
class CustomProductTransformer extends ProductTransformer {
  shopifyToCMS(shopifyProduct) {
    const cmsProduct = super.shopifyToCMS(shopifyProduct);
    
    // Add custom business logic
    cmsProduct.custom_category = this.mapToCustomCategory(shopifyProduct.tags);
    cmsProduct.profit_margin = this.calculateMargin(shopifyProduct.variants);
    
    return cmsProduct;
  }
}
```

### Event Handlers
```javascript
// Listen to sync events
shopifyAdapter.on('productSynced', (event) => {
  console.log('Product synced:', event.product.title);
  // Send notifications, update analytics, etc.
});

syncManager.on('syncCompleted', (stats) => {
  console.log('Sync completed:', stats);
  // Update dashboards, send reports, etc.
});
```

## 🚨 Troubleshooting

### Common Issues

**OAuth Failed**
- Verify `SHOPIFY_API_KEY` and `SHOPIFY_API_SECRET`
- Check redirect URLs in Partner Dashboard
- Ensure app is not in development store restrictions

**Webhook Not Received**  
- Confirm webhook URLs are publicly accessible
- Verify `SHOPIFY_WEBHOOK_SECRET` matches Partner Dashboard
- Check webhook subscription status in GraphQL

**Sync Errors**
- Validate CMS API credentials and endpoint accessibility
- Check data transformation errors in logs
- Verify GraphQL query permissions and scopes

**Rate Limiting**
- Implement exponential backoff retry logic
- Use Shopify's bulk operations for large datasets  
- Monitor API call limits in Shopify Partner Dashboard

### Debug Mode

```bash
# Enable debug logging
export LOG_LEVEL=debug
npm run dev
```

### Error Recovery
- **Automatic Retry**: Failed syncs retry with exponential backoff
- **Dead Letter Queue**: Permanently failed operations logged for analysis
- **Manual Retry**: Admin interface for reprocessing failed items
- **Rollback Support**: Revert sync operations if needed

## 📚 API Reference

### REST Endpoints

**Health & Status**
- `GET /health` - Service health check
- `GET /api/status` - Detailed system status  

**Authentication**  
- `GET /auth?shop=store.myshopify.com` - Initiate OAuth
- `GET /auth/callback` - OAuth callback handler

**Synchronization**
- `POST /api/sync/products` - Trigger product sync
- `POST /api/sync/orders` - Trigger order sync
- `POST /api/sync/customers` - Trigger customer sync

**Webhooks**
- `POST /webhooks/{event_type}` - Webhook endpoints

### GraphQL Operations

**Products**
```graphql
query getProducts($first: Int!, $after: String) {
  products(first: $first, after: $after) {
    edges {
      node {
        id title handle description vendor
        variants(first: 100) { edges { node { id title price sku } } }
        images(first: 10) { edges { node { id url altText } } }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}
```

**Orders**  
```graphql
query getOrders($first: Int!, $query: String) {
  orders(first: $first, query: $query) {
    edges {
      node {
        id name email financialStatus fulfillmentStatus
        totalPrice currency createdAt
        customer { id email firstName lastName }
        lineItems(first: 100) { edges { node { id title quantity } } }
      }
    }
  }
}
```

## 🤝 Contributing

1. **Development Setup**
   ```bash
   git clone <repository>
   cd shopify-integration/shopify-headless-cms-bridge
   npm install
   npm run dev
   ```

2. **Code Standards**
   - ES6+ modules with async/await
   - Comprehensive error handling  
   - Extensive logging and monitoring
   - Test coverage for new features

3. **Pull Requests**  
   - Include test coverage
   - Update documentation
   - Follow semantic versioning

## 📄 License

This integration is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and code comments
- **Issues**: Report bugs via GitHub issues
- **Questions**: Contact the development team

---

**Built for modern e-commerce with GraphQL-first architecture** 🚀