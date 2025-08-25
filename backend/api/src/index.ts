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

// In-memory content store (for development - replace with database in production)
let contentItems = [
  {
    id: 1,
    title: 'Welcome to your CMS',
    slug: 'welcome',
    content: 'This is your first content item.',
    status: 'published' as const,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: 'Getting Started',
    slug: 'getting-started',
    content: 'Learn how to use your headless CMS.',
    status: 'published' as const,
    created_at: new Date().toISOString()
  }
];
let nextContentId = 3;

// Helper function to generate slug from title
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
    message: 'Content endpoint',
    data: contentItems
  });
});

// Get single content item by ID
app.get('/api/v1/content/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const item = contentItems.find(item => item.id === id);
  
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
});

// Create new content item
app.post('/api/v1/content', (req, res) => {
  const { content: contentData } = req.body;
  
  if (!contentData || !contentData.title) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Title is required'
    });
  }
  
  const newItem = {
    id: nextContentId++,
    title: contentData.title,
    slug: contentData.slug || generateSlug(contentData.title),
    content: contentData.content || '',
    status: contentData.status || 'draft' as const,
    created_at: new Date().toISOString()
  };
  
  contentItems.push(newItem);
  
  res.status(201).json({
    message: 'Content item created successfully',
    data: newItem
  });
});

// Update content item
app.put('/api/v1/content/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { content: contentData } = req.body;
  const itemIndex = contentItems.findIndex(item => item.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Content item with ID ${id} not found`
    });
  }
  
  if (!contentData || !contentData.title) {
    return res.status(400).json({
      error: 'Bad Request',
      message: 'Title is required'
    });
  }
  
  const updatedItem = {
    ...contentItems[itemIndex],
    title: contentData.title,
    slug: contentData.slug || generateSlug(contentData.title),
    content: contentData.content || contentItems[itemIndex].content,
    status: contentData.status || contentItems[itemIndex].status
  };
  
  contentItems[itemIndex] = updatedItem;
  
  res.json({
    message: 'Content item updated successfully',
    data: updatedItem
  });
});

// Delete content item
app.delete('/api/v1/content/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const itemIndex = contentItems.findIndex(item => item.id === id);
  
  if (itemIndex === -1) {
    return res.status(404).json({
      error: 'Not Found',
      message: `Content item with ID ${id} not found`
    });
  }
  
  const deletedItem = contentItems.splice(itemIndex, 1)[0];
  
  res.json({
    message: 'Content item deleted successfully',
    data: {
      success: true,
      message: `Content item "${deletedItem.title}" has been deleted`
    }
  });
});

// Content types endpoint
app.get('/api/v1/content-types', (req, res) => {
  res.json({
    message: 'Content types endpoint',
    data: [
      {
        id: 1,
        name: 'Page',
        slug: 'page',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'richtext', required: true },
          { name: 'meta_description', type: 'text', required: false }
        ]
      },
      {
        id: 2,
        name: 'Blog Post',
        slug: 'blog-post',
        fields: [
          { name: 'title', type: 'text', required: true },
          { name: 'content', type: 'richtext', required: true },
          { name: 'excerpt', type: 'textarea', required: false },
          { name: 'featured_image', type: 'image', required: false }
        ]
      }
    ]
  });
});

// Media endpoint
app.get('/api/v1/media', (req, res) => {
  res.json({
    message: 'Media endpoint',
    data: []
  });
});

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