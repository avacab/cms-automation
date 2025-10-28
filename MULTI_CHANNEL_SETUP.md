# Multi-Channel Publishing Setup Guide

This guide explains how to install and configure the complete end-to-end post distribution system that publishes content from the frontend to both the Haidrun website (WordPress) and LinkedIn company page.

## Production Architecture

- **Frontend**: Deployed on Vercel (React application)
- **Backend API**: Deployed on Vercel (Node.js/Express)
- **Database**: Supabase (PostgreSQL)
- **WordPress**: Haidrun.com (with wp-headless-cms-bridge plugin)
- **LinkedIn**: Company page via LinkedIn API

---

# Part 1: Feature Branch Installation

## Step 1: Pull the Feature Branch from GitHub

```bash
# Navigate to your project directory
cd /path/to/cms_automation

# Fetch all branches from remote
git fetch origin

# Switch to the feature branch
git checkout feature/multi-channel-publishing-complete

# Pull latest changes
git pull origin feature/multi-channel-publishing-complete
```

## Step 2: Deploy Backend to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Navigate to backend API directory
cd backend/api

# Login to Vercel (if not already logged in)
vercel login

# Deploy to production
vercel --prod

# Note the deployment URL (e.g., https://your-api.vercel.app)
```

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click **"Add New Project"**
3. Import your GitHub repository `avacab/cms-automation`
4. Configure:
   - **Framework Preset**: Other
   - **Root Directory**: `backend/api`
   - **Build Command**: `npm install`
   - **Output Directory**: (leave empty)
5. Click **"Deploy"**
6. Note your backend URL (e.g., `https://cms-automation-api.vercel.app`)

## Step 3: Deploy Frontend to Vercel

### Option A: Deploy via Vercel CLI

```bash
# Navigate to frontend directory
cd ../../frontend

# Deploy to production
vercel --prod

# Note the deployment URL (e.g., https://your-frontend.vercel.app)
```

### Option B: Deploy via Vercel Dashboard

1. Go to https://vercel.com/dashboard
2. Click **"Add New Project"**
3. Import your GitHub repository `avacab/cms-automation`
4. Configure:
   - **Framework Preset**: Vite (or React)
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Click **"Deploy"**
6. Note your frontend URL (e.g., `https://cms-automation-frontend.vercel.app`)

---

# Part 2: Environment Variables Configuration

## Backend Environment Variables (Vercel)

Go to your backend Vercel project → **Settings** → **Environment Variables** and add:

### Supabase Configuration
```
SUPABASE_URL=https://neezcjbguizmkbyglroe.supabase.co
SUPABASE_SERVICE_KEY=your_supabase_service_role_key
```

**How to get these:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **API**
4. Copy **Project URL** → use as `SUPABASE_URL`
5. Copy **service_role key** (under "Project API keys") → use as `SUPABASE_SERVICE_KEY`

### LinkedIn API Configuration
```
LINKEDIN_CLIENT_ID=your_linkedin_app_client_id
LINKEDIN_CLIENT_SECRET=your_linkedin_app_client_secret
```

**How to get these:** See "Part 3: LinkedIn API Setup" below

### WordPress Webhook Configuration

#### Haidrun WordPress Site
```
HAIDRUN_WORDPRESS_WEBHOOK_URL=https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/content
HAIDRUN_WORDPRESS_WEBHOOK_SECRET=your_secure_webhook_secret
```

**How to configure:** See "Part 4: WordPress Plugin Setup" below

#### Personal WordPress Site (Optional)
```
PERSONAL_WORDPRESS_WEBHOOK_URL=https://your-personal-site.com/wp-json/wp-headless-cms-bridge/v1/webhook/content
PERSONAL_WORDPRESS_WEBHOOK_SECRET=your_personal_webhook_secret
```

### After Adding Environment Variables

1. Click **"Save"** for each variable
2. Go to **Deployments** tab
3. Click **"Redeploy"** to apply the new environment variables

## Frontend Environment Variables (Vercel)

Go to your frontend Vercel project → **Settings** → **Environment Variables** and add:

