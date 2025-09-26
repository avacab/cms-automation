# Facebook API Integration Guide

This guide covers the complete Facebook API integration for the CMS automation system, enabling automatic social media posting when content is published through WordPress.

## Overview

The Facebook API integration provides:
- OAuth 2.0 authentication flow
- Facebook Page management and posting
- Scheduled posting with optimal timing
- Real-time webhook processing
- Multi-platform social media scheduling

## Architecture

```
WordPress Post "Published"
      ↓
WordPress Plugin Webhook Handler
      ↓
CMS API Social Scheduler Service
      ↓
Facebook Service (Graph API)
      ↓
Facebook Page Posts at Optimal Times
```

## Components

### Backend Services

1. **FacebookService.ts** (`/backend/api/src/services/FacebookService.ts`)
   - Facebook Graph API integration
   - OAuth 2.0 authentication flow
   - Page publishing and media uploads
   - Post insights and analytics
   - Webhook signature verification

2. **SocialSchedulerService.ts** (`/backend/api/src/services/SocialSchedulerService.ts`)
   - Multi-platform scheduling coordinator
   - Optimal timing calculation (Facebook: 3PM UTC)
   - Job queue management with node-cron
   - Retry logic for failed posts
   - Analytics and reporting

3. **Social API Routes** (`/backend/api/src/routes/social.ts`)
   - RESTful endpoints for social media operations
   - Authentication and authorization
   - Webhook endpoints for Facebook
   - Status and analytics endpoints

### Database Schema

4. **Social Media Tables** (`/scripts/social-media-schema.sql`)
   - `social_accounts`: Connected platform accounts
   - `social_posts`: Scheduled and published posts
   - `scheduling_rules`: Platform-specific optimal timing
   - Includes indexes, triggers, and RLS policies

### WordPress Integration

5. **Enhanced Webhook Handler** (`/plugins/wordpress/wp-headless-cms-bridge/includes/class-webhook-handler.php`)
   - Automatic social media triggering on publish
   - Content transformation for social media
   - Error handling and logging
   - Configurable platform selection

### Frontend Components

6. **SocialMediaDashboard.tsx** (`/frontend/src/components/SocialMediaDashboard.tsx`)
   - Real-time analytics dashboard
   - Scheduled post management
   - Platform-specific metrics
   - Post publishing controls

7. **SocialAccountConnect.tsx** (`/frontend/src/components/SocialAccountConnect.tsx`)
   - OAuth 2.0 flow management
   - Facebook page selection
   - Connection status monitoring
   - Multi-step authentication wizard

## Setup Instructions

### 1. Environment Variables

Add the following to your `.env` file:

```bash
# Facebook App Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Database Configuration (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

### 2. Database Setup

Run the social media schema in Supabase:

```bash
# Execute the SQL schema
psql -h your_supabase_host -U postgres -d postgres -f scripts/social-media-schema.sql

# Or copy the SQL content to Supabase SQL editor
```

### 3. Facebook App Configuration

1. Create a Facebook App at [Facebook Developers](https://developers.facebook.com/)
2. Add the following products:
   - Facebook Login
   - Webhooks
3. Configure OAuth redirect URIs:
   - `http://localhost:3000` (development)
   - `https://your-domain.com` (production)
4. Set webhook URL: `https://your-api-domain.com/api/v1/social/webhook/facebook`
5. Subscribe to `feed` events for real-time updates

### 4. WordPress Plugin Configuration

Enable social media features in WordPress admin:

1. Go to **WP Admin > CMS Bridge > Social Media**
2. Enable **"Automatically schedule social media posts"**
3. Select **Facebook** from the platforms list
4. Enable **"Use optimal posting times"**
5. Save settings

### 5. Connect Facebook Account

1. Access the frontend dashboard
2. Navigate to **Social Media > Connect Account**
3. Select **Facebook** and complete OAuth flow
4. Choose the Facebook Page to connect
5. Verify connection status

## API Endpoints

### Social Media Management

```
GET    /api/v1/social/status                    # Service status
POST   /api/v1/social/schedule                  # Schedule multi-platform posts
GET    /api/v1/social/posts/:contentId          # Get scheduled posts
POST   /api/v1/social/posts/:postId/publish     # Publish immediately
DELETE /api/v1/social/posts/:postId             # Cancel scheduled post
GET    /api/v1/social/analytics                 # Analytics data
```

### Facebook-Specific

