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

## Step 2: Deploy Feature Branch to Vercel

**IMPORTANT**: Since your frontend and backend are already configured in Vercel and connected to the GitHub repository, you need to ensure the **feature branch** is deployed, not the main branch.

### Option A: Change Production Branch (Recommended for Testing)

This temporarily changes which branch Vercel deploys to production.

#### Backend:
1. Go to https://vercel.com/dashboard
2. Select your **backend API project** (e.g., "cms-automation-api")
3. Go to **Settings** → **Git**
4. Under **"Production Branch"**, change from `main` to `feature/multi-channel-publishing-complete`
5. Click **"Save"**
6. Go to **Deployments** tab
7. Vercel will automatically trigger a new deployment from the feature branch
8. Wait for deployment to complete (green checkmark)
9. Your backend will now serve the feature branch code

#### Frontend:
1. Go to https://vercel.com/dashboard
2. Select your **frontend project** (e.g., "cms-automation-frontend")
3. Go to **Settings** → **Git**
4. Under **"Production Branch"**, change from `main` to `feature/multi-channel-publishing-complete`
5. Click **"Save"**
6. Go to **Deployments** tab
7. Vercel will automatically trigger a new deployment from the feature branch
8. Wait for deployment to complete
9. Your frontend will now serve the feature branch code

### Option B: Use Preview Deployments (For Testing Without Changing Production)

Vercel automatically creates preview deployments for every branch.

#### Backend:
1. Push your feature branch to GitHub: `git push origin feature/multi-channel-publishing-complete`
2. Vercel automatically creates a preview deployment
3. Go to https://vercel.com/dashboard → Select backend project → **Deployments**
4. Find the deployment for `feature/multi-channel-publishing-complete` branch
5. Click on it and copy the preview URL (e.g., `https://cms-automation-api-git-feature-multi-channel-xyz.vercel.app`)
6. This URL serves your feature branch code

#### Frontend:
1. Go to https://vercel.com/dashboard → Select frontend project → **Deployments**
2. Find the deployment for `feature/multi-channel-publishing-complete` branch
3. Copy the preview URL (e.g., `https://cms-automation-frontend-git-feature-multi-channel-xyz.vercel.app`)

**Important**: If using preview URLs, update your frontend environment variable `VITE_API_URL` to point to the backend preview URL.

### Option C: Manual Redeploy from Vercel Dashboard

Force a redeploy from the feature branch:

#### Backend:
1. Ensure feature branch is pushed: `git push origin feature/multi-channel-publishing-complete`
2. Go to https://vercel.com/dashboard → Select backend project
3. Go to **Deployments** tab
4. Find the latest deployment for the feature branch
5. Click **"⋯" (three dots)** → **"Redeploy"**
6. Select **"Use existing Build Cache"** or not (your choice)
7. Click **"Redeploy"**

#### Frontend:
Same process for frontend project

### Option D: Deploy via Vercel CLI (If Projects Don't Exist Yet)

Only use this if you haven't already set up Vercel projects.

```bash
# Navigate to backend API directory
cd backend/api

# Login to Vercel (if not already logged in)
vercel login

# Link to existing project or create new one
vercel link

# Deploy to production
vercel --prod

# Navigate to frontend directory
cd ../../frontend

# Link to existing project or create new one
vercel link

# Deploy to production
vercel --prod
```

### Verification

After deployment, verify the feature branch is deployed:

1. **Check Backend:**
   ```bash
   curl https://your-backend-api.vercel.app/health
   ```

2. **Check Frontend:**
   Open `https://your-frontend.vercel.app` in browser

3. **Verify Git Commit:**
   - In Vercel dashboard → Deployments → Click latest deployment
   - Check the "Git Commit" shows the feature branch commit hash
   - Should match: `git log feature/multi-channel-publishing-complete -1 --format="%H"`

### After Testing: Merge to Main (Optional)

Once you've verified the feature branch works correctly:

```bash
# Switch to main branch
git checkout main

# Merge feature branch
git merge feature/multi-channel-publishing-complete

# Push to remote
git push origin main

# Change Vercel production branch back to main (if you changed it)
# Go to Vercel Settings → Git → Production Branch → Change to "main"
```

---

# Part 2: Environment Variables Configuration

**👤 Who performs these steps:** A team member with **Owner** or **Member** access to the Vercel team/project. You need permissions to modify project settings and environment variables.

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

**👤 Who performs these steps:** A LinkedIn user who is an **administrator of the Haidrun LinkedIn company page**. You must have admin/owner access to the company page to link it to the app.

