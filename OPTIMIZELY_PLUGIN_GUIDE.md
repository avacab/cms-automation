# Optimizely CMS Plugin - Complete Setup & Usage Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Authentication Setup](#authentication-setup)
6. [Usage Guide](#usage-guide)
7. [A/B Testing Workflow](#ab-testing-workflow)
8. [API Reference](#api-reference)
9. [Troubleshooting](#troubleshooting)
10. [Best Practices](#best-practices)

## Overview

The Optimizely CMS Plugin provides AI-powered content creation with native A/B testing and personalization capabilities. It integrates seamlessly with Optimizely CMS 12 to enable:

- **AI Content Generation**: Create blog posts with advanced AI assistance
- **A/B Testing**: Generate and test multiple content variations automatically  
- **Statistical Analysis**: Real-time experiment results with confidence intervals
- **Enterprise Authentication**: Secure OAuth 2.0/JWT integration
- **Professional UI**: Multi-variation editor with side-by-side comparison

## Prerequisites

### System Requirements
- **Node.js**: 18+ 
- **TypeScript**: 5+
- **Optimizely CMS**: Version 12+ (SaaS or PaaS)
- **OpenAI API**: Account with API access

### Optimizely Requirements
- Optimizely CMS 12 instance with API access
- Content Management API permissions
- OAuth 2.0 application credentials (or API keys)

### Environment Setup
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection for API communications
- Development/staging environment recommended for initial setup

## Installation

### 1. Clone the Repository
```bash
git clone https://github.com/your-org/cms-automation.git
cd cms-automation
```

### 2. Install Dependencies

**Backend Installation:**
```bash
# Install main project dependencies
npm install

# Install Optimizely integration dependencies
cd optimizely-integration
npm install
cd ..

# Install AI writing assistant dependencies
cd backend/ai-writing-assistant
npm install
cd ../..

# Install API dependencies
cd backend/api
npm install
cd ../..
```

**Frontend Installation:**
```bash
cd frontend
npm install
cd ..
```

### 3. Build the Project
```bash
# Build Optimizely integration
cd optimizely-integration
npm run build
cd ..

# Build AI writing assistant
cd backend/ai-writing-assistant
npm run build
cd ../..

# Build frontend
cd frontend
npm run build
cd ..
```

## Configuration

### 1. Environment Variables

Create `.env` files in the following locations:

**Root `.env`:**
```bash
# OpenAI Configuration
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_BASE_URL=https://api.openai.com/v1
AI_MODEL=gpt-3.5-turbo

# Database Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/cms_automation

# Application Settings
NODE_ENV=development
PORT=3000
API_PORT=5000
```

**Backend API `.env` (`backend/api/.env`):**
```bash
# Optimizely Configuration
OPTIMIZELY_CLIENT_ID=your_optimizely_client_id
OPTIMIZELY_CLIENT_SECRET=your_optimizely_client_secret
OPTIMIZELY_API_ENDPOINT=https://api.optimizely.com
OPTIMIZELY_CMS_ENDPOINT=https://your-cms.optimizely.com

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# API Configuration
CORS_ORIGIN=http://localhost:3000
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**AI Writing Assistant `.env` (`backend/ai-writing-assistant/.env`):**
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-3.5-turbo
MAX_TOKENS=2000
TEMPERATURE=0.7
PORT=5003
```

### 2. Configuration Files

**Optimizely Plugin Configuration (`optimizely-integration/config.json`):**
```json
{
  "auth": {
    "method": "oauth2_client_credentials",
    "tokenRefreshBuffer": 300,
    "retryAttempts": 3
  },
  "content": {
    "defaultContentType": "BlogPost",
    "autoPublish": false,
    "enableVersioning": true
  },
  "experiments": {
    "defaultTrafficAllocation": 100,
    "minSampleSize": 100,
    "confidenceLevel": 95,
    "autoStopCriteria": {
      "maxDuration": 30,
      "minConversions": 50,
      "statisticalSignificance": 0.95
    }
  },
  "sync": {
    "direction": "cms_to_optimizely",
    "batchSize": 5,
    "queueProcessingInterval": 5000,
    "retryDelays": [1000, 5000, 15000]
  }
}
```

## Authentication Setup

### Option 1: OAuth 2.0 Client Credentials (Recommended)

1. **Create OAuth Application in Optimizely:**
   - Navigate to Optimizely Admin → API Clients
   - Click "Create New API Client"
   - Set Client Type to "Machine-to-Machine"
   - Grant required scopes: `cms:read`, `cms:write`, `experiments:read`, `experiments:write`
   - Note down `Client ID` and `Client Secret`

2. **Configure Application:**
   ```bash
   OPTIMIZELY_CLIENT_ID=your_client_id_here
   OPTIMIZELY_CLIENT_SECRET=your_client_secret_here
   ```

### Option 2: API Keys (Alternative)

1. **Generate API Keys:**
   - Navigate to Optimizely Admin → API Keys
   - Create new API key with appropriate permissions
   - Copy the generated key

2. **Configure Application:**
   ```bash
   OPTIMIZELY_API_KEY=your_api_key_here
   ```

### Verify Authentication

Test your authentication setup:
```bash
curl -X POST http://localhost:5000/api/optimizely/initialize \
  -H "Content-Type: application/json" \
  -d '{
    "clientId": "your_client_id",
    "clientSecret": "your_client_secret",
    "apiEndpoint": "https://api.optimizely.com",
    "cmsEndpoint": "https://your-cms.optimizely.com"
  }'
```

## Usage Guide

### 1. Starting the Application

**Development Mode:**
```bash
# Start all services in development
npm run dev

# Or start services individually:

# Backend API
cd backend/api && npm run dev

# AI Writing Assistant
cd backend/ai-writing-assistant && npm run dev

# Frontend
cd frontend && npm run dev
```

**Production Mode:**
```bash
# Build and start all services
npm run build
npm start
```

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000
- **AI Service**: http://localhost:5003

### 3. Initialize Optimizely Connection

1. Open the application in your browser
2. Navigate to "Settings" → "Integrations"
3. Click "Add Optimizely Integration"
4. Enter your credentials:
   - **Client ID**: Your OAuth client ID
   - **Client Secret**: Your OAuth client secret
   - **API Endpoint**: https://api.optimizely.com
   - **CMS Endpoint**: Your Optimizely CMS URL
5. Click "Connect" and verify the connection

### 4. Create Your First Blog Post

1. **Navigate to Content Creation:**
   - Click "Create Content" → "Blog Post"
   - Select "Optimizely" as the target platform

2. **Enter Content Details:**
   - **Topic**: Enter your blog post topic (e.g., "Holiday Shopping Tips")
   - **Target Audience**: Optional audience specification
   - **Keywords**: SEO keywords to include
   - **Tone**: Professional, casual, conversational, etc.

3. **AI Generation:**
   - Click "Generate Content" to create initial blog post
   - Review and edit the generated content as needed
   - Use the AI Writing Assistant for suggestions and improvements

## A/B Testing Workflow

### 1. Creating Content Variations

**Method 1: Automatic AI Generation**
1. Create your base blog post content
2. Navigate to "A/B Testing" tab
3. Click "Generate AI Variations"
4. Select variation strategy:
   - **Audience**: Different customer segments
   - **Tone**: Professional vs. casual
   - **Structure**: Bullet points vs. paragraphs
   - **CTA**: Different call-to-action approaches
5. Review generated variations and customize as needed

**Method 2: Manual Variation Creation**
1. Create your control (original) content
2. Click "Add Variation" 
3. Manually edit title, content, and excerpt for each variation
4. Set traffic allocation percentages

### 2. Experiment Configuration

1. **Basic Settings:**
   - **Experiment Name**: Descriptive name (e.g., "Holiday Tips - Audience Test")
   - **Description**: Hypothesis and goals
   - **Traffic Allocation**: Percentage of total traffic (25%, 50%, 75%, 100%)

2. **Success Metrics:**
   - Click "Add Metric" to define success criteria
   - **Conversion Metrics**: Newsletter signups, downloads, purchases
   - **Engagement Metrics**: Time on page, scroll depth, social shares
   - **Revenue Metrics**: Sales, upgrade conversions

3. **Advanced Settings:**
   - **Audience Conditions**: Target specific user segments
   - **Start/End Dates**: Schedule experiment duration
   - **Statistical Settings**: Confidence level, minimum sample size

### 3. Running Experiments

1. **Start Experiment:**
   - Review all settings and variations
   - Click "Create & Start Experiment"
   - Monitor the experiment dashboard for real-time results

2. **Monitor Performance:**
   - Navigate to "Results" tab to view:
     - **Traffic Distribution**: Visitors per variation
     - **Conversion Rates**: Success metric performance
     - **Statistical Significance**: Confidence levels and p-values
     - **Winning Variation**: AI-recommended best performer

3. **Complete Experiment:**
   - Wait for statistical significance (recommended 95% confidence)
   - Review final results and winner recommendation
   - Click "Complete Experiment" and select winning variation
   - Deploy winner to all traffic

### 4. Results Analysis

**Key Metrics to Monitor:**
- **Conversion Rate**: Primary success metric performance
- **Confidence Interval**: Range of expected true conversion rate
- **Relative Lift**: Percentage improvement over control
- **P-Value**: Statistical significance indicator (< 0.05 is significant)
- **Sample Size**: Number of visitors per variation

**Statistical Significance Indicators:**
- ✅ **Green**: Statistically significant winner (p < 0.05)
- ⚠️ **Yellow**: Trending but not yet significant
- ⭕ **Red**: No significant difference detected

## API Reference

### Authentication Endpoints

```javascript
// Initialize Optimizely connection
POST /api/optimizely/initialize
{
  "clientId": "string",
  "clientSecret": "string", 
  "apiEndpoint": "string",
  "cmsEndpoint": "string"
}

// Test connection
GET /api/optimizely/connection/test

// Get connection stats
GET /api/optimizely/stats
```

### Content Management Endpoints

```javascript
// Create blog post
POST /api/optimizely/blog/create
{
  "title": "string",
  "content": "string",
  "excerpt": "string",
  "topic": "string",
  "keywords": ["string"],
  "brandVoiceId": "string"
}

// Generate content variations
POST /api/optimizely/generate-variations
{
  "baseContent": {
    "title": "string",
    "content": "string",
    "excerpt": "string"
  },
  "variationCount": 2,
  "strategy": "audience|tone|structure|cta",
  "brandVoiceId": "string"
}

// Bulk sync content
POST /api/optimizely/sync/bulk
{
  "contents": [
    {
      "title": "string",
      "content": "string",
      "type": "blog_post"
    }
  ]
}
```

### Experiment Management Endpoints

```javascript
// Create experiment
POST /api/optimizely/experiments/create
{
  "name": "string",
  "description": "string",
  "variations": [
    {
      "id": "string",
      "name": "string",
      "title": "string",
      "content": "string",
      "trafficAllocation": 50
    }
  ],
  "metrics": [
    {
      "name": "string",
      "type": "conversion|revenue|engagement",
      "eventName": "string"
    }
  ]
}

// Get experiment details
GET /api/optimizely/experiments/{experimentId}

// Start experiment
POST /api/optimizely/experiments/{experimentId}/start

// Stop experiment
POST /api/optimizely/experiments/{experimentId}/stop

// Get experiment results
GET /api/optimizely/experiments/{experimentId}/results

// List all experiments
GET /api/optimizely/experiments?status=running&limit=10

// Record experiment event
POST /api/optimizely/experiments/{experimentId}/events
{
  "variationId": "string",
  "eventType": "visitor|conversion|revenue",
  "value": 100
}
```

## Troubleshooting

### Common Installation Issues

**Issue: Node.js version incompatibility**
```bash
# Check Node.js version
node --version

# Should be 18+. If not, update Node.js:
# Using nvm (recommended):
nvm install 18
nvm use 18

# Or download from https://nodejs.org
```

**Issue: TypeScript compilation errors**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Rebuild TypeScript projects
npm run build
```

**Issue: Port conflicts**
```bash
# Check what's running on ports
lsof -i :3000  # Frontend
lsof -i :5000  # API
lsof -i :5003  # AI Service

# Kill processes or change ports in .env
PORT=3001
API_PORT=5001
```

### Authentication Issues

**Issue: "Authentication failed" error**

1. **Verify Credentials:**
   - Double-check Client ID and Client Secret
   - Ensure credentials are for the correct Optimizely instance
   - Verify scopes include required permissions

2. **Check API Endpoints:**
   - API Endpoint should be: `https://api.optimizely.com`  
   - CMS Endpoint should be your specific URL: `https://your-cms.optimizely.com`

3. **Test Manual Authentication:**
   ```bash
   curl -X POST https://api.optimizely.com/oauth2/token \
     -H "Authorization: Basic $(echo -n 'CLIENT_ID:CLIENT_SECRET' | base64)" \
     -H "Content-Type: application/x-www-form-urlencoded" \
     -d "grant_type=client_credentials&scope=cms:read cms:write"
   ```

**Issue: Token expiration errors**

The plugin automatically refreshes tokens, but if you see persistent token issues:
1. Check system clock synchronization
2. Verify token refresh buffer setting (default 300 seconds)
3. Monitor logs for refresh attempts

### Content Creation Issues

**Issue: AI content generation fails**

1. **Check OpenAI Configuration:**
   ```bash
   # Verify API key
   curl https://api.openai.com/v1/models \
     -H "Authorization: Bearer $OPENAI_API_KEY"
   ```

2. **Review Rate Limits:**
   - OpenAI has rate limits based on your plan
   - Implement request queuing if hitting limits
   - Consider upgrading OpenAI plan for higher limits

3. **Content Length Issues:**
   - Large content may exceed token limits
   - Break into smaller chunks
   - Adjust `maxTokens` setting

**Issue: Content sync failures**

1. **Check Optimizely Permissions:**
   - Verify API client has content creation permissions
   - Test with simple content first
   - Check Optimizely CMS logs for errors

2. **Review Content Type Mapping:**
   - Ensure target content types exist in Optimizely
   - Verify field mappings are correct
   - Check for required fields

### Experiment Issues

**Issue: Variations not displaying properly**

1. **Check Traffic Allocation:**
   - Ensure allocations sum to 100%
   - Verify experiment is in "running" state
   - Check visitor assignment logic

2. **Verify Event Tracking:**
   ```javascript
   // Test event recording
   fetch('/api/optimizely/experiments/EXP_ID/events', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       variationId: 'variation_1',
       eventType: 'visitor'
     })
   });
   ```

**Issue: Statistical significance not reached**

1. **Increase Sample Size:**
   - Run experiment longer
   - Increase traffic allocation
   - Lower significance threshold (not recommended)

2. **Check Effect Size:**
   - Small differences require larger samples
   - Consider practical significance vs. statistical
   - Review conversion rate differences

### Performance Issues

**Issue: Slow API responses**

1. **Database Optimization:**
   ```sql
   -- Add indexes for common queries
   CREATE INDEX idx_experiments_status ON experiments(status);
   CREATE INDEX idx_content_created_at ON content(created_at);
   ```

2. **Enable Caching:**
   - Configure Redis for session/token caching
   - Implement API response caching
   - Use CDN for static assets

3. **Monitor Resource Usage:**
   ```bash
   # Check memory usage
   free -h
   
   # Check CPU usage  
   top
   
   # Check disk space
   df -h
   ```

## Best Practices

### Content Creation Best Practices

1. **AI Prompt Engineering:**
   - Be specific with content requirements
   - Include target audience and tone
   - Provide context and constraints
   - Use brand voice guidelines

2. **Variation Strategy:**
   - Test one element at a time for clarity
   - Ensure variations are meaningfully different
   - Consider user psychology and motivation
   - A/B test headlines, CTAs, and structure separately

3. **SEO Optimization:**
   - Include target keywords in variations
   - Maintain consistent meta descriptions
   - Test different title structures
   - Monitor search rankings during experiments

### Experiment Design Best Practices

1. **Statistical Guidelines:**
   - Run experiments for at least 1-2 weeks
   - Aim for minimum 100 conversions per variation
   - Don't peek at results too early
   - Plan for 95% confidence level

2. **Sample Size Planning:**
   ```javascript
   // Estimate required sample size
   function calculateSampleSize(
     baseConversionRate,
     minimumDetectableEffect,
     confidenceLevel = 0.95,
     power = 0.8
   ) {
     // Simplified calculation
     const alpha = 1 - confidenceLevel;
     const beta = 1 - power;
     const zAlpha = 1.96; // for 95% confidence
     const zBeta = 0.84;  // for 80% power
     
     const p1 = baseConversionRate;
     const p2 = baseConversionRate * (1 + minimumDetectableEffect);
     const pPooled = (p1 + p2) / 2;
     
     const sampleSize = (
       (zAlpha * Math.sqrt(2 * pPooled * (1 - pPooled)) + 
        zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2
     ) / ((p2 - p1) ** 2);
     
     return Math.ceil(sampleSize);
   }
   
   // Example: 5% base rate, want to detect 20% improvement
   const sampleSize = calculateSampleSize(0.05, 0.20);
   console.log(`Required sample size per variation: ${sampleSize}`);
   ```

3. **Experiment Hygiene:**
   - Document hypothesis before starting
   - Set success criteria upfront  
   - Avoid multiple simultaneous experiments on same content
   - Archive completed experiments

### Security Best Practices

1. **Credential Management:**
   - Store credentials in environment variables
   - Use separate credentials for dev/staging/prod
   - Rotate API keys regularly
   - Monitor for credential leaks in logs

2. **Access Control:**
   - Implement role-based permissions
   - Use principle of least privilege
   - Audit API access regularly
   - Enable two-factor authentication where possible

3. **Data Protection:**
   - Encrypt sensitive data at rest
   - Use HTTPS for all communications
   - Implement request rate limiting
   - Log security events

### Monitoring and Maintenance

1. **Application Monitoring:**
   ```bash
   # Set up health checks
   curl -f http://localhost:5000/api/optimizely/health || exit 1
   
   # Monitor key metrics
   - API response times
   - Error rates  
   - Token refresh success
   - Experiment completion rates
   ```

2. **Log Management:**
   - Centralize logs from all services
   - Set up alerts for error conditions
   - Monitor authentication failures
   - Track experiment performance

3. **Backup and Recovery:**
   - Regular database backups
   - Export experiment configurations
   - Document disaster recovery procedures
   - Test restoration processes

### Performance Optimization

1. **Database Optimization:**
   - Index frequently queried columns
   - Implement connection pooling
   - Use read replicas for reporting
   - Archive old experiment data

2. **API Optimization:**
   - Implement response caching
   - Use compression for large responses
   - Optimize query patterns
   - Monitor and fix N+1 queries

3. **Frontend Performance:**
   - Lazy load experiment results
   - Implement virtual scrolling for large lists
   - Optimize bundle sizes
   - Use service workers for offline capability

---

## Support and Resources

### Documentation
- **Optimizely CMS API**: https://docs.developers.optimizely.com/
- **OpenAI API**: https://platform.openai.com/docs
- **React Documentation**: https://react.dev/

### Community
- **GitHub Issues**: Report bugs and request features
- **Discord Community**: Real-time support and discussions
- **Stack Overflow**: Tag questions with `optimizely-cms-plugin`

### Professional Support
- **Enterprise Support**: Available for production deployments
- **Custom Development**: Contact us for custom integrations
- **Training Sessions**: Team training and best practices workshops

---

*This guide covers the complete setup and usage of the Optimizely CMS Plugin. For additional support or questions, please refer to our GitHub repository or contact the development team.*