```
GET    /api/v1/social/facebook/auth-url         # Generate OAuth URL
POST   /api/v1/social/facebook/connect          # Connect account
POST   /api/v1/social/facebook/publish          # Publish immediately
POST   /api/v1/social/facebook/schedule         # Schedule post
GET    /api/v1/social/facebook/pages            # Get user pages
GET    /api/v1/social/facebook/insights/:postId # Post insights
POST   /api/v1/social/webhook/facebook          # Webhook endpoint
GET    /api/v1/social/webhook/facebook          # Webhook verification
```

## Workflow

### Automatic Posting Workflow

1. **Content Published in WordPress**
   - WordPress fires `post_publish` action
   - Plugin sends webhook to CMS API

2. **CMS API Processing**
   - Webhook handler receives publication event
   - Checks if social media scheduling is enabled
   - Transforms content for social media format

3. **Social Media Scheduling**
   - SocialSchedulerService creates scheduled posts
   - Calculates optimal posting times per platform
   - Stores posts in database with status 'scheduled'

4. **Automated Publishing**
   - Cron job processes scheduled posts
   - FacebookService publishes to Facebook Graph API
   - Status updated to 'published' or 'failed'
   - Retry logic handles failures

### Manual Publishing Workflow

1. **Dashboard Control**
   - User views scheduled posts in dashboard
   - Can publish immediately or cancel posts
   - Real-time status updates

2. **Account Management**
   - OAuth flow for account connection
   - Page selection and permission management
   - Connection status monitoring

## Configuration Options

### Optimal Posting Times

Default optimal times (UTC):
- **Facebook**: 3:00 PM (15:00)
- **Twitter**: 8:00 AM (08:00) *[Coming soon]*
- **LinkedIn**: 12:00 PM (12:00) *[Coming soon]*
- **Instagram**: 7:00 PM (19:00) *[Coming soon]*

### Content Transformation

Content is automatically transformed for social media:
- **Message**: Post excerpt or first paragraph (max 200 chars)
- **URL**: WordPress post permalink
- **Image**: Featured image URL
- **Title**: Post title for platforms that support it

### Error Handling

- **Rate Limiting**: Automatic backoff and retry
- **API Errors**: Detailed error logging and user feedback
- **Network Issues**: Retry with exponential backoff
- **Authentication**: Token refresh handling

## Testing

### Manual Testing

1. **Connection Test**:
   ```bash
   curl -X GET http://localhost:5000/api/v1/social/status
   ```

2. **Schedule Test**:
   ```bash
   curl -X POST http://localhost:5000/api/v1/social/schedule \
     -H "Content-Type: application/json" \
     -d '{
       "contentId": "test-123",
       "platforms": ["facebook"],
       "content": {
         "message": "Test post from CMS automation",
         "url": "https://example.com/test-post"
       },
       "useOptimalTiming": true
     }'
   ```

### WordPress Integration Test

1. Create a new WordPress post
2. Publish the post
3. Check CMS API logs for webhook processing
4. Verify scheduled post appears in dashboard
5. Monitor automatic publishing at scheduled time

## Troubleshooting

### Common Issues

1. **Facebook Authentication Fails**
   - Check Facebook App ID and Secret
   - Verify redirect URI in Facebook App settings
   - Ensure webhook verification token matches

2. **Posts Not Scheduling**
   - Check WordPress plugin social settings
   - Verify CMS API URL is correct
   - Review webhook handler logs

3. **Posts Not Publishing**
   - Check Facebook page permissions
   - Verify access token hasn't expired
   - Review cron job execution logs

### Debug Mode

Enable debug logging:
```bash
# WordPress
define('WP_DEBUG_LOG', true);

# Node.js API
NODE_ENV=development npm run dev
```

### Log Locations

- **WordPress**: `/wp-content/debug.log`
- **CMS API**: Console output and database logs
- **Facebook API**: Response headers and error objects

## Security Considerations

1. **Token Storage**: Access tokens encrypted in database
2. **Webhook Security**: HMAC signature verification
3. **Rate Limiting**: API request throttling
4. **Permission Scopes**: Minimal required Facebook permissions
5. **Environment Variables**: Sensitive data not in code

## Future Enhancements

- **Twitter API Integration**: Using Twitter API v2
- **LinkedIn API Integration**: Company and personal pages
- **Instagram API Integration**: Instagram Graph API
- **Advanced Analytics**: Engagement tracking and insights
- **Content Templates**: Platform-specific content formatting
- **Bulk Operations**: Multi-post scheduling and management

## Support

For issues and feature requests:
1. Check the troubleshooting section above
2. Review API endpoint documentation
3. Enable debug logging for detailed error information
4. Test individual components in isolation