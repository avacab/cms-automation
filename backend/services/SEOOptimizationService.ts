import { AIService } from '../ai-writing-assistant/src/services/AIService.js';

interface SEOAnalysis {
  score: number;
  issues: SEOIssue[];
  recommendations: SEORecommendation[];
  keywords: KeywordAnalysis[];
}

interface SEOIssue {
  type: 'critical' | 'warning' | 'suggestion';
  category: 'title' | 'meta' | 'content' | 'headings' | 'links' | 'images' | 'keywords';
  description: string;
  fix: string;
  impact: number; // 1-10 scale
}

interface SEORecommendation {
  type: 'add' | 'modify' | 'remove';
  element: string;
  current?: string;
  suggested: string;
  reason: string;
}

interface KeywordAnalysis {
  keyword: string;
  density: number;
  frequency: number;
  prominence: number;
  recommendations: string[];
}

interface ContentOptimization {
  optimizedTitle: string;
  optimizedContent: string;
  metaDescription: string;
  focusKeywords: string[];
  headingStructure: HeadingStructure[];
  internalLinkSuggestions: LinkSuggestion[];
}

interface HeadingStructure {
  level: number;
  text: string;
  keywords: string[];
}

interface LinkSuggestion {
  anchor: string;
  target: string;
  reason: string;
}

export class SEOOptimizationService {
  private aiService: AIService;
  
  constructor(aiService: AIService) {
    this.aiService = aiService;
  }

  /**
   * Perform comprehensive SEO analysis
   */
  async analyzeSEO(
    title: string,
    content: string,
    metaDescription?: string,
    focusKeyword?: string
  ): Promise<SEOAnalysis> {
    const issues: SEOIssue[] = [];
    const recommendations: SEORecommendation[] = [];
    const keywords = await this.analyzeKeywords(content, focusKeyword);

    // Analyze title
    const titleIssues = this.analyzeTitleSEO(title, focusKeyword);
    issues.push(...titleIssues);

    // Analyze meta description
    const metaIssues = this.analyzeMetaDescription(metaDescription, focusKeyword);
    issues.push(...metaIssues);

    // Analyze content structure
    const contentIssues = this.analyzeContentStructure(content, focusKeyword);
    issues.push(...contentIssues);

    // Analyze headings
    const headingIssues = this.analyzeHeadings(content, focusKeyword);
    issues.push(...headingIssues);

    // Analyze links
    const linkIssues = this.analyzeLinks(content);
    issues.push(...linkIssues);

    // Analyze images
    const imageIssues = this.analyzeImages(content);
    issues.push(...imageIssues);

    // Generate recommendations
    const aiRecommendations = await this.generateAIRecommendations(
      title,
      content,
      issues,
      focusKeyword
    );
    recommendations.push(...aiRecommendations);

    // Calculate overall SEO score
    const score = this.calculateSEOScore(issues, content, title, metaDescription);

    return {
      score,
      issues,
      recommendations,
      keywords
    };
  }

  /**
   * Optimize content for SEO using AI
   */
  async optimizeContent(
    title: string,
    content: string,
    focusKeywords: string[],
    targetAudience?: string
  ): Promise<ContentOptimization> {
    try {
      // Optimize title
      const optimizedTitle = await this.optimizeTitle(title, focusKeywords[0]);

      // Optimize content structure and keyword placement
      const optimizedContent = await this.optimizeContentStructure(
        content,
        focusKeywords,
        targetAudience
      );

      // Generate optimized meta description
      const metaDescription = await this.generateOptimizedMetaDescription(
        optimizedContent,
        focusKeywords[0]
      );

      // Optimize heading structure
      const headingStructure = this.optimizeHeadingStructure(optimizedContent, focusKeywords);

      // Generate internal link suggestions
      const internalLinkSuggestions = await this.generateInternalLinkSuggestions(optimizedContent);

      return {
        optimizedTitle,
        optimizedContent,
        metaDescription,
        focusKeywords,
        headingStructure,
        internalLinkSuggestions
      };
    } catch (error) {
      throw new Error(`SEO optimization failed: ${error.message}`);
    }
  }

  /**
   * Generate schema markup for blog post
   */
  generateSchemaMarkup(
    title: string,
    content: string,
    author: string,
    publishDate: Date,
    imageUrl?: string
  ): object {
    const wordCount = content.split(/\s+/).length;
    const readingTime = Math.ceil(wordCount / 200);

    return {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      "headline": title,
      "articleBody": content.replace(/<[^>]*>/g, ''), // Strip HTML
      "author": {
        "@type": "Person",
        "name": author
      },
      "datePublished": publishDate.toISOString(),
      "dateModified": publishDate.toISOString(),
      "wordCount": wordCount,
      "timeRequired": `PT${readingTime}M`,
      ...(imageUrl && {
        "image": {
          "@type": "ImageObject",
          "url": imageUrl
        }
      })
    };
  }

