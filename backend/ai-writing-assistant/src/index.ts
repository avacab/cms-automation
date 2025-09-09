import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import rateLimit from 'express-rate-limit';
import { ServiceConfig } from './types/index.js';
import routes, { initializeServices } from './routes/index.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5002;

// Configuration
const config: ServiceConfig = {
  port: parseInt(PORT as string),
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  redisUrl: process.env.REDIS_URL,
  logLevel: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
  ai: {
    provider: 'openai',
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    apiKey: process.env.OPENAI_API_KEY || '',
    baseURL: process.env.OPENAI_BASE_URL,
    defaultParams: {
      temperature: parseFloat(process.env.AI_TEMPERATURE || '0.7'),
      maxTokens: parseInt(process.env.AI_MAX_TOKENS || '2000'),
      topP: parseFloat(process.env.AI_TOP_P || '0.9')
    }
  },
  rateLimits: {
    suggestions: {
      windowMs: 60 * 1000, // 1 minute
      max: parseInt(process.env.RATE_LIMIT_SUGGESTIONS || '30')
    },
    generation: {
      windowMs: 60 * 1000, // 1 minute  
      max: parseInt(process.env.RATE_LIMIT_GENERATION || '10')
    }
  }
};

// Initialize services
initializeServices(config);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
app.use(cors({
  origin: [config.corsOrigin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  optionsSuccessStatus: 200
}));

// General middleware
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const suggestionLimiter = rateLimit({
  windowMs: config.rateLimits.suggestions.windowMs,
  max: config.rateLimits.suggestions.max,
  message: {
    error: 'Too many suggestion requests',
    message: 'Please wait before making more suggestions requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

const generationLimiter = rateLimit({
  windowMs: config.rateLimits.generation.windowMs,
  max: config.rateLimits.generation.max,
  message: {
    error: 'Too many generation requests',
    message: 'Please wait before making more content generation requests'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Apply rate limiting to specific routes
app.use('/api/v1/suggestions', suggestionLimiter);
app.use('/api/v1/generate', generationLimiter);
app.use('/api/v1/improve', generationLimiter);
app.use('/api/v1/continue', generationLimiter);
app.use('/api/v1/adapt', generationLimiter);

// Health check endpoint (before rate limiting)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'ai-writing-assistant',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    config: {
      aiProvider: config.ai.provider,
      model: config.ai.model,
      rateLimits: {
        suggestions: `${config.rateLimits.suggestions.max} per minute`,
        generation: `${config.rateLimits.generation.max} per minute`
      }
    }
  });
});

// API documentation endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'AI Writing Assistant API',
    version: '1.0.0',
    description: 'Intelligent writing assistance with brand voice consistency, real-time suggestions, and multi-format content adaptation',
    documentation: {
      baseUrl: `${req.protocol}://${req.get('host')}`,
      endpoints: {
        health: 'GET /health',
        suggestions: 'POST /api/v1/suggestions',
        generate: 'POST /api/v1/generate', 
        improve: 'POST /api/v1/improve',
        continue: 'POST /api/v1/continue',
        adapt: 'POST /api/v1/adapt',
        adaptFormats: 'GET /api/v1/adapt/formats',
        brandVoice: {
          train: 'POST /api/v1/brand-voice/train',
          check: 'POST /api/v1/brand-voice/:id/check'
        },
        templates: {
          list: 'GET /api/v1/templates',
          get: 'GET /api/v1/templates/:id',
          generate: 'POST /api/v1/templates/:id/generate',
          analyze: 'POST /api/v1/templates/:id/analyze',
          suggestions: 'POST /api/v1/templates/suggestions'
        }
      }
    },
    features: [
      'Real-time writing suggestions (grammar, style, SEO, engagement)',
      'AI content generation with brand voice consistency',
      'Content improvement and continuation',
      'Multi-format content adaptation (social media, email, etc.)',
      'Brand voice training and analysis',
      'Content template intelligence',
      'Template-based content generation'
    ],
    examples: {
      suggestions: {
        endpoint: 'POST /api/v1/suggestions',
        payload: {
          content: 'Your content text here...',
          brandVoiceId: 'optional-brand-voice-id',
          options: {
            includeGrammar: true,
            includeSEO: true,
            includeEngagement: true,
            includeBrandVoice: true
          }
        }
      },
      generate: {
        endpoint: 'POST /api/v1/generate',
        payload: {
          type: 'complete',
          input: {
            prompt: 'Write a blog post about AI in content marketing'
          },
          options: {
            brandVoiceId: 'optional-brand-voice-id',
            maxTokens: 1000,
            temperature: 0.7
          }
        }
      },
      adapt: {
        endpoint: 'POST /api/v1/adapt',
        payload: {
          originalText: 'Your original content...',
          targetFormats: [
            { format: 'twitter', platform: 'twitter' },
            { format: 'email-subject', constraints: { maxLength: 50 } }
          ],
          brandVoiceId: 'optional-brand-voice-id'
        }
      }
    }
  });
});

// API routes
app.use('/api/v1', routes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.originalUrl} not found`
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestId: Math.random().toString(36).substr(2, 9)
    }
  });
});

// Global error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  
  // Don't leak error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: isDevelopment ? err.message : 'An unexpected error occurred',
      details: isDevelopment ? err.stack : undefined
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestId: Math.random().toString(36).substr(2, 9)
    }
  });
});

// Validate configuration
function validateConfig(config: ServiceConfig): void {
  const errors = [];
  
  if (!config.ai.apiKey) {
    errors.push('OPENAI_API_KEY environment variable is required');
  }
  
  if (config.ai.defaultParams.temperature < 0 || config.ai.defaultParams.temperature > 1) {
    errors.push('AI_TEMPERATURE must be between 0 and 1');
  }
  
  if (config.ai.defaultParams.maxTokens < 50 || config.ai.defaultParams.maxTokens > 4000) {
    errors.push('AI_MAX_TOKENS must be between 50 and 4000');
  }
  
  if (errors.length > 0) {
    console.error('Configuration errors:');
    errors.forEach(error => console.error(`- ${error}`));
    process.exit(1);
  }
}

// Start server
function startServer() {
  try {
    validateConfig(config);
    
    server.listen(PORT, () => {
      console.log(`🤖 AI Writing Assistant API server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/health`);
      console.log(`📖 API docs: http://localhost:${PORT}/`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔧 AI Provider: ${config.ai.provider} (${config.ai.model})`);
      console.log(`⚡ Rate limits: ${config.rateLimits.suggestions.max} suggestions/min, ${config.rateLimits.generation.max} generations/min`);
      
      if (!config.ai.apiKey) {
        console.warn('⚠️  Warning: No OpenAI API key configured. AI features will not work.');
      }
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  
  server.close((err) => {
    if (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
    
    console.log('AI Writing Assistant API server closed');
    process.exit(0);
  });
  
  // Force close after 30 seconds
  setTimeout(() => {
    console.error('Could not close server gracefully, forcing shutdown');
    process.exit(1);
  }, 30000);
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();

export default app;