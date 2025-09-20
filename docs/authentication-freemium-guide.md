# Authentication, RBAC & Freemium System Guide

## Overview

This guide covers the comprehensive authentication, authorization, and freemium revenue system implemented for the CMS Automation platform. The system provides secure multi-tenant access control, role-based permissions, and subscription management with usage limits.

## Table of Contents

1. [Authentication System](#authentication-system)
2. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
3. [Freemium Revenue Model](#freemium-revenue-model)
4. [Usage Tracking & Limits](#usage-tracking--limits)
5. [Frontend Integration](#frontend-integration)
6. [WordPress Plugin Integration](#wordpress-plugin-integration)
7. [API Reference](#api-reference)
8. [Database Schema](#database-schema)
9. [Security Features](#security-features)
10. [Examples & Use Cases](#examples--use-cases)

---

## Authentication System

### JWT-Based Authentication

The system uses JSON Web Tokens (JWT) for secure authentication with access tokens (15 minutes) and refresh tokens (7 days).

#### User Registration

```bash
# Register a new user with organization
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe",
    "organizationName": "Acme Corp"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "emailVerified": false
    },
    "organization": {
      "id": "org-uuid",
      "name": "Acme Corp",
      "slug": "acme-corp",
      "planType": "free"
    },
    "tokens": {
      "accessToken": "eyJ...",
      "refreshToken": "eyJ..."
    }
  }
}
```

#### User Login

```bash
# Login with email and password
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "organizationId": "optional-org-id"
  }'
```

#### Token Refresh

```bash
# Refresh access token
curl -X POST http://localhost:5000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "eyJ..."
  }'
```

#### Get Current User

```bash
# Get authenticated user info
curl -X GET http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer eyJ..."
```

---

## Role-Based Access Control (RBAC)

### Available Roles

| Role | Description | Capabilities |
|------|-------------|--------------|
| **Owner** | Organization owner | Full administrative access, billing management |
| **Admin** | Administrator | User management, content management, no billing |
| **Editor** | Content editor | Create, edit, delete content and media |
| **Viewer** | Read-only user | View content and organization data |

### Permission System

Permissions follow the pattern: `resource.action`

#### Core Permissions

```javascript
// Content Types
'content_types.create'
'content_types.read'
'content_types.update'
'content_types.delete'
'content_types.manage'

// Content Items
'content_items.create'
'content_items.read'
'content_items.update'
'content_items.delete'
'content_items.publish'
'content_items.manage'

// Media Files
'media_files.create'
'media_files.read'
'media_files.update'
'media_files.delete'
'media_files.manage'

// Organization
'organization.read'
'organization.update'
'organization.manage'
'organization.billing'

// Users
'users.invite'
'users.read'
'users.update'
'users.remove'
'users.manage'
```

### Managing Roles & Permissions

#### Get Organization Members

```bash
curl -X GET http://localhost:5000/api/v1/rbac/members \
  -H "Authorization: Bearer eyJ..."
```

#### Update User Role

```bash
curl -X PUT http://localhost:5000/api/v1/rbac/members/user-id/role \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "role": "editor"
  }'
```

#### Check User Permissions

```bash
curl -X GET http://localhost:5000/api/v1/rbac/check-permission/content_items.create \
  -H "Authorization: Bearer eyJ..."
```

---

## Freemium Revenue Model

### Subscription Plans

| Plan | Price | Content Types | Content Items | Media Files | AI Requests | API Calls |
|------|-------|---------------|---------------|-------------|-------------|-----------|
| **Free** | $0/month | 1 | 10 | 5 | 10/month | 100/month |
| **Pro** | $29/month | 10 | 1,000 | 100 | 500/month | 10,000/month |
| **Enterprise** | $99/month | Unlimited | Unlimited | Unlimited | Unlimited | Unlimited |

### Billing Operations

#### Get Available Plans

```bash
curl -X GET http://localhost:5000/api/v1/billing/plans
```

#### Get Current Subscription

```bash
curl -X GET http://localhost:5000/api/v1/billing/subscription \
  -H "Authorization: Bearer eyJ..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "subscription": {
      "id": "sub-uuid",
      "organizationId": "org-uuid",
      "planType": "pro",
      "status": "active",
      "currentPeriodStart": "2024-01-01T00:00:00Z",
      "currentPeriodEnd": "2024-02-01T00:00:00Z"
    },
    "plan": {
      "id": "pro",
      "name": "Pro Plan",
      "price": 2900,
      "limits": {
        "content_types": 10,
        "content_items": 1000,
        "media_files": 100,
        "ai_requests_per_month": 500,
        "api_calls_per_month": 10000
      }
    },
    "usage": {
      "content_types": 3,
      "content_items": 45,
      "media_files": 12,
      "ai_requests": 23
    }
  }
}
```

#### Create Checkout Session (Upgrade Plan)

```bash
curl -X POST http://localhost:5000/api/v1/billing/checkout \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "pro"
  }'
```

#### Create Billing Portal Session

```bash
curl -X POST http://localhost:5000/api/v1/billing/portal \
  -H "Authorization: Bearer eyJ..."
```

#### Cancel Subscription

```bash
curl -X POST http://localhost:5000/api/v1/billing/cancel \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "cancelAtPeriodEnd": true
  }'
```

---

## Usage Tracking & Limits

### Get Usage Statistics

```bash
curl -X GET http://localhost:5000/api/v1/billing/usage \
  -H "Authorization: Bearer eyJ..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "plan": {
      "id": "pro",
      "name": "Pro Plan"
    },
    "usage": {
      "content_types": 3,
      "content_items": 45,
      "media_files": 12,
      "ai_requests": 23,
      "api_calls": 1250
    },
    "limits": {
      "content_types": 10,
      "content_items": 1000,
      "media_files": 100,
      "ai_requests_per_month": 500,
      "api_calls_per_month": 10000
    },
    "usagePercentages": {
      "content_types": 30,
      "content_items": 4.5,
      "media_files": 12,
      "ai_requests": 4.6,
      "api_calls": 12.5
    }
  }
}
```

### Automatic Limit Enforcement

When creating content that would exceed limits:

```bash
curl -X POST http://localhost:5000/api/v1/content \
  -H "Authorization: Bearer eyJ..." \
  -H "Content-Type: application/json" \
  -d '{
    "content": {
      "title": "New Article",
      "content": "Article content..."
    }
  }'
```

**Limit Exceeded Response:**
```json
{
  "success": false,
  "error": {
    "message": "Usage limit reached for content_items. Please upgrade your plan.",
    "code": "USAGE_LIMIT_EXCEEDED",
    "metricType": "content_items",
    "currentUsage": 10,
    "limit": 10,
    "planType": "free"
  }
}
```

---

## Frontend Integration

### React Authentication Context

```jsx
import { AuthProvider, useAuth } from './contexts/AuthContext';

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

function AppContent() {
  const { isAuthenticated, user, organization } = useAuth();
  
  return (
    <div>
      {isAuthenticated ? (
        <div>
          Welcome {user.firstName}! 
          Organization: {organization.name}
        </div>
      ) : (
        <AuthPage />
      )}
    </div>
  );
}
```

### Protected Routes

```jsx
import { ProtectedRoute } from './components/auth/ProtectedRoute';

<Routes>
  {/* Public routes */}
  <Route path="/" element={<LandingPage />} />
  <Route path="/auth" element={<AuthPage />} />
  
  {/* Protected routes */}
  <Route 
    path="/dashboard" 
    element={
      <ProtectedRoute>
        <Dashboard />
      </ProtectedRoute>
    } 
  />
  
  {/* Permission-based routes */}
  <Route 
    path="/content" 
    element={
      <ProtectedRoute requiredPermissions={['content_items.read']}>
        <ContentPage />
      </ProtectedRoute>
    } 
  />
  
  {/* Role-based routes */}
  <Route 
    path="/admin" 
    element={
      <ProtectedRoute requiredRoles={['owner', 'admin']}>
        <AdminPage />
      </ProtectedRoute>
    } 
  />
</Routes>
```

### Authentication Hook Usage

```jsx
function ContentEditor() {
  const { hasPermission, hasRole, organization } = useAuth();
  
  const canCreateContent = hasPermission('content_items.create');
  const canManageUsers = hasRole(['owner', 'admin']);
  const isFreePlan = organization.planType === 'free';
  
  return (
    <div>
      {canCreateContent && (
        <button disabled={isFreePlan}>
          Create Content {isFreePlan && '(Upgrade to Pro)'}
        </button>
      )}
      
      {canManageUsers && (
        <UserManagementPanel />
      )}
    </div>
  );
}
```

---

## WordPress Plugin Integration

### Plugin Authentication

```php
// Initialize the plugin client
$client = new CMS_Automation_API_Client();

// Authenticate with CMS
$auth_result = $client->authenticate(
    'user@example.com',
    'password123',
    'optional-organization-id'
);

if ($auth_result['success']) {
    echo 'Authentication successful!';
    
    // Client is now authenticated for all API calls
    $content = $client->create_content(array(
        'title' => 'WordPress Post',
        'content' => 'Content from WordPress',
        'status' => 'published'
    ));
} else {
    echo 'Authentication failed: ' . $auth_result['message'];
}
```

### Automatic Token Management

```php
// The plugin automatically handles token refresh
$client = new CMS_Automation_API_Client();

// If stored tokens exist, they're loaded automatically
if ($client->is_authenticated()) {
    // Make API calls - tokens refresh automatically if needed
    $response = $client->get_writing_suggestions('Content to analyze');
} else {
    // Redirect to authentication
    wp_redirect('/wp-admin/admin.php?page=cms-automation-settings');
}
```

### WordPress Hooks Integration

```php
// Sync WordPress posts to CMS automatically
add_action('save_post', function($post_id) {
    $client = new CMS_Automation_API_Client();
    
    if ($client->is_authenticated()) {
        $post = get_post($post_id);
        $client->create_content(array(
            'title' => $post->post_title,
            'content' => $post->post_content,
            'status' => $post->post_status === 'publish' ? 'published' : 'draft'
        ));
    }
});
```

---

## API Reference

### Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/auth/register` | Register new user with organization |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout and revoke tokens |
| GET | `/api/v1/auth/me` | Get current user profile |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with token |

### RBAC Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/rbac/roles` | Get all roles and permissions |
| GET | `/api/v1/rbac/members` | Get organization members |
| PUT | `/api/v1/rbac/members/:userId/role` | Update user role |
| GET | `/api/v1/rbac/check-permission/:permission` | Check user permission |
| GET | `/api/v1/rbac/my-permissions` | Get current user permissions |

### Billing Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/billing/plans` | Get available subscription plans |
| GET | `/api/v1/billing/subscription` | Get current subscription |
| POST | `/api/v1/billing/checkout` | Create Stripe checkout session |
| POST | `/api/v1/billing/portal` | Create billing portal session |
| POST | `/api/v1/billing/cancel` | Cancel subscription |
| GET | `/api/v1/billing/usage` | Get usage statistics |
| POST | `/api/v1/billing/webhook` | Stripe webhook handler |

---

## Database Schema

### Key Tables

#### Users Table
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Organizations Table
```sql
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    plan_type VARCHAR(20) DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Organization Members Table
```sql
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    user_id UUID REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'viewer',
    is_active BOOLEAN DEFAULT true,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Subscriptions Table
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    stripe_subscription_id VARCHAR(255) UNIQUE,
    plan_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### Usage Metrics Table
```sql
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID REFERENCES organizations(id),
    metric_type VARCHAR(50) NOT NULL,
    current_usage INTEGER DEFAULT 0,
    period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    period_end TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 month'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Security Features

### 🔐 **Multi-layered Security**

1. **JWT Token Security**
   - Short-lived access tokens (15 minutes)
   - Secure refresh tokens (7 days)
   - Token rotation on refresh

2. **Password Security**
   - BCrypt hashing with salt rounds
   - Password strength requirements
   - Secure password reset flow

3. **Row Level Security (RLS)**
   - Organization-scoped data access
   - User permission-based policies
   - Database-level security enforcement

4. **API Security**
   - Rate limiting per endpoint
   - Request validation and sanitization
   - CORS configuration
   - Helmet.js security headers

### 🛡️ **Access Control**

1. **Role-Based Authorization**
   - Hierarchical role system
   - Fine-grained permissions
   - Resource-level access control

2. **Multi-tenant Isolation**
   - Complete data separation
   - Organization-scoped queries
   - Secure context switching

---

## Examples & Use Cases

### Use Case 1: Content Agency with Multiple Clients

```javascript
// Agency owner creates client organizations
const clientOrgs = [
  { name: "Client A Corp", plan: "pro" },
  { name: "Client B LLC", plan: "enterprise" }
];

// Invite client users with appropriate roles
await inviteUser({
  email: "client-admin@clienta.com",
  organizationId: "client-a-org-id",
  role: "admin"
});

// Content editors work within client boundaries
const contentItems = await getContent({
  organizationId: "client-a-org-id",
  filters: { status: "published" }
});
```

### Use Case 2: Freemium SaaS with Usage Limits

```javascript
// Free user hitting limits
try {
  await createContent({
    title: "New Article",
    content: "Content..."
  });
} catch (error) {
  if (error.code === 'USAGE_LIMIT_EXCEEDED') {
    // Show upgrade prompt
    showUpgradeModal({
      currentPlan: 'free',
      suggestedPlan: 'pro',
      limitType: error.metricType
    });
  }
}

// Track AI usage for billing
await trackUsage({
  organizationId: "org-id",
  metricType: "ai_requests",
  increment: 1
});
```

### Use Case 3: Enterprise with Custom Permissions

```javascript
// Custom permission for enterprise client
await createPermission({
  name: "reports.export",
  description: "Export custom reports",
  resourceType: "reports",
  action: "export"
});

// Assign to custom role
await addPermissionToRole("data-analyst", "reports.export");

// Check permission in application
if (hasPermission("reports.export")) {
  showExportButton();
}
```

### Use Case 4: WordPress Integration

```php
// WordPress plugin syncing content
add_action('publish_post', function($post_id) {
    $client = new CMS_Automation_API_Client();
    
    if ($client->is_authenticated()) {
        $post = get_post($post_id);
        
        // Create content in CMS
        $result = $client->create_content(array(
            'title' => $post->post_title,
            'content' => $post->post_content,
            'status' => 'published',
            'metadata' => array(
                'wordpress_id' => $post_id,
                'permalink' => get_permalink($post_id)
            )
        ));
        
        if ($result['success']) {
            // Store CMS ID for future updates
            update_post_meta($post_id, 'cms_content_id', $result['data']['id']);
        }
    }
});
```

---

## Environment Variables

### Required Environment Variables

```bash
# JWT Secrets (generate secure random strings)
JWT_SECRET=your-super-secure-jwt-secret-256-bits
JWT_REFRESH_SECRET=your-super-secure-refresh-secret-256-bits

# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Application URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGIN=http://localhost:3000

# Optional: Email Service (for password reset)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASS=your-email-password
```

### Development vs Production

```bash
# Development
NODE_ENV=development
JWT_SECRET=dev-secret-change-in-production
STRIPE_SECRET_KEY=sk_test_...

# Production
NODE_ENV=production
JWT_SECRET=super-secure-production-secret
STRIPE_SECRET_KEY=sk_live_...
```

---

## Deployment Checklist

### Pre-deployment Setup

1. **Database Setup**
   ```bash
   # Run schema migrations
   psql -f scripts/auth-schema.sql
   psql -f scripts/migrate-existing-schema.sql
   psql -f scripts/rls-policies.sql
   ```

2. **Environment Configuration**
   - Set all required environment variables
   - Generate secure JWT secrets
   - Configure Stripe webhooks
   - Set up CORS origins

3. **Stripe Configuration**
   - Create products and prices
   - Set up webhook endpoints
   - Test payment flows
   - Configure billing portal

4. **Security Review**
   - Review RLS policies
   - Test permission boundaries
   - Validate JWT token handling
   - Check rate limiting

### Post-deployment Verification

1. **Authentication Flow**
   - Test user registration
   - Verify login/logout
   - Check token refresh
   - Test password reset

2. **Authorization**
   - Verify role permissions
   - Test organization isolation
   - Check API endpoint protection

3. **Billing**
   - Test subscription creation
   - Verify webhook handling
   - Check usage limit enforcement
   - Test billing portal access

---

This comprehensive guide provides everything needed to understand, implement, and maintain the authentication, authorization, and freemium revenue system. For additional support or custom implementations, refer to the API documentation and database schema files.