```
VITE_API_URL=https://your-backend-api.vercel.app
VITE_SUPABASE_URL=https://neezcjbguizmkbyglroe.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**How to get these:**
- `VITE_API_URL`: Your backend Vercel deployment URL from Step 2
- `VITE_SUPABASE_URL`: Same as backend Supabase URL
- `VITE_SUPABASE_ANON_KEY`: From Supabase → Settings → API → **anon/public key**

After adding, redeploy the frontend.

---

# Part 3: LinkedIn API Setup

## Step 1: Create LinkedIn App

1. Go to https://www.linkedin.com/developers/apps
2. Click **"Create app"**
3. Fill in app details:
   - **App name**: "Haidrun CMS Publishing"
   - **LinkedIn Page**: Select your Haidrun company page
   - **App logo**: Upload Haidrun logo
   - **Legal agreement**: Check the box
4. Click **"Create app"**

## Step 2: Configure App Settings

1. Go to **Settings** tab
2. Note your **Client ID** and **Client Secret**
3. Add these to your Vercel backend environment variables:
   ```
   LINKEDIN_CLIENT_ID=your_client_id_here
   LINKEDIN_CLIENT_SECRET=your_client_secret_here
   ```

## Step 3: Request API Access

1. Go to **Products** tab
2. Request access to:
   - **Share on LinkedIn** (for posting)
   - **Marketing Developer Platform** (for company page posting)
3. Wait for approval (usually instant for Share on LinkedIn)

## Step 4: Configure OAuth Redirect URLs

1. Go to **Auth** tab
2. Under **Redirect URLs**, add:
   ```
   https://your-backend-api.vercel.app/api/auth/linkedin/callback
   https://localhost:5000/api/auth/linkedin/callback (for testing)
   ```
3. Click **"Update"**

## Step 5: Generate Access Token

You need to get an access token for your Haidrun company page.

### Option A: Use LinkedIn OAuth Flow (Recommended)

1. Create an OAuth endpoint in your backend (if not exists)
2. Navigate to:
   ```
   https://your-backend-api.vercel.app/api/auth/linkedin
   ```
3. Authorize the app with your Haidrun admin account
4. Token will be stored in database

### Option B: Manual Token Generation

1. Go to https://www.linkedin.com/developers/tools/oauth/token-generator
2. Select your app and the scopes: `w_member_social`, `w_organization_social`
3. Generate token
4. Manually insert into Supabase (see Part 5)

## Step 6: Get Company Organization ID

1. Use LinkedIn API to get your company's organization URN:
   ```bash
   curl -X GET 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee' \
     -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
   ```
2. Note the organization ID (e.g., `urn:li:organization:12345678`)

---

# Part 4: WordPress Plugin Setup

## Step 1: Install Plugin on Haidrun Website

1. Download the plugin from: `/cms_automation/wordpress-plugin/wp-headless-cms-bridge.zip`
2. Log in to WordPress admin at https://haidrun.com/wp-admin
3. Go to **Plugins** → **Add New** → **Upload Plugin**
4. Choose the zip file and click **"Install Now"**
5. Click **"Activate Plugin"**

## Step 2: Configure Plugin Settings

1. In WordPress admin, go to **Settings** → **Headless CMS Bridge**
2. Configure the following:

```
CMS API URL: https://your-backend-api.vercel.app
Sync Enabled: ✓ Yes
Sync Direction: Bidirectional
Post Types: Posts, Pages
Post Statuses: Published
Auto-publish: ✓ Yes
```

## Step 3: Generate Webhook Secret

1. In the plugin settings, click **"Generate Secret"** or create your own secure random string
2. Example: `hvd7x9k2mq5n8p1r4t6w9y2b5e8h0k3n`
3. Copy this secret
4. Save the plugin settings in WordPress

## Step 4: Add Webhook Secret to Vercel Backend

1. Go to your backend Vercel project → **Settings** → **Environment Variables**
2. Add:
   ```
   HAIDRUN_WORDPRESS_WEBHOOK_SECRET=hvd7x9k2mq5n8p1r4t6w9y2b5e8h0k3n
   ```
   (Use the exact secret from WordPress)
3. Save and redeploy

## Step 5: Verify Webhook Endpoint

Test that the webhook endpoint is accessible:

```bash
curl https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/health
```

Expected response:
```json
{
  "status": "ok",
  "plugin_version": "1.0.6"
}
```

---

# Part 5: Supabase Database Configuration

## Step 1: Verify Database Schema

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Run the schema from `/scripts/schema.sql` to ensure all tables exist:
   - `content` - Stores blog posts and content
   - `social_accounts` - Stores LinkedIn/social media credentials
   - `social_posts` - Tracks scheduled and published social posts

## Step 2: Add LinkedIn Account to Database

Insert the Haidrun LinkedIn account into the `social_accounts` table:
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
  'your_linkedin_company_id',
  'YOUR_ACCESS_TOKEN_FROM_PART_3',
  true,
  '{"type": "organization", "organization_id": "urn:li:organization:YOUR_ORG_ID"}'
);
```

