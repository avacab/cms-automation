# Testing the Authentication & Freemium System

This guide provides comprehensive instructions for testing the new authentication, RBAC, and freemium billing system implemented in the `feature/auth-rbac-freemium` branch.

## Prerequisites

Before testing, ensure you have:

1. **Environment Variables**: Copy `.env.example` and configure:
   ```bash
   cp .env.example .env
   ```

2. **Required Environment Variables**:
   ```bash
   # Authentication & JWT Configuration
   JWT_SECRET=your-super-secure-jwt-secret-minimum-32-characters
   JWT_REFRESH_SECRET=your-super-secure-refresh-secret-minimum-32-characters

   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_KEY=your-supabase-service-role-key

   # Stripe Configuration (Test Mode)
   STRIPE_SECRET_KEY=sk_test_your_stripe_test_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

   # Application URLs
   FRONTEND_URL=http://localhost:3000
   CORS_ORIGIN=http://localhost:3000

   # Development Environment
   NODE_ENV=development
   ```

3. **Database Setup**: Run the authentication schema:
   ```bash
   # Run the auth schema setup
   psql -h your-supabase-host -U postgres -d postgres -f scripts/auth-schema.sql
   
   # Or using Supabase CLI
   supabase db push
   ```

## 1. Database Schema Testing

### Verify Tables Creation

Connect to your Supabase database and verify all tables exist:

```sql
-- Check if authentication tables exist
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'users', 'organizations', 'user_organizations', 
  'roles', 'permissions', 'role_permissions',
  'subscription_plans', 'subscriptions', 'usage_tracking'
);

-- Verify RLS policies are enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
AND rowsecurity = true;
```

### Test Data Insertion

Insert test data to verify schema integrity:

```sql
-- Insert test organization
INSERT INTO organizations (name, domain, subscription_tier) 
VALUES ('Test Organization', 'test.com', 'free');

-- Insert test user
INSERT INTO users (email, password_hash, first_name, last_name, email_verified) 
VALUES ('test@test.com', '$2b$10$encrypted_password_hash', 'Test', 'User', true);

-- Verify foreign key constraints work
SELECT u.email, o.name as organization_name, uo.role
FROM users u
JOIN user_organizations uo ON u.id = uo.user_id
JOIN organizations o ON uo.organization_id = o.id;
```

## 2. Backend API Testing

### Start the Backend Server

```bash
cd backend/api
npm install
npm run dev
```

### Test Health Check

```bash
curl http://localhost:8000/health
# Expected: {"status": "ok", "timestamp": "..."}
```

### Test User Registration

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "firstName": "New",
    "lastName": "User",
    "organizationName": "New Company"
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "newuser@example.com",
      "firstName": "New",
      "lastName": "User"
    },
    "organization": {
      "id": "uuid",
      "name": "New Company"
    },
    "tokens": {
      "accessToken": "jwt-token",
      "refreshToken": "refresh-token"
    }
  }
}
```

### Test User Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@example.com",
    "password": "SecurePassword123!"
  }'
```

### Test Protected Endpoint

Use the access token from login response:

```bash
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

### Test Token Refresh

```bash
curl -X POST http://localhost:8000/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refreshToken": "YOUR_REFRESH_TOKEN"
  }'
```

## 3. RBAC Permission Testing

### Test Role-Based Access

1. **Create users with different roles** (use registration endpoint)
2. **Test permission-based endpoints**:

```bash
# Test owner permissions
curl -X POST http://localhost:8000/api/v1/content \
  -H "Authorization: Bearer OWNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Content", "content": "Test content body"}'

# Test editor permissions
curl -X PUT http://localhost:8000/api/v1/content/content-id \
  -H "Authorization: Bearer EDITOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Updated Content"}'

# Test viewer permissions (should fail for write operations)
curl -X DELETE http://localhost:8000/api/v1/content/content-id \
  -H "Authorization: Bearer VIEWER_TOKEN"
```

### Test Organization Isolation

1. **Create two organizations with different users**
2. **Verify users can only access their organization's data**:

```bash
# User from Org A trying to access Org B's content
curl -X GET http://localhost:8000/api/v1/content \
  -H "Authorization: Bearer ORG_A_USER_TOKEN"
# Should only return Org A's content
```

## 4. Stripe Billing Integration Testing

### Setup Stripe Test Environment

1. **Use Stripe test keys** in your `.env` file
2. **Create test subscription plans** (should be auto-created on server start)

### Test Subscription Creation

```bash
curl -X POST http://localhost:8000/api/v1/billing/subscription \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "planId": "pro",
    "paymentMethodId": "pm_card_visa"
  }'
```

### Test Usage Tracking

```bash
# Check current usage
curl -X GET http://localhost:8000/api/v1/billing/usage \
  -H "Authorization: Bearer YOUR_TOKEN"

# Make API calls to increment usage
curl -X POST http://localhost:8000/api/v1/content \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Usage Test", "content": "Testing usage limits"}'

# Check usage again
curl -X GET http://localhost:8000/api/v1/billing/usage \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Usage Limits

1. **Create content until you hit the free tier limit** (50 items)
2. **Verify API returns 429 error** when limit exceeded:

```bash
# This should fail if you've hit the limit
curl -X POST http://localhost:8000/api/v1/content \
  -H "Authorization: Bearer FREE_TIER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title": "Over Limit", "content": "This should fail"}'
```

