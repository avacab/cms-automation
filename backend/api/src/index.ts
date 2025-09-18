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
  origin: [
    'http://localhost:3000',
    'https://cms-automation-frontend.vercel.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean),
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
import { createClient } from '@supabase/supabase-js';
// import { StorageFactory } from './services/StorageFactory.js';
// import { OpenAIService } from './services/OpenAIService.js';
// import systemRoutes from './routes/system.js';
// import optimizelyRoutes from '../routes/optimizely.js';

// Initialize services
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
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

// Test endpoint
app.get('/api/v1/test', (req, res) => {
  res.json({ message: 'Test works' });
});

// Debug environment variables
app.get('/api/v1/debug/env', (req, res) => {
  res.json({
    storage_type: process.env.STORAGE_TYPE,
    node_env: process.env.NODE_ENV,
    has_supabase_url: !!process.env.SUPABASE_URL,
    has_supabase_key: !!process.env.SUPABASE_SERVICE_KEY,
    supabase_url_preview: process.env.SUPABASE_URL ? process.env.SUPABASE_URL.substring(0, 30) + '...' : 'missing',
    cors_origin: process.env.CORS_ORIGIN
  });
});

// Frontend connectivity test endpoint
app.get('/api/v1/debug/frontend-test', (req, res) => {
  res.json({
    success: true,
    message: 'Frontend can reach backend API',
    timestamp: new Date().toISOString(),
    origin: req.headers.origin,
    user_agent: req.headers['user-agent'],
    method: req.method,
    cors_headers: {
      'Access-Control-Allow-Origin': res.getHeader('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Credentials': res.getHeader('Access-Control-Allow-Credentials')
    }
  });
});

// Direct Supabase connection test
app.get('/api/v1/debug/supabase', async (req, res) => {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL!, 
      process.env.SUPABASE_SERVICE_KEY!
    );
    
    // Test connection by querying content_types
    const { data, error } = await supabase
      .from('content_types')
      .select('*')
      .limit(5);
      
    if (error) {
      res.json({
        success: false,
        error: error.message,
        code: error.code,
        details: error.details
      });
    } else {
      res.json({
        success: true,
        data_count: data?.length || 0,
        sample_data: data?.[0] || null
      });
    }
  } catch (err: any) {
    res.json({
      success: false,
      error: err.message,
      stack: err.stack
    });
  }
});

// Content API routes
app.get('/api/v1/content', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Get real data from Supabase
    const { data, error } = await supabase
      .from('content_items')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      throw error;
    }
    
    res.json({
      message: 'Content endpoint (Supabase data)',
      data: data || []
    });
  } catch (error) {
    console.error('Supabase error, using sample data:', error);
    // Fallback to sample data
    res.json({
      message: 'Content endpoint (sample data)',
      data: [
        { id: '1', title: 'Test Content', status: 'published' }
      ]
    });
  }
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
app.post('/api/v1/content', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content data is required'
      });
    }

    // Validate required fields
    if (!content.title || !content.content) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title and content are required fields'
      });
    }

    // Generate slug from title if not provided
    const slug = content.slug || content.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    // Prepare content data for insertion
    const contentData = {
      title: content.title,
      slug: slug,
      content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
      status: content.status || 'draft',
      content_type_id: content.content_type_id || null,
      meta_description: content.meta_description || null,
      featured_image: content.featured_image || null,
      published_at: content.status === 'published' ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: null,
      updated_by: null
    };

    const { data, error } = await supabase
      .from('content_items')
      .insert([contentData])
      .select()
      .single();

    if (error) {
      console.error('Supabase error creating content:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: error.message || 'Failed to create content'
      });
    }

    res.status(201).json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error creating content:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Update content item
app.put('/api/v1/content/:id', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { id } = req.params;
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Bad Request',
        message: 'Content data is required'
      });
    }

    // Validate required fields
    if (!content.title || !content.content) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Title and content are required fields'
      });
    }

    // Generate slug from title if not provided
    const slug = content.slug || content.title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .trim();

    // Prepare content data for update
    const contentData = {
      title: content.title,
      slug: slug,
      content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
      status: content.status || 'draft',
      content_type_id: content.content_type_id || null,
      meta_description: content.meta_description || null,
      featured_image: content.featured_image || null,
      published_at: content.status === 'published' && !content.published_at ? new Date().toISOString() : content.published_at,
      updated_at: new Date().toISOString(),
      updated_by: null
    };

    const { data, error } = await supabase
      .from('content_items')
      .update(contentData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Supabase error updating content:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: error.message || 'Failed to update content'
      });
    }

    if (!data) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Content item not found'
      });
    }

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Delete content item
app.delete('/api/v1/content/:id', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }

    const { id } = req.params;
    
    // First check if the content exists
    const { data: existingContent, error: fetchError } = await supabase
      .from('content_items')
      .select('id, title')
      .eq('id', id)
      .single();

    if (fetchError || !existingContent) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Content item not found'
      });
    }

    // Delete the content
    const { error } = await supabase
      .from('content_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Supabase error deleting content:', error);
      return res.status(500).json({
        error: 'Database Error',
        message: error.message || 'Failed to delete content'
      });
    }

    res.json({
      success: true,
      message: `Content "${existingContent.title}" deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting content:', error);
    res.status(500).json({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'An unexpected error occurred'
    });
  }
});

// Content types endpoint
app.get('/api/v1/content-types', async (req, res) => {
  try {
    if (!supabase) {
      throw new Error('Supabase not configured');
    }
    
    // Get real data from Supabase
    const { data, error } = await supabase
      .from('content_types')
      .select('*')
      .eq('is_active', true)
      .order('name');
      
    if (error) {
      throw error;
    }
    
    res.json({
      message: 'Content types endpoint (Supabase data)',
      data: data || []
    });
  } catch (error) {
    console.error('Supabase error, using sample data:', error);
    // Fallback to sample data
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
  }
});

// Media endpoint
app.get('/api/v1/media', (req, res) => {
  res.json({
    message: 'Media endpoint (sample data)',
    data: []
  });
});

// Plugins endpoint
app.get('/api/v1/plugins', (req, res) => {
  res.json({
    message: 'Plugins endpoint',
    data: [
      {
        id: 'optimizely',
        name: 'Optimizely Integration',
        description: 'Content optimization and A/B testing',
        status: 'available',
        enabled: false
      },
      {
        id: 'wordpress',
        name: 'WordPress Integration', 
        description: 'Publish content to WordPress',
        status: 'available',
        enabled: false
      }
    ]
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