Replace:
- `your_linkedin_company_id` - Your LinkedIn company identifier
- `YOUR_ACCESS_TOKEN_FROM_PART_3` - The access token from Part 3, Step 5
- `YOUR_ORG_ID` - The organization ID from Part 3, Step 6

---

# Part 6: Testing and Verification

## Step 1: Test Backend API

Test that your backend is responding:

```bash
# Replace with your actual backend URL
curl https://your-backend-api.vercel.app/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX..."
}
```

## Step 2: Test Content Publishing Endpoints

```bash
# Check content publishing service status
curl https://your-backend-api.vercel.app/api/v1/content-publishing/status

# Check pending social posts
curl https://your-backend-api.vercel.app/api/v1/content-publishing/pending

# Check orchestrator statistics
curl https://your-backend-api.vercel.app/api/v1/content-publishing/orchestrator/stats
```

## Step 3: Manual End-to-End Test

1. Open your frontend URL (e.g., `https://cms-automation-frontend.vercel.app`)
2. Click **"Create Content"**
3. Fill in:
   - **Title**: "Test Multi-Channel Publishing"
   - **Content**: "This is a test post to verify the multi-channel publishing system."
   - **Status**: Published
   - **Company Brand**: Haidrun
   - ✓ Check **"Haidrun Website (WordPress)"**
   - ✓ Check **"LinkedIn Company Page"**
4. Click **"Create Content"**
5. Wait for success message

## Step 4: Verify WordPress Publication

1. Go to https://haidrun.com/blog (or your blog URL)
2. Look for your test post
3. It should appear immediately with correct title and content

## Step 5: Verify LinkedIn Scheduling

1. Check Supabase `social_posts` table:
   ```sql
   SELECT * FROM social_posts
   WHERE platform = 'linkedin'
   ORDER BY created_at DESC
   LIMIT 1;
   ```
2. Verify the post is scheduled for 12PM UTC on next business day
3. Wait until scheduled time and check Haidrun LinkedIn company page

---

# Part 7: Complete Workflow Overview

## How It Works in Production

### 1. User Creates Content
- User opens frontend at `https://your-frontend.vercel.app`
- Fills out content form with title, content, and publishing options
- Selects "Haidrun" as company branding
- Checks both "Publish to WordPress" and "Publish to LinkedIn"
- Clicks submit

### 2. Backend Processing (Vercel)
- Frontend sends request to backend API at `https://your-backend-api.vercel.app`
- Backend creates content in Supabase database with status "published"
- Backend sends webhook to WordPress at `https://haidrun.com`
- Backend creates scheduled LinkedIn post in database
- Returns success/failure status for each channel

### 3. WordPress Publishing (Immediate)
- WordPress plugin at haidrun.com receives webhook
- Authenticates webhook using HMAC SHA256 signature
- Creates new post on Haidrun website
- Post appears immediately on https://haidrun.com

### 4. LinkedIn Publishing (Scheduled)
- Social Media Orchestrator runs periodically on Vercel
- Finds scheduled posts for current time
- Formats content with Haidrun branding and hashtags
- Posts to Haidrun LinkedIn company page via API
- Marks post as published in database

---

