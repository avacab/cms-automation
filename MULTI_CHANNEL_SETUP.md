# Multi-Channel Publishing Setup Guide

This guide explains how to configure the complete end-to-end post distribution system that publishes content from the frontend to both the Haidrun website (WordPress) and LinkedIn company page.

## Environment Variables Required

### Supabase Configuration
```bash
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

### LinkedIn API Configuration
```bash
LINKEDIN_CLIENT_ID=your_linkedin_app_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret
```

### WordPress Webhook Configuration

#### Haidrun WordPress Site
```bash
HAIDRUN_WORDPRESS_WEBHOOK_URL=https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/content
HAIDRUN_WORDPRESS_WEBHOOK_SECRET=your_secure_webhook_secret
```

#### Personal WordPress Site (Optional)
```bash
PERSONAL_WORDPRESS_WEBHOOK_URL=https://your-personal-site.com/wp-json/wp-headless-cms-bridge/v1/webhook/content
PERSONAL_WORDPRESS_WEBHOOK_SECRET=your_personal_webhook_secret
```

## Complete Workflow

### 1. Frontend Content Creation
- User fills out content form with title, content, and multi-channel options
- Selects "Haidrun" as company branding
- Checks both "Publish to WordPress" and "Publish to LinkedIn"
- Submits form

### 2. Backend Processing
- Creates content item in Supabase database
- Sends webhook to Haidrun WordPress site
- Creates LinkedIn post in scheduling system
- Returns success/failure status for each channel

### 3. WordPress Publishing
- WordPress plugin receives webhook with proper authentication
- Creates new post on Haidrun website
- Returns post ID and URL
- Post appears immediately on website

### 4. LinkedIn Publishing
- Content is formatted for LinkedIn with Haidrun branding
- Post is scheduled for optimal time (12:00 PM UTC, business days)
- Social Media Orchestrator processes scheduled posts
- Posts to Haidrun LinkedIn company page
- Includes Haidrun-specific hashtags and professional formatting

## WordPress Plugin Setup

### 1. Install Plugin
Upload and activate the `wp-headless-cms-bridge` plugin (v1.0.6) on the Haidrun WordPress site.

### 2. Configure Plugin Settings
```php
// In WordPress Admin → Settings → Headless CMS Bridge
CMS API URL: https://cms-automation-api.vercel.app
Sync Enabled: ✓ Yes
Sync Direction: Bidirectional
Post Types: Posts, Pages
Post Statuses: Published
Webhook Secret: [your_secure_webhook_secret]
```

### 3. Verify Webhook Endpoints
The plugin creates these endpoints:
- Content: `/wp-json/wp-headless-cms-bridge/v1/webhook/content`
- Media: `/wp-json/wp-headless-cms-bridge/v1/webhook/media`
- Health: `/wp-json/wp-headless-cms-bridge/v1/webhook/health`

## LinkedIn Company Page Setup

### 1. LinkedIn App Configuration
- Create LinkedIn app with necessary permissions
- Add company page admin permissions
- Configure OAuth redirect URLs

### 2. Add Haidrun Company Account
Insert into Supabase `social_accounts` table:
```sql
INSERT INTO social_accounts (
  platform, 
  account_name, 
  account_id, 
  access_token, 
  is_active, 
  account_data
) VALUES (
  'linkedin',
  'Haidrun',
  'haidrun_company_id',
  'your_company_access_token',
  true,
  '{"type": "organization", "organization_id": "urn:li:organization:haidrun_company_id"}'
);
```

## Testing the Complete Flow

### 1. Manual Testing
1. Open frontend application
2. Create new content with Haidrun branding
3. Select both WordPress and LinkedIn publishing
4. Submit and verify results

### 2. Automated Testing
```bash
# Run the test script
node test-multi-channel-publishing.js

# Check API status
curl http://localhost:5000/api/v1/content-publishing/status

# Check pending posts
curl http://localhost:5000/api/v1/content-publishing/pending

# Check orchestrator stats
curl http://localhost:5000/api/v1/content-publishing/orchestrator/stats
```

## Monitoring and Logs

### Backend Logs
- Check console output for multi-channel publishing requests
- Monitor webhook authentication and responses
- Track LinkedIn scheduling and posting

### WordPress Logs
- Check WordPress error logs for webhook processing
- Monitor plugin sync logs in WordPress admin
- Verify post creation and metadata

### LinkedIn Monitoring
- Check social media orchestrator scheduler
- Monitor LinkedIn API rate limits
- Track post engagement metrics

## Troubleshooting

### Common Issues

#### WordPress Webhook Fails
- Verify webhook URL is accessible
- Check webhook secret configuration
- Ensure plugin is active and updated
- Check WordPress server logs

#### LinkedIn Publishing Fails
- Verify LinkedIn API credentials
- Check company page permissions
- Ensure organization URN is correct
- Monitor LinkedIn API rate limits

#### Content Not Created
- Check Supabase connection
- Verify database schema
- Check content validation rules
- Monitor backend error logs

### Debug Endpoints

#### Check Service Status
```bash
GET /api/v1/content-publishing/status
```

#### Manual WordPress Test
```bash
POST /api/v1/content-publishing/trigger/{contentId}
```

#### Manual LinkedIn Processing
```bash
POST /api/v1/content-publishing/orchestrator/process
```

## Security Considerations

1. **Webhook Security**: Use strong webhook secrets
2. **API Keys**: Store LinkedIn credentials securely
3. **Database Access**: Use service role key for Supabase
4. **HTTPS**: Ensure all webhook URLs use HTTPS
5. **Rate Limiting**: Monitor LinkedIn API usage

## Performance Optimization

1. **Scheduling**: LinkedIn posts are optimally scheduled
2. **Batching**: Multiple platform publishing in single request
3. **Error Handling**: Graceful degradation for failed channels
4. **Retry Logic**: Automatic retries for failed posts
5. **Monitoring**: Real-time status tracking

## Support

For issues with this multi-channel publishing system:
1. Check the test script output
2. Review backend logs
3. Verify WordPress plugin status
4. Check LinkedIn API responses
5. Monitor Supabase database updates