import OpenAI from 'openai';
import { AIGenerationRequest, AIGenerationResponse, WritingSuggestion, ServiceConfig } from '../types/index.js';
import { BrandVoiceService } from './BrandVoiceService.js';

export class AIService {
  private openai: OpenAI;
  private brandVoiceService: BrandVoiceService;
  private config: ServiceConfig;

  constructor(config: ServiceConfig) {
    this.config = config;
    this.openai = new OpenAI({
      apiKey: config.ai.apiKey,
      baseURL: config.ai.baseURL
    });
    this.brandVoiceService = new BrandVoiceService();
  }

  /**
   * Generate AI-powered writing suggestions in real-time
   */
  async generateWritingSuggestions(content: string, brandVoiceId?: string): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    
    try {
      // Grammar and style suggestions using OpenAI
      const grammarSuggestions = await this.getGrammarSuggestions(content);
      suggestions.push(...grammarSuggestions);

      // Brand voice suggestions if brand voice is specified
      if (brandVoiceId) {
        const brandVoiceSuggestions = await this.getBrandVoiceSuggestions(content, brandVoiceId);
        suggestions.push(...brandVoiceSuggestions);
      }

      // SEO and readability suggestions
      const seoSuggestions = await this.getSEOSuggestions(content);
      suggestions.push(...seoSuggestions);

      // Engagement suggestions
      const engagementSuggestions = await this.getEngagementSuggestions(content);
      suggestions.push(...engagementSuggestions);

      return suggestions;
    } catch (error) {
      console.error('Error generating writing suggestions:', error);
      throw new Error('Failed to generate writing suggestions');
    }
  }

  /**
   * Generate content using AI based on prompts and brand voice
   */
  async generateContent(request: AIGenerationRequest): Promise<AIGenerationResponse> {
    const startTime = Date.now();
    
    try {
      let prompt = await this.buildPrompt(request);
      
      const completion = await this.openai.chat.completions.create({
        model: this.config.ai.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: request.options.maxTokens || this.config.ai.defaultParams.maxTokens,
        temperature: request.options.temperature || this.config.ai.defaultParams.temperature,
        top_p: request.options.topP || this.config.ai.defaultParams.topP,
        n: 3 // Generate alternatives
      });

      const mainResponse = completion.choices[0].message.content || '';
      const alternatives = completion.choices.slice(1).map(choice => choice.message.content || '');

      // Generate suggestions for the main response
      const suggestions = await this.generateWritingSuggestions(mainResponse, request.options.brandVoiceId);

      const response: AIGenerationResponse = {
        id: this.generateId(),
        text: mainResponse,
        confidence: this.calculateConfidence(completion.choices[0]),
        alternatives: alternatives.filter(alt => alt.length > 0),
        metadata: {
          tokensUsed: completion.usage?.total_tokens || 0,
          processingTime: Date.now() - startTime,
          model: this.config.ai.model,
          brandVoiceMatch: request.options.brandVoiceId ? await this.calculateBrandVoiceMatch(mainResponse, request.options.brandVoiceId) : undefined,
          templateMatch: request.options.templateId ? await this.calculateTemplateMatch(mainResponse, request.options.templateId) : undefined
        },
        suggestions
      };

      return response;
    } catch (error) {
      console.error('Error generating content:', error);
      throw new Error('Failed to generate content');
    }
  }

  /**
   * Improve existing content
   */
  async improveContent(content: string, improvements: string[], brandVoiceId?: string): Promise<AIGenerationResponse> {
    const improvementPrompts = improvements.join(', ');
    
    const request: AIGenerationRequest = {
      type: 'improve',
      input: {
        text: content,
        context: `Improve this content focusing on: ${improvementPrompts}`
      },
      options: {
        brandVoiceId,
        maxTokens: Math.min(4000, content.length * 2)
      }
    };

    return this.generateContent(request);
  }

  /**
   * Continue writing from a partial text
   */
  async continueWriting(partialContent: string, targetLength?: number, brandVoiceId?: string): Promise<AIGenerationResponse> {
    const request: AIGenerationRequest = {
      type: 'continue',
      input: {
        text: partialContent,
        context: 'Continue writing this content in the same style and tone'
      },
      options: {
        brandVoiceId,
        targetLength,
        maxTokens: targetLength || 1000
      }
    };

    return this.generateContent(request);
  }

  /**
   * Rewrite content in a different style or tone
   */
  async rewriteContent(content: string, newStyle: string, brandVoiceId?: string): Promise<AIGenerationResponse> {
    const request: AIGenerationRequest = {
      type: 'rewrite',
      input: {
        text: content,
        context: `Rewrite this content to be more ${newStyle}`
      },
      options: {
        brandVoiceId,
        targetTone: [newStyle],
        maxTokens: Math.min(4000, content.length * 1.5)
      }
    };

    return this.generateContent(request);
  }

  // Private helper methods

  private async buildPrompt(request: AIGenerationRequest): Promise<string> {
    let prompt = '';
    
    // Add brand voice context if specified
    if (request.options.brandVoiceId) {
      const brandVoiceContext = await this.getBrandVoiceContext(request.options.brandVoiceId);
      prompt += `${brandVoiceContext}\n\n`;
    }

    // Add template context if specified
    if (request.options.templateId) {
      const templateContext = await this.getTemplateContext(request.options.templateId);
      prompt += `${templateContext}\n\n`;
    }

    // Build main prompt based on request type
    switch (request.type) {
      case 'complete':
        prompt += `Please write content based on this prompt: ${request.input.prompt}`;
        break;
      case 'continue':
        prompt += `Continue writing this content naturally:\n\n${request.input.text}`;
        break;
      case 'rewrite':
        prompt += `Rewrite the following content:\n\n${request.input.text}`;
        break;
      case 'improve':
        prompt += `Improve the following content:\n\n${request.input.text}`;
        break;
      case 'adapt':
        prompt += `Adapt this content for ${request.input.targetFormat}:\n\n${request.input.text}`;
        break;
    }

    // Add context if provided
    if (request.input.context) {
      prompt += `\n\nAdditional context: ${request.input.context}`;
    }

    // Add constraints
    if (request.options.targetLength) {
      prompt += `\n\nTarget length: approximately ${request.options.targetLength} words.`;
    }

    if (request.options.keywords && request.options.keywords.length > 0) {
      prompt += `\n\nInclude these keywords naturally: ${request.options.keywords.join(', ')}.`;
    }

    if (request.options.targetTone && request.options.targetTone.length > 0) {
      prompt += `\n\nTone should be: ${request.options.targetTone.join(' and ')}.`;
    }

    return prompt;
  }

  private async getBrandVoiceContext(brandVoiceId: string): Promise<string> {
    // In a real implementation, this would fetch from database
    // For now, return a generic brand voice context
    return "Write in a professional yet approachable tone, using clear and concise language that resonates with the target audience.";
  }

  private async getTemplateContext(templateId: string): Promise<string> {
    // In a real implementation, this would fetch template structure from database
    return "Follow the standard content structure with introduction, main points, and conclusion.";
  }

  private async getGrammarSuggestions(content: string): Promise<WritingSuggestion[]> {
    try {
      const prompt = `Analyze this text for grammar, spelling, and style issues. Return only specific suggestions in JSON format:

Text: "${content}"

Return format: [{"type": "grammar", "severity": "low|medium|high", "position": {"start": 0, "end": 5}, "original": "original text", "suggestion": "corrected text", "reason": "explanation"}]`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.1
      });

      const result = response.choices[0].message.content;
      if (result) {
        try {
          const suggestions = JSON.parse(result);
          return suggestions.map((s: any) => ({
            ...s,
            id: this.generateId(),
            confidence: 0.85
          }));
        } catch {
          // If JSON parsing fails, return empty array
          return [];
        }
      }
      return [];
    } catch (error) {
      console.error('Error getting grammar suggestions:', error);
      return [];
    }
  }

  private async getBrandVoiceSuggestions(content: string, brandVoiceId: string): Promise<WritingSuggestion[]> {
    // This would integrate with the BrandVoiceService
    // For now, return basic brand voice suggestions
    return [];
  }

  private async getSEOSuggestions(content: string): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    
    // Check for missing title structure
    if (!content.includes('#') && content.length > 300) {
      suggestions.push({
        id: this.generateId(),
        type: 'seo',
        severity: 'medium',
        position: { start: 0, end: 0 },
        original: '',
        suggestion: 'Add headings (H1, H2, H3) to improve SEO structure',
        reason: 'Headers help search engines understand content structure',
        confidence: 0.9
      });
    }

    // Check content length
    if (content.length < 300) {
      suggestions.push({
        id: this.generateId(),
        type: 'seo',
        severity: 'low',
        position: { start: content.length, end: content.length },
        original: '',
        suggestion: 'Consider expanding content to at least 300 words for better SEO',
        reason: 'Longer content typically performs better in search results',
        confidence: 0.7
      });
    }

    return suggestions;
  }

  private async getEngagementSuggestions(content: string): Promise<WritingSuggestion[]> {
    const suggestions: WritingSuggestion[] = [];
    
    // Check for questions to increase engagement
    const questionCount = (content.match(/\?/g) || []).length;
    if (questionCount === 0 && content.length > 200) {
      suggestions.push({
        id: this.generateId(),
        type: 'engagement',
        severity: 'low',
        position: { start: content.length, end: content.length },
        original: '',
        suggestion: 'Consider adding questions to increase reader engagement',
        reason: 'Questions encourage interaction and keep readers engaged',
        confidence: 0.8
      });
    }

    // Check for call-to-action
    const ctaWords = ['learn more', 'get started', 'contact us', 'sign up', 'download', 'subscribe'];
    const hasCTA = ctaWords.some(cta => content.toLowerCase().includes(cta));
    
    if (!hasCTA && content.length > 400) {
      suggestions.push({
        id: this.generateId(),
        type: 'engagement',
        severity: 'medium',
        position: { start: content.length, end: content.length },
        original: '',
        suggestion: 'Add a call-to-action to guide readers to the next step',
        reason: 'CTAs improve conversion rates and user engagement',
        confidence: 0.85
      });
    }

    return suggestions;
  }

  private calculateConfidence(choice: any): number {
    // Simple confidence calculation based on response length and coherence
    const text = choice.message.content || '';
    if (text.length < 50) return 0.3;
    if (text.length < 200) return 0.6;
    return 0.85;
  }

  private async calculateBrandVoiceMatch(content: string, brandVoiceId: string): Promise<number> {
    // This would integrate with the BrandVoiceService
    // For now, return a placeholder score
    return 0.8;
  }

  private async calculateTemplateMatch(content: string, templateId: string): Promise<number> {
    // This would check how well the content matches the template structure
    return 0.75;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}