# Part 8: Automated Testing

You can run automated tests to verify the entire flow.

## Update Test Script URLs

Edit `test-multi-channel-publishing.js` and update:

```javascript
const API_BASE_URL = 'https://your-backend-api.vercel.app';
```

## Run Tests

```bash
node test-multi-channel-publishing.js
```

This will test:
- Backend API connectivity
- Content creation with multi-channel publishing
- WordPress webhook delivery
- LinkedIn post scheduling
- Status monitoring

---

# Part 9: Monitoring and Logs

## Vercel Backend Logs

1. Go to https://vercel.com/dashboard
2. Select your backend project
3. Go to **Deployments** → Click on latest deployment
4. Click **"Function Logs"** or **"Runtime Logs"**
5. Monitor:
   - Multi-channel publishing requests
   - Webhook authentication and responses
   - LinkedIn scheduling and posting
   - Error messages and stack traces

## Vercel Frontend Logs

1. Go to your frontend Vercel project
2. Check **Function Logs** for any frontend errors
3. Use browser developer console for client-side debugging

## WordPress Logs

1. Log in to WordPress admin at https://haidrun.com/wp-admin
2. Go to **Settings** → **Headless CMS Bridge** → **Logs** tab
3. Monitor:
   - Incoming webhook requests
   - Authentication status
   - Post creation results
4. Check WordPress error logs on server (if accessible)

## Supabase Database Monitoring

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Table Editor**
4. Check tables:
   - `content` - Verify content is being created
   - `social_posts` - Check scheduled and published posts
   - `social_accounts` - Verify LinkedIn account is active

## LinkedIn Monitoring

- Check Haidrun LinkedIn company page for published posts
- Monitor LinkedIn API rate limits (check Vercel logs)
- Track post engagement metrics on LinkedIn

---

# Part 10: Troubleshooting

## Common Issues

### Issue: Backend Not Responding

**Symptoms:**
- Frontend shows connection errors
- API requests timeout

**Solutions:**
1. Check Vercel deployment status at https://vercel.com/dashboard
2. Verify backend deployment is successful (green checkmark)
3. Test backend URL directly: `curl https://your-backend-api.vercel.app/health`
4. Check Vercel logs for errors
5. Verify environment variables are set correctly
6. Redeploy if necessary

### Issue: WordPress Webhook Fails

**Symptoms:**
- Content created in database but not on WordPress
- Webhook authentication errors in logs

**Solutions:**
1. Verify webhook URL is correct in Vercel environment variables
2. Check webhook secret matches between WordPress and Vercel
3. Ensure WordPress plugin is active: https://haidrun.com/wp-admin/plugins.php
4. Test webhook endpoint: `curl https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/health`
5. Check WordPress plugin version (should be 1.0.6+)
6. Review WordPress error logs
7. Verify haidrun.com server firewall allows incoming webhooks

### Issue: LinkedIn Publishing Fails

**Symptoms:**
- LinkedIn posts not scheduled
- LinkedIn API errors in logs

**Solutions:**
1. Verify LinkedIn API credentials in Vercel environment variables
2. Check `social_accounts` table in Supabase has Haidrun LinkedIn account
3. Verify LinkedIn access token is not expired
4. Ensure organization URN is correct format: `urn:li:organization:XXXXX`
5. Check LinkedIn app has required permissions:
   - Share on LinkedIn
   - Marketing Developer Platform (for company pages)
6. Review LinkedIn API rate limits
7. Test LinkedIn API manually with curl

### Issue: Content Not Created in Database

**Symptoms:**
- Form submission fails
- "Database error" messages

**Solutions:**
1. Check Supabase connection in Vercel environment variables
2. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` are correct
3. Check Supabase project status at https://supabase.com/dashboard
4. Verify database schema exists (run schema.sql if needed)
5. Check table permissions in Supabase
6. Review backend Vercel logs for specific error messages

### Issue: Frontend Can't Connect to Backend

**Symptoms:**
- CORS errors in browser console
- API requests fail

**Solutions:**
1. Verify `VITE_API_URL` in frontend Vercel environment variables
2. Check backend CORS configuration allows frontend domain
3. Ensure both frontend and backend are using HTTPS
4. Test backend directly: `curl https://your-backend-api.vercel.app/health`
5. Clear browser cache and reload
6. Redeploy frontend after fixing environment variables

