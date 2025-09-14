# Development & Test Environment Strategy

## Environment Overview

### Development Environment (Local)
- **Frontend**: React/Vite at `http://localhost:3000`
- **API**: Node.js Express at `http://localhost:5000`
- **AI Service**: Node.js service at `http://localhost:5003`
- **Storage**: Local JSON files in `backend/api/data/`
- **Purpose**: Local development, rapid iteration, debugging

### Test Environment (Cloud)
- **Frontend**: Vercel deployment (static React app)
- **API**: Vercel Serverless Functions 
- **AI Service**: Vercel Serverless Functions
- **Database**: Supabase PostgreSQL
- **Storage**: Supabase Storage buckets
- **Purpose**: Testing, staging, demo, client review

---

## Phase 1: Complete Supabase Database Setup

### Step 1: Create Database Tables
**Where to run**: Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new
2. Copy SQL from: `/home/arnold/cms_automation/scripts/create-tables-manual.sql`
3. Paste and execute in Supabase SQL editor

### Step 2: Populate Sample Data
**Where to run**: `/home/arnold/cms_automation/`
```bash
cd /home/arnold/cms_automation
node scripts/populate-data.js
```

### Step 3: Verify Database Setup
**Where to run**: Any terminal
```bash
curl -s http://localhost:5000/api/v1/system/status | jq
```

---

## Phase 2: Multi-Environment Configuration

### Create Environment Files

#### Local Development (.env)
**File**: `/home/arnold/cms_automation/backend/api/.env`
```env
NODE_ENV=development
STORAGE_TYPE=local
API_URL=http://localhost:5000
AI_SERVICE_URL=http://localhost:5003
CORS_ORIGIN=http://localhost:3000
```

#### Test Environment (Vercel)
**File**: `/home/arnold/cms_automation/config/vercel-production.env`
```env
NODE_ENV=production
STORAGE_TYPE=supabase
SUPABASE_URL=https://neezcjbguizmkbyglroe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
API_URL=https://your-vercel-app.vercel.app
CORS_ORIGIN=https://your-vercel-app.vercel.app
OPENAI_API_KEY=your-openai-key
```

### Frontend Environment Configuration

#### Development (.env.local)
**File**: `/home/arnold/cms_automation/frontend/.env.local`
```env
VITE_API_URL=http://localhost:5000
VITE_ENVIRONMENT=development
```

#### Production (.env.production)  
**File**: `/home/arnold/cms_automation/frontend/.env.production`
```env
VITE_API_URL=https://your-vercel-app.vercel.app
VITE_ENVIRONMENT=production
```

---

## Phase 3: Convert Backend for Vercel Serverless

### Vercel Project Configuration

#### Create vercel.json
**File**: `/home/arnold/cms_automation/vercel.json`
```json
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/static-build",
      "config": { "distDir": "dist" }
    },
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ],
  "env": {
    "STORAGE_TYPE": "supabase",
    "NODE_ENV": "production"
  }
}
```

### API Structure Conversion

#### Main API Handler
**File**: `/home/arnold/cms_automation/api/index.js`
```javascript
// Convert Express app to Vercel function
import app from '../backend/api/src/index.js';
export default app;
```

#### Individual API Routes
**Files to create**:
- `/api/content/index.js` - Content CRUD operations
- `/api/content/[id].js` - Single content item operations  
- `/api/content-types/index.js` - Content types management
- `/api/ai/generate.js` - AI content generation
- `/api/ai/suggestions.js` - AI writing suggestions
- `/api/system/status.js` - System status and health

### Database Connection Updates

#### Serverless-Optimized Supabase Service
**File**: `/home/arnold/cms_automation/backend/api/src/services/SupabaseService.ts`
- Add connection pooling for serverless
- Optimize for cold start performance
- Add retry logic for network issues

---

## Phase 4: Frontend Deployment Preparation

### Update Vite Configuration

#### Production Build Settings
**File**: `/home/arnold/cms_automation/frontend/vite.config.ts`
```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@headlessui/react', '@heroicons/react']
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
```

### Package.json Updates

