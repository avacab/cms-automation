import { ContentAdaptationRequest, ContentAdaptationResponse, AIGenerationRequest } from '../types/index.js';
import { AIService } from './AIService.js';
import { BrandVoiceService } from './BrandVoiceService.js';

export class ContentAdaptationService {
  private aiService: AIService;
  private brandVoiceService: BrandVoiceService;

  // Platform-specific constraints and characteristics
  private platformConstraints = {
    'twitter': {
      maxLength: 280,
      tone: 'conversational',
      includeHashtags: true,
      includeEmojis: false,
      lineBreaks: false
    },
    'linkedin': {
      maxLength: 3000,
      tone: 'professional',
      includeHashtags: true,
      includeEmojis: false,
      lineBreaks: true
    },
    'facebook': {
      maxLength: 63206,
      tone: 'friendly',
      includeHashtags: false,
      includeEmojis: true,
      lineBreaks: true
    },
    'instagram': {
      maxLength: 2200,
      tone: 'casual',
      includeHashtags: true,
      includeEmojis: true,
      lineBreaks: true
    },
    'email-subject': {
      maxLength: 50,
      tone: 'compelling',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: false
    },
    'email-preview': {
      maxLength: 90,
      tone: 'engaging',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: false
    },
    'meta-description': {
      maxLength: 160,
      tone: 'descriptive',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: false
    },
    'blog-excerpt': {
      maxLength: 300,
      tone: 'engaging',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: true
    },
    'press-release': {
      maxLength: 800,
      tone: 'formal',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: true
    },
    'product-tagline': {
      maxLength: 60,
      tone: 'compelling',
      includeHashtags: false,
      includeEmojis: false,
      lineBreaks: false
    }
  };

  constructor(aiService: AIService) {
    this.aiService = aiService;
    this.brandVoiceService = new BrandVoiceService();
  }

  /**
   * Adapt content for multiple formats and platforms
   */
  async adaptContent(request: ContentAdaptationRequest): Promise<ContentAdaptationResponse> {
    const adaptations = [];

    for (const target of request.targetFormats) {
      try {
        const adaptation = await this.adaptToSingleFormat(
          request.originalText,
          target.format,
          target.platform,
          target.constraints,
          request.brandVoiceId
        );
        adaptations.push(adaptation);
      } catch (error) {
        console.error(`Failed to adapt to ${target.format}:`, error);
        // Continue with other formats
      }
    }

    return {
      originalText: request.originalText,
      adaptations
    };
  }

  /**
   * Adapt content to a single format
   */
  private async adaptToSingleFormat(
    originalText: string,
    format: string,
    platform?: string,
    customConstraints?: any,
    brandVoiceId?: string
  ) {
    const constraints = this.mergeConstraints(format, platform, customConstraints);
    const adaptedText = await this.generateAdaptedContent(originalText, constraints, brandVoiceId);
    
    return {
      format,
      platform,
      text: adaptedText,
      metadata: {
        length: adaptedText.length,
        tone: constraints.tone,
        confidence: this.calculateAdaptationConfidence(originalText, adaptedText, constraints)
      }
    };
  }

  /**
   * Generate adapted content using AI
   */
  private async generateAdaptedContent(
    originalText: string,
    constraints: any,
    brandVoiceId?: string
  ): Promise<string> {
    const prompt = this.buildAdaptationPrompt(originalText, constraints);

    const request: AIGenerationRequest = {
      type: 'adapt',
      input: {
        text: originalText,
        context: prompt
      },
      options: {
        brandVoiceId,
        maxTokens: Math.min(1000, constraints.maxLength * 2),
        temperature: this.getTemperatureForTone(constraints.tone),
        targetLength: constraints.maxLength
      }
    };

    const response = await this.aiService.generateContent(request);
    let adaptedText = response.text;

    // Apply post-processing based on constraints
    adaptedText = await this.applyFormatConstraints(adaptedText, constraints);

    return adaptedText;
  }

