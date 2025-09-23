# WordPress Plugin Installation and Usage Guide

This comprehensive guide walks you through installing, configuring, and using the CMS Automation Bridge WordPress plugin to synchronize content between your WordPress site and the CMS Automation API.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [API Connection Setup](#api-connection-setup)
5. [Content Synchronization](#content-synchronization)
6. [Use Case: Creating and Syncing Content](#use-case-creating-and-syncing-content)
7. [AI Content Features](#ai-content-features)
8. [Troubleshooting](#troubleshooting)
9. [Best Practices](#best-practices)

## Prerequisites

Before installing the CMS Automation Bridge plugin, ensure you have:

### WordPress Requirements
- **WordPress Version**: 5.0 or higher
- **PHP Version**: 7.4 or higher
- **WordPress Admin Access**: Administrator role required
- **SSL Certificate**: HTTPS recommended for secure API communication

### CMS Automation API Requirements
- **Running API Server**: The CMS Automation API must be accessible
- **API URL**: Know your API server URL (e.g., `https://your-api-domain.com` or `http://localhost:8000` for development)
- **Network Access**: WordPress server must be able to reach the API
- **Database Setup**: CMS API server must have proper database schema configured

### Technical Requirements
- **Internet Connection**: Required for real-time synchronization
- **cURL Support**: PHP cURL extension enabled
- **JSON Support**: PHP JSON extension enabled

## Installation

### Method 1: Manual Installation (Recommended)

1. **Download the Plugin**
   ```bash
   # If you have access to the source code
   cd /path/to/cms_automation/plugins/wordpress
   zip -r cms-automation-bridge.zip cms-automation-bridge/
   ```

2. **Upload to WordPress**
   - Log in to your WordPress admin dashboard
   - Navigate to **Plugins → Add New**
   - Click **Upload Plugin**
   - Choose the `cms-automation-bridge.zip` file
   - Click **Install Now**

3. **Activate the Plugin**
   - After installation, click **Activate Plugin**
   - Or go to **Plugins → Installed Plugins** and activate "CMS Automation Bridge"

### Method 2: Direct Upload via FTP

1. **Extract Plugin Files**
   ```bash
   unzip cms-automation-bridge.zip
   ```

2. **Upload via FTP**
   - Connect to your WordPress site via FTP
   - Navigate to `/wp-content/plugins/`
   - Upload the entire `cms-automation-bridge` folder

3. **Activate in WordPress**
   - Go to **Plugins → Installed Plugins**
   - Find "CMS Automation Bridge" and click **Activate**

### Method 3: WordPress Plugin Directory (Future)

*Note: This plugin is not yet available in the WordPress plugin directory*

## Configuration

### Access Plugin Settings

1. **Navigate to Settings**
   - In WordPress admin, go to **Settings → CMS Automation**
   - You'll see the plugin configuration page

2. **Plugin Settings Overview**
   The settings page contains several sections:
   - **API Connection Settings**
   - **Content Sync Settings**
   - **AI Features Configuration** (if available)

### API Connection Settings

1. **Set API URL**
   ```
   # For development
   API URL: http://localhost:8000
   
   # For production
   API URL: https://your-api-domain.com
   ```

2. **Test Connection**
   - Click **Test Connection** button
   - Verify you see "Connection successful" message
   - If connection fails, check:
     - API URL is correct
     - Server has internet access
     - No firewall blocking the connection
     - API server is running

## API Connection Setup

### Step 1: Configure API Connection

1. **Set API URL**
   - In WordPress plugin settings, find **API Connection** section
   - Enter your CMS API URL:
     - Development: `http://localhost:8000`
     - Production: `https://your-api-domain.com`
   - Click **Test Connection** to verify accessibility

2. **Verify Connection**
   - You should see "Connection successful" message
   - Plugin will test basic endpoints:
     - `/health` - Server health check
     - `/api/v1/content-types` - Available content types
   - If connection fails, check:
     - API URL is correct and accessible
     - Server has internet access (if using remote API)
     - No firewall blocking the connection
     - API server is running

### Step 2: Content Sync Configuration

1. **Enable Content Sync**
   - Check **Enable Content Synchronization**
   - The current system uses direct API communication
   - No user authentication required for basic sync

2. **Configure Sync Settings**
   - Choose content types to sync (Posts, Pages, Custom Post Types)
   - Set sync direction (currently WordPress → CMS only)
   - Configure auto-sync triggers

### Step 3: Test Basic Functionality

1. **Test API Endpoints**
   - Plugin will test basic API endpoints:
     - `/health` - Server health check
     - `/api/v1/content` - Content listing
     - `/api/v1/content-types` - Available content types

2. **Verify Content Types**
   - Check that CMS content types are available:
     - Blog Post
     - Page
     - Custom types (if configured)

3. **Configure Sync Options**
   - **Auto-Sync Settings**:
     - ✅ **Enable auto-sync on publish**
     - ✅ **Enable auto-sync on update**
     - ⚠️ **Enable auto-sync on delete** (use with caution)

## Content Synchronization

### Understanding Sync Status

Each post/page will show sync status in the editor:

- **🟢 Synced**: Content is synchronized and up-to-date
- **🟡 Pending**: Sync is queued or in progress
- **🔴 Failed**: Sync encountered an error
- **⚪ Disabled**: Sync is disabled for this content

### Manual Sync Process

1. **Individual Content Sync**
   - Edit any post or page
   - In the **CMS Automation** meta box (right sidebar)
   - Click **Sync to CMS** button
   - Monitor sync status

2. **Bulk Sync Process**
   - Go to **Tools → CMS Automation Bulk Sync**
   - Select content type (Posts, Pages, etc.)
   - Choose date range (optional)
   - Click **Start Bulk Sync**
   - Monitor progress in real-time

### How Sync Works

1. **WordPress → CMS API**
   - Plugin captures WordPress post data
   - Converts to JSON format expected by API
   - Makes POST request to `/api/v1/content`
   - Stores CMS ID in WordPress metadata

2. **Content Mapping**
   ```json
   {
     "title": "Post Title",
     "content": "Post content in HTML or text",
     "status": "published|draft|archived",
     "content_type_id": "blog-post|page",
     "published_at": "2024-01-15T10:30:00Z",
     "created_at": "2024-01-15T10:25:00Z"
   }
   ```

## Use Case: Creating and Syncing Content

Let's walk through a complete example of creating content in WordPress and syncing it to the CMS API.

### Scenario
You're a content manager for "TechBlog Pro" and want to create a blog post about "The Future of AI in Web Development" that will be synchronized with your headless CMS API for use across multiple platforms.

### Step 1: Create New Blog Post

1. **Start New Post**
   - Go to **Posts → Add New**
   - You'll see the standard WordPress editor plus the CMS Automation meta box

2. **Add Post Content**
   ```
   Title: The Future of AI in Web Development
   
   Content:
   Artificial Intelligence is revolutionizing web development in unprecedented ways. 
   From automated code generation to intelligent user experiences, AI is becoming 
   an integral part of modern web development workflows.
   
   ## Key Areas of Impact
   
   1. **Automated Code Generation**
      - AI-powered coding assistants
      - Template generation
      - Bug detection and fixing
   
   2. **User Experience Enhancement**
      - Personalized content delivery
      - Intelligent chatbots
      - Predictive user interfaces
   
   ## Conclusion
   
   The integration of AI in web development is not just a trend—it's the future. 
   Developers who embrace these technologies will build more efficient, 
   intelligent, and user-friendly applications.
   ```

3. **Add Post Metadata**
   - **Categories**: Technology, AI, Web Development
   - **Tags**: artificial-intelligence, web-dev, future-tech
   - **Featured Image**: Upload relevant AI/tech image
   - **Excerpt**: "Explore how AI is transforming web development..."

### Step 2: Configure Sync Settings

1. **CMS Automation Meta Box**
   - In the right sidebar, find **CMS Automation** meta box
   - ✅ Check **Enable sync for this post**
   - Select **Content Type**: Blog Post
   - Choose **Priority**: Normal

2. **Sync Options**
   - **Sync on Publish**: ✅ Enabled
   - **Include Featured Image**: ✅ Enabled (URL will be sent)
   - **Include Metadata**: ✅ Enabled (categories, tags, custom fields)

### Step 3: Publish and Sync

1. **Publish Post**
   - Click **Publish** button
   - WordPress saves the post
   - Auto-sync triggers immediately

2. **Monitor Sync Progress**
   - Watch the **CMS Automation** meta box
   - Status changes from "Pending" to "Syncing" to "Synced"
   - Sync time typically takes 2-5 seconds

3. **Verify Sync Success**
   - ✅ **Sync Status**: Synced
   - ✅ **CMS ID**: Shows unique CMS API ID (e.g., `content-1234567890-abc123`)
   - ✅ **Last Sync**: Shows timestamp
   - ✅ **Sync Log**: No errors reported

### Step 4: Verify in CMS API

1. **Check CMS API Data**
   - Access the API directly or through a frontend client
   - Make a GET request to `/api/v1/content`
   - Find "The Future of AI in Web Development" in the response

2. **Verify Content Integrity**
   - ✅ **Title**: Matches WordPress
   - ✅ **Content**: Full content preserved (may be stored as JSON)
   - ✅ **Status**: Published status synchronized
   - ✅ **Content Type**: Mapped to 'blog-post'
   - ✅ **Timestamps**: Creation and publication dates
   - ✅ **Metadata**: Categories and tags (if supported by current schema)

3. **API Response Example**
   ```json
   {
     "id": "content-1234567890-abc123",
     "title": "The Future of AI in Web Development",
     "content": "Artificial Intelligence is revolutionizing...",
     "status": "published",
     "content_type_id": "blog-post",
     "published_at": "2024-01-15T10:30:00Z",
     "created_at": "2024-01-15T10:25:00Z",
     "updated_at": "2024-01-15T10:30:00Z"
   }
   ```

### Step 5: Content Updates and Sync

1. **Update Content in WordPress**
   - Edit the post in WordPress
   - Add new section: "Implementation Strategies"
   - Update excerpt
   - Save changes

2. **Automatic Sync**
   - Changes automatically sync to CMS API
   - Makes PUT request to `/api/v1/content/{id}`
   - Updated timestamp reflects in both systems

3. **Update Content via API**
   - Use API client or frontend to edit content
   - Make PUT request to `/api/v1/content/{id}`
   - Update title, content, or status

4. **Sync Back to WordPress** (Future Feature)
   - Currently, sync is primarily WordPress → CMS
   - Bidirectional sync planned for future releases
   - Manual sync from CMS → WordPress available through plugin interface

### Step 6: Multi-Platform Distribution

1. **Use CMS API Features**
   - Content is available via REST API for any client
   - Build frontend applications that consume the API
   - Create mobile apps, websites, or other integrations

2. **Maintain Single Source of Truth**
   - WordPress remains primary content creation interface
   - CMS API provides standardized access to content
   - All consuming applications get consistent data

## AI Content Features

The AI features depend on the CMS API server configuration and require an OpenAI API key to be set on the server.

### AI Content Generation

1. **Access AI Tools**
   - In WordPress post editor
   - Find **AI Content Generator** panel (if plugin includes AI features)
   - Enter content prompt or topic

2. **Generate Content**
   ```
   Prompt: "Write an introduction about sustainable web development practices"
   
   Settings:
   - Length: 300 words
   - Tone: Professional
   - Target Audience: Web developers
   ```

3. **AI Service Requirements**
   - Requires OpenAI API key configuration on the CMS server
   - Server must have environment variable `OPENAI_API_KEY` set
   - Check with your system administrator if AI features are available

4. **Review and Insert**
   - AI generates content suggestion via `/api/v1/ai/generate`
   - Review for accuracy and relevance
   - Click **Insert** to add to post
   - Edit as needed

### Writing Assistance

1. **Content Analysis**
   - Select text in editor
   - Click **Get Writing Suggestions**
   - Plugin sends content to `/api/v1/ai/suggestions`
   - Receive suggestions for:
     - Grammar improvements
     - Readability enhancements
     - SEO optimization
     - Tone adjustments

2. **Apply Suggestions**
   - Review each suggestion
   - Accept or reject individually
   - Apply changes directly to content

### Content Adaptation

1. **Format Adaptation**
   - Select existing content
   - Choose target format:
     - Social media post
     - Email newsletter
     - Product description
     - Landing page copy

2. **Custom Constraints**
   - Set character limits
   - Specify tone requirements
   - Define target audience
   - Add brand guidelines

## Troubleshooting

### Common Issues and Solutions

#### 1. API Connection Failures

**Problem**: "Connection failed" or "API not reachable" error

**Solutions**:
- Verify API URL is correct and accessible
- Check if API server is running (for local development)
- Ensure no firewall blocking the connection
- Test API directly with curl: `curl http://your-api-url/health`
- Check server logs for connection attempts

**Debug Steps**:
```php
// Enable debug logging in wp-config.php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);

// Check WordPress error log
tail -f /wp-content/debug.log
```

**Test API Connection Manually**:
```bash
# Test health endpoint
curl http://localhost:8000/health

# Test content endpoint
curl http://localhost:8000/api/v1/content

# Test from WordPress server
wp shell
wp_remote_get('http://localhost:8000/health');
```

#### 2. Sync Failures

**Problem**: Content not syncing to CMS API

**Solutions**:
- Check internet connectivity
- Verify API URL is correct
- Ensure content type is enabled for sync
- Check sync logs for specific errors
- Verify API server is accepting requests

**Debug Steps**:
- Go to **Tools → CMS Automation Logs**
- Find failed sync attempts
- Check error messages
- Retry manual sync

**Common Error Messages**:
- `400 Bad Request`: Content data validation failed
- `404 Not Found`: API endpoint not available
- `500 Internal Server Error`: Server-side issue
- `Connection timeout`: Network or server response issue

#### 3. Content Conflicts

**Problem**: Different versions in WordPress vs CMS

**Solutions**:
- Use **Conflict Resolution** tools
- Choose source of truth
- Manually merge changes if needed
- Set up sync direction preferences

#### 4. Missing Featured Images

**Problem**: Images not syncing properly

**Solutions**:
- Verify image URLs are accessible publicly
- Check file size limits
- Ensure proper permissions
- Use absolute URLs for images
- Note: Current system sends image URLs, not files

### Performance Issues

#### Slow Sync Times

**Causes**:
- Large content with many media items
- Network latency
- Server resource constraints
- API server performance

**Solutions**:
- Optimize content before sync
- Monitor server performance
- Implement sync queuing
- Check API server logs

### Plugin Conflicts

#### Common Conflicts

1. **Security Plugins**
   - Some security plugins block API requests
   - Whitelist CMS API URLs
   - Configure firewall rules

2. **Cache Plugins**
   - Cache can interfere with sync status
   - Exclude plugin pages from caching
   - Clear cache after configuration changes

3. **SEO Plugins**
   - May conflict with metadata sync
   - Configure which plugin handles SEO
   - Avoid duplicate meta fields

## Best Practices

### Content Management

1. **Single Source Editing**
   - Use WordPress as primary editing platform
   - Avoid editing same content simultaneously
   - Use CMS API for read-only access from other applications

2. **Content Planning**
   - Plan content structure before creation
   - Use consistent categorization
   - Maintain proper taxonomy

3. **Media Management**
   - Optimize images before upload
   - Use descriptive file names
   - Ensure images are publicly accessible
   - Consider CDN for media files

### Security

1. **API Connection Security**
   - Use HTTPS for production API connections
   - Secure your API server with proper authentication
   - Implement rate limiting on the API server
   - Monitor API access logs

2. **WordPress Security**
   - Limit plugin access to necessary users
   - Keep WordPress and plugins updated
   - Use strong passwords for WordPress admin
   - Regular security audits of WordPress installation

### Performance Optimization

1. **Sync Optimization**
   - Enable selective sync for relevant content
   - Use bulk operations for large datasets
   - Schedule sync during low-traffic periods
   - Monitor sync performance metrics

2. **WordPress Optimization**
   - Keep WordPress and plugins updated
   - Use caching appropriately
   - Optimize database regularly
   - Monitor server resources

### Maintenance

1. **Regular Updates**
   - Keep plugin updated to latest version
   - Monitor for WordPress compatibility
   - Test updates in staging environment
   - Backup before major updates

2. **Monitoring**
   - Set up sync status monitoring
   - Monitor error logs regularly
   - Track content synchronization metrics
   - Implement alerting for failures

3. **Backup Strategy**
   - Regular WordPress backups
   - Export content from CMS API
   - Test restore procedures
   - Document recovery processes

## Advanced Configuration

### Custom Post Types

1. **Enable Custom Post Type Sync**
   - Go to plugin settings
   - Add custom post type names
   - Configure field mappings
   - Test sync functionality

2. **Field Mapping**
   ```php
   // Example: Custom field mapping
   add_filter('cms_automation_content_data', function($data, $post) {
       if ($post->post_type === 'product') {
           $data['product_price'] = get_post_meta($post->ID, '_price', true);
           $data['product_sku'] = get_post_meta($post->ID, '_sku', true);
       }
       return $data;
   }, 10, 2);
   ```

### API Integration Testing

1. **Test API Endpoints**
   ```bash
   # Health check
   curl http://localhost:8000/health
   
   # List content
   curl http://localhost:8000/api/v1/content
   
   # Create content
   curl -X POST http://localhost:8000/api/v1/content \
     -H "Content-Type: application/json" \
     -d '{"content": {"title": "Test", "content": "Test content"}}'
   ```

2. **Monitor API Performance**
   - Check response times
   - Monitor error rates
   - Verify data integrity

### Multi-Site Network

1. **Network Activation**
   - Enable plugin for entire network
   - Configure site-specific settings
   - Manage API connections per site
   - Monitor network-wide sync

## Support and Resources

### Getting Help

1. **Documentation**
   - Plugin documentation: `plugins/wordpress/README.md`
   - API documentation: Check your API server's documentation
   - WordPress Codex: https://codex.wordpress.org/

2. **Support Channels**
   - Plugin support forum
   - GitHub repository (if available)
   - System administrator for API server issues

3. **Community Resources**
   - User forums
   - GitHub repository
   - Video tutorials
   - Best practices guides

### Development Resources

1. **Plugin Development**
   - Hook reference
   - Filter documentation
   - API endpoints
   - Custom integration examples

2. **CMS API**
   - REST API endpoints:
     - `GET /health` - Server health
     - `GET /api/v1/content` - List content
     - `POST /api/v1/content` - Create content
     - `PUT /api/v1/content/{id}` - Update content
     - `DELETE /api/v1/content/{id}` - Delete content
   - Content types endpoint: `/api/v1/content-types`
   - AI features (if OpenAI configured): `/api/v1/ai/*`

## Conclusion

The CMS Automation Bridge plugin provides powerful content synchronization capabilities for WordPress sites with a headless CMS API. By following this guide, you can:

- ✅ Successfully install and configure the plugin
- ✅ Set up secure API connection with the CMS server
- ✅ Synchronize content from WordPress to CMS API
- ✅ Leverage AI features for content enhancement (if configured)
- ✅ Troubleshoot common connection and sync issues
- ✅ Implement best practices for optimal performance

**Current System Features:**
- Direct API communication (no user accounts required)
- WordPress → CMS content synchronization
- AI content generation (requires OpenAI API key on server)
- Content type mapping and status synchronization
- Basic error handling and logging

**Planned Features:**
- User authentication and role-based access
- Bidirectional synchronization (CMS → WordPress)
- Advanced content conflict resolution
- Enhanced metadata synchronization

For additional support or advanced configuration needs, refer to the plugin documentation or contact your system administrator.

---

**Plugin Version**: 1.0.0  
**WordPress Compatibility**: 5.0+  
**PHP Compatibility**: 7.4+  
**API Compatibility**: CMS Automation API v1  
**Last Updated**: 2024