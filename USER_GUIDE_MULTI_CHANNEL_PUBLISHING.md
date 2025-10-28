# How to Publish Content to Haidrun WordPress Site + LinkedIn

This guide walks you through the complete process of creating a post in the CMS frontend and having it automatically published on both the Haidrun WordPress website and LinkedIn company page.

---

## Prerequisites

Before you start, ensure:
- ✅ The backend API is running (usually at `http://localhost:5000`)
- ✅ The frontend application is running (usually at `http://localhost:5173` or `http://localhost:3000`)
- ✅ WordPress plugin is installed and configured on haidrun.com
- ✅ LinkedIn API credentials are configured in backend environment
- ✅ All required environment variables are set (see `MULTI_CHANNEL_SETUP.md`)

---

## Step-by-Step Publishing Guide

### Step 1: Open the CMS Frontend

1. Open your web browser
2. Navigate to your frontend URL (e.g., `http://localhost:5173`)
3. You should see the CMS dashboard

### Step 2: Navigate to Create New Content

1. Click on **"Create Content"** or **"New Post"** button
2. The ContentForm will open with several sections:
   - AI Writing Tools (purple panel at top)
   - Multi-Channel Publishing (blue/green panel)
   - Main content form (white card)

### Step 3: Configure Multi-Channel Publishing Settings

**Before writing your content**, configure where it will be published:

1. **Select Company Brand**
   - Look for the "Company Brand" dropdown
   - Select **"Haidrun"** from the dropdown
   - This ensures Haidrun-specific branding and hashtags are used

2. **Choose Publishing Destinations**
   - Find the "Publish To" section with checkboxes
   - ✅ Check **"Haidrun Website (WordPress)"**
   - ✅ Check **"LinkedIn Company Page"**

3. **Confirmation Message**
   - You should see a blue info box appear stating:
   - *"Content will be published to both Haidrun website and LinkedIn company page with optimized formatting for each platform."*

### Step 4: Write Your Content

1. **Enter a Title**
   - Type your post title in the "Title" field
   - Example: "5 Ways AI is Transforming Modern Business"
   - The slug will auto-generate (e.g., `5-ways-ai-is-transforming-modern-business`)

2. **Write Content**
   - Scroll to the "Content" textarea
   - Type or paste your blog post content
   - You can use the AI Writing Tools if needed:
     - Click **"Content Generator"** to create AI-generated content
     - Click **"Writing Assistant"** for suggestions and improvements
     - Click **"Content Adaptation"** to adapt content for different platforms

3. **Set Status**
   - Choose **"Published"** from the Status dropdown
   - (Use "Draft" if you want to save without publishing)

### Step 5: Submit and Publish

1. **Review Your Settings**
   - Title: ✓ Filled in
   - Content: ✓ Written
   - Status: ✓ Set to "Published"
   - Company Brand: ✓ Set to "Haidrun"
   - WordPress checkbox: ✓ Checked
   - LinkedIn checkbox: ✓ Checked

2. **Click "Create Content" Button**
   - The button is located at the bottom right of the form
   - You'll see a loading spinner: "Creating..."

### Step 6: What Happens Behind the Scenes

When you click submit, the system performs these actions automatically:

#### Backend Processing (Happens in seconds)

1. **Content Saved to Database**
   - Your content is saved to Supabase with status "published"
   - A unique content ID is generated

2. **WordPress Publishing**
   - Backend sends secure webhook to `https://haidrun.com/wp-json/wp-headless-cms-bridge/v1/webhook/content`
   - WordPress plugin receives and authenticates the webhook (HMAC SHA256)
   - Plugin creates a new post on the Haidrun website
   - Post appears immediately on haidrun.com

3. **LinkedIn Scheduling**
   - Content is formatted for LinkedIn with Haidrun branding
   - Professional hashtags are added: `#TeamHaidrun #HaidrunInnovation`
   - Post is scheduled for optimal timing: **12:00 PM UTC on next business day**
   - Social Media Orchestrator queues the post for publishing

### Step 7: Verify Publication

#### Check WordPress Publication (Immediate)

1. Open your browser to `https://haidrun.com`
2. Navigate to the blog section
3. Your post should appear immediately with:
   - Full title and content
   - Proper formatting
   - Published status

#### Check LinkedIn Publication (Scheduled)