#### Frontend Build Scripts
**File**: `/home/arnold/cms_automation/frontend/package.json`
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "build:vercel": "npm run build && cp -r dist/* ../dist/"
  }
}
```

---

## Phase 5: Deployment Process

### Vercel Deployment Steps

#### 1. Prepare Repository
**Where to run**: `/home/arnold/cms_automation/`
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

#### 2. Connect to Vercel
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import GitHub repository
4. Select root directory: `/home/arnold/cms_automation`

#### 3. Configure Vercel Environment Variables
**In Vercel Dashboard** → Project Settings → Environment Variables:
```
STORAGE_TYPE=supabase
SUPABASE_URL=https://neezcjbguizmkbyglroe.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=your-openai-key-here
CORS_ORIGIN=https://your-vercel-app.vercel.app
NODE_ENV=production
```

#### 4. Deploy
- Click "Deploy" in Vercel dashboard
- Monitor build logs for errors
- Verify deployment success

---

## Phase 6: Testing & Validation

### End-to-End Testing Checklist

#### Content Management Testing
**Where to test**: Vercel deployed frontend
- [ ] Create new content item
- [ ] Edit existing content
- [ ] Delete content item
- [ ] View content list with filtering
- [ ] Content type management

#### AI Features Testing  
**Where to test**: Vercel deployed frontend
- [ ] AI content generation
- [ ] Writing suggestions
- [ ] Content adaptation
- [ ] Brand voice consistency

#### Database Testing
**Where to test**: Supabase Dashboard + Vercel frontend
- [ ] Data persistence across sessions
- [ ] Real-time updates
- [ ] File uploads to Supabase Storage
- [ ] Database queries performance

#### API Testing
**Where to test**: Terminal or Postman
```bash
# Test API endpoints
curl https://your-vercel-app.vercel.app/api/system/status
curl https://your-vercel-app.vercel.app/api/content
curl https://your-vercel-app.vercel.app/api/content-types
```

---

## Phase 7: Environment Management

### Local Development Workflow
**Where to work**: `/home/arnold/cms_automation/`

#### Start Development Environment
```bash
# Terminal 1: Start API (local JSON storage)
cd backend/api
npm run dev

# Terminal 2: Start AI Service
cd backend/ai-writing-assistant  
npm run dev

# Terminal 3: Start Frontend
cd frontend
npm run dev
```

#### Access Points
- Frontend: http://localhost:3000
- API: http://localhost:5000
- AI Service: http://localhost:5003

### Test Environment Access
- **Frontend**: https://your-vercel-app.vercel.app
- **API**: https://your-vercel-app.vercel.app/api/*
- **Database**: Supabase Dashboard
- **Logs**: Vercel Dashboard → Functions

### Environment Switching Commands

#### Switch Local to Test Supabase
**Where to run**: `/home/arnold/cms_automation/backend/api/`
```bash
cd /home/arnold/cms_automation/backend/api
NODE_ENV=supabase-test npm run dev
```

#### Deploy Updates to Test
**Where to run**: `/home/arnold/cms_automation/`
```bash
git add .
git commit -m "Update test environment"
git push origin main
# Auto-deploys to Vercel
```

---

## Troubleshooting Guide

### Common Issues

#### Vercel Function Timeout
**Solution**: Optimize database queries and add connection pooling

#### CORS Issues
**Solution**: Update CORS_ORIGIN in Vercel environment variables

#### Cold Start Performance
**Solution**: Implement connection warming and query optimization

#### Build Failures
**Solution**: Check build logs in Vercel dashboard, ensure all dependencies are in package.json

### Monitoring & Debugging

#### Vercel Function Logs
1. Go to Vercel Dashboard
2. Select your project  
3. Go to "Functions" tab
4. View real-time logs and performance metrics

#### Supabase Database Monitoring
1. Go to Supabase Dashboard
2. Select "Logs" section
3. Monitor database queries and performance

---

## Performance Optimization

### Frontend Optimization
- Bundle splitting for faster loading
- Image optimization with Vercel
- CDN caching configuration
- Progressive loading strategies

### API Optimization  
- Connection pooling for Supabase
- Query optimization and indexing
- Caching strategies for frequently accessed data
- Serverless function memory allocation

### Database Optimization
- Proper indexing on frequently queried fields
- Row Level Security (RLS) policies
- Connection pooling and query optimization
- Regular database maintenance

---

## Security Considerations

### Environment Variables
- Never commit secrets to repository
- Use Vercel environment variables for sensitive data
- Rotate API keys regularly
- Implement proper access controls

### Database Security
- Enable Row Level Security (RLS) in Supabase
- Use service role key only for server-side operations  
- Implement proper user authentication
- Regular security audits and updates

### API Security
- Rate limiting on API endpoints
- Input validation and sanitization
- CORS configuration for production domains
- HTTPS enforcement

---

## Maintenance & Updates

### Regular Tasks
- Monitor Vercel function performance
- Review Supabase database usage and costs
- Update dependencies and security patches
- Backup database and configuration

### Scaling Considerations
- Vercel function concurrency limits
- Supabase connection limits
- Database query optimization
- CDN and caching strategies

---

## Cost Management

### Vercel Costs
- Free tier: 100GB bandwidth, 100GB-hours compute
- Pro tier: $20/month for additional resources
- Monitor usage in Vercel dashboard

### Supabase Costs
- Free tier: 500MB database, 1GB storage
- Pro tier: $25/month for 8GB database, 100GB storage
- Monitor usage in Supabase dashboard

### Optimization Tips
- Optimize bundle sizes to reduce bandwidth
- Use efficient queries to minimize database usage
- Implement caching to reduce function calls
- Monitor and optimize resource usage regularly