  // Private methods

  private analyzeTitleSEO(title: string, focusKeyword?: string): SEOIssue[] {
    const issues: SEOIssue[] = [];

    // Title length check
    if (title.length < 30) {
      issues.push({
        type: 'warning',
        category: 'title',
        description: 'Title is too short',
        fix: 'Expand title to 30-60 characters for better SEO',
        impact: 7
      });
    } else if (title.length > 60) {
      issues.push({
        type: 'warning',
        category: 'title',
        description: 'Title is too long',
        fix: 'Shorten title to under 60 characters to prevent truncation',
        impact: 6
      });
    }

    // Focus keyword in title
    if (focusKeyword && !title.toLowerCase().includes(focusKeyword.toLowerCase())) {
      issues.push({
        type: 'critical',
        category: 'title',
        description: 'Focus keyword not in title',
        fix: `Include "${focusKeyword}" in the title`,
        impact: 9
      });
    }

    return issues;
  }

  private analyzeMetaDescription(metaDescription?: string, focusKeyword?: string): SEOIssue[] {
    const issues: SEOIssue[] = [];

    if (!metaDescription) {
      issues.push({
        type: 'critical',
        category: 'meta',
        description: 'Missing meta description',
        fix: 'Add a compelling meta description (150-160 characters)',
        impact: 8
      });
      return issues;
    }

    // Meta description length
    if (metaDescription.length < 120) {
      issues.push({
        type: 'warning',
        category: 'meta',
        description: 'Meta description is too short',
        fix: 'Expand meta description to 150-160 characters',
        impact: 6
      });
    } else if (metaDescription.length > 160) {
      issues.push({
        type: 'warning',
        category: 'meta',
        description: 'Meta description is too long',
        fix: 'Shorten meta description to under 160 characters',
        impact: 7
      });
    }

    // Focus keyword in meta description
    if (focusKeyword && !metaDescription.toLowerCase().includes(focusKeyword.toLowerCase())) {
      issues.push({
        type: 'warning',
        category: 'meta',
        description: 'Focus keyword not in meta description',
        fix: `Include "${focusKeyword}" in the meta description`,
        impact: 5
      });
    }

    return issues;
  }

  private analyzeContentStructure(content: string, focusKeyword?: string): SEOIssue[] {
    const issues: SEOIssue[] = [];
    const wordCount = content.split(/\s+/).length;

    // Content length
    if (wordCount < 300) {
      issues.push({
        type: 'critical',
        category: 'content',
        description: 'Content is too short',
        fix: 'Expand content to at least 300 words for better SEO',
        impact: 8
      });
    }

    // Focus keyword density
    if (focusKeyword) {
      const keywordCount = (content.toLowerCase().match(new RegExp(focusKeyword.toLowerCase(), 'g')) || []).length;
      const density = (keywordCount / wordCount) * 100;

      if (density < 0.5) {
        issues.push({
          type: 'warning',
          category: 'keywords',
          description: 'Focus keyword density too low',
          fix: `Include "${focusKeyword}" more naturally in content (target 0.5-2.5%)`,
          impact: 6
        });
      } else if (density > 2.5) {
        issues.push({
          type: 'warning',
          category: 'keywords',
          description: 'Focus keyword density too high',
          fix: `Reduce frequency of "${focusKeyword}" to avoid keyword stuffing`,
          impact: 7
        });
      }
    }

    return issues;
  }

  private analyzeHeadings(content: string, focusKeyword?: string): SEOIssue[] {
    const issues: SEOIssue[] = [];
    const headings = this.extractHeadings(content);

    if (headings.length === 0) {
      issues.push({
        type: 'critical',
        category: 'headings',
        description: 'No headings found',
        fix: 'Add H2, H3 headings to structure content',
        impact: 8
      });
    }

    // Check for H1 (should be title)
    const h1Count = headings.filter(h => h.level === 1).length;
    if (h1Count > 1) {
      issues.push({
        type: 'warning',
        category: 'headings',
        description: 'Multiple H1 tags found',
        fix: 'Use only one H1 tag (usually the title)',
        impact: 5
      });
    }

    // Focus keyword in headings
    if (focusKeyword) {
      const keywordInHeadings = headings.some(h => 
        h.text.toLowerCase().includes(focusKeyword.toLowerCase())
      );
      
      if (!keywordInHeadings) {
        issues.push({
          type: 'suggestion',
          category: 'headings',
          description: 'Focus keyword not in headings',
          fix: `Include "${focusKeyword}" in at least one heading`,
          impact: 4
        });
      }
    }

    return issues;
  }

