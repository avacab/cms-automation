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
import { ContentService } from './services/ContentService.js';
import { StorageFactory } from './services/StorageFactory.js';
import { OpenAIService } from './services/OpenAIService.js';
// import systemRoutes from './routes/system.js';
// import optimizelyRoutes from '../routes/optimizely.js';

// Initialize services
const contentService = new ContentService();
const openaiService = new OpenAIService();

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
app.get('/api/v1/content', async (req, res) => {
  try {
    const { status, content_type_id, limit, offset, search } = req.query;
    
    const options: any = {};
    if (status) options.status = status as string;
    if (content_type_id) options.content_type_id = content_type_id as string;
    if (limit) options.limit = parseInt(limit as string);
    if (offset) options.offset = parseInt(offset as string);
    if (search) options.search = search as string;

    const data = await contentService.getAllContent(options);
    res.json({
      message: 'Content endpoint',
      data
    });
  } catch (error) {
    console.error('Error fetching content:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch content'
    });
  }
});

// Get single content item by ID
app.get('/api/v1/content/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await contentService.getContentById(id);
    
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
    
    const newItem = await contentService.createContent({
      title: contentData.title,
      slug: contentData.slug,
      content: contentData.content || '',
      status: contentData.status || 'draft',
      content_type_id: contentData.content_type_id,
      meta_description: contentData.meta_description,
      featured_image: contentData.featured_image,
      tags: contentData.tags
    });
    
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
app.get('/api/v1/content-types', async (req, res) => {
  try {
    const data = await contentService.getContentTypes();
    res.json({
      message: 'Content types endpoint',
      data
    });
  } catch (error) {
    console.error('Error fetching content types:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to fetch content types'
    });
  }
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

// AI Generation endpoint (direct OpenAI integration)
app.post('/api/v1/ai/generate', async (req, res) => {
  try {
    if (!openaiService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI service is not available. Please check OpenAI configuration.'
        }
      });
    }

    const result = await openaiService.generateContent(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in AI generation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_GENERATION_ERROR',
        message: 'Failed to generate content'
      }
    });
  }
});

// AI Writing Suggestions endpoint (direct OpenAI integration)
app.post('/api/v1/ai/suggestions', async (req, res) => {
  try {
    if (!openaiService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI service is not available. Please check OpenAI configuration.'
        }
      });
    }

    const result = await openaiService.getWritingSuggestions(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in AI suggestions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_SUGGESTIONS_ERROR',
        message: 'Failed to get writing suggestions'
      }
    });
  }
});

// AI Content Adaptation endpoint (direct OpenAI integration)
app.post('/api/v1/ai/adapt', async (req, res) => {
  try {
    if (!openaiService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'AI service is not available. Please check OpenAI configuration.'
        }
      });
    }

    const result = await openaiService.adaptContent(req.body);
    
    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error in AI adaptation:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_ADAPTATION_ERROR',
        message: 'Failed to adapt content'
      }
    });
  }
});

// AI Adaptation Formats endpoint (direct OpenAI integration)
app.get('/api/v1/ai/adapt/formats', async (req, res) => {
  try {
    const result = openaiService.getAvailableFormats();
    res.json(result);
  } catch (error) {
    console.error('Error getting available formats:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'AI_FORMATS_ERROR',
        message: 'Failed to get available formats'
      }
    });
  }
});

// System status endpoint
app.get('/api/v1/system/status', async (req, res) => {
  try {
    const factory = StorageFactory.getInstance();
    const storageInfo = await factory.getStorageInfo();

    const systemStatus = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      storage: storageInfo,
      version: '1.0.0',
      features: {
        supabase_ready: storageInfo.type === 'supabase' && storageInfo.status === 'connected',
        local_storage: storageInfo.type === 'local',
        ai_integration: openaiService.isReady(),
        openai_configured: !!process.env.OPENAI_API_KEY
      }
    };

    res.json(systemStatus);
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error.message
    });
  }
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