# CMS Security & Multi-Tenancy Implementation TODO

## 🚨 Current State: Critical Security Gaps

### **Missing Security Features:**
- ❌ **No Authentication** - Anyone can access the API
- ❌ **No Authorization** - All users see all content  
- ❌ **No Multi-tenancy** - Single shared database
- ❌ **No API Keys** - Endpoints are completely open
- ❌ **No User Management** - No concept of different users/companies

### **Current Architecture Issues:**
```javascript
// Current API - COMPLETELY OPEN
app.get('/api/v1/content', (req, res) => {
  // Returns ALL content for EVERYONE - SECURITY RISK
  res.json({ data: contentItems })
})

app.post('/api/v1/content', (req, res) => {
  // Anyone can create content - NO ACCESS CONTROL
  const newItem = { ...contentData }
})
```

---

## 🔐 Phase 1: Basic Authentication Implementation

### **1.1 JWT Authentication Middleware**
```javascript
// TODO: Implement in backend/api/src/middleware/auth.js
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization']
  const token = authHeader && authHeader.split(' ')[1] // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' })
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' })
    req.user = user // Contains: { userId, companyId, role }
    next()
  })
}
```

### **1.2 User Authentication Endpoints**
- [ ] `POST /api/v1/auth/register` - User registration
- [ ] `POST /api/v1/auth/login` - User login
- [ ] `POST /api/v1/auth/logout` - User logout
- [ ] `POST /api/v1/auth/refresh` - Refresh JWT token
- [ ] `GET /api/v1/auth/me` - Get current user info

### **1.3 Environment Variables**
```bash
# TODO: Add to .env file
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret
```

### **1.4 Dependencies to Install**
```bash
# TODO: Run these commands
npm install jsonwebtoken bcryptjs
npm install --save-dev @types/jsonwebtoken @types/bcryptjs
```

---

## 🏢 Phase 2: Multi-Tenant Data Model

### **2.1 Updated Database Schema**
```javascript
// TODO: Update data models to include company isolation
const contentItems = [
  {
    id: 1,
    companyId: 'company_abc123', // TENANT ISOLATION
    userId: 'user_xyz789',       // USER OWNERSHIP
    title: 'Company ABC Blog Post',
    content: 'Content here...',
    status: 'published',
    created_at: '2025-01-01T00:00:00Z',
    updated_at: '2025-01-01T00:00:00Z'
  }
]

const companies = [
  {
    id: 'company_abc123',
    name: 'TechCorp Inc',
    subdomain: 'techcorp',
    plan: 'business',
    created_at: '2025-01-01T00:00:00Z'
  }
]

const users = [
  {
    id: 'user_xyz789',
    companyId: 'company_abc123',
    email: 'sarah@techcorp.com',
    password: '$2b$10$hashedpassword',
    role: 'editor', // admin, editor, viewer
    firstName: 'Sarah',
    lastName: 'Johnson',
    created_at: '2025-01-01T00:00:00Z'
  }
]
```

### **2.2 Company Registration Flow**
```javascript
// TODO: Implement POST /api/v1/auth/register-company
{
  "companyName": "TechCorp Inc",
  "adminEmail": "admin@techcorp.com", 
  "adminPassword": "secure123",
  "plan": "business"
}

// Response should include:
{
  "companyId": "comp_abc123",
  "adminUserId": "user_xyz789", 
  "apiKey": "tc_live_abc123def456",
  "subdomain": "techcorp"
}
```

### **2.3 Tenant-Isolated API Endpoints**
```javascript
// TODO: Update all content endpoints
app.get('/api/v1/content', authenticateToken, (req, res) => {
  const userCompanyId = req.user.companyId
  
  // Only return content for user's company
  const userContent = contentItems.filter(item => 
    item.companyId === userCompanyId
  )
  
  res.json({
    message: 'Content for your company',
    data: userContent,
    company: req.user.companyName
  })
})

app.post('/api/v1/content', authenticateToken, (req, res) => {
  const newItem = {
    id: nextContentId++,
    companyId: req.user.companyId, // AUTO-ASSIGN TO USER'S COMPANY
    userId: req.user.userId,       // TRACK WHO CREATED IT
    title: contentData.title,
    content: contentData.content,
    status: contentData.status || 'draft',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
  
  contentItems.push(newItem)
  res.status(201).json({ data: newItem })
})
```

---

