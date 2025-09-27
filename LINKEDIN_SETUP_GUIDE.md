# LinkedIn Developer Setup Guide

This guide covers everything you need to configure on the LinkedIn side to enable the CMS social media automation integration with LinkedIn.

## 🔵 LinkedIn Developer Account & App Setup

### 1. Create LinkedIn Developer Account
- Go to [LinkedIn Developers](https://developer.linkedin.com/)
- Sign in with your LinkedIn account
- Accept the LinkedIn Developer Program Terms

### 2. Create a LinkedIn App
```bash
# Go to: https://developer.linkedin.com/
# Click "Create App" and fill out:
```
- **App Name**: "Your CMS Social Automation" 
- **LinkedIn Page**: Associate with your company page (optional but recommended)
- **App Logo**: Upload a logo (required)
- **Legal Agreement**: Accept LinkedIn API Terms of Use

### 3. Configure App Products
In your LinkedIn App dashboard, add these products:

#### Sign In with LinkedIn using OpenID Connect
- **Redirect URLs**:
  ```
  http://localhost:3000          # Development
  https://your-domain.com        # Production
  ```

#### Share on LinkedIn
- Required for posting content to LinkedIn
- No additional configuration needed

#### Marketing Developer Platform (Optional)
- For advanced analytics and advertising features
- Requires additional approval

## 🔑 App Credentials & Environment Variables

From your LinkedIn App dashboard, get:

```bash
# App Dashboard → Auth → Application credentials
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
```

Add these to your `.env` file:
```bash
# LinkedIn App Configuration
LINKEDIN_CLIENT_ID=your_linkedin_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret

# Database Configuration (already configured)
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_KEY=your_supabase_service_key
```

## 📋 Required Permissions & Scopes

Your app needs these LinkedIn permissions:

### Standard Permissions (auto-approved):
- `r_liteprofile` - Access to basic profile information
- `r_emailaddress` - Access to email address (optional)

### Member Permissions (require verification):
- `w_member_social` - Post on behalf of members

### Organization Permissions (require verification):
- `r_organization_social` - Read organization posts
- `w_organization_social` - Post on behalf of organizations

## 🏢 LinkedIn Account Requirements

### Personal Account:
1. **Complete LinkedIn Profile** - Must be fully filled out
2. **Active Account** - Regular usage and connections
3. **Verification** - Phone/email verified

### Company Page (Optional):
1. **Admin Access** - You must be page admin
2. **Complete Page** - Company page fully set up
3. **Active Page** - Regular posts and followers

### Permission Model:
```javascript
// LinkedIn OAuth Flow:
User Authorization → Member Access Token → Personal Profile Posting
                  ↓
               Organization Access → Company Page Posting
```

## 🔒 App Verification Process

### Development Mode (No verification needed):
- Works with your own LinkedIn account
- Limited to app developers and test accounts
- Perfect for testing the integration

### Production Mode (Requires LinkedIn verification):
- **Required for public use**
- Submit for verification with:
  - Detailed app description
  - Privacy policy URL
  - Terms of service URL
  - App demonstration video
  - Company information

### Verification Requirements:
```markdown
App Use Case: "CMS Social Media Automation"
Description: "Automatically share blog content from CMS to LinkedIn profiles and company pages when content is published, helping content creators maintain professional presence on LinkedIn."

Permissions Requested:
- w_member_social: To automatically post content updates to user profiles
- w_organization_social: To post updates to company pages
- r_liteprofile: To identify connected accounts
```

## 🌐 Domain & URL Configuration

### Authorized Redirect URLs (App Settings → Auth):
```
https://your-cms-domain.com/social/linkedin/callback
https://your-api-domain.com/admin/social/connect
http://localhost:3000/social/connect  # Development only
```

### Website URL:
```
https://your-cms-domain.com
```

## 🧪 Testing Setup

### Test Accounts:
- LinkedIn doesn't have separate test accounts like Facebook
- Use your own LinkedIn account for testing
- Create a test company page if needed

### Development Testing:
1. **Personal Profile Testing**: Use your own account
2. **Company Page Testing**: Create a test company page
3. **Content Testing**: Post test content to verify functionality

## 📊 Company Page Setup (Optional)

For organization posting:

### Create Company Page:
1. Go to [LinkedIn Company Pages](https://www.linkedin.com/company/setup/new/)
2. Fill out company information
3. Upload company logo and cover image
4. Add company description and details
5. Verify your affiliation with the company

### Page Admin Requirements:
- Must be admin of the company page
- Company page must be active and established
- Regular posting history recommended

## 🚀 Quick Start Checklist

```markdown
☐ Create LinkedIn Developer account
☐ Create LinkedIn App with required information
☐ Add "Sign In with LinkedIn" product
☐ Add "Share on LinkedIn" product
☐ Configure redirect URLs
☐ Copy Client ID and Client Secret to environment variables
☐ Test connection with your LinkedIn account
☐ Set up company page (if posting as organization)
☐ Submit for verification when ready for production
```

## 📋 Step-by-Step Configuration

### Step 1: LinkedIn Developer Account
1. Visit [developer.linkedin.com](https://developer.linkedin.com)
2. Click "Join the LinkedIn Developer Program"
3. Sign in with your LinkedIn account
4. Accept the developer agreement
5. Complete developer profile if prompted

### Step 2: Create LinkedIn App
1. Click "Create App"
2. Fill in app details:
   - **App name**: "CMS Social Automation"
   - **LinkedIn Page**: Link to your company page (optional)
   - **Privacy policy URL**: Your privacy policy
   - **App logo**: Upload a square logo (300x300px minimum)
3. Check "I have read and agree to these terms"
4. Click "Create app"

### Step 3: Configure Products
1. In your app dashboard, go to "Products"
2. Add "Sign In with LinkedIn using OpenID Connect":
   - Click "Request access"
   - Wait for approval (usually instant)
3. Add "Share on LinkedIn":
   - Click "Request access"
   - May require verification for production

### Step 4: Set Up Authentication
1. Go to "Auth" tab in your app
2. Add "Authorized redirect URLs":
   ```
   http://localhost:3000
   https://your-cms-domain.com
   https://your-api-domain.com/admin/social/connect
   ```
3. Note down your "Client ID" and "Client Secret"

### Step 5: Configure Environment
1. Add credentials to your `.env` file:
   ```bash
   LINKEDIN_CLIENT_ID=your_client_id_here
   LINKEDIN_CLIENT_SECRET=your_client_secret_here
   ```
2. Restart your API server to load new environment variables

### Step 6: Test Integration
1. Access your CMS dashboard
2. Navigate to social media connections
3. Click "Connect LinkedIn"
4. Complete OAuth flow
5. Test posting functionality

## ⚠️ Important Notes

### Development vs Production
- **Development**: Works immediately with your account
- **Production**: Requires LinkedIn verification for public use
- Start in development mode for testing

### Rate Limits
- **Personal Profile Posts**: 100 posts per user per day
- **Company Page Posts**: 100 posts per page per day
- **API Calls**: 500 calls per user per day
- The integration includes automatic rate limiting

### Content Guidelines
- All posts must comply with LinkedIn Professional Community Policies
- No spam or automated engagement
- Content should be relevant and valuable to professional networks
- Avoid excessive promotional content

### Token Management
- **Access Tokens**: Valid for 60 days
- **Refresh Tokens**: Not provided by LinkedIn
- Users need to re-authorize after token expiry
- Integration handles token expiration gracefully

### Privacy & Permissions
- Users can revoke access at any time in LinkedIn settings
- App only requests minimum necessary permissions
- All data handling follows LinkedIn's privacy guidelines

## 🔧 Troubleshooting

### Common Issues

#### "Invalid Client ID" Error
- Double-check Client ID in environment variables
- Ensure no extra spaces or characters
- Verify app is properly created in LinkedIn Developer Portal

#### "Invalid Redirect URI" Error
- Check redirect URIs match exactly in app settings
- Include protocol (http/https)
- No trailing slashes in URLs
- Case-sensitive matching

#### "Insufficient Permissions" Error
- Check user has proper LinkedIn account
- Verify app has required products enabled
- For company pages, ensure user is page admin
- May need verification for advanced permissions

#### "Token Expired" Error
- LinkedIn tokens expire after 60 days
- User needs to re-authorize the connection
- Implement token refresh flow in your app

### Testing Checklist

```markdown
☐ App credentials correctly set in environment
☐ OAuth flow completes successfully
☐ Can retrieve user profile information
☐ Can post to personal LinkedIn profile
☐ Can retrieve and post to company pages (if applicable)
☐ Content appears correctly on LinkedIn
☐ Error handling works for invalid tokens
```

## 📚 Additional Resources

### LinkedIn Documentation
- [LinkedIn Developer Portal](https://developer.linkedin.com/)
- [LinkedIn API Documentation](https://docs.microsoft.com/en-us/linkedin/)
- [Share on LinkedIn](https://docs.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares)
- [OAuth 2.0 Flow](https://docs.microsoft.com/en-us/linkedin/shared/authentication/authorization-code-flow)

### Content Guidelines
- [LinkedIn Professional Community Policies](https://www.linkedin.com/legal/professional-community-policies)
- [LinkedIn Brand Guidelines](https://brand.linkedin.com/)
- [Best Practices for LinkedIn Sharing](https://www.linkedin.com/business/marketing/blog/linkedin-pages/how-to-post-on-linkedin)

### App Review Resources
- [App Verification Process](https://docs.microsoft.com/en-us/linkedin/shared/references/migrations/default-application-permissions)
- [Platform Guidelines](https://docs.microsoft.com/en-us/linkedin/shared/api-guide/best-practices)

## 🆘 Support

If you encounter issues:

1. **Check LinkedIn Status**: LinkedIn doesn't have a public status page, but check [LinkedIn Help](https://www.linkedin.com/help/)
2. **Review Error Logs**: Check both CMS API and LinkedIn app logs
3. **LinkedIn Developer Support**: Use support channels in LinkedIn Developer Portal
4. **Developer Forums**: LinkedIn Developer Community discussions

## 🔄 Maintenance

### Regular Tasks
- **Monitor Token Expiry**: Set up alerts for token expiration
- **Review Permissions**: Ensure permissions are still valid
- **Update Content**: Keep app description and privacy policy current
- **Check Guidelines**: Stay updated with LinkedIn policy changes

### Updates
- **API Versions**: LinkedIn occasionally updates API versions
- **Permission Changes**: Monitor for changes in permission requirements
- **Policy Updates**: Review LinkedIn platform policy updates

## 💡 Pro Tips

### Content Strategy
- **Professional Focus**: LinkedIn favors business and professional content
- **Optimal Timing**: 12:00 PM UTC (default) works well for most audiences
- **Engagement**: LinkedIn rewards posts that generate professional discussions
- **Hashtags**: Use 2-3 relevant professional hashtags

### Company Page Best Practices
- **Regular Posting**: Maintain consistent posting schedule
- **Employee Advocacy**: Encourage employees to engage with company posts
- **Industry Content**: Share relevant industry insights and news
- **Visual Content**: Include images or videos when possible

### Analytics
- **LinkedIn Analytics**: Use LinkedIn's native analytics for insights
- **Custom Tracking**: Implement UTM parameters for website traffic tracking
- **Performance Monitoring**: Track engagement rates and reach metrics
- **A/B Testing**: Test different posting times and content formats

This setup guide should get your LinkedIn integration up and running. Start with development mode for testing, then submit for verification when ready for production use!