  private analyzeLinks(content: string): SEOIssue[] {
    const issues: SEOIssue[] = [];
    const links = this.extractLinks(content);

    if (links.internal === 0 && content.split(/\s+/).length > 500) {
      issues.push({
        type: 'suggestion',
        category: 'links',
        description: 'No internal links found',
        fix: 'Add internal links to related content',
        impact: 4
      });
    }

    if (links.external === 0 && content.split(/\s+/).length > 800) {
      issues.push({
        type: 'suggestion',
        category: 'links',
        description: 'No external links found',
        fix: 'Consider adding relevant external links to authoritative sources',
        impact: 3
      });
    }

    return issues;
  }

  private analyzeImages(content: string): SEOIssue[] {
    const issues: SEOIssue[] = [];
    const images = content.match(/<img[^>]*>/gi) || [];
    
    images.forEach((img, index) => {
      if (!img.includes('alt=')) {
        issues.push({
          type: 'warning',
          category: 'images',
          description: `Image ${index + 1} missing alt text`,
          fix: 'Add descriptive alt text to all images',
          impact: 5
        });
      }
    });

    return issues;
  }

  private async analyzeKeywords(content: string, focusKeyword?: string): Promise<KeywordAnalysis[]> {
    const wordCount = content.split(/\s+/).length;
    const keywords: KeywordAnalysis[] = [];

    if (focusKeyword) {
      const frequency = (content.toLowerCase().match(new RegExp(focusKeyword.toLowerCase(), 'g')) || []).length;
      const density = (frequency / wordCount) * 100;
      const prominence = this.calculateKeywordProminence(content, focusKeyword);

      keywords.push({
        keyword: focusKeyword,
        density,
        frequency,
        prominence,
        recommendations: this.generateKeywordRecommendations(density, prominence)
      });
    }

    return keywords;
  }

  private calculateKeywordProminence(content: string, keyword: string): number {
    let score = 0;
    const lowerContent = content.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    
    // First 100 words
    const firstPart = lowerContent.split(/\s+/).slice(0, 100).join(' ');
    if (firstPart.includes(lowerKeyword)) score += 3;
    
    // Last 100 words
    const words = lowerContent.split(/\s+/);
    const lastPart = words.slice(-100).join(' ');
    if (lastPart.includes(lowerKeyword)) score += 2;
    
    // In headings
    const headings = this.extractHeadings(content);
    const inHeadings = headings.some(h => h.text.toLowerCase().includes(lowerKeyword));
    if (inHeadings) score += 5;
    
    return score;
  }

  private generateKeywordRecommendations(density: number, prominence: number): string[] {
    const recommendations: string[] = [];
    
    if (density < 0.5) {
      recommendations.push('Increase keyword usage naturally throughout content');
    } else if (density > 2.5) {
      recommendations.push('Reduce keyword frequency to avoid over-optimization');
    }
    
    if (prominence < 3) {
      recommendations.push('Include keyword in introduction or headings');
    }
    
    return recommendations;
  }

  private async generateAIRecommendations(
    title: string,
    content: string,
    issues: SEOIssue[],
    focusKeyword?: string
  ): Promise<SEORecommendation[]> {
    try {
      const prompt = `Analyze this content for SEO improvements:
      
Title: ${title}
Content: ${content.substring(0, 1000)}...
Focus keyword: ${focusKeyword || 'None specified'}

Current issues: ${issues.map(i => i.description).join(', ')}

Provide specific, actionable SEO recommendations in JSON format:
[{"type": "add|modify|remove", "element": "title|content|meta|headings", "current": "current text", "suggested": "improved text", "reason": "explanation"}]`;

      const response = await this.aiService.generateContent({
        type: 'complete',
        input: { prompt },
        options: { maxTokens: 1000, temperature: 0.3 }
      });

      try {
        return JSON.parse(response.text);
      } catch {
        return [];
      }
    } catch (error) {
      console.error('Error generating AI recommendations:', error);
      return [];
    }
  }