  /**
   * Build prompt for content adaptation
   */
  private buildAdaptationPrompt(originalText: string, constraints: any): string {
    let prompt = `Adapt the following content for a specific format:\n\n`;
    prompt += `Original content:\n"${originalText}"\n\n`;
    prompt += `Adaptation requirements:\n`;
    
    if (constraints.maxLength) {
      prompt += `- Maximum length: ${constraints.maxLength} characters\n`;
    }
    
    if (constraints.tone) {
      prompt += `- Tone: ${constraints.tone}\n`;
    }

    if (constraints.includeHashtags) {
      prompt += `- Include relevant hashtags\n`;
    } else {
      prompt += `- Do not include hashtags\n`;
    }

    if (constraints.includeEmojis) {
      prompt += `- Use appropriate emojis to enhance engagement\n`;
    } else {
      prompt += `- Do not use emojis\n`;
    }

    if (!constraints.lineBreaks) {
      prompt += `- Keep as single line without line breaks\n`;
    }

    // Add format-specific instructions
    const formatInstructions = this.getFormatSpecificInstructions(constraints.format);
    if (formatInstructions) {
      prompt += `\nFormat-specific instructions:\n${formatInstructions}\n`;
    }

    prompt += `\nReturn only the adapted content without any explanations or additional text.`;

    return prompt;
  }

  /**
   * Apply format-specific constraints to the generated text
   */
  private async applyFormatConstraints(text: string, constraints: any): Promise<string> {
    let result = text.trim();

    // Truncate if exceeds maximum length
    if (constraints.maxLength && result.length > constraints.maxLength) {
      result = this.intelligentTruncate(result, constraints.maxLength);
    }

    // Remove line breaks if not allowed
    if (!constraints.lineBreaks) {
      result = result.replace(/\n+/g, ' ').replace(/\s+/g, ' ');
    }

    // Add hashtags if required and not present
    if (constraints.includeHashtags && !result.includes('#')) {
      const hashtags = await this.generateRelevantHashtags(result);
      if (hashtags.length > 0) {
        const hashtagString = ' ' + hashtags.join(' ');
        if (result.length + hashtagString.length <= constraints.maxLength) {
          result += hashtagString;
        }
      }
    }

    return result;
  }

  /**
   * Intelligent truncation that preserves meaning
   */
  private intelligentTruncate(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Try to truncate at sentence boundary
    const sentences = text.split(/[.!?]+/);
    let truncated = '';
    
    for (const sentence of sentences) {
      const withSentence = truncated + sentence + '.';
      if (withSentence.length <= maxLength - 3) { // Reserve space for "..."
        truncated = withSentence;
      } else {
        break;
      }
    }

    if (truncated.length > 0) {
      return truncated.replace(/\.$/, '...');
    }

    // If no good sentence boundary, truncate at word boundary
    const words = text.split(' ');
    truncated = '';
    
    for (const word of words) {
      const withWord = truncated + (truncated ? ' ' : '') + word;
      if (withWord.length <= maxLength - 3) {
        truncated = withWord;
      } else {
        break;
      }
    }

    return truncated + '...';
  }

  /**
   * Generate relevant hashtags for content
   */
  private async generateRelevantHashtags(content: string): Promise<string[]> {
    // Simple keyword extraction for hashtags
    // In production, this would use more sophisticated NLP
    const words = content.toLowerCase()
      .match(/\b[a-z]+\b/g) || [];
    
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were']);
    const keywords = words
      .filter(word => word.length > 3 && !stopWords.has(word))
      .filter((word, index, arr) => arr.indexOf(word) === index) // Remove duplicates
      .slice(0, 3); // Limit to 3 hashtags

    return keywords.map(keyword => `#${keyword}`);
  }

  /**
   * Merge platform constraints with custom constraints
   */
  private mergeConstraints(format: string, platform?: string, customConstraints?: any): any {
    let baseConstraints = {};

    // Get platform-specific constraints
    if (platform && this.platformConstraints[platform as keyof typeof this.platformConstraints]) {
      baseConstraints = { 
        ...this.platformConstraints[platform as keyof typeof this.platformConstraints],
        format: platform 
      };
    }

    // Get format-specific constraints if no platform specified
    if (!platform && this.platformConstraints[format as keyof typeof this.platformConstraints]) {
      baseConstraints = { 
        ...this.platformConstraints[format as keyof typeof this.platformConstraints],
        format 
      };
    }

    // Add generic format info
    if (Object.keys(baseConstraints).length === 0) {
      baseConstraints = { format, maxLength: 500, tone: 'neutral' };
    }

    // Merge with custom constraints
    return { ...baseConstraints, ...customConstraints };
  }