## 🔒 Phase 3: Role-Based Access Control (RBAC)

### **3.1 Role Definitions**
```javascript
// TODO: Define user roles and permissions
const ROLES = {
  SUPER_ADMIN: 'super_admin', // Platform admin (can manage all companies)
  ADMIN: 'admin',             // Company admin (can manage company users/content)
  EDITOR: 'editor',           // Can create/edit/delete content
  AUTHOR: 'author',           // Can create/edit own content
  VIEWER: 'viewer'            // Read-only access
}

const PERMISSIONS = {
  // Content permissions
  'content:read': ['super_admin', 'admin', 'editor', 'author', 'viewer'],
  'content:create': ['super_admin', 'admin', 'editor', 'author'],
  'content:update:own': ['super_admin', 'admin', 'editor', 'author'],
  'content:update:any': ['super_admin', 'admin', 'editor'],
  'content:delete:own': ['super_admin', 'admin', 'editor', 'author'],
  'content:delete:any': ['super_admin', 'admin', 'editor'],
  'content:publish': ['super_admin', 'admin', 'editor'],
  
  // User management permissions
  'users:read': ['super_admin', 'admin'],
  'users:create': ['super_admin', 'admin'],
  'users:update': ['super_admin', 'admin'],
  'users:delete': ['super_admin', 'admin'],
  
  // Company management permissions
  'company:update': ['super_admin', 'admin'],
  'company:delete': ['super_admin']
}
```

### **3.2 Authorization Middleware**
```javascript
// TODO: Implement in backend/api/src/middleware/rbac.js
const requirePermission = (permission) => {
  return (req, res, next) => {
    const userRole = req.user.role
    const allowedRoles = PERMISSIONS[permission]
    
    if (!allowedRoles || !allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Insufficient permissions',
        required: permission,
        userRole: userRole
      })
    }
    next()
  }
}

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required: roles,
        userRole: req.user.role
      })
    }
    next()
  }
}
```

### **3.3 Protected Endpoints**
```javascript
// TODO: Add authorization to all endpoints
app.delete('/api/v1/content/:id', 
  authenticateToken, 
  requirePermission('content:delete:any'), // Only admins/editors can delete
  (req, res) => {
    // Delete logic with company isolation
  }
)

app.get('/api/v1/analytics',
  authenticateToken,
  requirePermission('company:read'), // Only admins see analytics
  (req, res) => {
    // Analytics for user's company only
  }
)

app.get('/api/v1/users',
  authenticateToken,
  requirePermission('users:read'),
  (req, res) => {
    // User management for company admins
  }
)
```

---

## 🛡️ Phase 4: Advanced Security Features

### **4.1 API Rate Limiting**
```javascript
// TODO: Implement rate limiting per company/user
const rateLimit = require('express-rate-limit')

const createRateLimiter = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    keyGenerator: (req) => {
      // Rate limit per company + user
      return `${req.user?.companyId || 'anonymous'}:${req.user?.userId || req.ip}`
    },
    skip: (req) => {
      // Skip rate limiting for super admins
      return req.user?.role === 'super_admin'
    }
  })
}

// Different limits for different endpoints
app.use('/api/v1/content', createRateLimiter(15 * 60 * 1000, 1000, 'Content API rate limit exceeded'))
app.use('/api/v1/auth/login', createRateLimiter(15 * 60 * 1000, 10, 'Login rate limit exceeded'))
```

### **4.2 API Key Management**
```javascript
// TODO: Implement API key system for programmatic access
const apiKeys = new Map() // In production, use database

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key']
  
  if (!apiKey) {
    return res.status(401).json({ error: 'API key required' })
  }
  
  const keyData = apiKeys.get(apiKey)
  if (!keyData || keyData.revoked) {
    return res.status(401).json({ error: 'Invalid or revoked API key' })
  }
  
  // Set company context from API key
  req.user = {
    companyId: keyData.companyId,
    role: keyData.role,
    type: 'api_key'
  }
  
  next()
}

// Generate API keys for companies
app.post('/api/v1/api-keys',
  authenticateToken,
  requireRole(['admin']),
  async (req, res) => {
    const apiKey = `${req.user.companyId.slice(0, 8)}_${crypto.randomUUID()}`
    
    apiKeys.set(apiKey, {
      companyId: req.user.companyId,
      role: 'api_access',
      createdBy: req.user.userId,
      createdAt: new Date(),
      lastUsed: null,
      revoked: false
    })
    
    res.json({ apiKey, permissions: ['content:read', 'content:create'] })
  }
)
```

