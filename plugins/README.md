# CMS Automation Plugins

This directory contains all platform-specific plugins and integrations for the CMS Automation system. Each plugin provides seamless integration between the CMS Automation API and various content management platforms.

## Available Plugins

### 🔗 WordPress Plugin
**Directory**: `plugins/wordpress/`

WordPress plugin for bidirectional content synchronization with the CMS Automation API.

**Features**:
- Real-time content synchronization
- AI-powered content generation integration
- Custom post type support
- Bulk content operations
- WordPress admin interface

**Installation**: See [WordPress Plugin Installation Guide](../WORDPRESS_PLUGIN_INSTALLATION_AND_USE.md)

### 🛒 Shopify Integration
**Directory**: `plugins/shopify/`

Shopify app for e-commerce content management and product synchronization.

**Features**:
- Product catalog synchronization
- Inventory management integration
- GraphQL API integration
- Webhook handling for real-time updates
- Customer and order data transformation

### 🔧 Optimizely Integration
**Directory**: `plugins/optimizely/`

Optimizely CMS integration for content optimization and experimentation.

**Features**:
- Content experimentation setup
- A/B testing integration
- Performance analytics
- Visitor group targeting
- Content personalization

### 🎨 Wix Plugin
**Directory**: `plugins/wix/`

Wix Dev Mode plugin for AI-enhanced content creation and management.

**Features**:
- AI writing assistance
- Content enhancement tools
- Wix Editor integration
- Real-time content suggestions
- Brand voice consistency

### 📄 Drupal Integration
**Directory**: `plugins/drupal/`

Drupal module for headless CMS bridge functionality.

**Features**:
- Entity synchronization
- Custom content type mapping
- RESTful API integration
- Event-driven synchronization
- Multi-site support

## Plugin Architecture

Each plugin follows a consistent architecture pattern:

```
plugins/{platform}/
├── README.md                 # Platform-specific documentation
├── package.json             # Dependencies (if applicable)
├── src/                     # Source code
│   ├── adapters/           # Platform API adapters
│   ├── services/           # Core business logic
│   ├── transformers/       # Data transformation utilities
│   └── handlers/           # Event and webhook handlers
├── tests/                   # Unit and integration tests
├── config/                 # Configuration files
└── examples/               # Usage examples
```

## Development Guidelines

### Adding a New Plugin

1. **Create Plugin Directory**
   ```bash
   mkdir plugins/{platform-name}
   cd plugins/{platform-name}
   ```

2. **Initialize Plugin Structure**
   ```bash
   mkdir -p src/{adapters,services,transformers,handlers}
   mkdir -p tests/{unit,integration}
   mkdir -p config examples
   ```

3. **Create README.md**
   - Plugin description and features
   - Installation instructions
   - Configuration guide
   - API documentation
   - Examples and use cases

4. **Implement Core Components**
   - API adapter for platform communication
   - Data transformation services
   - Event handlers for real-time sync
   - Configuration management

### Plugin Standards

- **API Integration**: All plugins must integrate with the CMS Automation API endpoints
- **Error Handling**: Comprehensive error handling and logging
- **Testing**: Unit and integration tests required
- **Documentation**: Complete README and code documentation
- **Security**: Secure credential management and API communication

### Common Services

All plugins can utilize shared services from the main application:

- **Authentication**: JWT-based authentication (when available)
- **Content API**: RESTful content management endpoints
- **AI Services**: OpenAI integration for content generation
- **Storage**: File and media storage services
- **Logging**: Centralized logging and monitoring

## Configuration

Each plugin supports environment-based configuration:

```bash
# Plugin-specific environment variables
{PLATFORM}_API_URL=https://api.platform.com
{PLATFORM}_API_KEY=your-api-key
{PLATFORM}_WEBHOOK_SECRET=webhook-secret

# CMS Automation API configuration
CMS_API_URL=https://your-cms-api.com
CMS_API_KEY=cms-api-key
```

## Testing

Run tests for all plugins:

```bash
# Run all plugin tests
npm run test:plugins

# Run specific platform tests
npm run test:wordpress
npm run test:shopify
npm run test:optimizely
```

## Deployment

### Development Environment

```bash
# Start all plugin services
npm run dev:plugins

# Start specific plugin
npm run dev:wordpress
```

### Production Deployment

Each plugin can be deployed independently:

- **WordPress**: Upload to WordPress plugins directory
- **Shopify**: Deploy as Shopify app
- **Optimizely**: Install as Optimizely add-on
- **Wix**: Deploy to Wix App Market
- **Drupal**: Install as Drupal module

## Support and Contribution

### Reporting Issues

- Create issues in the main repository
- Tag with appropriate plugin label
- Include platform version and environment details

### Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/plugin-enhancement`
3. Follow coding standards and add tests
4. Submit pull request with detailed description

### Plugin Maintenance

- Regular updates for platform API changes
- Security patches and dependency updates
- Performance optimizations
- Feature enhancements based on user feedback

## License

All plugins are distributed under the same license as the main CMS Automation project.

---

For detailed plugin-specific documentation, refer to the README.md file in each plugin directory.