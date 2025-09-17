import express from 'express';
// import { OptimizelyAdapter } from '../../optimizely-integration/src/adapters/OptimizelyAdapter.js';
// import { OptimizelyAuthService } from '../../optimizely-integration/src/services/OptimizelyAuthService.js';
// import { OptimizelyExperimentService } from '../../optimizely-integration/src/services/OptimizelyExperimentService.js';
// import { AIService } from '../../ai-writing-assistant/src/services/AIService.js';

const router = express.Router();

// Initialize services (should be done via dependency injection in production)
let optimizelyAdapter: any = null;
let authService: any = null;
let experimentService: any = null;

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      service: 'Optimizely Integration API (MVP)',
      status: 'file_storage_ready',
      initialized: false,
      experimentsAvailable: false,
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * Initialize Optimizely connection
 */
router.post('/initialize', async (req, res) => {
  try {
    const { clientId, clientSecret, apiEndpoint, cmsEndpoint } = req.body;
    
    if (!clientId || !clientSecret || !apiEndpoint || !cmsEndpoint) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: clientId, clientSecret, apiEndpoint, cmsEndpoint'
      });
    }

    // MVP: Temporarily disabled for file-storage testing
    // optimizelyAdapter = new OptimizelyAdapter({
    //   clientId,
    //   clientSecret,
    //   apiEndpoint,
    //   cmsEndpoint,
    //   enableExperiments: true,
    //   enablePersonalization: true
    // });

    // authService = optimizelyAdapter['authService'];
    // experimentService = new OptimizelyExperimentService(authService, apiEndpoint);

    // const result = await optimizelyAdapter.initialize();
    
    const result = { success: false, error: 'MVP mode - Optimizely features temporarily disabled' };
    
    res.json({
      success: result.success,
      error: result.error,
      data: result.success ? {
        initialized: true,
        experimentsEnabled: true,
        personalizationEnabled: true
      } : null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Test connection to Optimizely
 */
router.get('/connection/test', async (req, res) => {
  try {
    if (!optimizelyAdapter) {
      return res.status(400).json({
        success: false,
        error: 'Optimizely adapter not initialized. Call /initialize first.'
      });
    }

    const result = await optimizelyAdapter.testConnection();
    
    res.json({
      success: result.success,
      data: result.data,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get adapter statistics
 */
router.get('/stats', async (req, res) => {
  try {
    if (!optimizelyAdapter) {
      return res.status(400).json({
        success: false,
        error: 'Optimizely adapter not initialized'
      });
    }

    const stats = optimizelyAdapter.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create blog post content
 */
router.post('/blog/create', async (req, res) => {
  try {
    if (!optimizelyAdapter) {
      return res.status(400).json({
        success: false,
        error: 'Optimizely adapter not initialized'
      });
    }

    const blogData = req.body;
    
    if (!blogData.title && !blogData.topic) {
      return res.status(400).json({
        success: false,
        error: 'Either title or topic is required'
      });
    }

    // Generate content using AI if only topic is provided
    let contentData = blogData;
    if (!blogData.content && blogData.topic) {
      const aiRequest = {
        type: 'complete' as const,
        input: {
          prompt: `Write a comprehensive blog post about: ${blogData.topic}`,
          context: blogData.context || ''
        },
        options: {
          brandVoiceId: blogData.brandVoiceId,
          targetLength: blogData.targetLength || 1000,
          keywords: blogData.keywords,
          targetTone: blogData.tone,
          maxTokens: 2500
        }
      };

      const aiResponse = await aiService.generateContent(aiRequest);
      
      // Parse AI response
      const titleMatch = aiResponse.text.match(/^#\s*(.+)$/m);
      const title = titleMatch ? titleMatch[1] : blogData.topic;
      
      contentData = {
        ...blogData,
        title: blogData.title || title,
        content: aiResponse.text,
        excerpt: aiResponse.text.substring(0, 200) + '...'
      };
    }

    const result = await optimizelyAdapter.sendContentToOptimizely(contentData);
    
    res.json({
      success: result.success,
      data: result.success ? {
        contentId: result.contentId,
        optimizelyId: result.optimizelyId,
        url: result.url
      } : null,
      error: result.error,
      warnings: result.warnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Generate content variations for A/B testing
 */
router.post('/generate-variations', async (req, res) => {
  try {
    const { baseContent, variationCount = 2, strategy = 'audience', brandVoiceId } = req.body;
    
    if (!baseContent || !baseContent.title || !baseContent.content) {
      return res.status(400).json({
        success: false,
        error: 'Base content with title and content is required'
      });
    }

    const variations = [];

    for (let i = 0; i < variationCount; i++) {
      let prompt = '';
      
      switch (strategy) {
        case 'audience':
          const audiences = ['new customers', 'returning customers', 'power users', 'budget-conscious shoppers'];
          prompt = `Rewrite this blog post to better appeal to ${audiences[i % audiences.length]}:\n\n${baseContent.content}`;
          break;
          
        case 'tone':
          const tones = ['more conversational', 'more professional', 'more urgent', 'more friendly'];
          prompt = `Rewrite this blog post with a ${tones[i % tones.length]} tone:\n\n${baseContent.content}`;
          break;
          
        case 'structure':
          const structures = ['with more bullet points', 'with numbered lists', 'with more subheadings', 'with a story format'];
          prompt = `Rewrite this blog post ${structures[i % structures.length]}:\n\n${baseContent.content}`;
          break;
          
        case 'cta':
          const ctas = ['stronger call-to-action', 'multiple call-to-actions', 'softer call-to-action', 'question-based call-to-action'];
          prompt = `Rewrite this blog post with a ${ctas[i % ctas.length]}:\n\n${baseContent.content}`;
          break;
          
        default:
          prompt = `Create a variation of this blog post with different wording and structure:\n\n${baseContent.content}`;
      }

      try {
        const aiRequest = {
          type: 'rewrite' as const,
          input: {
            text: baseContent.content,
            context: prompt
          },
          options: {
            brandVoiceId,
            maxTokens: 2500,
            temperature: 0.8
          }
        };

        const aiResponse = await aiService.generateContent(aiRequest);
        
        // Extract title and content
        const titleMatch = aiResponse.text.match(/^#\s*(.+)$/m);
        const title = titleMatch ? titleMatch[1] : `${baseContent.title} (Variation ${i + 1})`;
        
        variations.push({
          title: title,
          content: aiResponse.text,
          excerpt: aiResponse.text.substring(0, 200) + '...',
          strategy: strategy,
          confidence: aiResponse.confidence || 0.8
        });
      } catch (error) {
        console.error(`Error generating variation ${i + 1}:`, error);
        // Add fallback variation
        variations.push({
          title: `${baseContent.title} (Variation ${i + 1})`,
          content: baseContent.content,
          excerpt: baseContent.excerpt,
          strategy: strategy,
          confidence: 0.5,
          error: 'Failed to generate AI variation'
        });
      }
    }

    res.json({
      success: true,
      data: {
        variations,
        strategy,
        baseContent
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Create A/B test experiment
 */
router.post('/experiments/create', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const experimentConfig = req.body;
    
    if (!experimentConfig.name || !experimentConfig.variations || experimentConfig.variations.length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Experiment name and at least 2 variations are required'
      });
    }

    const result = await experimentService.createExperiment({
      config: experimentConfig,
      startImmediately: experimentConfig.startImmediately || false
    });
    
    res.json({
      success: result.success,
      data: result.success ? {
        experimentId: result.experimentId
      } : null,
      error: result.error,
      warnings: result.warnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get experiment details
 */
router.get('/experiments/:experimentId', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const result = await experimentService.getExperiment(experimentId);
    
    res.json({
      success: result.success,
      data: result.experiment,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Start experiment
 */
router.post('/experiments/:experimentId/start', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const result = await experimentService.startExperiment(experimentId);
    
    res.json({
      success: result.success,
      data: result.success ? { experimentId } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Stop experiment
 */
router.post('/experiments/:experimentId/stop', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const { reason } = req.body;
    
    const result = await experimentService.stopExperiment(experimentId, reason);
    
    res.json({
      success: result.success,
      data: result.success ? { experimentId } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Get experiment results
 */
router.get('/experiments/:experimentId/results', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const result = await experimentService.getExperimentResults(experimentId);
    
    res.json({
      success: result.success,
      data: result.results,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * List experiments
 */
router.get('/experiments', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { status, contentId, limit } = req.query;
    
    const result = await experimentService.listExperiments({
      status: status as string,
      contentId: contentId ? parseInt(contentId as string) : undefined,
      limit: limit ? parseInt(limit as string) : undefined
    });
    
    res.json({
      success: result.success,
      data: result.experiments,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Record experiment event
 */
router.post('/experiments/:experimentId/events', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const { variationId, eventType, value } = req.body;
    
    if (!variationId || !eventType) {
      return res.status(400).json({
        success: false,
        error: 'variationId and eventType are required'
      });
    }

    const result = await experimentService.recordEvent(experimentId, variationId, eventType, value);
    
    res.json({
      success: result.success,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Complete experiment
 */
router.post('/experiments/:experimentId/complete', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const { winningVariationId } = req.body;
    
    const result = await experimentService.completeExperiment(experimentId, winningVariationId);
    
    res.json({
      success: result.success,
      data: result.success ? { experimentId } : null,
      error: result.error,
      warnings: result.warnings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Update experiment configuration
 */
router.put('/experiments/:experimentId', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const updates = req.body;
    
    const result = await experimentService.updateExperiment(experimentId, updates);
    
    res.json({
      success: result.success,
      data: result.success ? { experimentId } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Delete experiment
 */
router.delete('/experiments/:experimentId', async (req, res) => {
  try {
    if (!experimentService) {
      return res.status(400).json({
        success: false,
        error: 'Experiment service not initialized'
      });
    }

    const { experimentId } = req.params;
    const { force } = req.query;
    
    const result = await experimentService.deleteExperiment(experimentId, force === 'true');
    
    res.json({
      success: result.success,
      data: result.success ? { experimentId } : null,
      error: result.error
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * Bulk sync content to Optimizely
 */
router.post('/sync/bulk', async (req, res) => {
  try {
    if (!optimizelyAdapter) {
      return res.status(400).json({
        success: false,
        error: 'Optimizely adapter not initialized'
      });
    }

    const { contents } = req.body;
    
    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({
        success: false,
        error: 'Contents array is required'
      });
    }

    const results = await optimizelyAdapter.bulkSyncToOptimizely(contents);
    
    res.json({
      success: true,
      data: {
        results,
        total: contents.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check is already defined above

export default router;