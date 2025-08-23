import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 5002;

// Configuration
const CMS_API_URL = process.env.CMS_API_URL || 'http://localhost:5000';

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'cms-orchestrator',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Routes
app.get('/', (req, res) => {
  res.json({
    message: 'CMS Experience Orchestrator is running',
    version: '1.0.0',
    capabilities: [
      'Content personalization',
      'Experience optimization',
      'Journey orchestration',
      'A/B testing'
    ]
  });
});

// Experience endpoints
app.get('/api/experience/personalize/:contentId', async (req, res) => {
  try {
    const { contentId } = req.params;
    const { userId, context } = req.query;

    // Simulate personalization logic
    const personalizedContent = {
      original_content_id: contentId,
      personalized_for: userId || 'anonymous',
      context: context || 'default',
      personalization_rules: [
        'Location-based content variation',
        'User preference optimization',
        'Engagement history analysis'
      ],
      modified_at: new Date().toISOString(),
      confidence_score: 0.85
    };

    res.json({
      success: true,
      data: personalizedContent
    });
  } catch (error) {
    console.error('Personalization error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to personalize content'
    });
  }
});

// A/B Testing endpoint
app.get('/api/experience/ab-test/:experimentId', (req, res) => {
  const { experimentId } = req.params;
  const { userId } = req.query;

  // Simple A/B test logic
  const variants = ['A', 'B'];
  const selectedVariant = variants[Math.floor(Math.random() * variants.length)];

  res.json({
    success: true,
    data: {
      experiment_id: experimentId,
      user_id: userId || 'anonymous',
      variant: selectedVariant,
      timestamp: new Date().toISOString()
    }
  });
});

// Content recommendations
app.get('/api/experience/recommendations', async (req, res) => {
  try {
    const { userId, context, limit = 5 } = req.query;

    // Fetch content from CMS API
    const cmsResponse = await axios.get(`${CMS_API_URL}/api/v1/content`);
    const allContent = cmsResponse.data.data || [];

    // Simple recommendation logic (in real app, use ML/AI)
    const recommendations = allContent
      .sort(() => Math.random() - 0.5)
      .slice(0, parseInt(limit as string))
      .map((content: any) => ({
        ...content,
        recommendation_score: Math.random(),
        reason: 'Based on user preferences and behavior'
      }));

    res.json({
      success: true,
      data: {
        recommendations,
        context: context || 'default',
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations'
    });
  }
});

// Journey tracking
app.post('/api/experience/track', (req, res) => {
  const { event, userId, contentId, metadata } = req.body;

  // Simulate event tracking
  const trackingData = {
    event_id: `evt_${Date.now()}`,
    event,
    user_id: userId,
    content_id: contentId,
    metadata: metadata || {},
    timestamp: new Date().toISOString(),
    session_id: req.headers['x-session-id'] || 'anonymous'
  };

  console.log('Tracking event:', trackingData);

  res.json({
    success: true,
    message: 'Event tracked successfully',
    data: trackingData
  });
});

// Content optimization
app.get('/api/experience/optimize/:contentId', (req, res) => {
  const { contentId } = req.params;
  const { device, location, timeOfDay } = req.query;

  const optimizations = {
    content_id: contentId,
    optimizations: [
      {
        type: 'device_optimization',
        applied: device === 'mobile' ? 'mobile_friendly_layout' : 'desktop_layout'
      },
      {
        type: 'performance_optimization',
        applied: 'lazy_loading_images'
      },
      {
        type: 'seo_optimization',
        applied: 'dynamic_meta_tags'
      }
    ],
    performance_score: 92,
    applied_at: new Date().toISOString()
  };

  res.json({
    success: true,
    data: optimizations
  });
});

// Analytics endpoint
app.get('/api/experience/analytics', (req, res) => {
  const { timeRange = '7d', metric = 'all' } = req.query;

  const analytics = {
    time_range: timeRange,
    metrics: {
      total_experiences_served: 1250,
      personalization_accuracy: 0.87,
      ab_test_conversion_lift: 0.15,
      average_engagement_time: 145, // seconds
      bounce_rate_improvement: 0.23
    },
    top_performing_content: [
      { id: 1, title: 'Welcome Page', engagement_score: 0.94 },
      { id: 2, title: 'Getting Started', engagement_score: 0.89 }
    ],
    generated_at: new Date().toISOString()
  };

  res.json({
    success: true,
    data: analytics
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
  console.log(`🎭 CMS Experience Orchestrator running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/health`);
  console.log(`📖 API docs: http://localhost:${PORT}/`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 Connected to CMS API: ${CMS_API_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
  });
});

export default app;