## Step 1: Create LinkedIn App

1. Go to https://www.linkedin.com/developers/apps
2. **Log in** with your LinkedIn account (must be admin of Haidrun company page)
3. Click **"Create app"**
4. Fill in app details:
   - **App name**: "Haidrun CMS Publishing"
   - **LinkedIn Page**: Select your Haidrun company page (you must be admin)
   - **App logo**: Upload Haidrun logo
   - **Legal agreement**: Check the box
5. Click **"Create app"**

## Step 2: Get Client ID and Client Secret

1. After creating the app, you'll be automatically redirected to the app dashboard
2. Click on the **"Auth"** tab in the left sidebar (also called "Authentication")
3. Under **"Authentication Keys"** section, you'll see:
   - **Client ID** (also called API Key or Consumer Key)
   - **Primary Client Secret** (click "Show" to reveal it)
4. **Copy both values** - you'll need them for Vercel
5. Add these to your Vercel backend environment variables:
   ```
   LINKEDIN_CLIENT_ID=your_client_id_here
   LINKEDIN_CLIENT_SECRET=your_client_secret_here
   ```

**⚠️ Security:** Keep your Client Secret confidential. Never expose it in client-side code or public repositories.

## Step 3: Request API Access

1. Go to **Products** tab in your app dashboard
2. Click **"Request access"** or **"Add product"** for:
   - **Share on LinkedIn** - Required for posting to LinkedIn
   - **Sign In with LinkedIn** (if available) - For OAuth authentication
3. If you see **"Marketing Developer Platform"** or **"Advertising API"**, you can request it for company page posting
4. Wait for approval (usually instant for "Share on LinkedIn")

**Note:** The available products may vary by account. At minimum, you need "Share on LinkedIn" with the `w_organization_social` OAuth scope for company page posting.

**If you don't see these products:**
- Ensure your LinkedIn account is an admin of the Haidrun company page
- Some products require approval - you may need to submit an application explaining your use case
- Contact LinkedIn Developer Support if products are missing

## Step 4: Configure OAuth Redirect URLs

1. Go to **Auth** tab
2. Under **Redirect URLs**, add:
   ```
   https://your-backend-api.vercel.app/api/auth/linkedin/callback
   https://localhost:5000/api/auth/linkedin/callback (for testing)
   ```
3. Click **"Update"**

## Step 5: Generate Access Token

You need to get an access token for your Haidrun company page with the correct OAuth scopes.

**Required OAuth Scopes for Company Page Posting:**
- `w_organization_social` - **REQUIRED** for posting to company/organization pages
- `r_liteprofile` - For basic profile information
- `r_organization_social` - For reading organization content (optional)

**Note:** `w_member_social` is for personal profiles only, not company pages. Using the wrong scope will result in a 403 Forbidden error when trying to post.

### Option A: Use LinkedIn OAuth Flow (Recommended)

**Prerequisites:** Your backend must be deployed and have LinkedIn OAuth endpoints. The CMS backend includes these endpoints at:
- `GET /api/v1/linkedin/auth-url` - Generates OAuth URL
- `POST /api/v1/linkedin/connect` - Handles OAuth callback and stores token

#### Step-by-Step OAuth Process:

**Step 1: Get the LinkedIn Authorization URL**

Make a GET request to your backend to generate the OAuth URL:

```bash
curl "https://your-backend-api.vercel.app/api/v1/linkedin/auth-url?redirectUri=https://your-backend-api.vercel.app/api/v1/linkedin/callback"
```

Response will contain:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=..."
  }
}
```

**Step 2: Authorize with LinkedIn**

1. Copy the `authUrl` from the response
2. **Open it in your browser** (or share with Haidrun company page admin)
3. **Log in with the LinkedIn account** that is an admin of Haidrun company page
4. LinkedIn will show permission request for your app
5. Review the requested permissions (should include `w_organization_social`)
6. Click **"Allow"** to authorize

**Step 3: Handle the OAuth Callback**

After authorization, LinkedIn redirects to your callback URL with an authorization code:
```
https://your-backend-api.vercel.app/api/v1/linkedin/callback?code=AQT...&state=...
```

**Step 4: Exchange Code for Access Token**

Your backend needs to exchange this code for an access token. Make a POST request:

```bash
curl -X POST "https://your-backend-api.vercel.app/api/v1/linkedin/connect" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "AQT...",
    "redirectUri": "https://your-backend-api.vercel.app/api/v1/linkedin/callback"
  }'
