# Drupal Integration for Headless CMS

This integration enables bidirectional synchronization between Drupal and your headless CMS system using modern service container architecture, event-driven patterns, and comprehensive REST API integration.

## 📁 Structure

```
drupal-integration/
├── headless_cms_bridge/                # Drupal Module
│   ├── src/                           # Source code
│   │   ├── Service/                   # Dependency injection services
│   │   │   ├── ApiClientService.php   # CMS API communication
│   │   │   ├── ContentSyncService.php # Entity synchronization
│   │   │   ├── DataTransformerService.php # Data transformation
│   │   │   └── QueueProcessorService.php # Queue operations
│   │   ├── EventSubscriber/           # Symfony event subscribers
│   │   │   ├── ContentEventSubscriber.php # Entity events
│   │   │   └── UserEventSubscriber.php    # User events
│   │   ├── Controller/                # API controllers
│   │   │   ├── WebhookController.php  # Webhook endpoints
│   │   │   └── StatusController.php   # Status/health checks
│   │   └── Form/                      # Configuration forms
│   │       └── AdminConfigForm.php    # Admin configuration
│   ├── config/                        # Configuration schema
│   │   ├── install/                   # Default config
│   │   └── schema/                    # Config schema
│   ├── tests/                         # PHPUnit tests
│   │   └── src/                       # Test source
│   │       ├── Unit/                  # Unit tests
│   │       ├── Kernel/                # Kernel tests
│   │       └── Functional/            # Functional tests
│   ├── headless_cms_bridge.info.yml   # Module definition
│   ├── headless_cms_bridge.services.yml # Service definitions
│   ├── headless_cms_bridge.routing.yml # Route definitions
│   └── headless_cms_bridge.permissions.yml # Permissions
└── README.md                          # This file
```

## 🚀 Installation

### Prerequisites

- Drupal 10+ or 11+
- PHP 8.1+
- CMS API access with authentication
- Composer for dependency management

### Drupal Module Installation

1. **Install Module**
   ```bash
   # Copy module to Drupal modules directory
   cp -r headless_cms_bridge /path/to/drupal/modules/custom/
   
   # Or use Composer (if published)
   composer require drupal/headless_cms_bridge
   ```

2. **Enable Module**
   ```bash
   drush en headless_cms_bridge -y
   
   # Or via Drupal admin interface:
   # /admin/modules -> Find "Headless CMS Bridge" -> Enable
   ```

3. **Configure Module**
   ```bash
   # Navigate to configuration page
   # /admin/config/services/headless-cms-bridge
   ```

### CMS Backend Integration

The CMS backend components are automatically available in:
- `backend/integrations/drupal/`

## ⚙️ Configuration

### Drupal Module Settings

Configure via **Administration → Configuration → Web Services → Headless CMS Bridge** (`/admin/config/services/headless-cms-bridge`):

#### API Configuration
- **CMS API URL**: Your headless CMS API endpoint (e.g., `http://localhost:5000`)
- **API Key**: Authentication token for CMS access
- **Webhook Secret**: Shared secret for webhook signature verification

#### Sync Configuration
- **Sync Direction**: 
  - Drupal to CMS (one-way)
  - CMS to Drupal (one-way)
  - Bidirectional (both ways)
  - Disabled
- **Sync Mode**: Immediate or Queue-based
- **Entity Types**: Select which entity types to sync (nodes, users, taxonomy terms)
- **Content Types**: Choose specific node types for synchronization
- **Vocabularies**: Select taxonomy vocabularies to sync

#### Advanced Settings
- **Retry Attempts**: Number of retry attempts for failed API calls (default: 3)
- **Retry Delay**: Delay between retry attempts in milliseconds (default: 1000)
- **Queue Processing**: Enable background queue processing for heavy operations

### CMS Configuration