1. LinkedIn posts are scheduled for optimal timing (12PM UTC, business days)
2. The post will appear on the Haidrun LinkedIn company page at the scheduled time
3. Content will include:
   - Your post content
   - Haidrun-specific professional formatting
   - Hashtags: #TeamHaidrun #HaidrunInnovation
   - Optimized for LinkedIn's algorithm

#### Monitor Publishing Status (Optional)

You can check the status using these API endpoints:

```bash
# Check overall service status
curl http://localhost:5000/api/v1/content-publishing/status

# Check pending LinkedIn posts
curl http://localhost:5000/api/v1/content-publishing/pending

# Check publishing statistics
curl http://localhost:5000/api/v1/content-publishing/orchestrator/stats
```

---

## Example: Complete Publishing Flow

### Frontend Form Configuration:
```
Title: "How Haidrun Drives Innovation in Tech"
Content: "At Haidrun, we believe that innovation is the key..."
Status: Published
Company Brand: Haidrun
✓ Publish to Haidrun Website (WordPress)
✓ Publish to LinkedIn Company Page
```

### Results:

**WordPress (Immediate):**
- Post published to: `https://haidrun.com/blog/how-haidrun-drives-innovation-in-tech`
- Visible to all website visitors
- Full content with formatting preserved

**LinkedIn (Scheduled for 12PM UTC tomorrow):**
```
How Haidrun Drives Innovation in Tech

At Haidrun, we believe that innovation is the key...

#TeamHaidrun #HaidrunInnovation #Innovation #TechLeadership
```

---

## What If I Only Want to Publish to One Platform?

### WordPress Only:
1. Select "Haidrun" as Company Brand
2. ✓ Check **"Haidrun Website (WordPress)"**
3. ✗ Leave **"LinkedIn Company Page"** unchecked
4. Submit form

### LinkedIn Only:
1. Select "Haidrun" as Company Brand
2. ✗ Leave **"Haidrun Website (WordPress)"** unchecked
3. ✓ Check **"LinkedIn Company Page"**
4. Submit form

### Neither (Save to CMS Only):
1. Leave both checkboxes unchecked
2. Content will only be saved in the CMS database
3. You can publish to platforms later

---

## Troubleshooting

### "Content published but didn't appear on WordPress"

**Possible causes:**
- WordPress webhook URL is incorrect
- WordPress plugin is not active
- Webhook authentication failed

**Solutions:**
1. Check backend logs for webhook response
2. Verify WordPress plugin is active at haidrun.com
3. Check webhook secret matches in both backend and WordPress
4. Test webhook endpoint manually

### "LinkedIn post not scheduled"

**Possible causes:**
- LinkedIn API credentials missing
- Company page permissions not configured
- LinkedIn organization URN incorrect

**Solutions:**
1. Verify LinkedIn environment variables in backend
2. Check `social_accounts` table has Haidrun LinkedIn account
3. Review backend logs for LinkedIn API errors
4. Ensure LinkedIn app has company page permissions

### "Form submission error"

**Possible causes:**
- Backend API not running
- Network connection issue
- Missing required fields

**Solutions:**
1. Verify backend is running at correct URL
2. Check browser console for error messages
3. Ensure Title and Content fields are filled
4. Try refreshing the page

---

## Tips for Best Results

### Content Quality
- Write clear, engaging titles (60-80 characters ideal)
- Keep content well-formatted with paragraphs
- Use professional language aligned with Haidrun's brand voice

### Platform Optimization
- **WordPress**: Content can be longer, more detailed articles
- **LinkedIn**: Keep it professional, engaging, and actionable
- The system automatically optimizes formatting for each platform

### Timing
- WordPress publishes immediately
- LinkedIn posts are optimized for business hours (12PM UTC)
- Consider time zones of your target audience

### Monitoring
- Check WordPress immediately after publishing
- LinkedIn posts appear at scheduled time
- Use monitoring endpoints to track status

---

## Need Help?

- **Setup Issues**: See `MULTI_CHANNEL_SETUP.md`
- **Technical Details**: See `backend/api/src/services/ContentPublishingService.ts`
- **Testing**: Run `node test-multi-channel-publishing.js`
- **API Documentation**: Check backend route files

---

**Last Updated:** January 2025
**Version:** 1.0 (Multi-Channel Publishing Complete)
