import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'cms-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'CMS Content API is running',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api/v1',
      docs: '/docs'
    }
  });
});

// Import services and routes
// import { StorageFactory } from './services/StorageFactory.js';
// import { OpenAIService } from './services/OpenAIService.js';
// import systemRoutes from './routes/system.js';
// import optimizelyRoutes from '../routes/optimizely.js';

// Initialize services
// const storageFactory = StorageFactory.getInstance();
// const openaiService = new OpenAIService();

// Helper function to generate slug from title (moved to ContentService)
function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// Content API routes
app.get('/api/v1/content', (req, res) => {
  res.json({
    message: 'Content endpoint test',
    data: [
      { id: '1', title: 'Test Content', status: 'published' }
    ]
  });
});

// Get single content item by ID
app.get('/api/v1/content/:id', (req, res) => {
  const { id } = req.params;
  if (id === '1') {
    res.json({
      message: 'Content item found',
      data: { id: '1', title: 'Test Content', status: 'published' }
    });
  } else {
    res.status(404).json({
      error: 'Not Found',
      message: `Content item with ID ${id} not found`
    });
  }
});

// Create new content item
app.post('/api/v1/content', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Content creation temporarily disabled during configuration'
  });
});

// Update content item
app.put('/api/v1/content/:id', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Content updates temporarily disabled during configuration'
  });
});

// Delete content item
app.delete('/api/v1/content/:id', (req, res) => {
  res.status(501).json({
    error: 'Not Implemented',
    message: 'Content deletion temporarily disabled during configuration'
  });
});

// Content types endpoint
app.get('/api/v1/content-types', (req, res) => {
  const sampleTypes = [
    {
      id: 'blog-post',
      name: 'Blog Post',
      description: 'Standard blog post content type',
      schema: {
        title: { type: 'string', required: true },
        content: { type: 'text', required: true },
        excerpt: { type: 'string' }
      },
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  res.json({
    message: 'Content types endpoint (sample data)',
    data: sampleTypes
  });
});

// Media endpoint
app.get('/api/v1/media', (req, res) => {
  res.json({
    message: 'Media endpoint (sample data)',
    data: []
  });
});

// AI Generation endpoint (temporarily disabled)
app.post('/api/v1/ai/generate', (req, res) => {
  res.status(503).json({
    success: false,
    error: {
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'AI service is temporarily unavailable during deployment configuration.'
    }
  });
});

// AI Writing Suggestions endpoint (temporarily disabled)
app.post('/api/v1/ai/suggestions', (req, res) => {
  res.status(503).json({
    success: false,
    error: {
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'AI service is temporarily unavailable during deployment configuration.'
    }
  });
});

// AI Content Adaptation endpoint (temporarily disabled)
app.post('/api/v1/ai/adapt', (req, res) => {
  res.status(503).json({
    success: false,
    error: {
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'AI service is temporarily unavailable during deployment configuration.'
    }
  });
});

// AI Adaptation Formats endpoint (temporarily disabled)
app.get('/api/v1/ai/adapt/formats', (req, res) => {
  res.status(503).json({
    success: false,
    error: {
      code: 'AI_SERVICE_UNAVAILABLE',
      message: 'AI service is temporarily unavailable during deployment configuration.'
    }
  });
});

// System status endpoint
app.get('/api/v1/system/status', (req, res) => {
  const systemStatus = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    storage: {
      type: 'sample',
      status: 'active',
      details: 'Using sample data for testing'
    },
    version: '1.0.0',
    features: {
      supabase_ready: false,
      local_storage: false,
      ai_integration: false,
      openai_configured: !!process.env.OPENAI_API_KEY
    }
  };

  res.json(systemStatus);
});

// System setup instructions
app.get('/api/v1/system/setup/supabase', (req, res) => {
  const instructions = {
    title: 'Supabase Setup Instructions',
    status: 'manual_setup_required',
    steps: [
      {
        step: 1,
        title: 'Create Database Tables',
        description: 'Execute SQL schema in Supabase dashboard',
        action: {
          url: 'https://supabase.com/dashboard/project/neezcjbguizmkbyglroe/sql/new',
          sql_file: 'scripts/create-tables-manual.sql',
          instructions: 'Copy the SQL from the file and run it in the Supabase SQL editor'
        }
      },
      {
        step: 2,
        title: 'Populate Sample Data',
        description: 'Insert initial content types and sample data',
        action: {
          command: 'node scripts/populate-data.js',
          instructions: 'Run this command after creating the database tables'
        }
      },
      {
        step: 3,
        title: 'Switch Environment',
        description: 'Update environment to use Supabase storage',
        action: {
          env_var: 'NODE_ENV=supabase-test',
          instructions: 'Set environment variable or create .env file with supabase-test configuration'
        }
      },
      {
        step: 4,
        title: 'Verify Setup',
        description: 'Check system status to confirm Supabase connection',
        action: {
          endpoint: '/api/v1/system/status',
          instructions: 'Call this endpoint to verify Supabase connection is working'
        }
      }
    ],
    configuration: {
      current_storage: process.env.STORAGE_TYPE || 'local',
      supabase_configured: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY)
    }
  };

  res.json(instructions);
});

// Optimizely integration routes (temporarily disabled for MVP testing)
// app.use('/api/v1/optimizely', optimizelyRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`,
    timestamp: new Date().toISOString()
  });
});

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 CMS Content API server running on port ${PORT}`);
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