```javascript
const DrupalAdapter = require('./backend/integrations/drupal/drupal-adapter');

const drupalAdapter = new DrupalAdapter({
    drupalUrl: 'https://your-drupal-site.com',
    webhookSecret: 'your-webhook-secret',
    apiKey: 'your-api-key', 
    syncDirection: 'bidirectional'
});
```

## 🔄 Sync Workflows

### Modern Event-Driven Architecture

**Drupal → CMS**
1. Content entity operations trigger Symfony events
2. Event subscribers detect changes and validate sync requirements
3. Data transformers convert Drupal entities to CMS format
4. API client sends authenticated requests with retry logic
5. Queue processor handles batch operations and error recovery

**CMS → Drupal**
1. CMS content changes trigger webhook requests
2. Webhook controller validates signatures and processes data
3. Data transformers convert CMS format to Drupal entities
4. Content sync service creates/updates Drupal entities
5. Event system triggers additional processing as needed

### Supported Entity Types

#### Content Nodes
- **Basic Fields**: Title, body, status, language, author, timestamps
- **Custom Fields**: All field types supported via Field API
- **Relationships**: Entity references, taxonomy terms, users
- **Media**: Image fields, file attachments, media entities
- **SEO**: Meta tags (if Metatag module installed)
- **Revisions**: Content revision tracking and history

#### Users
- **Profile Data**: Username, email, display name, status
- **Authentication**: Password handling, login timestamps
- **Roles**: User role assignments and permissions
- **Custom Fields**: Profile fields and user metadata
- **Preferences**: Language, timezone, personal settings

#### Taxonomy Terms
- **Hierarchical**: Parent-child relationships and term depth
- **Vocabularies**: Multiple taxonomy vocabularies
- **Metadata**: Term descriptions, weights, custom fields
- **References**: Usage in content and other entities

### Real-Time Event Handling

The system responds to these Drupal entity events:

- **Entity Insert**: `hook_entity_insert()` via EventSubscriber
- **Entity Update**: `hook_entity_update()` via EventSubscriber  
- **Entity Delete**: `hook_entity_delete()` via EventSubscriber
- **Entity Presave**: `hook_entity_presave()` for change detection

## 🔐 Authentication & Security

### API Authentication
- **Bearer Tokens**: JWT or API key-based authentication
- **HTTPS Required**: Encrypted data transmission
- **Rate Limiting**: Configurable request throttling
- **Access Control**: Drupal permission-based API access

### Webhook Security  
- **HMAC Signatures**: SHA-256 signature verification
- **Timestamp Validation**: Prevent replay attacks
- **IP Allowlisting**: Optional source IP validation
- **Secret Management**: Environment-based configuration

### Data Security
- **Field Filtering**: Exclude sensitive fields from sync
- **Permission Checks**: Respect Drupal entity access controls
- **Data Sanitization**: Clean user input and prevent XSS
- **Audit Logging**: Track all sync operations and changes

## 📊 Monitoring & Analytics

### Health Monitoring
- **Connection Status**: `/headless-cms-bridge/status` endpoint
- **Entity Sync Health**: Real-time sync success/failure rates
- **Queue Status**: Background job processing metrics
- **Database Health**: Entity storage and relationship integrity

### Performance Metrics
- **API Response Times**: Track CMS communication latency  
- **Sync Statistics**: Success/failure counts by entity type
- **Queue Performance**: Processing rates and backlog size
- **Error Tracking**: Detailed error logs with stack traces

### Admin Interface
- **Sync Logs**: `/admin/config/services/headless-cms-bridge/logs`
- **Manual Sync**: Trigger entity synchronization manually
- **Connection Test**: Verify CMS API connectivity
- **Queue Management**: View and process sync queues

## 🧪 Testing

### Run Test Suite
```bash
# PHPUnit tests
./vendor/bin/phpunit modules/custom/headless_cms_bridge/tests

# Or with Drupal test runner
php core/scripts/run-tests.sh --verbose --color headless_cms_bridge
```