```

**Step 5: Token Automatically Stored**

If successful, the backend will:
- Exchange the code for an access token
- Get the user profile and organizations they admin
- Store the token in Supabase `social_accounts` table
- Return success with profile and organization info

Response:
```json
{
  "success": true,
  "data": {
    "access_token": "...",
    "expires_in": 5184000,
    "profile": {
      "id": "...",
      "firstName": "...",
      "lastName": "..."
    },
    "organizations": [...]
  }
}
```

**Alternative: Use the Frontend**

If your frontend has LinkedIn OAuth integration:
1. Go to your frontend settings page
2. Click "Connect LinkedIn Account"
3. Follow the authorization flow
4. Token will be stored automatically

**Troubleshooting OAuth Flow:**

- **Error: "LINKEDIN_SERVICE_UNAVAILABLE"** → Check that `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET` are set in Vercel backend environment variables
- **Error: "Invalid redirect URI"** → Ensure the redirect URI matches exactly what you configured in LinkedIn app settings (Step 4 of Part 3)
- **Error: "Insufficient permissions"** → Ensure you authorized with an account that is admin of Haidrun company page
- **Token doesn't work for company posting** → Verify the `w_organization_social` scope was included and approved

### Option B: Manual Token Generation

1. Go to https://www.linkedin.com/developers/tools/oauth/token-generator
2. Select your app
3. Select the required scopes:
   - ✅ `w_organization_social` (required for company posting)
   - ✅ `r_liteprofile`
4. Click **"Generate Token"**
5. Copy the access token
6. Manually insert into Supabase (see Part 5)

**Important:** The access token must be obtained by a user who is an admin of the Haidrun company page. The token will only have permissions for pages the authorizing user administers.

## Step 6: Get Company Organization ID

You need to find the numerical ID for your Haidrun company page and convert it to an organization URN.

### Method 1: From Company Page URL (Easiest)

1. Go to https://www.linkedin.com/company/haidrun/ (or your company page)
2. Look at the URL in your browser's address bar
3. The company ID is the number after `/company/`
   - Example: `https://www.linkedin.com/company/12345678/` → Company ID is `12345678`
4. Create the URN: `urn:li:organization:12345678`

**Note:** If your URL uses a vanity name (like `/company/haidrun/` instead of a number), use Method 2 or 3.

### Method 2: Using Browser Developer Tools

1. Go to your Haidrun LinkedIn company page
2. Open browser Developer Tools (F12 or right-click → Inspect)
3. Go to **Network** tab
4. Click the **Follow** or **Unfollow** button on the company page
5. Look for a POST request to a URL containing `fsd_company:`
   - Example: `...urn:li:fsd_company:12345678`
6. The number after `fsd_company:` is your company ID
7. Create the URN: `urn:li:organization:12345678`

### Method 3: Using LinkedIn API (If You Have Access Token)

1. Use the organizationalEntityAcls endpoint to get organizations you admin:
   ```bash
   curl -X GET 'https://api.linkedin.com/v2/organizationalEntityAcls?q=roleAssignee' \
     -H 'Authorization: Bearer YOUR_ACCESS_TOKEN'
   ```
2. Look for your Haidrun company in the response
3. Extract the organization URN (e.g., `urn:li:organization:12345678`)

### Result Format

Your final organization URN should look like:
```
urn:li:organization:12345678
```

This URN will be used when inserting the LinkedIn account into the Supabase database (Step 2 of Part 5).

---

# Part 4: WordPress Plugin Setup

**👤 Who performs these steps:** A WordPress user with **Administrator** role on the Haidrun WordPress site (haidrun.com). You need admin permissions to install plugins and configure settings.

## Step 1: Install Plugin on Haidrun Website

1. Download the plugin from: `/cms_automation/plugins/wordpress/cms-automation-bridge-v1.0.7.zip`
2. **Log in** to WordPress admin at https://haidrun.com/wp-admin (as Administrator)
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

**👤 Who performs these steps:** A team member with **Owner** or **Admin** access to the Supabase project. You need permissions to run SQL queries and modify the database.

## Step 1: Create Database Tables

You need to create the required tables for the multi-channel publishing system.

### Option A: Run Complete Schema File (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor**
4. Click **"New Query"**
5. Copy the entire contents of `/scripts/schema.sql` from your project
6. Paste into the SQL editor
7. Click **"Run"** (or press Ctrl+Enter)
8. Wait for confirmation that all statements executed successfully

