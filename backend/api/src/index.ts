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
  const sampleData = [
    {
      id: 'sample-1',
      title: 'Welcome to CMS',
      content: 'This is sample content for testing.',
      status: 'published',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'sample-2', 
      title: 'Getting Started',
      content: 'Learn how to use the CMS platform.',
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];
  
  res.json({
    message: 'Content endpoint (sample data)',
    data: sampleData
  });
});

// Get single content item by ID
app.get('/api/v1/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const contentService = await storageFactory.getContentService();
    const item = await (contentService as any).getContentById?.(id) || 
                 await (contentService as any).getContentItemById?.(id);
    
    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Content item with ID ${id} not found`
      });
    }
    
    res.json({
      message: 'Content item found',
      data: item
    });
  } catch (error) {
    console.error('Error fetching content item:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch content item'
    });
  }
});

// Create new content item
app.post('/api/v1/content', async (req, res) => {
  try {
    const { content: contentData } = req.body;
    
    if (!contentData || !contentData.title) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title is required'
      });
    }
    
    const contentService = await storageFactory.getContentService();
    const itemData = {
      title: contentData.title,
      slug: contentData.slug,
      content: contentData.content || '',
      status: contentData.status || 'draft',
      content_type_id: contentData.content_type_id,
      meta_description: contentData.meta_description,
      featured_image: contentData.featured_image,
      tags: contentData.tags
    };
    
    const newItem = await (contentService as any).createContent?.(itemData) || 
                    await (contentService as any).createContentItem?.(itemData);
    
    res.status(201).json({
      message: 'Content item created successfully',
      data: newItem
    });
  } catch (error) {
    console.error('Error creating content item:', error);
    if ((error as Error).message.includes('already exists')) {
      res.status(409).json({
        error: 'Conflict',
        message: (error as Error).message
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to create content item'
      });
    }
  }
});

// Update content item
app.put('/api/v1/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content: contentData } = req.body;
    
    if (!contentData || !contentData.title) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Title is required'
      });
    }
    
    const updatedItem = await contentService.updateContent(id, {
      title: contentData.title,
      slug: contentData.slug,
      content: contentData.content,
      status: contentData.status,
      meta_description: contentData.meta_description,
      featured_image: contentData.featured_image,
      tags: contentData.tags
    });
    
    if (!updatedItem) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Content item with ID ${id} not found`
      });
    }
    
    res.json({
      message: 'Content item updated successfully',
      data: updatedItem
    });
  } catch (error) {
    console.error('Error updating content item:', error);
    if ((error as Error).message.includes('already exists')) {
      res.status(409).json({
        error: 'Conflict',
        message: (error as Error).message
      });
    } else {
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to update content item'
      });
    }
  }
});

// Delete content item
app.delete('/api/v1/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const item = await contentService.getContentById(id);
    if (!item) {
      return res.status(404).json({
        error: 'Not Found',
        message: `Content item with ID ${id} not found`
      });
    }
    
    const deleted = await contentService.deleteContent(id);
    
    if (!deleted) {
      return res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to delete content item'
      });
    }
    
    res.json({
      message: 'Content item deleted successfully',
      data: {
        success: true,
        message: `Content item "${item.title}" has been deleted`
      }
    });
  } catch (error) {
    console.error('Error deleting content item:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete content item'
    });
  }
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
app.get('/api/v1/media', async (req, res) => {
  try {
    const data = await contentService.getMediaFiles();
    res.json({
      message: 'Media endpoint',
      data
    });
  } catch (error) {
    console.error('Error fetching media files:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch media files'
    });
  }
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