### Test Coverage
- ✅ **Unit Tests**: Service classes, data transformers, utilities
- ✅ **Kernel Tests**: Database operations, entity handling
- ✅ **Functional Tests**: Full workflow integration testing
- ✅ **API Tests**: Webhook endpoints and responses
- ✅ **Event Tests**: Symfony event subscriber functionality

### Manual Testing
```bash
# Test webhook endpoints
curl -X POST https://your-drupal-site.com/headless-cms-bridge/webhook/node/create \
  -H "Content-Type: application/json" \
  -H "X-Signature: sha256=your_signature" \
  -d '{"title": "Test Node", "body": "Test content"}'

# Test status endpoint
curl https://your-drupal-site.com/headless-cms-bridge/status?detailed=1
```

## 🔧 Advanced Configuration

### Service Container Integration
```yaml
# Custom service registration example
services:
  my_custom_sync_handler:
    class: Drupal\my_module\Service\CustomSyncHandler
    arguments: ['@headless_cms_bridge.content_sync', '@entity_type.manager']
    tags:
      - { name: event_subscriber }
```

### Event Subscriber Extensions
```php
// Custom event subscriber
class CustomContentSubscriber implements EventSubscriberInterface {
  
  public static function getSubscribedEvents(): array {
    return [
      'headless_cms_bridge.entity.synced' => 'onEntitySynced',
    ];
  }
  
  public function onEntitySynced(EntitySyncEvent $event): void {
    // Custom post-sync processing
  }
}
```

### Data Transformation Customization
```php
// Extend the data transformer
class CustomTransformer extends DataTransformerService {
  
  protected function transformNodeToCMS(NodeInterface $node): array {
    $data = parent::transformNodeToCMS($node);
    
    // Add custom business logic
    $data['custom_computed_field'] = $this->computeCustomValue($node);
    
    return $data;
  }
}
```

### Queue Processing
```bash
# Process sync queue via Drush
drush headless-cms-bridge:process-queue --time-limit=60

# Or via cron job
*/5 * * * * cd /path/to/drupal && drush headless-cms-bridge:process-queue >/dev/null 2>&1
```

## 🚨 Troubleshooting

### Common Issues

**Connection Failed**
- Verify CMS API URL is accessible from Drupal server
- Check API key has proper permissions
- Ensure HTTPS certificates are valid
- Test firewall and network connectivity

**Sync Not Working**
- Confirm sync is enabled in module configuration
- Check entity type and bundle configuration
- Verify webhook endpoints are accessible
- Review Drupal logs: `/admin/reports/dblog`

**Webhook Issues**
- Validate webhook secret configuration matches
- Check webhook signature verification
- Ensure webhook URLs return 200 OK responses  
- Test webhook endpoints manually

**Performance Issues**
- Enable queue-based processing for large datasets
- Increase PHP memory limit and execution time
- Consider database indexing for large entity tables
- Monitor API response times and add caching

### Debug Mode

```bash
# Enable Drupal debugging
drush config:set system.logging error_level verbose -y

# View detailed logs
drush watchdog:show --type=headless_cms_bridge

# Test specific operations  
drush headless-cms-bridge:test-connection
drush headless-cms-bridge:sync-entity node 123
```

### Error Recovery
- **Automatic Retry**: Failed operations retry with exponential backoff
- **Queue Recovery**: Failed queue items can be reprocessed
- **Manual Sync**: Admin interface allows manual entity synchronization
- **Rollback Support**: Entity revisions enable content rollback

## 📚 API Reference

### REST Endpoints

**Status & Health**
- `GET /headless-cms-bridge/status` - Service status
- `GET /headless-cms-bridge/status?detailed=1` - Detailed health check

**Webhook Endpoints**
- `POST /headless-cms-bridge/webhook/{entity_type}/{action}` - Process webhooks
- `POST /headless-cms-bridge/webhook/test` - Test webhook processing

