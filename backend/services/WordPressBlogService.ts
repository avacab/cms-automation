import { WordPressAuthService } from './WordPressAuthService.js';
import { AIService } from '../ai-writing-assistant/src/services/AIService.js';
import { EventEmitter } from 'events';

interface BlogPostRequest {
  title?: string;
  topic: string;
  keywords?: string[];
  targetLength?: number;
  tone?: string[];
  brandVoiceId?: string;
  categories?: string[];
  tags?: string[];
  scheduledDate?: Date;
  status?: 'draft' | 'publish' | 'private' | 'pending';
  seoSettings?: {
    metaDescription?: string;
    focusKeyword?: string;
    slug?: string;
  };
}

interface BlogPostContent {
  id: string;
  title: string;
  content: string;
  excerpt: string;
  slug: string;
  status: string;
  metadata: {
    seoScore?: number;
    readabilityScore?: number;
    keywordDensity?: Record<string, number>;
    wordCount: number;
    estimatedReadTime: number;
  };
  seoData: {
    metaDescription: string;
    focusKeyword?: string;
    headings: string[];
    internalLinks: number;
    externalLinks: number;
  };
}

interface PublishResult {
  success: boolean;
  wordpressId?: number;
  url?: string;
  error?: string;
  warnings?: string[];
}

export class WordPressBlogService extends EventEmitter {
  private authService: WordPressAuthService;
  private aiService: AIService;

  constructor(authService: WordPressAuthService, aiService: AIService) {
    super();
    this.authService = authService;
    this.aiService = aiService;
  }

  /**
   * Generate blog post content using AI
   */
  async generateBlogPost(request: BlogPostRequest): Promise<BlogPostContent> {
    try {
      this.emit('generation_started', { topic: request.topic });

      // Build AI generation prompt
      const aiRequest = {
        type: 'complete' as const,
        input: {
          prompt: this.buildBlogPrompt(request),
          context: `Generate a comprehensive blog post about: ${request.topic}`
        },
        options: {
          brandVoiceId: request.brandVoiceId,
          targetLength: request.targetLength || 1000,
          keywords: request.keywords,
          targetTone: request.tone,
          maxTokens: Math.max(2000, (request.targetLength || 1000) * 2)
        }
      };

      // Generate content using AI service
      const aiResponse = await this.aiService.generateContent(aiRequest);
      
      // Extract title and content from AI response
      const { title, content, excerpt } = this.parseAIContent(aiResponse.text, request.title);
      
      // Generate SEO-optimized slug
      const slug = request.seoSettings?.slug || this.generateSlug(title);
      
      // Calculate metadata
      const metadata = this.calculateContentMetadata(content);
      
      // Generate SEO data
      const seoData = await this.generateSEOData(content, request.seoSettings);
      
      const blogPost: BlogPostContent = {
        id: this.generateId(),
        title,
        content,
        excerpt,
        slug,
        status: request.status || 'draft',
        metadata,
        seoData
      };

      this.emit('generation_completed', { blogPost });
      
      return blogPost;

    } catch (error) {
      this.emit('generation_error', { error: error.message, request });
      throw new Error(`Failed to generate blog post: ${error.message}`);
    }
  }

  /**
   * Enhance existing blog content with AI suggestions
   */
  async enhanceBlogContent(content: string, enhancements: string[]): Promise<string> {
    try {
      const enhancedContent = await this.aiService.improveContent(
        content,
        enhancements
      );
      
      return enhancedContent.text;
    } catch (error) {
      throw new Error(`Failed to enhance content: ${error.message}`);
    }
  }

  /**
   * Generate SEO-optimized meta description
   */
  async generateMetaDescription(content: string, maxLength: number = 160): Promise<string> {
    try {
      const aiRequest = {
        type: 'complete' as const,
        input: {
          prompt: `Create a compelling meta description (max ${maxLength} characters) for this blog post content. Focus on the main topic and include a call to action.`,
          context: content.substring(0, 1000) // First 1000 chars for context
        },
        options: {
          maxTokens: 100,
          temperature: 0.7
        }
      };

      const response = await this.aiService.generateContent(aiRequest);
      return response.text.substring(0, maxLength);
    } catch (error) {
      return content.substring(0, maxLength - 3) + '...';
    }
  }