### Option B: Run Schema Manually (Step by Step)

If you prefer to create tables individually or the full schema fails, follow these steps:

#### 1. Enable UUID Extension

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

#### 2. Create Core Content Tables

```sql
-- Content Types
CREATE TABLE IF NOT EXISTS public.content_types (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    schema JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content Items (stores blog posts and content)
CREATE TABLE IF NOT EXISTS public.content_items (
    id VARCHAR(255) PRIMARY KEY,
    content_type_id VARCHAR(255) NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    content JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    published_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,
    updated_by UUID
);
```

#### 3. Create Social Media Tables (Required for Multi-Channel)

```sql
-- Social Accounts (stores LinkedIn/social media credentials)
CREATE TABLE IF NOT EXISTS public.social_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
    account_name VARCHAR(255) NOT NULL,
    account_id VARCHAR(255) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    account_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(platform, account_id)
);

-- Social Posts (tracks scheduled and published posts)
CREATE TABLE IF NOT EXISTS public.social_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id VARCHAR(255),
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('linkedin', 'facebook', 'twitter', 'instagram')),
    account_id UUID REFERENCES social_accounts(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'published', 'failed', 'cancelled')),
    scheduled_time TIMESTAMP WITH TIME ZONE,
    published_time TIMESTAMP WITH TIME ZONE,
    post_data JSONB NOT NULL DEFAULT '{}',
    platform_post_id VARCHAR(255),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    error_message TEXT,
    analytics_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### 4. Create Indexes for Performance

```sql
-- Content indexes
CREATE INDEX IF NOT EXISTS idx_content_items_status ON content_items(status);
CREATE INDEX IF NOT EXISTS idx_content_items_published_at ON content_items(published_at);

-- Social media indexes
CREATE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_social_accounts_active ON social_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_social_posts_platform ON social_posts(platform);
CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(status);
CREATE INDEX IF NOT EXISTS idx_social_posts_scheduled_time ON social_posts(scheduled_time);
```

#### 5. Enable Row Level Security

```sql
-- Enable RLS
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;

-- Create permissive policies (adjust as needed for your security requirements)
CREATE POLICY "Allow full access to content_types" ON public.content_types FOR ALL USING (true);
CREATE POLICY "Allow full access to content_items" ON public.content_items FOR ALL USING (true);
CREATE POLICY "Allow full access to social_accounts" ON public.social_accounts FOR ALL USING (true);
CREATE POLICY "Allow full access to social_posts" ON public.social_posts FOR ALL USING (true);
```

### Verify Tables Were Created

After running the schema, verify the tables exist:

1. In Supabase dashboard, go to **Table Editor**
2. You should see these tables:
   - ✅ `content_types`
   - ✅ `content_items` - Stores blog posts and content
   - ✅ `social_accounts` - Stores LinkedIn/social media credentials
   - ✅ `social_posts` - Tracks scheduled and published social posts
   - ✅ `content_social_mappings` (if using full schema)
   - ✅ `media_files` (if using full schema)

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

### If Using Auto-Deploy (Recommended)

If your Vercel projects are connected to GitHub:

1. Push changes to the feature branch:
   ```bash
   git push origin feature/multi-channel-publishing-complete
   ```

2. Vercel will automatically deploy:
   - If production branch is set to `feature/multi-channel-publishing-complete`, it deploys to production
   - Otherwise, creates a preview deployment

3. Check deployments in Vercel dashboard to verify

### If Using Manual Deploy

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

### When Ready to Go Live

Once the feature branch is tested and ready:

1. **Merge to main:**
   ```bash
   git checkout main
   git merge feature/multi-channel-publishing-complete
   git push origin main
   ```

2. **Update Vercel production branch:**
   - Go to both projects in Vercel dashboard
   - Settings → Git → Production Branch → Change back to `main`
   - Vercel will auto-deploy from main

3. **Clean up:**
   ```bash
   # Delete feature branch locally (optional)
   git branch -d feature/multi-channel-publishing-complete

   # Delete remote feature branch (optional)
   git push origin --delete feature/multi-channel-publishing-complete
   ```

---

# Summary Checklist

Use this checklist to verify complete installation:

## Installation Complete
- [ ] Feature branch pulled from GitHub
- [ ] **Vercel production branch changed to feature branch** (or using preview deployments)
- [ ] Backend deployed to Vercel from feature branch (verified git commit in Vercel dashboard)
- [ ] Frontend deployed to Vercel from feature branch (verified git commit in Vercel dashboard)
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