**Administrative**
- `GET /admin/config/services/headless-cms-bridge` - Configuration form
- `GET /admin/config/services/headless-cms-bridge/test` - Connection test
- `GET /admin/config/services/headless-cms-bridge/logs` - Sync logs

### Service API

**Content Sync Service**
```php
// Get the service
$contentSync = \Drupal::service('headless_cms_bridge.content_sync');

// Sync entity to CMS
$result = $contentSync->syncEntityToCMS($entity, 'update');

// Process webhook data
$result = $contentSync->processWebhookData('node/create', $data);

// Bulk sync
$results = $contentSync->bulkSyncToCMS('node', $entity_ids, 50);
```

**API Client Service**
```php
// Get the service
$apiClient = \Drupal::service('headless_cms_bridge.api_client');

// Test connection
$status = $apiClient->testConnection();

// CRUD operations
$result = $apiClient->createContent('article', $data);
$result = $apiClient->updateContent('article', '123', $data);
$content = $apiClient->getContent('article', '123');
$result = $apiClient->deleteContent('article', '123');
```

### Data Transformer API
```php
// Get the service
$transformer = \Drupal::service('headless_cms_bridge.data_transformer');

// Transform Drupal entity to CMS format
$cmsData = $transformer->transformEntityToCMS($entity);

// Transform CMS data to Drupal format
$drupalData = $transformer->transformCMSToDrupal('node', $cmsData);
```

### Event System
```php
// Listen for sync events
$eventDispatcher = \Drupal::service('event_dispatcher');
$eventDispatcher->addListener('headless_cms_bridge.entity.synced', function($event) {
  // Handle sync completion
});

// Dispatch custom events
$event = new EntitySyncEvent($entity, $result);
$eventDispatcher->dispatch($event, 'headless_cms_bridge.entity.synced');
```

## 🧩 Extending the Module

### Custom Field Support
```php
// Add custom field transformer
class MyFieldTransformer {
  public function transform(FieldItemListInterface $field): array {
    // Custom transformation logic
    return $transformed_data;
  }
}
```

### Integration Hooks
```php
// Implement hook_headless_cms_bridge_entity_sync_alter()
function mymodule_headless_cms_bridge_entity_sync_alter(&$data, $entity, $operation) {
  if ($entity->getEntityTypeId() === 'node') {
    // Modify sync data before sending to CMS
    $data['custom_field'] = $entity->get('field_custom')->value;
  }
}
```

### Custom Sync Handlers
```php
// Custom entity sync handler
class CustomSyncHandler implements SyncHandlerInterface {
  public function supports(EntityInterface $entity): bool {
    return $entity->bundle() === 'custom_type';
  }
  
  public function sync(EntityInterface $entity, string $operation): array {
    // Custom sync logic
    return $result;
  }
}
```

## 🤝 Contributing

1. **Development Setup**
   ```bash
   # Install Drupal with Composer
   composer create-project drupal/recommended-project my-drupal
   cd my-drupal
   
   # Link module for development
   ln -sf /path/to/headless_cms_bridge web/modules/custom/headless_cms_bridge
   
   # Install dependencies
   composer install
   ```

2. **Coding Standards**
   - Follow Drupal coding standards
   - Use dependency injection for services
   - Add comprehensive PHPUnit tests
   - Document all public methods

3. **Pull Requests**
   - Include test coverage for new features
   - Update configuration schema as needed
   - Test with multiple Drupal versions
   - Update documentation

## 📄 License

This integration is licensed under the MIT License. See LICENSE file for details.

## 🆘 Support

- **Documentation**: Check this README and inline code comments
- **Issue Tracker**: Report bugs via GitHub issues
- **Drupal Community**: Post questions on Drupal.org forums
- **Professional Support**: Contact the development team

---

**Built for modern Drupal with service container architecture and event-driven patterns** 🚀