Expected response:
```json
{
  "success": false,
  "error": {
    "code": "USAGE_LIMIT_EXCEEDED",
    "message": "Monthly content limit exceeded. Upgrade to continue."
  }
}
```

## 5. Frontend Testing

### Start the Frontend Development Server

```bash
cd frontend
npm install
npm start
```

### Test Authentication Components

1. **Navigate to** `http://localhost:3000`
2. **Test Registration Flow**:
   - Click "Sign Up"
   - Fill in registration form
   - Verify email validation
   - Submit and check redirect

3. **Test Login Flow**:
   - Click "Sign In"
   - Enter credentials
   - Verify token storage in localStorage
   - Check user context state

4. **Test Protected Routes**:
   - Try accessing `/dashboard` without login (should redirect)
   - Login and access `/dashboard` (should work)

### Test Role-Based UI

1. **Login as different role users**
2. **Verify UI elements show/hide based on permissions**:
   - Owners see all features
   - Editors see content creation/editing
   - Viewers see read-only interface

### Test Usage Limits in UI

1. **Login with free tier account**
2. **Create content until limit reached**
3. **Verify upgrade prompts appear**
4. **Test billing upgrade flow**

## 6. WordPress Plugin Testing

### Install and Configure Plugin

1. **Copy plugin to WordPress** `/wp-content/plugins/`
2. **Activate plugin** in WordPress admin
3. **Configure settings**:
   - Navigate to Settings → CMS Automation
   - Enter API URL: `http://localhost:8000`
   - Test connection

### Test Authentication

1. **Enter email/password** in plugin settings
2. **Test authentication** - should show success message
3. **Verify stored tokens** in WordPress options table

### Test Content Sync

1. **Create/edit a WordPress post**
2. **Check sync status** in post meta box
3. **Verify content appears** in CMS API
4. **Test bidirectional sync**

### Test AI Features

1. **Use AI content generation** in post editor
2. **Test writing suggestions** feature
3. **Test content adaptation** for different formats

## 7. Error Handling Testing

### Test Invalid Credentials

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "invalid@example.com",
    "password": "wrongpassword"
  }'
```

### Test Expired Tokens

1. **Wait for access token to expire** (15 minutes)
2. **Make API request** with expired token
3. **Verify 401 response** and token refresh flow

### Test Network Errors

1. **Stop backend server**
2. **Test frontend error handling**
3. **Verify appropriate error messages** show

## 8. Performance Testing

### Load Testing

Use a tool like Apache Bench to test API performance:

```bash
# Test login endpoint
ab -n 100 -c 10 -p login-data.json -T application/json \
  http://localhost:8000/api/v1/auth/login

# Test protected endpoint
ab -n 100 -c 10 -H "Authorization: Bearer TOKEN" \
  http://localhost:8000/api/v1/content
```

### Database Performance

1. **Monitor query performance** in Supabase dashboard
2. **Check RLS policy efficiency**
3. **Verify indexes are being used**

## 9. Security Testing

### Test SQL Injection Protection

```bash
# Try SQL injection in login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@test.com'\'' OR '\''1'\''='\''1",
    "password": "password"
  }'
```

### Test JWT Token Security

1. **Verify tokens have expiration**
2. **Test token signature validation**
3. **Verify refresh token rotation**

### Test RLS Policies

1. **Create test data** in different organizations
2. **Verify users can't access** other organizations' data
3. **Test policy bypass attempts**

## 10. Integration Testing

### End-to-End User Flow

1. **Register new user** → **Login** → **Create content** → **Sync to WordPress** → **View in frontend**
2. **Test billing upgrade** → **Verify increased limits** → **Create more content**
3. **Invite team member** → **Assign role** → **Test permissions**

### Cross-Platform Sync

1. **Create content in WordPress**
2. **Verify sync to CMS**
3. **Edit in CMS frontend**
4. **Verify sync back to WordPress**

## Common Issues and Troubleshooting

### Database Connection Issues
- Verify Supabase credentials
- Check RLS policies are correctly configured
- Ensure service role key has proper permissions

### Authentication Issues
- Verify JWT secrets are properly set
- Check token expiration times
- Ensure CORS is configured correctly

### Billing Integration Issues
- Verify Stripe test keys
- Check webhook endpoints are reachable
- Monitor Stripe dashboard for errors

### WordPress Plugin Issues
- Check PHP error logs
- Verify API URL is correct
- Test WordPress REST API permissions

## Testing Checklist

- [ ] Database schema created successfully
- [ ] User registration works
- [ ] User login works
- [ ] Token refresh works
- [ ] RBAC permissions enforced
- [ ] Organization isolation works
- [ ] Usage tracking functions
- [ ] Usage limits enforced
- [ ] Stripe integration works
- [ ] Frontend authentication works
- [ ] Role-based UI works
- [ ] WordPress plugin authenticates
- [ ] Content sync works
- [ ] AI features function
- [ ] Error handling works
- [ ] Security measures effective
- [ ] Performance acceptable
- [ ] End-to-end flows complete

## Next Steps

After successful testing:

1. **Merge feature branch** to main
2. **Deploy to staging** environment
3. **Run production-like tests**
4. **Deploy to production**
5. **Monitor system performance**
6. **Gather user feedback**

For any issues encountered during testing, check the logs:
- Backend: Check console output and Supabase logs
- Frontend: Check browser console and network tab
- WordPress: Check PHP error logs and WordPress debug log