## Debug Endpoints

Use these endpoints to diagnose issues:

### Check Service Status
```bash
curl https://your-backend-api.vercel.app/api/v1/content-publishing/status
```

### Check Pending LinkedIn Posts
```bash
curl https://your-backend-api.vercel.app/api/v1/content-publishing/pending
```

### Check Orchestrator Statistics
```bash
curl https://your-backend-api.vercel.app/api/v1/content-publishing/orchestrator/stats
```

### Manual WordPress Trigger (if webhook failed)
```bash
curl -X POST https://your-backend-api.vercel.app/api/v1/content-publishing/trigger/{contentId}
```

### Manual LinkedIn Processing (process pending posts immediately)
```bash
curl -X POST https://your-backend-api.vercel.app/api/v1/content-publishing/orchestrator/process
```

---

# Part 11: Security Best Practices

## Environment Variables Security

1. ✅ **Never commit credentials to Git**
   - All secrets stored in Vercel environment variables
   - Use `.env.example` for documentation only

2. ✅ **Use strong webhook secrets**
   - Minimum 32 characters
   - Random alphanumeric characters
   - Rotate periodically

3. ✅ **Protect Supabase service key**
   - Never expose in frontend
   - Only use in backend API
   - Keep separate from anon key

4. ✅ **Secure LinkedIn credentials**
   - Store only in backend environment variables
   - Use OAuth tokens with expiration
   - Implement token refresh logic

## WordPress Security

1. Keep plugin updated to latest version
2. Use HTTPS for all webhook communications
3. Validate webhook signatures (HMAC SHA256)
4. Limit webhook endpoint access if possible

## API Security

1. Implement rate limiting on backend endpoints
2. Validate all incoming data
3. Use HTTPS for all communications
4. Monitor for suspicious activity in Vercel logs

---

# Part 12: Maintenance and Updates

## Regular Maintenance Tasks

### Weekly
- Check LinkedIn token expiration
- Review Vercel logs for errors
- Monitor WordPress plugin status

### Monthly
- Review Supabase storage usage
- Clean up old social_posts records
- Update dependencies in package.json
- Check LinkedIn API usage/limits

### As Needed
- Rotate webhook secrets
- Update WordPress plugin version
- Refresh LinkedIn access tokens
- Update environment variables

## Updating the Feature Branch

When updates are made to the feature branch:

```bash
# Pull latest changes
git pull origin feature/multi-channel-publishing-complete

# Deploy backend
cd backend/api
vercel --prod

# Deploy frontend
cd ../../frontend
vercel --prod
```

Or let Vercel auto-deploy via GitHub integration.

---

# Summary Checklist

Use this checklist to verify complete installation:

## Installation Complete
- [ ] Feature branch pulled from GitHub
- [ ] Backend deployed to Vercel
- [ ] Frontend deployed to Vercel
- [ ] Backend environment variables configured (Supabase, LinkedIn, WordPress)
- [ ] Frontend environment variables configured (API URL, Supabase)
- [ ] LinkedIn app created and configured
- [ ] LinkedIn access token obtained and stored
- [ ] WordPress plugin installed and activated
- [ ] WordPress webhook secret configured
- [ ] Supabase database schema verified
- [ ] LinkedIn account added to social_accounts table

## Testing Complete
- [ ] Backend API responding to health check
- [ ] Content publishing endpoints accessible
- [ ] End-to-end test: Content created in frontend
- [ ] WordPress post published successfully
- [ ] LinkedIn post scheduled successfully
- [ ] Monitoring endpoints working

## Documentation
- [ ] All URLs documented (frontend, backend)
- [ ] Credentials stored securely
- [ ] Team trained on using the system
- [ ] Troubleshooting procedures reviewed

---

**Installation Guide Version:** 1.0
**Last Updated:** January 2025
**Feature Branch:** feature/multi-channel-publishing-complete