### **4.3 Audit Logging**
```javascript
// TODO: Implement comprehensive audit logging
const auditLog = []

const logActivity = (req, action, resourceType, resourceId, details = {}) => {
  const logEntry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    companyId: req.user?.companyId,
    userId: req.user?.userId,
    userEmail: req.user?.email,
    action, // 'create', 'update', 'delete', 'login', 'logout'
    resourceType, // 'content', 'user', 'company'
    resourceId,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
    details
  }
  
  auditLog.push(logEntry)
  
  // In production: save to database, send to logging service
  console.log('AUDIT:', JSON.stringify(logEntry, null, 2))
}

// Usage in endpoints
app.post('/api/v1/content', authenticateToken, (req, res) => {
  // ... content creation logic ...
  
  logActivity(req, 'create', 'content', newItem.id, {
    title: newItem.title,
    status: newItem.status
  })
  
  res.json({ data: newItem })
})
```

### **4.4 Data Encryption**
```javascript
// TODO: Implement field-level encryption for sensitive data
const crypto = require('crypto')

const encrypt = (text, key = process.env.ENCRYPTION_KEY) => {
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipher('aes-256-cbc', key)
  let encrypted = cipher.update(text, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  return iv.toString('hex') + ':' + encrypted
}

const decrypt = (text, key = process.env.ENCRYPTION_KEY) => {
  const [ivHex, encryptedHex] = text.split(':')
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipher('aes-256-cbc', key)
  let decrypted = decipher.update(encryptedHex, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}

// Encrypt sensitive fields before storage
const encryptSensitiveFields = (data) => {
  if (data.content && data.status === 'private') {
    data.content = encrypt(data.content)
  }
  return data
}
```

---

## 🎯 Phase 5: Frontend Authentication Integration

### **5.1 Authentication Context**
```typescript
// TODO: Create frontend/src/contexts/AuthContext.tsx
interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'admin' | 'editor' | 'author' | 'viewer'
  companyId: string
  companyName: string
}

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
  token: string | null
}

const AuthContext = createContext<AuthContextType | null>(null)
```

### **5.2 Protected Routes**
```typescript
// TODO: Implement route protection
const ProtectedRoute = ({ children, requiredRole }: { 
  children: React.ReactNode
  requiredRole?: string[]
}) => {
  const { user, isAuthenticated, isLoading } = useAuth()
  
  if (isLoading) {
    return <LoadingSpinner />
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />
  }
  
  if (requiredRole && !requiredRole.includes(user.role)) {
    return <div>Access Denied - Insufficient Permissions</div>
  }
  
  return <>{children}</>
}
```

### **5.3 Login/Registration Forms**
```typescript
// TODO: Create authentication forms
const LoginForm = () => {
  const { login } = useAuth()
  const [credentials, setCredentials] = useState({ email: '', password: '' })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(credentials.email, credentials.password)
      navigate('/dashboard')
    } catch (error) {
      setError('Invalid credentials')
    }
  }
  
  return (
    <form onSubmit={handleSubmit}>
      {/* Login form fields */}
    </form>
  )
}

const CompanyRegistrationForm = () => {
  // TODO: Implement company registration with admin user creation
}
```

### **5.4 Authenticated API Service**
```typescript
// TODO: Update frontend/src/services/api.ts
class AuthenticatedApiService {
  private baseURL = process.env.REACT_APP_API_URL || 'http://localhost:5000'
  private token: string | null = localStorage.getItem('token')
  
  private async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(this.token && { 'Authorization': `Bearer ${this.token}` }),
        ...options.headers,
      },
    }
    
    const response = await fetch(url, config)
    
    if (response.status === 401) {
      // Token expired, redirect to login
      localStorage.removeItem('token')
      window.location.href = '/login'
      throw new Error('Authentication required')
    }
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`)
    }
    
    return response.json()
  }
  
  // All existing methods updated to use authenticated requests
  async getContent(): Promise<ContentItem[]> {
    const response = await this.request<ApiResponse<ContentItem[]>>('/api/v1/content')
    return response.data
  }
}
```

---

## 📊 Phase 6: Company Analytics & Management

### **6.1 Company Dashboard**
- [ ] Content statistics (total, published, drafts)
- [ ] User activity metrics
- [ ] API usage statistics
- [ ] Storage usage tracking

### **6.2 User Management Interface**
- [ ] Invite new users to company
- [ ] Manage user roles and permissions
- [ ] Deactivate/reactivate users
- [ ] Audit user activity

### **6.3 Company Settings**
- [ ] Company profile management
- [ ] API key management
- [ ] Billing and subscription management
- [ ] Data export/backup options

---

## 🗄️ Phase 7: Database Migration (Production)

### **7.1 Database Setup**
```sql
-- TODO: Create production database schema