  private async optimizeTitle(title: string, focusKeyword: string): Promise<string> {
    const prompt = `Optimize this blog post title for SEO:
    
Current title: "${title}"
Focus keyword: "${focusKeyword}"

Requirements:
- Include focus keyword naturally
- Keep under 60 characters
- Make it compelling and click-worthy
- Maintain the original meaning

Return only the optimized title.`;

    try {
      const response = await this.aiService.generateContent({
        type: 'complete',
        input: { prompt },
        options: { maxTokens: 100, temperature: 0.5 }
      });

      return response.text.replace(/^["']|["']$/g, '').trim();
    } catch (error) {
      return title;
    }
  }

  private async optimizeContentStructure(
    content: string,
    focusKeywords: string[],
    targetAudience?: string
  ): Promise<string> {
    const prompt = `Optimize this content for SEO while maintaining readability:

Content: ${content}
Focus keywords: ${focusKeywords.join(', ')}
Target audience: ${targetAudience || 'General readers'}

Optimization goals:
- Improve keyword placement and density (0.5-2.5%)
- Enhance readability and flow
- Add relevant headings if missing
- Ensure proper paragraph structure

Return the optimized content.`;

    try {
      const response = await this.aiService.generateContent({
        type: 'improve',
        input: { text: content, context: prompt },
        options: { maxTokens: Math.min(4000, content.length * 2) }
      });

      return response.text;
    } catch (error) {
      return content;
    }
  }

  private async generateOptimizedMetaDescription(
    content: string,
    focusKeyword: string
  ): Promise<string> {
    const prompt = `Create an SEO-optimized meta description for this content:

Content: ${content.substring(0, 500)}...
Focus keyword: "${focusKeyword}"

Requirements:
- 150-160 characters
- Include focus keyword naturally
- Compelling and click-worthy
- Summarize main value proposition

Return only the meta description.`;

    try {
      const response = await this.aiService.generateContent({
        type: 'complete',
        input: { prompt },
        options: { maxTokens: 100, temperature: 0.6 }
      });

      return response.text.substring(0, 160);
    } catch (error) {
      return content.substring(0, 157) + '...';
    }
  }

  private optimizeHeadingStructure(content: string, focusKeywords: string[]): HeadingStructure[] {
    const headings = this.extractHeadings(content);
    
    return headings.map(heading => ({
      level: heading.level,
      text: heading.text,
      keywords: focusKeywords.filter(keyword => 
        heading.text.toLowerCase().includes(keyword.toLowerCase())
      )
    }));
  }

  private async generateInternalLinkSuggestions(content: string): Promise<LinkSuggestion[]> {
    // This would integrate with a content database to suggest relevant internal links
    // For now, return basic suggestions based on content analysis
    const suggestions: LinkSuggestion[] = [];
    
    // Extract key topics from content for link suggestions
    const topics = this.extractTopics(content);
    
    topics.forEach(topic => {
      suggestions.push({
        anchor: topic,
        target: `/blog/${topic.toLowerCase().replace(/\s+/g, '-')}`,
        reason: `Related content about ${topic}`
      });
    });
    
    return suggestions.slice(0, 3); // Limit to top 3 suggestions
  }

  private extractHeadings(content: string): Array<{level: number; text: string}> {
    const headings: Array<{level: number; text: string}> = [];
    
    // HTML headings
    const htmlHeadings = content.match(/<h([1-6])[^>]*>(.*?)<\/h[1-6]>/gi) || [];
    htmlHeadings.forEach(heading => {
      const levelMatch = heading.match(/<h([1-6])/);
      const textMatch = heading.match(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/);
      if (levelMatch && textMatch) {
        headings.push({
          level: parseInt(levelMatch[1]),
          text: textMatch[1].replace(/<[^>]*>/g, '')
        });
      }
    });
    
    // Markdown headings
    const markdownHeadings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
    markdownHeadings.forEach(heading => {
      const level = (heading.match(/^#+/) || [''])[0].length;
      const text = heading.replace(/^#+\s+/, '');
      headings.push({ level, text });
    });
    
    return headings;
  }

  private extractLinks(content: string): {internal: number; external: number} {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let internal = 0;
    let external = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.startsWith('http') && !url.includes('localhost')) {
        external++;
      } else if (!url.startsWith('http') || url.includes('localhost')) {
        internal++;
      }
    }

    return { internal, external };
  }

  private extractTopics(content: string): string[] {
    // Simple topic extraction - in production this would use NLP
    const words = content.toLowerCase()
      .replace(/[^a-z\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 4);
    
    const frequency: Record<string, number> = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });
    
    return Object.entries(frequency)
      .filter(([_, count]) => count >= 3)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  }

  private calculateSEOScore(
    issues: SEOIssue[],
    content: string,
    title: string,
    metaDescription?: string
  ): number {
    let score = 100;
    
    // Deduct points for issues
    issues.forEach(issue => {
      switch (issue.type) {
        case 'critical':
          score -= issue.impact;
          break;
        case 'warning':
          score -= issue.impact * 0.7;
          break;
        case 'suggestion':
          score -= issue.impact * 0.3;
          break;
      }
    });
    
    // Bonus points for good practices
    if (content.split(/\s+/).length > 500) score += 5;
    if (title.length >= 30 && title.length <= 60) score += 5;
    if (metaDescription && metaDescription.length >= 150 && metaDescription.length <= 160) score += 5;
    
    return Math.max(0, Math.min(100, score));
  }
}