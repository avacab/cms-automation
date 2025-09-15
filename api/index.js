import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'cms-api-vercel',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'test'
  });
});

// System status endpoint
app.get('/system/status', async (req, res) => {
  try {
    const systemStatus = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'test',
      storage: {
        type: process.env.STORAGE_TYPE || 'supabase',
        status: 'connected',
        details: 'Vercel serverless deployment'
      },
      version: '1.0.0',
      features: {
        supabase_ready: !!(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY),
        local_storage: false,
        ai_integration: !!process.env.OPENAI_API_KEY
      }
    };

    res.json(systemStatus);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error.message
    });
  }
});

// Basic content endpoint placeholder
app.get('/content', (req, res) => {
  res.json({
    message: 'Content API endpoint (Vercel)',
    status: 'placeholder',
    note: 'Full content integration pending'
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

export default app;