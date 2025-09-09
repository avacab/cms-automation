import express from 'express';
import { AIService } from '../services/AIService.js';
import { BrandVoiceService } from '../services/BrandVoiceService.js';
import { TemplateService } from '../services/TemplateService.js';
import { ContentAdaptationService } from '../services/ContentAdaptationService.js';
import { 
  APIResponse, 
  AIGenerationRequest, 
  ContentAdaptationRequest,
  WritingSuggestion,
  ServiceConfig 
} from '../types/index.js';
import Joi from 'joi';

const router = express.Router();

// Services initialization
let aiService: AIService;
let brandVoiceService: BrandVoiceService;
let templateService: TemplateService;
let adaptationService: ContentAdaptationService;

// Initialize services
export function initializeServices(config: ServiceConfig) {
  aiService = new AIService(config);
  brandVoiceService = new BrandVoiceService();
  templateService = new TemplateService();
  adaptationService = new ContentAdaptationService(aiService);
}

// Validation schemas
const writingSuggestionsSchema = Joi.object({
  content: Joi.string().required().min(10).max(10000),
  brandVoiceId: Joi.string().optional(),
  options: Joi.object({
    includeGrammar: Joi.boolean().default(true),
    includeSEO: Joi.boolean().default(true),
    includeEngagement: Joi.boolean().default(true),
    includeBrandVoice: Joi.boolean().default(true)
  }).optional()
});

const generateContentSchema = Joi.object({
  type: Joi.string().valid('complete', 'continue', 'rewrite', 'improve', 'adapt').required(),
  input: Joi.object({
    text: Joi.string().optional().allow(''),
    prompt: Joi.string().optional().allow(''),
    context: Joi.string().optional().allow(''),
    targetFormat: Joi.string().optional().allow('')
  }).required(),
  options: Joi.object({
    brandVoiceId: Joi.string().optional().allow(''),
    templateId: Joi.string().optional().allow(''),
    maxTokens: Joi.number().min(50).max(4000).optional(),
    temperature: Joi.number().min(0).max(1).optional(),
    topP: Joi.number().min(0).max(1).optional(),
    targetLength: Joi.number().min(10).max(5000).optional(),
    targetTone: Joi.array().items(Joi.string()).optional(),
    keywords: Joi.array().items(Joi.string()).optional()
  }).optional()
});

const brandVoiceTrainingSchema = Joi.object({
  name: Joi.string().required().min(2).max(100),
  contentSamples: Joi.array().items(Joi.string().min(50)).min(1).max(10).required()
});

const contentAdaptationSchema = Joi.object({
  originalText: Joi.string().required().min(10).max(10000),
  targetFormats: Joi.array().items(
    Joi.object({
      format: Joi.string().required(),
      platform: Joi.string().optional(),
      constraints: Joi.object({
        maxLength: Joi.number().min(10).max(10000).optional(),
        tone: Joi.string().optional(),
        includeHashtags: Joi.boolean().optional(),
        includeEmojis: Joi.boolean().optional()
      }).optional()
    })
  ).min(1).max(10).required(),
  brandVoiceId: Joi.string().optional()
});

// Helper function to create API responses
function createResponse<T>(data?: T, error?: string): APIResponse<T> {
  return {
    success: !error,
    data,
    error: error ? { code: 'REQUEST_ERROR', message: error } : undefined,
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      requestId: Math.random().toString(36).substr(2, 9)
    }
  };
}

// Error handling middleware
function asyncHandler(fn: Function) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Routes

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  res.json(createResponse({
    status: 'healthy',
    service: 'ai-writing-assistant',
    timestamp: new Date().toISOString()
  }));
});

/**
 * Get real-time writing suggestions
 */
router.post('/suggestions', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { error, value } = writingSuggestionsSchema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { content, brandVoiceId, options = {} } = value;

  try {
    const suggestions = await aiService.generateWritingSuggestions(content, brandVoiceId);
    
    // Filter suggestions based on options
    const filteredSuggestions = suggestions.filter((suggestion: WritingSuggestion) => {
      if (!options.includeGrammar && suggestion.type === 'grammar') return false;
      if (!options.includeSEO && suggestion.type === 'seo') return false;
      if (!options.includeEngagement && suggestion.type === 'engagement') return false;
      if (!options.includeBrandVoice && suggestion.type === 'brand-voice') return false;
      return true;
    });

    res.json(createResponse({
      suggestions: filteredSuggestions,
      totalCount: filteredSuggestions.length,
      processingTime: Date.now() - Date.now() // This would be calculated properly
    }));
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json(createResponse(undefined, 'Failed to generate writing suggestions'));
  }
}));

/**
 * Generate AI content
 */
router.post('/generate', asyncHandler(async (req: express.Request, res: express.Response) => {
  console.log('Generate request body:', JSON.stringify(req.body, null, 2));
  const { error, value } = generateContentSchema.validate(req.body);
  if (error) {
    console.log('Validation error:', error.details[0].message);
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const request: AIGenerationRequest = value;

  try {
    const result = await aiService.generateContent(request);
    res.json(createResponse(result));
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json(createResponse(undefined, 'Failed to generate content'));
  }
}));

/**
 * Improve existing content
 */
router.post('/improve', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    content: Joi.string().required().min(10).max(10000),
    improvements: Joi.array().items(Joi.string()).min(1).required(),
    brandVoiceId: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { content, improvements, brandVoiceId } = value;

  try {
    const result = await aiService.improveContent(content, improvements, brandVoiceId);
    res.json(createResponse(result));
  } catch (error) {
    console.error('Error improving content:', error);
    res.status(500).json(createResponse(undefined, 'Failed to improve content'));
  }
}));

/**
 * Continue writing from partial content
 */
