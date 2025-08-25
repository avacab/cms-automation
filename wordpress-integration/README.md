# WordPress Integration for Headless CMS

This integration enables bidirectional synchronization between WordPress and your headless CMS system, allowing seamless content management across platforms.

## 📁 Structure

```
wordpress-integration/
├── wp-headless-cms-bridge/          # WordPress Plugin
│   ├── wp-headless-cms-bridge.php   # Main plugin file
│   ├── includes/                    # Core functionality
│   │   ├── class-plugin.php         # Main plugin class
│   │   ├── class-api-client.php     # CMS API communication
│   │   ├── class-content-sync.php   # Content synchronization
│   │   ├── class-webhook-handler.php# Webhook processing
│   │   └── class-admin-settings.php # Admin interface
│   ├── admin/                       # Admin interface files
│   │   ├── css/admin-styles.css     # Admin styling
│   │   ├── js/admin-scripts.js      # Admin JavaScript
│   │   └── views/settings-page.php  # Settings interface
│   └── public/                      # Public-facing files
└── README.md                        # This file
```

## 🚀 Installation

### WordPress Plugin Installation

1. **Upload Plugin**
   ```bash
   # Copy plugin to WordPress plugins directory
   cp -r wp-headless-cms-bridge /path/to/wordpress/wp-content/plugins/
   ```

2. **Activate Plugin**
   - Go to WordPress Admin → Plugins
   - Find "Headless CMS Bridge"
   - Click "Activate"

3. **Configure Settings**
   - Navigate to Settings → Headless CMS
   - Enter your CMS API URL (e.g., `http://localhost:5000`)
   - Enter your API key
   - Configure sync settings

### CMS Backend Integration

The CMS backend components are automatically available in:
- `backend/integrations/wordpress/`

## ⚙️ Configuration

### WordPress Plugin Settings

Access via **Settings → Headless CMS** in WordPress admin:

#### API Configuration
- **CMS API URL**: Your headless CMS API endpoint
- **API Key**: Authentication key for CMS access

#### Sync Configuration
- **Enable Sync**: Toggle content synchronization
- **Sync Direction**: 
  - WordPress to CMS (one-way)
  - CMS to WordPress (one-way)
  - Bidirectional (both ways)
- **Post Types**: Select which content types to sync

#### Webhook Configuration
Webhook URLs for CMS integration:
- **Content**: `/wp-json/wp-headless-cms-bridge/v1/webhook/content`
- **Media**: `/wp-json/wp-headless-cms-bridge/v1/webhook/media`
- **Health**: `/wp-json/wp-headless-cms-bridge/v1/webhook/health`

### CMS Configuration

```javascript
const WordPressAdapter = require('./backend/integrations/wordpress/wordpress-adapter');

const wpAdapter = new WordPressAdapter({
    wordpressUrl: 'https://your-wordpress-site.com',
    webhookSecret: 'your-webhook-secret',
    apiKey: 'your-api-key',
    syncDirection: 'bidirectional'
});
```

## 🔄 Sync Workflows

### Content Synchronization

**WordPress → CMS**
1. User creates/updates content in WordPress
2. Plugin detects changes via WordPress hooks
3. Content is transformed to CMS format
4. API call sent to CMS to create/update content

**CMS → WordPress**
1. Content changes in CMS trigger webhook
2. WordPress receives webhook with content data
3. Plugin validates webhook signature
4. Content is created/updated in WordPress

### Supported Content Types

- **Posts** - Blog posts and articles
- **Pages** - Static pages
- **Custom Post Types** - Configurable
- **Media** - Images and attachments
- **Metadata** - Custom fields and SEO data
- **Taxonomies** - Categories and tags

## 🔐 Authentication & Security

### API Authentication
- **API Keys**: Secure token-based authentication
- **JWT Tokens**: Temporary access tokens
- **Rate Limiting**: Prevents API abuse

### Webhook Security
- **HMAC Signatures**: Verify webhook authenticity
- **Timestamp Validation**: Prevent replay attacks
- **Secret Keys**: Shared secret for signature generation

## 📊 Monitoring & Logging

### Sync Logs
View synchronization history in WordPress admin:
- Successful syncs with timestamps
- Error details for failed syncs
- Content mapping between systems

### System Status
Monitor integration health:
- API connection status
- Webhook endpoint availability
- Authentication validation
- Sync queue status

## 🧪 Testing

Run the integration test suite:

```bash
# Run all tests
node test-wordpress-integration.js

# View test report
cat wordpress-integration-test-report.json
```

### Test Coverage
- ✅ Content transformation (CMS ↔ WordPress)
- ✅ Webhook sending and signature verification
- ✅ Authentication and API key management
- ✅ WordPress adapter functionality
- ✅ End-to-end workflow integration
- ✅ Error handling and validation

## 🔧 Troubleshooting

### Common Issues

**Connection Failed**
- Verify CMS API URL is correct and accessible
- Check API key is valid and has proper permissions
- Ensure firewalls allow connections

**Sync Not Working**
- Confirm sync is enabled in settings
- Check sync direction is configured correctly
- Verify post types are selected for sync
- Review sync logs for error details

**Webhook Issues**
- Validate webhook secret matches CMS configuration
- Check webhook URLs are accessible
- Verify SSL certificates if using HTTPS

### Debug Mode

Enable WordPress debug mode for detailed logging:

```php
// wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

## 📚 API Reference

### WordPress REST API Endpoints

**Webhook Endpoints**
- `POST /wp-json/wp-headless-cms-bridge/v1/webhook/content`
- `POST /wp-json/wp-headless-cms-bridge/v1/webhook/media`
- `GET /wp-json/wp-headless-cms-bridge/v1/webhook/health`

**Content Endpoints**
- WordPress core REST API (`/wp-json/wp/v2/`)

### CMS Integration Classes

**WordPressAdapter**
```javascript
const adapter = new WordPressAdapter(options);
await adapter.sendContentToWordPress(content);
await adapter.testConnection();
```

**ContentTransformer**
```javascript
const transformer = new ContentTransformer();
const wpContent = transformer.transformCMSToWP(cmsContent);
const cmsContent = transformer.transformWPToCMS(wpContent);
```

**WebhookSender**
```javascript
const sender = new WebhookSender();
await sender.sendWebhook(url, secret, event, data);
```

**AuthManager**
```javascript
const auth = new AuthManager();
const apiKey = auth.generateApiKey(wpUrl, metadata);
const isValid = await auth.validateApiKey(apiKey);
```

## 🤝 Contributing

1. **Development Setup**
   ```bash
   # Install dependencies
   npm install
   
   # Run tests
   npm test
   ```

2. **Code Standards**
   - Follow WordPress coding standards for PHP
   - Use ESLint for JavaScript
   - Add tests for new functionality

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

**Built for seamless WordPress and headless CMS integration** 🚀