  /**
   * Get format-specific instructions for the AI
   */
  private getFormatSpecificInstructions(format: string): string | null {
    const instructions: Record<string, string> = {
      'twitter': 'Make it concise and engaging. Consider asking a question or making a statement that encourages interaction.',
      'linkedin': 'Professional tone. Can include a call-to-action or question to encourage professional discussion.',
      'email-subject': 'Create urgency or curiosity. Avoid spam trigger words. Make it compelling enough to drive opens.',
      'meta-description': 'Include primary keywords naturally. Make it compelling for search results while being descriptive.',
      'blog-excerpt': 'Hook the reader with an intriguing opening that makes them want to read the full post.',
      'press-release': 'Start with the most newsworthy information. Use third-person perspective and formal language.',
      'product-tagline': 'Focus on the main benefit or unique value proposition. Make it memorable and distinctive.'
    };

    return instructions[format] || null;
  }

  /**
   * Calculate temperature based on desired tone
   */
  private getTemperatureForTone(tone: string): number {
    const toneTemperatures: Record<string, number> = {
      'formal': 0.3,
      'professional': 0.4,
      'descriptive': 0.4,
      'neutral': 0.5,
      'engaging': 0.7,
      'friendly': 0.7,
      'conversational': 0.8,
      'casual': 0.8,
      'compelling': 0.8,
      'creative': 0.9
    };

    return toneTemperatures[tone] || 0.7;
  }

  /**
   * Calculate confidence score for the adaptation
   */
  private calculateAdaptationConfidence(originalText: string, adaptedText: string, constraints: any): number {
    let confidence = 0.8; // Base confidence

    // Check length compliance
    if (constraints.maxLength) {
      const lengthRatio = adaptedText.length / constraints.maxLength;
      if (lengthRatio > 0.8 && lengthRatio <= 1.0) {
        confidence += 0.1; // Good length utilization
      } else if (lengthRatio > 1.0) {
        confidence -= 0.2; // Exceeds limit
      } else if (lengthRatio < 0.3) {
        confidence -= 0.1; // Too short
      }
    }

    // Check hashtag compliance
    const hasHashtags = adaptedText.includes('#');
    if (constraints.includeHashtags && hasHashtags) {
      confidence += 0.05;
    } else if (!constraints.includeHashtags && !hasHashtags) {
      confidence += 0.05;
    }

    // Check emoji compliance
    const hasEmojis = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(adaptedText);
    if (constraints.includeEmojis && hasEmojis) {
      confidence += 0.05;
    } else if (!constraints.includeEmojis && !hasEmojis) {
      confidence += 0.05;
    }

    return Math.min(1.0, Math.max(0.0, confidence));
  }

  /**
   * Get available adaptation formats
   */
  getAvailableFormats(): Array<{format: string, description: string, constraints: any}> {
    return Object.entries(this.platformConstraints).map(([format, constraints]) => ({
      format,
      description: this.getFormatDescription(format),
      constraints
    }));
  }

  /**
   * Get human-readable description for format
   */
  private getFormatDescription(format: string): string {
    const descriptions: Record<string, string> = {
      'twitter': 'Twitter/X social media post',
      'linkedin': 'LinkedIn professional post',
      'facebook': 'Facebook social media post',
      'instagram': 'Instagram caption',
      'email-subject': 'Email subject line',
      'email-preview': 'Email preview text',
      'meta-description': 'SEO meta description',
      'blog-excerpt': 'Blog post excerpt',
      'press-release': 'Press release format',
      'product-tagline': 'Product marketing tagline'
    };

    return descriptions[format] || `Content adapted for ${format}`;
  }
}