router.post('/continue', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    partialContent: Joi.string().required().min(10).max(5000),
    targetLength: Joi.number().min(50).max(2000).optional(),
    brandVoiceId: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { partialContent, targetLength, brandVoiceId } = value;

  try {
    const result = await aiService.continueWriting(partialContent, targetLength, brandVoiceId);
    res.json(createResponse(result));
  } catch (error) {
    console.error('Error continuing content:', error);
    res.status(500).json(createResponse(undefined, 'Failed to continue writing'));
  }
}));

/**
 * Adapt content to multiple formats
 */
router.post('/adapt', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { error, value } = contentAdaptationSchema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const request: ContentAdaptationRequest = value;

  try {
    const result = await adaptationService.adaptContent(request);
    res.json(createResponse(result));
  } catch (error) {
    console.error('Error adapting content:', error);
    res.status(500).json(createResponse(undefined, 'Failed to adapt content'));
  }
}));

/**
 * Get available adaptation formats
 */
router.get('/adapt/formats', (req, res) => {
  try {
    const formats = adaptationService.getAvailableFormats();
    res.json(createResponse({ formats }));
  } catch (error) {
    console.error('Error getting formats:', error);
    res.status(500).json(createResponse(undefined, 'Failed to get available formats'));
  }
});

// Brand Voice Routes

/**
 * Train new brand voice from content samples
 */
router.post('/brand-voice/train', asyncHandler(async (req: express.Request, res: express.Response) => {
  const { error, value } = brandVoiceTrainingSchema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { name, contentSamples } = value;

  try {
    const brandVoice = await brandVoiceService.trainBrandVoice(name, contentSamples);
    res.json(createResponse(brandVoice));
  } catch (error) {
    console.error('Error training brand voice:', error);
    res.status(500).json(createResponse(undefined, 'Failed to train brand voice'));
  }
}));

/**
 * Check brand voice match for content
 */
router.post('/brand-voice/:id/check', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    content: Joi.string().required().min(10).max(5000)
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { content } = value;
  const brandVoiceId = req.params.id;

  try {
    // In a real implementation, we'd fetch the brand voice from database
    // For now, return a mock response
    const mockBrandVoice = {
      id: brandVoiceId,
      name: 'Sample Brand Voice',
      tone: ['professional', 'friendly'],
      writingStyle: {
        formality: 'conversational' as const,
        complexity: 'moderate' as const,
        sentenceLength: 'medium' as const,
        vocabulary: 'advanced' as const
      },
      brandValues: ['quality', 'innovation'],
      avoidWords: ['cheap', 'basic'],
      preferredWords: ['premium', 'advanced'],
      exampleTexts: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const match = await brandVoiceService.checkBrandVoiceMatch(content, mockBrandVoice);
    res.json(createResponse(match));
  } catch (error) {
    console.error('Error checking brand voice match:', error);
    res.status(500).json(createResponse(undefined, 'Failed to check brand voice match'));
  }
}));

// Template Routes

/**
 * Get all available templates
 */
router.get('/templates', (req, res) => {
  try {
    const templates = templateService.getAllTemplates();
    res.json(createResponse({ templates }));
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json(createResponse(undefined, 'Failed to get templates'));
  }
});

/**
 * Get specific template
 */
router.get('/templates/:id', (req, res) => {
  try {
    const template = templateService.getTemplate(req.params.id);
    if (!template) {
      return res.status(404).json(createResponse(undefined, 'Template not found'));
    }
    res.json(createResponse(template));
  } catch (error) {
    console.error('Error getting template:', error);
    res.status(500).json(createResponse(undefined, 'Failed to get template'));
  }
});

/**
 * Generate content using template
 */
router.post('/templates/:id/generate', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    variables: Joi.object().optional(),
    brandVoiceId: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { variables = {}, brandVoiceId } = value;
  const templateId = req.params.id;

  try {
    const request = templateService.getTemplateGenerationRequest(templateId, variables, brandVoiceId);
    const result = await aiService.generateContent(request);
    res.json(createResponse(result));
  } catch (error) {
    console.error('Error generating template content:', error);
    res.status(500).json(createResponse(undefined, 'Failed to generate template content'));
  }
}));

/**
 * Analyze content against template
 */
router.post('/templates/:id/analyze', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    content: Joi.string().required().min(10).max(10000)
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { content } = value;
  const templateId = req.params.id;

  try {
    const analysis = templateService.analyzeTemplateMatch(content, templateId);
    res.json(createResponse(analysis));
  } catch (error) {
    console.error('Error analyzing template match:', error);
    res.status(500).json(createResponse(undefined, 'Failed to analyze template match'));
  }
}));

/**
 * Get template suggestions
 */
router.post('/templates/suggestions', asyncHandler(async (req: express.Request, res: express.Response) => {
  const schema = Joi.object({
    contentType: Joi.string().optional(),
    context: Joi.string().optional()
  });

  const { error, value } = schema.validate(req.body);
  if (error) {
    return res.status(400).json(createResponse(undefined, error.details[0].message));
  }

  const { contentType, context } = value;

  try {
    const suggestions = templateService.getTemplateSuggestions(contentType, context);
    res.json(createResponse({ suggestions }));
  } catch (error) {
    console.error('Error getting template suggestions:', error);
    res.status(500).json(createResponse(undefined, 'Failed to get template suggestions'));
  }
}));

// Error handling middleware
router.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('API Error:', error);
  
  if (error.name === 'ValidationError') {
    return res.status(400).json(createResponse(undefined, error.message));
  }
  
  if (error.name === 'UnauthorizedError') {
    return res.status(401).json(createResponse(undefined, 'Unauthorized'));
  }
  
  res.status(500).json(createResponse(undefined, 'Internal server error'));
});

export default router;