-- Companies table
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  plan VARCHAR(50) NOT NULL DEFAULT 'free',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL DEFAULT 'viewer',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Content table
CREATE TABLE content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) NOT NULL,
  content TEXT,
  status VARCHAR(20) DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, slug)
);

-- Row Level Security
ALTER TABLE content ENABLE ROW LEVEL SECURITY;
CREATE POLICY company_isolation ON content
  FOR ALL TO authenticated_users
  USING (company_id = current_setting('app.current_company_id')::UUID);
```

### **7.2 Database Connection & ORM**
```javascript
// TODO: Replace in-memory storage with database
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

// Content service with database
class ContentService {
  async getContentByCompany(companyId) {
    const result = await pool.query(
      'SELECT * FROM content WHERE company_id = $1 ORDER BY created_at DESC',
      [companyId]
    )
    return result.rows
  }
  
  async createContent(companyId, userId, contentData) {
    const result = await pool.query(
      `INSERT INTO content (company_id, user_id, title, slug, content, status) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [companyId, userId, contentData.title, contentData.slug, contentData.content, contentData.status]
    )
    return result.rows[0]
  }
}
```

---

## 🚀 Implementation Checklist

### **Immediate Priority (Phase 1)**
- [ ] Install JWT and bcryptjs dependencies
- [ ] Create authentication middleware
- [ ] Add user login/registration endpoints
- [ ] Update frontend with login form
- [ ] Add JWT token storage and management

### **High Priority (Phase 2)**
- [ ] Add company_id and user_id to all content
- [ ] Implement tenant isolation in API endpoints
- [ ] Create company registration flow
- [ ] Update frontend to show company-specific content

### **Medium Priority (Phase 3)**
- [ ] Implement role-based access control
- [ ] Add permission checking middleware
- [ ] Create user management interface
- [ ] Add audit logging

### **Future Enhancements (Phase 4-7)**
- [ ] API rate limiting and key management
- [ ] Data encryption for sensitive content
- [ ] Production database migration
- [ ] Company analytics dashboard
- [ ] Advanced user management features

---

## 📋 Testing Strategy

### **Security Testing**
- [ ] Test authentication bypass attempts
- [ ] Verify tenant data isolation
- [ ] Test role permission boundaries
- [ ] Validate input sanitization
- [ ] Test rate limiting effectiveness

### **Multi-Tenant Testing**
- [ ] Create multiple test companies
- [ ] Verify data isolation between companies
- [ ] Test user switching between companies
- [ ] Validate company-specific API responses

---

## 🔧 Environment Setup

### **Required Environment Variables**
```bash
# Authentication
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=your-refresh-token-secret

# Database (Production)
DATABASE_URL=postgresql://user:password@localhost:5432/cms_db

# Encryption
ENCRYPTION_KEY=your-32-byte-encryption-key

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# Application
NODE_ENV=development
PORT=5000
CORS_ORIGIN=http://localhost:3001
```

### **Additional Dependencies**
```bash
# Backend security packages
npm install jsonwebtoken bcryptjs express-rate-limit helmet cors
npm install uuid pg

# Frontend authentication packages  
npm install @types/jsonwebtoken @types/bcryptjs

# Development dependencies
npm install --save-dev jest supertest @types/jest
```

---

## ⚠️ Current Demo Limitations

**The current CMS is a development prototype suitable for:**
- ✅ Learning and development
- ✅ Single-company internal use  
- ✅ Testing API functionality
- ❌ **NOT suitable for production multi-tenant use without implementing the security measures above**

**Major Security Risks:**
- Any user can access any company's content
- No authentication required for API access
- No data encryption or secure storage  
- No audit trail of user actions
- No rate limiting or abuse prevention

**Implementation of the TODO items above is CRITICAL before any production deployment.**