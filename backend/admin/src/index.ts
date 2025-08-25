import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  credentials: true
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'cms-admin',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'CMS Admin API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      admin: '/api/admin'
    }
  });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  // Basic mock authentication
  if (email === 'admin@localhost' && password === 'admin123') {
    res.json({
      success: true,
      user: {
        id: 1,
        email: 'admin@localhost',
        role: 'admin',
        name: 'Admin User'
      },
      token: 'mock-jwt-token',
      expires_in: 28800 // 8 hours
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});

app.get('/api/auth/me', (req, res) => {
  // Mock user info (in real app, verify JWT token)
  res.json({
    success: true,
    user: {
      id: 1,
      email: 'admin@localhost',
      role: 'admin',
      name: 'Admin User',
      created_at: new Date().toISOString()
    }
  });
});

// Admin dashboard endpoints
app.get('/api/admin/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      stats: {
        total_content: 156,
        published_content: 142,
        draft_content: 14,
        total_users: 8,
        total_media_files: 89
      },
      recent_activity: [
        {
          id: 1,
          action: 'Content published',
          item: 'Welcome Page',
          user: 'Admin User',
          timestamp: new Date().toISOString()
        },
        {
          id: 2,
          action: 'User created',
          item: 'editor@localhost',
          user: 'Admin User',
          timestamp: new Date(Date.now() - 3600000).toISOString()
        }
      ]
    }
  });
});

// Content management endpoints
app.get('/api/admin/content', (req, res) => {
  const { page = 1, limit = 10, status, type } = req.query;
  
  res.json({
    success: true,
    data: {
      items: [
        {
          id: 1,
          title: 'Welcome to your CMS',
          slug: 'welcome',
          type: 'page',
          status: 'published',
          author: 'Admin User',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 2,
          title: 'Getting Started Guide',
          slug: 'getting-started',
          type: 'page',
          status: 'draft',
          author: 'Admin User',
          created_at: new Date(Date.now() - 86400000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString()
        }
      ],
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total: 2,
        total_pages: 1
      }
    }
  });
});

// User management endpoints
app.get('/api/admin/users', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 1,
        email: 'admin@localhost',
        name: 'Admin User',
        role: 'admin',
        status: 'active',
        created_at: new Date().toISOString()
      },
      {
        id: 2,
        email: 'editor@localhost',
        name: 'Editor User',
        role: 'editor',
        status: 'active',
        created_at: new Date(Date.now() - 86400000).toISOString()
      }
    ]
  });
});

// System settings endpoints
app.get('/api/admin/settings', (req, res) => {
  res.json({
    success: true,
    data: {
      site_name: 'My Headless CMS',
      site_description: 'A powerful headless content management system',
      default_language: 'en',
      timezone: 'UTC',
      date_format: 'YYYY-MM-DD',
      time_format: '24h'
    }
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🛡️  CMS Admin API server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;