  /**
   * Publish blog post to WordPress
   */
  async publishToWordPress(
    siteUrl: string,
    blogPost: BlogPostContent,
    options: {
      categories?: number[];
      tags?: number[];
      featuredMedia?: number;
      scheduledDate?: Date;
    } = {}
  ): Promise<PublishResult> {
    try {
      if (!this.authService.isAuthenticated(siteUrl)) {
        return { success: false, error: 'Site not authenticated' };
      }

      const headers = this.authService.getAuthHeaders(siteUrl);
      
      // Prepare WordPress post data
      const wpPostData = {
        title: blogPost.title,
        content: blogPost.content,
        excerpt: blogPost.excerpt,
        slug: blogPost.slug,
        status: blogPost.status,
        meta: {
          _yoast_wpseo_metadesc: blogPost.seoData.metaDescription,
          _yoast_wpseo_focuskw: blogPost.seoData.focusKeyword,
          _headless_cms_id: blogPost.id
        },
        categories: options.categories || [],
        tags: options.tags || [],
        featured_media: options.featuredMedia || null,
        date: options.scheduledDate?.toISOString()
      };

      // Create post via WordPress REST API
      const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts`, {
        method: 'POST',
        headers,
        body: JSON.stringify(wpPostData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { 
          success: false, 
          error: `WordPress API error: ${errorData.message || response.statusText}` 
        };
      }

      const postData = await response.json();
      
      this.emit('post_published', {
        blogPost,
        wordpressId: postData.id,
        url: postData.link,
        siteUrl
      });

      return {
        success: true,
        wordpressId: postData.id,
        url: postData.link
      };

    } catch (error) {
      this.emit('publish_error', { error: error.message, blogPost, siteUrl });
      return { success: false, error: error.message };
    }
  }

  /**
   * Update existing WordPress post
   */
  async updateWordPressPost(
    siteUrl: string,
    wordpressId: number,
    blogPost: BlogPostContent
  ): Promise<PublishResult> {
    try {
      const headers = this.authService.getAuthHeaders(siteUrl);
      
      const wpPostData = {
        title: blogPost.title,
        content: blogPost.content,
        excerpt: blogPost.excerpt,
        slug: blogPost.slug,
        status: blogPost.status,
        meta: {
          _yoast_wpseo_metadesc: blogPost.seoData.metaDescription,
          _yoast_wpseo_focuskw: blogPost.seoData.focusKeyword
        }
      };

      const response = await fetch(`${siteUrl}/wp-json/wp/v2/posts/${wordpressId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(wpPostData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.message || response.statusText };
      }

      const postData = await response.json();
      
      return {
        success: true,
        wordpressId: postData.id,
        url: postData.link
      };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get WordPress categories and tags
   */
  async getWordPressTaxonomies(siteUrl: string): Promise<{
    categories: Array<{id: number; name: string; slug: string}>;
    tags: Array<{id: number; name: string; slug: string}>;
  }> {
    try {
      const headers = this.authService.getAuthHeaders(siteUrl);
      
      const [categoriesResponse, tagsResponse] = await Promise.all([
        fetch(`${siteUrl}/wp-json/wp/v2/categories?per_page=100`, { headers }),
        fetch(`${siteUrl}/wp-json/wp/v2/tags?per_page=100`, { headers })
      ]);

      const categories = categoriesResponse.ok ? await categoriesResponse.json() : [];
      const tags = tagsResponse.ok ? await tagsResponse.json() : [];

      return { categories, tags };
    } catch (error) {
      return { categories: [], tags: [] };
    }
  }

  // Private helper methods

  private buildBlogPrompt(request: BlogPostRequest): string {
    let prompt = `Write a comprehensive, engaging blog post about "${request.topic}".`;
    
    if (request.keywords?.length) {
      prompt += ` Include these keywords naturally: ${request.keywords.join(', ')}.`;
    }
    
    if (request.targetLength) {
      prompt += ` Target length: approximately ${request.targetLength} words.`;
    }
    
    if (request.tone?.length) {
      prompt += ` Tone should be: ${request.tone.join(' and ')}.`;
    }

    prompt += `\n\nStructure the post with:
    1. Compelling title
    2. Engaging introduction
    3. Well-organized main content with subheadings
    4. Clear conclusion with call-to-action
    5. Provide a brief excerpt (2-3 sentences)

    Format: Start with "TITLE:" followed by the title, then "EXCERPT:" followed by the excerpt, then "CONTENT:" followed by the main content.`;

    return prompt;
  }

  private parseAIContent(aiText: string, requestTitle?: string): {
    title: string;
    content: string;
    excerpt: string;
  } {
    const titleMatch = aiText.match(/TITLE:\s*(.+?)(?=\n|EXCERPT:|CONTENT:|$)/i);
    const excerptMatch = aiText.match(/EXCERPT:\s*(.+?)(?=\n\n|CONTENT:|$)/is);
    const contentMatch = aiText.match(/CONTENT:\s*(.+)$/is);

    return {
      title: requestTitle || titleMatch?.[1]?.trim() || 'Untitled Blog Post',
      excerpt: excerptMatch?.[1]?.trim() || aiText.substring(0, 200) + '...',
      content: contentMatch?.[1]?.trim() || aiText
    };
  }

  private calculateContentMetadata(content: string) {
    const wordCount = content.split(/\s+/).length;
    const readTimeMinutes = Math.ceil(wordCount / 200); // Average reading speed

    return {
      wordCount,
      estimatedReadTime: readTimeMinutes,
      seoScore: this.calculateSEOScore(content),
      readabilityScore: this.calculateReadabilityScore(content)
    };
  }

  private async generateSEOData(content: string, seoSettings?: BlogPostRequest['seoSettings']) {
    const headings = this.extractHeadings(content);
    const links = this.countLinks(content);
    
    return {
      metaDescription: seoSettings?.metaDescription || await this.generateMetaDescription(content),
      focusKeyword: seoSettings?.focusKeyword,
      headings,
      internalLinks: links.internal,
      externalLinks: links.external
    };
  }

  private extractHeadings(content: string): string[] {
    const headingRegex = /<h[1-6][^>]*>(.*?)<\/h[1-6]>|^#{1,6}\s+(.+)$/gim;
    const headings: string[] = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      headings.push(match[1] || match[2]);
    }
    
    return headings;
  }

  private countLinks(content: string): { internal: number; external: number } {
    const linkRegex = /<a[^>]+href=["']([^"']+)["'][^>]*>/gi;
    let internal = 0;
    let external = 0;
    let match;

    while ((match = linkRegex.exec(content)) !== null) {
      const url = match[1];
      if (url.startsWith('http') && !url.includes(window?.location?.hostname || '')) {
        external++;
      } else {
        internal++;
      }
    }

    return { internal, external };
  }

  private calculateSEOScore(content: string): number {
    let score = 0;
    const wordCount = content.split(/\s+/).length;
    
    // Length score (0-30 points)
    if (wordCount >= 300) score += 30;
    else if (wordCount >= 150) score += 20;
    else score += 10;
    
    // Heading score (0-25 points)
    const headings = this.extractHeadings(content);
    if (headings.length >= 3) score += 25;
    else if (headings.length >= 1) score += 15;
    
    // Link score (0-20 points)
    const links = this.countLinks(content);
    if (links.internal + links.external >= 3) score += 20;
    else if (links.internal + links.external >= 1) score += 10;
    
    // Image score (0-15 points) - simplified check
    if (content.includes('<img') || content.includes('![')) score += 15;
    
    // List score (0-10 points)
    if (content.includes('<ul>') || content.includes('<ol>') || content.includes('-') || content.includes('*')) {
      score += 10;
    }

    return Math.min(100, score);
  }

  private calculateReadabilityScore(content: string): number {
    // Simplified Flesch Reading Ease calculation
    const sentences = content.split(/[.!?]+/).length;
    const words = content.split(/\s+/).length;
    const syllables = this.countSyllables(content);
    
    if (sentences === 0 || words === 0) return 0;
    
    const avgSentenceLength = words / sentences;
    const avgSyllablesPerWord = syllables / words;
    
    const score = 206.835 - (1.015 * avgSentenceLength) - (84.6 * avgSyllablesPerWord);
    
    return Math.max(0, Math.min(100, score));
  }

  private countSyllables(text: string): number {
    return text.toLowerCase()
      .replace(/[^a-z]/g, '')
      .replace(/[aeiou]+/g, 'a')
      .length || 1;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}