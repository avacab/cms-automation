# Facebook Developer Setup Guide

This guide covers everything you need to configure on the Facebook side to enable the CMS social media automation integration.

## 🔵 Facebook Developer Account & App Setup

### 1. Create Facebook Developer Account
- Go to [Facebook for Developers](https://developers.facebook.com/)
- Sign up with your Facebook account
- Verify your account (may require phone number)

### 2. Create a Facebook App
```bash
# Go to: https://developers.facebook.com/apps/
# Click "Create App" → "Business" → Fill out:
```
- **App Name**: "Your CMS Social Automation" 
- **App Contact Email**: Your email
- **Business Manager Account**: Optional but recommended for production

### 3. Add Required Products
In your Facebook App dashboard, add these products:

#### Facebook Login
- **Valid OAuth Redirect URIs**:
  ```
  http://localhost:3000          # Development
  https://your-domain.com        # Production
  ```

#### Webhooks 
- **Webhook URL**: `https://your-api-domain.com/api/v1/social/webhook/facebook`
- **Verify Token**: Set a secure token (goes in your `FACEBOOK_WEBHOOK_VERIFY_TOKEN` env var)
- **Webhook Fields**: Subscribe to `feed` events

## 🔑 App Credentials & Environment Variables

From your Facebook App dashboard, get:

```bash
# App Dashboard → Settings → Basic
FACEBOOK_APP_ID=123456789012345
FACEBOOK_APP_SECRET=abc123def456ghi789jkl012mno345pq

# Custom webhook verify token (you create this)
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your-secure-webhook-token-123
```

Add these to your `.env` file:
```bash
# Facebook App Configuration
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_verify_token

# Database Configuration (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

## 📋 Required Permissions & Scopes

Your app needs these Facebook permissions:

### Standard Permissions (auto-approved):
- `pages_show_list` - Get user's pages
- `pages_read_engagement` - Read page insights

### Advanced Permissions (require review):
- `pages_manage_posts` - Post to pages
- `pages_read_user_content` - Read page content

## 🏢 Facebook Page Requirements

### Page Setup:
1. **Create/Own a Facebook Page** (not personal profile)
2. **Admin Access** - You must be page admin
3. **Business Account** - Recommended for API access
4. **Page Verification** - May be required for some features

### Page Token vs User Token:
```javascript
// Your app gets:
User Access Token → Get user's pages → Page Access Tokens
                                    ↓
                            Use for posting to each page
```

## 🔒 App Review Process

### Development Mode (No review needed):
- Works with your own Facebook account
- Limited to app admins/developers/testers
- Perfect for testing the integration

### Live Mode (Requires Facebook review):
- **Required for public use**
- Submit for review with:
  - Screen recordings showing the integration
  - Privacy policy URL
  - Terms of service URL
  - Detailed use case explanation

### Review Requirements:
```markdown
Use Case: "CMS Social Media Automation"
Description: "Automatically post blog content from WordPress CMS to connected Facebook pages when content is published, helping content creators maintain consistent social media presence."

Permissions Needed:
- pages_manage_posts: To automatically post content updates
- pages_read_engagement: To provide posting analytics
```

## 🌐 Domain & URL Configuration

### App Domains (App Settings → Basic):
```
your-cms-domain.com
your-api-domain.com
```

### Platform URLs (App Settings → Basic):
```
Website URL: https://your-cms-domain.com
```

### OAuth Redirect URIs (Facebook Login → Settings):
```
https://your-cms-domain.com/social/facebook/callback
https://your-api-domain.com/admin/social/connect
http://localhost:3000/social/connect  # Development only
```

## 🧪 Testing Setup

### App Roles (App Dashboard → Roles):
Add test users:
- **Administrators** - Full access
- **Developers** - Can test in development mode  
- **Testers** - Can test specific features

### Test Pages:
Create test Facebook pages for safe testing without affecting real business pages.

## 📊 Optional: Business Manager

For production/enterprise use:

### Facebook Business Manager:
- **Asset Management** - Centralized control of pages, apps, ad accounts
- **User Permissions** - Team access management
- **Advanced Analytics** - Better insights and reporting
- **Brand Safety** - Separate business and personal accounts

### Setup Business Manager:
1. Go to [business.facebook.com](https://business.facebook.com)
2. Create business account
3. Add your Facebook app to business manager
4. Add Facebook pages to business manager
5. Assign appropriate roles to team members

## 🚀 Quick Start Checklist

```markdown
☐ Create Facebook Developer account
☐ Create Facebook App (Business type)
☐ Add Facebook Login product + configure redirect URIs
☐ Add Webhooks product + configure endpoint URL
☐ Copy App ID and App Secret to environment variables
☐ Set webhook verify token
☐ Create/prepare Facebook Page for posting
☐ Test connection in development mode
☐ Submit for app review when ready for production
```

## 📋 Step-by-Step Configuration

### Step 1: Facebook Developer Account
1. Visit [developers.facebook.com](https://developers.facebook.com)
2. Click "Get Started"
3. Log in with your Facebook account
4. Accept developer terms
5. Verify your account via phone/email if prompted

### Step 2: Create Facebook App
1. Go to "My Apps" → "Create App"
2. Select "Business" as app type
3. Fill in app details:
   - **Display Name**: "CMS Social Automation"
   - **Contact Email**: your-email@domain.com
   - **Business Manager**: (optional, recommended for teams)
4. Click "Create App"

### Step 3: Configure Facebook Login
1. In your app dashboard, click "Add Product"
2. Find "Facebook Login" → click "Set Up"
3. Go to "Facebook Login" → "Settings"
4. Add Valid OAuth Redirect URIs:
   ```
   http://localhost:3000
   https://your-cms-domain.com
   https://your-api-domain.com/admin/social/connect
   ```
5. Save changes

### Step 4: Configure Webhooks
1. In your app dashboard, click "Add Product"
2. Find "Webhooks" → click "Set Up"
3. Click "New Subscription" → "Page"
4. Configure:
   - **Callback URL**: `https://your-api-domain.com/api/v1/social/webhook/facebook`
   - **Verify Token**: Create a secure token (save this for env vars)
   - **Subscription Fields**: Check `feed`
5. Save subscription

### Step 5: Get App Credentials
1. Go to "Settings" → "Basic"
2. Copy your **App ID** and **App Secret**
3. Add to your `.env` file:
   ```bash
   FACEBOOK_APP_ID=your_app_id_here
   FACEBOOK_APP_SECRET=your_app_secret_here
   FACEBOOK_WEBHOOK_VERIFY_TOKEN=your_webhook_token_here
   ```

### Step 6: Configure App Settings
1. Still in "Settings" → "Basic"
2. Add **App Domains**:
   ```
   your-cms-domain.com
   your-api-domain.com
   ```
3. Add **Website URL**: `https://your-cms-domain.com`
4. Save changes

### Step 7: Set Up Test Users (Optional)
1. Go to "Roles" → "Test Users"
2. Click "Add" to create test users
3. Use these accounts to test without affecting real users

## ⚠️ Important Notes

### Development vs Production
- **Development Mode**: Works immediately with your account and test users
- **Live Mode**: Requires Facebook app review for public use
- Start in development mode for testing

### Rate Limits
- Facebook has strict API rate limits
- The integration includes automatic rate limiting
- Monitor usage in Facebook Analytics

### Page vs User Posts
- Integration posts to **Facebook Pages** (business accounts)
- Cannot post to personal profiles
- You must be admin of the target pages

### Token Management
- User tokens expire, but page tokens can be long-lived
- Integration handles token refresh automatically
- Store tokens securely (encrypted in database)

### Webhook Security
- Facebook requires HTTPS for production webhooks
- Webhook signatures are verified automatically
- Use strong verify tokens

### Content Policies
- All posts must comply with Facebook community standards
- Avoid automated posting of promotional content
- Review Facebook's platform policies

## 🔧 Troubleshooting

### Common Issues

#### "Invalid App ID" Error
- Double-check App ID in environment variables
- Ensure no extra spaces or characters
- Verify app is in correct mode (dev/live)

#### "Invalid Redirect URI" Error
- Check OAuth redirect URIs match exactly
- Include protocol (http/https)
- No trailing slashes

#### "Webhook Verification Failed" Error
- Verify webhook URL is accessible via HTTPS
- Check verify token matches exactly
- Ensure API server is running

#### "Insufficient Permissions" Error
- Check user has admin access to target page
- Verify app has required permissions
- May need app review for advanced permissions

### Testing Checklist

```markdown
☐ App credentials correctly set in environment
☐ Webhook endpoint returns 200 OK
☐ OAuth flow completes successfully
☐ Can retrieve user's pages
☐ Can select and connect a page
☐ Test post publishes to Facebook
☐ Webhook receives feed updates
```

## 📚 Additional Resources

### Facebook Documentation
- [Facebook for Developers](https://developers.facebook.com/)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api/)
- [Pages API](https://developers.facebook.com/docs/pages/)
- [Webhooks Guide](https://developers.facebook.com/docs/graph-api/webhooks/)

### App Review Resources
- [App Review Guide](https://developers.facebook.com/docs/app-review/)
- [Platform Policy](https://developers.facebook.com/policy/)
- [Community Standards](https://www.facebook.com/communitystandards/)

### Business Manager
- [Business Manager Help](https://www.facebook.com/business/help/)
- [Business Settings](https://business.facebook.com/settings/)

## 🆘 Support

If you encounter issues:

1. **Check Facebook Status**: [status.fb.com](https://status.fb.com)
2. **Review Error Logs**: Check both CMS API and Facebook app logs
3. **Facebook Developer Support**: Use the support channels in your app dashboard
4. **Community Forums**: Facebook Developer Community forums

## 🔄 Maintenance

### Regular Tasks
- **Monitor API Usage**: Check rate limits and quotas
- **Review Permissions**: Ensure permissions are still valid
- **Update Tokens**: Refresh long-lived tokens before expiry
- **Check Policies**: Stay updated with Facebook policy changes

### Updates
- **Graph API Versions**: Facebook releases new versions regularly
- **Deprecation Notices**: Monitor for deprecated features
- **Security Updates**: Keep webhook verification current

This setup guide should get your Facebook integration up and running. Start with development mode for testing, then submit for app review when ready for production use!