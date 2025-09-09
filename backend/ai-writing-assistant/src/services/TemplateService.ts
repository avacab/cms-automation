import { ContentTemplate, TemplateSection, TemplateVariable, AIGenerationRequest } from '../types/index.js';

export class TemplateService {
  private templates: Map<string, ContentTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): ContentTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ContentTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Create a new template
   */
  createTemplate(template: Omit<ContentTemplate, 'id' | 'createdAt' | 'updatedAt'>): ContentTemplate {
    const newTemplate: ContentTemplate = {
      ...template,
      id: this.generateId(),
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.templates.set(newTemplate.id, newTemplate);
    return newTemplate;
  }

  /**
   * Update existing template
   */
  updateTemplate(id: string, updates: Partial<ContentTemplate>): ContentTemplate | null {
    const existing = this.templates.get(id);
    if (!existing) return null;

    const updated: ContentTemplate = {
      ...existing,
      ...updates,
      id: existing.id, // Preserve ID
      createdAt: existing.createdAt, // Preserve creation date
      updatedAt: new Date()
    };

    this.templates.set(id, updated);
    return updated;
  }

  /**
   * Delete template
   */
  deleteTemplate(id: string): boolean {
    return this.templates.delete(id);
  }

  /**
   * Generate content structure based on template
   */
  generateContentStructure(templateId: string, variables: Record<string, any> = {}): string {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const sections = template.structure
      .sort((a, b) => a.order - b.order)
      .map(section => this.generateSectionContent(section, variables))
      .join('\n\n');

    return this.replaceVariables(sections, variables, template.variables);
  }

  /**
   * Get AI generation request for template-based content
   */
  getTemplateGenerationRequest(
    templateId: string, 
    variables: Record<string, any>, 
    brandVoiceId?: string
  ): AIGenerationRequest {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const structure = this.generateContentStructure(templateId, variables);
    const prompt = this.buildTemplatePrompt(template, variables, structure);

    return {
      type: 'complete',
      input: {
        prompt: prompt,
        context: `Creating ${template.type} content using the ${template.name} template`
      },
      options: {
        templateId,
        brandVoiceId: brandVoiceId || template.brandVoiceId,
        maxTokens: this.calculateMaxTokensForTemplate(template),
        temperature: this.getTemplateTemperature(template.type)
      }
    };
  }

  /**
   * Analyze content against template structure
   */
  analyzeTemplateMatch(content: string, templateId: string): {
    score: number;
    missingSections: string[];
    suggestions: string[];
  } {
    const template = this.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const missingSections: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    // Check for required sections
    const requiredSections = template.structure.filter(section => section.required);
    
    for (const section of requiredSections) {
      const sectionPresent = this.isSectionPresent(content, section);
      if (!sectionPresent) {
        missingSections.push(section.name);
        score -= 20;
        suggestions.push(`Add ${section.name}: ${section.description}`);
      }
    }

    // Check content length against targets
    const wordCount = content.split(/\s+/).length;
    const templateTargets = this.calculateTemplateTargets(template);
    
    if (wordCount < templateTargets.minWords) {
      score -= 10;
      suggestions.push(`Content is too short. Target: ${templateTargets.minWords}-${templateTargets.maxWords} words`);
    } else if (wordCount > templateTargets.maxWords * 1.5) {
      score -= 5;
      suggestions.push(`Content might be too long. Consider condensing to ${templateTargets.maxWords} words or less`);
    }

    // Check section order
    const sectionOrderScore = this.checkSectionOrder(content, template);
    score = Math.max(0, score - (100 - sectionOrderScore));

    return {
      score: Math.max(0, score),
      missingSections,
      suggestions
    };
  }

  /**
   * Get template suggestions based on content type and context
   */
  getTemplateSuggestions(contentType?: string, context?: string): ContentTemplate[] {
    let templates = Array.from(this.templates.values());

    if (contentType) {
      templates = templates.filter(t => t.type === contentType);
    }

    // Simple relevance scoring based on context
    if (context) {
      templates = templates.map(template => ({
        ...template,
        relevanceScore: this.calculateRelevanceScore(template, context)
      })).sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0));
    }

    return templates.slice(0, 5); // Return top 5 suggestions
  }

  // Private helper methods

  private initializeDefaultTemplates(): void {
    // Blog Post Template
    const blogPostTemplate: ContentTemplate = {
      id: 'blog-post-standard',
      name: 'Standard Blog Post',
      type: 'blog-post',
      structure: [
        {
          id: 'intro',
          name: 'Introduction',
          description: 'Hook the reader and introduce the topic',
          order: 1,
          required: true,
          suggestions: [
            'Start with a compelling question or statistic',
            'Clearly state what the reader will learn',
            'Keep it concise and engaging'
          ],
          wordCountTarget: { min: 50, max: 150 }
        },
        {
          id: 'main-content',
          name: 'Main Content',
          description: 'Core information organized with subheadings',
          order: 2,
          required: true,
          suggestions: [
            'Use H2 and H3 headings to organize content',
            'Include examples and actionable insights',
            'Break up long paragraphs'
          ],
          wordCountTarget: { min: 400, max: 1200 }
        },
        {
          id: 'conclusion',
          name: 'Conclusion',
          description: 'Summarize key points and include call-to-action',
          order: 3,
          required: true,
          suggestions: [
            'Recap the main takeaways',
            'Include a clear call-to-action',
            'Encourage engagement'
          ],
          wordCountTarget: { min: 50, max: 150 }
        }
      ],
      variables: [
        {
          id: 'topic',
          name: 'Main Topic',
          type: 'text',
          required: true
        },
        {
          id: 'target_audience',
          name: 'Target Audience',
          type: 'text',
          required: false
        },
        {
          id: 'keywords',
          name: 'SEO Keywords',
          type: 'text',
          required: false
        },
        {
          id: 'cta_text',
          name: 'Call-to-Action',
          type: 'text',
          required: false,
          defaultValue: 'Learn more'
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Product Description Template
    const productDescTemplate: ContentTemplate = {
      id: 'product-description-ecommerce',
      name: 'E-commerce Product Description',
      type: 'product-description',
      structure: [
        {
          id: 'headline',
          name: 'Product Headline',
          description: 'Compelling product title with key benefit',
          order: 1,
          required: true,
          suggestions: [
            'Include primary keyword',
            'Highlight main benefit',
            'Keep under 60 characters for SEO'
          ],
          wordCountTarget: { min: 5, max: 12 }
        },
        {
          id: 'features',
          name: 'Key Features',
          description: 'List of main product features and benefits',
          order: 2,
          required: true,
          suggestions: [
            'Use bullet points for easy scanning',
            'Focus on benefits, not just features',
            'Include technical specifications if relevant'
          ],
          wordCountTarget: { min: 50, max: 200 }
        },
        {
          id: 'description',
          name: 'Detailed Description',
          description: 'Comprehensive product information',
          order: 3,
          required: true,
          suggestions: [
            'Tell a story about the product',
            'Address common customer concerns',
            'Use sensory language when appropriate'
          ],
          wordCountTarget: { min: 100, max: 300 }
        },
        {
          id: 'cta',
          name: 'Call-to-Action',
          description: 'Encourage purchase or next step',
          order: 4,
          required: false,
          suggestions: [
            'Create urgency when appropriate',
            'Use action-oriented language',
            'Make it easy to take the next step'
          ],
          wordCountTarget: { min: 5, max: 20 }
        }
      ],
      variables: [
        {
          id: 'product_name',
          name: 'Product Name',
          type: 'text',
          required: true
        },
        {
          id: 'price',
          name: 'Price',
          type: 'text',
          required: false
        },
        {
          id: 'target_customer',
          name: 'Target Customer',
          type: 'text',
          required: false
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Email Template
    const emailTemplate: ContentTemplate = {
      id: 'email-marketing',
      name: 'Marketing Email',
      type: 'email',
      structure: [
        {
          id: 'subject',
          name: 'Subject Line',
          description: 'Compelling subject line that drives opens',
          order: 1,
          required: true,
          suggestions: [
            'Keep under 50 characters',
            'Create curiosity or urgency',
            'Personalize when possible'
          ],
          wordCountTarget: { min: 3, max: 10 }
        },
        {
          id: 'opening',
          name: 'Opening',
          description: 'Personal greeting and hook',
          order: 2,
          required: true,
          suggestions: [
            'Use recipient\'s name if available',
            'Reference previous interactions',
            'Get to the point quickly'
          ],
          wordCountTarget: { min: 20, max: 50 }
        },
        {
          id: 'body',
          name: 'Main Message',
          description: 'Core content and value proposition',
          order: 3,
          required: true,
          suggestions: [
            'Focus on benefits to the reader',
            'Use scannable formatting',
            'Include social proof if relevant'
          ],
          wordCountTarget: { min: 100, max: 300 }
        },
        {
          id: 'cta',
          name: 'Call-to-Action',
          description: 'Clear next step for the reader',
          order: 4,
          required: true,
          suggestions: [
            'Use action verbs',
            'Make it stand out visually',
            'Explain the benefit of clicking'
          ],
          wordCountTarget: { min: 5, max: 20 }
        }
      ],
      variables: [
        {
          id: 'recipient_name',
          name: 'Recipient Name',
          type: 'text',
          required: false
        },
        {
          id: 'campaign_goal',
          name: 'Campaign Goal',
          type: 'select',
          required: true,
          options: ['promote_product', 'drive_traffic', 'nurture_leads', 'announce_news']
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Save default templates
    this.templates.set(blogPostTemplate.id, blogPostTemplate);
    this.templates.set(productDescTemplate.id, productDescTemplate);
    this.templates.set(emailTemplate.id, emailTemplate);
  }

  private generateSectionContent(section: TemplateSection, variables: Record<string, any>): string {
    let content = `## ${section.name}\n\n`;
    
    if (section.suggestions.length > 0) {
      content += `<!-- ${section.description} -->\n`;
      content += `<!-- Suggestions: ${section.suggestions.join('; ')} -->\n\n`;
    }

    content += `[${section.name.toUpperCase()}_CONTENT]\n`;
    
    if (section.wordCountTarget) {
      content += `<!-- Target: ${section.wordCountTarget.min}-${section.wordCountTarget.max} words -->\n`;
    }

    return content;
  }

  private replaceVariables(content: string, variables: Record<string, any>, templateVariables: TemplateVariable[]): string {
    let result = content;
    
    templateVariables.forEach(templateVar => {
      const value = variables[templateVar.id] || templateVar.defaultValue || `[${templateVar.name.toUpperCase()}]`;
      const placeholder = new RegExp(`\\{\\{${templateVar.id}\\}\\}`, 'g');
      result = result.replace(placeholder, String(value));
    });

    return result;
  }

  private buildTemplatePrompt(template: ContentTemplate, variables: Record<string, any>, structure: string): string {
    let prompt = `Create ${template.type} content using the following template structure:\n\n`;
    prompt += `Template: ${template.name}\n\n`;
    
    if (Object.keys(variables).length > 0) {
      prompt += `Variables:\n`;
      Object.entries(variables).forEach(([key, value]) => {
        prompt += `- ${key}: ${value}\n`;
      });
      prompt += `\n`;
    }

    prompt += `Structure to follow:\n${structure}\n\n`;
    prompt += `Please replace the placeholder content with actual, engaging content that follows the template structure and incorporates the provided variables.`;

    return prompt;
  }

  private calculateMaxTokensForTemplate(template: ContentTemplate): number {
    const totalTargetWords = template.structure.reduce((sum, section) => {
      return sum + (section.wordCountTarget?.max || 200);
    }, 0);

    // Convert words to approximate tokens (1 word ≈ 1.3 tokens)
    return Math.ceil(totalTargetWords * 1.3) + 500; // Extra buffer for formatting
  }

  private getTemplateTemperature(templateType: string): number {
    switch (templateType) {
      case 'product-description':
        return 0.7; // More factual, less creative
      case 'blog-post':
        return 0.8; // Balanced creativity
      case 'email':
        return 0.6; // More focused
      case 'social-media':
        return 0.9; // More creative
      default:
        return 0.8;
    }
  }

  private isSectionPresent(content: string, section: TemplateSection): boolean {
    // Simple heuristic: look for section name as heading or content patterns
    const sectionRegex = new RegExp(`#{1,3}\\s*${section.name}`, 'i');
    return sectionRegex.test(content) || content.toLowerCase().includes(section.name.toLowerCase());
  }

  private calculateTemplateTargets(template: ContentTemplate): { minWords: number; maxWords: number } {
    const minWords = template.structure.reduce((sum, section) => {
      return sum + (section.wordCountTarget?.min || 50);
    }, 0);

    const maxWords = template.structure.reduce((sum, section) => {
      return sum + (section.wordCountTarget?.max || 200);
    }, 0);

    return { minWords, maxWords };
  }

  private checkSectionOrder(content: string, template: ContentTemplate): number {
    const expectedOrder = template.structure
      .filter(section => section.required)
      .sort((a, b) => a.order - b.order)
      .map(section => section.name.toLowerCase());

    const foundSections: string[] = [];
    
    // Extract section headers from content
    const headerRegex = /#{1,3}\s*([^\n]+)/g;
    let match;
    while ((match = headerRegex.exec(content)) !== null) {
      const headerText = match[1].toLowerCase().trim();
      foundSections.push(headerText);
    }

    // Calculate order score
    let correctOrder = 0;
    let expectedIndex = 0;
    
    for (const found of foundSections) {
      if (expectedIndex < expectedOrder.length && 
          found.includes(expectedOrder[expectedIndex])) {
        correctOrder++;
        expectedIndex++;
      }
    }

    return (correctOrder / expectedOrder.length) * 100;
  }

  private calculateRelevanceScore(template: ContentTemplate, context: string): number {
    let score = 0;
    const contextLower = context.toLowerCase();
    
    // Check template name relevance
    if (contextLower.includes(template.name.toLowerCase())) {
      score += 50;
    }
    
    // Check template type relevance
    if (contextLower.includes(template.type)) {
      score += 30;
    }

    // Check section relevance
    template.structure.forEach(section => {
      if (contextLower.includes(section.name.toLowerCase())) {
        score += 10;
      }
    });

    return Math.min(100, score);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}