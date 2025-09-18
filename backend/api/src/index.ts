import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { OpenAIService } from './services/OpenAIService.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5000;

// Initialize OpenAI service
const openAIService = new OpenAIService();

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

    // Generate a unique ID for the content
    const contentId = content.id || `content-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Prepare content data for insertion
    const contentData = {
      id: contentId,
      title: content.title,
      content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
      status: content.status || 'draft',
      content_type_id: content.content_type_id || 'blog-post',
      published_at: content.status === 'published' ? new Date().toISOString() : null,
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

    // Note: slug generation removed as 'slug' column doesn't exist in content_items table

    // Prepare content data for update
    const contentData = {
      title: content.title,
      content: typeof content.content === 'string' ? content.content : JSON.stringify(content.content),
      status: content.status || 'draft',
      content_type_id: content.content_type_id || 'blog-post',
      published_at: content.status === 'published' && !content.published_at ? new Date().toISOString() : content.published_at,
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
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'marketing'
      },
      {
        id: 'wordpress',
        name: 'WordPress Integration', 
        description: 'Publish content to WordPress sites',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'publishing'
      },
      {
        id: 'drupal',
        name: 'Drupal Integration',
        description: 'Headless CMS bridge for Drupal sites',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'publishing'
      },
      {
        id: 'shopify',
        name: 'Shopify Integration',
        description: 'E-commerce content sync with Shopify',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'ecommerce'
      },
      {
        id: 'wix',
        name: 'Wix Plugin',
        description: 'AI-powered content enhancement for Wix',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'website-builder'
      },
      {
        id: 'ai-writing-assistant',
        name: 'AI Writing Assistant',
        description: 'Advanced AI-powered content generation and optimization',
        status: 'active',
        enabled: true,
        version: '1.2.0',
        author: 'CMS Team',
        type: 'ai-tools'
      },
      {
        id: 'seo-optimizer',
        name: 'SEO Optimization',
        description: 'Automated SEO analysis and content optimization',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'seo'
      },
      {
        id: 'content-adaptation',
        name: 'Content Adaptation',
        description: 'Multi-format content transformation and adaptation',
        status: 'active',
        enabled: true,
        version: '1.1.0',
        author: 'CMS Team',
        type: 'transformation'
      },
      {
        id: 'media-manager',
        name: 'Media Management',
        description: 'Advanced media library and asset management',
        status: 'inactive',
        enabled: false,
        version: '1.0.0',
        author: 'CMS Team',
        type: 'media'
      }
    ]
  });
});

// AI Generation endpoint (temporarily disabled)
app.post('/api/v1/ai/generate', async (req, res) => {
  try {
    // Handle both flat structure and frontend's nested structure
    const prompt = req.body.prompt || req.body.content?.prompt || req.body.input?.prompt;
    const text = req.body.text || req.body.content?.text || req.body.input?.text;
    const context = req.body.context || req.body.content?.context || req.body.input?.context;
    const type = req.body.type || req.body.generationType;
    const keywords = req.body.keywords || req.body.options?.keywords;
    const targetLength = req.body.options?.targetLength;
    const targetTone = req.body.options?.targetTone;
    
    if (!prompt && !text) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Prompt or text content is required'
        }
      });
    }

    // Use OpenAI service for content generation
    if (!openAIService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'OpenAI service is not configured. Please set OPENAI_API_KEY environment variable.'
        }
      });
    }

    // Prepare request for OpenAI service
    const openAIRequest = {
      type: type as 'complete' | 'continue' | 'rewrite' | 'improve' | 'adapt',
      context: {
        prompt: prompt || context || 'Generate content',
        existingContent: text,
        targetLength: targetLength,
        targetTone: targetTone,
        keywords: keywords
      },
      options: {
        maxTokens: req.body.options?.maxTokens || Math.min(4000, (targetLength || 500) * 2),
        temperature: req.body.options?.temperature || 0.7
      }
    };

    const result = await openAIService.generateContent(openAIRequest);
    
    if (!result.success) {
      console.error('OpenAI generation failed:', result.error);
      
      // Return appropriate HTTP status codes based on error type
      let statusCode = 500;
      let userMessage = 'An error occurred while generating content';
      
      if (result.error?.code === 'INVALID_API_KEY') {
        statusCode = 503;
        userMessage = 'AI service is currently unavailable. Please contact support if this persists.';
      } else if (result.error?.code === 'RATE_LIMITED') {
        statusCode = 429;
        userMessage = 'AI service is temporarily overloaded. Please try again in a moment.';
      } else if (result.error?.code === 'ACCESS_DENIED') {
        statusCode = 403;
        userMessage = 'AI service access is restricted. Please contact support.';
      } else if (result.error?.code === 'OPENAI_API_ERROR') {
        statusCode = 503;
        userMessage = 'AI service is temporarily unavailable. Please try again later.';
      }
      
      return res.status(statusCode).json({
        success: false,
        error: {
          code: result.error?.code || 'AI_GENERATION_ERROR',
          message: userMessage,
          details: process.env.NODE_ENV === 'development' ? result.error : undefined
        }
      });
    }

    // Generate alternatives by calling OpenAI multiple times with different temperatures
    const alternatives = [];
    for (let i = 0; i < 2; i++) {
      try {
        const altRequest = {
          ...openAIRequest,
          options: {
            ...openAIRequest.options,
            temperature: 0.8 + (i * 0.1) // Vary temperature for alternatives
          }
        };
        const altResult = await openAIService.generateContent(altRequest);
        if (altResult.success) {
          alternatives.push(altResult.data.content);
        }
      } catch (error) {
        console.log('Failed to generate alternative:', error);
      }
    }

    const response = {
      success: true,
      data: {
        generatedContent: result.data.content,
        alternatives: alternatives,
        usage: result.data.usage,
        model: result.data.model
      }
    };

    res.json(response);

  } catch (error) {
    console.error('Error in AI generate endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while generating content'
      }
    });
  }
});

// AI Writing Suggestions endpoint
app.post('/api/v1/ai/suggestions', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (!content) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Content is required for analysis'
        }
      });
    }

    // Use OpenAI service for writing suggestions
    if (!openAIService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'OpenAI service is not configured. Please set OPENAI_API_KEY environment variable.'
        }
      });
    }

    const result = await openAIService.getWritingSuggestions({
      content: content
    });

    if (!result.success) {
      console.error('OpenAI suggestions failed:', result.error);
      return res.status(500).json({
        success: false,
        error: result.error
      });
    }

    // Convert OpenAI suggestions to frontend format
    const suggestions = result.data.suggestions?.map((suggestion: any, index: number) => ({
      id: `suggestion-${index + 1}`,
      type: suggestion.type || 'style',
      severity: suggestion.severity || 'medium',
      confidence: 0.8, // OpenAI doesn't provide confidence, use default
      original: suggestion.issue || 'content section',
      suggestion: suggestion.suggestion,
      reason: suggestion.issue,
      position: { start: index * 10, end: (index + 1) * 10 } // Mock positions since we don't have text analysis
    })) || [];

    res.json({
      success: true,
      data: {
        suggestions: suggestions,
        overallScore: result.data.overallScore || 7,
        summary: result.data.summary || 'Content analysis completed',
        usage: result.data.usage
      }
    });

  } catch (error) {
    console.error('Error in AI suggestions endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while analyzing content'
      }
    });
  }
});

// AI Content Adaptation endpoint  
app.post('/api/v1/ai/adapt', async (req, res) => {
  try {
    const { originalText, targetFormats } = req.body;
    
    if (!originalText || !targetFormats) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Original text and target formats are required'
        }
      });
    }

    // Use OpenAI service for content adaptation
    if (!openAIService.isReady()) {
      return res.status(503).json({
        success: false,
        error: {
          code: 'AI_SERVICE_UNAVAILABLE',
          message: 'OpenAI service is not configured. Please set OPENAI_API_KEY environment variable.'
        }
      });
    }

    const adaptedContent = {};
    
    // Adapt content for each target format
    for (const format of targetFormats) {
      try {
        const result = await openAIService.adaptContent({
          content: originalText,
          targetFormat: format.format,
          customConstraints: format.constraints || {}
        });

        if (result.success) {
          adaptedContent[format.format] = {
            content: result.data.adaptedContent,
            metadata: {
              format: format.format,
              originalFormat: result.data.originalFormat,
              wordCount: result.data.adaptedContent.split(' ').length,
              usage: result.data.usage
            }
          };
        } else {
          console.error(`Failed to adapt to ${format.format}:`, result.error);
          adaptedContent[format.format] = {
            content: `Failed to adapt content for ${format.format}: ${result.error?.message}`,
            metadata: {
              format: format.format,
              error: true
            }
          };
        }
      } catch (error) {
        console.error(`Error adapting to ${format.format}:`, error);
        adaptedContent[format.format] = {
          content: `Error adapting content for ${format.format}`,
          metadata: {
            format: format.format,
            error: true
          }
        };
      }
    }

    res.json({
      success: true,
      data: {
        adaptedContent,
        originalText
      }
    });

  } catch (error) {
    console.error('Error in AI adapt endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR', 
        message: 'An error occurred while adapting content'
      }
    });
  }
});

// AI Adaptation Formats endpoint
app.get('/api/v1/ai/adapt/formats', async (req, res) => {
  try {
    // Use OpenAI service for available formats
    const result = openAIService.getAvailableFormats();
    res.json(result);

  } catch (error) {
    console.error('Error in AI formats endpoint:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An error occurred while fetching formats'
      }
    });
  }
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