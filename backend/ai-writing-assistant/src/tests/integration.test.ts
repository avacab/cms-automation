import request from 'supertest';
import app from '../index.js';

// Mock OpenAI to avoid API calls during tests
jest.mock('openai', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: 'This is a test generated content with improved grammar and style.'
                },
                finish_reason: 'stop'
              },
              {
                message: {
                  content: 'Alternative generated content for testing purposes.'
                }
              }
            ],
            usage: {
              total_tokens: 150,
              prompt_tokens: 50,
              completion_tokens: 100
            }
          })
        }
      }
    }))
  };
});

describe('AI Writing Assistant API Integration Tests', () => {
  
  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);
        
      expect(response.body).toMatchObject({
        status: 'healthy',
        service: 'ai-writing-assistant'
      });
    });
  });

  describe('API Documentation', () => {
    it('should return API documentation', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);
        
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('endpoints');
      expect(response.body).toHaveProperty('features');
    });
  });

  describe('Writing Suggestions', () => {
    it('should generate writing suggestions for content', async () => {
      const testContent = 'This is a test content with some grammer mistakes and poor style.';
      
      const response = await request(app)
        .post('/api/v1/suggestions')
        .send({
          content: testContent,
          options: {
            includeGrammar: true,
            includeSEO: true,
            includeEngagement: true
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(Array.isArray(response.body.data.suggestions)).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/suggestions')
        .send({})
        .expect(400);
        
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('message');
    });

    it('should reject content that is too short', async () => {
      const response = await request(app)
        .post('/api/v1/suggestions')
        .send({
          content: 'Hi'
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });

    it('should accept brand voice ID', async () => {
      const response = await request(app)
        .post('/api/v1/suggestions')
        .send({
          content: 'This is a test content for brand voice analysis.',
          brandVoiceId: 'test-brand-voice'
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });
  });

  describe('Content Generation', () => {
    it('should generate complete content from prompt', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'complete',
          input: {
            prompt: 'Write a blog post about artificial intelligence in content marketing'
          },
          options: {
            maxTokens: 500,
            temperature: 0.7
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('text');
      expect(response.body.data).toHaveProperty('confidence');
      expect(response.body.data).toHaveProperty('metadata');
      expect(response.body.data.metadata).toHaveProperty('tokensUsed');
      expect(response.body.data.metadata).toHaveProperty('processingTime');
    });

    it('should continue existing content', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'continue',
          input: {
            text: 'Artificial intelligence is transforming content marketing by'
          },
          options: {
            targetLength: 200
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.text).toBeTruthy();
    });

    it('should rewrite content', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'rewrite',
          input: {
            text: 'This content needs to be rewritten for better clarity.',
            context: 'Make it more professional'
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });

    it('should improve content', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'improve',
          input: {
            text: 'This is okay content but it could be better.'
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
    });

    it('should validate generation request', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'invalid-type',
          input: {}
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Improvement', () => {
    it('should improve content with specific suggestions', async () => {
      const response = await request(app)
        .post('/api/v1/improve')
        .send({
          content: 'This content needs improvement in grammar and style.',
          improvements: ['grammar', 'clarity', 'engagement'],
          brandVoiceId: 'professional-voice'
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('text');
    });

    it('should validate improvement request', async () => {
      const response = await request(app)
        .post('/api/v1/improve')
        .send({
          content: 'Test content'
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Continuation', () => {
    it('should continue partial content', async () => {
      const response = await request(app)
        .post('/api/v1/continue')
        .send({
          partialContent: 'The future of artificial intelligence in content creation is',
          targetLength: 300
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data.text).toBeTruthy();
    });

    it('should validate continuation request', async () => {
      const response = await request(app)
        .post('/api/v1/continue')
        .send({
          partialContent: 'Hi'
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });
  });

  describe('Content Adaptation', () => {
    it('should adapt content to multiple formats', async () => {
      const response = await request(app)
        .post('/api/v1/adapt')
        .send({
          originalText: 'This is a comprehensive article about artificial intelligence and its impact on content marketing strategies.',
          targetFormats: [
            {
              format: 'twitter',
              constraints: { maxLength: 280, includeHashtags: true }
            },
            {
              format: 'email-subject',
              constraints: { maxLength: 50 }
            }
          ]
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('adaptations');
      expect(response.body.data.adaptations).toHaveLength(2);
      
      const twitterAdaptation = response.body.data.adaptations.find((a: any) => a.format === 'twitter');
      expect(twitterAdaptation).toBeTruthy();
      expect(twitterAdaptation.metadata.length).toBeLessThanOrEqual(280);
    });

    it('should get available adaptation formats', async () => {
      const response = await request(app)
        .get('/api/v1/adapt/formats')
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('formats');
      expect(Array.isArray(response.body.data.formats)).toBe(true);
    });

    it('should validate adaptation request', async () => {
      const response = await request(app)
        .post('/api/v1/adapt')
        .send({
          originalText: '',
          targetFormats: []
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });
  });

  describe('Brand Voice', () => {
    it('should train brand voice from content samples', async () => {
      const response = await request(app)
        .post('/api/v1/brand-voice/train')
        .send({
          name: 'Test Brand Voice',
          contentSamples: [
            'This is our professional and authoritative brand voice sample content.',
            'We always communicate with clarity and confidence to our audience.',
            'Our brand maintains a consistent professional tone across all communications.'
          ]
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
      expect(response.body.data).toHaveProperty('tone');
      expect(response.body.data).toHaveProperty('writingStyle');
    });

    it('should validate brand voice training', async () => {
      const response = await request(app)
        .post('/api/v1/brand-voice/train')
        .send({
          name: 'Test',
          contentSamples: []
        })
        .expect(400);
        
      expect(response.body.success).toBe(false);
    });

    it('should check brand voice match', async () => {
      const response = await request(app)
        .post('/api/v1/brand-voice/test-brand/check')
        .send({
          content: 'This is a test content to check against brand voice guidelines.'
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('deviations');
      expect(response.body.data).toHaveProperty('suggestions');
    });
  });

  describe('Templates', () => {
    it('should get all available templates', async () => {
      const response = await request(app)
        .get('/api/v1/templates')
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('templates');
      expect(Array.isArray(response.body.data.templates)).toBe(true);
    });

    it('should get specific template', async () => {
      // First get all templates to get a valid ID
      const templatesResponse = await request(app)
        .get('/api/v1/templates');
        
      const templateId = templatesResponse.body.data.templates[0]?.id;
      
      if (templateId) {
        const response = await request(app)
          .get(`/api/v1/templates/${templateId}`)
          .expect(200);
          
        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('id', templateId);
      }
    });

    it('should return 404 for non-existent template', async () => {
      const response = await request(app)
        .get('/api/v1/templates/non-existent-id')
        .expect(404);
        
      expect(response.body.success).toBe(false);
    });

    it('should generate content using template', async () => {
      // Use a known template ID from the default templates
      const response = await request(app)
        .post('/api/v1/templates/blog-post-standard/generate')
        .send({
          variables: {
            topic: 'Artificial Intelligence',
            target_audience: 'Content Marketers'
          }
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('text');
    });

    it('should analyze content against template', async () => {
      const response = await request(app)
        .post('/api/v1/templates/blog-post-standard/analyze')
        .send({
          content: `# Introduction
          
          This is an introduction to the topic.
          
          ## Main Content
          
          This is the main content section with detailed information.
          
          ## Conclusion
          
          This is the conclusion that summarizes the key points.`
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('score');
      expect(response.body.data).toHaveProperty('missingSections');
      expect(response.body.data).toHaveProperty('suggestions');
    });

    it('should get template suggestions', async () => {
      const response = await request(app)
        .post('/api/v1/templates/suggestions')
        .send({
          contentType: 'blog-post',
          context: 'marketing content'
        })
        .expect(200);
        
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('suggestions');
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 routes', async () => {
      const response = await request(app)
        .get('/api/v1/non-existent-endpoint')
        .expect(404);
        
      expect(response.body.success).toBe(false);
      expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    });

    it('should handle invalid JSON', async () => {
      const response = await request(app)
        .post('/api/v1/suggestions')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });
  });

  describe('Rate Limiting', () => {
    it('should apply rate limiting to suggestion endpoints', async () => {
      // Make multiple requests quickly to test rate limiting
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/v1/suggestions')
          .send({
            content: 'This is a test content for rate limiting.'
          })
      );
      
      const responses = await Promise.all(promises);
      
      // All should succeed in test environment with relaxed limits
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
});

describe('Service Integration Tests', () => {
  
  describe('AI Service Integration', () => {
    it('should handle OpenAI API responses correctly', async () => {
      const response = await request(app)
        .post('/api/v1/generate')
        .send({
          type: 'complete',
          input: {
            prompt: 'Test prompt for OpenAI integration'
          }
        })
        .expect(200);
        
      expect(response.body.data).toHaveProperty('text');
      expect(response.body.data).toHaveProperty('alternatives');
      expect(response.body.data.metadata).toHaveProperty('model');
    });
  });

  describe('Brand Voice Service Integration', () => {
    it('should analyze content characteristics correctly', async () => {
      const response = await request(app)
        .post('/api/v1/brand-voice/train')
        .send({
          name: 'Integration Test Voice',
          contentSamples: [
            'Professional and authoritative content sample for testing.',
            'Clear communication with technical accuracy and formal tone.',
            'Expert guidance delivered with confidence and reliability.'
          ]
        })
        .expect(200);
        
      const brandVoice = response.body.data;
      expect(brandVoice.tone).toContain('professional');
      expect(brandVoice.writingStyle).toHaveProperty('formality');
      expect(brandVoice.writingStyle).toHaveProperty('complexity');
    });
  });

  describe('Template Service Integration', () => {
    it('should provide structured content generation', async () => {
      const response = await request(app)
        .post('/api/v1/templates/blog-post-standard/generate')
        .send({
          variables: {
            topic: 'Content Marketing Strategy',
            target_audience: 'Marketing Professionals',
            keywords: 'content marketing, strategy, ROI'
          }
        })
        .expect(200);
        
      const generatedContent = response.body.data.text;
      expect(generatedContent).toContain('Introduction');
      expect(generatedContent).toContain('Content Marketing Strategy');
    });
  });

  describe('Content Adaptation Service Integration', () => {
    it('should adapt content with proper constraints', async () => {
      const longContent = `
        Artificial intelligence is revolutionizing content marketing by enabling 
        personalized experiences at scale. Modern AI tools can analyze user behavior, 
        predict preferences, and automatically generate content that resonates with 
        specific audience segments. This technology allows marketers to create more 
        effective campaigns while reducing manual effort and improving ROI.
      `.trim();
      
      const response = await request(app)
        .post('/api/v1/adapt')
        .send({
          originalText: longContent,
          targetFormats: [
            { format: 'twitter', constraints: { maxLength: 280 } },
            { format: 'email-subject', constraints: { maxLength: 50 } },
            { format: 'meta-description', constraints: { maxLength: 160 } }
          ]
        })
        .expect(200);
        
      const adaptations = response.body.data.adaptations;
      
      const twitter = adaptations.find((a: any) => a.format === 'twitter');
      expect(twitter.text.length).toBeLessThanOrEqual(280);
      
      const emailSubject = adaptations.find((a: any) => a.format === 'email-subject');
      expect(emailSubject.text.length).toBeLessThanOrEqual(50);
      
      const metaDesc = adaptations.find((a: any) => a.format === 'meta-description');
      expect(metaDesc.text.length).toBeLessThanOrEqual(160);
    });
  });
});

describe('Performance Tests', () => {
  it('should handle concurrent requests efficiently', async () => {
    const startTime = Date.now();
    
    const promises = Array.from({ length: 10 }, (_, i) =>
      request(app)
        .post('/api/v1/suggestions')
        .send({
          content: `This is test content number ${i + 1} for performance testing.`
        })
    );
    
    const responses = await Promise.all(promises);
    const endTime = Date.now();
    
    // All requests should complete successfully
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
    
    // Should complete within reasonable time (adjust based on your requirements)
    expect(endTime - startTime).toBeLessThan(10000); // 10 seconds
  }, 15000);

  it('should maintain low memory usage', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    // Generate multiple requests
    for (let i = 0; i < 20; i++) {
      await request(app)
        .post('/api/v1/suggestions')
        .send({
          content: `Performance test content ${i} with sufficient length for analysis.`
        });
    }
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = process.memoryUsage().heapUsed;
    const memoryIncrease = finalMemory - initialMemory;
    
    // Memory increase should be reasonable (less than 50MB)
    expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
  });
});